import { resolve } from "node:path";

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

export default defineConfig({
  main: {},
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
