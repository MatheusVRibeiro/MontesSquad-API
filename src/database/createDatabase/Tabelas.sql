-- 1. Usuários
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    bio TEXT,
    localizacao VARCHAR(100),
    avatar_url VARCHAR(500),
    github_user_id BIGINT NULL,
    github_login VARCHAR(100) NULL,
    github_avatar_url VARCHAR(500) NULL,
    github_connected_at DATETIME NULL,
    cadastro_origem ENUM('local','github') DEFAULT 'local' NOT NULL,
    senha_definida TINYINT(1) DEFAULT 0 NOT NULL,
    token_versao INT NOT NULL DEFAULT 0,
    tipo ENUM('membro', 'adm') DEFAULT 'membro' NOT NULL,
    disponibilidade_horas_semana INT NULL,
    objetivo_profissional VARCHAR(255) NULL,
    perfil_completo BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usuarios_github_user_id (github_user_id)
) ENGINE=InnoDB;

-- 1b. Tokens revogados (denylist de jti para o /logout — correção A1 da auditoria de segurança)
CREATE TABLE tokens_revogados (
    jti VARCHAR(64) NOT NULL PRIMARY KEY,
    revogado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Habilidades
CREATE TABLE habilidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

-- 3. Projetos
CREATE TABLE projetos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    criador_id INT,
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    status ENUM('aberto', 'em_andamento', 'finalizado') DEFAULT 'aberto',
    visibilidade ENUM('publico','privado') DEFAULT 'publico',
    permitir_portfolio_publico BOOLEAN DEFAULT TRUE,
    limite_membros INT DEFAULT 5 NOT NULL,
    repositorio_url VARCHAR(255) NULL,
    figma_url VARCHAR(255) NULL,
    discord_url VARCHAR(255) NULL,
    documentacao_url VARCHAR(255) NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (criador_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Habilidades do Usuário
CREATE TABLE habilidades_usuario (
    usuario_id INT,
    habilidade_id INT,
    nivel ENUM('iniciante', 'intermediario', 'avancado'),
    PRIMARY KEY (usuario_id, habilidade_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (habilidade_id) REFERENCES habilidades(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Habilidades Necessárias no Projeto
CREATE TABLE habilidades_projeto (
    projeto_id INT,
    habilidade_id INT,
    PRIMARY KEY (projeto_id, habilidade_id),
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
    FOREIGN KEY (habilidade_id) REFERENCES habilidades(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5b. Funções de interesse (Evolução ETAPA 3)
CREATE TABLE funcoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE funcoes_usuario (
    usuario_id INT NOT NULL,
    funcao_id INT NOT NULL,
    nivel_interesse ENUM('baixo', 'medio', 'alto') DEFAULT 'medio',
    PRIMARY KEY (usuario_id, funcao_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (funcao_id) REFERENCES funcoes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5c. Vagas do Projeto (Evolução ETAPA 4 — papéis/vagas necessárias no projeto)
CREATE TABLE vagas_projeto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    projeto_id INT NOT NULL,
    funcao_id INT NOT NULL,
    quantidade INT NOT NULL DEFAULT 1,
    preenchidas INT NOT NULL DEFAULT 0,
    descricao TEXT NULL,
    nivel_desejado ENUM('iniciante', 'intermediario', 'avancado', 'qualquer') DEFAULT 'qualquer',
    status ENUM('aberta', 'fechada') DEFAULT 'aberta',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
    FOREIGN KEY (funcao_id) REFERENCES funcoes(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 6. Candidaturas (Match)
CREATE TABLE candidaturas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    projeto_id INT,
    vaga_id INT NULL,
    status ENUM('pendente', 'aceito', 'rejeitado') DEFAULT 'pendente',
    mensagem TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
    FOREIGN KEY (vaga_id) REFERENCES vagas_projeto(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 7. Membros da Equipe (Squad)
CREATE TABLE membros_equipe (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    projeto_id INT,
    funcao VARCHAR(100),
    vaga_id INT NULL,
    funcao_id INT NULL,
    status ENUM('ativo', 'saiu', 'removido') DEFAULT 'ativo',
    saiu_em DATETIME NULL,
    entrou_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
    FOREIGN KEY (vaga_id) REFERENCES vagas_projeto(id) ON DELETE SET NULL,
    FOREIGN KEY (funcao_id) REFERENCES funcoes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 8. Avaliações (Reviews)
CREATE TABLE avaliacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    avaliador_id INT,
    avaliado_id INT,
    projeto_id INT,
    nota INT CHECK (nota BETWEEN 1 AND 5),
    comentario TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (avaliador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (avaliado_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. Mensagens
CREATE TABLE mensagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    remetente_id INT,
    projeto_id INT NULL,
    destinatario_id INT NULL,
    conteudo TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (remetente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
    FOREIGN KEY (destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 10. Estatísticas do Usuário (Reputação)
CREATE TABLE estatisticas_usuario (
    usuario_id INT PRIMARY KEY,
    media_notas DECIMAL(3,2) DEFAULT 0.00,
    total_avaliacoes INT DEFAULT 0,
    projetos_concluidos INT DEFAULT 0,
    nivel INT DEFAULT 1 NOT NULL,
    xp INT DEFAULT 0 NOT NULL,
    xp_para_proximo INT DEFAULT 250 NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. Tarefas (Kanban)
CREATE TABLE tarefas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    projeto_id INT NOT NULL,
    responsavel_id INT NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    status ENUM('todo', 'doing', 'review', 'done') DEFAULT 'todo' NOT NULL,
    prioridade ENUM('low', 'medium', 'high') DEFAULT 'medium' NOT NULL,
    data_vencimento DATE NULL,
    concluida_em DATETIME NULL,
    assumida_em DATETIME NULL,
    excluida_em DATETIME NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dificuldade ENUM('iniciante', 'intermediaria', 'avancada') DEFAULT 'intermediaria' NOT NULL,
    INDEX idx_tarefas_projeto_id (projeto_id),
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
    FOREIGN KEY (responsavel_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 11b. Habilidades da Tarefa (Evolução ETAPA 7 — tasks com habilidades e dificuldade)
CREATE TABLE habilidades_tarefa (
    tarefa_id INT NOT NULL,
    habilidade_id INT NOT NULL,
    PRIMARY KEY (tarefa_id, habilidade_id),
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
    FOREIGN KEY (habilidade_id) REFERENCES habilidades(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- 11. Eventos de XP (idempotente por chave)
CREATE TABLE eventos_xp (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tarefa_id INT NULL,
    tipo VARCHAR(100) NOT NULL,
    xp INT NOT NULL,
    chave_idempotencia VARCHAR(255) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_eventos_xp_chave (chave_idempotencia),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11b. Timeline de atividade do projeto (Evolução ETAPA 15 — histórico legível
-- das ações do squad; visão de produto, NÃO substitui logs técnicos). Tipo:
-- membro_entrou, membro_saiu, task_criada, task_assumida, task_abandonada,
-- commit_detectado, pr_aberto, pr_mergeado, task_concluida, reavaliacao.
CREATE TABLE eventos_projeto (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    projeto_id INT NOT NULL,
    usuario_id INT NULL,
    tipo VARCHAR(100) NOT NULL,
    entidade_tipo VARCHAR(50) NULL,
    entidade_id VARCHAR(100) NULL,
    titulo VARCHAR(255) NOT NULL,
    metadados JSON NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 12. Subtarefas (Checklist)
CREATE TABLE subtarefas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tarefa_id INT NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    concluida BOOLEAN DEFAULT FALSE NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 12b. Histórico de Responsáveis da Tarefa (Evolução ETAPA 9 — abandonar/remover/reatribuir)
CREATE TABLE historico_responsaveis_tarefa (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tarefa_id INT NOT NULL,
    usuario_id INT NOT NULL,
    acao ENUM('assumiu', 'abandonou', 'removido', 'reatribuido', 'concluiu') NOT NULL,
    realizado_por INT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (realizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 13. Conquistas (Achievements)
CREATE TABLE conquistas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(100) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    icone ENUM('trophy', 'star', 'flame', 'rocket', 'users', 'code') DEFAULT 'trophy' NOT NULL
) ENGINE=InnoDB;

-- 14. Conquistas do Usuário
CREATE TABLE conquistas_usuario (
    usuario_id INT NOT NULL,
    conquista_id INT NOT NULL,
    conquistado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, conquista_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (conquista_id) REFERENCES conquistas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 15. Notificações
CREATE TABLE notificacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo ENUM('application', 'message', 'task', 'system', 'approved') DEFAULT 'system',
    titulo VARCHAR(150),
    descricao TEXT,
    link VARCHAR(255),
    lida BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;