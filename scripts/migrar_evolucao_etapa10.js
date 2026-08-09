// Migração segura — Evolução de produto ETAPA 10 (histórico permanente de participação)
// Aditiva e idempotente: consulta INFORMATION_SCHEMA antes de ALTER TABLE.
//
// Alterações:
//   1. tarefas.excluida_em DATETIME NULL — soft-delete de tarefa. O controller
//      apagarTarefa troca o DELETE físico por:
//        UPDATE tarefas SET excluida_em = NOW() WHERE id = ? AND projeto_id = ?
//      A linha da tarefa (e todo o histórico vinculado por FK: subtarefas,
//      habilidades_tarefa, github_commits, github_pull_requests,
//      historico_responsaveis_tarefa, eventos_xp) permanece no banco — evidência
//      de contribuição nunca é apagada fisicamente.
//   2. listarTarefas passa a filtrar `excluida_em IS NULL` — tarefas arquivadas
//      somem do Kanban sem perder o histórico.
//
// Revisão ETAPA 10 (candidaturas / avaliacoes): NENHUMA mudança necessária.
//   - candidaturas.js: nenhum DELETE físico — candidaturas apenas mudam de status
//     via UPDATE ('pendente' -> 'aceito'/'rejeitado'). Candidatura rejeitada
//     permanece como evidência de tentativa.
//   - avaliacoes: nenhum DELETE físico em nenhum controller — reviews são
//     inseridas e listadas (reputacao.js), nunca apagadas.
//   - membros_equipe: já resolvido na ETAPA 6 (status 'ativo'/'saiu'/'removido'
//     + saiu_em — soft-delete, nunca DELETE físico).
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

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.BD_SERVIDOR,
    port: Number(process.env.BD_PORTA || 3306),
    user: process.env.BD_USUARIO,
    password: process.env.BD_SENHA,
    database: process.env.BD_BANCO,
  });

  // 1. tarefas.excluida_em (idempotente)
  if (await colunaExiste(conn, "tarefas", "excluida_em")) {
    console.log("[migrar_evolucao_etapa10] coluna tarefas.excluida_em já existe — nada a fazer");
  } else {
    await conn.query("ALTER TABLE tarefas ADD COLUMN excluida_em DATETIME NULL");
    console.log("[migrar_evolucao_etapa10] coluna tarefas.excluida_em criada (DATETIME NULL)");
  }

  // 2. Relatório — histórico preservado nas tabelas de participação
  const [[{ totalTarefas }]] = await conn.query("SELECT COUNT(*) AS totalTarefas FROM tarefas");
  const [[{ totalCandidaturas }]] = await conn.query("SELECT COUNT(*) AS totalCandidaturas FROM candidaturas");
  const [[{ totalAvaliacoes }]] = await conn.query("SELECT COUNT(*) AS totalAvaliacoes FROM avaliacoes");
  const [[{ totalMembrosInativos }]] = await conn.query(
    "SELECT COUNT(*) AS totalMembrosInativos FROM membros_equipe WHERE status != 'ativo'"
  );
  console.log(`[migrar_evolucao_etapa10] tarefas=${totalTarefas} | candidaturas=${totalCandidaturas} | avaliacoes=${totalAvaliacoes} | membros inativos(saiu/removido)=${totalMembrosInativos}`);

  await conn.end();
  console.log("[migrar_evolucao_etapa10] OK");
}

main().catch((e) => {
  console.error("[migrar_evolucao_etapa10] ERRO:", e.message);
  process.exit(1);
});
