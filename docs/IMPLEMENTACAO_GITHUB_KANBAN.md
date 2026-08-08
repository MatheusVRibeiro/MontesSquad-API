# MontesSquad — Plano mestre de implementação da integração GitHub no Kanban

> Versão 2 — documento consolidado de arquitetura, produto, execução, testes e critérios de aceite.

---

# 1. Objetivo geral

Integrar o MontesSquad ao GitHub para que projetos colaborativos tenham evidências técnicas automáticas de execução, sem transformar o GitHub na fonte de verdade do gerenciamento do projeto.

O MontesSquad continuará sendo responsável por:

- projetos;
- membros;
- candidaturas;
- tarefas;
- responsáveis;
- prioridade;
- prazo;
- Kanban;
- reputação;
- XP;
- rankings;
- regras de colaboração.

O GitHub será fonte de evidência técnica para:

- conta GitHub do usuário;
- repositório;
- branch;
- commit;
- SHA;
- autoria GitHub;
- Pull Request;
- estado do PR;
- merge;
- futuramente checks de CI/CD.

Princípio do produto:

> **MontesSquad gerencia o trabalho; GitHub comprova a atividade técnica.**

Regra central:

> **Um commit nunca conclui automaticamente uma tarefa. O commit registra atividade. A conclusão automática ocorre quando o Pull Request relacionado é mergeado.**

---

# 2. Repositórios e arquitetura atual analisada

## Frontend

Repositório:

```text
MatheusVRibeiro/squad-hub
```

Stack identificada:

- React 19;
- TypeScript;
- Vite;
- TanStack Router/Query;
- Axios;
- Tailwind;
- Radix/shadcn;
- Vitest.

Arquivos importantes já existentes:

```text
src/components/projects/KanbanBoard.tsx
src/services/projectDetail.ts
src/services/api.ts
```

O Kanban atual trabalha com:

```ts
"todo" | "doing" | "done"
```

Hoje o frontend também contém lógica para conceder XP ao mover um card para `done`. Essa responsabilidade deve deixar de ser autoritativa no navegador.

## Backend

Repositório:

```text
MatheusVRibeiro/MontesSquad-API
```

Stack:

- Node.js;
- Express;
- MySQL/mysql2;
- JWT;
- bcrypt;
- Vitest;
- Supertest.

Arquivos principais:

```text
src/controllers/tarefas.js
src/controllers/projetos.js
src/controllers/autenticacao.js
src/controllers/reputacao.js
src/controllers/notificacoes.js
src/routes/routes.js
src/middlewares/auth.js
src/database/createDatabase/Tabelas.sql
.env.example
```

A estrutura atual já possui `repositorio_url` em projetos e tarefas persistidas no MySQL. A implementação deve ser incremental e não reconstruir o sistema.

---

# 3. REGRA ABSOLUTA DE EXECUÇÃO DO PLANO

Esta seção é obrigatória para qualquer agente ou subagente que executar a implementação.

## 3.1 Uma etapa por vez

**NÃO iniciar a implementação da próxima etapa enquanto a etapa atual não estiver 100% concluída.**

Uma etapa somente é considerada concluída quando:

1. todos os arquivos planejados foram criados ou alterados;
2. migrations daquela etapa estão prontas e testadas;
3. testes automatizados relacionados passam;
4. lint passa quando aplicável;
5. não existem erros conhecidos bloqueantes;
6. contratos frontend/backend estão coerentes;
7. segurança da etapa foi revisada;
8. critérios de aceite daquela etapa foram comprovados;
9. alterações realizadas foram listadas;
10. qualquer divergência do plano foi registrada e justificada.

Se qualquer item falhar, a etapa continua **EM EXECUÇÃO**.

## 3.2 Gate obrigatório

Ao terminar cada etapa produzir internamente um checklist:

```text
ETAPA X — GATE DE CONCLUSÃO

[ ] implementação concluída
[ ] migration validada
[ ] testes passando
[ ] lint passando
[ ] regressões verificadas
[ ] segurança revisada
[ ] contratos revisados
[ ] critérios de aceite comprovados
[ ] arquivos alterados documentados
[ ] nenhuma pendência bloqueante
```

Somente quando todos os itens aplicáveis estiverem marcados pode iniciar a próxima etapa.

## 3.3 Uso de subagentes

É permitido dividir uma etapa entre subagentes quando tarefas forem independentes.

Exemplo:

```text
Etapa atual: Webhook

Subagente A -> assinatura HMAC
Subagente B -> idempotência de delivery
Subagente C -> testes do webhook
```

Porém:

- o agente principal continua responsável pela integração final;
- a etapa não termina enquanto TODOS os trabalhos necessários não forem integrados e validados;
- não iniciar implementação da etapa seguinte apenas porque um subagente terminou primeiro.

## 3.4 Trabalho permitido enquanto subagentes executam

Caso o agente principal esteja aguardando subagentes finalizarem tarefas da etapa atual, ele **pode analisar a próxima etapa**, exclusivamente para melhorar o andamento futuro.

Durante essa espera é permitido:

- ler os arquivos envolvidos na próxima etapa;
- mapear dependências;
- identificar riscos;
- planejar distribuição entre subagentes;
- escrever checklist de implementação;
- antecipar contratos de API;
- identificar testes necessários;
- verificar possíveis conflitos;
- preparar estratégia de execução.

