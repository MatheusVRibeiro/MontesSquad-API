// Controller do portfólio verificável (ETAPA 11).
//
// GET /usuarios/:id/portfolio — PÚBLICO (perfil público): mostra o agregado
// de evidências GitHub por projeto sem exigir login. Regra de privacidade
// (ETAPA 11/14): sem detalhes técnicos de repositório privado — apenas
// contagens agregadas, tecnologias e a evidência por task do próprio usuário.
const portfolioService = require("../services/portfolio");

/**
 * GET /usuarios/:id/portfolio — portfólio agregado por projeto.
 * Público: não exige token (perfil público mostra evidências sem login).
 * 404 quando o usuário não existe; 200 com projetos vazio quando não há
 * participação.
 */
async function obterPortfolio(request, response, next) {
  try {
    const { id } = request.params;
    const dados = await portfolioService.obterPortfolio(id);

    if (dados === null) {
      return response.status(404).json({
        sucesso: false,
        message: "Usuário não encontrado",
        dados: null,
      });
    }

    return response.status(200).json({
      sucesso: true,
      message: "Portfólio do usuário",
      nItens: dados.projetos.length,
      dados,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { obterPortfolio };
