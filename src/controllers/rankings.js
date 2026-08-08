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

/**
 * GET /projetos/:projetoId/rankings/contributors — top contributors do projeto (ETAPA 13).
 * Membro/dono. Ranking por score (qualidade), não volume de commits.
 */
async function contributorsPorProjeto(request, response, next) {
  try {
    const { projetoId } = request.params;
    const limit = request.query.limit ? Number(request.query.limit) : 10;
    const dados = await rankingsService.topContributorsPorProjeto(projetoId, limit);
    return response.status(200).json({
      sucesso: true,
      message: "Top contributors do projeto",
      nItens: dados.length,
      dados,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /rankings/contributors — top contributors global (ETAPA 14).
 * ?limit&period=all|month
 */
async function contributorsGeral(request, response, next) {
  try {
    const limit = request.query.limit ? Number(request.query.limit) : 10;
    const period = request.query.period === "month" ? "month" : "all";
    const dados = await rankingsService.topContributorsGeral(limit, period);
    return response.status(200).json({
      sucesso: true,
      message: "Top contributors global",
      nItens: dados.length,
      period,
      dados,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { committersPorProjeto, committersGeral, contributorsPorProjeto, contributorsGeral };