Não é permitido:

- alterar arquivos da próxima etapa;
- commitar implementação da próxima etapa;
- executar migration da próxima etapa;
- misturar mudanças de etapas diferentes no mesmo pacote de trabalho.

Regra:

> **Enquanto espera, pode planejar a próxima etapa. Não pode implementá-la antes de fechar completamente a atual.**

---

# 4. Experiência de criação do projeto

## 4.1 GitHub NÃO é obrigatório para criar projeto

O usuário NÃO precisa possuir repositório GitHub antes de criar um projeto no MontesSquad.

Fluxo recomendado:

```text
Criar projeto
    ↓
Definir tecnologias
    ↓
Definir quantidade de membros
    ↓
GitHub: conectar agora OU conectar depois
    ↓
Criar primeiras tarefas
    ↓
Publicar projeto
    ↓
Receber candidatos
    ↓
Montar squad
    ↓
Participantes assumem tarefas
    ↓
GitHub registra contribuições
```

Tela conceitual:

```text
NOVO PROJETO

Nome
Sistema Financeiro

Descrição
Sistema colaborativo para gestão financeira

Tecnologias
React, Node.js, MySQL

Quantidade máxima de membros
5

Integração GitHub
( ) Conectar agora
( ) Conectar depois

[ Criar projeto ]
```

O valor padrão pode ser `Conectar depois` para reduzir fricção no onboarding.

## 4.2 Projeto criado sem GitHub

O sistema funciona normalmente:

```text
A fazer -> Em progresso -> Concluído
```

Todas as funcionalidades existentes permanecem disponíveis.

Posteriormente o owner pode conectar GitHub.

## 4.3 Aba GitHub dentro do projeto

Adicionar navegação conceitual:

```text
Visão geral | Kanban | Membros | GitHub | Mural
```

Projeto sem integração:

```text
GitHub

Este projeto ainda não possui um repositório conectado.
Conecte um repositório para acompanhar commits e Pull Requests.

[ Conectar GitHub ]
```

Projeto integrado:

```text
GitHub conectado ✓

Repositório
matheus/sistema-financeiro

Branch principal
main

Último evento
há 3 minutos
```

---

# 5. Conectar repositório existente

## Objetivo

Permitir que owner conecte repositório depois da criação do projeto.

Fluxo:

1. owner abre aba GitHub;
2. clica `Conectar GitHub`;
3. instala/autoriza GitHub App;
4. backend identifica installation;
5. frontend lista repositórios permitidos;
6. owner escolhe um repositório;
7. backend valida repository ID com GitHub;
8. sistema grava repository ID, full name, installation ID e default branch;
9. projeto passa a exibir estado conectado.

Nunca confiar apenas em URL enviada pelo frontend.

---

# 6. Criar repositório pelo MontesSquad — evolução posterior

Não é requisito do primeiro MVP.

Evolução futura:

```text
Como deseja configurar o GitHub?

[ Usar repositório existente ]
[ Criar novo repositório ]
```

Caso seja implementado futuramente:

```text
Nome
sistema-financeiro

Visibilidade
Público / Privado

Descrição
Projeto criado pelo MontesSquad

[ Criar repositório ]
```

Essa funcionalidade exigirá permissão GitHub maior e deve ser adicionada somente depois do fluxo read-only/webhook estar estável.

---

# 7. Conta GitHub do usuário

Cada usuário MontesSquad poderá conectar sua própria identidade GitHub.

Persistir:

```text
github_user_id
github_login
github_avatar_url
github_connected_at
```

O identificador principal deve ser `github_user_id`, não username.

Exemplo:

```text
MontesSquad: João Silva
GitHub: @joaosilva
GitHub ID: 12345678
```

Isso permite relacionar commits e PRs a usuários do sistema.

---

# 8. Criação das tarefas

As tasks são criadas **no MontesSquad**, não no GitHub.

Exemplo:

```text
Título
Criar API de Login

Descrição
Criar POST /login com JWT

Prioridade
Alta

Responsável
Opcional

Prazo
15/08/2026
```

O backend cria primeiro a tarefa e obtém seu ID.

Exemplo:

```text
Task ID = 38
```

Somente depois pode gerar branch sugerida:

```text
task/38-criar-api-de-login
```

Padrão:

```text
task/{taskId}-{slug-do-titulo}
```

---

# 9. Tarefas assumíveis

## Objetivo

Alinhar o Kanban ao conceito colaborativo do MontesSquad.

Uma tarefa poderá ser criada sem responsável:

```text
Criar API de Login
Node.js · JWT

Sem responsável
[ Assumir tarefa ]
```

Ao clicar:

```text
Deseja assumir esta tarefa?

Ao assumir, você será registrado como responsável pela entrega.

[ Cancelar ] [ Assumir ]
```

Regras sugeridas:

- somente membro ou owner pode assumir;
- tarefa deve pertencer ao projeto;
- se já existir responsável, retornar conflito;
- operação deve ser atômica para impedir dois usuários assumindo simultaneamente;
- usar UPDATE condicional/transaction;
- registrar timestamp `assumida_em` futuramente;
- ao assumir uma tarefa `todo`, mover para `doing` automaticamente;
- se projeto tiver GitHub conectado, gerar/vincular branch sugerida.

Endpoint sugerido:

```text
POST /projetos/:projetoId/tarefas/:tarefaId/assumir
```

