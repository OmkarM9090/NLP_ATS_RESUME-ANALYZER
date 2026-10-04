"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";

import { AnalysisLoader } from "@/components/analyze/AnalysisLoader";
import { Dropzone } from "@/components/analyze/Dropzone";
import { HistoryList } from "@/components/analyze/HistoryList";
import {
  DEFAULT_OPTIONS,
  OptionsPanel,
  type AnalysisOptions,
} from "@/components/analyze/OptionsPanel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { IconAlert, IconArrowRight, IconSpark } from "@/components/ui/Icons";
import { useGsapContext } from "@/hooks/useGsapContext";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { useAnalysisRunner } from "@/hooks/useAnalysisRunner";
import { useAnalysisStore } from "@/stores/analysisStore";
import { MAX_FILE_SIZE_MB, ALLOWED_EXTENSIONS } from "@/lib/constants";
import { toast } from "@/stores/toastStore";

/** Short sample pair so the pipeline can be tried without any files. */
const SAMPLE_RESUME = `ALEX SHARMA
Senior Machine Learning Engineer
Bengaluru, India | alex.sharma@example.com | +91 98200 41235
linkedin.com/in/alexsharma | github.com/alexsharma

SUMMARY
Machine learning engineer with 7+ years building production NLP and recommendation
systems. Led model deployment on AWS with Docker, Kubernetes and CI/CD pipelines.

EXPERIENCE
Senior Machine Learning Engineer | FinEdge Technologies | Mar 2021 - Present
- Built NLP pipelines with Python, spaCy and PyTorch serving 12M requests per day.
- Deployed models on AWS SageMaker and Kubernetes, cutting inference latency by 38%.
- Designed feature stores and Airflow DAGs for daily retraining and monitoring.
- Mentored four engineers and introduced MLflow experiment tracking.

Machine Learning Engineer | DataWorks Analytics | Jun 2018 - Feb 2021
- Developed recommendation models in Python, SQL and Spark over 4TB datasets.
- Automated reporting with Airflow, reducing manual effort by 20 hours a week.
- Improved model F1 from 0.71 to 0.86 using feature engineering and ensembling.

EDUCATION
M.S. in Computer Science, Indian Institute of Technology Bombay, 2018
B.E. in Information Technology, University of Pune, 2016

SKILLS
Python, Machine Learning, Deep Learning, NLP, PyTorch, TensorFlow, SQL, Spark,
AWS, Docker, Kubernetes, Airflow, CI/CD, MLOps, scikit-learn, pandas, Git

CERTIFICATIONS
AWS Certified Machine Learning - Specialty
Google Cloud Professional Data Engineer
`;

const SAMPLE_JD = `Senior Machine Learning Engineer — TechNova Labs (Remote, India)

About the role
TechNova Labs is hiring a Senior Machine Learning Engineer to own the NLP and
recommendation platform behind our core product.

Requirements
- 5+ years of experience building and deploying machine learning models.
- Strong Python and SQL; production experience with PyTorch or TensorFlow.
- Hands-on NLP work: spaCy, transformers, embeddings, text classification.
- Deploying models with Docker, Kubernetes and CI/CD on AWS, GCP or Azure.
- Orchestrating data pipelines using Airflow or similar schedulers.
- Experience with Spark and large-scale feature engineering.
- Bachelors or Masters degree in Computer Science or a related field.

Preferred
- MLOps tooling: MLflow, Terraform, monitoring and model registries.
- Experience with Rust or Go for performance-critical services.
- Published research or open-source contributions.

Responsibilities
- Design, train and ship models that serve millions of requests daily.
- Collaborate with product and data engineering on feature roadmaps.
- Mentor engineers and raise the bar for code and experiment quality.

Salary: INR 45,00,000 - 62,00,000 per year
`;

/**
 * /analyze — two dropzones, scoring options, and the live pipeline loader.
 *
 * On success the result is pushed into the (session-persisted) analysis store
 * and the router navigates to /results, which renders whatever is in the store.
 */
