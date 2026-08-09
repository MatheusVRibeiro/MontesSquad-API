// Serviço de sessão JWT — revogação de tokens (logout) e extração de jti.
//
// Corrige A1 da auditoria de segurança (docs/RELATORIO_AUDITORIA_SEGURANCA.md):
// sessão JWT sem revogação/logout. A revogação pontual usa a tabela
// tokens_revogados (denylist por jti); a revogação em massa (troca de senha)
// usa a coluna usuarios.token_versao embutida no payload (ver verificarToken).
const jwt = require("jsonwebtoken");
const db = require("../database/connection");

/**
 * Revoga um token específico pelo seu jti (identificador único do JWT).
 * INSERT IGNORE → idempotente: revogar o mesmo jti duas vezes não gera erro.
 * Não lança erro se jti for ausente (token antigo sem jti não é revogável).
 */
async function revogarToken(jti) {
  if (!jti) return;
  await db.query("INSERT IGNORE INTO tokens_revogados (jti) VALUES (?)", [String(jti)]);
}

/**
 * Extrai o jti de um token SEM validar assinatura (jwt.decode).
 * ⚠️ Uso restrito: somente para tokens JÁ validados pelo middleware
 * verificarToken (auth.js) — jwt.decode não verifica assinatura/expiração.
 */
function extrairJti(token) {
  if (!token) return null;
  try {
    const payload = jwt.decode(token);
    return payload && typeof payload.jti === "string" ? payload.jti : null;
  } catch {
    return null;
  }
}

module.exports = { revogarToken, extrairJti };
