// Migração segura — Evolução de produto ETAPA 12 (separar XP de reputação técnica)
// Aditiva e idempotente: consulta INFORMATION_SCHEMA antes de CREATE TABLE.
//
// Alterações:
//   1. Tabela reputacao_tecnica_usuario — reputação técnica (evidência de entrega)
//      separada do XP (gamificação/engajamento). O score é calculado SEMPRE pelo
//      backend (src/services/reputacaoTecnica.js), nunca pelo frontend.
//
//      Fórmula ponderada (pesos documentados no service — o service é o ÚNICO
//      lugar autoritativo da pontuação; esta migração usa a MESMA fórmula para o
//      backfill inicial):
//        score = tasks_verificadas * 50
//              + prs_mergeados      * 30
//              + commits_validos    * 1
//              + projetos_com_entrega * 20
//
//   2. Backfill — preenche github_commits.author_github_id a partir do login do
//      autor (match com usuarios.github_login, best-effort). Sem isso, commits
//      registrados ANTES da ETAPA 12 nunca contariam como commits_validos.
//   3. Backfill — recalcula a reputação de TODOS os usuários com evidência no
//      banco (mesma fórmula do service), para o score inicial não ficar zerado
//      até o próximo evento (merge/conclusão).
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

// Mesmos pesos do service (src/services/reputacaoTecnica.js)
const PESOS = { TASK: 50, PR: 30, COMMIT: 1, PROJETO: 20 };

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

  // 1. Tabela reputacao_tecnica_usuario (idempotente)
  if (await tabelaExiste(conn, "reputacao_tecnica_usuario")) {
    console.log("[migrar_evolucao_etapa12] tabela reputacao_tecnica_usuario já existe — nada a fazer");
  } else {
    await conn.query(`
      CREATE TABLE reputacao_tecnica_usuario (
          usuario_id INT PRIMARY KEY,
          score DECIMAL(10,2) DEFAULT 0,
          tasks_verificadas INT DEFAULT 0,
          prs_mergeados INT DEFAULT 0,
          commits_validos INT DEFAULT 0,
          projetos_com_entrega INT DEFAULT 0,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log("[migrar_evolucao_etapa12] tabela reputacao_tecnica_usuario criada");
  }

  // 2. Backfill — commits antigos sem author_github_id (match por login, best-effort)
  const [enriquecidos] = await conn.query(
    `UPDATE github_commits gc
     JOIN usuarios u ON u.github_login = gc.author_login
     SET gc.author_github_id = u.github_user_id
     WHERE gc.author_github_id IS NULL AND u.github_user_id IS NOT NULL`
  );
  console.log(`[migrar_evolucao_etapa12] github_commits com author_github_id preenchido (match login)=${enriquecidos.affectedRows}`);

  // 3. Backfill — reputação de todos os usuários com evidência (mesma fórmula do service)
  await conn.query(`
    INSERT INTO reputacao_tecnica_usuario
      (usuario_id, tasks_verificadas, prs_mergeados, commits_validos, projetos_com_entrega, score)
    SELECT
      u.id,
      COALESCE(tv.total, 0),
      COALESCE(pr.total, 0),
      COALESCE(cc.total, 0),
      COALESCE(pe.total, 0),
      COALESCE(tv.total, 0) * ${PESOS.TASK}
      + COALESCE(pr.total, 0) * ${PESOS.PR}
      + COALESCE(cc.total, 0) * ${PESOS.COMMIT}
      + COALESCE(pe.total, 0) * ${PESOS.PROJETO}
    FROM usuarios u
    LEFT JOIN (
      SELECT responsavel_id AS uid, COUNT(*) AS total
      FROM tarefas WHERE concluida_via = 'github_merge'
      GROUP BY responsavel_id
    ) tv ON tv.uid = u.id
    LEFT JOIN (
      SELECT t.responsavel_id AS uid, COUNT(*) AS total
      FROM github_pull_requests pr
      JOIN tarefas t ON t.id = pr.tarefa_id
      WHERE pr.estado = 'merged'
      GROUP BY t.responsavel_id
    ) pr ON pr.uid = u.id
    LEFT JOIN (
      SELECT author_github_id AS gid, COUNT(*) AS total
      FROM github_commits WHERE author_github_id IS NOT NULL
      GROUP BY author_github_id
    ) cc ON cc.gid = u.github_user_id
    LEFT JOIN (
      SELECT responsavel_id AS uid, COUNT(DISTINCT projeto_id) AS total
      FROM tarefas WHERE concluida_via = 'github_merge'
      GROUP BY responsavel_id
    ) pe ON pe.uid = u.id
    WHERE COALESCE(tv.total, 0) + COALESCE(pr.total, 0) + COALESCE(cc.total, 0) + COALESCE(pe.total, 0) > 0
  `);
  console.log("[migrar_evolucao_etapa12] backfill de reputação concluído (INSERT ... SELECT)");

  // 4. Relatório
  const [[{ total }]] = await conn.query("SELECT COUNT(*) AS total FROM reputacao_tecnica_usuario");
  const [[{ totalScore }]] = await conn.query(
    "SELECT COALESCE(SUM(score), 0) AS totalScore FROM reputacao_tecnica_usuario"
  );
  console.log(`[migrar_evolucao_etapa12] reputacao_tecnica_usuario=${total} | soma scores=${totalScore}`);

  await conn.end();
  console.log("[migrar_evolucao_etapa12] OK");
}

main().catch((e) => {
  console.error("[migrar_evolucao_etapa12] ERRO:", e.message);
  process.exit(1);
});
