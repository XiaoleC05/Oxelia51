import * as React from "react";
import { Text } from "@react-email/components";
import { OxeliaEmailLayout } from "../oxelia51/OxeliaEmailLayout";

/** 引用块内展示的原反馈最大长度（超出截断为摘要）。 */
const QUOTE_MAX_LEN = 300;

interface FeedbackReplyEmailTemplateProps {
  /** 管理员回复正文（按换行拆段展示）。 */
  replyMessage: string;
  /** 用户原反馈内容（模板内截断为摘要引用）。 */
  feedbackMessage: string;
}

/** 管理员对用户反馈的回复邮件（发往提交反馈的用户）。 */
export const FeedbackReplyEmailTemplate = ({
  replyMessage,
  feedbackMessage,
}: FeedbackReplyEmailTemplateProps) => {
  const quote =
    feedbackMessage.length > QUOTE_MAX_LEN
      ? `${feedbackMessage.slice(0, QUOTE_MAX_LEN)}…`
      : feedbackMessage;
  const paragraphs = replyMessage
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <OxeliaEmailLayout previewText="关于你的反馈" title="关于你的反馈">
      <Text className="text-sm leading-6 text-[#0A0A0A]">你好：</Text>
      <Text className="text-sm leading-6 text-[#0A0A0A]">
        你此前提交的反馈已有回复：
      </Text>
      {paragraphs.map((p, i) => (
        <Text key={i} className="text-sm leading-6 text-[#0A0A0A]">
          {p}
        </Text>
      ))}
      <Text
        className="my-4 border-l-2 border-solid border-[#eaeaea] pl-3 text-xs leading-5 text-[#666666]"
        style={{ whiteSpace: "pre-wrap" }}
      >
        {quote}
      </Text>
      <Text className="text-sm leading-6 text-[#0A0A0A]">
        如果还有其他问题，欢迎随时回复本邮件补充说明。
      </Text>
      <Text className="mb-4 mt-6 text-sm leading-6 text-[#0A0A0A]">
        Oxelia51 团队
      </Text>
    </OxeliaEmailLayout>
  );
};
