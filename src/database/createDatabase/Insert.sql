-- 1. Inserir Usuários (senhas armazenadas como hash bcrypt — custo 10; senha_definida=1 pois são contas locais com senha utilizável)
INSERT INTO usuarios (nome, email, senha, bio, localizacao, avatar_url, tipo, senha_definida) VALUES 
('Lucas Mendes', 'lucas@email.com', '$2b$10$mQiwd9HjKNJ0Tk0ZpGdTKuSxibJXPMscGOKWKpLsDhEeF8eq51SXG', 'Dev Backend focado em APIs.', 'São Paulo, SP', NULL, 'membro', 1),
('Fernanda Costa', 'fernanda@email.com', '$2b$10$LwVpuHzAtesBSnfar6XrAu7pFsl.TYfKUGmpPyOVToyyCbsaKlfIG', 'Engenheira de Dados apaixonada por cloud.', 'Rio de Janeiro, RJ', NULL, 'membro', 1),
('Roberto Almeida', 'roberto@email.com', '$2b$10$2FsrKJyELzOfwTwdcl6ZJeq7cKLwbuepEKlbFCZxds89FYuWaSlaO', 'Desenvolvedor Frontend e UI Designer.', 'Curitiba, PR', NULL, 'membro', 1),
('Juliana Silva', 'juliana@email.com', '$2b$10$HAP4ap.kcZ3pmIFVkUmJs.NMR53Ust0cl6vzSE33YE7njy1T9eoLe', 'Fullstack Developer com foco em startups.', 'Belo Horizonte, MG', NULL, 'membro', 1),
('Admin MontesSquad', 'admin@email.com', '$2b$10$abQLUJ/X91xIean1/z6z4.rPB453JpCmME.4Srcqo2cNl/5SNe6Sa', 'Administrador global do MontesSquad.', 'São Paulo, SP', NULL, 'adm', 1);

-- 2. Inserir Habilidades
INSERT INTO habilidades (nome) VALUES 
('Node.js'), 
('React'), 
('Python'), 
('Docker');

-- 2b. Inserir Funções de Interesse (Evolução ETAPA 3)
INSERT INTO funcoes (nome) VALUES 
('Backend'), 
('Frontend'), 
('Full Stack'), 
('Mobile'), 
('QA'), 
('DevOps'), 
('UX/UI'), 
('Data'), 
('Product');

-- 3. Inserir Projetos
INSERT INTO projetos (criador_id, titulo, descricao, status, limite_membros, repositorio_url, figma_url, discord_url, documentacao_url) VALUES 
(1, 'API de Gestão de Frota', 'Backend para controle de veículos e manutenções.', 'aberto', 6, 'https://github.com/lucas-mendes/api-gestao-frota', 'https://figma.com/file/gestao-frota-mock', 'https://discord.gg/invite-frota', 'https://notion.so/wiki-gestao-frota'),
(2, 'Dashboard de Vendas', 'Sistema de BI para análise de faturamento.', 'em_andamento', 5, 'https://github.com/fernanda-costa/dashboard-vendas', 'https://figma.com/file/dashboard-mock', 'https://discord.gg/invite-vendas', 'https://notion.so/wiki-dashboard-vendas'),
(3, 'App de Delivery Local', 'Aplicativo para conectar pequenos comércios a clientes.', 'aberto', 4, 'https://github.com/roberto-almeida/delivery-local', 'https://figma.com/file/delivery-mock', 'https://discord.gg/invite-delivery', 'https://notion.so/wiki-delivery-local'),
(4, 'Plataforma de Cursos', 'E-learning com sistema de gamificação.', 'finalizado', 4, 'https://github.com/juliana-silva/plataforma-cursos', 'https://figma.com/file/cursos-mock', 'https://discord.gg/invite-cursos', 'https://notion.so/wiki-plataforma-cursos');

