// Webhook GitHub — assinatura e idempotência (ETAPA 4)
// Segurança: HMAC SHA-256 com timingSafeEqual; deliveries registrados no banco.
const crypto = require("crypto");
const db = require("../database/connection");

function getWebhookSecret() {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error("GITHUB_WEBHOOK_SECRET não configurado (ETAPA 4).");
  }
  return secret.trim();
}

/** M4: true se GITHUB_WEBHOOK_SECRET está configurado (sem lançar erro). */
function isWebhookConfigured() {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  return !!(secret && secret.trim() !== "");
}

/**
 * Valida X-Hub-Signature-256 (HMAC SHA-256 do raw body) com timingSafeEqual.
 * Aceita também o formato antigo X-Hub-Signature (SHA-1) como fallback.
 * M4: as checagens de body/assinatura acontecem ANTES de resolver o secret —
 * uma requisição sem assinatura é rejeitada (false) sem tocar em
 * getWebhookSecret() (que lançaria 500 com detalhe interno se ausente).
 */
function verifyWebhookSignature(rawBody, signature, providedSecret) {
  if (!rawBody || typeof rawBody !== "string") return false;
  if (!signature) return false;

  const secret = providedSecret || getWebhookSecret();

  const assinatura256 = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const esperado256 = Buffer.from(assinatura256);
  const recebido256 = Buffer.from(String(signature));

  if (esperado256.length === recebido256.length) {
    const ok = crypto.timingSafeEqual(esperado256, recebido256);
    if (ok) return true;
  }

  // Fallback SHA-1 (signature antiga)
  if (signature.startsWith("sha1=")) {
    const assinatura1 = "sha1=" + crypto
      .createHmac("sha1", secret)
      .update(rawBody, "utf8")
      .digest("hex");
    const esperado1 = Buffer.from(assinatura1);
    const recebido1 = Buffer.from(String(signature));
    if (esperado1.length === recebido1.length) {
      return crypto.timingSafeEqual(esperado1, recebido1);
    }
  }
  return false;
}

function getDeliveryId(req) {
  return (req.headers["x-github-delivery"] || "").trim();
}

function getEventName(req) {
  return (req.headers["x-github-event"] || "").trim();
}

/** Registra o delivery (INSERT IGNORE na unique key delivery_id). */
async function registerDelivery({ deliveryId, eventName, actionName, repositoryId, conn }) {
  const executor = conn || db;
  await executor.query(
    `INSERT IGNORE INTO github_webhook_deliveries
      (delivery_id, event_name, action_name, repository_id, processado)
     VALUES (?, ?, ?, ?, FALSE)`,
    [deliveryId, eventName, actionName || null, repositoryId || null]
  );
}

/** Marca o delivery como processado com sucesso. */
async function markDeliveryProcessed(deliveryId, conn) {
  const executor = conn || db;
  await executor.query(
    `UPDATE github_webhook_deliveries
     SET processado = TRUE, processado_em = NOW()
     WHERE delivery_id = ?`,
    [deliveryId]
  );
}

/** Marca o delivery como falho (com mensagem de erro). */
async function markDeliveryFailed(deliveryId, erro, conn) {
  const executor = conn || db;
  const msg = erro instanceof Error ? erro.message : String(erro || "erro");
  await executor.query(
    `UPDATE github_webhook_deliveries
     SET erro = ?, processado_em = NOW()
     WHERE delivery_id = ?`,
    [String(msg).slice(0, 1000), deliveryId]
  );
}

/** Verifica se o delivery já foi processado com sucesso (idempotência). */
async function isDeliveryDuplicate(deliveryId, conn) {
  const executor = conn || db;
  const [rows] = await executor.query(
    `SELECT processado FROM github_webhook_deliveries WHERE delivery_id = ? LIMIT 1`,
    [deliveryId]
  );
  return rows.length > 0 && rows[0].processado === true;
}

module.exports = {
  verifyWebhookSignature,
  isWebhookConfigured,
  getDeliveryId,
  getEventName,
  registerDelivery,
  markDeliveryProcessed,
  markDeliveryFailed,
  isDeliveryDuplicate,
  getWebhookSecret,
};