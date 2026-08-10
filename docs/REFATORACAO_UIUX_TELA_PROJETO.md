# MontesSquad — Refatoração UI/UX da Tela de Projeto

> Documento operacional para execução da refatoração da tela de detalhes de projeto do frontend `MatheusVRibeiro/squad-hub`.

---

# 1. Objetivo geral

Refatorar a tela de detalhes do projeto para priorizar o trabalho diário do squad, reduzir a carga cognitiva e melhorar a hierarquia visual sem quebrar nenhuma funcionalidade existente.

A regra de produto desta refatoração é:

> **O usuário entra no projeto para trabalhar. O Kanban deve aparecer primeiro; configurações, rankings e informações administrativas devem ficar em segundo plano.**

A tela deve sair de uma hierarquia parecida com:

```text
Projeto
↓
Privacidade
↓
Links
↓
GitHub
↓
Top Contributors
↓
Top Committers
↓
Kanban
```

para:

```text
Projeto
↓
Kanban | Atividade | Equipe | GitHub | Insights
↓
Kanban imediatamente disponível
```

---

# 2. Contexto real já identificado no frontend

Repositório:

```text
MatheusVRibeiro/squad-hub
```

Rota principal da tela:

```text
src/routes/projetos.$id.tsx
```

Componentes existentes que devem ser preservados e reutilizados:

```text
src/components/projects/KanbanBoard.tsx
src/components/projects/TasksRecomendadas.tsx
src/components/projects/GithubProjectPanel.tsx
src/components/projects/TopCommitters.tsx
src/components/projects/TopContributors.tsx
src/components/projects/Mural.tsx
src/components/projects/MembersList.tsx
src/components/projects/Applications.tsx
src/components/projects/Vagas.tsx
src/components/projects/ProjectTimeline.tsx
```

Services/regras já existentes na rota e que não devem ser duplicados:

```text
fetchProjectDetail
closeProjectLocal
atualizarVisibilidadeProjeto
atualizarLinksProjeto
candidatarComVaga
sairDoProjeto
notificationsIntegration
useAuth
useQuery
useMutation
useQueryClient
```

Permissões existentes que precisam permanecer baseadas em ID:

```text
isOwner
isMember
```

Não substituir por comparação por nome.

---

# 3. Regra absoluta de execução

Executar uma etapa por vez.

## 3.1 Não avançar com etapa incompleta

Uma etapa somente é considerada concluída quando:

```text
[ ] alterações planejadas foram feitas
[ ] nenhuma funcionalidade existente foi perdida
[ ] TypeScript compila
[ ] lint passa, quando aplicável
[ ] testes relacionados passam
[ ] loading/error states continuam funcionando
[ ] permissões foram verificadas
[ ] layout foi validado visualmente
[ ] responsividade foi verificada
[ ] regressões foram verificadas
[ ] não existem pendências bloqueantes
```

Se algum item falhar, a etapa continua em execução.

## 3.2 Subagentes

Subagentes podem executar tarefas independentes da mesma etapa.

Não permitir dois subagentes editando o mesmo arquivo simultaneamente.

Enquanto aguarda subagentes da etapa atual, o agente principal pode:

- analisar arquivos da próxima etapa;
- mapear dependências;
- planejar alterações;
- preparar testes;
- decidir distribuição de trabalho.

Mas não pode implementar a próxima etapa até fechar o gate da atual.

---

# 4. ETAPA 0 — Baseline e auditoria completa

## Objetivo

Registrar o funcionamento atual para impedir que a refatoração visual quebre regras já implementadas.

## Arquivos a analisar

Obrigatórios:

```text
src/routes/projetos.$id.tsx
src/components/projects/KanbanBoard.tsx
src/components/projects/TasksRecomendadas.tsx
src/components/projects/GithubProjectPanel.tsx
src/components/projects/TopCommitters.tsx
src/components/projects/TopContributors.tsx
src/components/projects/Mural.tsx
src/components/projects/MembersList.tsx
src/components/projects/Applications.tsx
src/components/projects/Vagas.tsx
src/components/projects/ProjectTimeline.tsx
src/services/projectDetail.ts
src/services/candidaturas.ts
src/services/membros.ts
```

