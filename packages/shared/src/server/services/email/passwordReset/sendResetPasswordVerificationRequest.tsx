/*
 * To be used in the `sendVerificationRequest` function of the `email` provider of NextAuth.js.
 */

import { render } from "@react-email/render";
import { type SendVerificationRequestParams } from "next-auth/providers/email";
import { createMailTransport } from "../transport";
import { ResetPasswordTemplate } from "./ResetPasswordEmailTemplate";

export async function sendResetPasswordVerificationRequest(
  params: SendVerificationRequestParams,
) {
  const { identifier, token, provider, url } =
    params as SendVerificationRequestParams & { token: string };
  const transport = createMailTransport(provider.server as string);

  // Detect if this is a setup-password flow (signup email verification).
  // NextAuth URL-encodes callbackUrl inside the verification URL via
  // URLSearchParams, so /auth/setup-password appears as %2Fauth%2Fsetup-password.
  // decodeURIComponent recovers the literal path for substring matching.
  const isSetupMode = decodeURIComponent(url ?? "").includes(
    "/auth/setup-password",
  );

  const htmlTemplate = await render(
    ResetPasswordTemplate({ token, isSetupMode }),
  );

  const subject = isSetupMode
    ? "验证你的 Oxelia51 邮箱"
    : "重置你的 Oxelia51 密码";

  const textBody = isSetupMode
    ? `欢迎使用 Oxelia51。请使用以下验证码完成邮箱验证：${token}\n\n验证码 3 分钟内有效。如果这不是你的操作，请忽略本邮件。`
    : `请使用以下验证码重置你的 Oxelia51 密码：${token}\n\n验证码 3 分钟内有效。如果你没有请求重置密码，请忽略本邮件。`;

  const result = await transport.sendMail({
    to: identifier,
    from: provider.from,
    subject,
    text: textBody,
    html: htmlTemplate,
  });
  // nodemailer's SES transport omits `rejected`/`pending` from SentMessageInfo,
  // so guard against undefined before reading them.
  const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(
    Boolean,
  );
  if (failed.length) {
    throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
  }
}

export default ResetPasswordTemplate;
