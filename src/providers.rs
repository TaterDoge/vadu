use nsh_core::{prelude::*, storage::Storage};
use serde::Deserialize;
use serde_json::{Map, Value};
use url::Url;

const CONFIG_KEY: &str = "vadu.config";
const SCHEMA_VERSION: u64 = 3;

#[derive(JsObject)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

impl ApiError {
    pub(crate) fn new(code: &str, message: &str, retryable: bool) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            retryable,
        }
    }

    pub(crate) fn invalid(message: &str) -> Self {
        Self::new("INVALID_CONFIG", message, false)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    pub(crate) fn unsupported() -> Self {
        Self::new("PERMISSION_DENIED", "当前平台不支持服务商连接。", false)
    }
}

#[derive(Deserialize, PropEnum)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderProtocol {
    #[prop(rename = "chat-completions")]
    ChatCompletions,
    Responses,
    #[prop(rename = "anthropic-messages")]
    AnthropicMessages,
}

#[derive(Deserialize, JsObject)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProviderProfile {
    pub id: String,
    pub name: String,
    pub protocol: ProviderProtocol,
    pub base_url: String,
    pub model: String,
    pub enabled: bool,
    pub temperature: String,
    pub provider_options: String,
    pub headers: String,
}

#[cfg_attr(
    not(any(target_os = "macos", target_os = "windows", target_os = "linux")),
    allow(dead_code)
)]
pub(crate) struct Connection {
    pub(crate) base_url: Url,
    pub(crate) temperature: f64,
    pub(crate) options: Map<String, Value>,
    pub(crate) headers: http::HeaderMap,
}

fn bad_url() -> ApiError {
    ApiError::invalid("请输入有效的 HTTP 或 HTTPS 接口地址，不能包含凭据、查询参数或片段。")
}

pub(crate) fn base_url(raw: &str) -> Result<Url, ApiError> {
    let (_, authority_and_path) = raw.split_once("://").ok_or_else(bad_url)?;
    let authority = authority_and_path.split('/').next().unwrap_or_default();
    if raw.chars().count() > 2000
        || raw.chars().any(|ch| ch.is_whitespace() || ch.is_control())
        || raw.contains(['\\', '?', '#'])
        || authority.is_empty()
        || authority.contains('@')
    {
        return Err(bad_url());
    }
    let mut url = Url::parse(raw).map_err(|_| bad_url())?;
    if !matches!(url.scheme(), "http" | "https") || url.host().is_none() {
        return Err(bad_url());
    }
    let path = url.path().trim_end_matches('/').to_owned();
    url.set_path(&path);
    Ok(url)
}

fn object(text: &str, message: &str) -> Result<Map<String, Value>, ApiError> {
    if text.is_empty() {
        return Ok(Map::new());
    }
    serde_json::from_str(text).map_err(|_| ApiError::invalid(message))
}

fn credential_field(name: &str) -> bool {
    matches!(
        name,
        "authorization"
            | "proxy-authorization"
            | "cookie"
            | "set-cookie"
            | "api-key"
            | "api_key"
            | "apikey"
            | "access_token"
    ) || name.ends_with("-api-key")
        || name.ends_with("-token")
}

fn contains_credentials(value: &Value) -> bool {
    match value {
        Value::Object(fields) => fields.iter().any(|(name, value)| {
            credential_field(&name.to_ascii_lowercase()) || contains_credentials(value)
        }),
        Value::Array(items) => items.iter().any(contains_credentials),
        _ => false,
    }
}

impl ProviderProfile {
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    pub(crate) fn require_connected_protocol(&self) -> Result<(), ApiError> {
        match self.protocol {
            ProviderProtocol::ChatCompletions => Ok(()),
            _ => Err(ApiError::new(
                "UNSUPPORTED_PROTOCOL",
                "该 API 协议尚未接入。",
                false,
            )),
        }
    }

