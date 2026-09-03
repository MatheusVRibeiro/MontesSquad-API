const express = require("express");
const router = express.Router();

const projetosController = require("../controllers/projetos");
const habilidadesProjetoController = require("../controllers/habilidades_projeto");
const mensagensController = require("../controllers/mensagens");
const candidaturasController = require("../controllers/candidaturas");
const membrosController = require("../controllers/membros");
const vagasProjetoController = require("../controllers/vagasProjeto");
const eventosProjetoController = require("../controllers/eventosProjeto");

const {
  verificarToken,
  somenteDonoDoProjeto,
  somenteMembroOuDonoDoProjeto,
} = require("../middlewares/auth");

// Projetos CRUD
router.get("/projetos", verificarToken, projetosController.listarProjetos);
router.get("/projetos/:id", verificarToken, projetosController.obterProjeto);
router.post("/projetos", verificarToken, projetosController.cadastrarProjeto);
router.patch("/projetos/:id", verificarToken, somenteDonoDoProjeto, projetosController.editarProjeto);
router.delete("/projetos/:id", verificarToken, somenteDonoDoProjeto, projetosController.apagarProjeto);

// Habilidades do Projeto
router.get("/habilidades-projeto", verificarToken, habilidadesProjetoController.listarHabilidadesProjeto);
router.post("/habilidades-projeto", verificarToken, somenteDonoDoProjeto, habilidadesProjetoController.cadastrarHabilidadesProjeto);
router.patch("/habilidades-projeto/:id", verificarToken, somenteDonoDoProjeto, habilidadesProjetoController.editarHabilidadesProjeto);
router.delete("/habilidades-projeto/:id", verificarToken, somenteDonoDoProjeto, habilidadesProjetoController.apagarHabilidadesProjeto);

// Mural de Mensagens
router.get("/projetos/:projetoId/mensagens", verificarToken, somenteMembroOuDonoDoProjeto, mensagensController.listarMensagensProjeto);
router.post("/projetos/:projetoId/mensagens", verificarToken, somenteMembroOuDonoDoProjeto, mensagensController.enviarMensagemProjeto);

// Candidaturas
router.post("/projetos/:projetoId/candidaturas", verificarToken, candidaturasController.candidatarSe);
router.get("/projetos/:projetoId/candidaturas", verificarToken, somenteDonoDoProjeto, candidaturasController.listarCandidaturas);
router.patch("/projetos/:projetoId/candidaturas/:candidaturaId", verificarToken, somenteDonoDoProjeto, candidaturasController.atualizarStatusCandidatura);

// Membros do Squad
router.get("/projetos/:projetoId/membros", verificarToken, membrosController.listarMembros);
router.delete("/projetos/:projetoId/membros/:usuarioId", verificarToken, somenteDonoDoProjeto, membrosController.removerMembro);
router.post("/projetos/:projetoId/sair", verificarToken, membrosController.sairDoProjeto);

// Vagas do Projeto
router.get("/projetos/:projetoId/vagas", verificarToken, somenteMembroOuDonoDoProjeto, vagasProjetoController.listarVagas);
router.post("/projetos/:projetoId/vagas", verificarToken, somenteDonoDoProjeto, vagasProjetoController.criarVaga);
router.patch("/projetos/:projetoId/vagas/:vagaId", verificarToken, somenteDonoDoProjeto, vagasProjetoController.atualizarVaga);
router.delete("/projetos/:projetoId/vagas/:vagaId", verificarToken, somenteDonoDoProjeto, vagasProjetoController.apagarVaga);

// Timeline do Projeto
router.get("/projetos/:projetoId/eventos", verificarToken, somenteMembroOuDonoDoProjeto, eventosProjetoController.listarEventos);

module.exports = router;