-- 4. Inserir Habilidades dos Usuários
INSERT INTO habilidades_usuario (usuario_id, habilidade_id, nivel) VALUES 
(1, 1, 'avancado'),      -- Lucas sabe Node.js
(2, 3, 'avancado'),      -- Fernanda sabe Python
(3, 2, 'intermediario'), -- Roberto sabe React
(4, 4, 'iniciante');     -- Juliana sabe Docker

-- 4b. Inserir Funções de Interesse dos Usuários (Evolução ETAPA 3)
INSERT INTO funcoes_usuario (usuario_id, funcao_id, nivel_interesse) VALUES 
(1, 1, 'alto'),          -- Lucas: Backend
(2, 8, 'alto'),          -- Fernanda: Data
(3, 2, 'alto'),          -- Roberto: Frontend
(4, 3, 'alto');          -- Juliana: Full Stack

-- 4c. Inserir Vagas dos Projetos (Evolução ETAPA 4 — papéis/vagas necessárias)
INSERT INTO vagas_projeto (projeto_id, funcao_id, quantidade, preenchidas, descricao, nivel_desejado, status) VALUES 
(1, 1, 2, 1, 'APIs REST e integrações com MySQL.', 'avancado', 'aberta'),  -- API Frota: 2 Backend, 1 preenchida
(1, 3, 1, 1, 'Apoio no full stack quando necessário.', 'intermediario', 'aberta'), -- API Frota: 1 Full Stack
(2, 8, 1, 0, 'Pipeline de dados e dashboards de BI.', 'avancado', 'aberta'), -- Dashboard: 1 Data
(3, 2, 2, 0, 'Telas responsivas com React.', 'intermediario', 'aberta');   -- Delivery: 2 Frontend

-- 5. Inserir Habilidades Exigidas nos Projetos
INSERT INTO habilidades_projeto (projeto_id, habilidade_id) VALUES 
(1, 1), -- API exige Node.js
(2, 3), -- Dashboard exige Python
(3, 2), -- Delivery exige React
(4, 4); -- Cursos exige Docker

-- 6. Inserir Candidaturas
INSERT INTO candidaturas (usuario_id, projeto_id, status, mensagem) VALUES 
(2, 1, 'pendente', 'Gostaria de contribuir com a estrutura de banco de dados e rotas complexas.'),
(3, 1, 'aceito', 'Consigo codar as telas e integrar com a API.'),
(4, 2, 'aceito', 'Tenho disponibilidade para configurar as pipelines de CI/CD.'),
(1, 3, 'rejeitado', 'Foco em backend Node se precisarem.');

-- 7. Inserir Membros nas Equipes
INSERT INTO membros_equipe (usuario_id, projeto_id, funcao) VALUES 
(1, 1, 'Líder Técnico'),
(3, 1, 'Dev Frontend'),
(2, 2, 'Engenheira de Dados'),
(4, 2, 'DevOps');

-- 8. Inserir Avaliações
INSERT INTO avaliacoes (avaliador_id, avaliado_id, projeto_id, nota, comentario) VALUES 
(1, 3, 1, 5, 'Entregou as telas perfeitamente no prazo.'),
(3, 1, 1, 4, 'Ótimo back-end, mas a documentação poderia ser melhor.'),
(2, 4, 2, 5, 'Configurou o ambiente Docker muito rápido!'),
(4, 2, 2, 5, 'Pipeline de dados excelente e bem estruturada.');

-- 9. Inserir Mensagens
INSERT INTO mensagens (remetente_id, projeto_id, destinatario_id, conteudo) VALUES 
(2, 1, NULL, 'Olá time, vi o projeto de API. Posso ajudar com a parte de dados?'),
(1, 1, NULL, 'Oi pessoal! Claro, seria ótimo ter ajuda no projeto.'),
(3, 2, NULL, 'Time do dashboard, a integração já está rodando.'),
(4, 2, NULL, 'Equipe, os containers do Docker já estão na nuvem.');

