import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

/** Oxelia51 品牌常量（所有事务邮件统一使用）。 */
export const OXELIA51_BRAND = {
  name: "Oxelia51",
  siteUrl: "https://oxelia51.com",
  /** 横版 logo（白字版，用于深色底；邮件头部为深色底，保证可辨认）。 */
  logoUrl: "https://oxelia51.com/icon-64-dark.png",
  feedbackEmail: "receive@oxelia51.com",
  colors: {
    night: "#0A0A0A",
    light: "#FAFAFA",
    accent: "#E5484D",
  },
} as const;

interface OxeliaEmailLayoutProps {
  /** 收件箱列表里的预览文案（不显示在正文中）。 */
  previewText: string;
  /** 邮件主标题。 */
  title: string;
  children: React.ReactNode;
}

/**
 * Oxelia51 事务邮件共享布局：
 * 深色头部（横版 logo）+ 浅色内容区 + 品牌页脚（目的声明 / 官网 / 反馈邮箱 / 备案号）。
 * 仅使用 react-email 的表格化组件与 Tailwind 编译出的内联样式，
 * 不使用 flex/grid 等老邮件客户端不支持的写法。
 */
export const OxeliaEmailLayout = ({
  previewText,
  title,
  children,
}: OxeliaEmailLayoutProps) => {
  return (
    <Html lang="zh-CN">
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-[#FAFAFA] font-sans">
          <Container className="mx-auto my-10 w-[465px] rounded border border-solid border-[#eaeaea] bg-white">
            <Section className="rounded-t bg-[#0A0A0A] px-5 py-4">
              <Img
                src={OXELIA51_BRAND.logoUrl}
                width="128"
                height="48"
                alt="Oxelia51"
                className="my-0"
              />
            </Section>
            <Section className="px-5 pt-2">
              <Heading className="mx-0 mb-0 mt-[24px] p-0 text-xl font-normal text-[#0A0A0A]">
                {title}
              </Heading>
              {children}
            </Section>
            <Section className="px-5 pb-5">
              <Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />
              <Text className="m-0 text-xs leading-5 text-[#666666]">
                这封邮件由 Oxelia51——Token 消耗统计平台发出。
              </Text>
              <Text className="m-0 mt-1 text-xs leading-5 text-[#666666]">
                官网：
                <Link
                  href={OXELIA51_BRAND.siteUrl}
                  className="text-[#0A0A0A] underline"
                >
                  oxelia51.com
                </Link>
                {"　·　"}反馈邮箱：
                <Link
                  href={`mailto:${OXELIA51_BRAND.feedbackEmail}`}
                  className="text-[#0A0A0A] underline"
                >
                  {OXELIA51_BRAND.feedbackEmail}
                </Link>
              </Text>
              <Text className="m-0 mt-1 text-xs leading-5 text-[#666666]">
                <Link
                  href="https://beian.miit.gov.cn/"
                  className="text-[#666666] underline"
                >
                  鲁ICP备2026038838号-1
                </Link>
                {" · "}
                <Link
                  href="https://beian.mps.gov.cn/#/query/webSearch?code=37028202001309"
                  className="text-[#666666] underline"
                >
                  鲁公网安备37028202001309号
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

interface OxeliaEmailCtaButtonProps {
  href: string;
  children: React.ReactNode;
}

/** 品牌 CTA 按钮：心跳红 #E5484D、白字、圆角，居中显示。 */
export const OxeliaEmailCtaButton = ({
  href,
  children,
}: OxeliaEmailCtaButtonProps) => {
  return (
    <Section className="mb-4 mt-8 text-center">
      <Button
        className="rounded bg-[#E5484D] px-5 py-3 text-center text-xs font-semibold text-white no-underline"
        href={href}
      >
        {children}
      </Button>
    </Section>
  );
};