---

# 10. Orientação Git ao assumir tarefa

Quando projeto possuir GitHub conectado, após assumir mostrar:

```text
Você assumiu esta tarefa.

Para começar:

1. Atualize sua main
   git checkout main
   git pull origin main

2. Crie a branch
   git checkout -b task/38-criar-api-de-login

3. Publique a branch
   git push -u origin task/38-criar-api-de-login

[ Copiar comandos ]
```

O sistema deve ensinar o fluxo sem obrigar o usuário a decorar Git.

---

# 11. Branch da tarefa

No MVP:

- MontesSquad gera o nome;
- usuário cria a branch localmente;
- webhook associa eventos pela branch.

Evolução futura:

```text
[ Criar branch no GitHub ]
```

A GitHub App poderia criar branch automaticamente, porém isso exigirá permissão de escrita em Contents. Não solicitar essa permissão no MVP sem necessidade.

---

# 12. Fluxo GitHub completo da tarefa

```text
TASK CRIADA
   ↓
TODO
   ↓
usuário assume
   ↓
DOING
   ↓
branch task/38-criar-api-de-login
   ↓
commits/push
   ↓
atividade registrada
   ↓
Pull Request aberto
   ↓
REVIEW
   ↓
review/correções
   ↓
PR mergeado
   ↓
DONE
   ↓
XP + evidência verificada + métricas
```

Commit não muda para `done`.

---

# 13. Nova coluna Em revisão

Alterar status:

```ts
export type KanbanStatus = "todo" | "doing" | "review" | "done";
```

Kanban:

```text
A FAZER | EM PROGRESSO | EM REVISÃO | CONCLUÍDO
```

Transições:

```text
todo -> doing       usuário assume/inicia
doing -> review     PR aberto
review -> doing     PR fechado sem merge, quando aplicável
review -> done      PR mergeado
```

---

# 14. Banco — usuários

Migration idempotente:

```sql
ALTER TABLE usuarios
ADD COLUMN github_user_id BIGINT NULL,
ADD COLUMN github_login VARCHAR(100) NULL,
ADD COLUMN github_avatar_url VARCHAR(500) NULL,
ADD COLUMN github_connected_at DATETIME NULL,
ADD UNIQUE INDEX uq_usuarios_github_user_id (github_user_id);
```

---

# 15. Banco — projetos

Adicionar:

```sql
ALTER TABLE projetos
ADD COLUMN github_repository_id BIGINT NULL,
ADD COLUMN github_repository_full_name VARCHAR(255) NULL,
ADD COLUMN github_installation_id BIGINT NULL,
ADD COLUMN github_default_branch VARCHAR(255) NULL,
ADD COLUMN github_connected_at DATETIME NULL;
```

Avaliar se o mesmo repository poderá ser conectado a mais de um projeto antes de impor UNIQUE. Para MVP, preferencialmente impedir duplicidade dentro de projetos ativos para evitar evento associado ao projeto errado.

---

# 16. Banco — tarefas

Adicionar/alterar:

```sql
ALTER TABLE tarefas
MODIFY COLUMN status ENUM('todo','doing','review','done') DEFAULT 'todo' NOT NULL,
ADD COLUMN github_branch VARCHAR(255) NULL,
ADD COLUMN github_pr_number INT NULL,
ADD COLUMN github_pr_id BIGINT NULL,
ADD COLUMN github_pr_url VARCHAR(500) NULL,
ADD COLUMN github_pr_status ENUM('none','open','closed','merged') DEFAULT 'none',
ADD COLUMN github_last_activity_at DATETIME NULL,
ADD COLUMN concluida_via ENUM('manual','github_merge') NULL,
ADD COLUMN concluida_em DATETIME NULL;
```

Criar índice de projeto + branch:

```sql
CREATE UNIQUE INDEX uq_tarefa_projeto_github_branch
ON tarefas (projeto_id, github_branch);
```

Tratar `NULL` adequadamente no MySQL.

---

# 17. Banco — commits

```sql
CREATE TABLE github_commits (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tarefa_id INT NOT NULL,
    projeto_id INT NOT NULL,
    repository_id BIGINT NOT NULL,
    sha VARCHAR(64) NOT NULL,
    message TEXT NULL,
    author_github_id BIGINT NULL,
    author_login VARCHAR(100) NULL,
    author_name VARCHAR(255) NULL,
    author_email VARCHAR(255) NULL,
    branch VARCHAR(255) NULL,
    commit_url VARCHAR(500) NULL,
    committed_at DATETIME NULL,
    recebido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_github_commit_repository_sha (repository_id, sha),
    INDEX idx_github_commits_tarefa (tarefa_id),
    INDEX idx_github_commits_projeto (projeto_id),
    INDEX idx_github_commits_author (author_github_id),
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

---

# 18. Banco — Pull Requests

```sql
CREATE TABLE github_pull_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tarefa_id INT NOT NULL,
    projeto_id INT NOT NULL,
    repository_id BIGINT NOT NULL,
    github_pr_id BIGINT NOT NULL,
    numero INT NOT NULL,
    titulo VARCHAR(500) NULL,
    url VARCHAR(500) NULL,
    head_branch VARCHAR(255) NULL,
    base_branch VARCHAR(255) NULL,
    author_github_id BIGINT NULL,
    author_login VARCHAR(100) NULL,
    estado ENUM('open','closed','merged') NOT NULL,
    aberto_em DATETIME NULL,
    fechado_em DATETIME NULL,
    mergeado_em DATETIME NULL,
    atualizado_em DATETIME NULL,
    UNIQUE KEY uq_repository_pr (repository_id, numero),
    INDEX idx_pr_tarefa (tarefa_id),
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