-- 10. Inserir Estatísticas Consolidadas
INSERT INTO estatisticas_usuario (usuario_id, media_notas, total_avaliacoes, projetos_concluidos, nivel, xp, xp_para_proximo) VALUES 
(1, 4.00, 1, 1, 4, 620, 1000),
(2, 5.00, 1, 0, 2, 150, 500),
(3, 5.00, 1, 1, 3, 300, 750),
(4, 5.00, 1, 0, 1, 100, 250),
(5, 5.00, 0, 0, 1, 0, 250);

-- 11. Inserir Conquistas Padrão
INSERT INTO conquistas (id, titulo, descricao, icone) VALUES
(1, 'Primeiro squad', 'Participou do primeiro projeto.', 'rocket'),
(2, 'Top contributor', 'Top 3 em entregas no squad.', 'trophy'),
(3, 'Code reviewer', 'Revisou 20+ tarefas.', 'code'),
(4, '5 estrelas', 'Recebeu nota máxima de outro membro.', 'star'),
(5, 'Squad builder', 'Criou um projeto que completou squad.', 'users'),
(6, 'Streak 7 dias', 'Ativo por 7 dias seguidos.', 'flame');

-- 12. Associar Conquistas aos Usuários
INSERT INTO conquistas_usuario (usuario_id, conquista_id) VALUES
(1, 1), (1, 2), (1, 3),
(2, 1), (2, 4),
(3, 1), (3, 5),
(4, 1), (4, 6);

-- 13. Inserir Tarefas do Kanban
INSERT INTO tarefas (id, projeto_id, responsavel_id, titulo, descricao, status, prioridade, data_vencimento) VALUES
(1, 1, 1, 'Definir escopo do MVP', 'Mapear as features essenciais do projeto para o lançamento inicial.', 'done', 'high', '2026-06-15'),
(2, 1, NULL, 'Configurar repositório e CI', 'Configurar o GitHub Actions e ambiente local.', 'done', 'medium', '2026-06-18'),
(3, 1, 3, 'Modelar banco de dados', 'Desenhar o diagrama de entidades e criar o script SQL.', 'doing', 'high', '2026-06-25'),
(4, 1, NULL, 'Tela de listagem de projetos', 'Criar os componentes do feed de projetos do front-end.', 'doing', 'medium', '2026-06-30'),
(5, 1, NULL, 'Sistema de candidaturas', 'Implementar modal e formulário de inscrição rápido.', 'todo', 'low', '2026-07-05'),
(6, 1, NULL, 'Deploy em staging', 'Subir a primeira versão estável na nuvem.', 'todo', 'high', '2026-07-10');

-- 14. Inserir Subtarefas das Tarefas
INSERT INTO subtarefas (tarefa_id, titulo, concluida) VALUES
(1, 'Criar documento de requisitos', true),
(1, 'Validar com stakeholders', true),
(3, 'Criar tabelas no MySQL', true),
(3, 'Popular banco com seed inicial', false),
(4, 'Fazer mock da API', true),
(4, 'Integrar com Tailwind CSS', false);

-- 15. Inserir Notificações (seed de exemplo)
INSERT INTO notificacoes (usuario_id, tipo, titulo, descricao, link, lida) VALUES
(1, 'system', 'Bem-vindo ao MontesSquad', 'Sua conta foi criada com sucesso. Complete seu perfil!', '/perfil', true),
(2, 'application', 'Nova candidatura', 'Lucas Mendes quer entrar no projeto Dashboard de Vendas', '/projetos/2', false),
(3, 'approved', 'Candidatura aprovada', 'Sua candidatura foi aprovada no projeto API de Gestão de Frota', '/projetos/1', false),
(4, 'task', 'Nova tarefa atribuída', 'Você recebeu uma nova tarefa no projeto App de Delivery Local', '/projetos/3', false),
(1, 'message', 'Nova mensagem no projeto', 'Roberto Almeida: O banco de dados já está modelado?', '/projetos/1', false);
