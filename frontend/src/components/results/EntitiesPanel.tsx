"use client";

import {
  Award,
  Building2,
  CalendarDays,
  GraduationCap,
  Mail,
  MapPin,
  Timer,
  User,
} from "lucide-react";
import type { EntityExtraction, NLPMetadata } from "@/types/analysis";
import { Badge } from "@/components/ui/primitives";

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist/60">{label}</p>
        <div className="mt-1 text-sm text-ink/90">{children}</div>
      </div>
    </div>
  );
}

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <span className="text-mist/60">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <span key={x} className="rounded-md border border-line bg-white/[0.03] px-2 py-0.5 text-xs">
          {x}
        </span>
      ))}
    </span>
  );
}

export function EntitiesPanel({ entities }: { entities: EntityExtraction }) {
  const r = entities.resume;
  const j = entities.job_description;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="glass rounded-2xl p-6">
        <h3 className="mb-2 font-display text-base font-semibold">
          Detected on your resume
        </h3>
        <div className="divide-y divide-line/50">
          <Row icon={User} label="Candidate">
            {r.person ?? <span className="text-mist/60">Not confidently detected</span>}
          </Row>
          <Row icon={Building2} label="Organizations">
            <Chips items={r.organizations} empty="None detected" />
          </Row>
          <Row icon={MapPin} label="Locations">
            <Chips items={r.locations} empty="None detected" />
          </Row>
          <Row icon={CalendarDays} label="Date ranges">
            <Chips items={r.dates} empty="None detected" />
          </Row>
          <Row icon={Timer} label="Est. experience">
            {r.years_experience != null ? (
              <span className="font-mono font-semibold text-secondary">
                ~{r.years_experience} years
              </span>
            ) : (
              <span className="text-mist/60">Could not estimate — add explicit date ranges</span>
            )}
          </Row>
          <Row icon={GraduationCap} label="Education">
            <Chips items={r.degrees} empty="No degree patterns detected" />
          </Row>
          <Row icon={Award} label="Certifications">
            <Chips items={r.certifications} empty="None detected" />
          </Row>
          <Row icon={Mail} label="Contact">
            {(r.emails?.length || r.phones?.length) ? (
              <span className="space-y-0.5 font-mono text-xs">
                {(r.emails ?? []).map((e) => (
                  <span key={e} className="block text-secondary">{e}</span>
                ))}
                {(r.phones ?? []).map((p) => (
                  <span key={p} className="block text-mist">{p}</span>
                ))}
                {(r.urls ?? []).slice(0, 2).map((u) => (
                  <span key={u} className="block text-mist/70">{u}</span>
                ))}
              </span>
            ) : (
              <span className="text-mist/60">None detected</span>
            )}
          </Row>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="mb-2 font-display text-base font-semibold">
          Extracted from the job posting
        </h3>
        <div className="divide-y divide-line/50">
          <Row icon={Building2} label="Company">
            {j.organization ?? <span className="text-mist/60">Not detected</span>}
          </Row>
          <Row icon={MapPin} label="Location">
            {j.location ?? <span className="text-mist/60">Not detected</span>}
          </Row>
          <Row icon={Timer} label="Experience required">
            {j.experience_requirement ? (
              <span className="font-mono font-semibold text-secondary">{j.experience_requirement}</span>
            ) : (
              <span className="text-mist/60">Not stated</span>
            )}
          </Row>
          <Row icon={GraduationCap} label="Education required">
            {j.degree_requirement ?? <span className="text-mist/60">Not stated</span>}
          </Row>
        </div>

        <div className="mt-4 space-y-3 border-t border-line/50 pt-4">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mist/60">
              Required skills ({j.required_skills.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {j.required_skills.slice(0, 16).map((s) => (
                <Badge key={s} tone="primary" className="font-mono">{s}</Badge>
              ))}
              {!j.required_skills.length && <span className="text-xs text-mist/60">None detected</span>}
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mist/60">
              Preferred / nice-to-have ({j.preferred_skills.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {j.preferred_skills.slice(0, 16).map((s) => (
                <Badge key={s} tone="secondary" className="font-mono">{s}</Badge>
              ))}
              {!j.preferred_skills.length && <span className="text-xs text-mist/60">None detected</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MetadataStrip({ meta }: { meta: NLPMetadata }) {
  const stats: Array<[string, string]> = [
    ["resume words", String(meta.resume_word_count)],
    ["jd words", String(meta.jd_word_count)],
    ["resume unique tokens", String(meta.resume_unique_tokens)],
    ["jd unique tokens", String(meta.jd_unique_tokens)],
    ["pages", `${meta.resume_pages} + ${meta.jd_pages}`],
    ["processing", `${meta.processing_time_ms} ms`],
  ];
  return (
    <div className="glass rounded-2xl p-6">
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-mist/60">
        NLP run metadata
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-white/[0.03] px-3 py-2.5">
            <p className="font-mono text-sm font-semibold text-ink">{v}</p>
            <p className="mt-0.5 text-[10px] text-mist/70">{k}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {meta.models_used.map((m) => (
          <span key={m} className="rounded-md border border-primary/25 bg-primary/[0.07] px-2 py-1 font-mono text-[10px] text-indigo-300">
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
