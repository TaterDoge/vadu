# vadu 文档

本目录只维护当前 NSH 项目需要的范围与设计，不保留 Electron 文档副本。**当前仅实现设置分类导航**；原生业务 API 与插件运行时均为目标设计，不能当作现成 API 使用。

## 从这里开始

| 要做的事 | 阅读 |
| --- | --- |
| 查看运行命令与工程入口 | [项目 README](../README.md) |
| 查看已完成内容、导航边界与下一步验证 | [迁移范围与进度](./nsh-migration.md) |
| 理解窗口、运行时、核心分层、数据与信任边界 | [NSH 架构](./nsh/architecture.md) |
| 设计 UI ↔ Rust 调用、任务流、取消或错误 | [原生 API 与任务契约](./nsh/native-api.md) |
| 写插件、接入 AI 服务商、修改配置 schema 或权限 | [NSH 插件规范](./nsh/plugin-spec.md) |

## 文档分工

- `nsh-migration.md` 只维护状态、范围与验证顺序，不复制接口。
- `nsh/architecture.md` 维护职责、运行时与数据边界。
- `nsh/native-api.md` 是原生业务调用、错误码与任务生命周期的唯一设计来源。
- `nsh/plugin-spec.md` 是插件运行契约、权限与 AI 协议组织的唯一设计来源。

文档区分“已实现”“目标设计”和“待验证”。行为变更与文档同次更新；没有通过 NSH 类型生成与发布构建验证的草案，不能写成已可用 SDK。

## 历史资料

旧 Electron 的 IPC、架构、插件、AI 与里程碑文档已从本分支移除，必要业务原则并入上述 NSH 文档。不再使用旧目录、Electron API、Bun 脚本或旧路线图指导本分支开发。

需要查历史时，查看 `main` 或 [`electron-final`](https://github.com/TaterDoge/vadu/tree/electron-final)；不承诺旧插件、备份或配置数据自动兼容。
