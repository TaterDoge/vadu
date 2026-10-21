import { render } from "@solidjs/web";

import App from "./app";
import "./assets/main.css";

render(() => <App />, document.getElementById("root") as HTMLElement);
