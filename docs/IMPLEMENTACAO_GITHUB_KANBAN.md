# MontesSquad — Especificação técnica executável da integração GitHub no Kanban

> Versão 3 — documento operacional. Este arquivo define **o que criar, o que alterar, em qual repositório, quais funções/endpoints/tabelas implementar, testes obrigatórios e gates de conclusão**.

---

# 1. Objetivo

Integrar o MontesSquad ao GitHub para que o sistema continue gerenciando projetos, squads e tarefas, enquanto o GitHub fornece evidências técnicas de execução.

Fluxo final:

```text
Projeto criado no MontesSquad
        ↓
GitHub opcional: conectar agora ou depois
        ↓
Tasks criadas no MontesSquad
        ↓
Membro assume task
        ↓
Branch associada à task
        ↓
Push/commits → atividade registrada
        ↓
PR aberto → Em revisão
        ↓
PR mergeado → Concluído
        ↓
XP + métricas + ranking atualizados
```

Regra principal:

> **Commit NÃO conclui tarefa. Commit registra atividade. A conclusão automática ocorre apenas quando o Pull Request relacionado é mergeado.**

---

# 2. Repositórios já analisados

## Frontend

```text
MatheusVRibeiro/squad-hub
```

Stack atual:

- React 19;
- TypeScript;
- Vite;
- Axios;
- TanStack Router/Query;
- Tailwind;
- Radix/shadcn;
- Vitest.

Arquivos existentes diretamente envolvidos:

```text
src/components/projects/KanbanBoard.tsx
src/services/projectDetail.ts
src/services/api.ts
```

## Backend

```text
MatheusVRibeiro/MontesSquad-API
```

Stack atual:

- Node.js;
- Express;
- MySQL/mysql2;
- JWT;
- bcrypt;
- Vitest;
- Supertest.

Arquivos existentes diretamente envolvidos:

```text
index.js
src/routes/routes.js
src/controllers/tarefas.js
src/controllers/projetos.js
src/controllers/usuarios.js
src/controllers/autenticacao.js
src/controllers/reputacao.js
src/controllers/notificacoes.js
src/middlewares/auth.js
src/database/createDatabase/Tabelas.sql
.env.example
package.json
```

---

# 3. REGRA ABSOLUTA DE EXECUÇÃO

## 3.1 Uma etapa por vez

**É PROIBIDO implementar a próxima etapa enquanto a etapa atual não estiver completamente finalizada.**

Uma etapa só está concluída quando todos os itens aplicáveis estiverem finalizados:

```text
[ ] arquivos planejados criados
[ ] arquivos planejados alterados
[ ] migration concluída quando aplicável
[ ] contratos backend/frontend coerentes
[ ] testes unitários passando
[ ] testes de integração passando
[ ] lint passando
[ ] regressões verificadas
[ ] segurança revisada
[ ] critérios de aceite demonstrados
[ ] arquivos alterados listados
[ ] nenhuma pendência bloqueante
```

Se um único item obrigatório estiver faltando, a etapa permanece **EM EXECUÇÃO**.

## 3.2 Uso de subagentes

Subagentes podem executar partes independentes da **mesma etapa**.

Exemplo:

```text
ETAPA 4 — Webhook

Subagente A → assinatura HMAC
Subagente B → idempotência
Subagente C → testes
```

O agente principal deve integrar, revisar e testar tudo antes de fechar a etapa.

## 3.3 Enquanto aguarda subagentes

Se houver subagentes trabalhando na etapa atual, o agente principal pode **analisar** a próxima etapa para melhorar o andamento.

Pode:

- ler arquivos;
- mapear dependências;
- verificar contratos;
- identificar riscos;
- decidir divisão futura;
- preparar checklist;
- planejar testes.

Não pode:

- alterar arquivos da etapa seguinte;
- criar código da etapa seguinte;
- executar migration da etapa seguinte;
- commitar implementação da etapa seguinte.

> **Planejamento antecipado é permitido. Implementação antecipada é proibida.**

---

# 4. Experiência funcional desejada

## 4.1 Criação de projeto sem GitHub obrigatório

O usuário não precisa ter um repositório GitHub antes de criar um projeto.

Na criação do projeto:

```text
Nome
Descrição
Tecnologias
Quantidade máxima de membros

Integração GitHub
○ Conectar depois
○ Conectar agora

[ Criar projeto ]
```

O padrão recomendado é `Conectar depois`.

Projetos sem GitHub continuam funcionando normalmente.

## 4.2 Conectar GitHub depois

Dentro do projeto adicionar área/aba GitHub:

```text
Visão geral | Kanban | Membros | GitHub | Mural
```

Sem integração:

```text
Este projeto ainda não possui repositório conectado.

[ Conectar GitHub ]
```

Com integração:

```text
GitHub conectado ✓
Repositório: usuario/repositorio
Branch padrão: main
```

## 4.3 Tasks continuam sendo criadas no MontesSquad

A task deve possuir:

```text
Título
Descrição
Prioridade
Prazo
Responsável opcional
```

Não criar task automaticamente como GitHub Issue no MVP.

## 4.4 Task assumível

Task sem responsável deve mostrar:

```text
Sem responsável
[ Assumir tarefa ]
```

Ao assumir:

- definir usuário autenticado como responsável;
- se estiver `todo`, mover para `doing`;
- operação deve ser atômica;
- se já houver responsável, retornar conflito HTTP 409;
- se projeto possuir GitHub, preparar branch sugerida.

## 4.5 Branch da task

Após o banco gerar o ID da task, gerar:

```text
task/{taskId}-{slug}
```

Exemplo:

```text
task/38-criar-api-de-login
```

No MVP, o sistema gera e salva o nome; o desenvolvedor cria a branch localmente.

Exibir comandos:

```bash
git checkout main
git pull origin main
git checkout -b task/38-criar-api-de-login
git push -u origin task/38-criar-api-de-login
```

---

