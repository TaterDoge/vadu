import type { JSX } from "react";

import electronLogo from "./assets/electron.svg";
import { Button } from "./components/ui/button";
import Versions from "./components/versions";

const btn =
  "inline-block rounded-[20px] border border-transparent bg-[#32363f] px-5 text-sm font-semibold leading-[38px] whitespace-nowrap text-neutral-200 hover:bg-[#414853]";

function App(): JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send("ping");

  return (
    <main className="flex h-screen select-none flex-col items-center justify-center bg-[#1b1b1f] pb-20 text-neutral-200">
      <Button>这是一个按钮</Button>
      <img
        alt="logo"
        className="mb-5 size-32"
        height={128}
        src={electronLogo}
        width={128}
      />
      <div className="mb-2.5 font-semibold text-neutral-400 text-sm leading-4">
        Powered by electron-vite
      </div>
      <div className="mx-2.5 py-4 text-center font-bold text-3xl leading-8">
        Build an Electron app with{" "}
        <span className="bg-linear-to-br from-[#4e86c5] to-[#f1f1f3] bg-clip-text text-transparent">
          React
        </span>
        {" and "}
        <span className="bg-linear-to-br from-[#3178c6] to-[#f0dc4e] bg-clip-text text-transparent">
          TypeScript
        </span>
      </div>
      <p className="font-semibold text-base text-neutral-400 leading-6">
        Please try pressing{" "}
        <code className="rounded-sm bg-[#282828] px-1.5 py-1 font-mono font-semibold text-[85%]">
          F12
        </code>{" "}
        to open the devTool
      </p>
      <div className="-m-1.5 flex flex-wrap justify-start pt-8">
        <div className="shrink-0 p-1.5">
          <a
            className={btn}
            href="https://electron-vite.org/"
            rel="noreferrer"
            target="_blank"
          >
            Documentation
          </a>
        </div>
        <div className="shrink-0 p-1.5">
          <button className={btn} onClick={ipcHandle} type="button">
            Send IPC
          </button>
        </div>
      </div>
      <Versions />
    </main>
  );
}

export default App;
