# Implementação da integração GitHub no MontesSquad

## 1. Objetivo geral

Integrar o MontesSquad ao GitHub para transformar commits, branches, Pull Requests e merges em evidências automáticas de execução das tarefas do Kanban.

O objetivo não é simplesmente exibir commits. A integração deve permitir que uma tarefa do MontesSquad fique vinculada a uma branch ou Pull Request e que o sistema acompanhe automaticamente o ciclo de desenvolvimento.

Fluxo desejado:

1. Um usuário cria ou entra em um projeto no MontesSquad.
2. O projeto possui um repositório GitHub vinculado.
3. Uma tarefa do Kanban é atribuída a um membro.
4. A tarefa recebe uma identificação GitHub, preferencialmente uma branch própria.
5. O desenvolvedor realiza commits e push normalmente pelo Git.
6. O GitHub envia eventos ao MontesSquad por webhook.
7. O backend registra os commits relacionados à tarefa.
8. Ao abrir um Pull Request, a tarefa pode passar automaticamente para `review`/`em revisão`.
9. Quando o Pull Request for mergeado, a tarefa pode ser concluída automaticamente.
10. A conclusão fica registrada com evidências: commits, branch, PR, autor, horários e merge.

> Regra central: um simples commit NÃO deve concluir uma tarefa automaticamente. Commit é evidência de atividade. O evento mais seguro para conclusão automática é o merge do Pull Request relacionado à tarefa.

---

# 2. Diagnóstico da arquitetura atual

## 2.1 Frontend — `MatheusVRibeiro/squad-hub`

Tecnologias identificadas:

- React 19
- TypeScript
- Vite
- TanStack Router/Query
- Axios
- Tailwind CSS
- shadcn/Radix UI
- Vitest

Arquivos diretamente relacionados à implementação:

- `src/components/projects/KanbanBoard.tsx`
- `src/services/projectDetail.ts`
- `src/services/api.ts`
- telas de projeto e perfil que consumirem as informações de tarefas/reputação

### Situação atual do Kanban

O Kanban trabalha com três estados:

```ts
"todo" | "doing" | "done"
```

Hoje o usuário pode mover o card manualmente entre as colunas.

Existe também lógica no frontend para conceder XP quando uma tarefa é movida para `done`.

Essa regra deve ser revisada durante a integração GitHub, pois uma ação visual no cliente não deve ser considerada evidência confiável de conclusão.

---

## 2.2 Backend — `MatheusVRibeiro/MontesSquad-API`

Tecnologias identificadas:

- Node.js
- Express
- MySQL / mysql2
- JWT
- bcrypt
- Vitest + Supertest

Principais arquivos envolvidos:

- `src/controllers/tarefas.js`
- `src/controllers/projetos.js`
- `src/controllers/autenticacao.js`
- `src/controllers/reputacao.js`
- `src/controllers/notificacoes.js`
- `src/routes/routes.js`
- `src/middlewares/auth.js`
- `src/database/createDatabase/Tabelas.sql`
- `scripts/`
- `.env.example`

### Estrutura já existente útil para a integração

A tabela `projetos` já possui:

```sql
repositorio_url VARCHAR(255)
```

A tabela `tarefas` já possui:

```sql
id
projeto_id
responsavel_id
titulo
descricao
status
prioridade
data_vencimento
criado_em
```

Portanto, não é necessário remodelar todo o sistema. A integração pode ser adicionada incrementalmente.

---

# 3. Decisão arquitetural

## 3.1 Usar GitHub App

A implementação recomendada é uma **GitHub App**.

Não armazenar usuário e senha do GitHub.

Não usar Personal Access Token fixo de um desenvolvedor como solução definitiva.

A GitHub App deverá ser instalada apenas nos repositórios que os proprietários autorizarem.

### Responsabilidades da GitHub App

- identificar instalação e repositórios autorizados;
- receber webhooks;
- consultar informações do repositório quando necessário;
- consultar commits;
- consultar branches;
- consultar Pull Requests;
- validar autoria e relacionamento entre eventos;
- permitir expansão futura sem depender da conta pessoal do criador do MontesSquad.

---

# 4. Fluxo funcional completo

## 4.1 Projeto conectado ao GitHub

Ao criar ou editar um projeto, o proprietário poderá conectar um repositório GitHub.

Exemplo:

```text
Projeto: Sistema Financeiro
Repositório: empresa/sistema-financeiro
Branch principal: main
GitHub conectado: sim
```

O backend NÃO deve depender exclusivamente de `repositorio_url`.

Além da URL, deverão ser armazenados identificadores imutáveis do GitHub.

---

## 4.2 Usuário conectado ao GitHub

Cada usuário poderá vincular sua conta MontesSquad a uma conta GitHub.

Exemplo:

```text
Usuário MontesSquad: João Silva
GitHub login: joaosilva
GitHub user id: 12345678
```

O `github_user_id` deve ser a referência principal, pois o username do GitHub pode ser alterado.

---

