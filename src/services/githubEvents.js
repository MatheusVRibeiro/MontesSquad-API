// Processador de eventos GitHub (ETAPA 4 — placeholder; push/PR completos nas ETAPAS 8/9)
// Recebe eventos já validados (assinatura + idempotência) pelo controller.

/**
 * Roteia o evento para o processador específico.
 * Na ETAPA 4 registra apenas; as ETAPAS 8/9 implementam push/pull_request.
 */
async function processGitHubEvent(eventName, payload, context = {}) {
  const { deliveryId } = context;

  if (eventName === "push") {
    return { processado: false, motivo: "handler_push_pendente", deliveryId };
  }
  if (eventName === "pull_request") {
    return { processado: false, motivo: "handler_pull_request_pendente", deliveryId };
  }
  // ping e outros eventos: aceitos sem efeitos
  return { processado: true, motivo: "evento_sem_acao", deliveryId };
}

module.exports = { processGitHubEvent };