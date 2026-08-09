const jwt = require("jsonwebtoken");
const db = require("../database/connection");
const AppError = require("../utils/errors");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não configurado");
}

// Middleware para verificar se o usuário está logado
// Hardening (auditoria docs/RELATORIO_AUDITORIA_SEGURANCA.md — A1 + BAIXO jwt):
//   - exige algoritmo HS256 (rejeita 'none' / HS384 / RS256);
//   - exige expiração explícita (token sem exp é rejeitado);
//   - denylist: jti presente em tokens_revogados (logout) → 401 'Sessão revogada';
//   - token_versao: se o payload carrega a versão da sessão, compara com a
//     coluna usuarios.token_versao — troca de senha incrementa a versão e
//     derruba TODOS os tokens antigos em massa.
async function verificarToken(request, response, next) {
  const authorization = request.headers.authorization;

  if (!authorization) {
    return response.status(401).json({
      sucesso: false,
      message: "Token não informado",
      dados: null,
    });
  }

  const partes = authorization.split(" ");

  if (partes.length !== 2 || partes[0] !== "Bearer") {
    return response.status(401).json({
      sucesso: false,
      message: "Formato de token inválido",
      dados: null,
    });
  }

  const token = partes[1];

  let payload;
  try {
    // algorithms explícito: nenhum algoritmo além de HS256 é aceito.
    // jwt.verify já rejeita token expirado (exp) e assinatura inválida.
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
  } catch (error) {
    return next(new AppError("Token inválido ou expirado", 401, error));
  }

  // Token sem expiração explícita → rejeitado (não pode ser válido para sempre)
  if (!payload.exp || typeof payload.exp !== "number") {
    return response.status(401).json({
      sucesso: false,
      message: "Token inválido ou expirado",
      dados: null,
    });
  }

  try {
    // Denylist: token revogado via /logout (jti em tokens_revogados)
    if (payload.jti) {
      const [revogados] = await db.query(
        "SELECT 1 FROM tokens_revogados WHERE jti = ? LIMIT 1",
        [String(payload.jti)]
      );
      if (revogados.length > 0) {
        return response.status(401).json({
          sucesso: false,
          message: "Sessão revogada",
          dados: null,
        });
      }
    }

    // token_versao: invalidação em massa (troca de senha incrementa a versão
    // no banco → qualquer token emitido com versão anterior morre na hora)
    if (payload.token_versao !== undefined) {
      const [linhas] = await db.query(
        "SELECT token_versao FROM usuarios WHERE id = ? LIMIT 1",
        [payload.id]
      );
      if (
        linhas.length === 0 ||
        Number(linhas[0].token_versao) !== Number(payload.token_versao)
      ) {
        return response.status(401).json({
          sucesso: false,
          message: "Sessão revogada",
          dados: null,
        });
      }
    }
  } catch (error) {
    return next(new AppError("Erro na verificação de sessão", 500, error));
  }

  request.usuarioAutenticado = payload;
  return next();
}

// Middleware para validar se o usuário é administrador global
function somenteAdm(request, response, next) {
  if (!request.usuarioAutenticado) {
    return response.status(401).json({
      sucesso: false,
      message: "Usuário não autenticado",
      dados: null,
    });
  }

  if (request.usuarioAutenticado.tipo !== "adm") {
    return response.status(403).json({
      sucesso: false,
      message: "Acesso negado: Requer privilégios de administrador",
      dados: null,
    });
  }

  return next();
}

// Middleware para validar se o usuário é o criador/dono do projeto
async function somenteDonoDoProjeto(request, response, next) {
  if (!request.usuarioAutenticado) {
    return response.status(401).json({
      sucesso: false,
      message: "Usuário não autenticado",
      dados: null,
    });
  }

  const { id, projetoId } = request.params;
  const pId = projetoId || id || request.body.projeto_id;

  if (!pId) {
    return response.status(400).json({
      sucesso: false,
      message: "ID do projeto não fornecido",
      dados: null,
    });
  }

  try {
    // Administradores globais podem passar direto
    if (request.usuarioAutenticado.tipo === "adm") {
      return next();
    }

    const sql = `SELECT criador_id FROM projetos WHERE id = ? LIMIT 1`;
    const [rows] = await db.query(sql, [pId]);

    if (rows.length === 0) {
      return response.status(404).json({
        sucesso: false,
        message: "Projeto não encontrado",
        dados: null,
      });
    }

    if (rows[0].criador_id !== request.usuarioAutenticado.id) {
      return response.status(403).json({
        sucesso: false,
        message: "Acesso negado: Apenas o proprietário do projeto pode realizar esta ação",
        dados: null,
      });
    }

    return next();
  } catch (error) {
    return next(new AppError("Erro na verificação de propriedade do projeto", 500, error));
  }
}

// Middleware para validar se o usuário é o dono do projeto ou membro da equipe/squad
async function somenteMembroOuDonoDoProjeto(request, response, next) {
  if (!request.usuarioAutenticado) {
    return response.status(401).json({
      sucesso: false,
      message: "Usuário não autenticado",
      dados: null,
    });
  }

  const { id, projetoId } = request.params;
  const pId = projetoId || id;

  if (!pId) {
    return response.status(400).json({
      sucesso: false,
      message: "ID do projeto não fornecido",
      dados: null,
    });
  }

  try {
    // Administradores globais podem passar direto
    if (request.usuarioAutenticado.tipo === "adm") {
      return next();
    }

    // 1. Verifica se é dono do projeto
    const sqlOwner = `SELECT criador_id FROM projetos WHERE id = ? LIMIT 1`;
    const [ownerRows] = await db.query(sqlOwner, [pId]);

    if (ownerRows.length === 0) {
      return response.status(404).json({
        sucesso: false,
        message: "Projeto não encontrado",
        dados: null,
      });
    }

    if (ownerRows[0].criador_id === request.usuarioAutenticado.id) {
      return next();
    }

    // 2. Verifica se é membro da equipe (squad) — apenas vínculo ATIVO:
    // ex-membros (status='saiu'/'removido') NÃO mantêm acesso ao projeto (A2).
    const sqlMember = `SELECT id FROM membros_equipe WHERE projeto_id = ? AND usuario_id = ? AND status = 'ativo' LIMIT 1`;
    const [memberRows] = await db.query(sqlMember, [pId, request.usuarioAutenticado.id]);

    if (memberRows.length === 0) {
      return response.status(403).json({
        sucesso: false,
        message: "Acesso negado: Requer ser proprietário do projeto ou membro do squad",
        dados: null,
      });
    }

    return next();
  } catch (error) {
    return next(new AppError("Erro na verificação de vínculo com o squad", 500, error));
  }
}

// Middleware para validar se o usuário é o próprio dono do perfil ou administrador
function somenteProprioOuAdm(request, response, next) {
  if (!request.usuarioAutenticado) {
    return response.status(401).json({
      sucesso: false,
      message: "Usuário não autenticado",
      dados: null,
    });
  }

  const { id } = request.params;
  const ehProprio = request.usuarioAutenticado.id == id || Number(request.usuarioAutenticado.id) === Number(id);
  const ehAdm = request.usuarioAutenticado.tipo === "adm";

  if (!ehProprio && !ehAdm) {
    return response.status(403).json({
      sucesso: false,
      message: "Acesso negado: você só pode editar seu próprio perfil",
      dados: null,
    });
  }

  return next();
}

module.exports = {
  verificarToken,
  somenteAdm,
  somenteDonoDoProjeto,
  somenteMembroOuDonoDoProjeto,
  somenteProprioOuAdm,
};