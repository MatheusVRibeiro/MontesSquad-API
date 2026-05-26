const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";

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
    return response.status(401).json({
      sucesso: false,
      message: "Token inválido ou expirado",
      dados: null,
    });
  }
}

module.exports = {
  verificarToken,
};