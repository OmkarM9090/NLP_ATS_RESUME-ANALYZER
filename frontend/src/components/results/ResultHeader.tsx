"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconArrowRight, IconRefresh } from "@/components/ui/Icons";
import { formatMs, formatTimestamp } from "@/lib/format";
import type { AnalysisResponse } from "@/types";

interface Props {
  result: AnalysisResponse;
  onNewAnalysis: () => void;
  onBack: () => void;
}

/**
 * Results page header: document names, run metadata and the primary actions.
 */
export function ResultHeader({ result, onNewAnalysis, onBack }: Props) {
  const meta = result.nlp_metadata;

  return (
    <header className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          analysis complete
        </Badge>
        <Badge tone="neutral">{formatTimestamp(result.timestamp)}</Badge>
        {meta ? <Badge tone="neutral">{formatMs(meta.processing_time_ms)}</Badge> : null}
        {meta?.degraded_mode ? <Badge tone="warning">degraded mode</Badge> : null}
        {result.id ? (
          <span className="font-mono text-micro text-ink-faint">id {result.id.slice(0, 8)}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0 space-y-2">
          <p className="eyebrow">Match report</p>
          <h1 className="text-h1 text-balance">
            {result.resume_filename}
            <span className="mx-3 text-ink-faint">vs</span>
            <span className="text-ink-muted">{result.jd_filename}</span>
          </h1>
          <p className="max-w-2xl text-lead text-ink-muted">{result.verdict}</p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} iconLeft={<IconRefresh size={15} />}>
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNewAnalysis}
            iconRight={<IconArrowRight size={15} />}
          >
            New analysis
          </Button>
        </div>
      </div>
    </header>
  );
}