## 4.3 Tarefa vinculada a uma branch

Exemplo:

```text
Tarefa #38
Criar API de login
Responsável: João
Branch: task/38-api-login
```

Padrão recomendado:

```text
task/{taskId}-{slug}
```

Exemplo:

```text
task/38-api-login
```

Isso elimina grande parte da ambiguidade para identificar qual tarefa recebeu determinado push.

---

## 4.4 Commit detectado

Quando ocorrer:

```bash
git push origin task/38-api-login
```

GitHub envia webhook `push`.

O backend:

1. valida assinatura do webhook;
2. identifica o repository id;
3. identifica a branch;
4. procura a tarefa ligada àquela branch;
5. percorre os commits recebidos;
6. evita duplicatas por SHA;
7. registra cada commit;
8. atualiza `ultima_atividade_github_em`;
9. gera evento de atividade/notificação quando necessário.

A tarefa continua `doing`.

---

## 4.5 Pull Request aberto

Quando o desenvolvedor abrir PR da branch da tarefa para `main`, o evento `pull_request` é recebido.

A API deve registrar:

- GitHub PR id;
- número do PR;
- URL;
- branch origem;
- branch destino;
- estado;
- autor;
- horário de abertura;
- merge status.

Estado recomendado da tarefa:

```text
doing -> review
```

Por esse motivo é recomendado expandir o enum do Kanban.

---

## 4.6 Pull Request mergeado

Evento:

```text
pull_request.action = closed
pull_request.merged = true
```

Processamento:

1. localizar tarefa associada ao PR;
2. registrar `merged_at`;
3. alterar tarefa para `done`;
4. registrar origem da conclusão = `github_merge`;
5. conceder XP no backend, uma única vez;
6. gerar notificação;
7. atualizar métricas do usuário.

---

# 5. Etapa 1 — Preparar o modelo de dados

## Objetivo

Criar persistência suficiente para GitHub sem misturar identificadores externos com campos de negócio existentes.

## 5.1 Alterações em `usuarios`

Adicionar:

```sql
ALTER TABLE usuarios
ADD COLUMN github_user_id BIGINT NULL,
ADD COLUMN github_login VARCHAR(100) NULL,
ADD COLUMN github_avatar_url VARCHAR(500) NULL,
ADD COLUMN github_connected_at DATETIME NULL,
ADD UNIQUE INDEX uq_usuarios_github_user_id (github_user_id);
```

### Objetivo de cada campo

- `github_user_id`: identificador permanente da conta GitHub;
- `github_login`: username atual para exibição;
- `github_avatar_url`: avatar GitHub;
- `github_connected_at`: auditoria da conexão.

---

## 5.2 Alterações em `projetos`

Adicionar:

```sql
ALTER TABLE projetos
ADD COLUMN github_repository_id BIGINT NULL,
ADD COLUMN github_repository_full_name VARCHAR(255) NULL,
ADD COLUMN github_installation_id BIGINT NULL,
ADD COLUMN github_default_branch VARCHAR(255) NULL,
ADD COLUMN github_connected_at DATETIME NULL,
ADD UNIQUE INDEX uq_projetos_github_repository_id (github_repository_id);
```

### Por que não usar somente `repositorio_url`

URLs e nomes podem mudar.

O repository ID do GitHub é mais estável e apropriado como identificação externa.

---

## 5.3 Alterações em `tarefas`

Recomendado:

```sql
ALTER TABLE tarefas
MODIFY COLUMN status ENUM('todo', 'doing', 'review', 'done') DEFAULT 'todo' NOT NULL,
ADD COLUMN github_branch VARCHAR(255) NULL,
ADD COLUMN github_pr_number INT NULL,
ADD COLUMN github_pr_id BIGINT NULL,
ADD COLUMN github_pr_url VARCHAR(500) NULL,
ADD COLUMN github_pr_status ENUM('none', 'open', 'closed', 'merged') DEFAULT 'none',
ADD COLUMN github_last_activity_at DATETIME NULL,
ADD COLUMN concluida_via ENUM('manual', 'github_merge') NULL,
ADD COLUMN concluida_em DATETIME NULL;
```

### Objetivo

A task passa a saber qual branch e PR representam sua execução técnica.

---

## 5.4 Criar tabela `github_commits`

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
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

### Objetivo

Separar histórico GitHub da tabela principal de tarefas.

Uma tarefa pode ter dezenas de commits.

---

## 5.5 Criar tabela `github_pull_requests`

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
    estado ENUM('open', 'closed', 'merged') NOT NULL,
    aberto_em DATETIME NULL,
    fechado_em DATETIME NULL,
    mergeado_em DATETIME NULL,
    atualizado_em DATETIME NULL,
    UNIQUE KEY uq_repository_pr (repository_id, numero),
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

---

## 5.6 Criar tabela de entregas de webhook

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

### Objetivo

Garantir idempotência.

GitHub pode reenviar um webhook. O mesmo delivery não deve conceder XP duas vezes ou duplicar commits.