---

# 19. Banco — deliveries do webhook

```sql
CREATE TABLE github_webhook_deliveries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    delivery_id VARCHAR(100) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    action_name VARCHAR(100) NULL,
    repository_id BIGINT NULL,
    processado BOOLEAN DEFAULT FALSE,
    erro TEXT NULL,
    recebido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processado_em DATETIME NULL,
    UNIQUE KEY uq_github_delivery_id (delivery_id)
) ENGINE=InnoDB;
```

Objetivo: idempotência.

---

# 20. Banco — eventos XP

XP deve ser concedido no backend e ser idempotente.

```sql
CREATE TABLE eventos_xp (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tarefa_id INT NULL,
    tipo VARCHAR(100) NOT NULL,
    xp INT NOT NULL,
    chave_idempotencia VARCHAR(255) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_evento_xp_chave (chave_idempotencia),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

Exemplo:

```text
task:38:github-merge:pr:52
```

---

# 21. Migration

Criar:

```text
scripts/migrar_github_integracao.js
```

Obrigatório:

- idempotente;
- não apagar dados;
- verificar colunas antes de criar;
- criar tabelas se ausentes;
- criar índices;
- atualizar enum;
- informar cada alteração;
- falhar claramente em erro.

Adicionar:

```json
"db:github": "node scripts/migrar_github_integracao.js"
```

---

# 22. GitHub App

Usar GitHub App, não PAT pessoal permanente.

Permissões MVP:

```text
Contents: Read-only
Metadata: Read-only
Pull requests: Read-only
```

Eventos:

```text
push
pull_request
installation
installation_repositories
```

Dependências sugeridas:

```bash
npm install @octokit/app @octokit/rest @octokit/webhooks
```

Solicitar somente permissões realmente usadas.

---

# 23. Variáveis de ambiente

Adicionar `.env.example`:

```env
GITHUB_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
GITHUB_APP_SLUG=montesquad-integration
GITHUB_CALLBACK_URL=http://localhost:3333/github/callback
GITHUB_FRONTEND_SUCCESS_URL=http://localhost:5173/configuracoes/integracoes
```

Nunca versionar secrets.

---

# 24. Serviços backend GitHub

Manter arquitetura próxima do padrão atual.

Sugestão:

```text
src/controllers/github.js
src/services/github.js
src/services/githubWebhook.js
src/services/githubMetrics.js
```

Funções esperadas:

```js
getGitHubApp()
getInstallationClient(installationId)
getRepository(...)
listInstallationRepositories(...)
verifyWebhookSignature(...)
processPush(...)
processPullRequest(...)
```

Nunca espalhar criação de Octokit pelos controllers.

---

# 25. Webhook

Endpoint:

```text
POST /github/webhook
```

Não usar JWT MontesSquad.

Autenticação do webhook:

```text
X-Hub-Signature-256
```

Idempotência:

```text
X-GitHub-Delivery
```

A assinatura deve usar o raw body original.

Usar HMAC SHA-256 e `timingSafeEqual`.

---

# 26. Processamento push

Extrair:

```text
repository.id
repository.full_name
installation.id
ref
commits[]
```

Transformar:

```text
refs/heads/task/38-criar-api-de-login
```

em:

```text
task/38-criar-api-de-login
```

Localizar task por:

```text
repository id + branch
```

Para cada commit:

- validar payload;
- salvar `INSERT IGNORE`/upsert;
- impedir duplicata por repository + SHA;
- associar autoria GitHub;
- atualizar última atividade da task;
- NÃO concluir task.

---

# 27. Pull Request

Eventos:

```text
opened
reopened
synchronize
closed
```

## opened/reopened

- localizar task por `head.ref`;
- registrar PR;
- salvar número/ID/URL;
- status PR = open;
- task = review.

## synchronize

- atualizar atividade;
- commits continuam entrando via push quando aplicável.

## closed sem merge

- PR = closed;
- NÃO concluir;
- MVP: task `review -> doing`.

## closed + merged

- PR = merged;
- task = done;
- `concluida_via = github_merge`;
- `concluida_em = merged_at`;
- conceder XP uma única vez;
- gerar notificação;
- atualizar rankings/métricas.

---

# 28. Conclusão transacional

Merge deve ser processado em transaction:

```text
BEGIN
SELECT task FOR UPDATE
verificar idempotência
atualizar task
registrar/atualizar PR
conceder XP
criar notificação
COMMIT
```

Erro:

```text
ROLLBACK
```

Nunca conceder XP duas vezes pelo mesmo merge.

---

# 29. Movimentação manual

Sem GitHub na task:

```text
fluxo manual permanece disponível
```

Com GitHub vinculado:

```text
todo -> doing: permitido
doing -> review: preferencialmente PR
review -> done: merge ou override do owner
```

Override do owner deve exigir confirmação explícita:

```text
Concluir sem merge?
Esta tarefa está integrada ao GitHub e ainda não possui PR mergeado.
```

Registrar:

```text
concluida_via = manual
```

Conclusão manual não deve receber selo `Verificado pelo GitHub`.

---

# 30. Card do Kanban

Exemplo em andamento:

```text
Criar API de Login
João Silva
Alta