# 5. Mapa completo de arquivos

## 5.1 Backend — arquivos NOVOS

Criar:

```text
src/controllers/github.js
src/controllers/rankings.js
src/services/githubApp.js
src/services/githubWebhook.js
src/services/githubEvents.js
src/services/githubTasks.js
src/services/xp.js
src/services/rankings.js
scripts/migrar_github_integracao.js
test/github.webhook.test.js
test/github.push.test.js
test/github.pullRequest.test.js
test/github.tasks.test.js
test/github.rankings.test.js
```

Opcional, se ficar mais organizado sem contrariar o padrão atual:

```text
src/utils/githubSignature.js
src/utils/slugify.js
```

## 5.2 Backend — arquivos EXISTENTES a alterar

```text
index.js
package.json
.env.example
src/routes/routes.js
src/controllers/tarefas.js
src/controllers/projetos.js
src/controllers/usuarios.js
src/controllers/reputacao.js
src/controllers/notificacoes.js
src/database/createDatabase/Tabelas.sql
docs/api.md
README.md
```

## 5.3 Frontend — arquivos NOVOS

Criar:

```text
src/services/github.ts
src/services/rankings.ts
src/components/projects/GithubProjectPanel.tsx
src/components/projects/GithubTaskActivity.tsx
src/components/projects/GithubTaskBadge.tsx
src/components/projects/TopCommitters.tsx
src/components/projects/TopContributors.tsx
```

Se o projeto já tiver uma pasta central de tipos, criar:

```text
src/types/github.ts
```

Caso contrário, manter tipos em `projectDetail.ts` para evitar arquitetura artificial.

## 5.4 Frontend — arquivos EXISTENTES a alterar

Obrigatoriamente revisar e alterar quando aplicável:

```text
src/components/projects/KanbanBoard.tsx
src/services/projectDetail.ts
src/services/api.ts
```

Também localizar e alterar a página real de detalhes do projeto para incluir:

```text
GithubProjectPanel
TopCommitters
TopContributors
```

Localizar a página/tela global adequada para incluir ranking global.

Não inventar uma rota sem antes verificar a estrutura real do TanStack Router.

---

# 6. ETAPA 0 — Baseline e proteção contra regressão

## Objetivo

Conhecer o estado atual antes de alterar qualquer comportamento.

## Arquivos a LER

Backend:

```text
package.json
index.js
src/routes/routes.js
src/controllers/tarefas.js
src/controllers/projetos.js
src/controllers/reputacao.js
src/controllers/notificacoes.js
src/middlewares/auth.js
src/database/createDatabase/Tabelas.sql
```

Frontend:

```text
package.json
src/components/projects/KanbanBoard.tsx
src/services/projectDetail.ts
src/services/api.ts
```

Também localizar:

- página de detalhes do projeto;
- página de perfil;
- layout/sidebar;
- testes atuais de projeto/task;
- onde XP é concedido no frontend.

## O que ALTERAR

Nada nesta etapa, salvo correção mínima necessária para fazer a suíte atual executar.

## O que EXECUTAR

Backend:

```bash
npm test
```

Frontend:

```bash
npm test
npm run lint
npm run build
```

## Entregável da etapa

Registrar:

- testes que já falhavam antes;
- arquitetura real encontrada;
- arquivos exatos que concedem XP;
- página exata de detalhe do projeto;
- página adequada para ranking global.

## Gate

Não seguir se não houver baseline conhecido.

---

# 7. ETAPA 1 — Banco de dados e migration GitHub

## Objetivo

Criar persistência para identidade GitHub, repository, branch, commits, PRs, webhook delivery e XP idempotente.

## CRIAR

```text
scripts/migrar_github_integracao.js
```

## ALTERAR

```text
src/database/createDatabase/Tabelas.sql
package.json
```

## 7.1 Alterar `usuarios`

Adicionar:

```sql
github_user_id BIGINT NULL
github_login VARCHAR(100) NULL
github_avatar_url VARCHAR(500) NULL
github_connected_at DATETIME NULL
```

Criar unique em `github_user_id` quando não nulo.

## 7.2 Alterar `projetos`

Adicionar:

```sql
github_repository_id BIGINT NULL
github_repository_full_name VARCHAR(255) NULL
github_installation_id BIGINT NULL
github_default_branch VARCHAR(255) NULL
github_connected_at DATETIME NULL
```

## 7.3 Alterar `tarefas`

Alterar enum:

```sql
ENUM('todo','doing','review','done')
```

Adicionar:

```sql
github_branch VARCHAR(255) NULL
github_pr_number INT NULL
github_pr_id BIGINT NULL
github_pr_url VARCHAR(500) NULL
github_pr_status ENUM('none','open','closed','merged') DEFAULT 'none'
github_last_activity_at DATETIME NULL
concluida_via ENUM('manual','github_merge') NULL
concluida_em DATETIME NULL
assumida_em DATETIME NULL
```

Criar índice:

```sql
INDEX idx_tarefas_projeto_github_branch (projeto_id, github_branch)
```

## 7.4 Criar `github_commits`

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
    UNIQUE KEY uq_github_commit_repo_sha (repository_id, sha),
    INDEX idx_github_commit_tarefa (tarefa_id),
    INDEX idx_github_commit_projeto (projeto_id),
    INDEX idx_github_commit_author (author_github_id),
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

## 7.5 Criar `github_pull_requests`

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
    UNIQUE KEY uq_github_pr_repo_numero (repository_id, numero),
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

