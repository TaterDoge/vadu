import { resolve } from "node:path";

import solid from "@solidjs/vite-plugin";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [solid()],
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
      },
    },
  },
});
