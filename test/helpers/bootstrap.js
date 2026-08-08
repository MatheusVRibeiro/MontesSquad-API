// Bootstrap da suíte de testes (FASE-05.A) — NUNCA toca no MySQL real.
//
// ⚠️ PITFALL CRÍTICO (skill montesquad-development): src/database/connection.js
// conecta no MySQL REAL no require-time e chama process.exit(1) se a conexão
// falhar. Qualquer require de controllers/middlewares sem stub derruba o processo.
//
// Estratégia validada: stubar o pool IN-PLACE mutando o require.cache do Node
// ANTES de qualquer require da aplicação. O connection.js exporta o pool
// sincronamente (module.exports = pool); os controllers seguram a referência
// devolvida por require('../database/connection'), que passa a ser o pool fake
// (com .query e .getConnection sincronamente — getConnection devolve uma conn
// fake com beginTransaction/commit/rollback/release para a transação de
// candidaturas). O connection.js real NUNCA é executado.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Raiz do repositório (MontesSquad-API)
export const RAIZ = path.resolve(__dirname, "..", "..");
export const CAMINHO_CONNECTION = path.join(RAIZ, "src", "database", "connection.js");
export const CAMINHO_INDEX = path.join(RAIZ, "index.js");

// Hash bcrypt fixo usado no login de sucesso dos testes (senha: senha123)
export const HASH_SENHA = bcrypt.hashSync("senha123", 10);

// Define variáveis de ambiente de TESTE. O dotenv do index.js não sobrescreve
// variáveis já setadas no process.env — as credenciais reais do .env ficam inertes.
export function setEnvAmbiente() {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.BD_SERVIDOR = process.env.BD_SERVIDOR || "localhost";
  process.env.BD_PORTA = process.env.BD_PORTA || "3306";
  process.env.BD_USUARIO = process.env.BD_USUARIO || "teste";
  process.env.BD_SENHA = process.env.BD_SENHA || "teste";
  process.env.BD_BANCO = process.env.BD_BANCO || "montesquad_test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "segredo-teste-fase05";
  process.env.JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || "segredo-reset-teste-fase05";
  process.env.PORT = process.env.PORT || "3999";
}

// Normaliza o SQL para casamento por assinatura EXATA (pitfall do skill: distinguir
// queries parecidas — ex.: sem LIMIT vs com LIMIT 1).
function normalizarSql(sql) {
  return String(sql)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/;\s*$/, "")
    .trim();
}

// Cria um pool fake com a MESMA interface do pool mysql2/promise.
// handlers: [{ match: (sqlNormalizada, params) => bool,
//              resposta: [rows, fields] | (params, chamada) => [rows, fields],
//              erro?: Error }]
// Query não mapeada → throw com mensagem clara (mock errado = teste falha alto).
export function criarPoolFake(handlers = []) {
  const pool = {
    chamadas: [], // histórico de { sql, params } para asserts (ex.: notificação disparada)
    falharBanco: false, // usado pelo teste de /health
    async query(sql, params) {
      const normalizada = normalizarSql(sql);
      pool.chamadas.push({ sql: normalizada, params });
      const handler = handlers.find((h) => h.match(normalizada, params));
      if (!handler) {
        throw new Error(`[MockDB] Query não mapeada no teste: ${normalizada}`);
      }
      if (handler.erro) throw handler.erro;
      if (typeof handler.resposta === "function") return handler.resposta(params, { sql: normalizada });
      return handler.resposta;
    },
    async getConnection() {
      return fakeConn;
    },
  };
  const fakeConn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params) {
      return pool.query(sql, params);
    },
  };
  return pool;
}

// Substitui o módulo connection no require.cache ANTES de qualquer require da app.
// Com isso o connection.js real (MySQL + process.exit) nunca é executado.
export function stubarPool(pool) {
  require.cache[CAMINHO_CONNECTION] = {
    id: CAMINHO_CONNECTION,
    filename: CAMINHO_CONNECTION,
    loaded: true,
    exports: pool,
  };
}

// Remove do cache os módulos da aplicação (index/routes/controllers/middlewares)
// para que um novo buildApp() re-requira tudo com o pool fake NOVO (sem isso,
// os controllers já carregados segurariam o pool antigo — pitfall do re-require).
export function limparAppDoCache() {
  const prefixo = RAIZ + path.sep;
  const dirTeste = path.join(RAIZ, "test") + path.sep;
  for (const key of Object.keys(require.cache)) {
    if (!key.startsWith(prefixo)) continue;
    if (key.includes("node_modules")) continue;
    if (key.startsWith(dirTeste)) continue;
    delete require.cache[key];
  }
}

// Constrói o app Express REAL (index.js) com o pool fake stubado.
// Uso: const app = buildApp(criarPoolFake([...handlers]));
export function buildApp(pool) {
  setEnvAmbiente();
  limparAppDoCache();
  stubarPool(pool);
  return require(CAMINHO_INDEX);
}

// Gera um JWT válido com o MESMO JWT_SECRET de teste usado pelos middlewares.
export function tokenPara({ id, email = "usuario@email.com", nome = "Usuário", tipo = "membro" }) {
  setEnvAmbiente();
  return jwt.sign({ id, email, nome, tipo }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

// Busca no histórico do pool a primeira chamada cujo SQL casa com a regex.
export function buscarChamada(pool, regex) {
  return pool.chamadas.find((c) => regex.test(c.sql));
}