## 7.6 Criar `github_webhook_deliveries`

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
    UNIQUE KEY uq_github_delivery (delivery_id)
) ENGINE=InnoDB;
```

## 7.7 Criar `eventos_xp`

```sql
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
```

## 7.8 Migration

`migrar_github_integracao.js` deve:

1. conectar ao banco usando configuração atual;
2. consultar `INFORMATION_SCHEMA` antes de adicionar coluna/índice;
3. ser idempotente;
4. nunca apagar dados;
5. criar tabelas ausentes;
6. adaptar enum de tarefas;
7. imprimir resumo;
8. encerrar com status de erro se alguma operação falhar.

Adicionar ao `package.json`:

```json
"db:github": "node scripts/migrar_github_integracao.js"
```

## Testes/validação

Executar migration duas vezes. A segunda execução deve finalizar sem erro e sem duplicar objetos.

## Gate

Só seguir após schema final validado.

---

# 8. ETAPA 2 — Contratos de tarefa e coluna `review`

## Objetivo

Fazer backend e frontend entenderem o quarto estado antes dos webhooks.

## Backend — ALTERAR

```text
src/controllers/tarefas.js
src/controllers/projetos.js
```

### Em `tarefas.js`

Alterar:

```js
const STATUS_VALIDOS = ["todo", "doing", "review", "done"];
```

Garantir que listagem/atualização aceite `review`.

### Em `projetos.js`

Garantir que `obterProjeto` retorne `review` sem remapeamento incorreto.

Retornar novos campos GitHub da task quando existentes:

```text
githubBranch
githubPrNumber
githubPrUrl
githubPrStatus
githubLastActivityAt
completionSource
completedAt
```

## Frontend — ALTERAR

```text
src/services/projectDetail.ts
src/components/projects/KanbanBoard.tsx
```

### `projectDetail.ts`

Alterar:

```ts
export type KanbanStatus = "todo" | "doing" | "review" | "done";
```

Expandir `KanbanTask` com campos GitHub.

### `KanbanBoard.tsx`

Adicionar coluna:

```text
Em revisão
```

Adicionar `review` ao dropdown mobile e drag/drop.

Nesta etapa ainda NÃO implementar automação por GitHub.

## Testes

- backend aceita PATCH para `review`;
- frontend renderiza 4 colunas;
- task em `review` aparece na coluna correta;
- build/lint passam.

## Gate

Frontend e backend precisam aceitar `review` antes de seguir.

---

# 9. ETAPA 3 — GitHub App e configuração

## Objetivo

Criar camada única para autenticação do backend com GitHub.

## Backend — CRIAR

```text
src/services/githubApp.js
```

## Backend — ALTERAR

```text
package.json
.env.example
```

## Dependências

Adicionar:

```bash
npm install @octokit/app @octokit/rest @octokit/webhooks
```

Usar somente as realmente necessárias após verificar compatibilidade CommonJS da aplicação atual.

## `.env.example`

Adicionar:

```env
GITHUB_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
GITHUB_APP_SLUG=
GITHUB_CALLBACK_URL=http://localhost:3333/github/callback
GITHUB_FRONTEND_SUCCESS_URL=http://localhost:5173
```

## `githubApp.js`

Implementar e exportar funções equivalentes a:

```js
getGitHubApp()
getInstallationClient(installationId)
getRepositoryById(installationId, repositoryId)
listInstallationRepositories(installationId)
```

Requisitos:

- validar envs ao usar serviço;
- não logar secrets;
- não enviar installation token ao frontend;
- encapsular Octokit em um único módulo.

## Testes

Mockar Octokit. Não depender de GitHub real na suíte automática.

## Gate

Serviço instanciável e testável antes de criar webhook.

---

# 10. ETAPA 4 — Webhook seguro e idempotente

## Objetivo

Criar entrada pública confiável para eventos GitHub.

## Backend — CRIAR

```text
src/controllers/github.js
src/services/githubWebhook.js
test/github.webhook.test.js
```

## Backend — ALTERAR

```text
index.js
src/routes/routes.js
```

## 10.1 Alteração crítica em `index.js`

Preservar raw body de `/github/webhook`.

Não deixar `express.json()` consumir/modificar o body antes da verificação da assinatura.

Implementar uma das estratégias válidas:

- middleware `express.raw()` específico antes do JSON global;
- `verify` de `express.json()` salvando raw body.

Escolher uma estratégia e adicionar teste.

## 10.2 `githubWebhook.js`

Implementar:

```js
verifyWebhookSignature(rawBody, signature)
getDeliveryId(req)
registerDelivery(...)
markDeliveryProcessed(...)
markDeliveryFailed(...)
isDeliveryDuplicate(...)
```

Validar:

```text
X-Hub-Signature-256
X-GitHub-Delivery
X-GitHub-Event
```

Assinatura com HMAC SHA-256 e `timingSafeEqual` ou biblioteca oficial equivalente.

## 10.3 `github.js`

Criar controller:

```js
webhook(request, response, next)
```

Fluxo:

1. obter raw body;
2. validar assinatura;
3. verificar delivery duplicado;
4. identificar evento;
5. registrar delivery;
6. delegar para processador apropriado;
7. marcar processado;
8. responder 200;
9. em erro, registrar falha.

## 10.4 `routes.js`

Adicionar:

```text
POST /github/webhook
```

NÃO usar `verificarToken` nessa rota.

## Testes obrigatórios

- assinatura correta → 200;
- assinatura inválida → 401/403;
- assinatura ausente → rejeita;
- delivery novo → processa;
- delivery repetido → 200 sem reprocessar;
- body adulterado → rejeita.

## Gate

Não implementar `push` antes de segurança/idempotência estarem passando.

---

# 11. ETAPA 5 — Conexão do projeto com repositório GitHub

## Objetivo

Permitir que projeto seja criado sem GitHub e conectado depois.

## Backend — ALTERAR

```text
src/controllers/github.js
src/controllers/projetos.js
src/routes/routes.js
```

## Frontend — CRIAR

```text
src/services/github.ts
src/components/projects/GithubProjectPanel.tsx
```

## Frontend — ALTERAR

Página real de detalhe do projeto.

## Backend — endpoints a CRIAR

```text
GET  /github/installations/:installationId/repositories
POST /projetos/:projetoId/github/repository
GET  /projetos/:projetoId/github/status
DELETE /projetos/:projetoId/github/repository
```

Dependendo do fluxo de instalação real também criar:

```text
GET /github/install
GET /github/callback
```

## `POST /projetos/:id/github/repository`

Somente owner.

Payload do frontend:

```json
{
  "installationId": 123,
  "repositoryId": 456
}
```

Backend deve consultar GitHub e obter por conta própria:

```text
full_name
default_branch
html_url
```

Nunca confiar em full name enviado pelo browser.

Persistir:

```text
github_repository_id
github_repository_full_name
github_installation_id
github_default_branch
github_connected_at
repositorio_url
```

## Frontend — `github.ts`

Criar funções:

```ts
getProjectGithubStatus(projectId)
getInstallationRepositories(installationId)
connectProjectRepository(projectId, payload)
disconnectProjectRepository(projectId)
```

## Frontend — `GithubProjectPanel.tsx`

Estados obrigatórios:

```text
loading
não conectado
conectado
erro
permissão insuficiente
repositório removido
```

## Testes

- não-owner → 403;
- repository inexistente/não autorizado → erro;
- owner conecta → dados salvos;
- projeto sem GitHub continua funcionando;
- desconexão não apaga tasks.

## Gate

Projeto precisa conectar/desconectar repository antes de task GitHub.

---

# 12. ETAPA 6 — Identidade GitHub do usuário

## Objetivo

Relacionar autoria do GitHub ao usuário MontesSquad.

## Backend — ALTERAR

```text
src/controllers/github.js
src/controllers/usuarios.js
src/routes/routes.js
```

## Frontend — ALTERAR/CRIAR

Usar tela de perfil/configurações existente; não criar tela paralela sem necessidade.

Adicionar métodos em:

```text
src/services/github.ts
```

## Endpoints

```text
GET    /github/me
GET    /github/connect
GET    /github/callback
DELETE /github/disconnect
```

Se callback de GitHub App e identidade do usuário exigirem fluxos diferentes, separar claramente instalação da App de OAuth do usuário.

Persistir:

```text
github_user_id
github_login
github_avatar_url
github_connected_at
```

## Segurança

- usar `state` anti-CSRF no OAuth;
- não salvar senha GitHub;
- tokens de usuário, caso indispensáveis, nunca no localStorage;
- preferir armazenar apenas identidade quando não houver necessidade de agir em nome do usuário.

## Testes

- conta conecta;
- github_user_id duplicado é rejeitado adequadamente;
- desconectar remove vínculo sem apagar histórico de commits.

## Gate

Autoria precisa ser resolvível antes de ranking por usuário.

---

# 13. ETAPA 7 — Task assumível e geração de branch

## Objetivo

Transformar tarefas sem responsável em unidades de colaboração.

## Backend — CRIAR/ALTERAR

Alterar:

```text
src/controllers/tarefas.js
src/routes/routes.js
```

Criar utilitário se necessário:

```text
src/utils/slugify.js
```

## Endpoint NOVO

```text
POST /projetos/:projetoId/tarefas/:tarefaId/assumir
```

## Implementação obrigatória

Executar de forma atômica.

Exemplo conceitual:

```sql
UPDATE tarefas
SET responsavel_id = ?, status = 'doing', assumida_em = NOW()
WHERE id = ?
  AND projeto_id = ?
  AND responsavel_id IS NULL;
