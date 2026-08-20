import * as React from "react";
import { Text } from "@react-email/components";
import {
  OxeliaEmailCtaButton,
  OxeliaEmailLayout,
} from "../oxelia51/OxeliaEmailLayout";

interface MembershipInvitationTemplateProps {
  invitedByUsername: string;
  invitedByUserEmail: string;
  orgName: string;
  receiverEmail: string;
  inviteLink: string;
  userExists: boolean;
  emailFromAddress: string;
  langfuseCloudRegion?: string;
}

export const MembershipInvitationTemplate = ({
  invitedByUsername,
  invitedByUserEmail,
  orgName,
  receiverEmail,
  inviteLink,
  userExists,
  emailFromAddress,
}: MembershipInvitationTemplateProps) => {
  const previewText = `${invitedByUsername} 邀请你加入 Oxelia51 上的组织「${orgName}」`;

  return (
    <OxeliaEmailLayout
      previewText={previewText}
      title={`邀请你加入组织「${orgName}」`}
    >
      <Text className="text-sm leading-6 text-[#0A0A0A]">你好：</Text>
      <Text className="text-sm leading-6 text-[#0A0A0A]">
        <strong>{invitedByUsername}</strong>（{invitedByUserEmail}）邀请你加入
        Oxelia51 上的组织「<strong>{orgName}</strong>」。
      </Text>
      <Text className="text-sm leading-6 text-[#0A0A0A]">
        Oxelia51 是 Token 消耗统计平台：改一行环境变量，即可按项目统计模型调用的
        Token 消耗与费用，让 Token 消耗一目了然。
      </Text>
      {/* Note: inviteLink always refers to a root oxelia51 url and is not vulnerable to hyperlink injection attacks */}
      <OxeliaEmailCtaButton href={inviteLink}>接受邀请</OxeliaEmailCtaButton>
      <Text className="mt-2 text-center text-xs leading-4 text-[#666666]">
        {userExists
          ? "（使用你的现有账号登录即可接受邀请）"
          : "（你需要先使用该邮箱注册账号，再接受邀请）"}
      </Text>
      <Text className="text-sm leading-6 text-[#0A0A0A]">
        如果按钮无法点击，复制以下链接到浏览器打开：{" "}
        <span className="text-[#0A0A0A] underline">{inviteLink}</span>
      </Text>
      <Text className="mt-4 text-xs leading-5 text-[#666666]">
        本邀请发送给 {receiverEmail}，由 {emailFromAddress}{" "}
        发出。如果你没有预期收到这封邀请，可以忽略本邮件。
      </Text>
    </OxeliaEmailLayout>
  );
};
