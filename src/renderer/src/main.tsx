import { createRoot } from "react-dom/client";

import "./styles.css";
import App from "./windows/main";
import { QuickApp } from "./windows/quick";

// 单 bundle 双窗口：主窗与翻译浮窗共用 index.html，hash 选根组件
const isQuick = window.location.hash.startsWith("#/quick");
createRoot(document.getElementById("root") as HTMLElement).render(
  isQuick ? <QuickApp /> : <App />
);