```

Se `affectedRows = 0`, consultar task:

- inexistente → 404;
- já possui responsável → 409.

Validar que usuário é membro/dono.

## Branch

Após criação da task, se projeto tiver GitHub conectado, preencher `github_branch` com:

```text
task/{id}-{slug}
```

Decisão recomendada: gerar branch sugerida já na criação da task, independentemente de haver responsável, pois o ID já existe.

## Frontend — ALTERAR

```text
src/components/projects/KanbanBoard.tsx
src/services/projectDetail.ts
```

Adicionar:

- botão `Assumir tarefa`;
- loading durante operação;
- impedir duplo clique;
- tratar 409;
- mostrar branch após assumir;
- botão `Copiar comandos`.

## Service

Adicionar em `projectDetail.ts` ou `github.ts`, conforme responsabilidade:

```ts
claimTask(projectId, taskId)
```

## Testes

- dois usuários tentando assumir → apenas um vence;
- não membro → 403;
- task inexistente → 404;
- task assumida vai para `doing`;
- branch possui ID correto;
- slug trata acentos/espaços.

## Gate

Não implementar push até branch-task ser determinística.

---

# 14. ETAPA 8 — Processamento de `push` e commits

## Objetivo

Registrar commits automaticamente na task correta.

## Backend — CRIAR

```text
src/services/githubEvents.js
src/services/githubTasks.js
test/github.push.test.js
```

## Backend — ALTERAR

```text
src/controllers/github.js
src/routes/routes.js
```

## `githubEvents.js`

Implementar:

```js
processGitHubEvent(eventName, payload, context)
processPushEvent(payload, context)
processPullRequestEvent(payload, context) // placeholder só se necessário, implementação completa na próxima etapa
```

## `githubTasks.js`

Implementar funções equivalentes a:

```js
findTaskByRepositoryAndBranch(repositoryId, branch)
insertCommitIfAbsent(task, commit, repositoryId)
updateTaskGithubActivity(taskId, timestamp)
getTaskCommits(taskId)
```

## Push

Extrair:

```text
repository.id
installation.id
ref
commits[]
```

Converter:

```text
refs/heads/task/38-api-login
```

para:

```text
task/38-api-login
```

Localizar projeto por `github_repository_id` e task por `github_branch`.

Para cada commit:

- salvar SHA;
- mensagem;
- autor;
- login quando disponível;
- email quando fornecido;
- URL;
- horário;
- branch;
- repository ID.

Usar `INSERT IGNORE` ou tratamento explícito da unique key.

Não gerar XP.

Não concluir task.

## Endpoints NOVOS

```text
GET /projetos/:projetoId/tarefas/:tarefaId/github
GET /projetos/:projetoId/tarefas/:tarefaId/commits
```

Somente membro/dono.

## Frontend — CRIAR

```text
src/components/projects/GithubTaskActivity.tsx
src/components/projects/GithubTaskBadge.tsx
```

## Frontend — ALTERAR

```text
src/components/projects/KanbanBoard.tsx
src/services/github.ts
src/services/projectDetail.ts
```

Mostrar no card:

```text
GitHub ✓
4 commits
última atividade há 12 min
```

No modal:

```text
Branch
Commit SHA curto
Mensagem
Autor
Data
Link para commit
```

## Atualização

Usar React Query/polling contra **MontesSquad API**, não contra GitHub.

Sugestão inicial:

```ts
refetchInterval: 15000
```

apenas quando tela relevante estiver aberta.

## Testes

- branch conhecida → commit salvo;
- branch desconhecida → delivery processado sem task alterada;
- commit repetido → não duplica;
- push repetido → não duplica;
- commit não conclui task;
- frontend renderiza histórico.

## Gate

Commits precisam estar estáveis antes de PR.

---

# 15. ETAPA 9 — Pull Request e automação do Kanban

## Objetivo

Automatizar `doing → review → done`.

## Backend — ALTERAR

```text
src/services/githubEvents.js
src/services/githubTasks.js
src/controllers/github.js
```

## CRIAR teste

```text
test/github.pullRequest.test.js
```

## Eventos obrigatórios

```text
pull_request.opened
pull_request.reopened
pull_request.synchronize
pull_request.closed
```

## `opened/reopened`

Localizar task por:

```text
repository.id + pull_request.head.ref
```

Upsert em `github_pull_requests`.

Atualizar task:

```text
github_pr_number
github_pr_id
github_pr_url
github_pr_status = open
status = review
github_last_activity_at
```

## `synchronize`

Atualizar PR e atividade.

Não mudar `review` para outro estado.

## `closed` sem merge

Atualizar:

```text
github_pr_status = closed
```

Regra MVP:

```text
review → doing
```

Não conceder XP.

## `closed` com `merged=true`

Executar transação:

1. lock na task;
2. verificar se já concluída pelo mesmo PR;
3. atualizar PR para merged;
4. atualizar task para done;
5. `concluida_via = github_merge`;
6. `concluida_em = merged_at`;
7. chamar serviço XP idempotente;
8. criar notificação;
9. commit.

## Frontend

Atualizar `GithubTaskBadge.tsx` e `GithubTaskActivity.tsx` para exibir:

```text
PR #52 aberto
PR #52 mergeado
Conclusão verificada pelo GitHub ✓
```

## Testes

- opened → review;
- reopened → review;
- synchronize → continua review;
- closed sem merge → doing;
- closed merged → done;
- delivery repetido → não repetir efeitos.

## Gate

Não mexer em ranking/XP até automação do PR estar transacional.

---

# 16. ETAPA 10 — XP autoritativo no backend

## Objetivo

Remover a possibilidade de XP ser controlado pelo navegador.

## Backend — CRIAR

```text
src/services/xp.js
```

## Backend — ALTERAR

```text
src/controllers/reputacao.js
src/services/githubEvents.js
```

## Frontend — ALTERAR

```text
src/components/projects/KanbanBoard.tsx
```

Remover chamada autoritativa existente a `awardLocalXP(150)` ao simplesmente mover para `done`.

Se o frontend mantiver feedback visual, ele deve apenas mostrar o resultado retornado pelo backend.

## `xp.js`

Implementar algo equivalente a:

```js
awardXp({ connection, usuarioId, tarefaId, type, xp, idempotencyKey })
```

Fluxo:

1. inserir `eventos_xp`;
2. se unique conflict → não conceder novamente;
3. atualizar `estatisticas_usuario`;
4. recalcular nível se regra atual exigir;
5. retornar estado atualizado.

Chave de merge:

```text
task:{taskId}:github-merge:pr:{prNumber}
```

## Conclusão manual

Definir explicitamente regra de XP manual.

Recomendação:

- manter compatibilidade atual, mas backend concede;
- usar chave `task:{id}:manual-completion`;
- impedir duplicidade.

## Testes

- merge concede XP uma vez;
- webhook repetido não concede novamente;
- frontend mover card não cria XP sozinho;
- estatísticas permanecem coerentes.

## Gate

XP deve ser server-side antes dos rankings pontuados.

---

# 17. ETAPA 11 — Top Committers por projeto

## Objetivo

Mostrar volume de commits GitHub válidos dentro de um projeto.

## Backend — CRIAR

```text
src/controllers/rankings.js
src/services/rankings.js
test/github.rankings.test.js
```

## Backend — ALTERAR

```text
src/routes/routes.js
```

## Endpoint NOVO

```text
GET /projetos/:projetoId/rankings/committers
```

## Query/regra

Contar somente commits que:

- existem em `github_commits`;
- pertencem a tasks do projeto;
- possuem `author_github_id` relacionado a `usuarios.github_user_id` quando o ranking for atribuído a usuário MontesSquad.

Não contar commits externos soltos do perfil GitHub.

Resposta:

```json
{
  "sucesso": true,
  "dados": [
    {
      "userId": "12",
      "name": "João Silva",
      "githubLogin": "joaosilva",
      "avatarUrl": "...",
      "commitCount": 32
    }
  ]
}
```

## Frontend — CRIAR

```text
src/services/rankings.ts
src/components/projects/TopCommitters.tsx
```

## Frontend — ALTERAR

Página de detalhe do projeto.

Adicionar bloco:

```text
Top Committers
1. João — 32 commits
2. Maria — 24 commits
3. Pedro — 17 commits
```

## Regras UX

- explicar que quantidade não significa qualidade;
- permitir top 3/5;
- clicar pode abrir perfil se já existir rota;
- não mostrar usuários sem vínculo identificável como membros do ranking principal; opcionalmente agrupar como “GitHub não vinculado” em área separada.

## Testes

- conta apenas projeto atual;
- commit duplicado não aumenta ranking;
- usuário desconectado posteriormente mantém histórico via GitHub ID salvo no commit, mas estratégia de exibição deve ser definida.

## Gate

Ranking por projeto precisa estar correto antes do global.

---

# 18. ETAPA 12 — Top Committers geral

## Objetivo

Criar ranking global da plataforma com commits vinculados a projetos MontesSquad.

## Backend — ALTERAR

```text
src/controllers/rankings.js
src/services/rankings.js
src/routes/routes.js
```

## Endpoint NOVO

```text
GET /rankings/committers
```

Suportar query params:

```text
?limit=10&period=all
?limit=10&period=month
```

Para MVP, `all` obrigatório; `month` opcional se simples.

## Regra principal

**NÃO consultar todos os commits da conta do usuário no GitHub.**

Contar somente `github_commits` registrados dentro de projetos/tasks do MontesSquad.

## Frontend

Reutilizar `TopCommitters.tsx` com `scope="global"` ou criar wrapper apenas se necessário.

Inserir em uma página apropriada encontrada no baseline:

- dashboard;
- comunidade;
- ranking;
- home logada.

Não criar nova navegação desnecessariamente.

## Testes

- agrega múltiplos projetos;
- respeita limit;
- não conta commit fora do MontesSquad.

## Gate

Top Committers global validado antes de Top Contributors.

---

# 19. ETAPA 13 — Top Contributors por projeto

## Objetivo

Criar ranking principal de contribuição, evitando incentivar microcommits.

## Backend — ALTERAR

```text
src/services/rankings.js
src/controllers/rankings.js
src/routes/routes.js
```

## Frontend — CRIAR

```text
src/components/projects/TopContributors.tsx
```

## Endpoint

```text
GET /projetos/:projetoId/rankings/contributors
```

## Métricas consideradas

Mínimo:

```text
commits válidos
tasks verificadas por GitHub
PRs abertos
PRs mergeados
```

## Pontuação sugerida inicial

```text
commit válido                  = 1 ponto
PR aberto                      = 10 pontos
PR mergeado                    = 30 pontos
task concluída via github_merge = 50 pontos
```

### Anti-gaming

Limitar pontos provenientes de commits por task.

Exemplo:

```text
máximo 20 pontos de commit por task
```

Assim:

- 3 commits úteis = 3 pontos;
- 100 microcommits na mesma task = no máximo 20 pontos;
- merge e entrega continuam pesando mais.

Implementar a fórmula em **um único lugar** dentro de `src/services/rankings.js`.

Criar constantes:

```js
CONTRIBUTION_SCORE = {
  COMMIT: 1,
  MAX_COMMIT_POINTS_PER_TASK: 20,
  PR_OPENED: 10,
  PR_MERGED: 30,
  VERIFIED_TASK: 50,
};
```

## Resposta

```json
{
  "userId": "12",
  "name": "João",
  "score": 820,
  "commitCount": 32,
  "mergedPrCount": 4,
  "verifiedTaskCount": 4
}
```

## Frontend

Mostrar como ranking principal:

```text
Top Contributors
1. João — 820 pts
   4 tasks verificadas · 4 PRs mergeados · 32 commits
