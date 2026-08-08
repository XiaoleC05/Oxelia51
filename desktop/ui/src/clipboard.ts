// 剪贴板复制（Tauri webview 优先原生 clipboard API，失败退回 execCommand）。

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 本地 sidecar 代理地址与一键配置命令（复制给模型工具用）。 */
export const PROXY_BASE = "http://127.0.0.1:17800";
export const PROXY_CMD = `export ANTHROPIC_BASE_URL="${PROXY_BASE}"
export OPENAI_BASE_URL="${PROXY_BASE}"`;