## O que mapear

- imports da rota;
- queries;
- mutations;
- estados locais;
- modais/dialogs;
- regras `isOwner` e `isMember`;
- loading;
- error state;
- candidatura;
- sair do projeto;
- encerrar projeto;
- privacidade;
- links;
- GitHub;
- rankings;
- tarefas recomendadas;
- mural;
- membros;
- vagas;
- candidaturas.

## Alterações

Nenhuma alteração funcional nesta etapa.

## Critério de conclusão

A etapa termina somente após existir um mapa claro de quais componentes e handlers são responsáveis por cada funcionalidade.

---

# 5. ETAPA 1 — Reorganizar a hierarquia da rota

## Objetivo

Transformar `src/routes/projetos.$id.tsx` de uma página vertical com muitas seções em uma tela organizada por áreas de trabalho.

## Arquivo obrigatório a alterar

```text
src/routes/projetos.$id.tsx
```

## Estrutura desejada

```text
ProjectDetailPage
│
├── ProjectHeader
├── ProjectNavigation
│
├── KanbanSection
│   ├── KanbanBoard
│   └── TasksRecomendadas
│
├── ActivitySection
│   ├── ProjectTimeline
│   └── Mural
│
├── TeamSection
│   ├── MembersList
│   ├── Vagas
│   └── Applications
│
├── GithubSection
│   └── GithubProjectPanel
│
├── InsightsSection
│   ├── TopContributors
│   └── TopCommitters
│
└── ProjectSettings
    ├── Privacidade
    ├── Links
    └── Encerrar projeto
```

## O que deve mudar

Remover do fluxo vertical principal:

- Privacidade;
- Área de Trabalho do Squad;
- GithubProjectPanel expandido;
- TopContributors;
- TopCommitters.

Todos continuarão existindo, apenas serão reposicionados.

## O que não deve mudar

- queries existentes;
- mutations existentes;
- serviços existentes;
- regras de owner/membro/visitante;
- endpoints.

## Gate

A rota deve continuar carregando e todos os componentes ainda devem estar acessíveis antes de seguir.

---

# 6. ETAPA 2 — Criar cabeçalho compacto do projeto

## Objetivo

Reduzir o espaço vertical utilizado pelo cabeçalho e deixar apenas informações importantes para leitura rápida.

## Arquivos a alterar

Obrigatório:

```text
src/routes/projetos.$id.tsx
```

Opcional, se a extração realmente reduzir a complexidade:

```text
src/components/projects/ProjectHeader.tsx
```

## Conteúdo obrigatório no novo header

- nome do projeto;
- status;
- descrição curta;
- tecnologias;
- total de membros / limite;
- data de criação;
- criador;
- status resumido GitHub;
- ações principais.

## Exemplo visual

```text
API DE PAGAMENTOS                               Aberto

API de testes para processamento e conciliação.

Node.js   React   TypeScript

1/5 membros · Criado por Matheus · 10/08/2026
GitHub: MatheusVRibeiro/api-pagamentos ✓

[ + Nova tarefa ] [ Convidar ] [ ... ]
```

## O que remover do header

- controles completos de privacidade;
- inputs de links;
- formulário completo GitHub;
- rankings;
- botões destrutivos com destaque principal.

## Critério de conclusão

Em desktop comum, o cabeçalho não deve empurrar o Kanban para fora da primeira área visível sem necessidade.

---

# 7. ETAPA 3 — Reorganizar ações do projeto

## Objetivo

Dar maior destaque a ações frequentes e menor destaque a ações administrativas/destrutivas.

## Arquivo a alterar

```text
src/routes/projetos.$id.tsx
```

## Ações frequentes

Expor diretamente quando aplicável:

```text
+ Nova tarefa
Convidar
```

## Ações administrativas

Mover para menu `...`:

```text
Editar projeto
Gerenciar links
Privacidade
Configurar GitHub
Sair do projeto        // somente membro não-owner
Encerrar projeto       // somente owner
```

## Preservar handlers existentes

```text
handleCloseProject
handleLeaveProject
```

Não duplicar essas funções.

## Critério de conclusão

Nenhuma ação destrutiva deve competir visualmente com `Nova tarefa`.

