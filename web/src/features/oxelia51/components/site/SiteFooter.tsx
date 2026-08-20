import Link from "next/link";
import { FilingInfo } from "@/src/components/FilingInfo";
import { FeedbackDialog } from "@/src/features/oxelia51/components/FeedbackDialog";
import { SiteLogo } from "./SiteLogo";

/**
 * Oxelia51 公开站点页脚（落地页 / 文档站共用）。
 * 与顶栏不重复：登录/注册/进入工作台均在顶栏覆盖，页脚只保留
 * 支持（反馈/Issues）+ 资源（文档/GitHub/许可证）。
 */
const GITHUB_URL = "https://github.com/XiaoleC05/Oxelia51";

export function SiteFooter() {
  const headingClass = "text-sm font-bold text-(--ox-text-h)";
  const linkClass =
    "text-sm text-(--ox-text-muted) transition-colors hover:text-(--ox-text-h)";

  return (
    <footer
      className="w-full border-t"
      style={{ borderColor: "var(--ox-border)" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          {/* 品牌 + 一句话 */}
          <div className="max-w-xs">
            <SiteLogo
              wordartClassName="h-4 sm:h-5"
              glyphClassName="h-7 sm:h-8"
            />
            <p className="mt-4 text-sm leading-6 text-(--ox-text-muted)">
              只需要改一行环境变量，所有 Token 消耗一目了然。本地部署，开源
              MIT。
            </p>
          </div>

          {/* 链接列：不与顶栏重复 */}
          <div className="grid grid-cols-2 gap-8">
            <div className="flex flex-col gap-3">
              <h4 className={headingClass}>支持</h4>
              {/* 意见反馈：站内表单，写入 oxelia51.feedback（管理后台可见），
                  不再用 mailto——邮件不进反馈库，会丢在邮箱里 */}
              <FeedbackDialog
                trigger={
                  // text-left：按钮默认居中、链接左对齐，会造成「支持栏没对齐」
                  <button type="button" className={`${linkClass} text-left`}>
                    用户反馈
                  </button>
                }
              />
              <a
                href={`${GITHUB_URL}/issues`}
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                GitHub Issues
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <h4 className={headingClass}>资源</h4>
              <Link href="/download" className={linkClass}>
                下载桌面版
              </Link>
              <Link href="/docs" className={linkClass}>
                使用文档
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                GitHub
              </a>
              <a
                href="https://github.com/XiaoleC05/Oxelia51/blob/master/LICENSE"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                MIT 许可证
              </a>
            </div>
          </div>
        </div>

        {/* 备案 */}
        <div
          className="mt-12 border-t pt-6"
          style={{ borderColor: "var(--ox-border)" }}
        >
          <FilingInfo variant="compact" />
        </div>
      </div>
    </footer>
  );
}
