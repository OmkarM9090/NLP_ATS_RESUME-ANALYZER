"""Reusable test fixtures: sample documents and PDF builders.

The sample resume and job description are deliberately realistic (multi-section
resume, requirement/preferred blocks in the posting) so they exercise every
pipeline stage: section parsing, date-range experience maths, degree detection,
skill-taxonomy matching, TF-IDF/RAKE/TextRank keywords and the ATS checks.

PDFs are generated with ReportLab, which keeps the test suite free of binary
blobs and lets tests assert against both the ``pdfplumber`` and plain-text paths.
"""

from __future__ import annotations

import io
from typing import List

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

SAMPLE_RESUME_TEXT = """JOHN DOE
Senior Machine Learning Engineer
San Francisco, CA | john.doe@example.com | (415) 555-0134
linkedin.com/in/johndoe | github.com/johndoe

PROFESSIONAL SUMMARY
Machine learning engineer with 6+ years of experience designing, training and
deploying production ML systems. Specialised in Python, TensorFlow and PyTorch
model development, MLOps pipelines on AWS, and large-scale data processing with
Spark and Airflow. Proven record of shipping models that serve millions of
requests per day and mentoring junior engineers.

WORK EXPERIENCE
Senior Machine Learning Engineer — DataScale Inc.
June 2021 - Present | San Francisco, CA
- Designed and deployed machine learning models for real-time fraud detection,
  reducing false positives by 34% and saving $2.1M annually.
- Built MLOps pipelines with Docker, Kubernetes and Airflow, cutting model
  deployment time from 3 days to 4 hours.
- Trained deep learning models in PyTorch and TensorFlow on GPU clusters,
  improving prediction accuracy from 82% to 94%.
- Led a team of 4 engineers and mentored 2 junior data scientists.
- Optimised SQL and Spark ETL jobs processing 2 TB of event data daily.

Machine Learning Engineer — FinTech Solutions
March 2019 - May 2021 | Oakland, CA
- Developed natural language processing models for customer intent detection
  with 91% F1 score using scikit-learn and spaCy.
- Implemented A/B testing framework that increased conversion by 12%.
- Automated feature engineering pipelines with Python and Airflow.
- Monitored model drift with custom dashboards and alerting.

Data Analyst — Retail Insights
July 2018 - February 2019 | San Jose, CA
- Built dashboards in Tableau and SQL for weekly business review.
- Analysed customer segmentation data covering 3M records.

EDUCATION
M.S. in Computer Science — Stanford University
2016 - 2018 | Specialisation in Machine Learning
B.S. in Mathematics — University of California, Berkeley
2012 - 2016 | Graduated with honours

SKILLS
Languages: Python, SQL, R, Bash
Machine Learning: TensorFlow, PyTorch, scikit-learn, XGBoost, NLP, Computer Vision
Data Engineering: Apache Spark, Airflow, Kafka, PostgreSQL, BigQuery, Redis
Cloud & DevOps: AWS (SageMaker, Lambda, S3), GCP, Docker, Kubernetes, Git, CI/CD
Analytics: Tableau, Statistics, A/B Testing, Data Visualization

CERTIFICATIONS
AWS Certified Machine Learning - Specialty (2022)
Google Professional Data Engineer (2021)

PROJECTS
Open-source contributor to pandas and scikit-learn (14 merged pull requests).
Built a real-time recommendation engine serving 500K users with sub-50ms latency.

AWARDS
"Engineer of the Year" at DataScale Inc. (2023)
"""

SAMPLE_JD_TEXT = """Senior Machine Learning Engineer — TechCorp Inc.
Location: Remote (US) | Employment: Full-time | Salary: $180,000 - $230,000

About the role
TechCorp is building the next generation of AI-powered analytics products. We are
looking for a Senior Machine Learning Engineer to join our AI platform team and
own model development from research through production deployment.

Responsibilities
- Design, build and ship machine learning models for large-scale data products.
- Own end-to-end MLOps: feature pipelines, training, CI/CD, monitoring.
- Deploy and scale models on AWS and Kubernetes with Docker containers.
- Collaborate with data scientists, product managers and software engineers.
- Mentor junior engineers and drive technical strategy for the ML platform.
- Optimise SQL and Spark workloads processing terabytes of event data.

Required Qualifications
- 5+ years of experience in machine learning or data science roles.
- Strong Python programming skills and production software engineering practice.
- Hands-on experience with TensorFlow, PyTorch or scikit-learn.
- Proven experience deploying models on AWS, GCP or Azure cloud platforms.
- Solid SQL skills and experience with big data tools such as Spark or Airflow.
- Experience with Docker, Kubernetes and CI/CD pipelines.
- Master's degree preferred in Computer Science, Statistics or a related field.

Preferred Qualifications
- Experience with Go or Rust for high-performance services.
- Infrastructure-as-code with Terraform.
- Familiarity with monitoring stacks such as Prometheus and Grafana.
- Publications or open-source contributions to machine learning projects.

Benefits
Competitive salary, equity, unlimited PTO, health/dental/vision insurance,
401(k) matching, remote-first culture and an annual learning budget.

TechCorp Inc. is an equal opportunity employer. We celebrate diversity and are
committed to creating an inclusive environment for all employees.
"""

