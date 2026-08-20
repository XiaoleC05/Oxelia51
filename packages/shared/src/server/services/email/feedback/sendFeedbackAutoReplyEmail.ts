import { render } from "@react-email/render";
import { createMailTransport } from "../transport";
import { logger } from "../../../logger";
import { FeedbackAutoReplyEmailTemplate } from "./FeedbackAutoReplyEmailTemplate";

type SendFeedbackAutoReplyEmailParams = {
  env: Partial<
    Record<"EMAIL_FROM_ADDRESS" | "SMTP_CONNECTION_URL", string | undefined>
  >;
  /** 提交反馈的用户邮箱。 */
  to: string;
};

/** 向提交反馈的用户发送自动回复（已收悉 + 预计回复时限）。 */
export const sendFeedbackAutoReplyEmail = async ({
  env,
  to,
}: SendFeedbackAutoReplyEmailParams) => {
  if (!env.EMAIL_FROM_ADDRESS || !env.SMTP_CONNECTION_URL) {
    logger.error(
      "Missing environment variables for sending feedback auto-reply email.",
    );
    return;
  }

  try {
    const mailer = createMailTransport(env.SMTP_CONNECTION_URL);

    const htmlTemplate = await render(FeedbackAutoReplyEmailTemplate());

    await mailer.sendMail({
      to,
      from: `Oxelia51 <${env.EMAIL_FROM_ADDRESS}>`,
      subject: "我们已收到你的反馈 — Oxelia51",
      html: htmlTemplate,
    });
  } catch (error) {
    logger.error(error);
  }
};