---

# 8. ETAPA 4 — Criar navegação principal do projeto

## Objetivo

Reduzir a quantidade de opções de primeiro nível.

## Arquivo a alterar

```text
src/routes/projetos.$id.tsx
```

## Navegação principal

Criar:

```text
Kanban
Atividade
Equipe
GitHub
Insights
```

Kanban deve ser a aba padrão.

## Não manter no primeiro nível

```text
Mural
Membros
Vagas
Recomendadas
Candidaturas
```

Esses elementos serão agrupados nas novas áreas.

## Sticky

Tornar a navegação sticky se não houver conflito com o `AppLayout`.

Calcular corretamente o offset do topbar/header global.

## Critério de conclusão

Ao entrar no projeto, a aba ativa deve ser Kanban.

---

# 9. ETAPA 5 — Colocar o Kanban no centro da experiência

## Objetivo

Fazer o principal espaço operacional aparecer imediatamente após o header e navegação.

## Arquivos a alterar

```text
src/routes/projetos.$id.tsx
src/components/projects/KanbanBoard.tsx   // apenas se necessário para ajustes visuais
```

## Reutilizar obrigatoriamente

```text
KanbanBoard
```

## Não reimplementar

- drag and drop;
- criação de task;
- alteração de status;
- atribuição;
- subtarefas;
- notificações;
- integração GitHub da task;
- regras de XP.

## Layout alvo

```text
Quadro de tarefas                          8 tarefas

[ busca ]   [ responsável ] [ prioridade ]

A fazer | Em progresso | Em revisão | Concluído
```

## Critério de conclusão

O topo do Kanban deve aparecer imediatamente após a navegação do projeto.

---

# 10. ETAPA 6 — Melhorar a toolbar do Kanban

## Objetivo

Facilitar localização de tarefas sem introduzir filtros sem suporte de dados.

## Arquivo a alterar

Preferencialmente:

```text
src/components/projects/KanbanBoard.tsx
```

ou criar, se fizer sentido:

```text
src/components/projects/KanbanToolbar.tsx
```

## Implementar apenas filtros suportados pelo modelo atual

Prioridade:

```text
Busca por título
Responsável
Prioridade
```

Não criar filtros fictícios como `Backend`, `Bug`, `Frontend` se esses campos não existirem no contrato da tarefa.

## Critério de conclusão

Filtros devem funcionar apenas no frontend sem alterar persistência da task.

---

# 11. ETAPA 7 — Refatorar visual dos cards das tarefas

## Objetivo

Reduzir ruído e melhorar leitura rápida.

## Arquivo a alterar

```text
src/components/projects/KanbanBoard.tsx
```

## Prioridade visual do card

1. título;
2. prioridade;
3. prazo;
4. responsável;
5. subtarefas;
6. evidência GitHub;
7. detalhes secundários.

## Regra importante

Não manter duas ações equivalentes para assumir uma tarefa.

Se houver atualmente dois elementos como:

```text
PEGAR TAREFA
Assumir tarefa
```

consolidar em:

```text
[ Assumir tarefa ]
```

## Exemplo

```text
API pública                         Baixa

Criar endpoint público...

12/out · Sem responsável

[ Assumir tarefa ]
```

Assumida:

```text
API pública                         Baixa

Matheus Ribeiro · 12/out

GitHub: task/21-api-publica
2 commits
```

## Preservar

Todos os handlers e mutations existentes do Kanban.

---

# 12. ETAPA 8 — Reposicionar TasksRecomendadas

## Objetivo

Retirar `Recomendadas` da navegação principal e mantê-la próxima ao contexto de tarefas.

## Reutilizar

```text
TasksRecomendadas
```

## Arquivo a alterar

```text
src/routes/projetos.$id.tsx
```

## Opções aceitáveis

Preferência:

```text
Kanban
├── Quadro
└── Tarefas recomendadas
```

Pode aparecer abaixo do Kanban ou como painel contextual.

Não criar uma nova funcionalidade.

---

# 13. ETAPA 9 — Criar área Equipe

## Objetivo

Agrupar funcionalidades relacionadas ao squad.

## Reutilizar

```text
MembersList
Vagas
Applications
```

