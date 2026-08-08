import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/oxelia51-theme.css";

// 桌面端默认深色（Cosmos），与品牌黑红一致；设置页/顶栏可切
document.documentElement.dataset.theme = "cosmos";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
