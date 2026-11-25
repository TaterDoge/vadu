# vadu 开发指南

vadu 是用 NSH TSX 和 TypeScript 实现的桌面翻译应用。判断功能是否可用，先查当前工作树的实现和测试。旧 Electron 行为可查 `electron-final` 标签，迁移时保留业务契约，不复刻 IPC、preload 或 React renderer。功能进度与待验证项见[迁移记录](docs/nsh-migration.md)。

## 开发与验证

界面使用 TSX，业务与存储使用 TypeScript，平台能力使用 NSH 提供的 API。

在仓库根目录执行。`nsh --version` 可查 CLI 版本。Bun 安装 TSX 依赖并负责格式化，应用由 NSH 构建。

```sh
bun install                   # 首次构建前安装图标库和格式化依赖
bun fmt --check               # 检查格式，写回用 bun fmt
nsh run                       # 启动本机开发宿主
nsh check                     # 检查 TS/TSX 类型
nsh test                      # check 通过后运行单元与 headless 交互测试
nsh test "App.test.tsx"       # 只跑设置窗口交互用例
nsh package --target macos    # 默认输出到 .nsh/out/
```

- 代码改动先跑 `nsh check`，再跑 `nsh test`。非平凡逻辑补对应回归。NSH 交互测试在 `App.test.tsx` 和 `tests/`，用 `nsh/test`、`id:` / `label:` 定位，专用入口放 `tests/fixtures/`。
- 侧栏布局改动覆盖矮窗口滚动、缩放和键盘导航。测试 macOS 原生快捷键录入用 `nsh test "tests/Shortcuts.test.tsx" --target macos --foreground`，会占用前台焦点。真实托盘、跨应用热键、磁盘恢复和上游取消需要平台或发布构建验证。
- 根 `tsconfig.json` 继承 `.nsh/tsconfig.json`。首次检出缺少类型时先跑 `nsh check`。`.nsh/` 由工具生成，不手改、不提交。

## 按任务找入口

- **设置与托盘**　`App.tsx` 挂载 `src/windows/settings/SettingsWindow.tsx`。设置页放在 `src/windows/settings/pages/`。一级分类用 `nav.replace`，选中态取自路由栈。保留侧栏独立滚动。`src/tray.ts` 配合 `nsh.json` 实现主窗口关闭时隐藏、从托盘聚焦原窗口。
- **快捷键与翻译浮窗**　动作、作用域、注册和清理集中在 `src/feature/settings/shortcuts/runtime.ts`。录入期间暂停绑定，局内动作仅在浮窗聚焦时生效，全局动作显示实际注册结果。快捷键唤起或聚焦 `src/windows/translate/TranslateWindow.tsx` 的独立窗口；设置导航不添加翻译入口。
- **界面与主题**　优先使用 `components/ui/` 的 shadcn-nsh 组件和 `lib/ui/theme.ts` 的语义样式。用 `npx shadcn-nsh@0.10.0 add <组件名>` 按需添加，registry 版本取 `nsh-ui.json`。业务状态归页面，响应式使用 NSH 的 `signal`、`effect`、`cleanup`，条件和列表优先用 `<If>`、`<Each>`。界面图标通过 `lib/ui/icons.tsx` 渲染 `lucide` 图标，尺寸以点指定。保留可访问名称、shadcn-nsh 预设键盘焦点样式和原生拖拽。注释用中文说明原因。
- **服务商与翻译**　服务商编辑在 `src/windows/settings/pages/providers/`。`src/feature/settings/providers/` 管理 Profile、接口地址校验及与地址绑定的密钥。请求实现集中在 `src/api/`。`request.ts` 和 `stream.ts` 提供 JSON 与 SSE 接口，`models.ts` 和 `translation.ts` 实现 Chat Completions 业务请求，`translation-task.ts` 管理翻译生命周期。

## 配置、凭据与任务边界

- **配置写入**　UI 通过 `src/feature/settings/index.ts` 提交单项修改。`src/feature/settings/` 下的外观、快捷键、服务商模块各自维护结构、默认值和校验。`store.ts` 在同一 engine 内串行读取最新 `vadu.config`，组合各模块并统一提交。页面处理 `SettingsError` 和 Promise 拒绝。首次读取缺键时在同一队列内保存默认配置。开发阶段只维护当前结构。遇到坏 JSON、未知字段或非法值须保留原数据。修改结构时同步校验和测试。
- **用户数据**　NSH Storage 后台写盘，写入成功不能证明已 fsync。修改 `nsh.json` 的应用 ID 会切换数据目录。删除 Profile 或凭据、卸载伴随数据清理、恢复覆盖前，须让用户明确确认。旧配置、插件与备份的兼容性需单独验证。
- **密钥**　`src/feature/settings/providers/commands.ts` 通过 NSH `Storage` 将 API Key 明文存入本地 `storage.json` 的独立键 `vadu.secret.<profileId>`，并校验绑定的 Base URL。访问新地址前先确认。仅在用户主动查看时临时显示已保存的密钥，隐藏、切换服务商、保存或窗口失焦时清除显示值，新输入值提交后清空。普通配置和备份不得含密钥，不直接复制 `storage.json` 做备份。日志与崩溃报告不得含密钥、Authorization、原文、译文或上游响应正文。
- **翻译与插件**　请求使用用户明确选择的 Profile，厂商协议留在适配器内。按 `requestId` 路由增量结果，每个已受理请求只有一个终态。取消、隐藏、关窗或卸载要向 NSH `fetch` 传递中止信号并清理回调。平台代理和断连行为见[原生 API](docs/nsh/native-api.md)。第三方插件不得在 UI 中用 `eval` 或 `new Function` 执行；开放安装前须验证运行时隔离，新增权限须经宿主校验和用户确认。

## 文档维护

行为变更时同步更新对应契约，区分已实现、目标设计与待验证。窗口和信任边界见[架构](docs/nsh/architecture.md)，业务接口与取消见[平台 API](docs/nsh/native-api.md)，配置格式与恢复见[存储设计](docs/nsh/storage.md)，插件权限见[插件规范](docs/nsh/plugin-spec.md)。本文件只维护开发入口、命令和跨模块约束。

修改前核对调用方、测试及 fixture，保留工作树中已有改动。GitHub 操作用 `gh`，浏览器验证用 yab MCP。
