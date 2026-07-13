const jwt = require("jsonwebtoken");
const db = require("../database/connection");
const AppError = require("../utils/errors");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";

// Middleware para verificar se o usuário está logado
function verificarToken(request, response, next) {
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

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    request.usuarioAutenticado = payload;
    return next();
  } catch (error) {
    return next(new AppError("Token inválido ou expirado", 401, error));
  }
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

    // 2. Verifica se é membro da equipe (squad)
    const sqlMember = `SELECT id FROM membros_equipe WHERE projeto_id = ? AND usuario_id = ? LIMIT 1`;
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

module.exports = {
  verificarToken,
  somenteAdm,
  somenteDonoDoProjeto,
  somenteMembroOuDonoDoProjeto,
};