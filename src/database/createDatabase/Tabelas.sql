-- 1. Usuários
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    bio TEXT,
    localizacao VARCHAR(100),
    tipo ENUM('membro', 'adm') DEFAULT 'membro' NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    limite_membros INT DEFAULT 5 NOT NULL,
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

-- 6. Candidaturas (Match)
CREATE TABLE candidaturas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    projeto_id INT,
    status ENUM('pendente', 'aceito', 'rejeitado') DEFAULT 'pendente',
    mensagem TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Membros da Equipe (Squad)
CREATE TABLE membros_equipe (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    projeto_id INT,
    funcao VARCHAR(100),
    entrou_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
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
    status ENUM('todo', 'doing', 'done') DEFAULT 'todo' NOT NULL,
    prioridade ENUM('low', 'medium', 'high') DEFAULT 'medium' NOT NULL,
    data_vencimento DATE NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
    FOREIGN KEY (responsavel_id) REFERENCES usuarios(id) ON DELETE SET NULL
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