import * as React from "react";
import { Text } from "@react-email/components";
import { OxeliaEmailLayout } from "../oxelia51/OxeliaEmailLayout";

/** 用户反馈自动回复邮件（发往提交反馈的用户）。 */
export const FeedbackAutoReplyEmailTemplate = () => {
  return (
    <OxeliaEmailLayout
      previewText="我们已收到你的反馈"
      title="我们已收到你的反馈"
    >
      <Text className="text-sm leading-6 text-[#0A0A0A]">你好：</Text>
      <Text className="text-sm leading-6 text-[#0A0A0A]">
        感谢你对 Oxelia51 的反馈。我们已收到你提交的内容，会在 1-3
        个工作日内通过邮件回复你，请留意查收。
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
