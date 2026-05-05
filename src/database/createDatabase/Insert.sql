-- 1. Inserir Usuários
INSERT INTO usuarios (nome, email, senha, bio, localizacao) VALUES 
('Lucas Mendes', 'lucas@email.com', 'senha123', 'Dev Backend focado em APIs.', 'São Paulo, SP'),
('Fernanda Costa', 'fernanda@email.com', 'senha456', 'Engenheira de Dados apaixonada por cloud.', 'Rio de Janeiro, RJ'),
('Roberto Almeida', 'roberto@email.com', 'senha789', 'Desenvolvedor Frontend e UI Designer.', 'Curitiba, PR'),
('Juliana Silva', 'juliana@email.com', 'senha012', 'Fullstack Developer com foco em startups.', 'Belo Horizonte, MG');

-- 2. Inserir Habilidades
INSERT INTO habilidades (nome) VALUES 
('Node.js'), 
('React'), 
('Python'), 
('Docker');

-- 3. Inserir Projetos
INSERT INTO projetos (criador_id, titulo, descricao, status) VALUES 
(1, 'API de Gestão de Frota', 'Backend para controle de veículos e manutenções.', 'aberto'),
(2, 'Dashboard de Vendas', 'Sistema de BI para análise de faturamento.', 'em_andamento'),
(3, 'App de Delivery Local', 'Aplicativo para conectar pequenos comércios a clientes.', 'aberto'),
(4, 'Plataforma de Cursos', 'E-learning com sistema de gamificação.', 'finalizado');

-- 4. Inserir Habilidades dos Usuários
INSERT INTO habilidades_usuario (usuario_id, habilidade_id, nivel) VALUES 
(1, 1, 'avancado'),      -- Lucas sabe Node.js
(2, 3, 'avancado'),      -- Fernanda sabe Python
(3, 2, 'intermediario'), -- Roberto sabe React
(4, 4, 'iniciante');     -- Juliana sabe Docker

-- 5. Inserir Habilidades Exigidas nos Projetos
INSERT INTO habilidades_projeto (projeto_id, habilidade_id) VALUES 
(1, 1), -- Projeto API exige Node.js
(2, 3), -- Projeto Dashboard exige Python
(3, 2), -- Projeto Delivery exige React
(4, 4); -- Projeto Cursos exige Docker

-- 6. Inserir Candidaturas
INSERT INTO candidaturas (usuario_id, projeto_id, status) VALUES 
(2, 1, 'pendente'), -- Fernanda aplica para a API
(3, 1, 'aceito'),   -- Roberto é aceito na API
(4, 2, 'aceito'),   -- Juliana é aceita no Dashboard
(1, 3, 'rejeitado');-- Lucas aplica pro Delivery e é rejeitado

-- 7. Inserir Membros nas Equipes (Apenas os aceitos ou criadores)
INSERT INTO membros_equipe (usuario_id, projeto_id, funcao) VALUES 
(1, 1, 'Líder Técnico'),         -- Lucas no próprio projeto
(3, 1, 'Dev Frontend'),          -- Roberto no projeto do Lucas
(2, 2, 'Engenheira de Dados'),   -- Fernanda no próprio projeto
(4, 2, 'DevOps');                -- Juliana no projeto da Fernanda

-- 8. Inserir Avaliações (Ocorrem após o fim ou durante o projeto)
INSERT INTO avaliacoes (avaliador_id, avaliado_id, projeto_id, nota, comentario) VALUES 
(1, 3, 1, 5, 'Entregou as telas perfeitamente no prazo.'),
(3, 1, 1, 4, 'Ótimo back-end, mas a documentação poderia ser melhor.'),
(2, 4, 2, 5, 'Configurou o ambiente Docker muito rápido!'),
(4, 2, 2, 5, 'Pipeline de dados excelente e bem estruturada.');

-- 9. Inserir Mensagens
INSERT INTO mensagens (remetente_id, destinatario_id, conteudo) VALUES 
(2, 1, 'Olá Lucas, vi seu projeto de API. Posso ajudar com a parte de dados?'),
(1, 2, 'Oi Fernanda! Claro, seria ótimo ter você no time.'),
(3, 1, 'Lucas, a integração da API com o Front já está rodando.'),
(4, 2, 'Fernanda, os containers do Docker já estão na nuvem.');

-- 10. Inserir Estatísticas Consolidadas
INSERT INTO estatisticas_usuario (usuario_id, media_notas, total_avaliacoes, projetos_concluidos) VALUES 
(1, 4.00, 1, 1), -- Lucas tem 1 review com nota 4
(2, 5.00, 1, 0), -- Fernanda tem 1 review com nota 5
(3, 5.00, 1, 1), -- Roberto tem 1 review com nota 5
(4, 5.00, 1, 0); -- Juliana tem 1 review com nota 5