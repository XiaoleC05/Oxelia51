import { render } from "@react-email/render";
import { createMailTransport } from "../transport";
import { logger } from "../../../logger";
import { AlertChannelVerificationEmailTemplate } from "./AlertChannelVerificationEmailTemplate";

type SendAlertChannelVerificationEmailParams = {
  env: Partial<
    Record<"EMAIL_FROM_ADDRESS" | "SMTP_CONNECTION_URL", string | undefined>
  >;
  /** 待验证的告警邮箱。 */
  to: string;
  /** 6 位数字验证码。 */
  code: string;
};

/** 向待验证的告警邮箱发送 6 位验证码。发送失败只记日志，不抛错。 */
export const sendAlertChannelVerificationEmail = async ({
  env,
  to,
  code,
}: SendAlertChannelVerificationEmailParams) => {
  if (!env.EMAIL_FROM_ADDRESS || !env.SMTP_CONNECTION_URL) {
    logger.error(
      "Missing environment variables for sending alert channel verification email.",
    );
    return;
  }

  try {
    const mailer = createMailTransport(env.SMTP_CONNECTION_URL);

    const htmlTemplate = await render(
      AlertChannelVerificationEmailTemplate({ code }),
    );

    await mailer.sendMail({
      to,
      from: `Oxelia51 <${env.EMAIL_FROM_ADDRESS}>`,
      subject: "Oxelia51 告警通道验证码",
      html: htmlTemplate,
    });
  } catch (error) {
    logger.error(error);
  }
};
