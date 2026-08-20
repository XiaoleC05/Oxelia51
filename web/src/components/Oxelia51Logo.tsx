import Link from "next/link";
import { VersionLabel } from "./VersionLabel";
import { env } from "@/src/env.mjs";

const Oxelia51Logotype = () => {
  return (
    <div className="flex items-center">
      {/* Oxelia51 品牌 logo「伴星」：月环 + 心跳星点，随主题切换深浅版 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="max-h-6 max-w-40 group-data-[collapsible=icon]:hidden dark:hidden"
        src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-64.png`}
        alt="Oxelia51 标志"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="hidden max-h-6 max-w-40 group-data-[collapsible=icon]:hidden dark:block"
        src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-64-dark.png`}
        alt="Oxelia51 标志"
      />
      <div className="hidden group-data-[collapsible=icon]:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="h-7 w-7 dark:hidden"
          src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-glyph-64.png`}
          alt="Oxelia51"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="hidden h-7 w-7 dark:block"
          src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-glyph-64-dark.png`}
          alt="Oxelia51"
        />
      </div>
    </div>
  );
};

export const Oxelia51Logo = ({ version = false }: { version?: boolean }) => {
  return (
    // Oxelia51：折叠态归零外边距，避免图标被挤压偏移/变形
    <div className="-mt-2 ml-1 flex flex-wrap gap-4 group-data-[collapsible=icon]:m-0 group-data-[collapsible=icon]:justify-center lg:flex-col lg:items-start">
      {/* Oxelia51 Logo */}
      <div className="flex items-center">
        <Link href="/" className="flex items-center">
          <Oxelia51Logotype />
        </Link>
        {version && (
          <VersionLabel className="ml-2 group-data-[collapsible=icon]:hidden" />
        )}
      </div>
    </div>
  );
};
