import { render } from "@react-email/render";
import { createMailTransport } from "../transport";
import { logger } from "../../../logger";
import { FeedbackReplyEmailTemplate } from "./FeedbackReplyEmailTemplate";

type SendFeedbackReplyEmailParams = {
  env: Partial<
    Record<"EMAIL_FROM_ADDRESS" | "SMTP_CONNECTION_URL", string | undefined>
  >;
  /** 提交反馈的用户邮箱。 */
  to: string;
  /** 管理员回复正文。 */
  replyMessage: string;
  /** 用户原反馈内容（邮件中引用摘要）。 */
  feedbackMessage: string;
};

/** 向提交反馈的用户发送管理员回复（回复正文 + 原反馈摘要引用）。 */
export const sendFeedbackReplyEmail = async ({
  env,
  to,
  replyMessage,
  feedbackMessage,
}: SendFeedbackReplyEmailParams) => {
  if (!env.EMAIL_FROM_ADDRESS || !env.SMTP_CONNECTION_URL) {
    logger.error(
      "Missing environment variables for sending feedback reply email.",
    );
    return;
  }

  try {
    const mailer = createMailTransport(env.SMTP_CONNECTION_URL);

    const htmlTemplate = await render(
      FeedbackReplyEmailTemplate({ replyMessage, feedbackMessage }),
    );

    await mailer.sendMail({
      to,
      from: `Oxelia51 <${env.EMAIL_FROM_ADDRESS}>`,
      subject: "关于你的反馈 — Oxelia51",
      html: htmlTemplate,
    });
  } catch (error) {
    logger.error(error);
  }
};
