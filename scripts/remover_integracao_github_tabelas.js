const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

const RESUMO = [];

async function colunaExiste(conn, tabela, coluna) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabela, coluna]
  );
  return rows.length > 0;
}

async function tabelaExiste(conn, tabela) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tabela]
  );
  return rows.length > 0;
}

async function indiceExiste(conn, tabela, indice) {
  const [rows] = await conn.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tabela, indice]
  );
  return rows.length > 0;
}

async function removerTabela(conn, tabela) {
  if (await tabelaExiste(conn, tabela)) {
    await conn.query(`DROP TABLE IF EXISTS \`${tabela}\``);
    RESUMO.push(`- tabela ${tabela} removida com sucesso`);
  } else {
    RESUMO.push(`= tabela ${tabela} não existia no banco`);
  }
}

async function removerColuna(conn, tabela, coluna) {
  if (await colunaExiste(conn, tabela, coluna)) {
    await conn.query(`ALTER TABLE \`${tabela}\` DROP COLUMN \`${coluna}\``);
    RESUMO.push(`- coluna ${tabela}.${coluna} removida`);
  } else {
    RESUMO.push(`= coluna ${tabela}.${coluna} não existia`);
  }
}

async function removerIndice(conn, tabela, indice) {
  if (await indiceExiste(conn, tabela, indice)) {
    await conn.query(`ALTER TABLE \`${tabela}\` DROP INDEX \`${indice}\``);
    RESUMO.push(`- índice ${tabela}.${indice} removido`);
  } else {
    RESUMO.push(`= índice ${tabela}.${indice} não existia`);
  }
}

(async () => {
  const config = {
    host: process.env.BD_SERVIDOR,
    port: Number(process.env.BD_PORTA || 3306),
    user: process.env.BD_USUARIO,
    password: process.env.BD_SENHA,
    database: process.env.BD_BANCO,
  };

  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log("Conectado ao banco de dados.");

    // 1. Dropar tabelas do GitHub / PRs / Commits / Webhooks
    await removerTabela(conn, "github_commits");
    await removerTabela(conn, "github_pull_requests");
    await removerTabela(conn, "github_webhook_deliveries");
    await removerTabela(conn, "reputacao_tecnica_usuario");

    // 2. Limpar colunas em tarefas
    // Garantir índice individual em projeto_id para a Foreign Key antes de remover o composto
    if (!(await indiceExiste(conn, "tarefas", "idx_tarefas_projeto_id"))) {
      await conn.query("ALTER TABLE `tarefas` ADD INDEX `idx_tarefas_projeto_id` (`projeto_id`)");
      RESUMO.push("+ índice tarefas.idx_tarefas_projeto_id criado");
    }
    await removerIndice(conn, "tarefas", "idx_tarefas_projeto_github_branch");
    await removerColuna(conn, "tarefas", "github_branch");
    await removerColuna(conn, "tarefas", "github_pr_number");
    await removerColuna(conn, "tarefas", "github_pr_id");
    await removerColuna(conn, "tarefas", "github_pr_url");
    await removerColuna(conn, "tarefas", "github_pr_status");
    await removerColuna(conn, "tarefas", "github_last_activity_at");
    await removerColuna(conn, "tarefas", "concluida_via");

    // 3. Limpar colunas em projetos
    await removerColuna(conn, "projetos", "github_repository_id");
    await removerColuna(conn, "projetos", "github_repository_full_name");
    await removerColuna(conn, "projetos", "github_installation_id");
    await removerColuna(conn, "projetos", "github_default_branch");
    await removerColuna(conn, "projetos", "github_connected_at");

    console.log("\n--- RESUMO DA LIMPEZA NO BANCO ---");
    RESUMO.forEach((r) => console.log(r));
    console.log("----------------------------------");
    console.log("Limpeza no banco concluída com sucesso!");
  } catch (error) {
    console.error("Erro durante a migração de limpeza:", error);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
