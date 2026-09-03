const express = require("express");
const router = express.Router();

const matchingController = require("../controllers/matching");
const taskMatchingController = require("../controllers/taskMatching");
const {
  verificarToken,
  somenteMembroOuDonoDoProjeto,
} = require("../middlewares/auth");

// Matching Desenvolvedor ↔ Projeto
router.get("/matching/projetos", verificarToken, matchingController.recomendarProjetos);

// Matching Desenvolvedor ↔ Task
router.get("/projetos/:projetoId/tasks/recomendadas", verificarToken, somenteMembroOuDonoDoProjeto, taskMatchingController.recomendarTasks);

module.exports = router;
