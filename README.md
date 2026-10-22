# vadu

桌面翻译软件。翻译能力全部由插件提供，首要支持 AI 翻译（自带 endpoint / 密钥 / 模型）。

## 文档

架构、插件规范、IPC 契约、路线图都在 [docs/](./docs/README.md)。改动前先按 [AGENTS.md](./AGENTS.md) 的查表读对应文档。

## 开发

```bash
bun install
bun run dev          # electron-vite dev
bun run typecheck    # 双 tsconfig 类型检查
bun run check        # Biome + ultracite
```

## 构建

```bash
bun run build:mac     # 或 build:win / build:linux
```

## IDE

VSCode + [Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) 扩展。
