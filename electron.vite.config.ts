import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import type { Plugin } from "vite";

// React Fast Refresh 在 dev 注入内联 preamble script，严格 CSP 会把它拦掉导致白屏
// 仅 dev 放宽，生产构建的 CSP 保持不变
const devCspUnsafeInlineScripts: Plugin = {
  apply: "serve",
  name: "dev-csp-unsafe-inline-scripts",
  transformIndexHtml: (html) =>
    html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"),
};

// 内置插件必须保持独立模块，被打进主 bundle 就无法被动态 import()
// 遍历 src/main/plugins/*/manifest.json 各自复制，避免新增插件时改这份构建配置
const copyPluginManifests: Plugin = {
  name: "copy-plugin-manifests",
  writeBundle() {
    const srcRoot = resolve("src/main/plugins");
    const outRoot = resolve("out/main/plugins");
    for (const name of readdirSync(srcRoot)) {
      const dir = join(srcRoot, name);
      if (!statSync(dir).isDirectory()) {
        continue;
      }
      const manifest = join(dir, "manifest.json");
      if (!existsSync(manifest)) {
        continue;
      }
      const target = join(outRoot, name, "manifest.json");
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(manifest, target);
    }
  },
};

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/main/index.ts"),
          "plugins/ai/index": resolve("src/main/plugins/ai/index.ts"),
          "plugins/ocr/index": resolve("src/main/plugins/ocr/index.ts"),
          "plugins/tts/index": resolve("src/main/plugins/tts/index.ts"),
        },
        output: {
          entryFileNames: "[name].js",
        },
      },
    },
    plugins: [copyPluginManifests],
  },
  preload: {},
  renderer: {
    plugins: [react(), tailwindcss(), devCspUnsafeInlineScripts],
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@shared": resolve("src/shared"),
      },
    },
  },
});