GitHub ✓
task/38-criar-api-de-login
4 commits
última atividade há 12 min
```

Em review:

```text
PR #52 · Em revisão
[ Abrir Pull Request ]
```

Done verificado:

```text
✓ PR #52 mergeado
✓ Conclusão verificada pelo GitHub
```

---

# 31. Modal da task

Criar seção `Integração GitHub`.

Mostrar:

- repositório;
- branch;
- botão copiar branch;
- botão abrir branch;
- PR;
- estado do PR;
- commits;
- autor;
- data;
- conclusão verificada.

Exemplo:

```text
COMMITS

a92f830  feat: cria endpoint de autenticação
@joaosilva · hoje 13:42

8ad194f  feat: adiciona JWT
@joaosilva · hoje 14:13
```

---

# 32. Service GitHub frontend

Criar:

```text
src/services/github.ts
```

Funções sugeridas:

```ts
getGithubConnection()
connectGithub()
disconnectGithub()
getGithubInstallations()
getInstallationRepositories()
connectProjectRepository(projectId, payload)
disconnectProjectRepository(projectId)
getProjectGithubStatus(projectId)
linkTaskBranch(projectId, taskId, branch)
getTaskGithubActivity(projectId, taskId)
getTaskCommits(projectId, taskId)
getProjectCommitters(projectId)
getGlobalCommitters()
getProjectContributors(projectId)
getGlobalContributors()
```

---

# 33. APIs necessárias

## Usuário

```text
GET    /github/me
GET    /github/connect
GET    /github/callback
DELETE /github/disconnect
```

## Projeto

```text
GET    /github/installations
GET    /github/installations/:installationId/repositories
POST   /projetos/:projetoId/github/repository
DELETE /projetos/:projetoId/github/repository
GET    /projetos/:projetoId/github/status
```

## Task

```text
POST /projetos/:projetoId/tarefas/:tarefaId/assumir
POST /projetos/:projetoId/tarefas/:tarefaId/github/branch
GET  /projetos/:projetoId/tarefas/:tarefaId/github
GET  /projetos/:projetoId/tarefas/:tarefaId/commits
GET  /projetos/:projetoId/tarefas/:tarefaId/pull-request
```

## Rankings

```text
GET /projetos/:projetoId/ranking/committers
GET /projetos/:projetoId/ranking/contributors
GET /ranking/committers
GET /ranking/contributors
```

---

# 34. Atualização da interface

Webhook atualiza backend; frontend consulta MontesSquad API.

MVP:

```ts
refetchInterval: 15000
```

Somente enquanto página relevante estiver aberta.

Não fazer polling direto na API GitHub.

Fluxo:

```text
GitHub -> Webhook -> MontesSquad API -> MySQL
Frontend -> MontesSquad API
```

Futuro: SSE/WebSocket.

---

# 35. Top Committers do projeto

## Objetivo

Mostrar atividade técnica objetiva dentro de cada projeto.

Criar bloco:

```text
TOP COMMITTERS

1. João Silva      32 commits
2. Maria Souza     24 commits
3. Pedro Lima      17 commits
```

Contar somente commits:

- recebidos pela integração;
- pertencentes ao repository conectado ao projeto;
- associados a tasks reconhecidas do projeto;
- não duplicados;
- com autor GitHub associado quando possível.

Não contar qualquer commit aleatório do repositório para evitar distorção.

## Período

Permitir no futuro:

```text
7 dias | 30 dias | Projeto inteiro
```

MVP pode usar projeto inteiro.

## Query conceitual

```sql
SELECT
  u.id,
  u.nome,
  u.avatar_url,
  COUNT(gc.id) AS total_commits
FROM github_commits gc
JOIN usuarios u ON u.github_user_id = gc.author_github_id
WHERE gc.projeto_id = ?
GROUP BY u.id, u.nome, u.avatar_url
ORDER BY total_commits DESC
LIMIT 10;
```

---

# 36. Top Committers geral

## Objetivo

Mostrar atividade GitHub acumulada dentro de todo o ecossistema MontesSquad.

Exemplo:

```text
TOP COMMITTERS — MONTESQUAD

1. João Silva       186 commits
2. Maria Souza      143 commits
3. Ana Oliveira     119 commits
```

Contar apenas commits vinculados a tasks de projetos MontesSquad.

Não contar o histórico inteiro da conta GitHub do usuário.

Isso mantém o ranking relacionado à participação real na plataforma.

---

# 37. Top Contributors — ranking principal recomendado

Quantidade de commits sozinha NÃO mede qualidade ou contribuição.

Para evitar usuários criando dez commits mínimos para subir no ranking, manter `Top Committers` como estatística transparente, mas criar **Top Contributors** como ranking principal da plataforma.

Exemplo:

```text
TOP CONTRIBUTORS

1. João Silva       1.480 pts
   6 tasks verificadas · 5 PRs mergeados · 32 commits

2. Maria Souza      1.260 pts
   5 tasks verificadas · 4 PRs mergeados · 24 commits
