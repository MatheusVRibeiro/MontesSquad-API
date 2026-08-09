// Matching Desenvolvedor ↔ Projeto (ETAPA 16 — docs/PLANO_EVOLUCAO_PRODUTO_MONTESQUAD.md §19)
//
// Endpoints:
//   GET /matching/projetos → recomenda projetos compatíveis com o perfil do
//   usuário autenticado. Score DETERMINÍSTICO (sem IA) calculado em
//   src/services/matching.js (pesos 40/25/15/10/10 documentados em código).
//
// Contrato da resposta (escolha documentada): o array de recomendações fica
// em `dados.recomendacoes` (e não em `dados` direto) para permitir evoluir o
// payload com metadados do cálculo sem quebrar o shape:
//   { sucesso: true, message: "Projetos recomendados", nItens, dados: { recomendacoes: [...] } }
// Cada item: { projeto: {id, titulo, descricao, status, visibilidade,
// tecnologias[]}, score (0-100), fatores: {habilidades, funcao, nivel,
// disponibilidade, outras} — cada um com {pontos, max, percentual, detalhes[]},
// explicacao: string[] } — os fatores justificam a recomendação (critério de
// aceite da etapa: score explicável).
const matchingService = require("../services/matching");
const AppError = require("../utils/errors");

module.exports = {
  // GET /matching/projetos
  async recomendarProjetos(request, response, next) {
    try {
      const usuarioId = request.usuarioAutenticado.id;
      const recomendacoes = await matchingService.recomendarProjetos(usuarioId);

      return response.status(200).json({
        sucesso: true,
        message: "Projetos recomendados",
        nItens: recomendacoes.length,
        dados: { recomendacoes },
      });
    } catch (error) {
      return next(new AppError("Erro ao recomendar projetos", 500, error));
    }
  },
};
