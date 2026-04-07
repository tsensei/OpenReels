import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface FailedPanelProps {
  failedStageName: string;
  failedDetail: string | null;
}

export function FailedPanel({ failedStageName, failedDetail }: FailedPanelProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-[440px] rounded-2xl border border-destructive/20 bg-card p-6 sm:p-8 shadow-glow-sm shadow-destructive/10 flex flex-col items-center text-center">
        {/* Warning icon */}
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/8">
          <AlertTriangle className="size-6 text-destructive" />
        </div>

        {/* Title */}
        <h2 className="text-lg font-semibold text-foreground">
          Pipeline Failed at {failedStageName}
        </h2>

        {/* Description */}
        <p className="mt-2 max-w-[380px] text-sm leading-relaxed text-text-subtle">
          The pipeline encountered an error during the {failedStageName} stage. See error details below.
        </p>

        {/* Error details */}
        {failedDetail && (
          <div className="mt-4 w-full">
            <p className="mb-1.5 text-left text-[11px] font-medium text-muted-foreground">Error Details</p>
            <div className="rounded-lg border border-card bg-surface-inset p-3 text-left">
              <code className="text-[11px] leading-relaxed text-destructive font-mono whitespace-pre-wrap break-words">
                {failedDetail}
              </code>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-2.5">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg border-border px-4 py-2 text-[13px] font-medium text-secondary-foreground"
            onClick={() => navigate("/")}
          >
            Start over
          </Button>
        </div>
      </div>
    </div>
  );
}