---

# 6. Etapa 2 — Criar migrations

## Objetivo

Não editar banco de produção manualmente.

Criar, por exemplo:

```text
scripts/migrar_github_integracao.js
```

Esse script deverá:

1. verificar se cada coluna já existe;
2. criar somente campos ausentes;
3. criar tabelas com `CREATE TABLE IF NOT EXISTS` quando aplicável;
4. criar índices;
5. atualizar enum de tarefas;
6. imprimir resumo;
7. falhar com mensagem clara se algo não puder ser migrado.

Adicionar ao `package.json`:

```json
"db:github": "node scripts/migrar_github_integracao.js"
```

Evitar migration destrutiva.

---

# 7. Etapa 3 — Configurar GitHub App

## Objetivo

Permitir instalação segura da integração em repositórios dos usuários.

## 7.1 Criar GitHub App

Nome exemplo:

```text
MontesSquad Integration
```

## 7.2 Callback URLs

Definir endpoints backend, por exemplo:

```text
GET /github/install
GET /github/callback
POST /github/webhook
```

Frontend:

```text
/github/callback
```

quando necessário para retorno visual.

## 7.3 Permissões mínimas

Planejar princípio de menor privilégio.

Inicialmente:

Repository permissions:

- Contents: Read-only
- Metadata: Read-only
- Pull requests: Read-only

Events:

- Push
- Pull request
- Installation
- Installation repositories

Se no futuro o MontesSquad criar branches/issues automaticamente, solicitar permissões extras somente nessa evolução.

---

# 8. Etapa 4 — Variáveis de ambiente

Adicionar a `.env.example`:

```env
# GitHub App
GITHUB_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
GITHUB_APP_SLUG=montesquad-integration
GITHUB_CALLBACK_URL=http://localhost:3333/github/callback
GITHUB_FRONTEND_SUCCESS_URL=http://localhost:5173/configuracoes/integracoes
```

## Segurança

Nunca versionar:

- private key;
- webhook secret;
- client secret;
- access token.

---

# 9. Etapa 5 — Dependências backend

## Objetivo

Usar bibliotecas oficiais/estáveis para autenticação da GitHub App.

Pacotes sugeridos:

```bash
npm install @octokit/app @octokit/rest
```

Opcionalmente, se a estratégia adotada usar helpers de webhook:

```bash
npm install @octokit/webhooks
```

Evitar implementar JWT da GitHub App manualmente se Octokit resolver adequadamente.

---

# 10. Etapa 6 — Estruturar módulo GitHub no backend

Criar:

```text
src/github/
  githubApp.js
  githubClient.js
  webhookSignature.js
  eventProcessors/
    push.js
    pullRequest.js
    installation.js
```

Ou, mantendo o padrão atual:

```text
src/controllers/github.js
src/services/github.js
src/services/githubWebhook.js
```

A segunda opção causa menos mudança arquitetural no código existente.

---

# 11. Etapa 7 — Serviço da GitHub App

## Objetivo

Centralizar criação dos clientes GitHub.

Criar funções como:

```js
getGitHubApp()
getInstallationClient(installationId)
getRepository(owner, repo)
listRepositoriesForInstallation(installationId)
```

Nunca criar Octokit espalhado nos controllers.

---

# 12. Etapa 8 — Endpoint de webhook

Criar:

```text
POST /github/webhook
```

IMPORTANTE: esse endpoint é público para o GitHub, portanto NÃO deve usar `verificarToken` do MontesSquad.

Sua autenticação será a assinatura criptográfica do GitHub.

---

# 13. Etapa 9 — Validar assinatura do webhook

## Objetivo

Impedir que terceiros simulem pushes e merges.

Validar header:

```text
X-Hub-Signature-256
```

Usar HMAC SHA-256 com `GITHUB_WEBHOOK_SECRET`.

Processamento conceitual:

```js
const signature = req.headers['x-hub-signature-256'];
const expected = 'sha256=' + createHmac('sha256', secret)
  .update(rawBody)
  .digest('hex');
```

Comparar com:

```js
crypto.timingSafeEqual(...)
```

### Requisito crítico

A validação necessita do RAW BODY original.

Hoje a aplicação Express provavelmente utiliza `express.json()`. Para `/github/webhook`, preservar o corpo bruto antes do parse ou configurar middleware específico.

---

# 14. Etapa 10 — Idempotência de webhooks

Ler:

```text
X-GitHub-Delivery
```

Antes de processar:

```sql
SELECT id FROM github_webhook_deliveries
WHERE delivery_id = ?
```

Se já processado:

```text
HTTP 200
ignored_duplicate = true
```

Não processar novamente.

---

# 15. Etapa 11 — Processar evento `push`

## Objetivo

Registrar atividade de desenvolvimento sem concluir a task.

Extrair:

```text
repository.id
repository.full_name
installation.id
ref
pusher
commits[]
```

`ref` exemplo:

```text
refs/heads/task/38-api-login
```

