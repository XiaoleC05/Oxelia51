// 应用版本与更新检查。与 src-tauri/tauri.conf.json 的 version 保持一致。
export const APP_VERSION = "0.1.3";

export type UpdateInfo = {
  available: boolean;
  latest?: string;
  url?: string;
  error?: boolean;
};

// 检查 GitHub Releases 中是否有更新的语义化版本（v* 或纯数字）。
// Oxelia51 的自动 release（release-*）是 CI commit 噪声，不视为版本，故只认 v* 标签。
export async function checkForUpdate(): Promise<UpdateInfo> {
  try {
    const res = await fetch("https://api.github.com/repos/XiaoleC05/Oxelia51/releases?per_page=20");
    if (!res.ok) return { available: false, error: true };
    const releases = (await res.json()) as { tag_name: string; html_url: string }[];
    // 找语义化版本标签
    const versionTags = releases
      .map((r) => r.tag_name)
      .filter((t) => /^v?\d+\.\d+\.\d+$/.test(t));
    if (versionTags.length === 0) return { available: false };
    const latest = versionTags[0]; // API 按发布时间倒序
    if (isNewer(latest, APP_VERSION)) {
      const rel = releases.find((r) => r.tag_name === latest);
      return { available: true, latest, url: rel?.html_url };
    }
    return { available: false };
  } catch {
    return { available: false, error: true };
  }
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
