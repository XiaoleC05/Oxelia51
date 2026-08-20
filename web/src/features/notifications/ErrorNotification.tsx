import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import { AlertTriangle, X } from "lucide-react";

interface ErrorNotificationProps {
  error: string;
  description: string;
  type: "WARNING" | "ERROR";
  dismissToast: (t?: string | number | undefined) => void;
  toast: string | number;
  path?: string;
}

export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
  error,
  description,
  type,
  dismissToast,
  toast,
  path,
}) => {
  const capture = usePostHogClientCapture();
  const isError = type === "ERROR";
  const textColor = isError
    ? "text-destructive-foreground"
    : "text-dark-yellow";

  return (
    <div className="flex justify-between">
      <div className="flex min-w-[300px] flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={20} className={textColor} />
          <div className={`m-0 text-sm leading-tight font-bold ${textColor}`}>
            {error}
          </div>
        </div>
        {description && (
          <div
            className={`text-sm leading-tight whitespace-pre-line ${textColor}`}
          >
            {description}
          </div>
        )}
        {path && (
          <div className={`text-sm leading-tight ${textColor}`}>
            路径：{path}
          </div>
        )}
      </div>
      <button
        className={`flex h-6 w-6 cursor-pointer items-start justify-end border-none bg-transparent p-0 ${textColor} transition-colors duration-200`}
        onClick={() => {
          capture("toast:dismiss", {
            toast_type: type,
            path,
          });
          dismissToast(toast);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        aria-label="关闭"
      >
        <X size={14} />
      </button>
    </div>
  );
};