## Arquivo a alterar

```text
src/routes/projetos.$id.tsx
```

## Subnavegação sugerida

```text
Equipe

Membros | Vagas | Candidaturas
```

## Preservar

- candidatura por vaga;
- aprovação/rejeição;
- permissões do owner;
- dados de membros;
- estado atual das candidaturas.

## Critério de conclusão

Nenhuma dessas três funcionalidades deve permanecer como aba principal separada.

---

# 14. ETAPA 10 — Reorganizar Atividade e Mural

## Objetivo

Agrupar comunicação e histórico em uma área coerente.

## Reutilizar

```text
ProjectTimeline
Mural
```

## Arquivo a alterar

```text
src/routes/projetos.$id.tsx
```

## Estrutura sugerida

```text
Atividade

Timeline | Mural
```

## Preservar

Toda a lógica existente de envio/leitura do Mural e timeline.

## Critério de conclusão

Mural deve continuar acessível, mas não precisa ocupar uma aba principal exclusiva.

---

# 15. ETAPA 11 — Criar área GitHub

## Objetivo

Concentrar integração GitHub em um local próprio.

## Reutilizar obrigatoriamente

```text
GithubProjectPanel
```

## Arquivo a alterar

```text
src/routes/projetos.$id.tsx
```

## Comportamento conectado

Exibir na aba:

- repositório;
- branch principal;
- status;
- atividade recente;
- commits/PRs quando já suportados;
- ações de configuração existentes.

## Comportamento desconectado

```text
GitHub ainda não conectado.

Conecte um repositório para acompanhar commits e Pull Requests.

[ Conectar GitHub ]
```

## No header

Mostrar apenas status compacto.

Nunca duplicar o formulário completo de conexão.

---

# 16. ETAPA 12 — Criar área Insights

## Objetivo

Mover rankings para uma seção secundária e analítica.

## Reutilizar

```text
TopContributors
TopCommitters
```

## Arquivo a alterar

```text
src/routes/projetos.$id.tsx
```

## Layout sugerido

```text
Insights

Resumo
- Tasks verificadas
- PRs mergeados
- Commits
- Contribuidores

Top Contributors

Top Committers
```

## Empty state

Quando não houver dados, reduzir altura do componente.

Não renderizar cards gigantes apenas com uma frase.

---

# 17. ETAPA 13 — Mover privacidade para configurações

## Objetivo

Retirar controles administrativos da área operacional.

## Arquivo a alterar

```text
src/routes/projetos.$id.tsx
```

Opcional:

```text
src/components/projects/ProjectSettingsDialog.tsx
```

## Reutilizar obrigatoriamente

Mutation atual:

```text
updatePrivacy
```

Service:

```text
atualizarVisibilidadeProjeto
```

## Preservar

- optimistic update;
- rollback;
- invalidation de query;
- toast;
- autorização de owner.

## Novo local

```text
... → Configurações → Privacidade
```

## Campos

```text
Visibilidade: Público / Privado
Permitir portfólio público: on/off
```

---

# 18. ETAPA 14 — Mover links do projeto para configurações

## Objetivo

Eliminar o grande bloco `Área de Trabalho do Squad` da parte superior da página.

## Reutilizar

Mutation:

```text
updateLinks
```

Service:

```text
atualizarLinksProjeto
```

## Novo local

```text
... → Gerenciar links
```

ou

```text
Configurações → Links
```

## Campos existentes

```text
repositorioUrl
figmaUrl
discordUrl
documentacaoUrl
```

## Na tela principal

Mostrar apenas links configurados em formato compacto:

```text
GitHub  Figma  Discord  Docs
```

Não mostrar `Não definido` em cards grandes.

---

# 19. ETAPA 15 — Refinar permissões por papel

## Objetivo

Adaptar a quantidade de ações visíveis conforme o usuário.

## Preservar regra real

```text
isOwner
isMember
```

## Owner

Pode visualizar/usar:

- Nova tarefa;
- Convidar;
- Vagas;
- Candidaturas;
- GitHub;
- Privacidade;
- Links;
- Encerrar projeto.

## Membro

Pode visualizar/usar:

