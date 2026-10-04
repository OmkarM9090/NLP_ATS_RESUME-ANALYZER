"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { IconChevron } from "@/components/ui/Icons";
import { FAQS } from "@/lib/constants";
import { cn } from "@/lib/cn";

/** Accessible FAQ accordion (Framer Motion height animation). */
export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const scopeRef = useRef<HTMLDivElement>(null);

  return (
    <section id="faq" className="section" aria-labelledby="faq-heading">
      <div className="section-inner">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16">
          <SectionHeading
            eyebrow="Questions"
            title={<span id="faq-heading">How it works under the hood</span>}
            description="The short answers. The long ones live in the README and the API reference."
          />

          <div ref={scopeRef} className="divide-y divide-line border-y border-line">
            {FAQS.map((entry, index) => {
              const isOpen = open === index;
              return (
                <div key={entry.q}>
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${index}`}
                      className="flex w-full items-center justify-between gap-5 py-5 text-left transition-colors hover:text-primary-200"
                    >
                      <span className={cn("text-h5 transition-colors", isOpen && "text-primary-200")}>
                        {entry.q}
                      </span>
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-pill border border-line text-ink-muted transition-transform duration-300",
                          isOpen && "rotate-180 border-primary-400/45 text-primary-200",
                        )}
                      >
                        <IconChevron size={16} />
                      </span>
                    </button>
                  </h3>

                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        id={`faq-panel-${index}`}
                        key="panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-prose pb-6 text-body leading-relaxed text-ink-muted">
                          {entry.a}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
