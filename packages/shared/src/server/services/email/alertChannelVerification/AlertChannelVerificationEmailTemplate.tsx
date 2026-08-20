import * as React from "react";
import { Text } from "@react-email/components";
import { OxeliaEmailLayout } from "../oxelia51/OxeliaEmailLayout";

interface AlertChannelVerificationEmailTemplateProps {
  /** 6 位数字验证码。 */
  code: string;
}

/** 告警邮件通道验证码（发往用户待验证的告警邮箱）。 */
export const AlertChannelVerificationEmailTemplate = ({
  code,
}: AlertChannelVerificationEmailTemplateProps) => {
  return (
    <OxeliaEmailLayout
      previewText={`你的验证码：${code}（10 分钟内有效）`}
      title="验证你的告警邮箱"
    >
      <Text className="text-sm leading-6 text-[#0A0A0A]">
        你正在 Oxelia51 告警设置中添加此邮箱为告警通道。请在页面中输入以下 6
        位验证码完成验证：
      </Text>
      <Text className="my-6 text-center font-mono text-3xl font-semibold tracking-[0.4em] text-[#0A0A0A]">
        {code}
      </Text>
      <Text className="text-sm leading-6 text-[#0A0A0A]">
        验证码 10 分钟内有效。验证通过后，该邮箱才会接收告警邮件。
      </Text>
      <Text className="mb-4 text-sm leading-6 text-[#666666]">
        如果这不是你的操作，请忽略本邮件。
      </Text>
    </OxeliaEmailLayout>
  );
};
