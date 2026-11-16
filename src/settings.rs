use nsh_core::{
    keymap::{Key, Keystroke, Modifiers},
    platform::Os,
    prelude::*,
    storage::Storage,
};
use serde::{Deserialize, Serialize};

const CONFIG_KEY: &str = "vadu.config";
const SCHEMA_VERSION: u32 = 1;
const DEFAULT_SHORTCUTS: &[(&str, &str)] = &[
    ("toggle-translate", "mod+shift+m"),
    ("open-settings", "mod+,"),
    ("pin-translate", "mod+p"),
];

/// 一项快捷键配置，不表示已向系统注册。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsObject)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShortcutBinding {
    /// 稳定的动作标识。
    pub id: String,
    /// NSH 组合键语法；mod 随平台表示 Command 或 Control。
    pub keystroke: String,
}

/// 应用级偏好；不包含 Profile 或密钥。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsObject)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AppSettings {
    /// 快捷键配置。
    pub shortcuts: Vec<ShortcutBinding>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            shortcuts: DEFAULT_SHORTCUTS
                .iter()
                .map(|(id, keystroke)| ShortcutBinding {
                    id: (*id).into(),
                    keystroke: (*keystroke).into(),
                })
                .collect(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConfigDocument {
    schema_version: u32,
    settings: AppSettings,
}

/// 可安全显示的配置错误。
#[derive(Debug, Clone, PartialEq, JsObject)]
pub struct SettingsError {
    /// 稳定错误码。
    pub code: String,
    /// 不包含配置正文的操作提示。
    pub message: String,
}

fn error(code: &str, message: &str) -> SettingsError {
    SettingsError {
        code: code.into(),
        message: message.into(),
    }
}

/// settings 与 error 恰有一项非空；失败时不提交配置。
#[derive(Debug, Clone, JsObject)]
pub struct SettingsReply {
    /// 成功后的完整应用偏好快照。
    pub settings: Option<AppSettings>,
    /// 可预期失败。
    pub error: Option<SettingsError>,
}

impl From<Result<AppSettings, SettingsError>> for SettingsReply {
    fn from(result: Result<AppSettings, SettingsError>) -> Self {
        match result {
            Ok(settings) => Self {
                settings: Some(settings),
                error: None,
            },
            Err(error) => Self {
                settings: None,
                error: Some(error),
            },
        }
    }
}

fn parse_shortcut(text: &str, os: Os, apple: bool) -> Result<Keystroke, SettingsError> {
    let invalid = || {
        error(
            "INVALID_CONFIG",
            "请按 Command / Ctrl / Alt 与其他键的组合，或 F1–F24。",
        )
    };
    if text.len() > 128 {
        return Err(invalid());
    }
    let stroke = Keystroke::parse_with(text, apple).map_err(|_| invalid())?;
    let m = stroke.modifiers;
    if !m.ctrl && !m.alt && !m.cmd && !matches!(stroke.key, Key::F(_)) {
        return Err(invalid());
    }
    if stroke.reserved(os).is_some() {
        return Err(error(
            "INVALID_CONFIG",
            "此组合键由系统保留，请选择其他快捷键。",
        ));
    }
    Ok(stroke)
}

fn normalize_shortcut(stroke: Keystroke, apple: bool) -> String {
    stroke
        .to_string()
        .split('+')
        .map(|part| match (part, apple) {
            ("cmd", true) | ("ctrl", false) => "mod",
            _ => part,
        })
        .collect::<Vec<_>>()
        .join("+")
}

fn validate(settings: &AppSettings, os: Os, apple: bool) -> Result<(), SettingsError> {
    if settings.shortcuts.len() != DEFAULT_SHORTCUTS.len()
        || DEFAULT_SHORTCUTS
            .iter()
            .any(|(id, _)| settings.shortcuts.iter().filter(|s| s.id == *id).count() != 1)
    {
        return Err(error(
            "INVALID_CONFIG",
            "快捷键配置不完整或包含未知动作，原配置已保留。",
        ));
    }
    let mut strokes = Vec::new();
    for binding in &settings.shortcuts {
        let stroke = parse_shortcut(&binding.keystroke, os, apple)?;
        if strokes.contains(&stroke) {
            return Err(error(
                "SHORTCUT_CONFLICT",
                "此快捷键已用于其他动作，请选择其他组合。",
            ));
        }
        strokes.push(stroke);
    }
    Ok(())
}

fn decode(saved: Option<&str>, os: Os, apple: bool) -> Result<AppSettings, SettingsError> {
    let Some(saved) = saved else {
        return Ok(AppSettings::default());
    };
    let invalid = || {
        error(
            "INVALID_CONFIG",
            "配置格式损坏或不受支持，原配置已保留，未覆盖。",
        )
    };
    let value: serde_json::Value = serde_json::from_str(saved).map_err(|_| invalid())?;
    if value.get("schemaVersion").and_then(|v| v.as_u64()) != Some(SCHEMA_VERSION.into()) {
        return Err(error(
            "UNSUPPORTED_VERSION",
            "配置版本不受支持，请使用对应版本的应用；原配置未覆盖。",
        ));
    }
    let document: ConfigDocument = serde_json::from_value(value).map_err(|_| invalid())?;
    validate(&document.settings, os, apple)?;
    Ok(document.settings)
}

fn encode(settings: AppSettings) -> Result<String, SettingsError> {
    serde_json::to_string(&ConfigDocument {
        schema_version: SCHEMA_VERSION,
        settings,
    })
    .map_err(|_| error("INTERNAL", "无法编码配置，原配置未修改。"))
}

fn change_shortcut(
    mut settings: AppSettings,
    id: &str,
    text: &str,
    os: Os,
    apple: bool,
) -> Result<AppSettings, SettingsError> {
    let stroke = parse_shortcut(text, os, apple)?;
    let binding = settings
        .shortcuts
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| error("INVALID_CONFIG", "未知快捷键动作。"))?;
    binding.keystroke = normalize_shortcut(stroke, apple);
    validate(&settings, os, apple)?;
    Ok(settings)
}

