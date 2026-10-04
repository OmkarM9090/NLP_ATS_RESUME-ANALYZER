/* Built-in sample resume + job description, run through the real NLP
 * pipeline so users can try the full experience without a PDF handy. */

export const SAMPLE_RESUME_FILENAME = "jordan-hayes-resume.pdf";
export const SAMPLE_JD_FILENAME = "senior-fullstack-engineer-jd.pdf";

export const SAMPLE_RESUME_TEXT = `Jordan Hayes
Austin, TX
jordan.hayes@email.com | (512) 555-0147 | linkedin.com/in/jordanhayes | github.com/jhayes

PROFESSIONAL SUMMARY
Senior Software Engineer with 7+ years of experience building scalable web applications and distributed systems. Deep expertise in React, TypeScript, Node.js, and PostgreSQL, with a track record of shipping high-traffic products and leading cross-functional teams. Passionate about performance optimization, clean system design, and mentoring engineers.

WORK EXPERIENCE

Senior Software Engineer | Cloudscale Systems Inc — Austin, TX
January 2021 - Present
• Led development of a customer analytics platform serving 2M+ monthly active users using React, Next.js, TypeScript, and Node.js, improving page load performance by 45%.
• Architected microservices on AWS (EC2, S3, Lambda) with Docker and CI/CD pipelines in GitHub Actions, cutting deploy time from 40 minutes to 6 minutes.
• Designed PostgreSQL schemas and Redis caching strategies supporting 3x traffic growth with zero downtime.
• Built GraphQL APIs consumed by web and mobile clients; wrote REST API integrations for Stripe and Salesforce.
• Mentored 5 junior engineers through code review and pair programming; introduced unit testing and e2e testing with Jest and Playwright, raising coverage to 85%.

Software Engineer | Databright Analytics — Austin, TX
June 2018 - December 2020
• Developed real-time data visualization dashboards in React and D3.js used by 200+ enterprise customers.
• Implemented data pipelines in Python and Apache Airflow processing 50GB of event data daily.
• Built Node.js/Express backend services and MySQL data models; migrated legacy jQuery frontend to React 16.
• Collaborated in agile scrum sprints with product management to ship 24 releases per year.

Junior Web Developer | Brightpath Digital — Remote
July 2017 - May 2018
• Shipped responsive marketing sites and component libraries with HTML, CSS, JavaScript, and accessibility (WCAG) best practices.
• Automated image optimization and build tooling with Bash and GitHub Actions, reducing bundle size 30%.

EDUCATION
B.S. Computer Science, University of Texas at Austin, 2017

SKILLS
Languages: TypeScript, JavaScript, Python, SQL, HTML/CSS, Bash
Frameworks: React, Next.js, Node.js, Express, GraphQL, Redux, Jest, Playwright
Cloud & DevOps: AWS, Docker, CI/CD, GitHub Actions, Linux, Nginx, Monitoring (Datadog, Grafana)
Data: PostgreSQL, MySQL, Redis, Prisma, Data Visualization
Practices: System Design, REST APIs, Agile, Git, Testing, Performance Optimization, Mentoring

CERTIFICATIONS
AWS Certified Developer - Associate (2022)

PROJECTS
Open-source contributor to Next.js; built a telemetry plugin adopted by 1.2k projects.
Creator of "shipstat", a deployment analytics CLI with 3k GitHub stars.`;

export const SAMPLE_JD_TEXT = `Senior Full-Stack Engineer - Platform Team

Meridian Technologies Inc — Remote (US)

About the role
We are looking for a Senior Full-Stack Engineer to help build the next generation of our B2B SaaS platform, serving millions of users globally. You will work across our TypeScript stack, design distributed systems, and raise the bar for reliability and developer experience. This is a senior individual-contributor role with strong technical leadership expectations.

Responsibilities
• Design and ship end-to-end features using React, Next.js, TypeScript, and Node.js on AWS.
• Architect scalable microservices and event-driven systems with Kubernetes, Kafka, and Terraform.
• Own system design for high-availability services processing billions of requests per month.
• Build and maintain GraphQL and REST APIs, with strong API design discipline.
• Model data in PostgreSQL, tune queries, and manage Redis caching layers.
• Drive performance optimization, observability, and monitoring across the platform (Datadog, Grafana).
• Champion testing practices: unit testing, integration testing, and e2e testing with Playwright.
• Mentor engineers, lead code reviews, and collaborate with product management in agile scrum.
• Contribute to CI/CD pipelines and infrastructure as code.

Requirements
• 5+ years of professional software engineering experience.
• Bachelor's degree in Computer Science or equivalent practical experience.
• Strong expertise in TypeScript, React, Next.js, and Node.js.
• Production experience with AWS, Docker, and Kubernetes.
• Experience with PostgreSQL, Redis, and distributed systems design.
• Solid understanding of CI/CD, Git, and agile methodologies.
• Excellent communication, ownership, and problem solving skills.

Preferred qualifications
• Experience with Go, Terraform, and Apache Kafka.
• Familiarity with machine learning pipelines or generative AI integrations.
• Contributions to open-source projects.

What we offer
• Competitive salary and equity, remote-first culture, unlimited PTO, and a $3,000 annual learning budget.`;
