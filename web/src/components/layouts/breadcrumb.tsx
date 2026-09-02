import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/src/components/ui/breadcrumb";
import { Fragment } from "react";
import { Slash } from "lucide-react";
import Link from "next/link";

// Oxelia51：组织/项目切换面包屑已随组织/项目模块一并删除，
// 面包屑仅保留页面级 items（各页面自行传入）。
const BreadcrumbComponent = ({
  items,
  className,
}: {
  items?: { name: string; href?: string }[];
  className?: string;
}) => {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {items?.map((item, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <BreadcrumbSeparator>
                <Slash />
              </BreadcrumbSeparator>
            )}
            <BreadcrumbItem key={index}>
              {item.href ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.name}</Link>
                </BreadcrumbLink>
              ) : (
                <span>{item.name}</span>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default BreadcrumbComponent;
