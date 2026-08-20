import { render } from "@react-email/render";
import { createMailTransport } from "../transport";
import { logger } from "../../../logger";
import { OXELIA51_BRAND } from "../oxelia51/OxeliaEmailLayout";
import { FeedbackNotificationEmailTemplate } from "./FeedbackNotificationEmailTemplate";

type SendFeedbackNotificationEmailParams = {
  env: Partial<
    Record<"EMAIL_FROM_ADDRESS" | "SMTP_CONNECTION_URL", string | undefined>
  >;
  /** 反馈分类（如「功能建议」「问题反馈」）。 */
  category: string;
  /** 提交反馈的用户邮箱（同时作为 replyTo，方便直接回复）。 */
  userEmail: string;
  /** 反馈正文。 */
  content: string;
  /** 提交时间。 */
  submittedAt: Date;
  /** 收件地址，默认 receive@oxelia51.com。 */
  to?: string;
};

/** 把用户反馈通知发往 Oxelia51 反馈邮箱。 */
export const sendFeedbackNotificationEmail = async ({
  env,
  category,
  userEmail,
  content,
  submittedAt,
  to,
}: SendFeedbackNotificationEmailParams) => {
  if (!env.EMAIL_FROM_ADDRESS || !env.SMTP_CONNECTION_URL) {
    logger.error(
      "Missing environment variables for sending feedback notification email.",
    );
    return;
  }

  try {
    const mailer = createMailTransport(env.SMTP_CONNECTION_URL);

    const htmlTemplate = await render(
      FeedbackNotificationEmailTemplate({
        category,
        userEmail,
        content,
        submittedAt,
      }),
    );

    await mailer.sendMail({
      to: to ?? OXELIA51_BRAND.feedbackEmail,
      from: `Oxelia51 <${env.EMAIL_FROM_ADDRESS}>`,
      replyTo: userEmail,
      subject: `[Oxelia51 反馈] ${category}`,
      html: htmlTemplate,
    });
  } catch (error) {
    logger.error(error);
  }
};