Converter para:

```text
task/38-api-login
```

Buscar:

```sql
SELECT t.*, p.id projeto_id
FROM tarefas t
JOIN projetos p ON p.id = t.projeto_id
WHERE p.github_repository_id = ?
AND t.github_branch = ?
LIMIT 1;
```

Para cada commit:

```sql
INSERT IGNORE INTO github_commits (...)
```

Atualizar:

```sql
UPDATE tarefas
SET github_last_activity_at = NOW()
WHERE id = ?;
```

### Validação de autor

Se a tarefa possui responsável:

1. recuperar `usuarios.github_user_id`;
2. comparar com autor GitHub quando disponível;
3. salvar autoria real independentemente da comparação;
4. NÃO descartar commits de outros colaboradores da branch;
5. marcar internamente se commit foi do responsável ou de colaborador.

Sugestão de campo futuro:

```sql
is_task_assignee BOOLEAN
```

---

# 16. Etapa 12 — Processar `pull_request`

Eventos relevantes:

```text
opened
reopened
synchronize
closed
```

## opened/reopened

Localizar task por:

```text
head.ref -> tarefa.github_branch
```

Registrar/atualizar `github_pull_requests`.

Atualizar task:

```sql
github_pr_number
github_pr_id
github_pr_url
github_pr_status = 'open'
status = 'review'
```

## synchronize

PR recebeu novos commits.

Atualizar último timestamp de atividade.

## closed sem merge

```text
github_pr_status = closed
```

A tarefa NÃO deve ir para `done`.

Pode voltar para `doing`, mediante regra de negócio.

Sugestão MVP:

```text
review -> doing
```

## closed + merged

```text
github_pr_status = merged
status = done
concluida_via = github_merge
concluida_em = pull_request.merged_at
```

---

# 17. Etapa 13 — Tornar a conclusão transacional

## Objetivo

Evitar task concluída sem XP ou XP concedido sem task concluída.

Ao processar merge:

```text
BEGIN TRANSACTION
```

1. `SELECT ... FOR UPDATE` da tarefa;
2. verificar se já estava concluída via esse PR;
3. atualizar task;
4. atualizar reputação/XP;
5. criar notificação;
6. registrar evento/auditoria;

```text
COMMIT
```

Em erro:

```text
ROLLBACK
```

---

# 18. Etapa 14 — Mover XP do frontend para backend

## Objetivo

Evitar manipulação pelo navegador.

Hoje o frontend concede XP ao mover card para `done`.

Essa lógica deve ser removida como fonte autoritativa.

O backend deverá possuir algo como:

```js
async function concederXpConclusaoTarefa(usuarioId, tarefaId, origem, connection)
```

Criar proteção contra dupla concessão.

Sugestão de nova tabela:

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
);
```

Exemplo de chave:

```text
task:38:github-merge:pr:52
```

---

# 19. Etapa 15 — API de conexão GitHub do usuário

Criar endpoints conceituais:

```text
GET    /github/me
GET    /github/connect
GET    /github/callback
DELETE /github/disconnect
```

Resposta de `/github/me`:

```json
{
  "sucesso": true,
  "dados": {
    "connected": true,
    "githubUserId": 123456,
    "login": "joaosilva",
    "avatarUrl": "..."
  }
}
```

---

# 20. Etapa 16 — API de conexão do projeto ao repositório

Endpoints:

```text
GET    /github/installations
GET    /github/installations/:installationId/repositories
POST   /projetos/:projetoId/github/repository
DELETE /projetos/:projetoId/github/repository
GET    /projetos/:projetoId/github/status
```

Somente o dono do projeto poderá vincular/desvincular repositório.

Payload:

```json
{
  "installationId": 999999,
  "repositoryId": 123456789,
  "repositoryFullName": "empresa/sistema-financeiro",
  "defaultBranch": "main"
}
```

Validar com GitHub antes de salvar.

Nunca confiar apenas nos valores enviados pelo frontend.

---

# 21. Etapa 17 — API GitHub da tarefa

Endpoints sugeridos:

```text
POST /projetos/:projetoId/tarefas/:tarefaId/github/branch
GET  /projetos/:projetoId/tarefas/:tarefaId/github
GET  /projetos/:projetoId/tarefas/:tarefaId/commits
GET  /projetos/:projetoId/tarefas/:tarefaId/pull-request
```

## Criar/vincular branch

Payload:

```json
{
  "branch": "task/38-api-login"
}
```

Validações:

- usuário é membro/dono;
- projeto possui repositório conectado;
- tarefa pertence ao projeto;
- branch não está associada a outra task;
- responsável existe;
- formato é permitido.

---

# 22. Etapa 18 — Convenção automática de branch

## Objetivo

Reduzir erro humano.

Ao criar task, gerar sugestão:

```js
function buildTaskBranch(taskId, title) {
  return `task/${taskId}-${slugify(title)}`;
}
```

Exemplo:

```text
Tarefa: Criar API de Login
ID: 38
Branch sugerida: task/38-criar-api-de-login
```

No MVP, o MontesSquad pode apenas mostrar a instrução para o usuário criar a branch.

Evolução futura: criar a branch automaticamente via GitHub App.

---

# 23. Etapa 19 — Alterar contrato da tarefa no frontend

Hoje:

```ts
export type KanbanStatus = "todo" | "doing" | "done";
```

Alterar para:

```ts
export type KanbanStatus = "todo" | "doing" | "review" | "done";
```

Expandir `KanbanTask`:

```ts
export type GitHubCommit = {
  sha: string;
  shortSha: string;
  message: string;
  authorLogin?: string;
  authorName?: string;
  committedAt?: string;
  url?: string;
};