export default function AnalyzePage() {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const scopeRef = useRef<HTMLDivElement>(null);

  const runner = useAnalysisRunner();
  const startedAt = useAnalysisStore((state) => state.startedAt);
  const storeError = useAnalysisStore((state) => state.error);
  const [options, setOptions] = useState<AnalysisOptions>(DEFAULT_OPTIONS);

  useGsapContext(
    () => {
      gsap.fromTo(
        "[data-reveal]",
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.8, ease: "expo.out", stagger: 0.09 },
      );
    },
    { scope: scopeRef, disabled: reducedMotion },
  );

  // Send the user to the results page as soon as a run completes.
  useEffect(() => {
    if (runner.status === "success" && runner.result) {
      const timer = window.setTimeout(() => router.push("/results"), 550);
      return () => window.clearTimeout(timer);
    }
  }, [router, runner.result, runner.status]);

  const submit = useCallback(async () => {
    if (!runner.canSubmit) {
      toast.warning(
        "Add both documents",
        "A resume and a job description are required before the analysis can run.",
      );
      return;
    }
    await runner.submit({
      weights: options.weights,
      topKeywords: options.topKeywords,
      includeSectionText: options.includeSectionText,
      persist: options.persist,
    });
  }, [options, runner]);

  const loadSamples = useCallback(() => {
    const resume = new File([SAMPLE_RESUME], "sample-resume.txt", { type: "text/plain" });
    const jd = new File([SAMPLE_JD], "sample-job-description.txt", { type: "text/plain" });
    runner.setFile("resume", resume);
    runner.setFile("job_description", jd);
    toast.info("Sample documents loaded", "A 7-year ML engineer resume against a matching posting.");
  }, [runner]);

  const busy = runner.isBusy;
  const progressVisible = busy || runner.percent > 0;

  const headline = useMemo(
    () => ({
      eyebrow: "Analysis",
      title: "Compare a resume with a job description",
      body: `Upload both documents (${ALLOWED_EXTENSIONS.join(", ")}, up to ${MAX_FILE_SIZE_MB} MB each) and the full twelve-stage NLP pipeline runs server-side. Nothing leaves your machine except the two files you send.`,
    }),
    [],
  );

  return (
    <div ref={scopeRef} className="pt-[calc(72px+40px)] pb-section">
      <div className="section-inner">
        <header data-reveal className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="eyebrow">{headline.eyebrow}</p>
          <h1 className="text-h1 text-balance">{headline.title}</h1>
          <p className="text-lead text-ink-muted">{headline.body}</p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Badge tone="neutral">POST /api/analyze</Badge>
            <Badge tone="neutral">10 analyses / minute</Badge>
            <Badge tone="neutral">~1 s typical</Badge>
          </div>
        </header>

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-8">
          {/* Left: inputs */}
          <div data-reveal className="space-y-5">
            <Card className="space-y-6">
              <Dropzone
                label="Resume / CV"
                description="Your current resume — PDF works best."
                accent="primary"
                file={runner.slots.resume.file}
                error={runner.slots.resume.error}
                onFile={(file) => runner.setFile("resume", file)}
                onClear={() => runner.clearSlot("resume")}
                disabled={busy}
                hint="Scanned PDFs use OCR when available"
              />

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-micro uppercase tracking-[0.18em] text-ink-faint">
                  compared against
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <Dropzone
                label="Job description"
                description="The posting you are applying to — paste it into a .txt if needed."
                accent="secondary"
                file={runner.slots.job_description.file}
                error={runner.slots.job_description.error}
                onFile={(file) => runner.setFile("job_description", file)}
                onClear={() => runner.clearSlot("job_description")}
                disabled={busy}
                hint="PDF or plain text"
              />
            </Card>

            <div data-reveal>
              <OptionsPanel options={options} onChange={setOptions} disabled={busy} />
            </div>

            <div data-reveal className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                onClick={() => void submit()}
                disabled={!runner.canSubmit}
                loading={busy}
                iconRight={busy ? undefined : <IconArrowRight size={18} />}
                className="sm:flex-1"
              >
                {busy ? "Analysing…" : "Run analysis"}
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={loadSamples}
                disabled={busy}
                iconLeft={<IconSpark size={17} />}
              >
                Use sample docs
              </Button>

              {(runner.slots.resume.file || runner.slots.job_description.file) && !busy ? (
                <Button size="lg" variant="ghost" onClick={runner.clearAll}>
                  Clear
                </Button>
              ) : null}
            </div>

            <AnimatePresence>
              {storeError && !busy ? (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-start gap-3 rounded-card border border-danger/40 bg-danger/8 p-4"
                  role="alert"
                >
                  <IconAlert size={18} className="mt-0.5 shrink-0 text-danger" />
                  <div className="min-w-0 space-y-1">
                    <p className="text-small font-semibold text-danger">{storeError.userMessage}</p>
                    {storeError.detail ? (
                      <p className="text-small text-ink-muted">{storeError.detail}</p>
                    ) : null}
                    <p className="font-mono text-micro uppercase tracking-[0.14em] text-ink-faint">
                      code {storeError.code} · http {storeError.status || "network"}
                      {storeError.requestId ? ` · request ${storeError.requestId}` : ""}
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Right: loader + history */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {progressVisible ? (
                <motion.div
                  key="loader"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="lg:sticky lg:top-28"
                >
                  <AnalysisLoader
                    percent={runner.percent}
                    stageIndex={runner.stageIndex}
                    uploadPercent={runner.uploadPercent}
                    startedAt={startedAt}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="tips"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Card className="space-y-4">
                    <h2 className="text-h5">What gets scored</h2>
                    <ul className="space-y-3">
                      {[
                        ["Keyword match", "25% — TF-IDF overlap plus coverage of the posting's top terms."],
                        ["Semantic similarity", "30% — sentence-embedding similarity, calibrated."],
                        ["Skill match", "25% — taxonomy aliases, fuzzy and semantic matching."],
                        ["Experience relevance", "10% — years and seniority against the requirement."],
                        ["Education match", "10% — degree level and field of study."],
                      ].map(([label, detail]) => (
                        <li key={label} className="space-y-1 border-l border-line pl-4">
                          <p className="text-small font-medium text-ink">{label}</p>
                          <p className="text-micro leading-relaxed text-ink-faint">{detail}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="border-t border-line pt-4 text-micro leading-relaxed text-ink-faint">
                      Weights can be overridden above; the backend renormalises them so the overall
                      score always stays 0–100.
                    </p>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <div data-reveal className="space-y-4">
              <HistoryList limit={6} />

              <p className="px-1 text-micro leading-relaxed text-ink-faint">
                Prefer the API directly?{" "}
                <Link href="/docs" className="text-secondary-300 underline decoration-line underline-offset-4 hover:text-secondary-200">
                  Open the interactive docs
                </Link>{" "}
                or{" "}
                <Link href="/" className="text-secondary-300 underline decoration-line underline-offset-4 hover:text-secondary-200">
                  read how the pipeline works
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
