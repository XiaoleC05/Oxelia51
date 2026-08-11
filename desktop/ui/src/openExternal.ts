/**
 * 用系统浏览器打开外链（#29）。
 * Tauri 内走 opener 插件（动态 import，浏览器 dev 模式不回退崩溃）；
 * 非 Tauri 环境回退 window.open。
 */
export async function openExternal(url: string) {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