    fn validate(&self) -> Result<Connection, ApiError> {
        if self.id.is_empty()
            || self.id.len() > 64
            || !self
                .id
                .bytes()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == b'-')
        {
            return Err(ApiError::invalid("服务商 ID 无效。"));
        }
        if self.name.trim().is_empty() || self.base_url.is_empty() {
            return Err(ApiError::invalid("请填写名称和接口地址。"));
        }
        if self.name.chars().count() > 100 || self.model.chars().count() > 300 {
            return Err(ApiError::invalid("名称或模型 ID 过长。"));
        }
        let base_url = base_url(&self.base_url)?;
        let temperature = self
            .temperature
            .parse::<f64>()
            .ok()
            .filter(|number| (0.0..=1.0).contains(number))
            .ok_or_else(|| ApiError::invalid("温度须为 0 到 1 之间的数字。"))?;
        if self.headers.len() > 16_384 || self.provider_options.len() > 32_768 {
            return Err(ApiError::invalid("高级选项过长。"));
        }
        let options = object(&self.provider_options, "服务商选项须为有效的 JSON 对象。")?;
        if options.keys().any(|name| {
            matches!(
                name.as_str(),
                "model" | "messages" | "stream" | "temperature" | "n"
            )
        }) {
            return Err(ApiError::invalid(
                "服务商选项不能覆盖模型、消息、温度或流式参数。",
            ));
        }
        if options.iter().any(|(name, value)| {
            credential_field(&name.to_ascii_lowercase()) || contains_credentials(value)
        }) {
            return Err(ApiError::invalid("服务商选项不能包含认证或凭据字段。"));
        }
        let saved_headers = object(&self.headers, "请求头须为有效的 JSON 对象。")?;
        let mut headers = http::HeaderMap::new();
        let bad_header = || ApiError::invalid("请求头名称须符合 HTTP 格式，值须为单行字符串。");
        for (name, value) in saved_headers {
            let name = http::HeaderName::try_from(name).map_err(|_| bad_header())?;
            if credential_field(name.as_str()) {
                return Err(ApiError::invalid("请求头不能包含认证或凭据字段。"));
            }
            if matches!(
                name.as_str(),
                "host"
                    | "connection"
                    | "upgrade"
                    | "content-length"
                    | "transfer-encoding"
                    | "te"
                    | "trailer"
                    | "expect"
                    | "keep-alive"
                    | "proxy-connection"
                    | "content-type"
                    | "accept"
                    | "accept-encoding"
            ) {
                return Err(ApiError::invalid("请求头不能覆盖连接或消息格式。"));
            }
            let value = http::HeaderValue::from_str(value.as_str().ok_or_else(bad_header)?)
                .map_err(|_| bad_header())?;
            if headers.insert(name, value).is_some() {
                return Err(ApiError::invalid("请求头名称重复。"));
            }
        }
        Ok(Connection {
            base_url,
            temperature,
            options,
            headers,
        })
    }
}

#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
pub(crate) fn resolve(id: &str) -> Result<(ProviderProfile, Connection), ApiError> {
    let missing = || ApiError::invalid("服务商配置不存在或已损坏。");
    let saved = Storage::get_item(CONFIG_KEY).ok_or_else(missing)?;
    let document: Value = serde_json::from_str(&saved).map_err(|_| missing())?;
    let version = document["schemaVersion"].as_u64().ok_or_else(missing)?;
    if version != 2 && version != SCHEMA_VERSION {
        return Err(missing());
    }
    let profiles = document["profiles"].as_array().ok_or_else(missing)?;
    let mut matches = profiles
        .iter()
        .filter(|profile| profile["id"].as_str() == Some(id));
    let mut value = matches.next().ok_or_else(missing)?.clone();
    if matches.next().is_some() {
        return Err(missing());
    }
    if version == 2 {
        let fields = value.as_object_mut().ok_or_else(missing)?;
        if fields
            .insert("protocol".into(), Value::String("chat-completions".into()))
            .is_some()
        {
            return Err(missing());
        }
    }
    let profile: ProviderProfile = serde_json::from_value(value).map_err(|_| missing())?;
    let connection = profile.validate()?;
    Ok((profile, connection))
}

#[derive(JsObject)]
pub struct ProfileCheck {
    pub profile: Option<ProviderProfile>,
    pub origin: Option<String>,
    pub error: Option<ApiError>,
}

#[derive(JsObject)]
pub struct ModelList {
    pub models: Option<Vec<String>>,
    pub error: Option<ApiError>,
}

/// 校验翻译服务商配置并获取可用模型。
#[module]
pub struct Profiles;

