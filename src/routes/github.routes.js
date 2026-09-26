const express = require("express");
const router = express.Router();

const githubController = require("../controllers/github");
const rankingsController = require("../controllers/rankings");
const {
  verificarToken,
  somenteDonoDoProjeto,
  somenteMembroOuDonoDoProjeto,
} = require("../middlewares/auth");

// Conexão e Identidade OAuth GitHub (Mantido)
router.get("/github/me", verificarToken, githubController.me);
router.get("/github/connect", verificarToken, githubController.connect);
router.get("/github/callback-link", verificarToken, githubController.callbackLink);
router.get("/github/callback", githubController.callback);
router.delete("/github/disconnect", verificarToken, githubController.disconnect);

// Rankings (retorno gracioso enquanto integração estiver pausada)
router.get("/projetos/:projetoId/rankings/committers", verificarToken, somenteMembroOuDonoDoProjeto, rankingsController.committersPorProjeto);
router.get("/rankings/committers", verificarToken, rankingsController.committersGeral);
router.get("/projetos/:projetoId/rankings/contributors", verificarToken, somenteMembroOuDonoDoProjeto, rankingsController.contributorsPorProjeto);
router.get("/rankings/contributors", verificarToken, rankingsController.contributorsGeral);

module.exports = router;