- Kanban;
- tarefas permitidas;
- assumir task;
- atividade;
- equipe;
- GitHub permitido;
- sair do projeto.

## Visitante

Mostrar apenas:

- dados públicos;
- tecnologias;
- vagas;
- membros permitidos;
- candidatura.

Não mostrar ações administrativas.

## Importante

Esconder botão no frontend não substitui a autorização do backend.

---

# 20. ETAPA 16 — Responsividade e largura

## Objetivo

Aproveitar melhor o espaço disponível e permitir Kanban de quatro colunas.

## Arquivos possíveis

```text
src/routes/projetos.$id.tsx
src/components/projects/KanbanBoard.tsx
```

## Avaliar largura atual

Hoje a rota utiliza algo equivalente a:

```text
max-w-6xl
```

Avaliar:

```text
max-w-7xl
```

ou largura fluida controlada.

## Desktop

- quatro colunas visíveis quando houver espaço;
- header compacto;
- tabs em uma linha.

## Tablet

- scroll horizontal do Kanban;
- evitar comprimir cards.

## Mobile

- scroll horizontal ou seleção por coluna;
- ações principais acessíveis;
- header empilhado corretamente;
- nenhuma quebra de viewport.

---

# 21. ETAPA 17 — Ajustar loading e error state

## Objetivo

Fazer estados técnicos refletirem o novo layout.

## Arquivo a alterar

```text
src/routes/projetos.$id.tsx
```

## Loading

Preservar Skeleton, mas atualizar para:

```text
header skeleton
tabs skeleton
kanban skeleton
```

Não bloquear o Kanban por loading de Insights quando esses dados forem independentes.

## Error state

Preservar:

- `AlertTriangle`;
- mensagem de erro;
- `refetch()`;
- botão `Tentar novamente`.

---

# 22. ETAPA 18 — Componentização controlada

## Objetivo

Reduzir complexidade da rota sem criar fragmentação artificial.

## Criar somente se necessário

Possíveis arquivos:

```text
src/components/projects/ProjectHeader.tsx
src/components/projects/ProjectNavigation.tsx
src/components/projects/ProjectSettingsDialog.tsx
src/components/projects/ProjectLinksDialog.tsx
src/components/projects/KanbanToolbar.tsx
```

## Regra

Não criar componente novo apenas para mover poucas linhas.

A extração deve:

- reduzir complexidade;
- permitir reutilização;
- melhorar legibilidade;
- isolar uma responsabilidade real.

---

# 23. ETAPA 19 — Performance

## Objetivo

Priorizar carregamento do conteúdo operacional.

## Preservar

```text
useQuery(["project", id])
```

Não alterar backend sem necessidade.

## Avaliar lazy loading de dados secundários

Se TopCommitters, TopContributors ou ProjectTimeline já realizarem queries próprias, carregar apenas quando a aba for aberta.

Não criar chamadas duplicadas.

Prioridade inicial:

```text
Projeto + Kanban
```

---

# 24. ETAPA 20 — Acessibilidade

## Objetivo

Garantir que a nova navegação não dependa apenas de mouse.

## Verificar

- tabs navegáveis por teclado;
- `aria-label` no menu `...`;
- focus visible;
- ícones com label quando não houver texto;
- contraste;
- estado ativo perceptível sem depender apenas de cor;
- dialogs com título e descrição;
- botões destrutivos claramente identificados.

---

# 25. ETAPA 21 — Testes funcionais por papel

## Owner

```text
[ ] abre projeto
[ ] Kanban aparece primeiro
[ ] cria task
[ ] drag-and-drop funciona
[ ] assume task quando aplicável
[ ] Equipe funciona
[ ] Vagas funciona
[ ] Candidaturas funciona
[ ] GitHub funciona
[ ] Insights funciona
[ ] privacidade funciona
[ ] links funcionam
[ ] encerrar projeto funciona
```

## Membro

```text
[ ] abre projeto
[ ] Kanban funciona
[ ] assumir task funciona
[ ] atividade funciona
[ ] equipe funciona
[ ] GitHub permitido funciona
[ ] sair do projeto funciona
[ ] ações de owner não aparecem
```

## Visitante