```

Mostrar Top Committers como métrica secundária.

## Testes

- cap de commits por task funciona;
- PR mergeado pontua uma vez;
- task verificada pontua uma vez;
- webhook duplicado não altera score indevidamente.

## Gate

Fórmula e testes documentados antes de ranking global.

---

# 20. ETAPA 14 — Top Contributors geral

## Objetivo

Criar ranking geral de contribuição comprovada na plataforma.

## Backend — ALTERAR

```text
src/services/rankings.js
src/controllers/rankings.js
src/routes/routes.js
```

## Endpoint NOVO

```text
GET /rankings/contributors
```

Suportar:

```text
?limit=10
```

Opcional depois:

```text
&period=month
&period=year
```

## Regra

Agregar somente evidências registradas em projetos MontesSquad.

Nunca usar “total de commits públicos do perfil GitHub” como pontuação.

## Frontend

Reutilizar componente com escopo global.

Exibir explicação curta da fórmula ou link/modal “Como funciona o ranking?”.

## Testes

- agrega projetos corretamente;
- usuário aparece uma vez;
- score = soma das contribuições elegíveis;
- cap por task preservado.

## Gate

Rankings locais e globais precisam produzir números reproduzíveis pelo backend.

---

# 21. ETAPA 15 — Notificações e timeline técnica

## Objetivo

Dar transparência sem gerar spam.

## Backend — ALTERAR

```text
src/controllers/notificacoes.js
src/services/githubEvents.js
```

## Eventos

### Push

Não notificar por commit individual por padrão.

Apenas atualizar atividade.

### PR aberto

Notificar owner e/ou responsável pela revisão conforme regra disponível:

```text
João abriu o PR #52 para “Criar API de Login”.
```

### PR fechado sem merge

```text
PR #52 foi fechado sem merge. A tarefa voltou para Em progresso.
```

### Merge

```text
PR #52 foi mergeado. Tarefa concluída e contribuição verificada.
```

## Timeline

Se a UI comportar, `GithubTaskActivity` pode apresentar:

```text
09:02 tarefa assumida
09:05 branch vinculada
10:14 commit a92f830
10:45 commit b22ca11
11:02 PR #52 aberto
12:25 PR mergeado
12:25 tarefa concluída
```

Não criar uma tabela de timeline separada no MVP se dados puderem ser derivados das tabelas atuais de forma eficiente.

## Testes

Garantir que merge duplicado não gere notificação duplicada se houver mecanismo de idempotência aplicável.

---

# 22. ETAPA 16 — Segurança e autorização completa

## Objetivo

Revisar toda superfície GitHub antes da entrega.

## Arquivos a REVISAR

```text
index.js
src/routes/routes.js
src/middlewares/auth.js
src/controllers/github.js
src/services/githubApp.js
src/services/githubWebhook.js
src/services/githubEvents.js
src/controllers/rankings.js
```

## Checklist obrigatório

- webhook usa assinatura, não JWT;
- endpoints de configuração GitHub usam JWT;
- somente owner conecta/desconecta repository;
- membro/dono acessa atividade privada do projeto;
- visitante não acessa commits privados;
- installation token nunca vai ao frontend;
- private key nunca vai ao frontend;
- secrets nunca aparecem em logs;
- queries são parametrizadas;
- mensagens de commit são tratadas como texto, nunca HTML confiável;
- OAuth usa state quando aplicável;
- rate limit avaliado para rotas sensíveis;
- payloads têm validação de tipos/tamanho.

## Testes negativos

Criar casos 401/403/404/409 relevantes.

---

# 23. ETAPA 17 — Integração frontend completa

## Objetivo

Unificar experiência sem quebrar o Kanban existente.

## Arquivos a revisar/alterar

```text
src/components/projects/KanbanBoard.tsx
src/components/projects/GithubProjectPanel.tsx
src/components/projects/GithubTaskActivity.tsx
src/components/projects/GithubTaskBadge.tsx
src/components/projects/TopCommitters.tsx
src/components/projects/TopContributors.tsx
src/services/projectDetail.ts
src/services/github.ts
src/services/rankings.ts
```

## Estados UX obrigatórios

### Projeto sem GitHub

Kanban funciona normalmente.

### Projeto com GitHub e task sem responsável

Mostrar:

```text
[ Assumir tarefa ]
```

### Task assumida

Mostrar responsável e branch.

### Sem commits

```text
Nenhuma atividade GitHub registrada ainda.
```

### Com commits

Mostrar quantidade e último commit.

### PR aberto

Badge `Em revisão` + link PR.

### Merge

Badge `Verificado pelo GitHub`.

### Falha de integração

Mostrar erro acionável sem derrubar página inteira.

## Mobile

Garantir que 4 colunas e modal continuem utilizáveis em tela pequena.

---

# 24. ETAPA 18 — Testes de regressão e aceite ponta a ponta

## Objetivo

Provar que integração nova não quebrou funcionalidades atuais.

## Backend

Executar toda suíte.

Adicionar cenários ponta a ponta com mocks do GitHub:

### Cenário A — projeto sem GitHub

1. criar projeto;
2. criar task;
3. atribuir/mover;
4. concluir manualmente conforme regra existente.

Tudo deve continuar funcionando.

### Cenário B — projeto conectado

1. criar projeto;
2. conectar repository;
3. criar task;
4. assumir task;
5. confirmar branch gerada;
6. enviar webhook push;
7. verificar commit;
8. enviar PR opened;
9. verificar review;
10. enviar PR merged;
11. verificar done;
12. verificar XP uma vez;
13. verificar Top Committers;
14. verificar Top Contributors.

### Cenário C — duplicidade

Reenviar todos os webhooks.

Nenhuma métrica, XP, commit ou PR deve duplicar indevidamente.

### Cenário D — concorrência ao assumir

Dois usuários tentam assumir a mesma task.

Apenas um recebe sucesso.

## Frontend

Executar:

```bash
npm test
npm run lint
npm run build
```

## Gate final

Nenhuma etapa é considerada entregue sem regressão final concluída.

---

# 25. Endpoints finais esperados

## GitHub

```text
POST   /github/webhook
GET    /github/me
GET    /github/connect
GET    /github/callback
DELETE /github/disconnect
GET    /github/installations/:installationId/repositories
```

## Projeto GitHub

```text
POST   /projetos/:projetoId/github/repository
GET    /projetos/:projetoId/github/status
DELETE /projetos/:projetoId/github/repository
```

## Task

```text
POST /projetos/:projetoId/tarefas/:tarefaId/assumir
POST /projetos/:projetoId/tarefas/:tarefaId/github/branch
GET  /projetos/:projetoId/tarefas/:tarefaId/github
GET  /projetos/:projetoId/tarefas/:tarefaId/commits
GET  /projetos/:projetoId/tarefas/:tarefaId/pull-request
```

O endpoint de branch manual pode ser omitido se a branch for sempre gerada pelo backend e não houver edição no MVP.

## Rankings

```text
GET /projetos/:projetoId/rankings/committers
GET /projetos/:projetoId/rankings/contributors
GET /rankings/committers
GET /rankings/contributors
```

---

# 26. Componentes finais esperados no frontend

```text
GithubProjectPanel
```

Responsável por conexão e status do repository.

```text
GithubTaskBadge
```

Resumo pequeno no card.

```text
GithubTaskActivity
```

Detalhe branch/commits/PR no modal.

```text
TopCommitters
```

Ranking bruto de commits válidos.

```text
TopContributors
```

Ranking ponderado de contribuição.

---

# 27. Regras de negócio consolidadas

1. GitHub é opcional na criação do projeto.
2. Projeto sem GitHub continua funcionando.
3. Tasks pertencem ao MontesSquad.
4. Task pode nascer sem responsável.
5. Membro pode assumir uma task livre.
6. Apenas um usuário assume a task.
7. Branch segue padrão por ID da task.
8. Commit registra atividade, não conclusão.
9. PR aberto leva task para `review`.
10. PR fechado sem merge não conclui.
11. PR mergeado conclui automaticamente.
12. XP é concedido no backend e é idempotente.
13. Top Committers conta somente commits vinculados ao MontesSquad.
14. Top Contributors é o ranking principal.
15. Microcommits não podem dominar pontuação.
16. Ranking global nunca lê todos os commits públicos de uma conta como se fossem contribuições MontesSquad.
17. Histórico GitHub não deve ser apagado quando responsável muda.
18. Username GitHub pode mudar; `github_user_id` é referência estável.

---

# 28. Casos de borda obrigatórios

Implementar/testar:

```text
push em branch desconhecida
commit duplicado
webhook duplicado
PR sem task correspondente
PR fechado sem merge
PR reaberto
force push
squash merge
rebase merge
repository removido da instalação
usuário muda username
usuário desconecta GitHub
task muda de responsável
dois usuários tentam assumir task
repository desconectado com tasks antigas
projeto sem GitHub
```

Squash/rebase não alteram regra de conclusão: confiar em `pull_request.merged === true`.

---

# 29. Ordem obrigatória de implementação

Executar estritamente nesta ordem:

```text
ETAPA 0  Baseline
ETAPA 1  Banco/migration
ETAPA 2  Contrato review
ETAPA 3  GitHub App service
ETAPA 4  Webhook seguro
ETAPA 5  Repository no projeto
ETAPA 6  Identidade GitHub do usuário
ETAPA 7  Assumir task + branch
ETAPA 8  Push/commits
ETAPA 9  Pull Request
ETAPA 10 XP backend
ETAPA 11 Top Committers projeto
ETAPA 12 Top Committers geral
ETAPA 13 Top Contributors projeto
ETAPA 14 Top Contributors geral
ETAPA 15 Notificações/timeline
ETAPA 16 Segurança completa
ETAPA 17 Integração frontend
ETAPA 18 Regressão/E2E
```

**Não pular etapa.**

Se uma etapa não exigir alteração porque já foi satisfeita por implementação anterior, isso deve ser comprovado pelo gate e documentado antes de avançar.

---

# 30. Formato obrigatório do relatório ao terminar cada etapa

O agente deve responder internamente/na execução com:

```text
ETAPA X CONCLUÍDA