```

## Fórmula inicial sugerida

A fórmula deve ser configurável no backend.

Exemplo inicial:

```text
commit válido associado a task        = 2 pontos
PR aberto associado a task            = 10 pontos
PR mergeado                            = 40 pontos
task concluída via github_merge        = 50 pontos
review de PR válido (futuro)           = 15 pontos
```

Adicionar limite de influência de commits por task.

Exemplo:

```text
máximo de 20 pontos de commits por task
```

Assim 100 microcommits não geram vantagem infinita.

## Regra importante

Não usar linhas adicionadas/removidas como indicador de produtividade.

Não premiar tamanho de commit.

Não penalizar squash merge.

---

# 38. Top Contributors do projeto

Dentro de cada projeto mostrar:

```text
CONTRIBUIDORES DO PROJETO

1. João Silva
   820 pts
   4 tasks verificadas
   4 PRs mergeados
   32 commits

2. Maria Souza
   615 pts
   3 tasks verificadas
   3 PRs mergeados
   24 commits
```

Esse deve ser o ranking visual prioritário.

`Top Committers` pode aparecer como aba/secundário.

---

# 39. Top Contributors geral

Página global:

```text
Ranking

Top Contributors | Top Committers
```

Top Contributors geral soma somente contribuições verificadas dentro de projetos MontesSquad.

Filtros futuros:

```text
Geral
Últimos 30 dias
Últimos 7 dias
Tecnologia
```

Não implementar filtros complexos antes do ranking base estar correto.

---

# 40. Métricas de perfil

Perfil poderá exibir:

```text
Projetos participados
Tasks concluídas
Tasks verificadas pelo GitHub
Commits vinculados
PRs abertos
PRs mergeados
Pontuação de contribuição
Posição global
```

Exemplo:

```text
Contribuições verificadas

47 tasks
39 PRs mergeados
184 commits vinculados
#12 no ranking global
```

---

# 41. Segurança do ranking

Regras:

1. commit duplicado nunca conta duas vezes;
2. commit não associado a task não entra no ranking principal;
3. webhook duplicado não altera ranking;
4. usuário sem vínculo GitHub pode ter commit armazenado, mas associação ao perfil deve exigir correspondência confiável;
5. reprocessamento deve ser idempotente;
6. excluir task não deve permitir manipulação silenciosa de histórico sem decisão explícita de produto;
7. commits de bots devem ser identificáveis e, por padrão, excluídos dos rankings humanos;
8. owner não pode editar manualmente contagem de commits;
9. ranking deve ser calculado no backend;
10. frontend apenas exibe o resultado.

---

# 42. Notificações

Push:

- não notificar a cada commit por padrão;
- apenas atualizar atividade.

PR aberto:

```text
João abriu o PR #52 para “Criar API de Login”.
```

PR fechado sem merge:

```text
O PR #52 foi fechado sem merge. A tarefa voltou para Em progresso.
```

Merge:

```text
Seu PR #52 foi mergeado.
A tarefa foi concluída automaticamente.
+150 XP
```

Opcional futuramente:

```text
Você entrou no Top 3 de contribuidores deste projeto.
```

Evitar notificações excessivas de ranking.

---

# 43. Casos de borda obrigatórios

Testar:

- push em branch sem task;
- duas tasks tentando usar mesma branch;
- commit duplicado;
- delivery duplicado;
- PR fechado sem merge;
- PR reaberto;
- repository removido da GitHub App;
- usuário muda username;
- responsável da task muda;
- branch renomeada;
- force push;
- squash merge;
- rebase merge;
- commits de outro colaborador na branch;
- bot fazendo commit;
- usuário desconecta GitHub;
- projeto conecta GitHub depois de já possuir tasks;
- projeto funciona completamente sem GitHub;
- duas pessoas tentam assumir a mesma tarefa simultaneamente;
- merge chega duas vezes;
- ranking reprocessado não duplica pontuação.

---

# 44. Tasks antigas ao conectar GitHub

Quando projeto já possui tarefas e depois recebe integração:

```text
Integração GitHub ativada.

Deseja vincular tarefas existentes?
```

Por task:

```text
Criar banco
[ Vincular branch ]

