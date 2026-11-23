use nsh_core::prelude::*;

use crate::providers::ApiError;

#[derive(JsObject)]
#[prop(exact)]
pub struct TranslateInput {
    pub request_id: String,
    pub profile_id: String,
    pub text: String,
    pub target: String,
}

#[derive(Clone, PropEnum)]
pub enum TranslateEventKind {
    Delta,
    Done,
    Error,
    Cancelled,
}

#[derive(JsObject)]
pub struct TranslateEvent {
    pub request_id: String,
    #[prop(rename = "type")]
    pub kind: TranslateEventKind,
    pub text: Option<String>,
    pub error: Option<ApiError>,
}

/// 按请求流式返回译文。
#[module]
pub struct Translation;

#[module]
impl Translation {
    /// 在 engine 中校验并登记任务，返回受理错误或空值。
    pub fn start(
        input: TranslateInput,
        #[args(event)] on_event: Callback<TranslateEvent>,
        _cx: &mut ModuleCx,
    ) -> Option<ApiError> {
        platform::start(input, on_event).err()
    }

    /// 按调用顺序中止尚未结束的任务。
    pub fn cancel(request_id: String, _cx: &mut ModuleCx) {
        platform::cancel(request_id);
    }
}

#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
mod platform {
    use std::{cell::RefCell, collections::HashMap, rc::Rc};

    use futures_util::future::{AbortHandle, Abortable};

    use super::*;
    use crate::{plugins::openai, providers::resolve, secrets};

    type Requests = Rc<RefCell<HashMap<String, AbortHandle>>>;

    struct Registration {
        requests: Requests,
        id: String,
    }

    impl Drop for Registration {
        fn drop(&mut self) {
            self.requests.borrow_mut().remove(&self.id);
        }
    }

    pub(super) fn start(
        input: TranslateInput,
        callback: Callback<TranslateEvent>,
    ) -> Result<(), ApiError> {
        let target = match input.target.as_str() {
            "zh-Hans" => "Simplified Chinese",
            "zh-Hant" => "Traditional Chinese",
            "en" => "English",
            "ja" => "Japanese",
            "ko" => "Korean",
            _ => {
                return Err(ApiError::new(
                    "UNSUPPORTED_LANGUAGE",
                    "请选择支持的目标语言。",
                    false,
                ));
            }
        };
        if input.text.trim().is_empty() || input.text.chars().count() > 50_000 {
            return Err(ApiError::invalid("请输入原文，最多 50,000 字符。"));
        }
        let id = input.request_id;
        if id.is_empty() || id.len() > 64 {
            return Err(ApiError::invalid("翻译请求 ID 无效。"));
        }
        let requests = global::<Requests>().get_untracked();
        if requests.borrow().contains_key(&id) {
            return Err(ApiError::invalid("翻译请求 ID 已在使用。"));
        }
        let (profile, connection) = resolve(&input.profile_id)?;
        profile.require_connected_protocol()?;
        if !profile.enabled || profile.model.trim().is_empty() {
            return Err(ApiError::invalid("请选择已启用且已设置模型的服务商。"));
        }

        let (abort, signal) = AbortHandle::new_pair();
        let registration = Registration {
            requests: requests.clone(),
            id: id.clone(),
        };
        requests.borrow_mut().insert(id, abort);
        spawn(async move {
            let mut final_text = String::new();
            let result = Abortable::new(
                async {
                    let key = secrets::load(profile.id, connection.base_url.clone())?;
                    openai::translate(connection, key, profile.model, input.text, target, |text| {
                        final_text.push_str(&text);
                        let answer = callback.call_async(TranslateEvent {
                            request_id: registration.id.clone(),
                            kind: TranslateEventKind::Delta,
                            text: Some(text),
                            error: None,
                        });
                        async move {
                            answer
                                .await
                                .map_err(|_| ApiError::new("INTERNAL", "无法更新翻译结果。", false))
                        }
                    })
                    .await
                },
                signal,
            )
            .await;
            let (kind, text, error) = match result {
                Ok(Ok(())) => (TranslateEventKind::Done, Some(final_text), None),
                Ok(Err(error)) => (TranslateEventKind::Error, None, Some(error)),
                Err(_) => (TranslateEventKind::Cancelled, None, None),
            };
            callback.post(TranslateEvent {
                request_id: registration.id.clone(),
                kind,
                text,
                error,
            });
            drop(registration);
        });
        Ok(())
    }

    pub(super) fn cancel(id: String) {
        let requests = global::<Requests>().get_untracked();
        if let Some(abort) = requests.borrow().get(&id) {
            abort.abort();
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
mod platform {
    use super::*;

    pub(super) fn start(_: TranslateInput, _: Callback<TranslateEvent>) -> Result<(), ApiError> {
        Err(ApiError::unsupported())
    }

    pub(super) fn cancel(_: String) {}
}
