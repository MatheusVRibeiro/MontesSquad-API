// Controller de rankings (ETAPAS 11-12)
const rankingsService = require("../services/rankings");

/**
 * GET /projetos/:projetoId/rankings/committers — top committers do projeto.
 * Membro/dono.
 */
async function committersPorProjeto(request, response, next) {
  try {
    const { projetoId } = request.params;
    const limit = request.query.limit ? Number(request.query.limit) : 5;
    const dados = await rankingsService.topCommittersPorProjeto(projetoId, limit);
    return response.status(200).json({
      sucesso: true,
      message: "Top committers do projeto",
      nItens: dados.length,
      dados,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /rankings/committers — top committers global (?limit&period=all|month).
 * Qualquer logado.
 */
async function committersGeral(request, response, next) {
  try {
    const limit = request.query.limit ? Number(request.query.limit) : 10;
    const period = request.query.period === "month" ? "month" : "all";
    const dados = await rankingsService.topCommittersGeral(limit, period);
    return response.status(200).json({
      sucesso: true,
      message: "Top committers global",
      nItens: dados.length,
      period,
      dados,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { committersPorProjeto, committersGeral };