Tela de Login
[ Vincular branch ]
```

Não obrigar vinculação.

Tasks antigas podem continuar manuais.

---

# 45. Testes backend

Arquivos sugeridos:

```text
test/github.webhook.test.js
test/github.push.test.js
test/github.pullRequest.test.js
test/github.integration.test.js
test/github.rankings.test.js
test/tarefas.assumir.test.js
```

Cobertura mínima:

## Webhook

- assinatura válida;
- assinatura inválida;
- sem assinatura;
- delivery duplicado.

## Push

- branch conhecida;
- desconhecida;
- commit duplicado;
- autoria;
- commit aparece no ranking uma vez.

## PR

- opened -> review;
- synchronize;
- closed sem merge -> não done;
- merged -> done;
- XP exatamente uma vez;
- ranking exatamente uma vez.

## Tarefa assumível

- membro assume;
- visitante não assume;
- duas requisições concorrentes não conseguem dois responsáveis;
- task vai para doing.

## Rankings

- project committers correto;
- global committers correto;
- contributors correto;
- microcommits respeitam cap;
- bots não entram por padrão;
- commits sem task não contam.

---

# 46. Testes frontend

Testar:

- quarta coluna Review;
- botão Assumir tarefa;
- estado sem responsável;
- instrução de branch;
- card GitHub;
- commits;
- PR aberto;
- PR mergeado;
- badge Verificado pelo GitHub;
- aba GitHub do projeto;
- projeto sem GitHub;
- conectar depois;
- Top Committers projeto;
- Top Contributors projeto;
- ranking global;
- loading;
- empty state;
- erro;
- mobile.

---

# 47. Observabilidade

Logs:

```text
[GITHUB_WEBHOOK]
[GITHUB_PUSH]
[GITHUB_PR]
[GITHUB_INSTALLATION]
[GITHUB_RANKING]
[TASK_CLAIM]
```

Campos úteis:

```text
deliveryId
event
repositoryId
projectId
taskId
userId
prNumber
commitSha
processingTimeMs
```

Nunca logar tokens ou secrets.

---

# 48. Ordem obrigatória de implementação

Esta é a sequência oficial.

## ETAPA 0 — Baseline

Objetivo: garantir que os dois projetos estão saudáveis antes de alterar.

Subetapas:

1. ler documentação;
2. executar testes atuais;
3. executar lint;
4. registrar falhas preexistentes;
5. mapear contratos atuais;
6. não corrigir problemas alheios sem necessidade.

Gate: baseline conhecido.

## ETAPA 1 — Banco e migration

1. campos GitHub usuários;
2. campos GitHub projetos;
3. campos GitHub tarefas;
4. `review`;
5. github_commits;
6. github_pull_requests;
7. deliveries;
8. eventos XP;
9. índices;
10. migration idempotente;
11. testes migration.

Gate obrigatório antes da etapa 2.

## ETAPA 2 — Contratos backend/frontend

1. tipos Kanban;
2. DTOs;
3. serializers;
4. compatibilidade tasks antigas;
5. quarta coluna sem automação ainda.

Gate obrigatório.

## ETAPA 3 — GitHub App base

1. variáveis;
2. Octokit;
3. serviço central;
4. installation client;
5. tratamento de configuração ausente.

Gate obrigatório.

## ETAPA 4 — Webhook seguro

1. raw body;
2. endpoint;
3. assinatura HMAC;
4. timing-safe compare;
5. delivery ID;
6. tabela deliveries;
7. testes.

Gate obrigatório.

## ETAPA 5 — Conectar GitHub ao projeto

1. aba GitHub;
2. instalar app;
3. listar repositories;
4. selecionar repository;
5. validar repository no backend;
6. salvar IDs;
7. desconectar;
8. projeto sem GitHub continua normal.

Gate obrigatório.

## ETAPA 6 — Conta GitHub do usuário

1. conectar identidade;
2. persistir GitHub user ID;
3. exibir estado;
4. desconectar;
5. autoria.

Gate obrigatório.

## ETAPA 7 — Tarefas assumíveis

1. endpoint assumir;
2. concorrência;
3. UI;
4. mover todo -> doing;
5. gerar branch sugerida;
6. exibir comandos.

Gate obrigatório.

## ETAPA 8 — Push/commits

1. processar push;
2. identificar branch;
3. localizar task;
4. salvar commits;
5. idempotência SHA;
6. autoria;
7. API listar commits;
8. card/modal;
9. testes.

Gate obrigatório.

## ETAPA 9 — Pull Requests

1. opened;
2. reopened;
3. synchronize;
4. closed sem merge;
5. merged;
6. review;
7. dados PR na UI;
8. testes.

Gate obrigatório.

## ETAPA 10 — XP e conclusão verificada

1. retirar autoridade do frontend;
2. transaction;
3. eventos XP;
4. selo verificado;
5. manual override;
6. testes de duplicidade.

Gate obrigatório.

## ETAPA 11 — Top Committers projeto

1. query;
2. endpoint;
3. testes;
4. componente;
5. empty state.

Gate obrigatório.

## ETAPA 12 — Top Committers geral

1. query global;
2. endpoint;
3. paginação/limit;
4. UI;
5. testes.

Gate obrigatório.

## ETAPA 13 — Top Contributors projeto

1. fórmula backend;
2. cap por task;
3. query/agregação;
4. endpoint;
5. UI;
6. testes antimanipulação.

Gate obrigatório.

## ETAPA 14 — Top Contributors geral

1. agregação global;
2. endpoint;
3. UI ranking;
4. perfil;
5. testes.

Gate obrigatório.

## ETAPA 15 — Integração e regressão final

1. login;
2. cadastro;
3. projetos;
4. candidaturas;
5. membros;
6. mural;
7. Kanban sem GitHub;
8. Kanban com GitHub;
9. tarefas antigas;
10. rankings;
11. segurança;
12. testes completos;
13. lint/build.

Somente depois considerar a implementação concluída.

---

# 49. Critérios de aceite principais

## Projeto sem GitHub

- cria normalmente;
- Kanban funciona;
- nenhuma tela fica bloqueada.

## Conectar depois

- owner conecta repositório posteriormente;
- tasks antigas continuam válidas.

## Assumir task

- membro assume;
- vira responsável;
- vai para doing;
- recebe branch sugerida se GitHub conectado.

## Commit

- aparece automaticamente;
- aparece apenas uma vez;
- não conclui task.

## PR aberto

- task vai para review;
- número e link aparecem.

## PR fechado sem merge

- task não conclui.

## Merge

- task vai para done;
- selo GitHub aparece;
- XP uma vez;
- ranking atualizado uma vez.

## Top Committers

- conta somente commits vinculados às tasks MontesSquad.

## Top Contributors

- prioriza entregas verificadas;
- não pode ser facilmente manipulado por microcommits.

---

# 50. Prompt mestre obrigatório para agente/subagentes

```text
Você é o engenheiro responsável pela integração GitHub do MontesSquad.

