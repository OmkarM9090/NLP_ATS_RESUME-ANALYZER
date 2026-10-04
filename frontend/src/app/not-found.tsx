import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { IconArrowRight } from "@/components/ui/Icons";

export const metadata = { title: "Page not found" };

/** 404 — keeps the design language instead of the default Next page. */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center pt-[72px]">
      <div className="section-inner max-w-xl space-y-6 text-center">
        <p className="eyebrow">Error 404</p>
        <h1 className="numeric text-[96px] leading-none font-semibold text-ink sm:text-[128px]">
          404
        </h1>
        <p className="text-lead text-ink-muted">
          That page does not exist. The analyser and the API docs are still where you left them.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button href="/analyze" size="lg" iconRight={<IconArrowRight size={18} />}>
            Analyse a resume
          </Button>
          <Link
            href="/"
            className="inline-flex h-14 items-center rounded-button border border-line px-6 text-lead text-ink-muted transition-colors hover:border-primary-400/50 hover:text-ink"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
