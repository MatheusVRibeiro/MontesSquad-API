const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const usuariosController = require("../controllers/usuarios");
const perfilController = require("../controllers/perfil");
const habilidadesController = require("../controllers/habilidades");
const habilidadesUsuarioController = require("../controllers/habilidades_usuario");
const notificacoesController = require("../controllers/notificacoes");
const reputacaoController = require("../controllers/reputacao");
const portfolioController = require("../controllers/portfolio");

const {
  verificarToken,
  somenteAdm,
  somenteProprioOuAdm,
} = require("../middlewares/auth");

const limiterCadastro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    sucesso: false,
    message: "Muitas tentativas. Tente novamente em 1 hora.",
    dados: null,
  },
});

// Cadastro público com rate-limit
router.post("/usuarios", limiterCadastro, usuariosController.cadastrarUsuario);

// Usuários
router.get("/usuarios", verificarToken, usuariosController.listarUsuarios);
router.get("/usuarios/me", verificarToken, usuariosController.obterUsuarioAutenticado);
router.patch("/usuarios/:id", verificarToken, somenteProprioOuAdm, usuariosController.editarUsuario);
router.delete("/usuarios/:id", verificarToken, somenteAdm, usuariosController.apagarUsuario);

// Perfil Técnico
router.get("/funcoes", verificarToken, perfilController.listarFuncoes);
router.get("/usuarios/me/perfil", verificarToken, perfilController.obterPerfilTecnico);
router.patch("/usuarios/me/perfil", verificarToken, perfilController.atualizarPerfilTecnico);
router.put("/usuarios/me/funcoes", verificarToken, perfilController.atualizarFuncoesUsuario);
router.put("/usuarios/me/habilidades", verificarToken, perfilController.atualizarHabilidadesUsuario);

// Notificações
router.get("/notificacoes", verificarToken, notificacoesController.listarNotificacoes);
router.post("/notificacoes/ler-tudo", verificarToken, notificacoesController.marcarTodasLidas);

// Reputação e Portfólio
router.get("/usuarios/:id/reputacao", verificarToken, reputacaoController.obterReputacao);
router.get("/usuarios/:id/portfolio", portfolioController.obterPortfolio);

// Habilidades Globais
router.get("/habilidades", verificarToken, habilidadesController.listarHabilidades);
router.post("/habilidades", verificarToken, somenteAdm, habilidadesController.cadastrarHabilidade);
router.patch("/habilidades/:id", verificarToken, somenteAdm, habilidadesController.editarHabilidade);
router.delete("/habilidades/:id", verificarToken, somenteAdm, habilidadesController.apagarHabilidade);

// Habilidades Usuário
router.get("/habilidades-usuario", verificarToken, habilidadesUsuarioController.listarHabilidadesUsuario);
router.post("/habilidades-usuario", verificarToken, habilidadesUsuarioController.cadastrarHabilidadesUsuario);
router.patch("/habilidades-usuario/:id", verificarToken, habilidadesUsuarioController.editarHabilidadesUsuario);
router.delete("/habilidades-usuario/:id", verificarToken, habilidadesUsuarioController.apagarHabilidadesUsuario);

module.exports = router;
