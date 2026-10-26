const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const autenticacaoController = require("../controllers/autenticacao");
const githubAuthController = require("../controllers/githubAuth");
const { verificarToken } = require("../middlewares/auth");

function criarLimiter({ windowMs, limit, mensagem }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      sucesso: false,
      message: mensagem,
      dados: null,
    },
  });
}

const limiterLogin = criarLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  mensagem: "Muitas tentativas. Tente novamente em 15 minutos.",
});

const limiterRecuperarSenha = criarLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  mensagem: "Muitas tentativas. Tente novamente em 1 hora.",
});

const limiterResetarSenha = criarLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  mensagem: "Muitas tentativas. Tente novamente em 1 hora.",
});

// Login & Logout
router.post("/login", limiterLogin, autenticacaoController.login);
router.post("/logout", verificarToken, autenticacaoController.logout);

// Recuperação e Reset de Senha
router.post("/recuperar-senha", limiterRecuperarSenha, autenticacaoController.recuperarSenha);
router.post("/verificar-codigo-recuperacao", autenticacaoController.verificarCodigoRecuperacao);
router.post("/validar-codigo", autenticacaoController.verificarCodigoRecuperacao);
router.post("/resetar-senha", limiterResetarSenha, autenticacaoController.resetarSenha);

// GitHub Auth (Cadastro/Login via OAuth)
router.get("/auth/github", githubAuthController.iniciarAuthGitHub);
router.get("/auth/github/callback", githubAuthController.callbackAuthGitHub);
router.post("/auth/github/complete-profile", verificarToken, githubAuthController.completarPerfilGitHub);

module.exports = router;
