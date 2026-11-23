use nsh_core::prelude::*;

use crate::providers::ApiError;

#[derive(JsObject)]
pub struct SecretStatus {
    pub configured: bool,
    pub error: Option<ApiError>,
}

#[derive(JsObject)]
pub struct RevealedSecret {
    pub key: Option<String>,
    pub error: Option<ApiError>,
}

/// 管理服务商存在 NSH Storage 中的 API Key。
#[module]
pub struct Secrets;

#[module]
impl Secrets {
    /// 查询当前接口地址是否有匹配的 API Key。
    pub async fn has(profile_id: String) -> SecretStatus {
        match platform::load_profile(profile_id) {
            Ok(key) => SecretStatus {
                configured: key.is_some(),
                error: None,
            },
            Err(error) => SecretStatus {
                configured: false,
                error: Some(error),
            },
        }
    }

    /// 设置页按需读取与当前已保存地址匹配的 API Key。
    pub async fn reveal(profile_id: String) -> RevealedSecret {
        match platform::load_profile(profile_id) {
            Ok(key) => RevealedSecret { key, error: None },
            Err(error) => RevealedSecret {
                key: None,
                error: Some(error),
            },
        }
    }

    /// 为当前已保存的地址写入新 API Key。
    pub async fn set(profile_id: String, base_url: String, key: String) -> Option<ApiError> {
        platform::set(profile_id, base_url, key).err()
    }

    /// 清除该 Profile 的 API Key，包括旧地址的。
    pub async fn clear(profile_id: String) -> Option<ApiError> {
        platform::clear(profile_id).err()
    }
}

#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
pub(crate) use platform::load;

#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
mod platform {
    use super::ApiError;
    use crate::providers::resolve;
    use nsh_core::storage::Storage;
    use serde::{Deserialize, Serialize};
    use url::Url;

    #[derive(Serialize, Deserialize)]
    #[serde(deny_unknown_fields)]
    struct StoredSecret {
        base_url: String,
        key: String,
    }

    fn unavailable() -> ApiError {
        ApiError::new("PERMISSION_DENIED", "无法读取本地存储中的 API Key。", false)
    }

    fn invalid_key() -> ApiError {
        ApiError::invalid("请输入不含空白的有效 API Key。")
    }

    fn valid_key(key: &str) -> bool {
        !key.is_empty() && key.len() <= 2_048 && key.bytes().all(|byte| byte.is_ascii_graphic())
    }

    // 每个 Profile 一个存储键，避免并发读改写共享凭据表。
    fn storage_key(profile_id: &str) -> String {
        format!("vadu.secret.{profile_id}")
    }

    fn decode(data: &str) -> Result<StoredSecret, ApiError> {
        let secret: StoredSecret = serde_json::from_str(data)
            .map_err(|_| ApiError::invalid("API Key 数据损坏，请重新输入。"))?;
        valid_key(&secret.key)
            .then_some(secret)
            .ok_or_else(|| ApiError::invalid("API Key 数据损坏，请重新输入。"))
    }

    pub(crate) fn load(profile_id: String, base_url: Url) -> Result<Option<String>, ApiError> {
        let Some(data) = Storage::get_item(&storage_key(&profile_id)) else {
            return Ok(None);
        };
        let secret = decode(&data)?;
        Ok((secret.base_url == base_url.as_str()).then_some(secret.key))
    }

    pub(super) fn load_profile(profile_id: String) -> Result<Option<String>, ApiError> {
        let (_, connection) = resolve(&profile_id)?;
        load(profile_id, connection.base_url)
    }

    pub(super) fn set(profile_id: String, base_url: String, key: String) -> Result<(), ApiError> {
        let (_, connection) = resolve(&profile_id)?;
        if base_url != connection.base_url.as_str() {
            return Err(ApiError::invalid(
                "接口地址已变更，请重新打开服务商后再保存密钥。",
            ));
        }
        if !valid_key(&key) {
            return Err(invalid_key());
        }
        let data =
            serde_json::to_string(&StoredSecret { base_url, key }).map_err(|_| unavailable())?;
        Storage::set_item(storage_key(&profile_id), data)
            .map_err(|_| ApiError::new("STORAGE_FULL", "本地存储空间不足，API Key 未保存。", false))
    }

    pub(super) fn clear(profile_id: String) -> Result<(), ApiError> {
        resolve(&profile_id)?;
        Storage::remove_item(&storage_key(&profile_id));
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn stored_secret_matches_only_its_address() {
            let data = serde_json::to_string(&StoredSecret {
                base_url: "https://example.com/v1".into(),
                key: "sk-test".into(),
            })
            .ok()
            .unwrap();
            let secret = decode(&data).ok().unwrap();
            assert_eq!(secret.key, "sk-test");
            assert_eq!(secret.base_url, "https://example.com/v1");
            for bad in [
                "not json",
                r#"{"base_url":"https://example.com/v1","key":"has space"}"#,
                r#"{"base_url":"https://example.com/v1","key":""}"#,
                r#"{"base_url":"https://example.com/v1","key":"sk","extra":1}"#,
            ] {
                assert!(decode(bad).is_err(), "{bad}");
            }
        }

        #[test]
        fn key_format_and_storage_key_are_bounded() {
            assert!(valid_key("sk-abc_123"));
            assert!(!valid_key(""));
            assert!(!valid_key("a b"));
            assert!(!valid_key("换行\n"));
            assert!(!valid_key(&"a".repeat(2_049)));
            assert_eq!(storage_key("profile-1"), "vadu.secret.profile-1");
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
mod platform {
    use super::ApiError;

    pub(super) fn load_profile(_: String) -> Result<Option<String>, ApiError> {
        Err(ApiError::unsupported())
    }

    pub(super) fn set(_: String, _: String, _: String) -> Result<(), ApiError> {
        Err(ApiError::unsupported())
    }

    pub(super) fn clear(_: String) -> Result<(), ApiError> {
        Err(ApiError::unsupported())
    }
}
