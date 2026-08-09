// Controller do portfólio verificável (ETAPA 11).
//
// GET /usuarios/:id/portfolio — PÚBLICO (perfil público): mostra o agregado
// de evidências GitHub por projeto sem exigir login. Regra de privacidade
// (ETAPA 11/14): sem detalhes técnicos de repositório privado — apenas
// contagens agregadas, tecnologias e a evidência por task do próprio usuário.
const jwt = require("jsonwebtoken");
const portfolioService = require("../services/portfolio");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não configurado");
}

// A rota de portfólio é pública (sem verificarToken), então o
// request.usuarioAutenticado normalmente não é preenchido. Para o alias 'me'
// funcionar também aí, extrai o usuário do Bearer token quando presente — sem
// rejeitar a requisição (a rota continua pública para ids numéricos).
// Retorna null quando não há autenticação válida.
function extrairUsuarioAutenticadoId(request) {
  if (request.usuarioAutenticado && request.usuarioAutenticado.id != null) {
    return request.usuarioAutenticado.id;
  }

  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return null;

  try {
    const payload = jwt.verify(authorization.slice(7), JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (!payload.exp || typeof payload.exp !== "number") return null;
    return payload.id != null ? payload.id : null;
  } catch {
    return null;
  }
}

/**
 * GET /usuarios/:id/portfolio — portfólio agregado por projeto.
 * Público: não exige token (perfil público mostra evidências sem login).
 * Alias 'me' (M2 do QA): resolve para o usuário autenticado — com token
 * válido usa o id do payload; sem autenticação → 401 (não existe portfólio
 * "meu" anônimo). 404 quando o usuário não existe; 200 com projetos vazio
 * quando não há participação.
 */
async function obterPortfolio(request, response, next) {
  try {
    let usuarioId = request.params.id;

    if (usuarioId === "me") {
      usuarioId = extrairUsuarioAutenticadoId(request);
      if (usuarioId == null) {
        return response.status(401).json({
          sucesso: false,
          message: "Autenticação necessária para acessar o próprio portfólio",
          dados: null,
        });
      }
    }
    // ids numéricos seguem o contrato original: string da rota repassada ao
    // service (testes de segurança assertam params[0] === "5").
    const dados = await portfolioService.obterPortfolio(usuarioId);

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
