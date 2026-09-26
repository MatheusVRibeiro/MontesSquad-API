const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

const SKILLS_TO_SEED = [
  // Frontend
  "React",
  "Next.js",
  "Vue.js",
  "Angular",
  "TypeScript",
  "JavaScript",
  "HTML/CSS",
  "Tailwind CSS",
  // Backend
  "Node.js",
  "Python",
  "Java",
  "C#",
  "Go",
  "PHP",
  "Ruby",
  "Rust",
  "Spring Boot",
  ".NET",
  // Mobile
  "Flutter",
  "React Native",
  "Kotlin",
  "Swift",
  // Dados & Banco
  "SQL",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  // DevOps & Cloud
  "Docker",
  "Kubernetes",
  "DevOps",
  "AWS",
  "Azure",
  "GCP",
  "Linux",
  "CI/CD",
  // Design, QA & Gestão
  "UI/UX",
  "Figma",
  "QA",
  "Scrum",
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.BD_SERVIDOR,
    port: Number(process.env.BD_PORTA || 3306),
    user: process.env.BD_USUARIO,
    password: process.env.BD_SENHA,
    database: process.env.BD_BANCO,
  });

  console.log("[migracao] Conectado ao MySQL");

  const [existing] = await conn.query("SELECT nome FROM habilidades");
  const existingNames = new Set(existing.map((row) => row.nome.trim().toLowerCase()));

  let insertedCount = 0;
  for (const skill of SKILLS_TO_SEED) {
    if (!existingNames.has(skill.trim().toLowerCase())) {
      await conn.query("INSERT INTO habilidades (nome) VALUES (?)", [skill]);
      existingNames.add(skill.trim().toLowerCase());
      insertedCount++;
    }
  }

  console.log(`[migracao] ${insertedCount} novas habilidades inseridas na base global.`);
  const [total] = await conn.query("SELECT COUNT(*) as count FROM habilidades");
  console.log(`[migracao] Total de habilidades disponíveis: ${total[0].count}`);

  await conn.end();
}

main().catch((err) => {
  console.error("[migracao] Erro:", err.message);
  process.exit(1);
});