fn capture_keys(os: Os) -> Vec<String> {
    let mut keys: Vec<String> = "abcdefghijklmnopqrstuvwxyz0123456789`-=[]\\;',./"
        .chars()
        .map(|c| c.to_string())
        .collect();
    keys.extend(
        [
            "space",
            "enter",
            "escape",
            "tab",
            "backspace",
            "delete",
            "insert",
            "up",
            "down",
            "left",
            "right",
            "home",
            "end",
            "pageup",
            "pagedown",
        ]
        .into_iter()
        .map(str::to_owned),
    );
    keys.extend((1..=24).map(|n| format!("f{n}")));
    let mut result = Vec::new();
    for mask in 0..16 {
        let modifiers = Modifiers {
            ctrl: mask & 1 != 0,
            alt: mask & 2 != 0,
            shift: mask & 4 != 0,
            cmd: mask & 8 != 0,
        };
        for key in &keys {
            let mut stroke = Keystroke::parse_with(key, false).expect("固定键名有效");
            stroke.modifiers = modifiers;
            let text = stroke.to_string();
            // Tab 留给移焦；Esc 退出录入，不作为无修饰键的快捷键。
            if !["escape", "tab", "shift+tab"].contains(&text.as_str())
                && stroke.reserved(os).is_none()
            {
                result.push(text);
            }
        }
    }
    result
}

/// 应用配置的唯一业务写入口，底层复用 NSH Storage。
#[module]
pub struct Settings;

// ModuleCx 使调用进入 Rust runtime，直接同步导出无法访问 Storage 与平台状态。
#[module]
impl Settings {
    /// 读取配置；不存在时使用默认值，不自动写盘。
    pub fn read(_cx: &mut ModuleCx) -> SettingsReply {
        decode(Storage::get_item(CONFIG_KEY).as_deref(), os(), apple_keys()).into()
    }

    /// 只更新一个动作，重新读取最新快照后校验，避免页面旧副本覆盖其他设置。
    pub fn set_shortcut(id: String, keystroke: String, _cx: &mut ModuleCx) -> SettingsReply {
        let update = || {
            let current = decode(Storage::get_item(CONFIG_KEY).as_deref(), os(), apple_keys())?;
            let next = change_shortcut(current, &id, &keystroke, os(), apple_keys())?;
            let json = encode(next.clone())?;
            Storage::set_item(CONFIG_KEY, json)
                .map_err(|_| error("STORAGE_FULL", "配置存储空间不足，修改未保存。"))?;
            Ok(next)
        };
        update().into()
    }