export type GitHubPullRequest = {
  number: number;
  title?: string;
  url: string;
  status: "open" | "closed" | "merged";
  headBranch: string;
  baseBranch: string;
};

export type KanbanTask = {
  id: string;
  title: string;
  description?: string;
  status: KanbanStatus;
  assignee?: string;
  priority?: "low" | "medium" | "high";
  dueDate?: string;
  subtasks?: SubTask[];
  githubBranch?: string;
  githubLastActivityAt?: string;
  githubCommitCount?: number;
  githubPullRequest?: GitHubPullRequest | null;
  completionSource?: "manual" | "github_merge";
};
```

---

# 24. Etapa 20 — Adicionar coluna `Em revisão`

No `KanbanBoard.tsx`:

```text
A fazer
Em progresso
Em revisão
Concluído
```

Visualmente:

```text
TODO -> DOING -> REVIEW -> DONE
```

Quando PR abrir:

```text
automático -> REVIEW
```

Quando mergear:

```text
automático -> DONE
```

---

# 25. Etapa 21 — Regra de movimentação manual

Definir regras claras.

## MVP recomendado

Sem GitHub conectado:

```text
movimentação manual normal
```

Com GitHub conectado e task vinculada a branch:

```text
todo -> doing: manual permitido
doing -> review: preferencialmente GitHub PR
review -> done: somente merge ou owner override
```

Se owner fizer override, exigir confirmação:

```text
Concluir sem merge?
Esta tarefa possui integração GitHub e ainda não há PR mergeado.
```

Registrar:

```text
concluida_via = manual
```

---

# 26. Etapa 22 — Card do Kanban com evidência GitHub

No card mostrar de forma compacta:

```text
Criar API de login
João Silva

GitHub
branch: task/38-api-login
4 commits
PR #52 · Em revisão
última atividade há 12 min
```

Quando concluído:

```text
✓ PR #52 mergeado
✓ Conclusão verificada pelo GitHub
```

Adicionar ícone GitHub e badge de verificação.

---

# 27. Etapa 23 — Modal da tarefa

Criar seção:

```text
Integração GitHub
```

Conteúdo:

### Repositório

```text
empresa/sistema-financeiro
```

### Branch

```text
task/38-api-login
```

Botões:

```text
Copiar branch
Abrir no GitHub
```

### Pull Request

```text
#52 Criar API de Login
Em revisão
```

### Commits

Lista:

```text
a92f830 feat: cria endpoint de login
b448ae1 test: adiciona testes de autenticação
c1f7204 fix: trata credenciais inválidas
```

---

# 28. Etapa 24 — Criar service GitHub no frontend

Criar:

```text
src/services/github.ts
```

Funções:

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
```

---

# 29. Etapa 25 — Atualização em tempo quase real

Webhook atualiza o backend, não o navegador diretamente.

Para o MVP:

usar React Query com polling somente enquanto a página do projeto estiver aberta.

Exemplo:

```ts
refetchInterval: 15000
```

Não consultar GitHub a cada 15 segundos.

Consultar apenas sua própria API.

Fluxo:

```text
GitHub -> Webhook -> MontesSquad API -> banco
Frontend -> MontesSquad API
```

Evolução futura:

- WebSocket;
- Server-Sent Events.

---

# 30. Etapa 26 — Notificações

Eventos sugeridos:

### Push

Não gerar notificação para todo commit por padrão para evitar spam.

Pode apenas atualizar o card.

### PR aberto

Notificar owner:

```text
João abriu o PR #52 para a tarefa “Criar API de login”.
```

### PR mergeado

Notificar responsável:

```text
Seu PR #52 foi mergeado. A tarefa foi concluída automaticamente. +150 XP.
```

### PR fechado sem merge

```text
O PR #52 foi fechado sem merge. A tarefa voltou para Em progresso.
```

---

# 31. Etapa 27 — Métricas de contribuição

## Objetivo

Transformar GitHub em evidência real de colaboração.

Depois do MVP, perfil poderá exibir:

```text
Projetos participados
Tasks concluídas
Tasks verificadas por GitHub
Commits vinculados
PRs abertos
PRs mergeados
```

Não usar quantidade de commits como medida direta de qualidade.

Commits podem ser usados como histórico, não como ranking absoluto de produtividade.