REPOSITÓRIOS:
Frontend: MatheusVRibeiro/squad-hub
Backend: MatheusVRibeiro/MontesSquad-API

Leia integralmente backend/docs/IMPLEMENTACAO_GITHUB_KANBAN.md antes de alterar qualquer arquivo.

REGRA ABSOLUTA DE EXECUÇÃO:
Trabalhe UMA ETAPA POR VEZ seguindo exatamente a seção "Ordem obrigatória de implementação".

É PROIBIDO iniciar a implementação da próxima etapa enquanto a atual não estiver completamente finalizada.

Uma etapa só termina após:
- código completo;
- migrations aplicáveis concluídas;
- testes passando;
- lint passando quando disponível;
- segurança revisada;
- critérios de aceite comprovados;
- regressões da área verificadas;
- arquivos alterados listados;
- nenhuma pendência bloqueante.

Se usar subagentes, distribua tarefas independentes da ETAPA ATUAL. Aguarde e integre todos os resultados necessários antes de fechar a etapa.

Se estiver aguardando subagentes, você PODE analisar a próxima etapa para melhorar a execução futura: ler arquivos, mapear dependências, identificar riscos, planejar distribuição e preparar checklists. Porém NÃO pode implementar, editar arquivos ou commitar mudanças da próxima etapa antes do gate da etapa atual estar completamente aprovado.

OBJETIVO DE PRODUTO:
O projeto pode ser criado sem GitHub. GitHub é opcional e pode ser conectado depois.

O fluxo desejado é:
criar projeto -> montar squad -> criar tasks -> membro assume task -> branch por task -> commits aparecem automaticamente -> PR aberto move para review -> PR mergeado conclui -> XP e evidência verificada -> rankings atualizados.

REGRAS GITHUB:
- usar GitHub App;
- nunca armazenar PAT pessoal permanente como arquitetura final;
- validar X-Hub-Signature-256;
- usar X-GitHub-Delivery;
- preservar raw body;
- repository ID e GitHub user ID são referências prioritárias;
- commit não conclui task;
- merge de PR conclui task;
- webhook duplicado nunca duplica commit, XP ou pontuação;
- tokens e private key nunca chegam ao frontend.

TAREFAS:
- tasks são criadas no MontesSquad;
- task pode ser criada sem responsável;
- membros podem usar "Assumir tarefa";
- ao assumir, definir responsável atomicamente;
- se estava todo, mover para doing;
- gerar branch sugerida task/{id}-{slug};
- no MVP usuário cria branch localmente;
- exibir comandos Git para facilitar onboarding.

KANBAN:
todo -> doing -> review -> done.
PR opened/reopened -> review.
PR closed sem merge -> não concluir; MVP pode voltar para doing.
PR merged -> done.

RANKINGS:
Implementar Top Committers por projeto e geral, contando apenas commits válidos vinculados a tasks MontesSquad.
Também implementar Top Contributors por projeto e geral como ranking principal.
Não usar commits brutos como medida única de qualidade.
Pontuação deve dar maior peso a PR mergeado e task verificada e limitar o peso de quantidade de commits por task.
Não contar bots por padrão.
Não contar commits fora de tasks reconhecidas.

COMPATIBILIDADE:
- não quebrar login;
- não quebrar projetos;
- não quebrar candidaturas;
- não quebrar membros;
- não quebrar mural;
- não quebrar Kanban sem GitHub;
- não obrigar projetos antigos a usar GitHub;
- não substituir MySQL;
- não introduzir ORM;
- manter queries parametrizadas.

NO FINAL DE CADA ETAPA, apresente o gate:
[ ] implementação
[ ] migration
[ ] testes
[ ] lint
[ ] segurança
[ ] contratos
[ ] regressão
[ ] critérios de aceite
[ ] arquivos alterados
[ ] pendências

Somente com todos os itens aplicáveis concluídos siga para a próxima etapa.
```

---

# 51. Evoluções após o MVP

Somente depois de todas as etapas anteriores estarem estáveis:

- criar branch automaticamente;
- criar Pull Request pelo MontesSquad;
- GitHub Actions/checks;
- exigir CI verde;
- Issues sincronizadas;
- code review contabilizado no ranking;
- timeline técnica completa;
- badges de contribuição;
- filtros temporais de ranking;
- ranking por tecnologia;
- múltiplos repositórios por projeto;
- portfólio público verificável.

---

# 52. Resultado final esperado

Ao final, um projeto deve poder funcionar em dois modos.

## Modo tradicional

```text
Projeto sem GitHub
A fazer -> Em progresso -> Concluído
```

## Modo integrado

```text
Projeto
  ↓
GitHub conectado
  ↓
Task criada
  ↓
Membro assume
  ↓
Branch task/ID-slug
  ↓
Commits registrados
  ↓
PR aberto
  ↓
Em revisão
  ↓
Merge
  ↓
Concluído e verificado
  ↓
XP + métricas + rankings
```

O diferencial do MontesSquad será unir gestão colaborativa, descoberta de projetos, execução de tarefas e evidências técnicas reais, sem depender de autodeclaração do usuário.