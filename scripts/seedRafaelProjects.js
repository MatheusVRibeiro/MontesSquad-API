const pool = require('../src/database/connection');

async function seedRafaelProjects() {
    console.log('--- Populando projetos, tarefas e avaliações para a conta de Rafael (ID 6) ---');

    // 1. Inserir 2 novos projetos criados por Rafael:
    // P9: 'App FinTech - Carteira Digital & Cashback' (FINALIZADO - criado por Rafael)
    // P10: 'Educar+ - Plataforma Mobile de Microlearning Gamificado' (FINALIZADO - criado por Rafael)
    const novosProjetos = [
        {
            id: 9,
            criador_id: 6, // Rafael
            titulo: 'FinTech Mobile - Carteira Digital & Cashback',
            descricao: 'Aplicativo móvel de pagamentos por aproximação (NFC), programa de fidelidade com cashback instantâneo e integração bancária Open Finance.',
            status: 'finalizado',
            visibilidade: 'publico',
            limite_membros: 4,
            repositorio_url: 'https://github.com/rafael-reyes/fintech-digital-wallet',
            figma_url: 'https://figma.com/file/fintech-wallet-design',
            discord_url: 'https://discord.gg/fintech-squad',
            documentacao_url: 'https://notion.site/fintech-wallet-tcc'
        },
        {
            id: 10,
            criador_id: 6, // Rafael
            titulo: 'Educar+ - Microlearning Gamificado',
            descricao: 'Plataforma de aprendizado corporativo mobile-first com trilhas adaptativas, quizzes rápidos e sistema de pontuação interativo.',
            status: 'finalizado',
            visibilidade: 'publico',
            limite_membros: 4,
            repositorio_url: 'https://github.com/rafael-reyes/educar-microlearning-app',
            figma_url: 'https://figma.com/file/educar-gamified-mock',
            discord_url: 'https://discord.gg/educar-gamification',
            documentacao_url: 'https://notion.site/educar-microlearning-spec'
        }
    ];

    for (const p of novosProjetos) {
        await pool.query(`
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
    console.log('✓ Projetos 9 e 10 criados.');

    // 2. Habilidades dos projetos
    // P9: React Native (21), TypeScript (8), Node.js (1), Redis (28)
    // P10: Flutter (20), Node.js (1), UI/UX (36), MySQL (26)
    const projHabs = [
        [9, 21], [9, 8], [9, 1], [9, 28],
        [10, 20], [10, 1], [10, 36], [10, 26]
    ];
    for (const ph of projHabs) {
        await pool.query('INSERT INTO habilidades_projeto (projeto_id, habilidade_id) VALUES (?, ?)', ph);
    }

    // 3. Vagas dos projetos (vagas_projeto)
    const vagas = [
        // P9
        [19, 9, 4, 1, 1, 'Liderança técnica e arquitetura mobile React Native.', 'avancado', 'fechada'],
        [20, 9, 1, 1, 1, 'Construção da API de conciliação bancária e cashback.', 'avancado', 'fechada'],
        [21, 9, 7, 1, 1, 'Prototipação e fluxos de pagamentos no Figma.', 'intermediario', 'fechada'],
        // P10
        [22, 10, 4, 1, 1, 'Liderança técnica e arquitetura mobile Flutter.', 'avancado', 'fechada'],
        [23, 10, 7, 1, 1, 'Design de interface e testes de usabilidade.', 'avancado', 'fechada'],
        [24, 10, 5, 1, 1, 'Testes automatizados e garantia de qualidade.', 'intermediario', 'fechada']
    ];
    for (const v of vagas) {
        await pool.query(`
            INSERT INTO vagas_projeto (
                id, projeto_id, funcao_id, quantidade, preenchidas,
                descricao, nivel_desejado, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, v);
    }

    // 4. Membros da equipe
    // P9: Rafael (Dono 6), Lucas (2), Juliana (5)
    // P10: Rafael (Dono 6), Juliana (5), Beatriz (7)
    // P1 (MontesSquad): Rafael também foi membro ativo!
    const membros = [
        // P9
        [6, 9, 'Tech Lead & Arquiteto Mobile', 19, 4, 'ativo'],
        [2, 9, 'Engenheiro Backend', 20, 1, 'ativo'],
        [5, 9, 'UI/UX Designer', 21, 7, 'ativo'],
        // P10
        [6, 10, 'Tech Lead & Flutter Engineer', 22, 4, 'ativo'],
        [5, 10, 'Product Designer', 23, 7, 'ativo'],
        [7, 10, 'QA Automation', 24, 5, 'ativo'],
        // P1 (MontesSquad): adicionar Rafael como membro ativo para ele ter acesso também!
        [6, 1, 'Engenheiro Mobile Convidado', null, 4, 'ativo']
    ];
    for (const m of membros) {
        await pool.query(`
            INSERT INTO membros_equipe (usuario_id, projeto_id, funcao, vaga_id, funcao_id, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `, m);
    }
    console.log('✓ Membros dos squads inseridos.');

    // 5. Tarefas do Kanban para os projetos finalizados de Rafael (P9 e P10)
    const tarefasFinalizadas = [
        // --- PROJETO 9 (FinTech) - 5 tarefas concluídas ---
        {
            projeto_id: 9, responsavel_id: 6, titulo: 'Arquitetura do App Mobile e Módulo de Pagamento NFC',
            descricao: 'Estruturação com React Native e biblioteca nativa para pagamentos por aproximação com biometria facial/digital.',
            status: 'done', prioridade: 'high', data_vencimento: '2026-10-15', dificuldade: 'avancada',
            habilidades: JSON.stringify(['React Native', 'TypeScript']),
            subtasks: JSON.stringify([
                { id: 'sub-1', title: 'Integração com sensor biométrico', done: true },
                { id: 'sub-2', title: 'Criptografia em repouso dos cartões cadastrados', done: true }
            ])
        },
        {
            projeto_id: 9, responsavel_id: 6, titulo: 'Engine de Cálculo de Cashback Instantâneo na Carteira',
            descricao: 'Crédito imediato de percentual de recompensa com base no histórico do cliente e categoria do parceiro.',
            status: 'done', prioridade: 'high', data_vencimento: '2026-10-20', dificuldade: 'avancada',
            habilidades: JSON.stringify(['React Native', 'TypeScript']),
            subtasks: JSON.stringify([
                { id: 'sub-1', title: 'Validação de saldo mínimo e retenção', done: true }
            ])
        },
        {
            projeto_id: 9, responsavel_id: 2, titulo: 'Microsserviço de Autorização de Débito e Webhooks',
            descricao: 'Comunicação resiliente com bandeiras de cartão e ledger de transações.',
            status: 'done', prioridade: 'high', data_vencimento: '2026-10-22', dificuldade: 'avancada',
            habilidades: JSON.stringify(['Node.js', 'Redis']),
            subtasks: JSON.stringify([])
        },
        {
            projeto_id: 9, responsavel_id: 5, titulo: 'Fluxo de Onboarding e Validação de Documentos (KYC)',
            descricao: 'Prototipação de telas com captura de selfie e documento com detecção de bordas.',
            status: 'done', prioridade: 'medium', data_vencimento: '2026-10-10', dificuldade: 'intermediaria',
            habilidades: JSON.stringify(['UI/UX', 'Figma']),
            subtasks: JSON.stringify([])
        },
        {
            projeto_id: 9, responsavel_id: 6, titulo: 'Publicação de Build de Homologação no Google Play e TestFlight',
            descricao: 'Geração de certificados de produção, versionamento semântico e distribuição interna.',
            status: 'done', prioridade: 'medium', data_vencimento: '2026-10-28', dificuldade: 'intermediaria',
            habilidades: JSON.stringify(['CI/CD']),
            subtasks: JSON.stringify([])
        },

        // --- PROJETO 10 (Educar+) - 4 tarefas concluídas ---
        {
            projeto_id: 10, responsavel_id: 6, titulo: 'Engine de Gamificação Mobile com Pontos, Vidas e Streaks',
            descricao: 'Lógica em Flutter para recompensar usuários por dias consecutivos de estudo e bônus de velocidade.',
            status: 'done', prioridade: 'high', data_vencimento: '2026-09-15', dificuldade: 'avancada',
            habilidades: JSON.stringify(['Flutter']),
            subtasks: JSON.stringify([
                { id: 'sub-1', title: 'Cálculo de streak com fuso horário local', done: true },
                { id: 'sub-2', title: 'Animação de conquista desbloqueada com Lottie', done: true }
            ])
        },
        {
            projeto_id: 10, responsavel_id: 6, titulo: 'Componente de Quiz Interativo com Arrastar e Soltar',
            descricao: 'Perguntas interativas com feedback visual sonoro imediato a cada resposta.',
            status: 'done', prioridade: 'high', data_vencimento: '2026-09-20', dificuldade: 'intermediaria',
            habilidades: JSON.stringify(['Flutter', 'UI/UX']),
            subtasks: JSON.stringify([])
        },
        {
            projeto_id: 10, responsavel_id: 5, titulo: 'Ilustrações Vetoriais e Personagens Guia do App',
            descricao: 'Identidade visual lúdica para engajamento em treinamentos corporativos.',
            status: 'done', prioridade: 'medium', data_vencimento: '2026-09-10', dificuldade: 'iniciante',
            habilidades: JSON.stringify(['UI/UX', 'Figma']),
            subtasks: JSON.stringify([])
        },
        {
            projeto_id: 10, responsavel_id: 7, titulo: 'Bateria de Testes E2E de Usabilidade e Acessibilidade (TalkBack)',
            descricao: 'Garantia de leitura de tela para deficientes visuais e contraste adequado.',
            status: 'done', prioridade: 'high', data_vencimento: '2026-09-25', dificuldade: 'intermediaria',
            habilidades: JSON.stringify(['QA']),
            subtasks: JSON.stringify([])
        }
    ];

    for (const t of tarefasFinalizadas) {
        await pool.query(`
            INSERT INTO tarefas (
                projeto_id, responsavel_id, titulo, descricao, status,
                prioridade, data_vencimento, dificuldade, habilidades, subtasks,
                concluida_em, assumida_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-10-29 14:00:00', '2026-10-01 10:00:00')
        `, [
            t.projeto_id, t.responsavel_id, t.titulo, t.descricao, t.status,
            t.prioridade, t.data_vencimento, t.dificuldade, t.habilidades, t.subtasks
        ]);
    }
    console.log('✓ Tarefas concluídas dos projetos 9 e 10 inseridas.');

    // 6. Avaliações cruzadas (Estrelas e comentários de peso para Rafael)
    // Nos projetos 9 e 10, os colegas avaliam Rafael com nota 5 e 4.8.
    // Rafael também avalia os colegas!
    const novasAvaliacoes = [
        // P9: Lucas (2) avalia Rafael (6)
        [2, 6, 9, 5, 'Excelente líder técnico! Domínio impressionante de React Native e muito organizado com a divisão de tarefas.'],
        // P9: Juliana (5) avalia Rafael (6)
        [5, 6, 9, 5, 'Implementou os componentes exatamente como desenhados no Figma, com animações suaves e ótimo acabamento.'],
        // P9: Rafael (6) avalia Lucas (2)
        [6, 2, 9, 5, 'Backend de alta qualidade, respondeu com rapidez a todas as integrações de API.'],
        // P9: Rafael (6) avalia Juliana (5)
        [6, 5, 9, 5, 'Design incrível e pesquisa de usabilidade fundamental para o produto.'],

        // P10: Juliana (5) avalia Rafael (6)
        [5, 6, 10, 5, 'Trabalhar com o Rafael no Flutter foi sensacional. Código limpo e grande preocupação com UX.'],
        // P10: Beatriz (7) avalia Rafael (6)
        [7, 6, 10, 5, 'Facilitou muito o trabalho de QA, poucos bugs reportados e resolução imediata.'],
        // P10: Rafael (6) avalia Juliana (5)
        [6, 5, 10, 5, 'Protótipos de alta fidelidade entregues sempre com antecedência.'],
        // P10: Rafael (6) avalia Beatriz (7)
        [6, 7, 10, 5, 'Testes rigorosos e relatórios detalhados que elevaram a qualidade final do app.'],

        // P1: Matheus (1) avalia Rafael (6)
        [1, 6, 1, 5, 'Excelente contribuição na validação mobile do MontesSquad, squad super produtivo!'],
        // P1: Rafael (6) avalia Matheus (1)
        [6, 1, 1, 5, 'Liderança impecável no projeto MontesSquad. Comunicação clara e visão técnica sólida.']
    ];

    for (const a of novasAvaliacoes) {
        await pool.query(`
            INSERT INTO avaliacoes (avaliador_id, avaliado_id, projeto_id, nota, comentario)
            VALUES (?, ?, ?, ?, ?)
        `, a);
    }
    console.log('✓ Avaliações e estrelas registradas.');

    // 7. Mensagens nos murais de P9 e P10
    const novasMensagens = [
        // P9
        [6, 9, 'Parabéns equipe! A versão 1.0 da carteira digital foi homologada e está pronta para apresentação.'],
        [2, 9, 'Projeto entregue com 100% de sucesso. Valeu pelo squad!'],
        [5, 9, 'Orgulho do resultado final! As avaliações já estão preenchidas.'],
        // P10
        [6, 10, 'Squad, finalizamos o app Educar+ com todas as métricas atingidas!'],
        [7, 10, 'Aprovado em todos os critérios de qualidade e acessibilidade. Excelente trabalho, time!']
    ];
    for (const msg of novasMensagens) {
        await pool.query('INSERT INTO mensagens (remetente_id, projeto_id, conteudo) VALUES (?, ?, ?)', msg);
    }

    // 8. Sincronizar dados consolidados de Rafael (Nível 4, XP, Projetos Concluídos, Reputação Técnica)
    console.log('8. Atualizando perfil, gamificação e reputação de Rafael...');
    await pool.query(`
        UPDATE usuarios
        SET 
            nivel = 4,
            xp = 920,
            xp_para_proximo = 1000,
            media_notas = 4.90,
            total_avaliacoes = 5,
            projetos_concluidos = 3,
            disponibilidade_horas_semana = 25,
            objetivo_profissional = 'Tech Lead Mobile (Flutter / React Native)'
        WHERE id = 6;
    `);

    // Reputação técnica de Rafael
    await pool.query(`
        INSERT INTO reputacao_tecnica_usuario (
            usuario_id, score, tasks_verificadas, prs_mergeados,
            commits_validos, projetos_com_entrega
        ) VALUES (6, 260.00, 4, 3, 12, 3)
        ON DUPLICATE KEY UPDATE 
            score = 260.00,
            tasks_verificadas = 4,
            prs_mergeados = 3,
            commits_validos = 12,
            projetos_com_entrega = 3;
    `);

    // Conquistas de Rafael (1: Primeiro squad, 4: 5 estrelas, 5: Squad builder)
    await pool.query('INSERT IGNORE INTO conquistas_usuario (usuario_id, conquista_id) VALUES (6, 5);');

    // Recalcular médias globais com base nas novas avaliações
    await pool.query(`
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

    console.log('--- CONTA DE RAFAEL POPULADA E PRONTA COM SUCESSO! ---');
    process.exit(0);
}

seedRafaelProjects().catch(e => { console.error(e); process.exit(1); });

