/**
 * Script de Reset e População Completa de Dados Reais para TCC — MontesSquad
 * 
 * Executa:
 * 1. Limpeza segura das tabelas (TRUNCATE com FOREIGN_KEY_CHECKS = 0)
 * 2. População de dados ricos e realistas:
 *    - 8 Usuários completos (incluindo Matheus Ribeiro para login de apresentação + Admin)
 *    - 39 Habilidades e 9 Funções de mercado
 *    - 8 Projetos de software reais (abertos, em_andamento e finalizados)
 *    - Habilidades e vagas requeridas por projeto
 *    - Membros de equipe distribuídos
 *    - Candidaturas (pendentes, aceitas, rejeitadas)
 *    - Mais de 25 Tarefas no Kanban detalhadas (todo, doing, review, done) com subtasks e prazos
 *    - Avaliações realistas com notas (1 a 5) e feedbacks para cálculo de média e estrelas
 *    - Mensagens no mural do projeto
 *    - Histórico e eventos de atividade na timeline
 *    - Conquistas desbloqueadas para os usuários
 *    - Notificações realistas
 *    - Reputação técnica e gamificação (nível, XP calibrado)
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function runSeed() {
    const pool = mysql.createPool({
        host: process.env.BD_SERVIDOR,
        port: process.env.BD_PORTA || 3306,
        user: process.env.BD_USUARIO,
        password: process.env.BD_SENHA,
        database: process.env.BD_BANCO,
        multipleStatements: true,
        waitForConnections: true,
        connectionLimit: 5
    });

    const conn = await pool.getConnection();

    try {
        console.log('--- Iniciando Reset e População do Banco MontesSquad ---');
        await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

        const tablesToClear = [
            'notificacoes',
            'conquistas_usuario',
            'conquistas',
            'eventos_projeto',
            'eventos_xp',
            'github_webhook_deliveries',
            'github_pull_requests',
            'github_commits',
            'historico_responsaveis_tarefa',
            'habilidades_tarefa',
            'tarefas',
            'reputacao_tecnica_usuario',
            'mensagens',
            'avaliacoes',
            'membros_equipe',
            'candidaturas',
            'habilidades_projeto',
            'vagas_projeto',
            'projetos',
            'habilidades_usuario',
            'funcoes_usuario',
            'funcoes',
            'habilidades',
            'codigos_recuperacao',
            'tokens_revogados',
            'usuarios'
        ];

        for (const table of tablesToClear) {
            await conn.query(`TRUNCATE TABLE \`${table}\`;`);
        }
        console.log('✓ Tabelas truncadas com sucesso.');

        // Senha padrão para todos os usuários de teste: '123456'
        const passwordHash = await bcrypt.hash('123456', 10);

        // 1. Inserir Habilidades
        console.log('1. Inserindo habilidades...');
        const habilidades = [
            'Node.js', 'React', 'Python', 'Docker', 'Next.js', 'Vue.js', 'Angular',
            'TypeScript', 'JavaScript', 'HTML/CSS', 'Tailwind CSS', 'Java', 'C#',
            'Go', 'PHP', 'Ruby', 'Rust', 'Spring Boot', '.NET', 'Flutter',
            'React Native', 'Kotlin', 'Swift', 'SQL', 'PostgreSQL', 'MySQL',
            'MongoDB', 'Redis', 'Kubernetes', 'DevOps', 'AWS', 'Azure',
            'GCP', 'Linux', 'CI/CD', 'UI/UX', 'Figma', 'QA', 'Scrum'
        ];
        for (const hab of habilidades) {
            await conn.query('INSERT INTO habilidades (nome) VALUES (?)', [hab]);
        }

        // 2. Inserir Funções
        console.log('2. Inserindo funções...');
        const funcoes = [
            'Backend', 'Frontend', 'Full Stack', 'Mobile', 'QA',
            'DevOps', 'UX/UI', 'Data', 'Product'
        ];
        for (const f of funcoes) {
            await conn.query('INSERT INTO funcoes (nome) VALUES (?)', [f]);
        }

        // 3. Inserir Conquistas
        console.log('3. Inserindo conquistas padrão...');
        const conquistas = [
            [1, 'Primeiro Squad', 'Entrou ou criou o primeiro squad de projeto.', 'rocket'],
            [2, 'Top Contributor', 'Entrega constante e destaque nas tarefas concluídas.', 'trophy'],
            [3, 'Code Reviewer', 'Revisou e validou entregas de código da equipe.', 'code'],
            [4, 'Excelente Desempenho', 'Recebeu nota máxima 5 em avaliação de projeto.', 'star'],
            [5, 'Squad Builder', 'Liderou um projeto até a formação completa do squad.', 'users'],
            [6, 'Em Chamas', 'Manteve alta frequência de atividade e entregas.', 'flame']
        ];
        for (const c of conquistas) {
            await conn.query('INSERT INTO conquistas (id, titulo, descricao, icone) VALUES (?, ?, ?, ?)', c);
        }

        // 4. Inserir Usuários
        console.log('4. Inserindo usuários com perfis completos...');
        const usuarios = [
            {
                id: 1,
                nome: 'Matheus Ribeiro',
                email: 'rmatribeiro@gmail.com',
                bio: 'Desenvolvedor Full Stack apaixonado por arquitetura escalável, Node.js e ecossistemas TypeScript. Criador do MontesSquad.',
                localizacao: 'Montes Claros, MG',
                tipo: 'membro',
                nivel: 4,
                xp: 850,
                xp_para_proximo: 1000,
                media_notas: 4.80,
                total_avaliacoes: 5,
                projetos_concluidos: 3,
                funcoes_interesse: JSON.stringify([
                    { id: 1, funcao_id: 1, nivel_interesse: 'alto' },
                    { id: 3, funcao_id: 3, nivel_interesse: 'alto' }
                ]),
                disponibilidade_horas_semana: 25,
                objetivo_profissional: 'Engenheiro de Software Sênior / Arquiteto de Soluções'
            },
            {
                id: 2,
                nome: 'Lucas Mendes',
                email: 'lucas@email.com',
                bio: 'Desenvolvedor Backend especialista em microsserviços, cache distribuído com Redis e banco de dados relacional.',
                localizacao: 'São Paulo, SP',
                tipo: 'membro',
                nivel: 3,
                xp: 480,
                xp_para_proximo: 750,
                media_notas: 4.60,
                total_avaliacoes: 4,
                projetos_concluidos: 2,
                funcoes_interesse: JSON.stringify([
                    { id: 1, funcao_id: 1, nivel_interesse: 'alto' },
                    { id: 6, funcao_id: 6, nivel_interesse: 'medio' }
                ]),
                disponibilidade_horas_semana: 20,
                objetivo_profissional: 'Especialista em Backend e Infraestrutura Cloud'
            },
            {
                id: 3,
                nome: 'Fernanda Costa',
                email: 'fernanda@email.com',
                bio: 'Engenheira de Dados e Cloud. Criação de pipelines ETL, modelagem analítica e automação em nuvem AWS/GCP.',
                localizacao: 'Rio de Janeiro, RJ',
                tipo: 'membro',
                nivel: 3,
                xp: 520,
                xp_para_proximo: 750,
                media_notas: 4.90,
                total_avaliacoes: 4,
                projetos_concluidos: 2,
                funcoes_interesse: JSON.stringify([
                    { id: 8, funcao_id: 8, nivel_interesse: 'alto' },
                    { id: 6, funcao_id: 6, nivel_interesse: 'medio' }
                ]),
                disponibilidade_horas_semana: 15,
                objetivo_profissional: 'Data Platform Engineer'
            },
            {
                id: 4,
                nome: 'Roberto Almeida',
                email: 'roberto@email.com',
                bio: 'Desenvolvedor Frontend experiente em React, Tailwind CSS e Next.js. Foco em interfaces modernas, acessíveis e alta fidelidade visual.',
                localizacao: 'Curitiba, PR',
                tipo: 'membro',
                nivel: 2,
                xp: 340,
                xp_para_proximo: 500,
                media_notas: 4.50,
                total_avaliacoes: 4,
                projetos_concluidos: 2,
                funcoes_interesse: JSON.stringify([
                    { id: 2, funcao_id: 2, nivel_interesse: 'alto' },
                    { id: 7, funcao_id: 7, nivel_interesse: 'alto' }
                ]),
                disponibilidade_horas_semana: 20,
                objetivo_profissional: 'Tech Lead Frontend'
            },
            {
                id: 5,
                nome: 'Juliana Silva',
                email: 'juliana@email.com',
                bio: 'UX/UI Designer e Product Designer com sólida experiência em Design System, prototipagem no Figma e testes de usabilidade.',
                localizacao: 'Belo Horizonte, MG',
                tipo: 'membro',
                nivel: 3,
                xp: 580,
                xp_para_proximo: 750,
                media_notas: 4.75,
                total_avaliacoes: 4,
                projetos_concluidos: 2,
                funcoes_interesse: JSON.stringify([
                    { id: 7, funcao_id: 7, nivel_interesse: 'alto' },
                    { id: 9, funcao_id: 9, nivel_interesse: 'medio' }
                ]),
                disponibilidade_horas_semana: 18,
                objetivo_profissional: 'Product Design Lead'
            },
            {
                id: 6,
                nome: 'Rafael Ladeira Reyes',
                email: 'rafael.reyes@gmail.com',
                bio: 'Desenvolvedor Mobile e Engenheiro de Software. Criação de apps híbridos e nativos com Flutter e React Native.',
                localizacao: 'Florianópolis, SC',
                tipo: 'membro',
                nivel: 2,
                xp: 290,
                xp_para_proximo: 500,
                media_notas: 4.40,
                total_avaliacoes: 3,
                projetos_concluidos: 1,
                funcoes_interesse: JSON.stringify([
                    { id: 4, funcao_id: 4, nivel_interesse: 'alto' },
                    { id: 2, funcao_id: 2, nivel_interesse: 'medio' }
                ]),
                disponibilidade_horas_semana: 20,
                objetivo_profissional: 'Engenheiro Mobile Sênior'
            },
            {
                id: 7,
                nome: 'Beatriz Vasconcelos',
                email: 'beatriz.qa@email.com',
                bio: 'Especialista em Qualidade de Software (QA). Testes automatizados E2E (Cypress, Playwright), testes de carga e garantia de conformidade.',
                localizacao: 'Campinas, SP',
                tipo: 'membro',
                nivel: 2,
                xp: 260,
                xp_para_proximo: 500,
                media_notas: 4.70,
                total_avaliacoes: 3,
                projetos_concluidos: 1,
                funcoes_interesse: JSON.stringify([
                    { id: 5, funcao_id: 5, nivel_interesse: 'alto' },
                    { id: 6, funcao_id: 6, nivel_interesse: 'medio' }
                ]),
                disponibilidade_horas_semana: 15,
                objetivo_profissional: 'QA Lead / SDET'
            },
            {
                id: 8,
                nome: 'Admin MontesSquad',
                email: 'admin@email.com',
                bio: 'Administrador geral da plataforma MontesSquad. Gestão de usuários, governança de squads e suporte aos projetos.',
                localizacao: 'Montes Claros, MG',
                tipo: 'adm',
                nivel: 5,
                xp: 1500,
                xp_para_proximo: 2000,
                media_notas: 5.00,
                total_avaliacoes: 1,
                projetos_concluidos: 5,
                funcoes_interesse: null,
                disponibilidade_horas_semana: 40,
                objetivo_profissional: 'Administração de Plataforma'
            }
        ];

        for (const u of usuarios) {
            await conn.query(`
                INSERT INTO usuarios (
                    id, nome, email, senha, bio, localizacao, tipo,
                    senha_definida, token_versao, perfil_completo,
                    nivel, xp, xp_para_proximo, media_notas, total_avaliacoes,
                    projetos_concluidos, funcoes_interesse, disponibilidade_horas_semana,
                    objetivo_profissional
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                u.id, u.nome, u.email, passwordHash, u.bio, u.localizacao, u.tipo,
                u.nivel, u.xp, u.xp_para_proximo, u.media_notas, u.total_avaliacoes,
                u.projetos_concluidos, u.funcoes_interesse, u.disponibilidade_horas_semana,
                u.objetivo_profissional
            ]);
        }

        // Habilidades de cada usuário
        const userHabs = [
            // Matheus: Node.js (1), React (2), TypeScript (8), MySQL (26), Docker (4)
            [1, 1, 'avancado'], [1, 2, 'avancado'], [1, 8, 'avancado'], [1, 26, 'avancado'], [1, 4, 'intermediario'],
            // Lucas: Node.js (1), Docker (4), PostgreSQL (25), Redis (28), Linux (34)
            [2, 1, 'avancado'], [2, 4, 'avancado'], [2, 25, 'avancado'], [2, 28, 'intermediario'], [2, 34, 'avancado'],
            // Fernanda: Python (3), AWS (31), PostgreSQL (25), Docker (4), SQL (24)
            [3, 3, 'avancado'], [3, 31, 'avancado'], [3, 25, 'avancado'], [3, 4, 'intermediario'], [3, 24, 'avancado'],
            // Roberto: React (2), Next.js (5), Tailwind CSS (11), TypeScript (8), Figma (37)
            [4, 2, 'avancado'], [4, 5, 'avancado'], [4, 11, 'avancado'], [4, 8, 'intermediario'], [4, 37, 'intermediario'],
            // Juliana: UI/UX (36), Figma (37), HTML/CSS (10), Tailwind CSS (11)
            [5, 36, 'avancado'], [5, 37, 'avancado'], [5, 10, 'avancado'], [5, 11, 'intermediario'],
            // Rafael: React Native (21), Flutter (20), TypeScript (8), JavaScript (9)
            [6, 21, 'avancado'], [6, 20, 'intermediario'], [6, 8, 'avancado'], [6, 9, 'avancado'],
            // Beatriz: QA (38), CI/CD (35), Docker (4), Linux (34), Scrum (39)
            [7, 38, 'avancado'], [7, 35, 'intermediario'], [7, 4, 'intermediario'], [7, 34, 'intermediario'], [7, 39, 'avancado']
        ];
        for (const uh of userHabs) {
            await conn.query('INSERT INTO habilidades_usuario (usuario_id, habilidade_id, nivel) VALUES (?, ?, ?)', uh);
        }

        // Funções de cada usuário
        const userFuncs = [
            [1, 1, 'alto'], [1, 3, 'alto'],
            [2, 1, 'alto'], [2, 6, 'medio'],
            [3, 8, 'alto'], [3, 6, 'medio'],
            [4, 2, 'alto'], [4, 7, 'alto'],
            [5, 7, 'alto'], [5, 9, 'medio'],
            [6, 4, 'alto'], [6, 2, 'medio'],
            [7, 5, 'alto'], [7, 6, 'medio']
        ];
        for (const uf of userFuncs) {
            await conn.query('INSERT INTO funcoes_usuario (usuario_id, funcao_id, nivel_interesse) VALUES (?, ?, ?)', uf);
        }

        // Conquistas dos usuários
        const userConquistas = [
            [1, 1], [1, 2], [1, 3], [1, 4], [1, 5],
            [2, 1], [2, 2], [2, 4],
            [3, 1], [3, 4], [3, 6],
            [4, 1], [4, 2], [4, 4],
            [5, 1], [5, 4], [5, 5],
            [6, 1], [6, 4],
            [7, 1], [7, 3]
        ];
        for (const uc of userConquistas) {
            await conn.query('INSERT INTO conquistas_usuario (usuario_id, conquista_id) VALUES (?, ?)', uc);
        }

        // 5. Inserir Projetos Realistas
        console.log('5. Inserindo projetos de software...');
        const projetos = [
            {
                id: 1,
                criador_id: 1, // Matheus
                titulo: 'MontesSquad - Plataforma de Squads e Portfólio',
                descricao: 'Plataforma web colaborativa para conectar desenvolvedores, designers e entusiastas de tecnologia em squads ágeis. Gestão integrada de Kanban, mural de avisos, sistema de reputação técnica e avaliações mútuas.',
                status: 'finalizado',
                visibilidade: 'publico',
                limite_membros: 5,
                repositorio_url: 'https://github.com/matheus-ribeiro/montessquad-core',
                figma_url: 'https://figma.com/file/montessquad-design-system',
                discord_url: 'https://discord.gg/montessquad-devs',
                documentacao_url: 'https://notion.site/montessquad-docs-tcc'
            },
            {
                id: 2,
                criador_id: 1, // Matheus
                titulo: 'Sistema de Gestão Logística e Rastreio em Tempo Real',
                descricao: 'Solução corporativa integrada para frotas comerciais com telemetria via IoT, otimização de rotas com algoritmo Dijkstra e controle de despachos.',
                status: 'finalizado',
                visibilidade: 'publico',
                limite_membros: 5,
                repositorio_url: 'https://github.com/matheus-ribeiro/logistica-rotas-api',
                figma_url: 'https://figma.com/file/logistica-fleet-ui',
                discord_url: 'https://discord.gg/logistica-squad',
                documentacao_url: 'https://notion.site/logistica-rotas-docs'
            },
            {
                id: 3,
                criador_id: 2, // Lucas
                titulo: 'Gateway de Pagamentos e Pix Instantâneo',
                descricao: 'Microsserviço de alta disponibilidade e baixa latência para conciliação bancária, webhooks resilientes e cobranças instantâneas via Banco Central Pix.',
                status: 'em_andamento',
                visibilidade: 'publico',
                limite_membros: 4,
                repositorio_url: 'https://github.com/lucas-mendes/pix-gateway-microservice',
                figma_url: 'https://figma.com/file/pix-checkout-flows',
                discord_url: 'https://discord.gg/pix-gateway-devs',
                documentacao_url: 'https://swagger.io/docs/pix-gateway'
            },
            {
                id: 4,
                criador_id: 3, // Fernanda
                titulo: 'Plataforma de BI & Analytics de Vendas',
                descricao: 'Data warehouse analítico com ingestion streaming de eventos via Kafka, processamento em lote e dashboards interativos para tomada de decisão.',
                status: 'em_andamento',
                visibilidade: 'publico',
                limite_membros: 4,
                repositorio_url: 'https://github.com/fernanda-costa/sales-bi-analytics',
                figma_url: 'https://figma.com/file/sales-dashboard-wireframes',
                discord_url: 'https://discord.gg/bi-analytics-team',
                documentacao_url: 'https://notion.site/bi-pipeline-architecture'
            },
            {
                id: 5,
                criador_id: 4, // Roberto
                titulo: 'App Mobile de Delivery e Pequenos Produtores',
                descricao: 'Aplicativo móvel e painel administrativo para produtores agrícolas locais realizarem venda direta para condomínios e restaurantes com entrega programada.',
                status: 'em_andamento',
                visibilidade: 'publico',
                limite_membros: 5,
                repositorio_url: 'https://github.com/roberto-almeida/delivery-produtor-app',
                figma_url: 'https://figma.com/file/delivery-local-screens',
                discord_url: 'https://discord.gg/horta-delivery',
                documentacao_url: 'https://notion.site/delivery-local-spec'
            },
            {
                id: 6,
                criador_id: 5, // Juliana
                titulo: 'Design System & Component Library Acessível',
                descricao: 'Biblioteca modular de componentes React/TypeScript em conformidade rigorosa com normas WCAG 2.1 AA, tokens de design e documentação no Storybook.',
                status: 'aberto',
                visibilidade: 'publico',
                limite_membros: 4,
                repositorio_url: 'https://github.com/juliana-silva/zenith-design-system',
                figma_url: 'https://figma.com/file/zenith-design-tokens',
                discord_url: 'https://discord.gg/design-tokens-ui',
                documentacao_url: 'https://zenith-ui.storybook.io'
            },
            {
                id: 7,
                criador_id: 6, // Rafael
                titulo: 'Smart Gym - Gestão Inteligente de Treinos',
                descricao: 'Aplicativo mobile multiplataforma para acompanhamento de fichas de musculação, cálculo de 1RM, gráficos de progressão e recomendações de periodização.',
                status: 'aberto',
                visibilidade: 'publico',
                limite_membros: 4,
                repositorio_url: 'https://github.com/rafael-reyes/smart-gym-mobile',
                figma_url: 'https://figma.com/file/smart-gym-app-design',
                discord_url: 'https://discord.gg/smartgym-dev',
                documentacao_url: 'https://notion.site/smart-gym-api'
            },
            {
                id: 8,
                criador_id: 1, // Matheus
                titulo: 'Portal de Telemedicina e Prontuário Eletrônico',
                descricao: 'Sistema clínico completo com agendamento de consultas remotas por vídeo WebRTC, prescrição médica digitalizada e prontuário em conformidade com a LGPD.',
                status: 'aberto',
                visibilidade: 'publico',
                limite_membros: 5,
                repositorio_url: 'https://github.com/matheus-ribeiro/telemedicina-saude',
                figma_url: 'https://figma.com/file/telemedicina-doctor-patient',
                discord_url: 'https://discord.gg/saude-digital',
                documentacao_url: 'https://notion.site/telemedicina-compliance'
            }
        ];

        for (const p of projetos) {
            await conn.query(`
                INSERT INTO projetos (
                    id, criador_id, titulo, descricao, status, visibilidade,
                    permitir_portfolio_publico, limite_membros, repositorio_url,
                    figma_url, discord_url, documentacao_url
                ) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?, ?, ?)
            `, [
                p.id, p.criador_id, p.titulo, p.descricao, p.status, p.visibilidade,
                p.limite_membros, p.repositorio_url, p.figma_url, p.discord_url, p.documentacao_url
            ]);
        }

        // Habilidades exigidas por projeto
        const projHabs = [
            // P1 MontesSquad: Node.js (1), React (2), TypeScript (8), MySQL (26), Tailwind CSS (11)
            [1, 1], [1, 2], [1, 8], [1, 26], [1, 11],
            // P2 Logística: Node.js (1), TypeScript (8), Docker (4), PostgreSQL (25)
            [2, 1], [2, 8], [2, 4], [2, 25],
            // P3 Pix Gateway: Node.js (1), Docker (4), Redis (28), CI/CD (35)
            [3, 1], [3, 4], [3, 28], [3, 35],
            // P4 BI Analytics: Python (3), PostgreSQL (25), Docker (4), AWS (31)
            [4, 3], [4, 25], [4, 4], [4, 31],
            // P5 Delivery: React Native (21), Node.js (1), TypeScript (8), Figma (37)
            [5, 21], [5, 1], [5, 8], [5, 37],
            // P6 Design System: React (2), TypeScript (8), UI/UX (36), Figma (37)
            [6, 2], [6, 8], [6, 36], [6, 37],
            // P7 Smart Gym: Flutter (20), Node.js (1), PostgreSQL (25)
            [7, 20], [7, 1], [7, 25],
            // P8 Telemedicina: React (2), Node.js (1), TypeScript (8), Docker (4)
            [8, 2], [8, 1], [8, 8], [8, 4]
        ];
        for (const ph of projHabs) {
            await conn.query('INSERT INTO habilidades_projeto (projeto_id, habilidade_id) VALUES (?, ?)', ph);
        }

        // Vagas de projetos (vagas_projeto)
        const vagas = [
            // P1 MontesSquad (Finalizado)
            [1, 1, 1, 1, 1, 'Liderança técnica e arquitetura de banco de dados.', 'avancado', 'fechada'],
            [2, 1, 2, 1, 1, 'Construção da interface React e Kanban interativo.', 'avancado', 'fechada'],
            [3, 1, 7, 1, 1, 'Desenho de telas, fluxo de onboarding e usabilidade.', 'avancado', 'fechada'],
            [4, 1, 5, 1, 1, 'Testes de integração de API e validação E2E.', 'intermediario', 'fechada'],
            // P2 Logística (Finalizado)
            [5, 2, 1, 1, 1, 'Desenvolvimento das rotas de telemetria e mensageria.', 'avancado', 'fechada'],
            [6, 2, 6, 1, 1, 'Provisionamento de infraestrutura em nuvem e containers.', 'avancado', 'fechada'],
            // P3 Pix Gateway (Em andamento)
            [7, 3, 1, 2, 1, 'Implementação de rotas de liquidação e mTLS com Bacen.', 'avancado', 'aberta'],
            [8, 3, 5, 1, 1, 'Testes de estresse e resiliência de rede.', 'avancado', 'fechada'],
            // P4 BI Analytics (Em andamento)
            [9, 4, 8, 2, 1, 'Construção de pipelines de dados em Python/PySpark.', 'avancado', 'aberta'],
            [10, 4, 2, 1, 1, 'Criação de dashboards com gráficos interativos.', 'intermediario', 'fechada'],
            // P5 Delivery (Em andamento)
            [11, 5, 4, 1, 1, 'Desenvolvimento do app em React Native / Expo.', 'avancado', 'fechada'],
            [12, 5, 1, 1, 1, 'Backend REST para pedidos e geolocalização.', 'intermediario', 'fechada'],
            // P6 Design System (Aberto)
            [13, 6, 7, 2, 0, 'Criação e padronização de tokens de acessibilidade no Figma.', 'avancado', 'aberta'],
            [14, 6, 2, 2, 0, 'Implementação de componentes React reutilizáveis.', 'intermediario', 'aberta'],
            // P7 Smart Gym (Aberto)
            [15, 7, 4, 1, 0, 'Desenvolvimento mobile com Flutter / Dart.', 'intermediario', 'aberta'],
            [16, 7, 1, 1, 0, 'API Node.js com banco PostgreSQL.', 'intermediario', 'aberta'],
            // P8 Telemedicina (Aberto)
            [17, 8, 3, 2, 0, 'Desenvolvimento Fullstack de salas virtuais WebRTC.', 'avancado', 'aberta'],
            [18, 8, 5, 1, 0, 'Auditoria de segurança e conformidade LGPD.', 'avancado', 'aberta']
        ];
        for (const v of vagas) {
            await conn.query(`
                INSERT INTO vagas_projeto (
                    id, projeto_id, funcao_id, quantidade, preenchidas,
                    descricao, nivel_desejado, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, v);
        }

        // 6. Membros da Equipe (membros_equipe)
        console.log('6. Inserindo membros de squads...');
        const membros = [
            // P1 MontesSquad (Finalizado) - Matheus (Dono 1), Roberto (4), Juliana (5), Beatriz (7)
            [1, 1, 'Tech Lead & Arquiteto', 1, 1, 'ativo'],
            [4, 1, 'Engenheiro Frontend', 2, 2, 'ativo'],
            [5, 1, 'Product & UI Designer', 3, 7, 'ativo'],
            [7, 1, 'Engenheira de QA', 4, 5, 'ativo'],

            // P2 Logística (Finalizado) - Matheus (Dono 1), Lucas (2), Fernanda (3)
            [1, 2, 'Líder Técnico', 5, 1, 'ativo'],
            [2, 2, 'Engenheiro Backend', 5, 1, 'ativo'],
            [3, 2, 'Engenheira DevOps & Cloud', 6, 6, 'ativo'],

            // P3 Pix Gateway (Em andamento) - Lucas (Dono 2), Matheus (1), Beatriz (7)
            [2, 3, 'Tech Lead Backend', 7, 1, 'ativo'],
            [1, 3, 'Desenvolvedor Backend Sênior', 7, 1, 'ativo'],
            [7, 3, 'QA Automation Engineer', 8, 5, 'ativo'],

            // P4 BI Analytics (Em andamento) - Fernanda (Dono 3), Roberto (4)
            [3, 4, 'Data Lead & Architect', 9, 8, 'ativo'],
            [4, 4, 'Frontend Data Viz', 10, 2, 'ativo'],

            // P5 Delivery (Em andamento) - Roberto (Dono 4), Rafael (6), Lucas (2)
            [4, 5, 'Tech Lead & Frontend', 11, 2, 'ativo'],
            [6, 5, 'Mobile Developer', 11, 4, 'ativo'],
            [2, 5, 'Backend Developer', 12, 1, 'ativo'],

            // P6 Design System (Aberto) - Juliana (Dono 5)
            [5, 6, 'Design Lead', null, 7, 'ativo'],

            // P7 Smart Gym (Aberto) - Rafael (Dono 6)
            [6, 7, 'Mobile Lead', null, 4, 'ativo'],

            // P8 Telemedicina (Aberto) - Matheus (Dono 1)
            [1, 8, 'Product Owner & Arquiteto', null, 3, 'ativo']
        ];
        for (const m of membros) {
            await conn.query(`
                INSERT INTO membros_equipe (usuario_id, projeto_id, funcao, vaga_id, funcao_id, status)
                VALUES (?, ?, ?, ?, ?, ?)
            `, m);
        }

        // 7. Candidaturas Realistas (candidaturas)
        console.log('7. Inserindo candidaturas...');
        const candidaturas = [
            // P1
            [4, 1, 2, 'aceito', 'Tenho 3 anos de experiência com React e Tailwind, posso acelerar o desenvolvimento do Kanban.'],
            [5, 1, 3, 'aceito', 'Adorei a proposta do MontesSquad! Posso estruturar todo o Design System no Figma.'],
            [7, 1, 4, 'aceito', 'Gostaria de garantir a cobertura de testes da API e do frontend antes do lançamento.'],
            // P2
            [2, 2, 5, 'aceito', 'Já atuei em projetos de rastreamento veicular e posso apoiar nas rotas REST.'],
            [3, 2, 6, 'aceito', 'Posso configurar a automação de deploy na AWS usando Docker e GitHub Actions.'],
            // P3
            [1, 3, 7, 'aceito', 'Consigo colaborar com a arquitetura de conciliação bancária e alta concorrência.'],
            [7, 3, 8, 'aceito', 'Posso criar cenários de teste simulando instabilidade de webhooks.'],
            // P4
            [4, 4, 10, 'aceito', 'Tenho experiência com bibliotecas de gráficos (Chart.js / Recharts) para compor os dashboards.'],
            // P5
            [6, 5, 11, 'aceito', 'Tenho vivência na publicação de apps React Native na Google Play e App Store.'],
            [2, 5, 12, 'aceito', 'Posso implementar os endpoints do checkout e integração com gateways.'],
            // Candidaturas Abertas / Pendentes para demonstração de aprovação/recusa no TCC
            [2, 6, 14, 'pendente', 'Gostaria de colaborar com a implementação de componentes em React e testes no Storybook.'],
            [3, 7, 16, 'pendente', 'Posso ajudar a estruturar a base de dados relacional e a modelagem das fichas de treino.'],
            [4, 8, 17, 'pendente', 'Tenho interesse em desenvolver a interface web para os médicos e pacientes.'],
            [6, 8, 17, 'pendente', 'Gostaria de atuar no app mobile de teleconsulta.'],
            [7, 6, 13, 'rejeitado', 'Foco principal da vaga era UI Design avançado no Figma. Agradecemos o interesse!']
        ];
        for (const cand of candidaturas) {
            await conn.query(`
                INSERT INTO candidaturas (usuario_id, projeto_id, vaga_id, status, mensagem)
                VALUES (?, ?, ?, ?, ?)
            `, cand);
        }

        // 8. Tarefas do Kanban (tarefas) — mais de 25 tarefas ricas com distribuição real:
        // P1 MontesSquad (Finalizado): 5 done
        // P3 Pix Gateway (Em andamento): 5 todo, 4 done, 2 review, 3 doing (distribuição pedida)
        // P2 Logística (Finalizado): 4 done
        // P4 BI Analytics (Em andamento): 3 doing, 2 done, 2 todo
        console.log('8. Inserindo tarefas realistas no Kanban...');
        const tarefas = [
            // --- PROJETO 3: Gateway de Pagamentos e Pix Instantâneo (Demonstração detalhada de Kanban) ---
            // 5 TODO
            {
                projeto_id: 3,
                responsavel_id: null,
                titulo: 'Implementar conciliação bancária automática de fim do dia',
                descricao: 'Criar worker cron para comparar extrato OFX do Banco Central com lançamentos registrados no banco.',
                status: 'todo',
                prioridade: 'high',
                data_vencimento: '2026-12-10',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['Node.js', 'SQL']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Parser do arquivo de remessa OFX', done: false },
                    { id: 'sub-2', title: 'Tabela temporária de divergências', done: false },
                    { id: 'sub-3', title: 'Disparo de alerta via email/slack', done: false }
                ])
            },
            {
                projeto_id: 3,
                responsavel_id: 1, // Matheus
                titulo: 'Configurar autenticação mTLS para comunicação bancária',
                descricao: 'Implementar suporte a certificados digitais ICP-Brasil para conexão segura com a rede do SPI (Sistema de Pagamentos Instantâneos).',
                status: 'todo',
                prioridade: 'high',
                data_vencimento: '2026-12-08',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['Node.js', 'Linux']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Geração de certificados de homologação', done: false },
                    { id: 'sub-2', title: 'Middleware de validação de certificado do cliente', done: false }
                ])
            },
            {
                projeto_id: 3,
                responsavel_id: null,
                titulo: 'Desenvolver documentação interativa Swagger/OpenAPI 3.0',
                descricao: 'Mapear todos os endpoints de cobrança imediata, QR Code dinâmico e estorno para os parceiros integradores.',
                status: 'todo',
                prioridade: 'medium',
                data_vencimento: '2026-12-15',
                dificuldade: 'iniciante',
                habilidades: JSON.stringify(['Node.js']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Especificar esquemas de request/response no Swagger', done: false }
                ])
            },
            {
                projeto_id: 3,
                responsavel_id: 7, // Beatriz
                titulo: 'Criar suíte de testes de estresse com K6 para 5.000 req/s',
                descricao: 'Garantir que a rota de webhook do Pix suporte picos de tráfego sem perda de requisição.',
                status: 'todo',
                prioridade: 'medium',
                data_vencimento: '2026-12-18',
                dificuldade: 'intermediaria',
                habilidades: JSON.stringify(['QA', 'CI/CD']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Script de simulação em K6', done: false },
                    { id: 'sub-2', title: 'Relatório de latência p95 e p99', done: false }
                ])
            },
            {
                projeto_id: 3,
                responsavel_id: null,
                titulo: 'Adicionar rate limiting por IP e API Key com Redis',
                descricao: 'Bloquear requisições abusivas protegendo os serviços internos de negação de serviço (DDoS).',
                status: 'todo',
                prioridade: 'low',
                data_vencimento: '2026-12-20',
                dificuldade: 'intermediaria',
                habilidades: JSON.stringify(['Redis', 'Node.js']),
                subtasks: JSON.stringify([])
            },

            // 3 DOING
            {
                projeto_id: 3,
                responsavel_id: 1, // Matheus
                titulo: 'Geração de Payload e QR Code Dinâmico Pix (EMV CoDE)',
                descricao: 'Algoritmo para gerar CRC16 e codificar string EMV com chave Pix, valor, ID de transação e expiração.',
                status: 'doing',
                prioridade: 'high',
                data_vencimento: '2026-12-05',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['Node.js', 'TypeScript']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Implementar cálculo do checksum CRC16-CCITT', done: true },
                    { id: 'sub-2', title: 'Renderização do SVG e PNG do QR Code', done: true },
                    { id: 'sub-3', title: 'Testes unitários com casos de teste do Bacen', done: false }
                ])
            },
            {
                projeto_id: 3,
                responsavel_id: 2, // Lucas
                titulo: 'Fila de retentativa com backoff exponencial para Webhooks',
                descricao: 'Usar Redis e BullMQ para reenviar notificações de pagamento aos clientes em caso de falha de conexão.',
                status: 'doing',
                prioridade: 'high',
                data_vencimento: '2026-12-06',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['Redis', 'Node.js']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Configurar fila BullMQ com Redis', done: true },
                    { id: 'sub-2', title: 'Estratégia de retentativa 5x com intervalos crescentes', done: false },
                    { id: 'sub-3', title: 'Dead Letter Queue para requisições com falha permanente', done: false }
                ])
            },
            {
                projeto_id: 3,
                responsavel_id: 7, // Beatriz
                titulo: 'Automação de testes de regressão de pagamentos',
                descricao: 'Testes automatizados cobrindo fluxo completo: criação de cobrança -> pagamento simulado -> webhook entregue.',
                status: 'doing',
                prioridade: 'medium',
                data_vencimento: '2026-12-07',
                dificuldade: 'intermediaria',
                habilidades: JSON.stringify(['QA', 'Node.js']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Mocks de resposta bancária', done: true },
                    { id: 'sub-2', title: 'Validação de idempotência da transação', done: false }
                ])
            },

            // 2 REVIEW
            {
                projeto_id: 3,
                responsavel_id: 1, // Matheus
                titulo: 'Auditoria de logs e rastreamento distribuído com Correlation-ID',
                descricao: 'Injetar header X-Correlation-ID em todas as chamadas HTTP para rastrear a requisição de ponta a ponta.',
                status: 'review',
                prioridade: 'medium',
                data_vencimento: '2026-12-04',
                dificuldade: 'intermediaria',
                habilidades: JSON.stringify(['Node.js']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Middleware express de correlation id', done: true },
                    { id: 'sub-2', title: 'Sanitização de dados sensíveis nos logs (LGPD)', done: true }
                ])
            },
            {
                projeto_id: 3,
                responsavel_id: 2, // Lucas
                titulo: 'Endpoint de estorno de Pix e liquidação parcial',
                descricao: 'Implementar rota POST /pix/v2/devolucao com validação de saldo e tempo máximo permitido pelo Bacen.',
                status: 'review',
                prioridade: 'high',
                data_vencimento: '2026-12-03',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['Node.js', 'SQL']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Regra de validação de 90 dias para devolução', done: true },
                    { id: 'sub-2', title: 'Garantia de transação ACID no banco relacional', done: true }
                ])
            },

            // 4 DONE
            {
                projeto_id: 3,
                responsavel_id: 2, // Lucas
                titulo: 'Modelagem do esquema relacional de transações e contas',
                descricao: 'Criação das tabelas de clientes, chaves Pix, transações e webhooks com índices otimizados.',
                status: 'done',
                prioridade: 'high',
                data_vencimento: '2026-11-20',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['SQL', 'PostgreSQL']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Desenho do modelo conceitual e relacional', done: true },
                    { id: 'sub-2', title: 'Migration executada no ambiente de staging', done: true }
                ])
            },
            {
                projeto_id: 3,
                responsavel_id: 1, // Matheus
                titulo: 'Arquitetura base do microsserviço com Express e TypeScript',
                descricao: 'Setup do projeto, linting, prettier, tipagem estrita e estrutura em camadas (Controllers, Services, Repositories).',
                status: 'done',
                prioridade: 'high',
                data_vencimento: '2026-11-22',
                dificuldade: 'intermediaria',
                habilidades: JSON.stringify(['TypeScript', 'Node.js']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Configuração do tsconfig e build pipeline', done: true },
                    { id: 'sub-2', title: 'Padronização de respostas JSON e error handling', done: true }
                ])
            },
            {
                projeto_id: 3,
                responsavel_id: 7, // Beatriz
                titulo: 'Pipeline de CI/CD no GitHub Actions com testes unitários',
                descricao: 'Workflow automatizado que roda linter, build e testes a cada Pull Request aberto.',
                status: 'done',
                prioridade: 'medium',
                data_vencimento: '2026-11-25',
                dificuldade: 'intermediaria',
                habilidades: JSON.stringify(['CI/CD', 'Docker']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Action para execução do Jest', done: true },
                    { id: 'sub-2', title: 'Build e push de imagem Docker no registry', done: true }
                ])
            },
            {
                projeto_id: 3,
                responsavel_id: 2, // Lucas
                titulo: 'Setup do cluster Redis em container Docker',
                descricao: 'Ambiente de desenvolvimento padronizado via docker-compose para banco relacional e cache.',
                status: 'done',
                prioridade: 'medium',
                data_vencimento: '2026-11-18',
                dificuldade: 'iniciante',
                habilidades: JSON.stringify(['Docker', 'Redis']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Criação do docker-compose.yml', done: true },
                    { id: 'sub-2', title: 'Persistência de volume e credenciais seguras', done: true }
                ])
            },

            // --- PROJETO 1: MontesSquad (Finalizado) ---
            {
                projeto_id: 1,
                responsavel_id: 1, // Matheus
                titulo: 'Arquitetura do Backend e API RESTful',
                descricao: 'Construção da API completa em Node.js com Express, pool MySQL, JWT e validações de regras de negócio.',
                status: 'done',
                prioridade: 'high',
                data_vencimento: '2026-11-15',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['Node.js', 'MySQL']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Autenticação JWT com versionamento de token', done: true },
                    { id: 'sub-2', title: 'Rotas de squads, candidaturas e projetos', done: true }
                ])
            },
            {
                projeto_id: 1,
                responsavel_id: 4, // Roberto
                titulo: 'Interface Web e Kanban Interativo',
                descricao: 'Desenvolvimento do frontend SPA moderno com Vite, React, TanStack Router e Tailwind CSS.',
                status: 'done',
                prioridade: 'high',
                data_vencimento: '2026-11-20',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['React', 'Tailwind CSS']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Quadro Kanban com colunas de status', done: true },
                    { id: 'sub-2', title: 'Mural de recados e timeline de atividades', done: true }
                ])
            },
            {
                projeto_id: 1,
                responsavel_id: 5, // Juliana
                titulo: 'Design System e Prototipagem de Alta Fidelidade',
                descricao: 'Definição da paleta de cores dark mode, componentes reutilizáveis e fluxo de usuário no Figma.',
                status: 'done',
                prioridade: 'medium',
                data_vencimento: '2026-11-10',
                dificuldade: 'intermediaria',
                habilidades: JSON.stringify(['UI/UX', 'Figma']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Guia de estilos e tipografia', done: true },
                    { id: 'sub-2', title: 'Telas de detalhe do projeto e perfil', done: true }
                ])
            },
            {
                projeto_id: 1,
                responsavel_id: 7, // Beatriz
                titulo: 'Auditoria de Qualidade e Bateria de Testes Automatizados',
                descricao: 'Elaboração de mais de 35 suítes de testes cobrindo autenticação, permissões e integridade de dados.',
                status: 'done',
                prioridade: 'high',
                data_vencimento: '2026-11-24',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['QA', 'CI/CD']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Testes de integração com Supertest', done: true },
                    { id: 'sub-2', title: 'Validação de proteção de rotas e perfis', done: true }
                ])
            },
            {
                projeto_id: 1,
                responsavel_id: 1, // Matheus
                titulo: 'Módulo de Gamificação, Níveis e Reputação Técnica',
                descricao: 'Cálculo de XP por entregas verificadas, progressão de nível e cálculo ponderado de reputação técnica.',
                status: 'done',
                prioridade: 'high',
                data_vencimento: '2026-11-25',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['Node.js']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Fórmula de XP e subida de nível', done: true },
                    { id: 'sub-2', title: 'Engine de reputação por commits e merges', done: true }
                ])
            },

            // --- PROJETO 2: Sistema de Gestão Logística (Finalizado) ---
            {
                projeto_id: 2,
                responsavel_id: 1, // Matheus
                titulo: 'Mecanismo de Otimização de Rotas e Waypoints',
                descricao: 'Algoritmo para traçar o trajeto de menor custo e combustível entre pontos de entrega da transportadora.',
                status: 'done',
                prioridade: 'high',
                data_vencimento: '2026-10-30',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['Node.js']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Integração com Google Maps / OpenStreetMap', done: true }
                ])
            },
            {
                projeto_id: 2,
                responsavel_id: 2, // Lucas
                titulo: 'Microsserviço de Telemetria e Posicionamento GPS',
                descricao: 'Recepção de pacotes MQTT de rastreadores embarcados e armazenamento de coordenadas geoespaciais.',
                status: 'done',
                prioridade: 'high',
                data_vencimento: '2026-11-05',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['Node.js', 'PostgreSQL']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Broker MQTT para ingestão de coordenadas', done: true }
                ])
            },
            {
                projeto_id: 2,
                responsavel_id: 3, // Fernanda
                titulo: 'Deploy e Orquestração em Nuvem com AWS ECS e Docker',
                descricao: 'Infraestrutura segura com balanceamento de carga (ALB), autoscaling e banco PostgreSQL gerenciado.',
                status: 'done',
                prioridade: 'high',
                data_vencimento: '2026-11-12',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['AWS', 'Docker']),
                subtasks: JSON.stringify([
                    { id: 'sub-1', title: 'Terraform para criação de VPC e subnets', done: true }
                ])
            },

            // --- PROJETO 4: Plataforma de BI & Analytics (Em andamento) ---
            {
                projeto_id: 4,
                responsavel_id: 3, // Fernanda
                titulo: 'Pipeline de Extração e Carga de Vendas em Python',
                descricao: 'Script automatizado de extração das bases legadas para data lake em formato Parquet.',
                status: 'doing',
                prioridade: 'high',
                data_vencimento: '2026-12-09',
                dificuldade: 'avancada',
                habilidades: JSON.stringify(['Python', 'AWS']),
                subtasks: JSON.stringify([])
            },
            {
                projeto_id: 4,
                responsavel_id: 4, // Roberto
                titulo: 'Dashboard de Indicadores de Faturamento e Churn',
                descricao: 'Construção dos cards de métricas (MRR, LTV, CAC) e gráficos de barra com filtros por período.',
                status: 'doing',
                prioridade: 'medium',
                data_vencimento: '2026-12-11',
                dificuldade: 'intermediaria',
                habilidades: JSON.stringify(['React']),
                subtasks: JSON.stringify([])
            },
            {
                projeto_id: 4,
                responsavel_id: null,
                titulo: 'Criação de Views Materializadas para Relatórios Rápidos',
                descricao: 'Pré-agregação dos dados de vendas por filial e categoria para reduzir o tempo de query.',
                status: 'todo',
                prioridade: 'low',
                data_vencimento: '2026-12-22',
                dificuldade: 'intermediaria',
                habilidades: JSON.stringify(['SQL', 'PostgreSQL']),
                subtasks: JSON.stringify([])
            }
        ];

        let taskIndex = 1;
        for (const t of tarefas) {
            await conn.query(`
                INSERT INTO tarefas (
                    id, projeto_id, responsavel_id, titulo, descricao, status,
                    prioridade, data_vencimento, dificuldade, habilidades, subtasks,
                    concluida_em, assumida_em
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                taskIndex, t.projeto_id, t.responsavel_id, t.titulo, t.descricao, t.status,
                t.prioridade, t.data_vencimento, t.dificuldade, t.habilidades, t.subtasks,
                t.status === 'done' ? '2026-11-25 15:00:00' : null,
                t.responsavel_id ? '2026-11-15 10:00:00' : null
            ]);
            taskIndex++;
        }

        // 9. Avaliações dos Projetos Finalizados (Média de estrelas de projetos finalizados)
        console.log('9. Inserindo avaliações dos membros com feedbacks e notas...');
        const avaliacoes = [
            // P1 MontesSquad (Finalizado)
            // Roberto (4) avalia Matheus (1)
            [4, 1, 1, 5, 'Excelente liderança técnica e visão clara de arquitetura. Código limpo e apoio constante ao squad.'],
            // Juliana (5) avalia Matheus (1)
            [5, 1, 1, 5, 'Ótima comunicação e respeito às diretrizes de design. Implementou a interface com altíssima fidelidade ao Figma.'],
            // Beatriz (7) avalia Matheus (1)
            [7, 1, 1, 5, 'Facilitou a criação dos cenários de teste e corrigiu os apontamentos de segurança com extrema rapidez.'],
            // Matheus (1) avalia Roberto (4)
            [1, 4, 1, 5, 'Desenvolveu as telas do frontend com muita agilidade e domínio em React. Entrega de altíssimo nível.'],
            // Matheus (1) avalia Juliana (5)
            [1, 5, 1, 5, 'Prototipagem impecável e cuidado com a experiência do usuário. Essencial para o sucesso visual do projeto.'],
            // Matheus (1) avalia Beatriz (7)
            [1, 7, 1, 5, 'Cobertura de testes impecável, identificou cenários de borda que garantiram a estabilidade de produção.'],

            // P2 Logística (Finalizado)
            // Lucas (2) avalia Matheus (1)
            [2, 1, 2, 5, 'Domínio excelente da lógica de roteirização e facilidade para integrar com as rotas de telemetria.'],
            // Fernanda (3) avalia Matheus (1)
            [3, 1, 2, 4, 'Trabalho muito consistente no backend, com boa organização em microsserviços.'],
            // Matheus (1) avalia Lucas (2)
            [1, 2, 2, 5, 'Configuração e implementação dos fluxos assíncronos excelentes, com código limpo e testes unitários.'],
            // Matheus (1) avalia Fernanda (3)
            [1, 3, 2, 5, 'Ambiente AWS configurado sem nenhum gargalo. Deploy automatizado e monitoramento eficiente.']
        ];

        for (const a of avaliacoes) {
            await conn.query(`
                INSERT INTO avaliacoes (avaliador_id, avaliado_id, projeto_id, nota, comentario)
                VALUES (?, ?, ?, ?, ?)
            `, a);
        }

        // 10. Mensagens no Mural dos Projetos
        console.log('10. Inserindo mensagens no mural...');
        const mensagens = [
            // P1 MontesSquad (Finalizado)
            [1, 1, 'Equipe, o projeto MontesSquad foi finalizado com sucesso! Parabéns a todos pelo empenho na entrega do MVP.'],
            [4, 1, 'Sensacional trabalhar com vocês! O resultado visual e funcional ficou muito além do esperado.'],
            [5, 1, 'Orgulho desse squad! As avaliações mútuas estão liberadas na aba de avaliações.'],

            // P2 Logística (Finalizado)
            [1, 2, 'Squad, finalizamos a homologação com a transportadora parceira. Sistema em produção e 100% estável!'],
            [2, 2, 'Foi um prazer participar da implementação dos microsserviços. Valeu time!'],

            // P3 Pix Gateway (Em andamento)
            [2, 3, 'Time, iniciamos a sprint com foco na geração do QR Code Dinâmico e na fila de webhooks.'],
            [1, 3, 'O cálculo de CRC16 e formatação EMV já está quase pronto, subo o PR ainda hoje.'],
            [7, 3, 'Perfeito! Já estruturei a suíte de testes de estresse para validar a concorrência dos webhooks.']
        ];
        for (const msg of mensagens) {
            await conn.query(`
                INSERT INTO mensagens (remetente_id, projeto_id, conteudo)
                VALUES (?, ?, ?)
            `, msg);
        }

        // 11. Eventos de Atividade do Projeto (Timeline)
        console.log('11. Inserindo eventos na timeline...');
        const eventos = [
            [1, 1, 'squad_criado', 'projeto', '1', 'Matheus Ribeiro criou o squad MontesSquad', null],
            [1, 4, 'membro_entrou', 'membro', '4', 'Roberto Almeida entrou no squad como Dev Frontend', null],
            [1, 5, 'membro_entrou', 'membro', '5', 'Juliana Silva entrou no squad como UI/UX Designer', null],
            [1, 7, 'membro_entrou', 'membro', '7', 'Beatriz Vasconcelos entrou no squad como QA', null],
            [1, 1, 'projeto_finalizado', 'projeto', '1', 'Projeto finalizado com sucesso pela liderança técnica', null],

            [3, 2, 'squad_criado', 'projeto', '3', 'Lucas Mendes criou o squad do Gateway Pix', null],
            [3, 1, 'membro_entrou', 'membro', '1', 'Matheus Ribeiro entrou no squad', null],
            [3, 7, 'membro_entrou', 'membro', '7', 'Beatriz Vasconcelos entrou no squad', null],
            [3, 1, 'task_assumida', 'tarefa', '6', 'Matheus assumiu a tarefa: Geração de QR Code Dinâmico', null]
        ];
        for (const ev of eventos) {
            await conn.query(`
                INSERT INTO eventos_projeto (projeto_id, usuario_id, tipo, entidade_tipo, entidade_id, titulo, metadados)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, ev);
        }

        // 12. Notificações Realistas
        console.log('12. Inserindo notificações...');
        const notificacoes = [
            [1, 'system', 'Bem-vindo ao MontesSquad', 'Sua plataforma para formação de squads e portfólio profissional está pronta.', '/perfil', true],
            [1, 'approved', 'Candidatura aceita!', 'Lucas aprovou sua participação no squad Gateway de Pagamentos e Pix.', '/projetos/3', false],
            [1, 'task', 'Projeto Finalizado', 'O projeto MontesSquad foi marcado como finalizado. Avalie seus colegas de squad.', '/projetos/1', false],
            [2, 'application', 'Nova candidatura recebida', 'Matheus Ribeiro solicitou entrada no projeto Gateway Pix.', '/projetos/3', true],
            [4, 'task', 'Avaliação Pendente', 'O projeto MontesSquad foi finalizado. Deixe sua nota para os colegas de equipe.', '/projetos/1', false]
        ];
        for (const notif of notificacoes) {
            await conn.query(`
                INSERT INTO notificacoes (usuario_id, tipo, titulo, descricao, link, lida)
                VALUES (?, ?, ?, ?, ?, ?)
            `, notif);
        }

        // 13. Reputação Técnica Inicial
        console.log('13. Inserindo reputação técnica consolidada...');
        const reputacoes = [
            // id, score, tasks_verificadas, prs_mergeados, commits_validos, projetos_com_entrega
            [1, 240.00, 3, 2, 10, 2],
            [2, 160.00, 2, 2, 8, 1],
            [3, 110.00, 1, 1, 6, 1],
            [4, 150.00, 2, 1, 7, 1],
            [5, 90.00, 1, 1, 4, 1],
            [6, 50.00, 0, 0, 3, 1],
            [7, 120.00, 1, 2, 5, 1],
            [8, 0.00, 0, 0, 0, 0]
        ];
        for (const rep of reputacoes) {
            await conn.query(`
                INSERT INTO reputacao_tecnica_usuario (
                    usuario_id, score, tasks_verificadas, prs_mergeados,
                    commits_validos, projetos_com_entrega
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, rep);
        }

        // 14. Recalcular media_notas, total_avaliacoes e projetos_concluidos nos usuarios
        console.log('14. Sincronizando médias e estatísticas dos usuários...');
        await conn.query(`
            UPDATE usuarios u
            SET 
                media_notas = COALESCE((SELECT ROUND(AVG(nota), 2) FROM avaliacoes WHERE avaliado_id = u.id), 0.00),
                total_avaliacoes = (SELECT COUNT(*) FROM avaliacoes WHERE avaliado_id = u.id),
                projetos_concluidos = (
                    SELECT COUNT(DISTINCT p.id) 
                    FROM projetos p 
                    JOIN membros_equipe me ON me.projeto_id = p.id 
                    WHERE me.usuario_id = u.id AND p.status = 'finalizado'
                );
        `);

        await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('--- SEED CONCLUÍDO COM SUCESSO! ---');
    } catch (error) {
        console.error('Erro ao executar seed:', error);
        throw error;
    } finally {
        conn.release();
        await pool.end();
    }
}

runSeed()
    .then(() => {
        console.log('Banco pronto para apresentação de TCC!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Falha no seed:', err);
        process.exit(1);
    });
