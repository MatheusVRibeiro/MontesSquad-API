// Migração segura — Integração GitHub (ETAPA 1)
// Aditiva e idempotente: consulta INFORMATION_SCHEMA antes de adicionar
// coluna/índice/tabela; nunca apaga dados.
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

async function adicionarColuna(conn, tabela, definicao, coluna) {
  if (await colunaExiste(conn, tabela, coluna)) {
    RESUMO.push(`= coluna ${tabela}.${coluna} já existe`);
    return;
  }
  await conn.query(`ALTER TABLE ${tabela} ADD COLUMN ${definicao}`);
  RESUMO.push(`+ coluna ${tabela}.${coluna} adicionada`);
}

async function criarTabela(conn, nome, sql) {
  if (await tabelaExiste(conn, nome)) {
    RESUMO.push(`= tabela ${nome} já existe`);
    return;
  }
  await conn.query(sql);
  RESUMO.push(`+ tabela ${nome} criada`);
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
    console.log("Conectado ao banco remoto.");

    // ---- 7.1 usuarios ----
    await adicionarColuna(conn, "usuarios", "github_user_id BIGINT NULL", "github_user_id");
    await adicionarColuna(conn, "usuarios", "github_login VARCHAR(100) NULL", "github_login");
    await adicionarColuna(conn, "usuarios", "github_avatar_url VARCHAR(500) NULL", "github_avatar_url");
    await adicionarColuna(conn, "usuarios", "github_connected_at DATETIME NULL", "github_connected_at");
    // unique em github_user_id quando não nulo (MySQL não aceita UNIQUE com múltiplos NULL? aceita — NULL não conflita)
    const [idxUser] = await conn.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND INDEX_NAME = 'uq_usuarios_github_user_id'`
    );
    if (idxUser.length === 0) {
      await conn.query("ALTER TABLE usuarios ADD UNIQUE INDEX uq_usuarios_github_user_id (github_user_id)");
      RESUMO.push("+ índice único uq_usuarios_github_user_id");
    } else {
      RESUMO.push("= índice uq_usuarios_github_user_id já existe");
    }

    // ---- 7.2 projetos ----
    await adicionarColuna(conn, "projetos", "github_repository_id BIGINT NULL", "github_repository_id");
    await adicionarColuna(conn, "projetos", "github_repository_full_name VARCHAR(255) NULL", "github_repository_full_name");
    await adicionarColuna(conn, "projetos", "github_installation_id BIGINT NULL", "github_installation_id");
    await adicionarColuna(conn, "projetos", "github_default_branch VARCHAR(255) NULL", "github_default_branch");
    await adicionarColuna(conn, "projetos", "github_connected_at DATETIME NULL", "github_connected_at");

    // ---- 7.3 tarefas: enum + colunas ----
    const [enumRows] = await conn.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tarefas' AND COLUMN_NAME = 'status'`
    );
    const tipoAtual = enumRows[0]?.COLUMN_TYPE || "";
    if (!tipoAtual.includes("review")) {
      await conn.query(
        "ALTER TABLE tarefas MODIFY COLUMN status ENUM('todo','doing','review','done') DEFAULT 'todo' NOT NULL"
      );
      RESUMO.push("+ enum tarefas.status inclui 'review'");
    } else {
      RESUMO.push("= enum tarefas.status já inclui 'review'");
    }
    await adicionarColuna(conn, "tarefas", "github_branch VARCHAR(255) NULL", "github_branch");
    await adicionarColuna(conn, "tarefas", "github_pr_number INT NULL", "github_pr_number");
    await adicionarColuna(conn, "tarefas", "github_pr_id BIGINT NULL", "github_pr_id");
    await adicionarColuna(conn, "tarefas", "github_pr_url VARCHAR(500) NULL", "github_pr_url");
    await adicionarColuna(conn, "tarefas", "github_pr_status ENUM('none','open','closed','merged') DEFAULT 'none'", "github_pr_status");
    await adicionarColuna(conn, "tarefas", "github_last_activity_at DATETIME NULL", "github_last_activity_at");
    await adicionarColuna(conn, "tarefas", "concluida_via ENUM('manual','github_merge') NULL", "concluida_via");
    await adicionarColuna(conn, "tarefas", "concluida_em DATETIME NULL", "concluida_em");
    await adicionarColuna(conn, "tarefas", "assumida_em DATETIME NULL", "assumida_em");
    // índice
    const [idxTarefa] = await conn.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tarefas' AND INDEX_NAME = 'idx_tarefas_projeto_github_branch'`
    );
    if (idxTarefa.length === 0) {
      await conn.query("ALTER TABLE tarefas ADD INDEX idx_tarefas_projeto_github_branch (projeto_id, github_branch)");
      RESUMO.push("+ índice idx_tarefas_projeto_github_branch");
    } else {
      RESUMO.push("= índice idx_tarefas_projeto_github_branch já existe");
    }

    // ---- 7.4 github_commits ----
    await criarTabela(conn, "github_commits", `
      CREATE TABLE github_commits (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        tarefa_id INT NOT NULL,
        projeto_id INT NOT NULL,
        repository_id BIGINT NOT NULL,
        sha VARCHAR(64) NOT NULL,
        message TEXT NULL,
        author_github_id BIGINT NULL,
        author_login VARCHAR(100) NULL,
        author_name VARCHAR(255) NULL,
        author_email VARCHAR(255) NULL,
        branch VARCHAR(255) NULL,
        commit_url VARCHAR(500) NULL,
        committed_at DATETIME NULL,
        recebido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_github_commit_repo_sha (repository_id, sha),
        INDEX idx_github_commit_tarefa (tarefa_id),
        INDEX idx_github_commit_projeto (projeto_id),
        INDEX idx_github_commit_author (author_github_id),
        FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
        FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    // ---- 7.5 github_pull_requests ----
    await criarTabela(conn, "github_pull_requests", `
      CREATE TABLE github_pull_requests (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        tarefa_id INT NOT NULL,
        projeto_id INT NOT NULL,
        repository_id BIGINT NOT NULL,
        github_pr_id BIGINT NOT NULL,
        numero INT NOT NULL,
        titulo VARCHAR(500) NULL,
        url VARCHAR(500) NULL,
        head_branch VARCHAR(255) NULL,
        base_branch VARCHAR(255) NULL,
        author_github_id BIGINT NULL,
        author_login VARCHAR(100) NULL,
        estado ENUM('open','closed','merged') NOT NULL,
        aberto_em DATETIME NULL,
        fechado_em DATETIME NULL,
        mergeado_em DATETIME NULL,
        atualizado_em DATETIME NULL,
        UNIQUE KEY uq_github_pr_repo_numero (repository_id, numero),
        FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
        FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    // ---- 7.6 github_webhook_deliveries ----
    await criarTabela(conn, "github_webhook_deliveries", `
      CREATE TABLE github_webhook_deliveries (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        delivery_id VARCHAR(100) NOT NULL,
        event_name VARCHAR(100) NOT NULL,
        action_name VARCHAR(100) NULL,
        repository_id BIGINT NULL,
        processado BOOLEAN DEFAULT FALSE,
        erro TEXT NULL,
        recebido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processado_em DATETIME NULL,
        UNIQUE KEY uq_github_delivery (delivery_id)
      ) ENGINE=InnoDB
    `);

    // ---- 7.7 eventos_xp ----
    await criarTabela(conn, "eventos_xp", `
      CREATE TABLE eventos_xp (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        tarefa_id INT NULL,
        tipo VARCHAR(100) NOT NULL,
        xp INT NOT NULL,
        chave_idempotencia VARCHAR(255) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eventos_xp_chave (chave_idempotencia),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    console.log(RESUMO.join("\n"));
    console.log("Migração GitHub (ETAPA 1) concluída com sucesso.");
  } catch (e) {
    console.error("ERRO na migração:", e.message);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();