---

# 32. Etapa 28 — Segurança e autorização

## Regras obrigatórias

### Regra 1

Somente owner conecta repositório ao projeto.

### Regra 2

Somente membros do projeto visualizam atividade privada daquele repositório no MontesSquad.

### Regra 3

Webhook não usa JWT de usuário; usa assinatura GitHub.

### Regra 4

Nunca confiar no `repositoryId`, `installationId` ou `githubUserId` enviados pelo frontend sem validar no GitHub.

### Regra 5

Nunca expor installation access token ao navegador.

### Regra 6

Private key da GitHub App existe somente no backend.

### Regra 7

Sanitizar e limitar tamanho das mensagens de commit armazenadas/exibidas.

### Regra 8

Usar parâmetros SQL, nunca interpolação com payload de webhook.

---

# 33. Etapa 29 — Casos de borda

Implementar/testar explicitamente.

## Caso A — push em branch sem tarefa

Resultado:

```text
ignorar para Kanban
```

Pode registrar delivery como processado.

## Caso B — dois cards com mesma branch

Bloquear na vinculação.

## Caso C — commit duplicado

`UNIQUE(repository_id, sha)` impede duplicata.

## Caso D — webhook duplicado

`delivery_id` impede processamento duplo.

## Caso E — PR fechado sem merge

Não concluir.

## Caso F — PR reaberto

Voltar/continuar em `review`.

## Caso G — repositório removido da GitHub App

Marcar integração do projeto como desconectada/inválida.

## Caso H — usuário muda username GitHub

Atualizar login; conservar `github_user_id`.

## Caso I — responsável da task é trocado

Não apagar histórico de commits anteriores.

## Caso J — branch renomeada

Webhook/consulta deve atualizar vínculo quando for possível detectar; caso contrário owner corrige manualmente.

## Caso K — force push

Não excluir automaticamente o histórico já registrado. Commits do MontesSquad representam eventos recebidos.

## Caso L — merge feito por squash

Conclusão continua baseada no PR `merged=true`, não na presença de todos os SHAs originais na `main`.

## Caso M — merge feito por rebase

Mesma regra: confiar no estado do PR.

---

# 34. Etapa 30 — Testes backend

Criar testes para:

```text
test/github.webhook.test.js
test/github.push.test.js
test/github.pullRequest.test.js
test/github.integration.test.js
```

## Testes mínimos

### assinatura

- assinatura válida -> aceita;
- assinatura inválida -> 401/403;
- header ausente -> rejeita.

### push

- branch conhecida -> cria commits;
- branch desconhecida -> ignora;
- commit duplicado -> não duplica;
- delivery duplicado -> não reprocesa.

### PR

- opened -> task `review`;
- synchronize -> atualiza atividade;
- closed sem merge -> não conclui;
- merged -> `done`;
- merged -> XP uma vez;
- webhook de merge duplicado -> XP continua uma vez.

### autorização

- membro não owner não conecta repository;
- visitante não consulta detalhes privados GitHub.

---

# 35. Etapa 31 — Testes frontend

Testar:

- quarta coluna `Em revisão`;
- card com commits;
- badge PR aberto;
- badge mergeado;
- modal de GitHub;
- estado sem GitHub conectado;
- estado repositório conectado mas task sem branch;
- loading;
- erro de API;
- polling/refetch;
- comportamento mobile.

---

# 36. Etapa 32 — Observabilidade

Logs estruturados sugeridos:

```text
[GITHUB_WEBHOOK]
[GITHUB_PUSH]
[GITHUB_PR]
[GITHUB_INSTALLATION]
```

Nunca logar secrets ou tokens.

Campos úteis:

```text
deliveryId
event
repositoryId
projectId
taskId
prNumber
commitSha
processingTimeMs
```

---

# 37. Etapa 33 — Documentação

Atualizar:

```text
README.md
docs/api.md
.env.example
```

Documentar todos os endpoints GitHub.

Adicionar seção:

```text
Configuração da GitHub App
```

Com ambiente local e produção.

---

# 38. Etapa 34 — Ordem recomendada de implementação

## Fase 1 — Banco e contratos

1. migration GitHub;
2. tabela commits;
3. tabela PRs;
4. tabela deliveries;
5. atualizar enum Kanban;
6. atualizar tipos frontend.

## Fase 2 — Webhook mínimo

1. endpoint;
2. raw body;
3. assinatura;
4. delivery idempotente;
5. log de evento `ping`/teste.

## Fase 3 — Push

1. vincular branch à task;
2. processar `push`;
3. salvar commits;
4. API para listar commits;
5. exibir no card/modal.

## Fase 4 — Pull Request

1. processar `opened`;
2. criar status `review`;
3. exibir PR;
4. processar `closed`;
5. processar merge;
6. concluir task.

## Fase 5 — Reputação

1. retirar XP autoritativo do frontend;
2. criar eventos XP/idempotência;
3. XP por merge;
4. notificações.

## Fase 6 — Conta GitHub

