import type { Component } from "solid-js";

import electronLogo from "./assets/electron.svg";
import Versions from "./components/versions";

const App: Component = () => {
  const ipcHandle = (): void => window.electron.ipcRenderer.send("ping");

  return (
    <>
      <img
        alt="logo"
        class="logo"
        height={128}
        src={electronLogo}
        width={128}
      />
      <div class="creator">Powered by electron-vite</div>
      <div class="text">
        Build an Electron app with <span class="solid">Solid</span>
        &nbsp;and <span class="ts">TypeScript</span>
      </div>
      <p class="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>
      <div class="actions">
        <div class="action">
          <a href="https://electron-vite.org/" rel="noreferrer" target="_blank">
            Documentation
          </a>
        </div>
        <div class="action">
          <button class="ipc" onClick={ipcHandle} type="button">
            Send IPC
          </button>
        </div>
      </div>
      <Versions />
    </>
  );
};

export default App;
