const express = require("express");
const router = express.Router();

const githubController = require("../controllers/github");
const rankingsController = require("../controllers/rankings");
const {
  verificarToken,
  somenteDonoDoProjeto,
  somenteMembroOuDonoDoProjeto,
} = require("../middlewares/auth");

// Webhook GitHub (Autenticação por assinatura HMAC)
router.post("/github/webhook", githubController.webhook);

// Integração de Repositório ao Projeto
router.post("/projetos/:projetoId/github/repository", verificarToken, somenteDonoDoProjeto, githubController.conectarRepository);
router.get("/projetos/:projetoId/github/status", verificarToken, somenteMembroOuDonoDoProjeto, githubController.statusRepository);
router.delete("/projetos/:projetoId/github/repository", verificarToken, somenteDonoDoProjeto, githubController.desconectarRepository);
router.get("/github/installations/:installationId/repositories", verificarToken, githubController.listarRepositoriesInstalacao);

// Conexão e Identidade OAuth GitHub
router.get("/github/me", verificarToken, githubController.me);
router.get("/github/connect", verificarToken, githubController.connect);
router.get("/github/callback-link", verificarToken, githubController.callbackLink);
router.get("/github/callback", githubController.callback);
router.delete("/github/disconnect", verificarToken, githubController.disconnect);

// Status e Commits GitHub da Tarefa
router.get("/projetos/:projetoId/tarefas/:tarefaId/github", verificarToken, somenteMembroOuDonoDoProjeto, githubController.taskGithubStatus);
router.get("/projetos/:projetoId/tarefas/:tarefaId/commits", verificarToken, somenteMembroOuDonoDoProjeto, githubController.taskCommits);
router.get("/projetos/:projetoId/tarefas/:tarefaId/timeline", verificarToken, somenteMembroOuDonoDoProjeto, githubController.taskTimeline);

// Rankings
router.get("/projetos/:projetoId/rankings/committers", verificarToken, somenteMembroOuDonoDoProjeto, rankingsController.committersPorProjeto);
router.get("/rankings/committers", verificarToken, rankingsController.committersGeral);
router.get("/projetos/:projetoId/rankings/contributors", verificarToken, somenteMembroOuDonoDoProjeto, rankingsController.contributorsPorProjeto);
router.get("/rankings/contributors", verificarToken, rankingsController.contributorsGeral);

module.exports = router;
