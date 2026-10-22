import type { JSX } from "react";

function Versions(): JSX.Element {
  const { versions } = window.electron.process;

  return (
    <ul className="absolute bottom-[30px] flex items-center overflow-hidden rounded-[22px] bg-[#202127] font-mono backdrop-blur-xl">
      <li className="border-[#515c67] border-r px-5 text-sm leading-none opacity-80 last:border-none">
        Electron v{versions.electron}
      </li>
      <li className="border-[#515c67] border-r px-5 text-sm leading-none opacity-80 last:border-none">
        Chromium v{versions.chrome}
      </li>
      <li className="border-[#515c67] border-r px-5 text-sm leading-none opacity-80 last:border-none">
        Node v{versions.node}
      </li>
    </ul>
  );
}

export default Versions;
