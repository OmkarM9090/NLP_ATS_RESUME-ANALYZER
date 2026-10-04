import { Braces, Cpu, Network, Scissors, Sigma, TextCursorInput, Type, Workflow } from "lucide-react";

const ITEMS = [
  { icon: Scissors, label: "Tokenization" },
  { icon: Type, label: "Lemmatization" },
  { icon: Braces, label: "POS Tagging" },
  { icon: Sigma, label: "TF-IDF" },
  { icon: Workflow, label: "RAKE" },
  { icon: Network, label: "Semantic Coverage" },
  { icon: Cpu, label: "Skill Taxonomy" },
  { icon: TextCursorInput, label: "Entity Recognition" },
];

export default function LogoMarquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <section className="relative border-y border-line/50 bg-panel/60 py-7">
      <p className="mb-5 text-center font-mono text-[11px] uppercase tracking-[0.35em] text-mist/60">
        Powered by a real NLP pipeline
      </p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <div className="animate-marquee flex w-max items-center gap-12 pr-12">
          {row.map(({ icon: Icon, label }, i) => (
            <div
              key={`${label}-${i}`}
              className="flex items-center gap-2.5 text-mist/70 transition-colors hover:text-ink"
              aria-hidden={i >= ITEMS.length}
            >
              <Icon className="h-4.5 w-4.5 text-primary/70" strokeWidth={1.8} />
              <span className="whitespace-nowrap font-display text-sm font-medium tracking-wide">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
