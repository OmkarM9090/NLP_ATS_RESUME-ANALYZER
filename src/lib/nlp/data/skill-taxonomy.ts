/* ------------------------------------------------------------------
 * Curated skill taxonomy: category → canonical skill → aliases.
 * Used for structured skill matching with alias resolution.
 * ------------------------------------------------------------------ */

export type SkillTaxonomy = Record<string, Record<string, string[]>>;

export const SKILL_TAXONOMY: SkillTaxonomy = {
  programming_languages: {
    Python: ["python", "python3", "python 3", "py"],
    JavaScript: ["javascript", "js", "ecmascript", "es6", "es2015+"],
    TypeScript: ["typescript", "ts"],
    Java: ["java", "jdk", "j2ee"],
    "C++": ["c++", "cpp", "cplusplus"],
    Go: ["go", "golang"],
    Rust: ["rust", "rustlang"],
    Ruby: ["ruby", "rb", "ruby on rails", "rails"],
    "C#": ["c#", "csharp", "c sharp", ".net", "dotnet", ".net core"],
    PHP: ["php"],
    Swift: ["swift", "swiftui"],
    Kotlin: ["kotlin"],
    R: ["r language", "r programming", "r statistical", "rstudio"],
    SQL: ["sql", "structured query language", "t-sql", "pl/sql"],
    Scala: ["scala"],
    "HTML/CSS": ["html", "html5", "css", "css3", "sass", "scss", "less", "tailwind", "tailwind css", "tailwindcss"],
    Bash: ["bash", "shell scripting", "shell", "zsh"],
  },
  frameworks: {
    React: ["react", "reactjs", "react.js", "react js", "react native"],
    "Next.js": ["next.js", "nextjs", "next js"],
    Angular: ["angular", "angularjs", "angular.js", "angular 2+"],
    "Vue.js": ["vue", "vuejs", "vue.js", "nuxt", "nuxt.js"],
    Svelte: ["svelte", "sveltekit"],
    Django: ["django", "drf", "django rest framework"],
    Flask: ["flask"],
    FastAPI: ["fastapi", "fast api"],
    "Spring Boot": ["spring", "spring boot", "springboot", "spring mvc"],
    "Node.js": ["node", "nodejs", "node.js", "node js"],
    Express: ["express", "expressjs", "express.js"],
    Rails: ["ruby on rails"],
    Laravel: ["laravel"],
    TensorFlow: ["tensorflow", "tf", "tf keras", "keras"],
    PyTorch: ["pytorch", "torch"],
    "scikit-learn": ["sklearn", "scikit-learn", "scikit learn"],
    LangChain: ["langchain", "langgraph", "llamaindex"],
    Redux: ["redux", "redux toolkit", "zustand", "mobx"],
    GraphQL: ["graphql", "apollo", "apollo graphql"],
    "React Native": ["react native", "rn"],
  },
  cloud_devops: {
    AWS: ["aws", "amazon web services", "ec2", "s3", "lambda", "cloudformation", "ecs", "eks"],
    Azure: ["azure", "microsoft azure", "azure devops", "azure functions"],
    GCP: ["gcp", "google cloud", "google cloud platform", "bigquery", "gke"],
    Docker: ["docker", "containerization", "containers", "docker compose"],
    Kubernetes: ["kubernetes", "k8s", "helm"],
    Terraform: ["terraform", "iac", "infrastructure as code", "pulumi"],
    Jenkins: ["jenkins"],
    "GitHub Actions": ["github actions", "gh actions", "github workflows"],
    "CI/CD": ["ci/cd", "cicd", "ci cd", "continuous integration", "continuous deployment", "continuous delivery", "gitlab ci", "circleci"],
    Linux: ["linux", "ubuntu", "debian", "centos", "rhel"],
    Nginx: ["nginx", "apache httpd", "apache server"],
    Serverless: ["serverless", "aws lambda", "cloud functions", "lambda functions"],
    Monitoring: ["prometheus", "grafana", "datadog", "new relic", "cloudwatch", "observability", "elk", "splunk"],
  },
  databases: {
    PostgreSQL: ["postgresql", "postgres", "psql"],
    MySQL: ["mysql", "mariadb"],
    MongoDB: ["mongodb", "mongo", "mongoose"],
    Redis: ["redis", "memcached", "caching"],
    Elasticsearch: ["elasticsearch", "elastic", "opensearch"],
    DynamoDB: ["dynamodb", "dynamo", "aws dynamodb"],
    SQLite: ["sqlite", "sqlite3"],
    Supabase: ["supabase", "firebase", "firestore"],
    Prisma: ["prisma", "prisma orm", "drizzle", "typeorm", "sequelize", "sqlalchemy", "hibernate", "orm"],
    Cassandra: ["cassandra", "scylladb"],
    Kafka: ["kafka", "apache kafka", "rabbitmq", "message queue", "pub/sub"],
  },
  data_ml: {
    "Machine Learning": ["machine learning", "ml", "classical ml", "applied ml"],
    "Deep Learning": ["deep learning", "dl", "neural networks", "neural network", "cnn", "rnn", "transformers"],
    "Natural Language Processing": ["nlp", "natural language processing", "text mining", "spacy", "nltk", "tokenization", "named entity recognition", "text classification"],
    "Computer Vision": ["computer vision", "cv", "image recognition", "object detection", "opencv", "yolo", "image processing"],
    "Generative AI": ["generative ai", "genai", "llm", "llms", "large language models", "gpt", "openai", "prompt engineering", "rag", "retrieval augmented generation", "fine-tuning", "fine tuning", "embeddings", "vector database", "hugging face", "huggingface"],
    "Data Science": ["data science", "data analysis", "data analytics", "statistical analysis", "a/b testing", "experimentation"],
    Pandas: ["pandas"],
    NumPy: ["numpy"],
    "Apache Spark": ["spark", "apache spark", "pyspark", "databricks"],
    "Data Engineering": ["data pipeline", "data pipelines", "etl", "airflow", "dbt", "data warehouse", "data modeling", "snowflake", "big data"],
    MLOps: ["mlops", "model deployment", "model serving", "mlflow", " kubeflow", "feature store", "model monitoring"],
    "Data Visualization": ["tableau", "power bi", "powerbi", "matplotlib", "seaborn", "d3", "d3.js", "plotly", "looker"],
  },
  engineering_practices: {
    "System Design": ["system design", "distributed systems", "microservices", "microservice architecture", "event-driven", "domain-driven design", "ddd", "software architecture", "scalability", "high availability"],
    Testing: ["unit testing", "integration testing", "e2e testing", "tdd", "test-driven development", "jest", "vitest", "pytest", "cypress", "playwright", "testing", "qa", "test automation"],
    "REST APIs": ["rest", "rest api", "rest apis", "restful", "api design", "api development", "openapi", "swagger", "grpc", "websockets", "webhooks"],
    Security: ["oauth", "jwt", "authentication", "authorization", "security best practices", "owasp", "encryption", "sso", "saml", "iam", "penetration testing", "soc 2", "compliance"],
    Git: ["git", "github", "gitlab", "bitbucket", "version control", "code review"],
    Performance: ["performance optimization", "caching strategies", "load balancing", "horizontal scaling", "profiling", "latency optimization", "web performance"],
    Accessibility: ["accessibility", "a11y", "wcag", "aria", "inclusive design"],
    "Design Systems": ["design system", "design systems", "figma", "storybook", "component library", "ui/ux", "ux design", "ui design", "responsive design"],
  },
  soft_skills: {
    Leadership: ["leadership", "team lead", "led teams", "mentoring", "mentorship", "technical leadership", "staff engineer", "engineering management", "people management"],
    Communication: ["communication", "public speaking", "presentation skills", "stakeholder management", "cross-functional", "written communication", "verbal communication"],
    "Problem Solving": ["problem solving", "analytical thinking", "critical thinking", "troubleshooting", "root cause analysis", "debugging"],
    Agile: ["agile", "scrum", "kanban", "sprint planning", "sprints", "jira", "agile methodology", "safe"],
    "Project Management": ["project management", "program management", "pmp", "roadmap", "product management", "prioritization"],
    Ownership: ["ownership", "self-starter", "autonomous", "proactive", "initiative", "accountability"],
  },
};

/* ---- derived lookup structures (built once) ---- */

export interface SkillIndexEntry {
  canonical: string;
  category: string;
}

let aliasMap: Map<string, SkillIndexEntry> | null = null;

export function getAliasMap(): Map<string, SkillIndexEntry> {
  if (aliasMap) return aliasMap;
  aliasMap = new Map();
  for (const [category, skills] of Object.entries(SKILL_TAXONOMY)) {
    for (const [canonical, aliases] of Object.entries(skills)) {
      const entry = { canonical, category };
      aliasMap.set(canonical.toLowerCase(), entry);
      for (const a of aliases) {
        const key = a.toLowerCase().trim();
        if (key.length >= 2 && !aliasMap.has(key)) aliasMap.set(key, entry);
      }
    }
  }
  return aliasMap;
}

export function getCategoryFor(canonical: string): string {
  for (const [category, skills] of Object.entries(SKILL_TAXONOMY)) {
    if (canonical in skills) return category;
  }
  return "other";
}

export const ALL_CANONICAL_SKILLS: string[] = Object.values(
  SKILL_TAXONOMY,
).flatMap((s) => Object.keys(s));