Arquivos criados:
- ...

Arquivos alterados:
- ...

Banco:
- ...

Endpoints:
- ...

Testes executados:
- ...

Resultado:
- ...

Segurança revisada:
- ...

Pendências:
- nenhuma

GATE:
[x] implementação
[x] migration
[x] testes
[x] lint
[x] regressão aplicável
[x] segurança
[x] contratos
[x] critérios de aceite
```

Se existir pendência:

```text
ETAPA X AINDA NÃO CONCLUÍDA
```

E não avançar.

---

# 31. Prompt mestre para agente de implementação

```text
Você é o engenheiro principal responsável por implementar a integração GitHub do MontesSquad.

Repositórios:
Frontend: MatheusVRibeiro/squad-hub
Backend: MatheusVRibeiro/MontesSquad-API

Leia integralmente docs/IMPLEMENTACAO_GITHUB_KANBAN.md antes de alterar código.

Este documento é a especificação operacional e a fonte de verdade para a implementação.

REGRA ABSOLUTA:
Implemente exatamente UMA etapa por vez, seguindo a ordem definida no documento. Não comece a etapa seguinte até que TODOS os itens do gate da etapa atual estejam concluídos.

Se estiver aguardando subagentes da etapa atual, use o tempo para analisar e planejar a etapa seguinte, mapear arquivos, dependências, riscos e divisão de trabalho. NÃO altere arquivos da etapa seguinte enquanto o gate atual não estiver fechado.