    /// 将一个动作恢复为默认组合键；仍检查与其他动作的冲突。
    pub fn reset_shortcut(id: String, cx: &mut ModuleCx) -> SettingsReply {
        let Some((_, text)) = DEFAULT_SHORTCUTS.iter().find(|(known, _)| *known == id) else {
            return Err(error("INVALID_CONFIG", "未知快捷键动作。")).into();
        };
        Self::set_shortcut(id, (*text).into(), cx)
    }

    /// 录入期间可临时绑定的全部组合；系统保留键除外。
    pub fn capture_keys(_cx: &mut ModuleCx) -> Vec<String> {
        capture_keys(os())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_and_document_roundtrip() {
        let settings = decode(None, Os::MacOs, true).unwrap();
        let json = encode(settings.clone()).unwrap();
        assert_eq!(decode(Some(&json), Os::MacOs, true).unwrap(), settings);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&json).unwrap()["schemaVersion"],
            1
        );
    }

    #[test]
    fn canonicalizes_platform_command_and_preserves_other_actions() {
        let original = AppSettings::default();
        let next = change_shortcut(
            original.clone(),
            "toggle-translate",
            "Command+Alt+K",
            Os::MacOs,
            true,
        )
        .unwrap();
        assert_eq!(next.shortcuts[0].keystroke, "alt+mod+k");
        assert_eq!(next.shortcuts[1..], original.shortcuts[1..]);
        let windows = change_shortcut(
            original,
            "toggle-translate",
            "CTRL+SHIFT+K",
            Os::Windows,
            false,
        )
        .unwrap();
        assert_eq!(windows.shortcuts[0].keystroke, "mod+shift+k");
    }

    #[test]
    fn rejects_invalid_reserved_unknown_and_duplicate_bindings() {
        for text in [
            "", "shift", "k", "shift+k", "mod++", "mod+q", "mod+h", "mod+m",
        ] {
            assert!(
                change_shortcut(
                    AppSettings::default(),
                    "toggle-translate",
                    text,
                    Os::MacOs,
                    true
                )
                .is_err(),
                "{text}"
            );
        }
        assert!(
            change_shortcut(AppSettings::default(), "unknown", "mod+k", Os::MacOs, true).is_err()
        );
        let conflict = change_shortcut(
            AppSettings::default(),
            "toggle-translate",
            "CMD+P",
            Os::MacOs,
            true,
        )
        .unwrap_err();
        assert_eq!(conflict.code, "SHORTCUT_CONFLICT");
        assert!(
            change_shortcut(
                AppSettings::default(),
                "toggle-translate",
                "alt+f4",
                Os::Windows,
                false
            )
            .is_err()
        );
        assert!(
            change_shortcut(
                AppSettings::default(),
                "toggle-translate",
                "f12",
                Os::MacOs,
                true
            )
            .is_ok()
        );
    }

    #[test]
    fn refuses_corruption_unknown_fields_and_versions() {
        for json in [
            "{",
            "null",
            r#"{"schemaVersion":2,"settings":{}}"#,
            r#"{"schemaVersion":1,"settings":{"shortcuts":[]}}"#,
        ] {
            assert!(decode(Some(json), Os::MacOs, true).is_err());
        }
        let mut value: serde_json::Value =
            serde_json::from_str(&encode(AppSettings::default()).unwrap()).unwrap();
        value["settings"]["secrets"] = serde_json::json!({"key": "not-allowed"});
        assert!(decode(Some(&value.to_string()), Os::MacOs, true).is_err());
        value["settings"].as_object_mut().unwrap().remove("secrets");
        value["settings"]["shortcuts"][1]["id"] = serde_json::json!("toggle-translate");
        assert!(decode(Some(&value.to_string()), Os::MacOs, true).is_err());
    }

    #[test]
    fn capture_table_is_unique_and_excludes_platform_reserved_and_navigation_keys() {
        for os in [Os::MacOs, Os::Windows, Os::Linux] {
            let keys = capture_keys(os);
            let unique: std::collections::HashSet<_> = keys.iter().collect();
            assert_eq!(unique.len(), keys.len());
            assert!(keys.contains(&"ctrl+alt+shift+cmd+f24".to_owned()));
            for text in &keys {
                assert!(!["escape", "tab", "shift+tab"].contains(&text.as_str()));
                assert!(Keystroke::parse(text, os).unwrap().reserved(os).is_none());
            }
        }
    }
}
