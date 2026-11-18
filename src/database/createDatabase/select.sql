-- 1. Usuários e Autenticação
SELECT * FROM usuarios;
SELECT * FROM tokens_revogados;
SELECT * FROM codigos_recuperacao;

-- 2. Habilidades e Funções
SELECT * FROM habilidades;
SELECT * FROM funcoes;
SELECT * FROM habilidades_usuario;
SELECT * FROM funcoes_usuario;

-- 3. Projetos, Vagas, Candidaturas e Membros
SELECT * FROM projetos;
SELECT * FROM habilidades_projeto;
SELECT * FROM vagas_projeto;
SELECT * FROM candidaturas;
SELECT * FROM membros_equipe;

-- 4. Interações, Avaliações e Reputação
SELECT * FROM avaliacoes;
SELECT * FROM mensagens;
SELECT * FROM reputacao_tecnica_usuario;
SELECT * FROM conquistas;
SELECT * FROM conquistas_usuario;
SELECT * FROM notificacoes;

-- 5. Tarefas (Kanban), Histórico e Eventos
SELECT * FROM tarefas;
SELECT * FROM habilidades_tarefa;
SELECT * FROM historico_responsaveis_tarefa;
SELECT * FROM eventos_xp;
SELECT * FROM eventos_projeto;

-- 6. Integração GitHub
SELECT * FROM github_commits;
SELECT * FROM github_pull_requests;
SELECT * FROM github_webhook_deliveries;
