// Matching Desenvolvedor ↔ Task (ETAPA 17 — docs/PLANO_EVOLUCAO_PRODUTO_MONTESQUAD.md §20)
//
// Endpoint:
//   GET /projetos/:projetoId/tasks/recomendadas → recomenda tasks do projeto
//   adequadas ao usuário autenticado. Score DETERMINÍSTICO (sem IA)
//   calculado em src/services/taskMatching.js (pesos 40/25/15/10/10
//   documentados em código: habilidades, dificuldade, função no projeto,
//   disponibilidade, sem responsável).
//
// Contrato da resposta (escolha documentada): o array de recomendações fica
// em `dados.recomendacoes` (mesmo shape do matching de projetos, ETAPA 16),
// permitindo evoluir o payload com metadados do cálculo sem quebrar o shape:
//   { sucesso: true, message: "Tasks recomendadas", nItens, dados: { recomendacoes: [...] } }
// Cada item: { taskId, titulo, compatibilidade (0-100), motivos: string[] } —
// os motivos (frases pt-BR) justificam a recomendação (critério de aceite da
// etapa: "Recomendação é transparente e não impede escolha manual" — o
// matching NÃO bloqueia o usuário de assumir a task manualmente).
const taskMatchingService = require("../services/taskMatching");
const AppError = require("../utils/errors");

module.exports = {
  // GET /projetos/:projetoId/tasks/recomendadas
  async recomendarTasks(request, response, next) {
    try {
      // request.params.projetoId é STRING (pitfall do skill) — converte e valida
      const projetoId = Number(request.params.projetoId);
      if (!Number.isInteger(projetoId) || projetoId <= 0) {
        return response.status(400).json({
          sucesso: false,
          message: "ID do projeto inválido",
          dados: null,
        });
      }

      const usuarioId = request.usuarioAutenticado.id;
      const recomendacoes = await taskMatchingService.recomendarTasks(projetoId, usuarioId);

      if (recomendacoes === null) {
        return response.status(404).json({
          sucesso: false,
          message: "Projeto não encontrado",
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: "Tasks recomendadas",
        nItens: recomendacoes.length,
        dados: { recomendacoes },
      });
    } catch (error) {
      // Erros de negócio do service (ex.: não é membro ativo → 403) passam
      // direto para o middleware global (lê err.status); o resto vira 500.
      if (error instanceof AppError) {
        return next(error);
      }
      return next(new AppError("Erro ao recomendar tasks", 500, error));
    }
  },
};