#: A resume that shares very little with the sample JD — used to assert that the
#: scoring engine really discriminates instead of returning a constant.
UNRELATED_RESUME_TEXT = """MARIA GARCIA
Registered Nurse
Austin, TX | maria.garcia@example.com | (512) 555-7788

SUMMARY
Compassionate registered nurse with 8 years of experience in paediatric
intensive care. Certified in BLS and ACLS. Fluent in English and Spanish.

EXPERIENCE
Paediatric ICU Nurse — St. David's Medical Center
January 2018 - Present | Austin, TX
- Provided bedside care for 6-8 patients per shift.
- Coordinated with physicians on treatment plans and medication schedules.
- Trained 12 new nursing staff members on unit protocols.

EDUCATION
Bachelor of Science in Nursing — University of Texas at Austin
2014 - 2018

SKILLS
Patient care, medication administration, wound care, EHR documentation,
telemetry monitoring, Spanish, teamwork, communication

CERTIFICATIONS
Registered Nurse (RN) License — Texas
Basic Life Support (BLS)
Advanced Cardiac Life Support (ACLS)
"""

UNRELATED_JD_TEXT = """Paediatric ICU Registered Nurse — Austin Children's Hospital
Location: Austin, TX | Employment: Full-time

Responsibilities
- Deliver direct patient care in a 24-bed paediatric intensive care unit.
- Administer medications and monitor vital signs using telemetry systems.
- Document care in the Epic EHR system accurately and promptly.
- Collaborate with physicians, therapists and families on care plans.

Required Qualifications
- Current Registered Nurse (RN) licence in Texas.
- 2+ years of acute care or ICU nursing experience.
- BLS and ACLS certification.
- Bachelor of Science in Nursing (BSN) required.

Preferred Qualifications
- Paediatric certification (CPN).
- Spanish language fluency.
"""


def _styles() -> dict:
    base = getSampleStyleSheet()
    body = ParagraphStyle(
        "Body", parent=base["Normal"], fontName="Helvetica", fontSize=9.5,
        leading=12.5, spaceAfter=2,
    )
    heading = ParagraphStyle(
        "Heading", parent=body, fontName="Helvetica-Bold", fontSize=10.5,
        leading=14, spaceBefore=8, spaceAfter=3, textColor="#111111",
    )
    return {"body": body, "heading": heading}


def build_pdf(
    text: str,
    *,
    title: str = "document.pdf",
    font_size: float = 9.5,
    margin: float = 0.85,
    two_column: bool = False,
    scanned: bool = False,
    pages_of_padding: int = 0,
) -> bytes:
    """Render ``text`` into a real, text-extractable PDF and return its bytes.

    Parameters
    ----------
    two_column:
        Simulate a two-column layout (many lines with wide internal gaps) so the
        ATS single-column check can be asserted against.
    scanned:
        Emit an (almost) empty page — used to test the OCR/insufficient-text path.
    pages_of_padding:
        Append blank pages to push the document over the recommended page count.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=LETTER, title=title, author="ATS test suite",
        leftMargin=margin * inch, rightMargin=margin * inch,
        topMargin=margin * inch, bottomMargin=margin * inch,
    )
    styles = _styles()
    story: List = []

    if scanned:
        story.append(Spacer(1, 0.2 * inch))
        story.append(Paragraph("", styles["body"]))
    else:
        for raw_line in text.splitlines():
            line = raw_line.rstrip()
            if not line.strip():
                story.append(Spacer(1, 4))
                continue
            if two_column and len(line.split()) >= 4:
                words = line.split()
                midpoint = len(words) // 2
                line = " ".join(words[:midpoint]) + " " * 24 + " ".join(words[midpoint:])
            safe = (
                line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            )
            is_heading = line.isupper() or line.endswith((":", "—")) or " — " in line
            story.append(Paragraph(safe, styles["heading"] if is_heading else styles["body"]))

    for _ in range(max(0, pages_of_padding)):
        story.append(Spacer(1, 9 * inch))

    doc.build(story)
    return buffer.getvalue()


def sample_resume_pdf(**kwargs) -> bytes:
    """Text-extractable PDF of :data:`SAMPLE_RESUME_TEXT`."""
    return build_pdf(SAMPLE_RESUME_TEXT, title="john_doe_resume.pdf", **kwargs)


def sample_jd_pdf(**kwargs) -> bytes:
    """Text-extractable PDF of :data:`SAMPLE_JD_TEXT`."""
    return build_pdf(SAMPLE_JD_TEXT, title="senior_ml_engineer_jd.pdf", **kwargs)


def unrelated_pair() -> tuple[bytes, bytes]:
    """Resume/JD PDFs with almost no overlap (low-score assertions)."""
    return (
        build_pdf(UNRELATED_RESUME_TEXT, title="nurse_resume.pdf"),
        build_pdf(UNRELATED_JD_TEXT, title="nurse_jd.pdf"),
    )


def corrupt_pdf() -> bytes:
    """Bytes that claim to be a PDF but cannot be parsed."""
    return b"%PDF-1.4\nthis is not a real pdf body\n%%EOF"


def oversized_payload(size_bytes: int = 11 * 1024 * 1024) -> bytes:
    """A ``.txt`` payload larger than the configured upload limit."""
    return b"a" * size_bytes


def text_bytes(text: str) -> bytes:
    return text.encode("utf-8")


__all__ = [
    "SAMPLE_RESUME_TEXT",
    "SAMPLE_JD_TEXT",
    "UNRELATED_RESUME_TEXT",
    "UNRELATED_JD_TEXT",
    "build_pdf",
    "sample_resume_pdf",
    "sample_jd_pdf",
    "unrelated_pair",
    "corrupt_pdf",
    "oversized_payload",
    "text_bytes",
]
