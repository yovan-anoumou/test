import { render } from "preact";
import "./styles/global.css";
import { App } from "./app.tsx";
import { registerServiceWorker } from "./pwa/register";

render(<App />, document.getElementById("app")!);
registerServiceWorker();
