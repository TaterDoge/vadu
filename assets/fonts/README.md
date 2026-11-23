# UI 字体

从 Google Fonts 的字体目录原样分发，遵循各目录的 SIL Open Font License 1.1（`OFL.txt`）。仅包含界面使用的直立可变字重，不加载网络字体。

| 文件                               | 来源                                                        | Git blob SHA                               |
| ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| `geist-mono/GeistMono.ttf`         | https://github.com/google/fonts/tree/main/ofl/geistmono     | `173867dce0580ea751e4b9c558740d34f20ce549` |
| `jetbrains-mono/JetBrainsMono.ttf` | https://github.com/google/fonts/tree/main/ofl/jetbrainsmono | `aa310be8b717fe3774f9444dd89d5f4101cc6d10` |

`src/theme.ts` 使用导入值注册字体并读取真实 family name。中文等缺失字形由平台回退；快捷键符号单独使用系统 Lucida Grande。
