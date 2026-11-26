const pool = require('../src/database/connection');

async function insertAllTasks() {
  const tasksToAdd = [
    // --- PROJETO 7: Smart Gym - Gestão Inteligente de Treinos (Criador: Rafael ID 6) ---
    // 5 To Do, 4 Done, 3 Doing, 2 Review
    {
      projeto_id: 7, responsavel_id: null, titulo: 'Criar tela de onboarding e escolha de objetivos (hipertrofia/emagrecimento)',
      descricao: 'Interface intuitiva em Flutter com questionário guiado de frequência semanal e nível de experiência.',
      status: 'todo', prioridade: 'medium', data_vencimento: '2026-12-15', dificuldade: 'iniciante',
      habilidades: JSON.stringify(['Flutter', 'UI/UX']),
      subtasks: JSON.stringify([{ id: 'sub-1', title: 'Layout responsivo no Flutter', done: false }])
    },
    {
      projeto_id: 7, responsavel_id: null, titulo: 'Integração com sensores de frequência cardíaca via Bluetooth Low Energy',
      descricao: 'Capturar batimentos por minuto em tempo real durante o descanso entre séries.',
      status: 'todo', prioridade: 'high', data_vencimento: '2026-12-20', dificuldade: 'avancada',
      habilidades: JSON.stringify(['Flutter']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 7, responsavel_id: null, titulo: 'Módulo de exportação de ficha de treino em PDF',
      descricao: 'Permitir que o aluno salve a ficha completa offline para treinar sem internet.',
      status: 'todo', prioridade: 'low', data_vencimento: '2026-12-22', dificuldade: 'iniciante',
      habilidades: JSON.stringify(['Flutter']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 7, responsavel_id: null, titulo: 'Sistema de notificações push para lembrete de hidratação e treino',
      descricao: 'Configurar Firebase Cloud Messaging (FCM) com agendamento local.',
      status: 'todo', prioridade: 'medium', data_vencimento: '2026-12-18', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['Flutter']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 7, responsavel_id: null, titulo: 'Modo escuro (Dark Theme) dinâmico e acessibilidade',
      descricao: 'Respeitar configurações do sistema operacional e suporte a fontes ampliadas.',
      status: 'todo', prioridade: 'low', data_vencimento: '2026-12-25', dificuldade: 'iniciante',
      habilidades: JSON.stringify(['Flutter', 'UI/UX']),
      subtasks: JSON.stringify([])
    },
    // Doing
    {
      projeto_id: 7, responsavel_id: 6, titulo: 'Cronômetro inteligente de intervalo entre séries com som e vibração',
      descricao: 'Contagem regressiva automática disparada ao marcar uma série como executada.',
      status: 'doing', prioridade: 'high', data_vencimento: '2026-12-05', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['Flutter']),
      subtasks: JSON.stringify([{ id: 'sub-1', title: 'Timer com background execution', done: true }, { id: 'sub-2', title: 'Feedback tátil (haptic feedback)', done: false }])
    },
    {
      projeto_id: 7, responsavel_id: 6, titulo: 'Cálculo de Carga Máxima Estimada (1RM) baseado na fórmula de Brzycki',
      descricao: 'Atualização em tempo real da estimativa de 1RM a cada carga e repetição inserida.',
      status: 'doing', prioridade: 'medium', data_vencimento: '2026-12-07', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['Flutter']),
      subtasks: JSON.stringify([{ id: 'sub-1', title: 'Função matemática com testes unitários', done: true }])
    },
    {
      projeto_id: 7, responsavel_id: 6, titulo: 'Gráficos interativos de progressão de carga por exercício',
      descricao: 'Exibir curva histórica de força com filtros por semana, mês ou ano.',
      status: 'doing', prioridade: 'high', data_vencimento: '2026-12-08', dificuldade: 'avancada',
      habilidades: JSON.stringify(['Flutter']),
      subtasks: JSON.stringify([])
    },
    // Review
    {
      projeto_id: 7, responsavel_id: 6, titulo: 'Sincronização offline e cache local com SQLite / Hive',
      descricao: 'Garantir que todos os treinos sejam registrados sem conexão e sincronizados depois.',
      status: 'review', prioridade: 'high', data_vencimento: '2026-12-03', dificuldade: 'avancada',
      habilidades: JSON.stringify(['Flutter']),
      subtasks: JSON.stringify([{ id: 'sub-1', title: 'Camada de persistência local', done: true }, { id: 'sub-2', title: 'Resolução de conflitos de sincronia', done: true }])
    },
    {
      projeto_id: 7, responsavel_id: 6, titulo: 'Biblioteca de mais de 200 exercícios com animações GIF e instruções',
      descricao: 'Catálogo de exercícios catalogados por grupo muscular (Peito, Costas, Pernas, etc.).',
      status: 'review', prioridade: 'medium', data_vencimento: '2026-12-02', dificuldade: 'iniciante',
      habilidades: JSON.stringify(['Flutter', 'UI/UX']),
      subtasks: JSON.stringify([{ id: 'sub-1', title: 'Banco de dados de exercícios', done: true }])
    },
    // Done
    {
      projeto_id: 7, responsavel_id: 6, titulo: 'Estruturação da arquitetura do app com Clean Architecture e BLoC',
      descricao: 'Separação de responsabilidades em camadas Presentation, Domain e Data.',
      status: 'done', prioridade: 'high', data_vencimento: '2026-11-20', dificuldade: 'avancada',
      habilidades: JSON.stringify(['Flutter']),
      subtasks: JSON.stringify([{ id: 'sub-1', title: 'Setup de injeção de dependência', done: true }])
    },
    {
      projeto_id: 7, responsavel_id: 6, titulo: 'Modelagem do banco de dados relacional de treinos e repetições',
      descricao: 'Definição de entidades Aluno, Ficha, Exercicio, Serie e HistoricoExecucao.',
      status: 'done', prioridade: 'high', data_vencimento: '2026-11-22', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['PostgreSQL', 'SQL']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 7, responsavel_id: 6, titulo: 'Tela de login social com Google e Apple Sign-In',
      descricao: 'Autenticação rápida para simplificar a entrada de novos usuários.',
      status: 'done', prioridade: 'medium', data_vencimento: '2026-11-24', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['Flutter']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 7, responsavel_id: 6, titulo: 'Configuração do ambiente de build automatizado no GitHub Actions',
      descricao: 'Pipeline que compila o bundle Android (.aab) e valida linting Dart.',
      status: 'done', prioridade: 'medium', data_vencimento: '2026-11-25', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['CI/CD']),
      subtasks: JSON.stringify([])
    },

    // --- PROJETO 5: App Mobile de Delivery e Pequenos Produtores (Rafael ID 6 é Membro ativo!) ---
    // 5 To Do, 4 Done, 3 Doing, 2 Review
    {
      projeto_id: 5, responsavel_id: null, titulo: 'Integração com gateway de pagamento in-app para cartão de crédito',
      descricao: 'Checkout transparente com tokenização de cartão e proteção antifraude.',
      status: 'todo', prioridade: 'high', data_vencimento: '2026-12-14', dificuldade: 'avancada',
      habilidades: JSON.stringify(['React Native', 'Node.js']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 5, responsavel_id: null, titulo: 'Cálculo dinâmico de frete por raio de distância com API do Mapbox',
      descricao: 'Determinar valor da entrega com base na quilometragem entre produtor e cliente.',
      status: 'todo', prioridade: 'medium', data_vencimento: '2026-12-16', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['Node.js']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 5, responsavel_id: null, titulo: 'Cupom de desconto para primeira compra de produtos orgânicos',
      descricao: 'Módulo de campanhas promocionais com limite de uso por CPF.',
      status: 'todo', prioridade: 'low', data_vencimento: '2026-12-18', dificuldade: 'iniciante',
      habilidades: JSON.stringify(['Node.js']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 5, responsavel_id: null, titulo: 'Avaliação por estrelas e comentários dos produtores agrícolas',
      descricao: 'Sistema de reputação para compradores avaliarem a qualidade das frutas e legumes.',
      status: 'todo', prioridade: 'medium', data_vencimento: '2026-12-21', dificuldade: 'iniciante',
      habilidades: JSON.stringify(['React Native']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 5, responsavel_id: null, titulo: 'Painel web administrativo do produtor rural para estoque',
      descricao: 'Tela de cadastro e edição de produtos, fotos e quantidades disponíveis por safra.',
      status: 'todo', prioridade: 'high', data_vencimento: '2026-12-23', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['React', 'TypeScript']),
      subtasks: JSON.stringify([])
    },
    // Doing
    {
      projeto_id: 5, responsavel_id: 6, titulo: 'Rastreamento em tempo real do entregador no mapa com Socket.IO',
      descricao: 'Atualização fluida do ícone do motorista se deslocando até o endereço de entrega.',
      status: 'doing', prioridade: 'high', data_vencimento: '2026-12-05', dificuldade: 'avancada',
      habilidades: JSON.stringify(['React Native']),
      subtasks: JSON.stringify([{ id: 'sub-1', title: 'Listener WebSocket do GPS', done: true }, { id: 'sub-2', title: 'Animação do marcador no Google Maps', done: false }])
    },
    {
      projeto_id: 5, responsavel_id: 2, titulo: 'Endpoints REST do carrinho de compras e validação de estoque',
      descricao: 'Garantir concorrência justa caso dois clientes tentem comprar a última cesta ao mesmo tempo.',
      status: 'doing', prioridade: 'high', data_vencimento: '2026-12-06', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['Node.js', 'SQL']),
      subtasks: JSON.stringify([{ id: 'sub-1', title: 'Locks de estoque durante o checkout', done: true }])
    },
    {
      projeto_id: 5, responsavel_id: 4, titulo: 'Tela de seleção de data e horário de entrega programada',
      descricao: 'Componente de calendário com janelas de entrega para condomínios residenciais.',
      status: 'doing', prioridade: 'medium', data_vencimento: '2026-12-07', dificuldade: 'iniciante',
      habilidades: JSON.stringify(['React Native']),
      subtasks: JSON.stringify([])
    },
    // Review
    {
      projeto_id: 5, responsavel_id: 6, titulo: 'Módulo de busca por geolocalização e raio de atendimento',
      descricao: 'Filtrar somente produtores que realizam entregas no CEP do usuário logado.',
      status: 'review', prioridade: 'high', data_vencimento: '2026-12-02', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['React Native']),
      subtasks: JSON.stringify([{ id: 'sub-1', title: 'Permissões de GPS no Android e iOS', done: true }])
    },
    {
      projeto_id: 5, responsavel_id: 2, titulo: 'Webhook de confirmação de entrega do entregador',
      descricao: 'Disparo de push notification e finalização automática do pedido com comprovante digital.',
      status: 'review', prioridade: 'medium', data_vencimento: '2026-12-03', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['Node.js']),
      subtasks: JSON.stringify([])
    },
    // Done
    {
      projeto_id: 5, responsavel_id: 6, titulo: 'Setup do projeto React Native com Expo, TypeScript e NativeWind',
      descricao: 'Configuração da estrutura base de pastas, roteamento com expo-router e estilos com Tailwind.',
      status: 'done', prioridade: 'high', data_vencimento: '2026-11-18', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['React Native', 'TypeScript']),
      subtasks: JSON.stringify([{ id: 'sub-1', title: 'Setup de fontes customizadas e ícones', done: true }])
    },
    {
      projeto_id: 5, responsavel_id: 4, titulo: 'Design System mobile: componentes de Card de Produto e Botões',
      descricao: 'Padronização de tipografia, cores da marca e estados de hover/press.',
      status: 'done', prioridade: 'medium', data_vencimento: '2026-11-20', dificuldade: 'iniciante',
      habilidades: JSON.stringify(['Figma', 'UI/UX']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 5, responsavel_id: 2, titulo: 'Estruturação do banco PostgreSQL com modelo geográfico PostGIS',
      descricao: 'Habilitação da extensão PostGIS para consultas por ponto geográfico ST_DWithin.',
      status: 'done', prioridade: 'high', data_vencimento: '2026-11-22', dificuldade: 'avancada',
      habilidades: JSON.stringify(['PostgreSQL', 'SQL']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 5, responsavel_id: 6, titulo: 'Fluxo completo de autenticação e persistência de token com AsyncStorage',
      descricao: 'Armazenamento seguro do JWT para manter o usuário conectado entre sessões.',
      status: 'done', prioridade: 'medium', data_vencimento: '2026-11-24', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['React Native']),
      subtasks: JSON.stringify([])
    },

    // --- PROJETO 6: Design System & Component Library Acessível (Dono: Juliana ID 5) ---
    {
      projeto_id: 6, responsavel_id: 5, titulo: 'Documentação dos tokens de acessibilidade (WCAG 2.1 AA) no Storybook',
      descricao: 'Tabela de contrastes mínimos 4.5:1 para textos e botões interativos.',
      status: 'doing', prioridade: 'high', data_vencimento: '2026-12-10', dificuldade: 'intermediaria',
      habilidades: JSON.stringify(['UI/UX', 'Figma']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 6, responsavel_id: null, titulo: 'Desenvolver componente de Modal e Dialog com foco preso (Focus Trap)',
      descricao: 'Garantir navegação 100% acessível por teclado com tecla Tab e fechamento com Esc.',
      status: 'todo', prioridade: 'high', data_vencimento: '2026-12-15', dificuldade: 'avancada',
      habilidades: JSON.stringify(['React', 'TypeScript']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 6, responsavel_id: 5, titulo: 'Prototipação da biblioteca de ícones vetoriais no Figma',
      descricao: 'Conjunto com mais de 80 ícones consistentes com grid de 24x24px.',
      status: 'done', prioridade: 'medium', data_vencimento: '2026-11-25', dificuldade: 'iniciante',
      habilidades: JSON.stringify(['Figma']),
      subtasks: JSON.stringify([])
    },

    // --- PROJETO 8: Portal de Telemedicina e Prontuário Eletrônico (Dono: Matheus ID 1) ---
    {
      projeto_id: 8, responsavel_id: 1, titulo: 'Implementação da sala virtual de teleconsulta com WebRTC e Socket',
      descricao: 'Conexão ponto a ponto criptografada com transmissão de áudio e vídeo de baixa latência.',
      status: 'doing', prioridade: 'high', data_vencimento: '2026-12-12', dificuldade: 'avancada',
      habilidades: JSON.stringify(['Node.js', 'React']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 8, responsavel_id: null, titulo: 'Assinatura digital de receitas médicas com certificado ICP-Brasil A1/A3',
      descricao: 'Integração com serviço de carimbo do tempo e geração de PDF assinado digitalmente.',
      status: 'todo', prioridade: 'high', data_vencimento: '2026-12-18', dificuldade: 'avancada',
      habilidades: JSON.stringify(['Node.js']),
      subtasks: JSON.stringify([])
    },
    {
      projeto_id: 8, responsavel_id: 1, titulo: 'Modelagem do prontuário eletrônico do paciente (PEP) em conformidade LGPD',
      descricao: 'Criptografia em repouso dos dados de saúde e trilha de auditoria de acessos aos registros.',
      status: 'done', prioridade: 'high', data_vencimento: '2026-11-26', dificuldade: 'avancada',
      habilidades: JSON.stringify(['MySQL', 'Node.js']),
      subtasks: JSON.stringify([])
    }
  ];

  for (const t of tasksToAdd) {
    await pool.query(
      `INSERT INTO tarefas (
        projeto_id, responsavel_id, titulo, descricao, status,
        prioridade, data_vencimento, dificuldade, habilidades, subtasks,
        concluida_em, assumida_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.projeto_id, t.responsavel_id, t.titulo, t.descricao, t.status,
        t.prioridade, t.data_vencimento, t.dificuldade, t.habilidades, t.subtasks,
        t.status === 'done' ? '2026-11-25 15:00:00' : null,
        t.responsavel_id ? '2026-11-15 10:00:00' : null
      ]
    );
  }

  console.log('Todas as tarefas foram inseridas com sucesso!');
  process.exit(0);
}

insertAllTasks().catch(e => { console.error(e); process.exit(1); });