Antes de cada etapa:
1. releia a seção correspondente;
2. confirme arquivos a criar;
3. confirme arquivos a alterar;
4. confirme migration;
5. confirme endpoints/funções;
6. confirme testes obrigatórios.

Durante a etapa:
- preserve arquitetura existente;
- não introduza ORM;
- mantenha MySQL;
- use queries parametrizadas;
- não quebre login, projetos, candidaturas, membros, mural, reputação ou Kanban;
- nunca coloque GitHub secret/private key/token no frontend;
- não confie em IDs GitHub enviados pelo browser sem validar;
- mantenha compatibilidade com projetos sem GitHub;
- commit nunca conclui task;
- PR mergeado é a evidência de conclusão automática.

Ao terminar cada etapa:
- rode testes;
- rode lint/build quando aplicável;
- revise segurança;
- revise regressões;
- liste arquivos criados/alterados;
- complete o gate.

Se qualquer item falhar, corrija antes de avançar.

Ranking:
- Top Committers = volume de commits válidos vinculados a tasks MontesSquad;
- Top Contributors = ranking principal ponderando commits, PRs mergeados e tasks verificadas;
- aplicar cap de pontos de commits por task para reduzir gaming;
- ranking global deve usar somente evidências registradas no MontesSquad.

CRITÉRIO FINAL:
Projeto pode existir sem GitHub. Depois pode conectar repository. Membro assume task, recebe branch sugerida, commits aparecem automaticamente, PR leva a Em revisão, merge conclui a task, XP é concedido uma vez e rankings são atualizados corretamente.
```

---

# 32. Definição de pronto do projeto inteiro

A integração somente estará pronta quando for possível demonstrar, do início ao fim:

```text
1. Usuário cria projeto sem GitHub.
2. Projeto funciona normalmente.
3. Owner conecta repository depois.
4. Usuário conecta identidade GitHub.
5. Owner cria task sem responsável.
6. Membro assume task.
7. Sistema gera branch task/{id}-{slug}.
8. Desenvolvedor faz push.
9. Commit aparece automaticamente na task.
10. Commit NÃO conclui task.
11. Desenvolvedor abre PR.
12. Task vai automaticamente para Em revisão.
13. PR é mergeado.
14. Task vai automaticamente para Concluído.
15. Task exibe Verificado pelo GitHub.
16. XP é concedido exatamente uma vez.
17. Top Committers do projeto atualiza.
18. Top Committers global atualiza.
19. Top Contributors do projeto atualiza.
20. Top Contributors global atualiza.
21. Webhooks repetidos não duplicam nada.
22. Projetos sem GitHub continuam funcionando.
23. Testes, lint e build passam.
```

Se qualquer um desses comportamentos não estiver demonstrável, a implementação ainda não está concluída.
