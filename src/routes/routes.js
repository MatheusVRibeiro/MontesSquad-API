const express = require("express");
const router = express.Router();

const usuariosController = require("../controllers/usuarios");
const projetosController = require("../controllers/projetos");
const habilidadesController = require("../controllers/habilidades");
const habilidadesUsuarioController = require("../controllers/habilidades_usuario");
const habilidadesProjetoController = require("../controllers/habilidades_projeto");
const mensagensController = require("../controllers/mensagens");
const autenticacaoController = require("../controllers/autenticacao");
const candidaturasController = require("../controllers/candidaturas");
const membrosController = require("../controllers/membros");
const tarefasController = require("../controllers/tarefas");

const {
  verificarToken,
  somenteAdm,
  somenteDonoDoProjeto,
  somenteMembroOuDonoDoProjeto,
} = require("../middlewares/auth");

// ROTAS AUTENTICAÇÃO (Públicas)
router.post("/login", autenticacaoController.login);
router.post("/recuperar-senha", autenticacaoController.recuperarSenha);
router.post("/resetar-senha", autenticacaoController.resetarSenha);

// ROTAS USUÁRIOS
// Cadastro é aberto ao público
router.post("/usuarios", usuariosController.cadastrarUsuario);

// Apenas usuários logados podem listar e editar perfis. Apenas Adm ou o próprio usuário edita seu perfil.
router.get("/usuarios", verificarToken, usuariosController.listarUsuarios);
router.patch("/usuarios/:id", verificarToken, usuariosController.editarUsuario);
router.delete("/usuarios/:id", verificarToken, somenteAdm, usuariosController.apagarUsuario);

// ROTAS PROJETOS
// Todos logados podem explorar projetos
router.get("/projetos", verificarToken, projetosController.listarProjetos);
// Obter detalhes de um projeto específico
router.get("/projetos/:id", verificarToken, projetosController.obterProjeto);
// Qualquer membro logado pode cadastrar um novo projeto
router.post("/projetos", verificarToken, projetosController.cadastrarProjeto);
// Apenas o dono do projeto pode editar ou apagar
router.patch("/projetos/:id", verificarToken, somenteDonoDoProjeto, projetosController.editarProjeto);
router.delete("/projetos/:id", verificarToken, somenteDonoDoProjeto, projetosController.apagarProjeto);

// ROTAS HABILIDADES (GLOBAL)
// Listar habilidades é livre para usuários logados
router.get("/habilidades", verificarToken, habilidadesController.listarHabilidades);
// Apenas administrador geral administra a base de habilidades global
router.post("/habilidades", verificarToken, somenteAdm, habilidadesController.cadastrarHabilidade);
router.patch("/habilidades/:id", verificarToken, somenteAdm, habilidadesController.editarHabilidade);
router.delete("/habilidades/:id", verificarToken, somenteAdm, habilidadesController.apagarHabilidade);

// ROTAS HABILIDADES USUÁRIO
router.get("/habilidades-usuario", verificarToken, habilidadesUsuarioController.listarHabilidadesUsuario);
router.post("/habilidades-usuario", verificarToken, habilidadesUsuarioController.cadastrarHabilidadesUsuario);
router.patch("/habilidades-usuario/:id", verificarToken, habilidadesUsuarioController.editarHabilidadesUsuario);
router.delete("/habilidades-usuario/:id", verificarToken, habilidadesUsuarioController.apagarHabilidadesUsuario);

// ROTAS HABILIDADES PROJETO (Somente o dono do projeto pode alterar as tecnologias necessárias)
router.get("/habilidades-projeto", verificarToken, habilidadesProjetoController.listarHabilidadesProjeto);
router.post("/habilidades-projeto", verificarToken, somenteDonoDoProjeto, habilidadesProjetoController.cadastrarHabilidadesProjeto);
router.patch("/habilidades-projeto/:id", verificarToken, somenteDonoDoProjeto, habilidadesProjetoController.editarHabilidadesProjeto);
router.delete("/habilidades-projeto/:id", verificarToken, somenteDonoDoProjeto, habilidadesProjetoController.apagarHabilidadesProjeto);

// ROTAS MENSAGENS DO PROJETO (MURAL)
// Apenas membros ou o dono do projeto podem ler/escrever no mural do respectivo projeto
router.get("/projetos/:projetoId/mensagens", verificarToken, somenteMembroOuDonoDoProjeto, mensagensController.listarMensagensProjeto);
router.post("/projetos/:projetoId/mensagens", verificarToken, somenteMembroOuDonoDoProjeto, mensagensController.enviarMensagemProjeto);

// ROTAS CANDIDATURAS (MATCH)
// Qualquer membro logado pode solicitar entrada em um projeto
router.post("/projetos/:projetoId/candidaturas", verificarToken, candidaturasController.candidatarSe);
// Somente o dono do projeto vê as solicitações de entrada pendentes
router.get("/projetos/:projetoId/candidaturas", verificarToken, somenteDonoDoProjeto, candidaturasController.listarCandidaturas);
// Somente o dono do projeto aprova ou rejeita candidatos
router.patch("/projetos/:projetoId/candidaturas/:candidaturaId", verificarToken, somenteDonoDoProjeto, candidaturasController.atualizarStatusCandidatura);

// ROTAS MEMBROS DO SQUAD
// Qualquer logado pode listar membros de um squad
router.get("/projetos/:projetoId/membros", verificarToken, membrosController.listarMembros);
// Somente o dono do projeto remove membros do squad
router.delete("/projetos/:projetoId/membros/:usuarioId", verificarToken, somenteDonoDoProjeto, membrosController.removerMembro);

// ROTAS KANBAN TAREFAS
// Somente dono ou membros do squad podem ver tarefas
router.get("/projetos/:projetoId/tarefas", verificarToken, somenteMembroOuDonoDoProjeto, tarefasController.listarTarefas);
// Somente o dono do projeto adiciona/atribui tarefas
router.post("/projetos/:projetoId/tarefas", verificarToken, somenteDonoDoProjeto, tarefasController.criarTarefa);
// Dono ou membro podem atualizar tarefas (ex: mover colunas, marcar checklist)
router.patch("/projetos/:projetoId/tarefas/:tarefaId", verificarToken, somenteMembroOuDonoDoProjeto, tarefasController.atualizarTarefa);
// Somente o dono do projeto deleta tarefas
router.delete("/projetos/:projetoId/tarefas/:tarefaId", verificarToken, somenteDonoDoProjeto, tarefasController.apagarTarefa);

module.exports = router;