1. conexão usuário;
2. persistir GitHub user ID;
3. exibir conta conectada;
4. associação de autoria.

## Fase 7 — GitHub App completa

1. installation flow;
2. seleção de repository;
3. eventos installation/repository;
4. repositórios privados autorizados.

---

# 39. Etapa 35 — MVP mínimo demonstrável

Para uma primeira entrega funcional, implementar somente:

1. projeto possui repository GitHub;
2. task possui branch;
3. webhook `push` registra commits;
4. commits aparecem na task;
5. webhook `pull_request.opened` move para `review`;
6. webhook `pull_request.closed + merged=true` move para `done`;
7. task mostra `Conclusão verificada pelo GitHub`.

Não incluir inicialmente:

- criação automática de branches;
- criação automática de PR;
- CI/CD;
- análise de qualidade de código;
- ranking por commits;
- review automático por IA;
- múltiplos repositórios por projeto.

---

# 40. Etapa 36 — Critérios de aceite do MVP

## Cenário 1 — Commit

Dado:

- projeto GitHub conectado;
- tarefa #38 ligada a `task/38-api-login`;

Quando:

- responsável envia push contendo commit `abc123`;

Então:

- webhook é validado;
- commit aparece uma única vez na tarefa;
- tarefa permanece em progresso;
- timestamp de atividade é atualizado.

## Cenário 2 — PR aberto

Quando:

- PR da `task/38-api-login` para `main` for aberto;

Então:

- PR fica associado à tarefa;
- número e URL aparecem no MontesSquad;
- tarefa vai automaticamente para `review`.

## Cenário 3 — PR fechado sem merge

Então:

- tarefa não é concluída;
- PR aparece como fechado;
- tarefa retorna a `doing` no MVP recomendado.

## Cenário 4 — PR mergeado

Então:

- tarefa vira `done`;
- `concluida_via = github_merge`;
- merge timestamp é armazenado;
- XP é concedido exatamente uma vez;
- frontend mostra conclusão verificada.

## Cenário 5 — webhook repetido

Quando GitHub reenviar o mesmo delivery:

- nenhuma duplicação ocorre;
- nenhum XP adicional é concedido.

---

# 41. Prompt mestre para implementação por agente de código

Use o prompt abaixo ao solicitar a implementação a um agente de programação.

```text
Você é o engenheiro responsável por implementar a integração GitHub do projeto MontesSquad.

Existem dois repositórios:

Frontend:
MatheusVRibeiro/squad-hub
React + TypeScript + Vite.

Backend:
MatheusVRibeiro/MontesSquad-API
Node.js + Express + MySQL.

Antes de modificar código, leia obrigatoriamente:
- README.md de ambos os repositórios;
- package.json de ambos;
- frontend/src/components/projects/KanbanBoard.tsx;
- frontend/src/services/projectDetail.ts;
- frontend/src/services/api.ts;
- backend/src/controllers/tarefas.js;
- backend/src/controllers/projetos.js;
- backend/src/controllers/reputacao.js;
- backend/src/controllers/notificacoes.js;
- backend/src/routes/routes.js;
- backend/src/middlewares/auth.js;
- backend/src/database/createDatabase/Tabelas.sql;
- backend/.env.example;
- backend/docs/IMPLEMENTACAO_GITHUB_KANBAN.md.

OBJETIVO:
Implementar integração GitHub para que commits e Pull Requests sejam automaticamente associados às tarefas do Kanban.

REGRA PRINCIPAL:
Commit não conclui task. Commit apenas registra atividade. A conclusão automática deve ocorrer quando o Pull Request relacionado for mergeado.

ARQUITETURA:
- utilizar GitHub App;
- processar webhooks no backend;
- validar X-Hub-Signature-256;
- usar X-GitHub-Delivery para idempotência;
- nunca expor private key, webhook secret ou installation token ao frontend;
- repository id e GitHub user id são as referências externas prioritárias;
- toda autorização de negócio continua no backend MontesSquad.

IMPLEMENTAR EM FASES PEQUENAS.

FASE 1 — MIGRATION
Criar migration idempotente adicionando campos GitHub em usuarios, projetos e tarefas e criando github_commits, github_pull_requests e github_webhook_deliveries. Alterar status de tarefa para todo/doing/review/done. Não apagar dados existentes.

FASE 2 — WEBHOOK
Criar POST /github/webhook público, protegido por assinatura HMAC SHA-256. Preservar raw body para verificação. Implementar controle por delivery ID. Retornar rapidamente códigos apropriados.

FASE 3 — PUSH
Processar evento push. Identificar repository.id e branch. Localizar tarefa pelo repository id + github_branch. Registrar commits usando repository_id + sha como unique. Nunca concluir task por commit.

FASE 4 — PR
Processar pull_request opened/reopened/synchronize/closed. Associar PR à task usando head.ref. Quando opened/reopened, mover a task para review. Quando closed sem merge, não concluir. Quando closed e merged=true, concluir a task.

FASE 5 — XP
Remover do frontend a responsabilidade autoritativa de conceder XP. Implementar XP no backend de modo idempotente e transacional quando uma task for concluída por merge. Nenhum webhook repetido pode duplicar XP.

FASE 6 — APIs
Adicionar APIs para:
- consultar estado GitHub da task;
- listar commits da task;
- vincular branch;
- consultar PR;
- conectar/desconectar repositório no projeto;
- consultar estado da conexão.

FASE 7 — FRONTEND
Adicionar coluna Em revisão. Atualizar KanbanStatus. Adicionar campos GitHub a KanbanTask. Criar service src/services/github.ts. Mostrar branch, quantidade de commits, último commit, PR e selo de conclusão verificada. Adicionar seção GitHub no modal da tarefa.

FASE 8 — TESTES
Adicionar testes de assinatura, idempotência, push, PR opened, PR closed sem merge, merge, XP único e autorização. Atualizar testes frontend para review e visualização GitHub.

RESTRIÇÕES:
- não quebrar fluxos existentes de login, projeto, candidatura, membros, mural ou Kanban;
- não substituir MySQL;
- não introduzir ORM;
- manter padrão atual de controllers/routes/services;
- queries SQL sempre parametrizadas;
- evitar dependências desnecessárias;
- não armazenar access tokens no browser;
- não criar ranking baseado apenas em número de commits;
- preservar compatibilidade de tasks antigas sem GitHub.

AO FINAL DE CADA FASE:
1. executar testes;
2. executar lint quando disponível;
3. revisar segurança;
4. listar arquivos criados/alterados;
5. explicar qualquer decisão que divergir deste documento;
6. somente então seguir para a próxima fase.

CRITÉRIO FINAL:
Uma task com branch vinculada deve receber commits automaticamente após push, entrar em review ao abrir PR e ser concluída automaticamente, exatamente uma vez, quando o PR for mergeado.
```