```text
[ ] informações públicas carregam
[ ] informações privadas não aparecem
[ ] vagas aparecem quando permitido
[ ] candidatura funciona
[ ] ações administrativas não aparecem
```

---

# 26. ETAPA 22 — Testes visuais e UX

## Desktop

```text
[ ] header compacto
[ ] Kanban no início
[ ] quatro colunas utilizáveis
[ ] tabs claras
[ ] rankings fora do fluxo principal
[ ] GitHub fora do fluxo principal
[ ] ações destrutivas secundárias
```

## Tablet

```text
[ ] Kanban navegável
[ ] tabs utilizáveis
[ ] header não quebra
```

## Mobile

```text
[ ] sem overflow acidental
[ ] cards legíveis
[ ] ações acessíveis
[ ] dialogs utilizáveis
[ ] Kanban navegável
```

---

# 27. ETAPA 23 — Gate final de regressão

A refatoração só pode ser considerada concluída quando TODOS os itens abaixo forem verificados:

```text
[ ] src/routes/projetos.$id.tsx reorganizada
[ ] Kanban aparece imediatamente após header/tabs
[ ] KanbanBoard continua reutilizado
[ ] TasksRecomendadas continua reutilizado
[ ] GithubProjectPanel continua reutilizado
[ ] TopContributors continua reutilizado
[ ] TopCommitters continua reutilizado
[ ] Mural continua reutilizado
[ ] MembersList continua reutilizado
[ ] Vagas continua reutilizado
[ ] Applications continua reutilizado
[ ] ProjectTimeline continua reutilizado
[ ] updatePrivacy continua funcionando
[ ] updateLinks continua funcionando
[ ] handleCloseProject continua funcionando
[ ] handleLeaveProject continua funcionando
[ ] candidatura continua funcionando
[ ] isOwner continua por ID
[ ] isMember continua por ID
[ ] loading funciona
[ ] error state funciona
[ ] Equipe agrupa membros/vagas/candidaturas
[ ] Atividade agrupa timeline/mural
[ ] GitHub possui aba própria
[ ] Insights contém rankings
[ ] Privacidade saiu da área operacional
[ ] Links saíram da área operacional
[ ] ações destrutivas perderam destaque
[ ] cards de task foram simplificados
[ ] nenhuma funcionalidade duplicada foi criada
[ ] TypeScript passa
[ ] lint passa
[ ] testes passam
[ ] responsividade validada
[ ] acessibilidade básica validada
[ ] nenhuma regressão conhecida
```

---

# 28. Resultado esperado

A nova tela deve priorizar execução e colaboração.

Estrutura final esperada:

```text
← Projetos

API DE PAGAMENTOS                       Aberto
Descrição curta
Node.js · React · 1/5 membros
GitHub conectado ✓

[ + Nova tarefa ] [ Convidar ] [ ... ]

Kanban | Atividade | Equipe | GitHub | Insights

──────────────────────────────────────────────
KANBAN
──────────────────────────────────────────────

A fazer | Em progresso | Em revisão | Concluído
```

Configurações ficam acessíveis sem competir com o trabalho diário.

---

# 29. Prompt resumido para agente executor

```text
Você deve refatorar a tela de detalhes do projeto do MontesSquad.

Frontend:
MatheusVRibeiro/squad-hub

Arquivo principal:
src/routes/projetos.$id.tsx

A regra central é: Kanban primeiro, configuração depois.

Reutilize obrigatoriamente os componentes existentes:
KanbanBoard, TasksRecomendadas, GithubProjectPanel, TopCommitters, TopContributors, Mural, MembersList, Applications, Vagas e ProjectTimeline.

Não duplique mutations, services, endpoints ou regras já existentes.

Execute exclusivamente na ordem descrita em docs/REFATORACAO_UIUX_TELA_PROJETO.md.

Não implemente a próxima etapa até fechar completamente o gate da etapa atual.

Enquanto aguarda subagentes, pode analisar e planejar a próxima etapa, mas não alterar seus arquivos antes do fechamento da etapa atual.

Ao final, o projeto deve abrir diretamente com um cabeçalho compacto e a aba Kanban ativa, enquanto Equipe, GitHub, Atividade, Insights e Configurações ficam organizados em suas áreas próprias.
```
