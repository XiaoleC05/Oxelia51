import * as React from "react";
import { Link, Section, Text } from "@react-email/components";
import { OxeliaEmailLayout } from "../oxelia51/OxeliaEmailLayout";

interface FeedbackNotificationEmailTemplateProps {
  /** 反馈分类（如「功能建议」「问题反馈」）。 */
  category: string;
  /** 提交反馈的用户邮箱。 */
  userEmail: string;
  /** 反馈正文。 */
  content: string;
  /** 提交时间（按北京时间展示）。 */
  submittedAt: Date;
}

const formatSubmittedAt = (submittedAt: Date) =>
  submittedAt.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });

/** 用户反馈通知邮件（发往 receive@oxelia51.com）。 */
export const FeedbackNotificationEmailTemplate = ({
  category,
  userEmail,
  content,
  submittedAt,
}: FeedbackNotificationEmailTemplateProps) => {
  return (
    <OxeliaEmailLayout
      previewText={`新的用户反馈：${category}`}
      title="收到新的用户反馈"
    >
      <Text className="mb-1 text-sm leading-6 text-[#0A0A0A]">
        <strong>分类：</strong>
        {category}
      </Text>
      <Text className="mb-1 mt-0 text-sm leading-6 text-[#0A0A0A]">
        <strong>用户邮箱：</strong>
        <Link href={`mailto:${userEmail}`} className="text-[#0A0A0A] underline">
          {userEmail}
        </Link>
      </Text>
      <Text className="mb-1 mt-0 text-sm leading-6 text-[#0A0A0A]">
        <strong>提交时间：</strong>
        {formatSubmittedAt(submittedAt)}（北京时间）
      </Text>
      <Text className="mb-1 mt-4 text-sm leading-6 text-[#0A0A0A]">
        <strong>内容：</strong>
      </Text>
      <Section className="rounded border border-solid border-[#eaeaea] bg-[#FAFAFA] px-3 py-1">
        <Text className="whitespace-pre-wrap text-sm leading-6 text-[#0A0A0A]">
          {content}
        </Text>
      </Section>
    </OxeliaEmailLayout>
  );
};
