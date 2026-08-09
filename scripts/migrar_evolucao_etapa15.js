// Migração segura — Evolução de produto ETAPA 15 (Timeline de atividade do projeto)
// Aditiva e idempotente: SHOW TABLES antes de CREATE TABLE IF NOT EXISTS.
//
// Alterações:
//   1. Tabela eventos_projeto — histórico legível das principais ações do squad
//      (visão de produto para usuários; NÃO substitui logs técnicos).
//      Disparada em src/services/eventosProjeto.js (registrarEvento, best-effort
//      — nunca derruba o fluxo principal) a partir dos pontos reais:
//        - candidaturas.js (membro_entrou ao aceitar candidatura)
//        - projetos.js    (membro_entrou — criador vira membro)
//        - membros.js     (membro_saiu — removerMembro/sairDoProjeto)
//        - tarefas.js     (task_criada / task_assumida / task_abandonada / task_concluida)
//        - githubTasks.js (task_concluida por merge de PR)
//        - githubEvents.js(commit_detectado / pr_aberto / pr_mergeado)
//      Endpoint: GET /projetos/:projetoId/eventos (membro/dono).
//
//   2. Tipos de evento: membro_entrou, membro_saiu, task_criada, task_assumida,
//      task_abandonada, commit_detectado, pr_aberto, pr_mergeado, task_concluida,
//      reavaliacao (este último é suportado pelo service mas NÃO tem disparo
//      automático — não existe fluxo de reavaliação no produto ainda).
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function tabelaExiste(conn, tabela) {
  const [rows] = await conn.query("SHOW TABLES LIKE ?", [tabela]);
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

  // 1. Tabela eventos_projeto (idempotente)
  if (await tabelaExiste(conn, "eventos_projeto")) {
    console.log("[migrar_evolucao_etapa15] tabela eventos_projeto já existe — nada a fazer");
  } else {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS eventos_projeto (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          projeto_id INT NOT NULL,
          usuario_id INT NULL,
          tipo VARCHAR(100) NOT NULL,
          entidade_tipo VARCHAR(50) NULL,
          entidade_id VARCHAR(100) NULL,
          titulo VARCHAR(255) NOT NULL,
          metadados JSON NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
    console.log("[migrar_evolucao_etapa15] tabela eventos_projeto criada");
  }

  // 2. Relatório — distribuição de eventos por tipo
  const [[{ totalEventos }]] = await conn.query(
    "SELECT COUNT(*) AS totalEventos FROM eventos_projeto"
  );
  const [porTipo] = await conn.query(
    "SELECT tipo, COUNT(*) AS total FROM eventos_projeto GROUP BY tipo ORDER BY total DESC"
  );
  const resumo = porTipo.map((r) => `${r.tipo}=${r.total}`).join(" | ") || "(sem eventos)";
  console.log(`[migrar_evolucao_etapa15] eventos_projeto=${totalEventos} | ${resumo}`);

  await conn.end();
  console.log("[migrar_evolucao_etapa15] OK");
}

main().catch((e) => {
  console.error("[migrar_evolucao_etapa15] ERRO:", e.message);
  process.exit(1);
});
