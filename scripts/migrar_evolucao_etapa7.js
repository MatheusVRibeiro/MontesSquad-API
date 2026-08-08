// Migração segura — Evolução de produto ETAPA 7 (tasks com habilidades e dificuldade)
// Aditiva e idempotente: consulta INFORMATION_SCHEMA antes de CREATE/ALTER.
//
// Alterações:
//   1. Tabela habilidades_tarefa (PK composta tarefa_id + habilidade_id, FKs CASCADE
//      para tarefas(id) e habilidades(id)) — permite recomendar/filtrar tasks por
//      habilidade (ETAPA 16/17).
//   2. Coluna tarefas.dificuldade ENUM('iniciante','intermediaria','avancada')
//      DEFAULT 'intermediaria' — conhecimento esperado da task.
//
// Contrato no controller src/controllers/tarefas.js:
//   - criarTarefa/atualizarTarefa aceitam dificuldade + habilidades (array de ids);
//   - listarTarefas/atualizarTarefa retornam dificuldade + habilidades (array de nomes).
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

async function colunaExiste(conn, tabela, coluna) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.BD_BANCO, tabela, coluna]
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

  // 1. Tabela habilidades_tarefa (idempotente)
  if (await tabelaExiste(conn, "habilidades_tarefa")) {
    console.log("[migrar_evolucao_etapa7] tabela habilidades_tarefa já existe — nada a fazer");
  } else {
    await conn.query(`
      CREATE TABLE habilidades_tarefa (
          tarefa_id INT NOT NULL,
          habilidade_id INT NOT NULL,
          PRIMARY KEY (tarefa_id, habilidade_id),
          FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
          FOREIGN KEY (habilidade_id) REFERENCES habilidades(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log("[migrar_evolucao_etapa7] tabela habilidades_tarefa criada");
  }

  // 2. Coluna tarefas.dificuldade (idempotente)
  if (await colunaExiste(conn, "tarefas", "dificuldade")) {
    console.log("[migrar_evolucao_etapa7] coluna tarefas.dificuldade já existe — nada a fazer");
  } else {
    await conn.query(
      "ALTER TABLE tarefas ADD COLUMN dificuldade ENUM('iniciante','intermediaria','avancada') DEFAULT 'intermediaria'"
    );
    console.log("[migrar_evolucao_etapa7] coluna tarefas.dificuldade adicionada");
  }

  // Relatório final
  const [vinculos] = await conn.query("SELECT COUNT(*) AS total FROM habilidades_tarefa");
  const [tarefas] = await conn.query(
    "SELECT COUNT(*) AS total FROM tarefas WHERE dificuldade IS NOT NULL"
  );
  console.log(
    `[migrar_evolucao_etapa7] habilidades_tarefa=${vinculos[0].total} tarefas_com_dificuldade=${tarefas[0].total}`
  );

  await conn.end();
  console.log("[migrar_evolucao_etapa7] OK");
}

main().catch((e) => {
  console.error("[migrar_evolucao_etapa7] ERRO:", e.message);
  process.exit(1);
});
