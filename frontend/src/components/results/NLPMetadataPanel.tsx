"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PIPELINE_STAGES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { formatMs } from "@/lib/format";
import { IconAlert, IconCheck } from "@/components/ui/Icons";
import type { NLPMetadata } from "@/types";

/**
 * NLP metadata: word counts, extraction methods, models used, the completed
 * pipeline stages, degraded-mode state and every warning the backend raised.
 *
 * This panel is the honesty layer — it makes the fallback path visible instead
 * of letting a degraded score look authoritative.
 */
export function NLPMetadataPanel({ metadata, className }: { metadata: NLPMetadata; className?: string }) {
  const stages = metadata.pipeline_stages_completed ?? [];
  const known = new Set(PIPELINE_STAGES.map((stage) => stage.key));

  return (
    <Card className={cn("space-y-6", className)}>
      <CardHeader
        eyebrow="Pipeline"
        title="NLP metadata"
        description="Everything the run recorded about itself: inputs, models, stages and warnings."
        action={
          <Badge tone={metadata.degraded_mode ? "warning" : "success"}>
            {metadata.degraded_mode ? "degraded mode" : "full model stack"}
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Processing time" value={formatMs(metadata.processing_time_ms)} />
        <Metric label="Resume words" value={String(metadata.resume_word_count ?? 0)} hint={`${metadata.resume_unique_tokens ?? 0} unique`} />
        <Metric label="JD words" value={String(metadata.jd_word_count ?? 0)} hint={`${metadata.jd_unique_tokens ?? 0} unique`} />
        <Metric
          label="Sentences"
          value={`${metadata.resume_sentence_count ?? 0} / ${metadata.jd_sentence_count ?? 0}`}
          hint="resume / job description"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Extraction
          label="Resume extraction"
          method={metadata.resume_extraction_method}
          scanned={metadata.resume_is_scanned}
        />
        <Extraction
          label="Job description extraction"
          method={metadata.jd_extraction_method}
          scanned={metadata.jd_is_scanned}
        />
      </div>

      <div className="space-y-3 border-t border-line pt-5">
        <p className="label">Models used</p>
        <div className="flex flex-wrap gap-2">
          {(metadata.models_used ?? []).length === 0 ? (
            <span className="text-small text-ink-faint">None reported</span>
          ) : (
            metadata.models_used.map((model) => (
              <Badge key={model} tone="primary" className="normal-case tracking-normal">
                <span className="font-mono text-small text-ink">{model}</span>
              </Badge>
            ))
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-line pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="label">Pipeline stages completed</p>
          <span className="numeric text-micro text-ink-faint">{stages.length}</span>
        </div>
        <ol className="flex flex-wrap gap-1.5">
          {stages.map((stage, index) => (
            <li
              key={`${stage}-${index}`}
              className={cn(
                "flex items-center gap-1.5 rounded-pill border px-2.5 py-1 font-mono text-micro",
                known.has(stage)
                  ? "border-line bg-surface-raised/60 text-ink-muted"
                  : "border-warning/35 bg-warning/8 text-warning",
              )}
              title={known.has(stage) ? stage : `Unknown stage: ${stage}`}
            >
              <span className="text-ink-faint">{String(index + 1).padStart(2, "0")}</span>
              {stage}
            </li>
          ))}
        </ol>
        {stages.length === 0 ? (
          <p className="text-small text-ink-faint">No stage telemetry was recorded for this run.</p>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-line pt-5">
        <div className="flex items-center gap-2.5">
          <p className="label">Warnings</p>
          <Badge tone={(metadata.warnings?.length ?? 0) > 0 ? "warning" : "success"}>
            {metadata.warnings?.length ?? 0}
          </Badge>
        </div>
        {(metadata.warnings?.length ?? 0) === 0 ? (
          <p className="flex items-center gap-2 text-small text-success">
            <IconCheck size={15} />
            No warnings — every model and extractor ran at full capability.
          </p>
        ) : (
          <ul className="space-y-2">
            {metadata.warnings.map((warning, index) => (
              <li
                key={`${warning}-${index}`}
                className="flex items-start gap-2.5 rounded-button border border-warning/25 bg-warning/6 px-3 py-2.5"
              >
                <IconAlert size={15} className="mt-0.5 shrink-0 text-warning" />
                <span className="text-small leading-relaxed text-ink-muted">{warning}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface/50 p-4">
      <p className="label">{label}</p>
      <p className="numeric mt-1 text-h5 text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-micro text-ink-faint">{hint}</p> : null}
    </div>
  );
}

function Extraction({
  label,
  method,
  scanned,
}: {
  label: string;
  method?: string;
  scanned?: boolean;
}) {
  return (
    <div className="rounded-card border border-line bg-surface/50 p-4">
      <p className="label">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone="secondary" className="normal-case tracking-normal">
          <span className="font-mono text-small text-ink">{method ?? "unknown"}</span>
        </Badge>
        {scanned ? <Badge tone="warning">scanned document</Badge> : <Badge tone="neutral">text layer</Badge>}
      </div>
    </div>
  );
}
