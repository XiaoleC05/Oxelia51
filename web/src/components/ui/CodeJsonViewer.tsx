import { useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  FoldVertical,
  UnfoldVertical,
} from "lucide-react";
import { cn } from "@/src/utils/tailwind";
import { default as React18JsonView } from "react18-json-view";
import "react18-json-view/src/dark.css";
import { deepParseJson } from "@oxelia51/shared";
import { decodeUnicodeInJson } from "@/src/utils/decodeUnicodeInJson";
import { Skeleton } from "@/src/components/ui/skeleton";
import { useTheme } from "next-themes";
import {
  renderRichPromptContent,
  usePromptReferenceProjectId,
} from "@/src/components/ui/PromptReferences";
import { copyTextToClipboard } from "@/src/utils/clipboard";
import { useCopyToClipboard } from "@/src/hooks/useCopyToClipboard";

export const IO_TABLE_CHAR_LIMIT = 10000;

type JsonViewHeaderProps = {
  title: string | React.ReactNode;
  handleOnCopy: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  controlButtons?: React.ReactNode;
};

/** 标题栏：标题 + 复制按钮 + 额外控制按钮（原 MarkdownJsonViewHeader，去掉已删的 markdown 切换） */
function JsonViewHeader({
  title,
  handleOnCopy,
  controlButtons,
}: JsonViewHeaderProps) {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <div className="io-message-header group-hover:bg-muted/80 flex flex-row items-center justify-between px-1 py-1 text-sm font-bold capitalize transition-colors">
      <div className="flex items-center gap-2">{title}</div>
      <div className="mr-1 flex min-w-0 shrink flex-row items-center gap-1">
        {controlButtons}
        <Button
          title="复制到剪贴板"
          variant="ghost"
          size="icon-xs"
          type="button"
          onClick={(event) => {
            setIsCopied(true);
            handleOnCopy(event);
            setTimeout(() => setIsCopied(false), 1000);
          }}
          className="hover:bg-border -mr-2"
        >
          {isCopied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function JSONView(props: {
  json?: unknown;
  title?: string;
  hideTitle?: boolean;
  className?: string;
  isLoading?: boolean;
  codeClassName?: string;
  collapseStringsAfterLength?: number | null;
  scrollable?: boolean;
  borderless?: boolean;
  controlButtons?: React.ReactNode;
  externalJsonCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  // some users ingest stringified json nested in json, parse it. Also decode
  // \uXXXX escapes (e.g. Japanese ingested with Python ensure_ascii=True) so
  // non-ASCII content renders as real characters. Already-decoded strings are
  // a no-op (decodeUnicodeEscapesOnly returns early when there is no backslash).
  const parsedJson = useMemo(
    () => decodeUnicodeInJson(deepParseJson(props.json)),
    [props.json],
  );
  const { resolvedTheme } = useTheme();
  const promptReferenceProjectId = usePromptReferenceProjectId();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const collapseStringsAfterLength =
    props.collapseStringsAfterLength === null
      ? 100_000_000 // if null, show all (100M chars)
      : (props.collapseStringsAfterLength ?? 500);

  const isCollapsed = props.externalJsonCollapsed ?? internalCollapsed;

  const handleOnCopy = (event?: React.MouseEvent<HTMLButtonElement>) => {
    if (event) {
      event.preventDefault();
    }
    const textToCopy = stringifyJsonNode(parsedJson);
    copyTextToClipboard(textToCopy);

    // Keep focus on the copy button to prevent focus shifting
    if (event) {
      event.currentTarget.focus();
    }
  };

  const handleToggleCollapse = () => {
    if (props.onToggleCollapse) {
      props.onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const body = (
    <>
      <div
        className={cn(
          "io-message-content flex max-w-full min-w-0 gap-2 text-xs wrap-break-word whitespace-pre-wrap",
          props.borderless ? "" : "p-2",
          props.title === "assistant" || props.title === "Output"
            ? "bg-accent-light-green dark:border-accent-dark-green/30"
            : "",
          props.title === "system" || props.title === "Input" ? "bg-card" : "",
          props.scrollable || props.borderless ? "" : "rounded-sm border",
          props.codeClassName,
        )}
      >
        {props.isLoading ? (
          <Skeleton className="h-3 w-3/4" />
        ) : promptReferenceProjectId && typeof parsedJson === "string" ? (
          <code
            className="max-w-full min-w-0 wrap-break-word whitespace-pre-wrap"
            dir="auto"
            style={{ unicodeBidi: "plaintext" }}
          >
            {renderRichPromptContent(parsedJson)}
          </code>
        ) : (
          <div
            className="max-w-full min-w-0 flex-1 overflow-hidden"
            onClick={() => {
              // If externally collapsed and user clicks to expand, sync the state
              if (props.externalJsonCollapsed && props.onToggleCollapse) {
                props.onToggleCollapse();
              }
            }}
          >
            <React18JsonView
              src={parsedJson}
              theme="github"
              dark={resolvedTheme === "dark"}
              collapsed={isCollapsed ? 1 : false}
              collapseObjectsAfterLength={isCollapsed ? 0 : 20}
              collapseStringsAfterLength={collapseStringsAfterLength}
              collapseStringMode="word"
              customizeCollapseStringUI={(fullSTring, truncated) =>
                truncated ? (
                  <div className="opacity-50">{`\n...展开(还有 ${Math.max(fullSTring.length - collapseStringsAfterLength, 0)} 个字符)`}</div>
                ) : (
                  ""
                )
              }
              displaySize={isCollapsed ? "collapsed" : "expanded"}
              matchesURL={true}
              customizeCopy={(node) => stringifyJsonNode(node)}
              className="w-full max-w-full min-w-0"
            />
          </div>
        )}
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "flex max-h-full min-h-0 max-w-full min-w-0 flex-col",
        props.className,
        props.scrollable ? "overflow-hidden" : "",
      )}
    >
      {props.title && !props.hideTitle ? (
        <JsonViewHeader
          title={props.title}
          handleOnCopy={handleOnCopy}
          controlButtons={
            <>
              {props.controlButtons}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleToggleCollapse}
                className="hover:bg-border -mr-2"
                title={isCollapsed ? "全部展开" : "全部折叠"}
              >
                {isCollapsed ? (
                  <UnfoldVertical className="h-3 w-3" />
                ) : (
                  <FoldVertical className="h-3 w-3" />
                )}
              </Button>
            </>
          }
        />
      ) : null}
      {props.scrollable ? (
        <div className="flex h-full min-h-0 max-w-full overflow-hidden rounded-sm border">
          <div className="max-h-full min-h-0 w-full max-w-full min-w-0 overflow-y-auto">
            {body}
          </div>
        </div>
      ) : (
        body
      )}
    </div>
  );
}

export function CodeView(props: {
  content: string | React.ReactNode[] | undefined | null;
  originalContent?: string;
  className?: string;
  defaultCollapsed?: boolean;
  title?: string;
  scrollable?: boolean;
  copiedToClipboardMessage?: string;
  lineWrap?: boolean;
}) {
  const { copiedToClipboardMessage } = props;
  const lineWrap = props.lineWrap ?? true;

  const [isCollapsed, setCollapsed] = useState(props.defaultCollapsed);

  const { copy, isCopied } = useCopyToClipboard({
    successDuration: copiedToClipboardMessage ? 3_000 : 1_000,
  });

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const button = event.currentTarget;
    const content =
      props.originalContent ??
      (typeof props.content === "string"
        ? props.content
        : (props.content?.join("\n") ?? ""));

    try {
      await copy(content);
    } catch {
      // Clipboard writes can be rejected when the browser denies permission.
    }

    if (button) {
      // Keep focus on the copy button to prevent focus shifting
      // Note: the original button might no longer be in the DOM if React re-rendered the component after the state update.
      button.focus();
    }
  };

  const handleShowAll = () => setCollapsed(!isCollapsed);

  const CopySuccessIcon = useMemo(() => {
    return (
      <div className="animate-appear relative h-3">
        <Check className="h-3 w-3" />
        {copiedToClipboardMessage && (
          <div
            className="text-secondary-foreground absolute top-0 right-0 mr-6 h-full max-w-[60vw] transform truncate overflow-hidden text-right text-sm leading-none whitespace-nowrap"
            title={copiedToClipboardMessage}
          >
            {copiedToClipboardMessage}
          </div>
        )}
      </div>
    );
  }, [copiedToClipboardMessage]);

  return (
    <div
      className={cn(
        "flex max-w-full min-w-0 flex-col",
        props.className,
        props.scrollable && "max-h-full min-h-0",
      )}
    >
      <>
        {props.title ? (
          <div className="my-1 flex shrink-0 items-center justify-between pl-1">
            <div className="text-sm font-bold">{props.title}</div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleCopy}
              className=""
            >
              {isCopied ? CopySuccessIcon : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        ) : undefined}
      </>
      <div
        className={cn(
          "relative flex max-w-full min-w-0 flex-col gap-2 overflow-hidden rounded-md border",
          props.scrollable ? "max-h-full min-h-0 overflow-hidden" : "",
        )}
      >
        {!props.title && (
          <Button
            variant="secondary"
            size="icon-xs"
            onClick={handleCopy}
            className="absolute top-2 right-2 z-10"
          >
            {isCopied ? CopySuccessIcon : <Copy className="h-3 w-3" />}
          </Button>
        )}
        <code
          className={cn(
            "relative max-w-full min-w-0 flex-1 px-4 py-3 font-mono text-xs",
            !props.title && !lineWrap ? "w-[calc(100%-2.5rem)] pr-12" : "",
            lineWrap
              ? "wrap-break-word whitespace-pre-wrap"
              : "overflow-x-auto whitespace-pre",
            isCollapsed ? `line-clamp-6` : "block",
            props.scrollable ? "overflow-y-auto" : "",
          )}
          dir="auto"
          style={{ unicodeBidi: "plaintext" }}
        >
          {props.content}
        </code>
        {props.defaultCollapsed ? (
          <div className="flex gap-2 py-2 pr-2">
            <Button variant="secondary" size="xs" onClick={handleShowAll}>
              {isCollapsed ? (
                <ChevronsUpDown className="h-3 w-3" />
              ) : (
                <ChevronsDownUp className="h-3 w-3" />
              )}
            </Button>
          </div>
        ) : undefined}
      </div>
    </div>
  );
}

export const JsonSkeleton = ({
  numRows = 10,
  borderless = false,
  className,
}: {
  numRows?: number;
  borderless?: boolean;
  className?: string;
}) => {
  const isSingleLine = numRows === 1;

  return (
    <div
      className={cn(
        isSingleLine ? "w-full" : "w-[400px]",
        "rounded-md",
        borderless ? "" : "border",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        {[...Array<number>(numRows)].map((_, i) => (
          <Skeleton
            className={cn(
              "h-4 w-full",
              !isSingleLine && i === numRows - 1 ? "w-3/4" : undefined,
            )}
            key={i}
          />
        ))}
      </div>
    </div>
  );
};

// TODO: deduplicate with PrettyJsonView.tsx
export function stringifyJsonNode(node: unknown) {
  // return single string nodes without quotes
  if (typeof node === "string") {
    return node;
  }

  try {
    return JSON.stringify(
      node,
      (_key, value) => {
        switch (typeof value) {
          case "bigint":
            return String(value) + "n";
          case "number":
          case "boolean":
          case "object":
          case "string":
            return value as string;
          default:
            return String(value);
        }
      },
      4,
    );
  } catch (error) {
    console.error("JSON stringify error", error);
    return "错误:JSON.stringify 失败";
  }
}
