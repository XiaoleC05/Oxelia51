// 应用版本与更新检查。与 src-tauri/tauri.conf.json 的 version 保持一致。
export const APP_VERSION = "0.1.9";

export type UpdateInfo = {
  available: boolean;
  latest?: string;
  url?: string;
  error?: boolean;
};

// 检查 GitHub Releases 中是否有更新的语义化版本（v* 或纯数字）。
// Oxelia51 的自动 release（release-*）是 CI commit 噪声，不视为版本，故只认 v* 标签。
// 失败（含 api.github.com 匿名限流 403）一律静默返回 error 标记，不打 console.error：
// 检查更新是锦上添花，失败不该打扰用户；有更新横幅逻辑不受影响（仅 available=true 时展示）。
// 注：浏览器会对非 2xx 资源请求自动生成网络日志条目，JS 侧无法抑制，属预期噪音。
export async function checkForUpdate(): Promise<UpdateInfo> {
  try {
    const res = await fetch("https://api.github.com/repos/XiaoleC05/Oxelia51/releases?per_page=20");
    if (!res.ok) return { available: false, error: true };
    const releases = (await res.json()) as {
      tag_name: string;
      html_url: string;
      assets: { name: string; browser_download_url: string }[];
    }[];
    // 找语义化版本标签
    const versionTags = releases
      .map((r) => r.tag_name)
      .filter((t) => /^v?\d+\.\d+\.\d+$/.test(t));
    if (versionTags.length === 0) return { available: false };
    const latest = versionTags[0]; // API 按发布时间倒序
    if (isNewer(latest, APP_VERSION)) {
      const rel = releases.find((r) => r.tag_name === latest);
      // url 优先指向当前平台安装包直链（点击即下载），取不到则回退 release 页
      const assetUrl = pickAsset(rel?.assets ?? []);
      return { available: true, latest, url: assetUrl ?? rel?.html_url };
    }
    return { available: false };
  } catch {
    return { available: false, error: true };
  }
}

// 按当前平台选对应安装包：Windows → .exe，macOS → .dmg，Linux → .AppImage（回退 .deb）。
function pickAsset(assets: { name: string; browser_download_url: string }[]): string | undefined {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
  const isMac = /mac|darwin/.test(ua);
  const isLinux = /linux/.test(ua);
  const want = isMac ? ".dmg" : isLinux ? ".appimage" : ".exe";
  const hit = assets.find((a) => a.name.toLowerCase().endsWith(want));
  if (hit) return hit.browser_download_url;
  if (isLinux) {
    const deb = assets.find((a) => a.name.toLowerCase().endsWith(".deb"));
    if (deb) return deb.browser_download_url;
  }
  return undefined;
}

function isNewer(tag: string, current: string): boolean {
  const a = tag.replace(/^v/, "").split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}
