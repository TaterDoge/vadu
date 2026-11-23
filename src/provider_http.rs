use std::time::Duration;

use reqwest::{Client, Response, StatusCode, redirect};
use url::Url;

use crate::providers::ApiError;

pub(crate) fn client(timeout: Duration) -> Result<Client, ApiError> {
    Client::builder()
        .redirect(redirect::Policy::none())
        .retry(reqwest::retry::never())
        .no_proxy()
        .pool_max_idle_per_host(0)
        .connect_timeout(Duration::from_secs(10))
        .read_timeout(Duration::from_secs(25))
        .timeout(timeout)
        .build()
        .map_err(|_| ApiError::new("INTERNAL", "无法初始化网络连接。", false))
}

pub(crate) fn transport_error(error: reqwest::Error) -> ApiError {
    if error.is_timeout() {
        ApiError::new("TIMEOUT", "服务商响应超时，请重试。", true)
    } else {
        ApiError::new("NETWORK", "无法完成服务商请求，请检查地址和网络。", true)
    }
}

pub(crate) fn checked(response: Response) -> Result<Response, ApiError> {
    let status = response.status();
    if status.is_success() {
        return Ok(response);
    }
    Err(match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => ApiError::new(
            "AUTH_FAILED",
            "服务商拒绝访问，请检查 API Key 和权限。",
            false,
        ),
        StatusCode::TOO_MANY_REQUESTS => {
            ApiError::new("RATE_LIMITED", "服务商限流或额度不足，请稍后重试。", true)
        }
        StatusCode::NOT_FOUND => {
            ApiError::invalid("服务商接口或模型不存在，请检查 Base URL 和模型 ID。")
        }
        status if status.is_redirection() => ApiError::new(
            "PERMISSION_DENIED",
            "接口发生重定向，请保存实际的 Base URL。",
            false,
        ),
        status if status.is_server_error() => {
            ApiError::new("NETWORK", "服务商暂时不可用，请稍后重试。", true)
        }
        _ => ApiError::invalid("服务商拒绝请求，请检查模型和高级选项。"),
    })
}

pub(crate) fn endpoint(mut base_url: Url, segment: &str) -> Url {
    // 使用已校验的地址追加路径段，保留反代前缀及原有转义。
    base_url
        .path_segments_mut()
        .expect("已校验 HTTP(S) 地址")
        .pop_if_empty()
        .push(segment);
    base_url
}

pub(crate) fn invalid_response() -> ApiError {
    ApiError::new("NETWORK", "服务商返回的响应格式无效或不完整。", false)
}
