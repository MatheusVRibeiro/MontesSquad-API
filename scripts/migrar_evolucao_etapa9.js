// Migração segura — Evolução de produto ETAPA 9 (histórico de responsáveis de tarefa)
// Aditiva e idempotente: consulta INFORMATION_SCHEMA antes de CREATE.
//
// Alterações:
//   1. Tabela historico_responsaveis_tarefa — registra toda troca de responsável
//      (assumiu/abandonou/removido/reatribuido/concluiu), preservando a evidência
//      de contribuição anterior (critério de aceite da ETAPA 9: "Nenhuma troca de
//      responsável apaga evidência de contribuição anterior").
//
// Contrato no controller src/controllers/tarefas.js:
//   - assumirTarefa registra acao='assumiu' após assumir;
//   - abandonarTarefa registra acao='abandonou' (responsável atual);
//   - removerResponsavelTarefa registra acao='removido' (owner);
//   - reatribuirTarefa registra acao='reatribuido' (owner);
//   - historicoResponsaveisTarefa lista o histórico com JOIN em usuarios.
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

  // 1. Tabela historico_responsaveis_tarefa (idempotente)
  if (await tabelaExiste(conn, "historico_responsaveis_tarefa")) {
    console.log("[migrar_evolucao_etapa9] tabela historico_responsaveis_tarefa já existe — nada a fazer");
  } else {
    await conn.query(`
      CREATE TABLE historico_responsaveis_tarefa (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          tarefa_id INT NOT NULL,
          usuario_id INT NOT NULL,
          acao ENUM('assumiu','abandonou','removido','reatribuido','concluiu') NOT NULL,
          realizado_por INT NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
          FOREIGN KEY (realizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
    console.log("[migrar_evolucao_etapa9] tabela historico_responsaveis_tarefa criada");
  }

  // Relatório final
  const [count] = await conn.query(
    "SELECT COUNT(*) AS total FROM historico_responsaveis_tarefa"
  );
  console.log(`[migrar_evolucao_etapa9] historico_responsaveis_tarefa=${count[0].total}`);

  await conn.end();
  console.log("[migrar_evolucao_etapa9] OK");
}

main().catch((e) => {
  console.error("[migrar_evolucao_etapa9] ERRO:", e.message);
  process.exit(1);
});
