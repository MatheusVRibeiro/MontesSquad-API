// Migração segura — Evolução de produto ETAPA 4 (papéis/vagas necessárias no projeto)
// Aditiva e idempotente: consulta INFORMATION_SCHEMA antes de CREATE.
//
// Tabela nova:
//   vagas_projeto (id, projeto_id FK CASCADE, funcao_id FK RESTRICT → funcoes,
//   quantidade INT DEFAULT 1, preenchidas INT DEFAULT 0, descricao TEXT NULL,
//   nivel_desejado ENUM('iniciante','intermediario','avancado','qualquer') DEFAULT 'qualquer',
//   status ENUM('aberta','fechada') DEFAULT 'aberta', criado_em)
//
// Regras de negócio (validadas no controller src/controllers/vagasProjeto.js):
//   - quantidade > 0;
//   - preenchidas <= quantidade;
//   - DELETE bloqueado enquanto preenchidas > 0 (409).
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function tabelaExiste(conn, tabela) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [process.env.BD_BANCO, tabela]
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

  // 1. Tabela vagas_projeto (idempotente)
  if (await tabelaExiste(conn, "vagas_projeto")) {
    console.log("[migrar_evolucao_etapa4] tabela vagas_projeto já existe — nada a fazer");
  } else {
    await conn.query(`
      CREATE TABLE vagas_projeto (
        id INT AUTO_INCREMENT PRIMARY KEY,
        projeto_id INT NOT NULL,
        funcao_id INT NOT NULL,
        quantidade INT NOT NULL DEFAULT 1,
        preenchidas INT NOT NULL DEFAULT 0,
        descricao TEXT NULL,
        nivel_desejado ENUM('iniciante','intermediario','avancado','qualquer') DEFAULT 'qualquer',
        status ENUM('aberta','fechada') DEFAULT 'aberta',
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
        FOREIGN KEY (funcao_id) REFERENCES funcoes(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);
    console.log("[migrar_evolucao_etapa4] tabela vagas_projeto criada");
  }

  // Relatório final
  const [total] = await conn.query("SELECT COUNT(*) AS total FROM vagas_projeto");
  console.log(`[migrar_evolucao_etapa4] vagas cadastradas=${total[0].total}`);

  await conn.end();
  console.log("[migrar_evolucao_etapa4] OK");
}

main().catch((e) => {
  console.error("[migrar_evolucao_etapa4] ERRO:", e.message);
  process.exit(1);
});
