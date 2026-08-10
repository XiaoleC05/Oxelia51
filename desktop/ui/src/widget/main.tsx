import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import WidgetApp from "./WidgetApp";
import "../styles/global.css";
import "../styles/oxelia51-theme.css";
import "./widget.css";

// 悬浮卡片默认深色（Cosmos），启动后由 WidgetApp 读取本地设置里的主题覆盖
document.documentElement.dataset.theme = "cosmos";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WidgetApp />
  </StrictMode>
);
