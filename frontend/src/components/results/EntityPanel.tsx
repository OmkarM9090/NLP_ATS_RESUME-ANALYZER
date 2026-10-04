"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatYears, titleCase } from "@/lib/format";
import type { EntityExtraction, JobDescriptionEntities, ResumeEntities } from "@/types";

type Tab = "resume" | "jd";

/**
 * Extracted entities side by side.
 *
 * This is the "what the parser actually saw" panel — the same data the scorer
 * used, so a surprising score can always be traced back to an extraction result.
 */
export function EntityPanel({ entities, className }: { entities: EntityExtraction; className?: string }) {
  const [tab, setTab] = useState<Tab>("resume");
  const resume = entities.resume;
  const jd = entities.job_description;

  return (
    <Card className={cn("space-y-5", className)}>
      <CardHeader
        eyebrow="NER output"
        title="Extracted entities"
        description="spaCy named-entity recognition plus taxonomy matching, shown exactly as the scorer received it."
        action={
          <div className="flex rounded-pill border border-line p-1">
            {(
              [
                { key: "resume", label: "Resume" },
                { key: "jd", label: "Job description" },
              ] as Array<{ key: Tab; label: string }>
            ).map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setTab(entry.key)}
                aria-pressed={tab === entry.key}
                className={cn(
                  "rounded-pill px-3 py-1.5 font-mono text-micro uppercase tracking-[0.12em] transition-colors",
                  tab === entry.key
                    ? "bg-primary-500/18 text-primary-200"
                    : "text-ink-faint hover:text-ink-muted",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        }
      />

      {tab === "resume" ? <ResumeEntitiesView data={resume} /> : <JdEntitiesView data={jd} />}
    </Card>
  );
}

function ResumeEntitiesView({ data }: { data: ResumeEntities }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Fact label="Candidate" value={data.person ?? "Not detected"} />
        <Fact label="Experience" value={formatYears(data.years_experience)} />
        <Fact label="Education level" value={data.education_level ? titleCase(data.education_level) : "Not detected"} />
      </div>

      <List label="Emails" items={data.emails} tone="text-secondary-300" />
      <List label="Phone numbers" items={data.phones} tone="text-secondary-300" />
      <List label="Links" items={data.urls} tone="text-secondary-300" />
      <List label="Job titles held" items={data.job_titles} />
      <List label="Organisations" items={data.organizations} />
      <List label="Locations" items={data.locations} />
      <List label="Degrees" items={data.degrees} />
      <List label="Certifications" items={data.certifications} tone="text-success" />
      <List label="Skills detected" items={data.skills} limit={40} chips />
      <List label="Dates found" items={data.dates} limit={12} />
    </div>
  );
}

function JdEntitiesView({ data }: { data: JobDescriptionEntities }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Fact label="Organisation" value={data.organization ?? "Not stated"} />
        <Fact label="Location" value={data.location ?? "Not stated"} />
        <Fact label="Role" value={data.job_title ?? "Not stated"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Fact label="Experience required" value={data.experience_requirement ?? "Not stated"} />
        <Fact label="Minimum years" value={formatYears(data.min_years_experience)} />
        <Fact label="Degree requirement" value={data.degree_requirement ?? "Not stated"} />
      </div>

      {data.salary_range ? (
        <div className="rounded-card border border-success/30 bg-success/6 px-4 py-3">
          <p className="label">Salary range</p>
          <p className="numeric mt-1 text-h5 text-success">{data.salary_range}</p>
        </div>
      ) : null}

      <List label="Required skills" items={data.required_skills} tone="text-danger" chips />
      <List label="Preferred skills" items={data.preferred_skills} tone="text-warning" chips />
      <List label="Soft skills" items={data.soft_skills} chips />
      <List label="Certifications" items={data.certifications} />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface/50 p-4">
      <p className="label">{label}</p>
      <p className="mt-1 truncate text-body text-ink" title={value}>
        {value}
      </p>
    </div>
  );
}

function List({
  label,
  items,
  tone = "text-ink",
  limit,
  chips = false,
}: {
  label: string;
  items?: string[] | null;
  tone?: string;
  limit?: number;
  chips?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const all = items ?? [];
  if (all.length === 0) return null;

  const shown = limit && !expanded ? all.slice(0, limit) : all;
  const hidden = limit ? Math.max(0, all.length - limit) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <p className="label">{label}</p>
        <Badge tone="neutral">{all.length}</Badge>
      </div>
      {chips ? (
        <div className="flex flex-wrap gap-1.5">
          {shown.map((item) => (
            <span
              key={item}
              className="rounded-pill border border-line bg-surface-raised/70 px-2.5 py-1 text-small text-ink-muted"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {shown.map((item) => (
            <li key={item} className={cn("text-small", tone)}>
              {item}
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="font-mono text-micro uppercase tracking-[0.14em] text-secondary-300 hover:text-secondary-200"
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      ) : null}
    </div>
  );
}
