"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ClipboardCopy, Download, History, RotateCcw } from "lucide-react";
import type { AnalysisResponse } from "@/types/analysis";
import { Button } from "@/components/ui/primitives";
import { scoreLabel } from "@/lib/utils";

export default function ResultsActions({ result }: { result: AnalysisResponse }) {
  const [copied, setCopied] = useState(false);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumeai-analysis-${result.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copySummary = async () => {
    const topMissing = result.skills_analysis.missing.slice(0, 5).join(", ") || "none";
    const topMatched = result.skills_analysis.matched.slice(0, 6).join(", ") || "none";
    const topRecs = result.recommendations
      .slice(0, 3)
      .map((r, i) => `  ${i + 1}. [${r.priority}] ${r.message}`)
      .join("\n");
    const text = [
      `ResumeAI Match Report — ${new Date(result.timestamp).toLocaleDateString()}`,
      `Overall score: ${result.overall_score}/100 (${scoreLabel(result.overall_score)})`,
      `Files: ${result.resume_filename} × ${result.jd_filename}`,
      ``,
      `Breakdown: keyword ${result.score_breakdown.keyword_match.score} · semantic ${result.score_breakdown.semantic_similarity.score} · skills ${result.score_breakdown.skill_match.score} · experience ${result.score_breakdown.experience_relevance.score} · education ${result.score_breakdown.education_match.score}`,
      `Matched skills: ${topMatched}`,
      `Missing skills: ${topMissing}`,
      ``,
      `Top recommendations:`,
      topRecs || "  none",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="relative flex flex-wrap items-center justify-center gap-3">
      <Link href="/analyze">
        <Button variant="primary" className="gap-2">
          <RotateCcw className="h-4 w-4" /> Analyze another pair
        </Button>
      </Link>
      <Button variant="secondary" onClick={exportJson} className="gap-2">
        <Download className="h-4 w-4" /> Export JSON report
      </Button>
      <Button variant="secondary" onClick={copySummary} className="gap-2">
        {copied ? <Check className="h-4 w-4 text-success" /> : <ClipboardCopy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy summary"}
      </Button>
      <Link href="/history">
        <Button variant="ghost" className="gap-2">
          <History className="h-4 w-4" /> View history
        </Button>
      </Link>

      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="glass-strong absolute -top-12 rounded-lg px-3.5 py-2 font-mono text-xs text-success"
          >
            Summary copied to clipboard
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
