import * as React from "react";
import { Heading, Section, Text } from "@react-email/components";
import { OxeliaEmailLayout } from "../oxelia51/OxeliaEmailLayout";

interface ResetPasswordTemplateProps {
  token: string;
  isSetupMode: boolean;
}

export const ResetPasswordTemplate = ({
  token,
  isSetupMode,
}: ResetPasswordTemplateProps) => {
  const title = isSetupMode
    ? "验证你的 Oxelia51 邮箱"
    : "重置你的 Oxelia51 密码";
  const previewText = isSetupMode
    ? "你的 Oxelia51 邮箱验证码"
    : "你的 Oxelia51 密码重置验证码";

  return (
    <OxeliaEmailLayout previewText={previewText} title={title}>
      <Text className="text-sm leading-6 text-[#0A0A0A]">
        {isSetupMode
          ? "欢迎使用 Oxelia51。请使用以下一次性验证码完成邮箱验证："
          : "我们收到了你的密码重置请求。请使用以下一次性验证码重置密码："}
      </Text>
      <Section className="mb-8 mt-4 text-center">
        <Heading className="m-0 text-3xl font-semibold text-[#0A0A0A]">
          {token}
        </Heading>
      </Section>
      <Text className="mb-4 text-center text-xs leading-6 text-[#666666]">
        验证码 3 分钟内有效。
        {isSetupMode
          ? "如果这不是你的操作，请忽略本邮件。"
          : "如果你没有请求重置密码，请忽略本邮件。"}
      </Text>
    </OxeliaEmailLayout>
  );
};
