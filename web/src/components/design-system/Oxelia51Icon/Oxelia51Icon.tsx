import { env } from "@/src/env.mjs";

type Oxelia51IconProps = {
  size?: 14 | 16 | 28 | 32 | 42;
};

/** Oxelia51「伴星」glyph：月环 + 心跳星点，随主题切换深浅版 */
export const Oxelia51Icon = ({ size = 32 }: Oxelia51IconProps) => (
  <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-glyph-64.png`}
      width={size}
      height={size}
      alt="Oxelia51"
      className="dark:hidden"
    />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-glyph-64-dark.png`}
      width={size}
      height={size}
      alt="Oxelia51"
      className="hidden dark:block"
    />
  </>
);
