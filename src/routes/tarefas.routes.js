const express = require("express");
const router = express.Router();

const tarefasController = require("../controllers/tarefas");
const {
  verificarToken,
  somenteDonoDoProjeto,
  somenteMembroOuDonoDoProjeto,
} = require("../middlewares/auth");

// Kanban Tarefas
router.get("/projetos/:projetoId/tarefas", verificarToken, somenteMembroOuDonoDoProjeto, tarefasController.listarTarefas);
router.post("/projetos/:projetoId/tarefas", verificarToken, somenteMembroOuDonoDoProjeto, tarefasController.criarTarefa);
router.patch("/projetos/:projetoId/tarefas/:tarefaId", verificarToken, somenteMembroOuDonoDoProjeto, tarefasController.atualizarTarefa);
router.delete("/projetos/:projetoId/tarefas/:tarefaId", verificarToken, somenteDonoDoProjeto, tarefasController.apagarTarefa);

// Atribuição e ciclo de vida
router.post("/projetos/:projetoId/tarefas/:tarefaId/assumir", verificarToken, somenteMembroOuDonoDoProjeto, tarefasController.assumirTarefa);
router.post("/projetos/:projetoId/tarefas/:tarefaId/abandonar", verificarToken, somenteMembroOuDonoDoProjeto, tarefasController.abandonarTarefa);
router.post("/projetos/:projetoId/tarefas/:tarefaId/remover-responsavel", verificarToken, somenteDonoDoProjeto, tarefasController.removerResponsavelTarefa);
router.post("/projetos/:projetoId/tarefas/:tarefaId/reatribuir", verificarToken, somenteDonoDoProjeto, tarefasController.reatribuirTarefa);
router.get("/projetos/:projetoId/tarefas/:tarefaId/historico-responsaveis", verificarToken, somenteMembroOuDonoDoProjeto, tarefasController.historicoResponsaveisTarefa);

module.exports = router;
