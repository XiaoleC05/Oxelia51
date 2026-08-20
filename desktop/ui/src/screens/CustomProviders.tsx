import { useState } from "react";
import {
  deleteCustomProvider,
  upsertCustomProvider,
  type CustomProvider,
} from "../api";
import {
  copyText,
  PROVIDER_COMMANDS,
  providerCmd,
  proxyUrl,
} from "../clipboard";
import { EmptyState } from "../EmptyState";
import { Dropdown } from "../components/Dropdown";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BASE_URL_RE = /^https:\/\/.+/;

/** 与后端同口径的基础校验；返回错误文案，null 表示通过。 */
function validate(
  form: { name: string; slug: string; baseUrl: string },
  existing: CustomProvider[],
): string | null {
  if (!form.name.trim()) return "请填写供应商名称";
  if (!form.slug) return "请填写 slug";
  if (!SLUG_RE.test(form.slug))
    return "slug 只能用小写字母、数字和连字符（如 my-api）";
  if (PROVIDER_COMMANDS.some((p) => p.slug === form.slug))
    return "slug 与内置供应商冲突，请换一个";
  if (existing.some((p) => p.slug === form.slug))
    return "slug 与已有自定义供应商重复";
  if (!BASE_URL_RE.test(form.baseUrl.trim()))
    return "API 地址无效（填域名即可，如 api.example.com；自动补全 https://）";
  return null;
}

/**
 * 自定义供应商管理：预设目录之外的平台，按官方 API 文档自行添加。
 * 添加后由本地代理挂载到 /api/proxy/<slug>，复制地址 / 接入命令与预设一致。
 * items 为空（含旧二进制接口不可用降级）时显示空态。
 */
export function CustomProviders({
  items,
  onChanged,
}: {
  items: CustomProvider[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [protocol, setProtocol] = useState<"openai" | "anthropic">("openai");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okNote, setOkNote] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  // 删除二次确认：先点「删除」进入确认态，再点「确认删除」才执行
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setSlug("");
    setBaseUrl("");
    setProtocol("openai");
    setError("");
  };

  const flashOk = (label: string) => {
    setOkNote(label);
    setTimeout(() => setOkNote(""), 2000);
  };

  const submit = async () => {
    // 用户只需填 https:// 之后的部分，自动补全协议；已含协议（如本地 http:// 网关）则原样保留
    const rawUrl = baseUrl.trim();
    const fullUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const form = { name: name.trim(), slug: slug.trim(), baseUrl: fullUrl };
    const msg = validate(form, items);
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await upsertCustomProvider({ ...form, protocol });
      resetForm();
      setShowForm(false);
      flashOk(`已添加，代理地址 ${proxyUrl(form.slug)}`);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (p: CustomProvider) => {
    if (await copyText(proxyUrl(p.slug))) {
      setCopied(p.slug);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  const remove = async (p: CustomProvider) => {
    if (confirmSlug !== p.slug) {
      setConfirmSlug(p.slug);
      setTimeout(() => setConfirmSlug((s) => (s === p.slug ? null : s)), 3000);
      return;
    }
    setConfirmSlug(null);
    setError("");
    try {
      await deleteCustomProvider(p.slug);
      flashOk(`已删除 ${p.name}`);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">自定义供应商</h2>
      {error && <p className="empty">错误：{error}</p>}
      {okNote && <p className="ok-note">{okNote}</p>}

      {items.length === 0 && !showForm ? (
        <EmptyState
          compact
          title="还没有自定义供应商"
          desc="预设目录里没有的平台，可以按官方 API 文档自行添加"
          action={{
            label: "添加自定义供应商",
            onClick: () => setShowForm(true),
          }}
        />
      ) : (
        <div className="card-list">
          {items.map((p) => (
            <div key={p.slug} className="list-row">
              <div className="list-main">
                <span className="list-title">
                  {p.name}
                  <span className="dim-tag">
                    {p.protocol === "anthropic" ? "Anthropic" : "OpenAI 兼容"}
                  </span>
                </span>
                <span className="list-sub">
                  <code>{p.slug}</code> · {p.baseUrl}
                </span>
                <span className="list-sub">
                  接入命令：
                  <code>{providerCmd(p.slug, p.protocol === "anthropic")}</code>
                </span>
              </div>
              <div className="form-row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void copy(p)}
                  title={`复制 ${proxyUrl(p.slug)}`}
                >
                  {copied === p.slug ? "已复制 ✓" : "复制地址"}
                </button>
                <button
                  type="button"
                  className={`link-btn danger`}
                  onClick={() => void remove(p)}
                  title={
                    confirmSlug === p.slug
                      ? "再次点击确认删除"
                      : "删除该自定义供应商"
                  }
                >
                  {confirmSlug === p.slug ? "确认删除？" : "删除"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <>
          <div className="form-row">
            <input
              className="input grow"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名称（如 我的网关）"
              aria-label="供应商名称"
            />
            <input
              className="input grow"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="slug（小写字母/数字/连字符，如 my-api）"
              aria-label="slug"
            />
          </div>
          <div className="form-row">
            <input
              className="input grow"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="api.example.com（自动补全 https://）"
              aria-label="API 地址"
            />
            <Dropdown
              value={protocol}
              options={[
                { value: "openai", label: "OpenAI 兼容" },
                { value: "anthropic", label: "Anthropic" },
              ]}
              onChange={(v) => setProtocol(v as "openai" | "anthropic")}
              ariaLabel="协议"
            />
          </div>
          <div className="form-row">
            <button
              type="button"
              className="btn primary"
              onClick={() => void submit()}
              disabled={saving}
            >
              {saving ? "保存中…" : "保存"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              取消
            </button>
          </div>
        </>
      ) : (
        items.length > 0 && (
          <div className="form-row">
            <button
              type="button"
              className="btn"
              onClick={() => setShowForm(true)}
            >
              + 添加自定义供应商
            </button>
          </div>
        )
      )}
    </div>
  );
}
