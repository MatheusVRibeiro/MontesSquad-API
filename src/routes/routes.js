const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

// Anti-brute-force / anti-spam nas rotas públicas sensíveis: máx. 10 requisições por IP a cada 15 minutos
const limiterRotasPublicas = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    sucesso: false,
    message: "Muitas tentativas. Tente novamente em 15 minutos.",
    dados: null,
  },
});

const usuariosController = require("../controllers/usuarios");
const projetosController = require("../controllers/projetos");
const habilidadesController = require("../controllers/habilidades");
const habilidadesUsuarioController = require("../controllers/habilidades_usuario");
const habilidadesProjetoController = require("../controllers/habilidades_projeto");
const mensagensController = require("../controllers/mensagens");
const autenticacaoController = require("../controllers/autenticacao");
const githubAuthController = require("../controllers/githubAuth");
const candidaturasController = require("../controllers/candidaturas");
const membrosController = require("../controllers/membros");
const tarefasController = require("../controllers/tarefas");
const notificacoesController = require("../controllers/notificacoes");
const reputacaoController = require("../controllers/reputacao");

const {
  verificarToken,
  somenteAdm,
  somenteDonoDoProjeto,
  somenteMembroOuDonoDoProjeto,
  somenteProprioOuAdm,
} = require("../middlewares/auth");

// ROTAS AUTENTICAÇÃO (Públicas) — com limite de tentativas
router.post("/login", limiterRotasPublicas, autenticacaoController.login);

// ROTAS PÚBLICAS — GitHub Auth (Evolução ETAPA 1: cadastro/login com GitHub)
router.get("/auth/github", githubAuthController.iniciarAuthGitHub);
router.get("/auth/github/callback", githubAuthController.callbackAuthGitHub); // GitHub redireciona
router.post("/auth/github/complete-profile", verificarToken, githubAuthController.completarPerfilGitHub);
router.post("/recuperar-senha", limiterRotasPublicas, autenticacaoController.recuperarSenha);
router.post("/resetar-senha", limiterRotasPublicas, autenticacaoController.resetarSenha);

// ROTAS USUÁRIOS
// Cadastro é aberto ao público, mas com limite de requisições por IP
router.post("/usuarios", limiterRotasPublicas, usuariosController.cadastrarUsuario);

// Apenas usuários logados podem listar e editar perfis. Apenas Adm ou o próprio usuário edita seu perfil.
router.get("/usuarios", verificarToken, usuariosController.listarUsuarios);
router.get("/usuarios/me", verificarToken, usuariosController.obterUsuarioAutenticado);
router.patch("/usuarios/:id", verificarToken, somenteProprioOuAdm, usuariosController.editarUsuario);
router.delete("/usuarios/:id", verificarToken, somenteAdm, usuariosController.apagarUsuario);

// ROTAS NOTIFICAÇÕES
router.get("/notificacoes", verificarToken, notificacoesController.listarNotificacoes);
router.post("/notificacoes/ler-tudo", verificarToken, notificacoesController.marcarTodasLidas);

// ROTAS REPUTAÇÃO
router.get("/usuarios/:id/reputacao", verificarToken, reputacaoController.obterReputacao);

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
// Dono ou membros do squad podem adicionar/atribuir tarefas
router.post("/projetos/:projetoId/tarefas", verificarToken, somenteMembroOuDonoDoProjeto, tarefasController.criarTarefa);
// Dono ou membro podem atualizar tarefas (ex: mover colunas, marcar checklist)
router.patch("/projetos/:projetoId/tarefas/:tarefaId", verificarToken, somenteMembroOuDonoDoProjeto, tarefasController.atualizarTarefa);
// Somente o dono do projeto deleta tarefas
router.delete("/projetos/:projetoId/tarefas/:tarefaId", verificarToken, somenteDonoDoProjeto, tarefasController.apagarTarefa);
// Membro/dono assume task livre (ETAPA 7)
router.post("/projetos/:projetoId/tarefas/:tarefaId/assumir", verificarToken, somenteMembroOuDonoDoProjeto, tarefasController.assumirTarefa);

// ROTAS GITHUB (integração GitHub-Kanban)
// Webhook público: autenticação por assinatura HMAC (NÃO usa verificarToken)
const githubController = require("../controllers/github");
router.post("/github/webhook", githubController.webhook);

// Conexão de repositório ao projeto — somente owner conecta/desconecta;
// membro/dono consulta o status
router.post("/projetos/:projetoId/github/repository", verificarToken, somenteDonoDoProjeto, githubController.conectarRepository);
router.get("/projetos/:projetoId/github/status", verificarToken, somenteMembroOuDonoDoProjeto, githubController.statusRepository);
router.delete("/projetos/:projetoId/github/repository", verificarToken, somenteDonoDoProjeto, githubController.desconectarRepository);
router.get("/github/installations/:installationId/repositories", verificarToken, githubController.listarRepositoriesInstalacao);

// Identidade GitHub do usuário (ETAPA 6) — OAuth com state anti-CSRF
router.get("/github/me", verificarToken, githubController.me);
router.get("/github/connect", verificarToken, githubController.connect);
// Vínculo pós-login (ETAPA 2): alias de /github/connect — o retorno do OAuth é
// sempre /github/callback (redirect_uri registrada no GitHub App)
router.get("/github/callback-link", verificarToken, githubController.callbackLink);
router.get("/github/callback", githubController.callback); // público (GitHub redireciona)
router.delete("/github/disconnect", verificarToken, githubController.disconnect);

// Status GitHub e commits da tarefa (ETAPA 8) — membro/dono
router.get("/projetos/:projetoId/tarefas/:tarefaId/github", verificarToken, somenteMembroOuDonoDoProjeto, githubController.taskGithubStatus);
router.get("/projetos/:projetoId/tarefas/:tarefaId/commits", verificarToken, somenteMembroOuDonoDoProjeto, githubController.taskCommits);
// Timeline técnica da tarefa (ETAPA 15) — membro/dono
router.get("/projetos/:projetoId/tarefas/:tarefaId/timeline", verificarToken, somenteMembroOuDonoDoProjeto, githubController.taskTimeline);

// Rankings de commits (ETAPAS 11-12)
const rankingsController = require("../controllers/rankings");
router.get("/projetos/:projetoId/rankings/committers", verificarToken, somenteMembroOuDonoDoProjeto, rankingsController.committersPorProjeto);
router.get("/rankings/committers", verificarToken, rankingsController.committersGeral);

// Rankings de contribuição (ETAPAS 13-14)
router.get("/projetos/:projetoId/rankings/contributors", verificarToken, somenteMembroOuDonoDoProjeto, rankingsController.contributorsPorProjeto);
router.get("/rankings/contributors", verificarToken, rankingsController.contributorsGeral);

module.exports = router;