#[module]
impl Profiles {
    /// 校验 Profile，返回规范化地址与用于确认的来源。
    pub fn check(profile: Value) -> ProfileCheck {
        let result = serde_json::from_value::<ProviderProfile>(profile)
            .map_err(|_| ApiError::invalid("服务商配置格式无效。"))
            .and_then(|profile| profile.validate().map(|connection| (profile, connection)));
        match result {
            Ok((mut profile, connection)) => {
                profile.base_url = connection.base_url.to_string();
                ProfileCheck {
                    profile: Some(profile),
                    origin: Some(connection.base_url.origin().ascii_serialization()),
                    error: None,
                }
            }
            Err(error) => ProfileCheck {
                profile: None,
                origin: None,
                error: Some(error),
            },
        }
    }

    /// 通过已保存的 Profile 查询模型，允许尚未填写模型。
    pub async fn list_models(profile_id: String) -> ModelList {
        #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
        let result = async {
            let (profile, connection) = resolve(&profile_id)?;
            profile.require_connected_protocol()?;
            let key = crate::secrets::load(profile_id, connection.base_url.clone())?;
            crate::plugins::openai::list_models(connection.base_url, connection.headers, key).await
        }
        .await;
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        let result = {
            let _ = profile_id;
            Err(ApiError::unsupported())
        };
        match result {
            Ok(models) => ModelList {
                models: Some(models),
                error: None,
            },
            Err(error) => ModelList {
                models: None,
                error: Some(error),
            },
        }
    }

    /// 使用设置页已确认的地址和本次输入的密钥查询模型，不保存配置或凭据。
    pub async fn list_models_draft(address: String, key: String) -> ModelList {
        #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
        let result = async {
            let key = key.trim();
            if key.is_empty() {
                return Err(ApiError::invalid("请先输入 API Key。"));
            }
            crate::plugins::openai::list_models(
                base_url(address.trim())?,
                http::HeaderMap::new(),
                Some(key.to_owned()),
            )
            .await
        }
        .await;
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        let result = {
            let _ = (address, key);
            Err(ApiError::unsupported())
        };
        match result {
            Ok(models) => ModelList {
                models: Some(models),
                error: None,
            },
            Err(error) => ModelList {
                models: None,
                error: Some(error),
            },
        }
    }

    /// 使用已保存 Profile 的连接和凭据检测指定模型是否能完成一次对话。
    pub async fn check_model(profile_id: String, model: String) -> Option<ApiError> {
        #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
        let result = async {
            let model = model.trim().to_owned();
            if model.is_empty()
                || model.chars().count() > 300
                || model.chars().any(char::is_control)
            {
                return Err(ApiError::invalid("请选择有效的模型 ID。"));
            }
            let (profile, connection) = resolve(&profile_id)?;
            profile.require_connected_protocol()?;
            let key = crate::secrets::load(profile_id, connection.base_url.clone())?;
            crate::plugins::openai::check_model(connection, key, model).await
        }
        .await;
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        let result = {
            let _ = (profile_id, model);
            Err(ApiError::unsupported())
        };
        result.err()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn endpoint_canonicalization_and_credentials() {
        let url = base_url("https://EXAMPLE.com:443/proxy/v1///")
            .ok()
            .unwrap();
        assert_eq!(url.as_str(), "https://example.com/proxy/v1");
        for input in [
            "https://@example.com",
            "https://a:b@example.com/v1",
            "https://example.com?key=x",
            "https://example.com#",
            "https:///example.com",
            "file:///tmp/x",
        ] {
            assert!(base_url(input).is_err(), "{input}");
        }
    }

    #[test]
    fn validates_profile_without_model_and_rejects_overrides() {
        let mut profile = json!({
            "id":"one", "name":"测试", "protocol":"chat-completions",
            "baseUrl":"https://example.com/v1", "model":"", "enabled":true,
            "temperature":"0.3", "providerOptions":"", "headers":""
        });
        assert!(Profiles::check(profile.clone()).profile.is_some());
        profile["headers"] = json!(r#"{"Host":"other.example"}"#);
        assert!(Profiles::check(profile.clone()).error.is_some());
        profile["headers"] = json!("");
        profile["providerOptions"] = json!(r#"{"stream":false}"#);
        assert!(Profiles::check(profile).error.is_some());
    }
}
