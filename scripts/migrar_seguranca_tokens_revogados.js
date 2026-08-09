// Migração segura — Segurança de sessão JWT (correção A1 + hardening da auditoria)
// Aditiva e idempotente: SHOW TABLES antes de CREATE TABLE IF NOT EXISTS e
// SHOW COLUMNS antes de cada ALTER TABLE.
//
// Alterações:
//   1. Tabela tokens_revogados — denylist de jti para o /logout (revogação
//      pontual de um token). jti é VARCHAR(64) (UUID v4 = 36 chars, folga
//      para formatos futuros); revogado_em registra quando o token morreu.
//   2. Coluna usuarios.token_versao INT NOT NULL DEFAULT 0 — versão da sessão
//      embutida no payload do JWT (jwt.sign). A troca de senha faz
//      token_versao = token_versao + 1 → TODOS os tokens emitidos antes
//      morrem (verificarToken compara payload.token_versao com o banco).
//
// Contrato no código:
//   - src/services/sessao.js — revogarToken(jti) / extrairJti(token)
//   - src/middlewares/auth.js — verificarToken checa denylist (se jti) e
//     token_versao (se presente no payload); exige exp + algorithms HS256
//   - src/controllers/autenticacao.js — POST /logout; login/resetarSenha
//   - src/controllers/usuarios.js — editarUsuario (troca de senha)
//   - src/controllers/githubAuth.js — gerarTokenLogin com jti/token_versao
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function tabelaExiste(conn, tabela) {
  const [rows] = await conn.query("SHOW TABLES LIKE ?", [tabela]);
  return rows.length > 0;
}

async function colunaExiste(conn, tabela, coluna) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${tabela}\` LIKE ?`, [coluna]);
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

  // 1. Tabela tokens_revogados (denylist de jti para o /logout)
  if (await tabelaExiste(conn, "tokens_revogados")) {
    console.log("[migrar_seguranca_tokens_revogados] tabela tokens_revogados já existe — nada a fazer");
  } else {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tokens_revogados (
          jti VARCHAR(64) NOT NULL PRIMARY KEY,
          revogado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    console.log("[migrar_seguranca_tokens_revogados] tabela tokens_revogados criada");
  }

  // 2. Coluna usuarios.token_versao (invalidação em massa na troca de senha)
  if (await colunaExiste(conn, "usuarios", "token_versao")) {
    console.log("[migrar_seguranca_tokens_revogados] coluna usuarios.token_versao já existe — nada a fazer");
  } else {
    await conn.query("ALTER TABLE usuarios ADD COLUMN token_versao INT NOT NULL DEFAULT 0");
    console.log("[migrar_seguranca_tokens_revogados] coluna usuarios.token_versao criada (INT NOT NULL DEFAULT 0)");
  }

  // 3. Relatório — estado atual da denylist e distribuição de token_versao
  const [[{ totalRevogados }]] = await conn.query("SELECT COUNT(*) AS totalRevogados FROM tokens_revogados");
  const [versoes] = await conn.query(
    "SELECT token_versao, COUNT(*) AS total FROM usuarios GROUP BY token_versao ORDER BY token_versao"
  );
  const resumo = versoes.map((r) => `v${r.token_versao}=${r.total}`).join(" | ") || "(sem usuários)";
  console.log(`[migrar_seguranca_tokens_revogados] tokens_revogados=${totalRevogados} | usuarios token_versao: ${resumo}`);

  await conn.end();
  console.log("[migrar_seguranca_tokens_revogados] OK");
}

main().catch((e) => {
  console.error("[migrar_seguranca_tokens_revogados] ERRO:", e.message);
  process.exit(1);
});
