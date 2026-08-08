// Migração segura — Evolução de produto ETAPA 5 (candidatura direcionada por vaga)
// Aditiva e idempotente: consulta INFORMATION_SCHEMA antes de ALTER.
//
// Alteração:
//   candidaturas.vaga_id INT NULL (FK → vagas_projeto.id ON DELETE SET NULL)
//   CONSTRAINT fk_candidaturas_vaga
//
// Regras de negócio (validadas no controller src/controllers/candidaturas.js):
//   - vaga informada deve pertencer ao projeto e estar aberta;
//   - aprovação de candidatura com vaga incrementa vagas_projeto.preenchidas
//     e fecha a vaga quando preenchidas >= quantidade.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function colunaExiste(conn, tabela, coluna) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.BD_BANCO, tabela, coluna]
  );
  return rows.length > 0;
}

async function fkExiste(conn, nomeFk) {
  const [rows] = await conn.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = ? AND CONSTRAINT_NAME = ? AND TABLE_NAME = 'candidaturas'`,
    [process.env.BD_BANCO, nomeFk]
  );
  return rows.length > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.BD_SERVIDOR,
    port: Number(process.env.BD_PORTA || 3306),
    user: process.env.BD_USUARIO,
    password: process.env.BD_SENHA,
    database: process.env.BD_BANCO,
  });

  // 1. Coluna candidaturas.vaga_id (idempotente)
  if (await colunaExiste(conn, "candidaturas", "vaga_id")) {
    console.log("[migrar_evolucao_etapa5] coluna candidaturas.vaga_id já existe — nada a fazer");
  } else {
    await conn.query(
      "ALTER TABLE candidaturas ADD COLUMN vaga_id INT NULL AFTER projeto_id"
    );
    console.log("[migrar_evolucao_etapa5] coluna candidaturas.vaga_id adicionada");
  }

  // 2. FK fk_candidaturas_vaga → vagas_projeto(id) ON DELETE SET NULL (idempotente)
  if (await fkExiste(conn, "fk_candidaturas_vaga")) {
    console.log("[migrar_evolucao_etapa5] FK fk_candidaturas_vaga já existe — nada a fazer");
  } else {
    await conn.query(
      "ALTER TABLE candidaturas ADD CONSTRAINT fk_candidaturas_vaga " +
        "FOREIGN KEY (vaga_id) REFERENCES vagas_projeto(id) ON DELETE SET NULL"
    );
    console.log("[migrar_evolucao_etapa5] FK fk_candidaturas_vaga criada");
  }

  // Relatório final
  const [total] = await conn.query(
    "SELECT COUNT(*) AS total FROM candidaturas WHERE vaga_id IS NOT NULL"
  );
  console.log(`[migrar_evolucao_etapa5] candidaturas com vaga vinculada=${total[0].total}`);

  await conn.end();
  console.log("[migrar_evolucao_etapa5] OK");
}

main().catch((e) => {
  console.error("[migrar_evolucao_etapa5] ERRO:", e.message);
  process.exit(1);
});