---

# 42. Estrutura esperada de arquivos após implementação

Backend, exemplo:

```text
MontesSquad-API/
├── src/
│   ├── controllers/
│   │   ├── github.js
│   │   └── tarefas.js
│   ├── services/
│   │   ├── githubApp.js
│   │   ├── githubWebhook.js
│   │   ├── githubEvents.js
│   │   └── xp.js
│   ├── routes/
│   │   └── routes.js
│   └── database/
├── scripts/
│   └── migrar_github_integracao.js
├── test/
│   ├── github.webhook.test.js
│   ├── github.push.test.js
│   └── github.pullRequest.test.js
└── docs/
    └── IMPLEMENTACAO_GITHUB_KANBAN.md
```

Frontend, exemplo:

```text
squad-hub/
├── src/
│   ├── components/projects/
│   │   ├── KanbanBoard.tsx
│   │   ├── GithubTaskActivity.tsx
│   │   └── GithubTaskBadge.tsx
│   ├── services/
│   │   ├── api.ts
│   │   ├── projectDetail.ts
│   │   └── github.ts
│   └── types/
│       └── github.ts
```

Adaptar ao padrão real encontrado durante o desenvolvimento. Não criar pastas apenas por estética se o projeto não precisar delas.

---

# 43. Evoluções posteriores ao MVP

Depois da integração principal estar estável:

## GitHub Actions

Mostrar checks do PR:

```text
Build ✓
Tests ✓
Lint ✓
```

Poder exigir CI verde antes da conclusão automática.

Regra futura:

```text
PR merged + CI success -> done
```

## Issues

Uma task MontesSquad pode opcionalmente possuir issue correspondente no GitHub.

## Criar branch pelo MontesSquad

Botão:

```text
Criar branch da tarefa
```

## Criar PR pelo MontesSquad

Botão:

```text
Abrir Pull Request
```

## Timeline técnica

```text
09:02 Task assumida
09:05 Branch criada
10:14 Commit a92f830
10:45 Commit 824af21
11:02 PR #52 aberto
12:18 PR aprovado
12:25 Merge
12:25 Task concluída
```

## Portfólio verificável

No perfil:

```text
Contribuições verificadas pelo GitHub
```

Isso cria um diferencial relevante para o MontesSquad: tarefas deixam de representar apenas declarações do usuário e passam a possuir evidências técnicas vinculadas ao fluxo real de desenvolvimento.

---

# 44. Regra de produto final

A integração deve seguir este princípio:

> MontesSquad gerencia o trabalho; GitHub fornece a evidência técnica.

O MontesSquad continua sendo a fonte da verdade para:

- projeto;
- membros;
- responsável;
- tarefa;
- prioridade;
- prazo;
- reputação;
- regras de colaboração.

O GitHub é a fonte da verdade para:

- branch existente;
- commit;
- SHA;
- autor GitHub;
- Pull Request;
- estado do PR;
- merge;
- checks de CI, em evolução futura.

Essa separação evita acoplamento excessivo e permite que projetos sem GitHub continuem funcionando normalmente.
