// Controller GitHub — webhook e processamento de eventos (ETAPA 4+)
const webhookService = require("../services/githubWebhook");
const db = require("../database/connection");

/**
 * POST /github/webhook — entrada pública de eventos do GitHub.
 * NÃO usa verificarToken; a autenticação é a assinatura HMAC (X-Hub-Signature-256).
 */
async function webhook(request, response, next) {
  try {
    // 1. raw body preservado pelo middleware express.raw() em index.js
    const rawBody = request.rawBody || "";
    if (!rawBody) {
      return response.status(400).json({ sucesso: false, message: "Body vazio" });
    }

    // 2. validar assinatura
    const signature = request.headers["x-hub-signature-256"] || request.headers["x-hub-signature"];
    if (!webhookService.verifyWebhookSignature(rawBody, signature)) {
      return response.status(401).json({ sucesso: false, message: "Assinatura inválida" });
    }

    // 3. identificar delivery e evento
    const deliveryId = webhookService.getDeliveryId(request);
    const eventName = webhookService.getEventName(request);

    if (!deliveryId) {
      return response.status(400).json({ sucesso: false, message: "X-GitHub-Delivery ausente" });
    }

    // 4. idempotência: delivery já processado com sucesso? responde 200 sem reprocessar
    if (await webhookService.isDeliveryDuplicate(deliveryId)) {
      return response.status(200).json({ sucesso: true, message: "Delivery já processado", idempotente: true });
    }

    // 5. parse do payload (JSON)
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return response.status(400).json({ sucesso: false, message: "JSON inválido" });
    }

    const repositoryId = payload?.repository?.id ?? null;
    const actionName = payload?.action ?? null;

    // 6. registrar delivery (INSERT IGNORE — idempotente)
    await webhookService.registerDelivery({ deliveryId, eventName, actionName, repositoryId });

    // 7. delegar para o processador de eventos (push/PR nas ETAPAS 8/9)
    const events = require("../services/githubEvents");
    try {
      const resultado = await events.processGitHubEvent(eventName, payload, { deliveryId, repositoryId });
      if (resultado && resultado.processado === false) {
        // handler ainda pendente (ETAPA 4): aceita, mas não marca como processado com efeito
        await webhookService.markDeliveryProcessed(deliveryId);
        return response.status(200).json({
          sucesso: true,
          message: "Webhook recebido",
          processado: true,
          motivo: resultado.motivo || null,
          deliveryId,
        });
      }
    } catch (e) {
      await webhookService.markDeliveryFailed(deliveryId, e);
      return response.status(200).json({ sucesso: true, message: "Webhook recebido (falha de processamento)", processado: false });
    }

    // 8. marcar processado e responder 200
    await webhookService.markDeliveryProcessed(deliveryId);
    return response.status(200).json({ sucesso: true, message: "Webhook recebido", processado: true, deliveryId });
  } catch (error) {
    return next(error);
  }
}

module.exports = { webhook };