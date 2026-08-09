# Documentação de Rotas e Contratos da API - MontesSquad

Este documento descreve o formato padrão de respostas da API e fornece detalhes sobre os principais endpoints do MontesSquad.

## Contrato de Resposta Padronizado

Todas as respostas HTTP retornadas pela API seguem a mesma estrutura JSON.

### Resposta de Sucesso (HTTP 200, 201)
```json
{
  "sucesso": true,
  "message": "Mensagem descritiva da ação realizada com sucesso.",
  "dados": {
    "campo1": "valor1",
    "campo2": "valor2"
  }
}
```
*Observação: Quando aplicável, por exemplo na listagem de itens, pode conter também o campo `nItens` no mesmo nível.*

### Resposta de Erro (HTTP 400, 401, 403, 404, 500)
```json
{
  "sucesso": false,
  "message": "Mensagem detalhando o erro amigável ao usuário.",
  "dados": null
}
```
*Observação: Em ambiente de desenvolvimento (`NODE_ENV=development`), o campo `dados` conterá a mensagem técnica ou o stack trace do erro (`error.message`). Em produção (`NODE_ENV=production`), ele será sempre `null` para evitar vazamentos de informações internas de banco de dados.*

---

## Principais Endpoints

### 1. Autenticação (Pública)

#### `POST /login`
Efetua o login de um usuário cadastrado e retorna o token de autenticação.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "senha": "password123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Login realizado com sucesso",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "dados": {
      "id": 1,
      "nome": "João Silva",
      "email": "user@example.com",
      "tipo": "membro"
    }
  }
  ```

#### `POST /recuperar-senha`
Solicita link de recuperação de senha por e-mail.
- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```

---

### 2. Usuários

#### `POST /usuarios` (Pública)
Cadastra um novo usuário na plataforma.
- **Request Body:**
  ```json
  {
    "nome": "João Silva",
    "email": "user@example.com",
    "senha": "password123",
    "bio": "Desenvolvedor Backend Node.js",
    "localizacao": "Belo Horizonte, MG"
  }
  ```

#### `PATCH /usuarios/:id` (Requer Token)
Atualiza os dados cadastrais do perfil do próprio usuário.
- **Request Body:**
  ```json
  {
    "bio": "Desenvolvedor Backend Pleno"
  }
  ```

---

### 3. Projetos (Squads)

#### `POST /projetos` (Requer Token)
Cria um novo projeto. O usuário autenticado torna-se automaticamente o dono (Owner).
- **Request Body:**
  ```json
  {
    "name": "MonteSquad Web",
    "description": "Plataforma para formação de squads e projetos colaborativos.",
    "membersLimit": 6,
    "repositorioUrl": "https://github.com/exemplo",
    "figmaUrl": "https://figma.com/exemplo"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Cadastro de projeto realizado com sucesso",
    "dados": {
      "id": 10,
      "criador_id": 1,
      "titulo": "MonteSquad Web",
      "descricao": "Plataforma para formação de squads e projetos colaborativos.",
      "status": "aberto",
      "limite_membros": 6,
      "repositorio_url": "https://github.com/exemplo",
      "figma_url": "https://figma.com/exemplo",
      "discord_url": null,
      "documentacao_url": null
    }
  }
  ```

#### `GET /projetos/:id` (Requer Token)
Obtém o detalhamento completo de um projeto específico, incluindo seus membros da equipe, tarefas do Kanban, mensagens do mural e candidaturas (caso o usuário logado seja o dono).
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Detalhes do projeto carregados com sucesso",
    "dados": {
      "id": "10",
      "name": "MonteSquad Web",
      "description": "Plataforma para...",
      "status": "Aberto",
      "membersLimit": 6,
      "members": [
        { "id": "1", "name": "João Silva", "role": "Owner", "skills": [] }
      ],
      "tasks": [],
      "messages": [],
      "applications": []
    }
  }
  ```

---

### 4. Mural de Mensagens

#### `POST /projetos/:projetoId/mensagens` (Requer ser Membro ou Dono)
Envia uma mensagem no mural de discussões do squad.
- **Request Body:**
  ```json
  {
    "content": "Olá a todos do squad! Vamos agendar nossa primeira reunião."
  }
  ```

---

### 5. Candidaturas (Match)

#### `POST /projetos/:projetoId/candidaturas` (Requer Token)
Um membro candidata-se para participar de um squad de projeto.
- **Request Body:**
  ```json
  {
    "mensagem": "Possuo experiência com React e gostaria de apoiar no frontend!"
  }
  ```

---

### 6. Kanban & Tarefas

#### `POST /projetos/:projetoId/tarefas` (Requer ser Membro ou Dono do Projeto)
Cria e atribui uma tarefa a um membro do squad. Desde a FASE-03 (3.G), membros do squad podem criar tarefas (não apenas o dono).
- **Request Body:**
  ```json
  {
    "titulo": "Modelagem SQL",
    "descricao": "Escrever os scripts DDL iniciais",
    "prioridade": "high",
    "responsavel_id": 2
  }
  ```
- **Nota:** quando `responsavel_id` está presente, o sistema dispara uma notificação do tipo `task` para o responsável.

---

### 7. Notificações

#### `GET /notificacoes` (Requer Token)
Lista as notificações do usuário autenticado, mais recentes primeiro.
- **Contrato (camelCase):** o campo `dados` é um array de `{ id, type, title, description, createdAt, read, link }`.
- `type` é um ENUM: `application` (nova candidatura p/ o dono), `approved` (candidatura aprovada), `message` (nova mensagem no mural), `task` (tarefa atribuída), `system`.

#### `POST /notificacoes/ler-tudo` (Requer Token)
Marca todas as notificações do usuário como lidas (`read = true`).

---

### 8. Reputação

#### `GET /usuarios/:userId/reputacao` (Requer Token; alias `me` para o próprio usuário)
Retorna o resumo de reputação do usuário: XP, nível, avaliações, histórico de projetos e conquistas.
- **Contrato:** `dados` com `{ level, xp, xpProximo, reputacao, projetosConcluidos, conquistas, historico, avaliacoes }` (campos aninhados em camelCase — conferir com `references/fase02-controllers-contrato.md`).

---

### 9. Habilidades

#### `GET /habilidades` (Requer Token)
Lista a base global de habilidades disponíveis.

#### `POST /habilidades-usuario` (Requer Token)
Vincula uma habilidade ao usuário autenticado.
- **Request Body:** `{ habilidade_id }` (ou `{ habilidadeId }` conforme contrato — conferir controller).

#### `POST /habilidades-projeto` (Requer Token)
Vincula uma habilidade (tecnologia) a um projeto.
- **Request Body:** `{ projeto_id, habilidade_id }`.

---

### 10. Healthcheck

#### `GET /health` (Público)
Verifica a conectividade com o banco de dados sem derrubar o boot.
- **Resposta:** `{ sucesso: true, banco: "ok" | "erro" }` — HTTP 200 mesmo com banco indisponível (banco `"erro"`).

---

### 11. Integração GitHub — Visão Geral

A integração GitHub–Kanban conecta o repositório do projeto ao quadro de tarefas do MontesSquad. São dois fluxos de autenticação distintos:

1. **Conta GitHub do usuário (OAuth 2.0)** — o usuário conecta a própria conta GitHub (`/github/connect` → `/github/callback`). Necessário para o backend identificar o autor dos commits (JOIN por `usuarios.github_user_id`).
2. **Repositório do projeto (GitHub App / Installation)** — somente o **owner** conecta um repositório à instalação do app (`POST /projetos/:projetoId/github/repository`). A partir daí, as tarefas ganham branch automática `task/{id}-{slug}`.

O fluxo de dados é **unidirecional**: eventos `push` e `pull_request` do GitHub chegam via webhook (assinatura HMAC) e atualizam o Kanban; o backend **nunca** escreve no GitHub. Só o **merge de um Pull Request conclui a tarefa**.

**🔒 Nota de segurança:** o *installation token* (JWT do GitHub App assinado com a private key) e a *private key* do app **nunca saem do backend**. A consulta ao GitHub (validação do repositório, listagem de repositórios da instalação) é feita exclusivamente no servidor, que também valida a assinatura HMAC de cada webhook. O frontend só recebe dados públicos (`full_name`, `html_url`, `default_branch` etc.).

---

### 12. GitHub — Webhook (Público)

#### `POST /github/webhook` (Público — assinatura HMAC)
Recebe os eventos `push` e `pull_request` enviados pelo GitHub. **Não usa token JWT**: a autenticação é a assinatura `X-Hub-Signature-256` (HMAC SHA-256 do **raw body** com `GITHUB_WEBHOOK_SECRET`, comparação via `timingSafeEqual`; aceita também o formato antigo `X-Hub-Signature` SHA-1 como fallback). O body bruto é preservado por `express.raw()` antes do parse JSON.
- **Headers obrigatórios:** `X-Hub-Signature-256` (ou `X-Hub-Signature`), `X-GitHub-Delivery` (idempotência), `X-GitHub-Event` (`push` | `pull_request`).
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Webhook recebido",
    "processado": true,
    "deliveryId": "f4c2d1e0-0000-0000-0000-000000000000",
    "motivo": "commits_salvos"
  }
  ```
- **Erros:** 400 (body vazio, JSON inválido ou `X-GitHub-Delivery` ausente), 401 (assinatura inválida ou ausente).
- **Idempotência:** entregas (`X-GitHub-Delivery`) já processadas respondem `200` com `idempotente: true` sem reprocessar.

---

### 13. GitHub — Conta do Usuário (OAuth)

#### `GET /github/me` (Logado)
Retorna o estado da conta GitHub do usuário autenticado.
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Conta GitHub conectada",
    "dados": {
      "conectado": true,
      "github_user_id": 123456,
      "github_login": "joaosilva",
      "github_avatar_url": "https://avatars.githubusercontent.com/u/123456?v=4",
      "github_connected_at": "2026-08-08T12:00:00.000Z"
    }
  }
  ```

#### `GET /github/connect` (Logado)
Gera a URL de autorização OAuth do GitHub com `state` anti-CSRF (JWT curto, 10 min).
- **Response (200 OK):** `dados: { url, state }` — `url` aponta para `https://github.com/login/oauth/authorize` com `scope=read:user`.

#### `GET /github/callback` (Público — redirect do GitHub)
Recebe `code` + `state` do GitHub, valida o `state` (anti-CSRF), troca o `code` por token de acesso **no backend** e vincula `github_user_id/github_login/github_avatar_url/github_connected_at` ao usuário MontesSquad. Redireciona para `GITHUB_FRONTEND_SUCCESS_URL` (padrão `http://localhost:5173`) com `?github=connected`.
- **Erros:** 400 (`code`/`state` ausentes), 401 (`state` inválido ou expirado), 409 (conta GitHub já vinculada a outro usuário), 502 (falha ao obter usuário do GitHub).

#### `DELETE /github/disconnect` (Logado)
Remove o vínculo da conta GitHub do usuário. **O histórico de commits já registrado é preservado.**

#### `GET /github/installations/:installationId/repositories` (Logado)
Lista os repositórios disponíveis na instalação do GitHub App (usado pelo owner para escolher o repositório a conectar).
- **Response (200 OK):** `nItens` + `dados: [{ id, full_name, html_url, default_branch, private }]`.

---

### 14. GitHub — Repositório do Projeto

#### `POST /projetos/:projetoId/github/repository` (Somente owner)
Conecta um repositório da instalação ao projeto. O backend **consulta o GitHub como autoridade** (nunca confia no `full_name` enviado pelo navegador).
- **Request Body:**
  ```json
  {
    "installationId": 48219374,
    "repositoryId": 889900112
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Repositório conectado ao projeto",
    "dados": {
      "github_repository_id": 889900112,
      "github_repository_full_name": "joaosilva/montesquad",
      "github_installation_id": 48219374,
      "github_default_branch": "main",
      "repositorio_url": "https://github.com/joaosilva/montesquad"
    }
  }
  ```
- **Erros:** 400 (faltam `installationId`/`repositoryId`), 404 (repositório não encontrado/não autorizado pela instalação, ou projeto inexistente).

#### `GET /projetos/:projetoId/github/status` (Membro/dono)
Retorna o estado da conexão GitHub do projeto.
- **Response (200 OK):** `dados: { conectado, github_repository_id, github_repository_full_name, github_installation_id, github_default_branch, github_connected_at, repositorio_url }`.

#### `DELETE /projetos/:projetoId/github/repository` (Somente owner)
Desconecta o repositório do projeto. **Não apaga tarefas nem histórico de commits**.
- **Response (200 OK):** `{ "sucesso": true, "message": "Repositório desconectado (tasks preservadas)", "dados": null }`.

---

### 15. Tarefas — Fluxo GitHub

#### `POST /projetos/:projetoId/tarefas/:tarefaId/assumir` (Membro/dono)
Assume a tarefa (UPDATE atômico com `responsavel_id IS NULL` — em corrida, um só vence), muda o status para `doing` e, se o projeto tem GitHub, gera a branch `task/{id}-{slug}` (slug sem acentos, máx. 50 chars). A branch também é gerada na criação da task quando o projeto tem GitHub.
- **Response (200 OK):** `dados: { id, titulo, status: "doing", github_branch, assumida_em, responsavel_nome }`.
- **Erros:** 404 (tarefa inexistente no projeto), **409** (tarefa já possui responsável).

#### `GET /projetos/:projetoId/tarefas/:tarefaId/github` (Membro/dono)
Status GitHub da tarefa.
- **Response (200 OK):** `dados: { github_branch, github_pr_number, github_pr_url, github_pr_status, github_last_activity_at, completion_source, completed_at }`.

#### `GET /projetos/:projetoId/tarefas/:tarefaId/commits` (Membro/dono)
Commits da branch da tarefa (máx. 50, mais recentes primeiro).
- **Response (200 OK):** `nItens` + `dados: [{ sha, sha_curto, mensagem, autor, login, email, url, commit_em, branch }]`. Se o projeto não tem GitHub ou a task não tem branch, retorna `dados: []`.

#### `GET /projetos/:projetoId/tarefas/:tarefaId/timeline` (Membro/dono)
Timeline técnica da tarefa, **derivada** das tabelas existentes (sem tabela nova): eventos ordenados por data — `assumida`, `branch`, `commit` (sha curto/autor/url), `pr_open`/`pr_merged`/`pr_closed` e `concluida` (via merge).
- **Response (200 OK):** `nItens` + `dados: [{ tipo, titulo, detalhe, quando, ... }]`.

---

### 16. Rankings — Top Committers

Conta **somente** commits registrados em tarefas MontesSquad (tabela `github_commits`), agrupados pelo autor (JOIN `usuarios` por `github_user_id`).

#### `GET /projetos/:projetoId/rankings/committers` (Membro/dono)
Top committers do projeto. `?limit` (padrão 5, máx. 50).
- **Response (200 OK):** `nItens` + `dados: [{ userId, name, githubLogin, avatarUrl, commitCount }]`.

#### `GET /rankings/committers` (Logado)
Top committers global. `?limit` (padrão 10, máx. 50) e `?period=all|month` (padrão `all`; `month` filtra commits dos últimos 30 dias).
- **Response (200 OK):** `nItens` + `period` + `dados: [{ userId, name, githubLogin, avatarUrl, commitCount }]`.

---

### 17. Rankings — Top Contributors

Ranking por **score de contribuição** (qualidade, não volume de commits). Fórmula única (`CONTRIBUTION_SCORE`):
- Commit: **1 pt** · PR aberto: **10 pts** · PR mergeado: **30 pts** · Tarefa verificada (merge): **50 pts**
- **Anti-gaming:** pontos de commit por tarefa limitados a **20 pts/tarefa** (`MAX_COMMIT_POINTS_PER_TASK`).
- Evidências: commits (`github_commits` JOIN `usuarios.github_user_id`), PRs (`github_pull_requests` via `tarefas.responsavel_id`), tarefas verificadas (`eventos_xp` tipo `github_merge`).

#### `GET /projetos/:projetoId/rankings/contributors` (Membro/dono)
Top contributors do projeto. `?limit` (padrão 10, máx. 50).
- **Response (200 OK):** `nItens` + `dados: [{ userId, name, githubLogin, avatarUrl, commitCount, prsAbertos, prsMergeados, tasksVerificadas, score }]`.

#### `GET /rankings/contributors` (Logado)
Top contributors global. `?limit` (padrão 10, máx. 50) e `?period=all|month`.
- **Response (200 OK):** `nItens` + `period` + `dados: [{ userId, name, githubLogin, avatarUrl, commitCount, prsAbertos, prsMergeados, tasksVerificadas, score }]`.

---

### 18. Eventos do Webhook GitHub Processados

| Evento GitHub | Ação | Efeito no Kanban |
|---|---|---|
| `push` | — | Registra os commits da branch `task/{id}-…` em `github_commits` (INSERT IGNORE — commit repetido não duplica) e atualiza `github_last_activity_at`. **Não gera XP e não conclui tarefa.** Branch desconhecida → delivery processado sem alterações. |
| `pull_request` | `opened` | Cria/atualiza o PR em `github_pull_requests` e muda a tarefa para **`review`** (+ notificação "Pull request aberto"). |
| `pull_request` | `reopened` | Tarefa volta para **`review`** (PR reaberto). |
| `pull_request` | `synchronize` | Mantém a tarefa em **`review`** (novos pushes no PR); só atualiza a atividade. |
| `pull_request` | `closed` (sem merge) | Tarefa volta para **`doing`** (PR fechado sem merge). |
| `pull_request` | `closed` (merged) | Tarefa concluída: **`done`** + `completion_source='github_merge'` + `completed_at=merged_at`, transacional e **idempotente** (delivery repetido ou merge já registrado → sem efeitos). Concede **+150 XP** (`XP_GITHUB_MERGE`) via `eventos_xp` (chave `task:{id}:github-merge:pr:{n}` — idempotente; falha de XP nunca derruba o merge) + notificação com `(+150 XP)` quando concedido. |

---

### 19. Evolução ETAPA 2 — Vínculo GitHub pela conta (Configurações > Integrações)

Desde a **ETAPA 1** o usuário pode entrar no MontesSquad com o GitHub (`GET /auth/github` → `GET /auth/github/callback`). A **ETAPA 2** complementa esse fluxo para **dentro do sistema**: quem criou conta localmente pode **vincular** o GitHub à conta atual, e quem entrou pelo GitHub pode **gerenciar/desconectar** o vínculo — desde que mantenha um método de login alternativo (senha local).

Para isso foi adicionada a coluna **`usuarios.senha_definida`** (detalhes ao final desta seção), que indica se a conta possui uma senha local utilizável. A regra central é: **conta criada via GitHub (`cadastro_origem='github'`) sem senha local (`senha_definida=0`) NÃO pode desconectar o GitHub** — primeiro é preciso definir uma senha (via `POST /auth/github/complete-profile` ou `PATCH /usuarios/:id`), evitando uma conta sem nenhum método de login.

#### `GET /github/me` (Requer Token)
Retorna o estado da conta GitHub do usuário autenticado. **Novo na ETAPA 2:** além dos campos já documentados na seção 13, a resposta passa a incluir `senha_definida` e `cadastro_origem`, usados pelo frontend (`GitHubConnectionCard`) para exibir o vínculo e liberar/bloquear a opção "Desconectar".
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Conta GitHub conectada",
    "dados": {
      "conectado": true,
      "github_user_id": 123456,
      "github_login": "joaosilva",
      "github_avatar_url": "https://avatars.githubusercontent.com/u/123456?v=4",
      "github_connected_at": "2026-08-08T12:00:00.000Z",
      "senha_definida": false,
      "cadastro_origem": "github"
    }
  }
  ```

#### `GET /github/connect` (Requer Token)
Gera a URL de autorização OAuth do GitHub para **vincular o GitHub à conta atual** (usuário já autenticado no MontesSquad) — fluxo distinto do cadastro/login da ETAPA 1 (`GET /auth/github`). Inclui `state` anti-CSRF (JWT curto, 10 min).
- **Response (200 OK):** `dados: { url, state }` — `url` aponta para `https://github.com/login/oauth/authorize` com `scope=read:user`.

#### `GET /github/callback-link` (Requer Token)
**Alias de `GET /github/connect`** (mesma resposta `{ url, state }`): é a rota prevista no plano para o vínculo pós-login — usuário autenticado clica em "Conectar" e recebe a URL de autorização OAuth do GitHub com `state` anti-CSRF carregando o `uid` da conta atual. O retorno do OAuth **sempre** acontece em `GET /github/callback` (a `redirect_uri` registrada no GitHub App — não há rota separada de retorno; o `state` valida que o vínculo vai para a conta que iniciou o fluxo).
- **Erros:** 400 (`code`/`state` ausentes), 401 (`state` inválido ou expirado), **409** (GitHub ID já vinculado a outra conta MontesSquad), 502 (falha ao obter usuário do GitHub).

#### `DELETE /github/disconnect` (Requer Token)
Remove o vínculo da conta GitHub do usuário. **O histórico de commits já registrado é preservado.**
- **Regra ETAPA 2 (evita conta sem método de login):** se `cadastro_origem='github'` **e** `senha_definida=0`, retorna **409**:
  ```json
  {
    "sucesso": false,
    "message": "Crie uma senha local antes de desconectar o GitHub",
    "dados": null
  }
  ```
- **Response (200 OK)** quando o vínculo é removido (conta local, ou conta GitHub que já definiu senha): `{ "sucesso": true, "message": "Conta GitHub desconectada (histórico preservado)", "dados": null }`.

#### `POST /auth/github/complete-profile` (Requer Token)
Completa o perfil do usuário que entrou com GitHub (ETAPA 1). **Novo na ETAPA 2:** quando o body inclui `senha` (mín. 6 caracteres), o backend também marca **`senha_definida = 1`** — a partir desse momento o usuário pode desconectar o GitHub (o `DELETE /github/disconnect` deixa de retornar 409).
- **Request Body:**
  ```json
  {
    "nome": "João Silva",
    "bio": "Desenvolvedor Backend",
    "senha": "novaSenha123"
  }
  ```

---

### Coluna nova — `usuarios.senha_definida` (Evolução ETAPA 2)

| Aspecto | Detalhe |
|---|---|
| Definição | `senha_definida TINYINT(1) DEFAULT 0 NOT NULL` |
| Cadastro local (`POST /usuarios`) | Gravada como `1` (senha definida no cadastro) |
| Cadastro via GitHub (`GET /auth/github/callback`) | Gravada como `0` (senha interna aleatória, não utilizável) |
| `POST /auth/github/complete-profile` com `senha` | Atualizada para `1` |
| `PATCH /usuarios/:id` com `senha` | Atualizada para `1` |
| Recuperação/reset de senha (`/recuperar-senha`, `/resetar-senha`) | Atualizada para `1` |
| Backfill (migração `scripts/migrar_evolucao_etapa2.js`) | Contas com `cadastro_origem='local'` → `1`; contas `github` permanecem `0` |

**Efeito no fluxo:** com `senha_definida=1` a conta sempre terá a senha local como método de login alternativo, liberando a desconexão do GitHub. A migração é aditiva e idempotente (consulta `INFORMATION_SCHEMA` antes de criar a coluna).

---

### 20. Evolução ETAPA 3 — Perfil técnico completo (Onboarding)

A ETAPA 3 transforma a conta básica em **perfil técnico completo** para matching e colaboração. O perfil passa a reunir: dados básicos, tecnologias com nível por tecnologia, funções de interesse com `nivel_interesse`, disponibilidade semanal e objetivo profissional. Quando os campos essenciais estão preenchidos, o backend marca `usuarios.perfil_completo = 1` — o critério de aceite é que o perfil consiga alimentar filtros e matching **sem depender do GitHub**.

**Novidades no banco** (migração aditiva e idempotente `scripts/migrar_evolucao_etapa3.js` + sync em `Tabelas.sql`/`Insert.sql`):

| Objeto | Detalhe |
|---|---|
| Tabela **`funcoes`** | Catálogo fixo de funções: `id INT AUTO_INCREMENT PK`, `nome VARCHAR(100) NOT NULL UNIQUE`. Seed padrão (INSERT IGNORE) com 9 funções: **Backend, Frontend, Full Stack, Mobile, QA, DevOps, UX/UI, Data, Product**. |
| Tabela **`funcoes_usuario`** | Vínculo usuário ↔ função de interesse: `usuario_id`, `funcao_id`, `nivel_interesse ENUM('baixo','medio','alto') DEFAULT 'medio'`, PK composta `(usuario_id, funcao_id)`, FKs `ON DELETE CASCADE` (usuários e funcoes). |
| Coluna `usuarios.disponibilidade_horas_semana` | `INT NULL` — disponibilidade semanal em horas. |
| Coluna `usuarios.objetivo_profissional` | `VARCHAR(255) NULL` — objetivo atual do usuário. |
| Coluna `usuarios.perfil_completo` | `BOOLEAN DEFAULT FALSE` — recalculada pelo backend; vira `1` quando o perfil técnico está completo. |
| Nível por tecnologia | **Reutiliza** a coluna `habilidades_usuario.nivel ENUM('iniciante','intermediario','avancado')` (tabela já existente) — **não** há tabela nova de nível. |

#### `GET /funcoes` (Requer Token)
Lista as funções disponíveis na plataforma (catálogo da tabela `funcoes`).
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Funções carregadas com sucesso",
    "nItens": 9,
    "dados": [
      { "id": 1, "nome": "Backend" },
      { "id": 2, "nome": "Frontend" },
      { "id": 3, "nome": "Full Stack" },
      { "id": 4, "nome": "Mobile" },
      { "id": 5, "nome": "QA" },
      { "id": 6, "nome": "DevOps" },
      { "id": 7, "nome": "UX/UI" },
      { "id": 8, "nome": "Data" },
      { "id": 9, "nome": "Product" }
    ]
  }
  ```

#### `GET /usuarios/me/perfil` (Requer Token)
Retorna o perfil técnico completo do usuário autenticado: dados básicos + habilidades com nível por tecnologia + funções de interesse com `nivel_interesse` + disponibilidade semanal + objetivo profissional + flag `perfil_completo`.
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Perfil carregado com sucesso",
    "dados": {
      "id": 1,
      "nome": "João Silva",
      "email": "user@example.com",
      "bio": "Desenvolvedor Backend Node.js",
      "localizacao": "Belo Horizonte, MG",
      "disponibilidade_horas_semana": 20,
      "objetivo_profissional": "Quero atuar em projetos Node.js e aprender arquitetura de microsserviços",
      "perfil_completo": true,
      "habilidades": [
        { "habilidade_id": 1, "nome": "Node.js", "nivel": "avancado" },
        { "habilidade_id": 4, "nome": "Docker", "nivel": "iniciante" }
      ],
      "funcoes": [
        { "funcao_id": 1, "nome": "Backend", "nivel_interesse": "alto" },
        { "funcao_id": 3, "nome": "Full Stack", "nivel_interesse": "medio" }
      ]
    }
  }
  ```

#### `PATCH /usuarios/me/perfil` (Requer Token)
Atualiza os campos editáveis do perfil técnico do usuário autenticado: `nome`, `bio`, `localizacao`, `disponibilidade_horas_semana` e `objetivo_profissional`. O backend **recalcula** `perfil_completo` automaticamente com base no preenchimento dos campos essenciais.
- **Request Body:**
  ```json
  {
    "nome": "João Silva",
    "bio": "Desenvolvedor Backend Pleno focado em Node.js",
    "localizacao": "Belo Horizonte, MG",
    "disponibilidade_horas_semana": 20,
    "objetivo_profissional": "Quero atuar em projetos Node.js e aprender arquitetura de microsserviços"
  }
  ```
- **Response (200 OK):** `dados` com os campos atualizados + `perfil_completo` recalculado.

#### `PUT /usuarios/me/funcoes` (Requer Token)
Grava/atualiza as funções de interesse do usuário autenticado na tabela `funcoes_usuario` (upsert — INSERT ... ON DUPLICATE KEY UPDATE). Cada item informa o `funcao_id` (vindo do `GET /funcoes`) e o `nivel_interesse` (`baixo` | `medio` | `alto`).
- **Request Body:**
  ```json
  {
    "funcoes": [
      { "funcao_id": 1, "nivel_interesse": "alto" },
      { "funcao_id": 3, "nivel_interesse": "medio" }
    ]
  }
  ```
- **Response (200 OK):** `{ "sucesso": true, "message": "Funções de interesse atualizadas", "dados": null }`.

#### `PUT /usuarios/me/habilidades` (Requer Token)
Grava/atualiza as tecnologias do usuário autenticado na tabela `habilidades_usuario` (upsert — INSERT ... ON DUPLICATE KEY UPDATE; complementa o `POST /habilidades-usuario` individual com a versão em lote usada no onboarding). Cada item informa o `habilidade_id` (vindo do `GET /habilidades`) e o `nivel` por tecnologia: `iniciante` | `intermediario` | `avancado`.
- **Request Body:**
  ```json
  {
    "habilidades": [
      { "habilidade_id": 1, "nivel": "avancado" },
      { "habilidade_id": 4, "nivel": "iniciante" }
    ]
  }
  ```
- **Response (200 OK):** `{ "sucesso": true, "message": "Habilidades atualizadas", "dados": null }`.

> **Nota:** o nível por tecnologia fica em `habilidades_usuario.nivel` (coluna ENUM `iniciante`/`intermediario`/`avancado` da tabela já existente) — não há tabela nova de nível. O GitHub pode sugerir tecnologias futuramente, mas **nunca** define o nível automaticamente.

---

### 21. Evolução ETAPA 4 — Vagas por função no projeto

A ETAPA 4 troca a ideia limitada de "quantidade de pessoas" por **vagas estruturadas por função** (tabela nova `vagas_projeto`). O projeto pode continuar com `limite_membros`, mas agora comunica claramente quais perfis ainda procura (ex.: `2 Backend`, `1 Frontend`, `1 QA`, `1 UX/UI`). Cada vaga referencia uma função do catálogo `funcoes` (ETAPA 3) e possui quantidade, nível desejado e status próprios.

**Novidades no banco** (migração aditiva e idempotente `scripts/migrar_evolucao_etapa4.js` + sync em `Tabelas.sql`/`Insert.sql`):

| Aspecto | Detalhe |
|---|---|
| Tabela **`vagas_projeto`** | `id INT AUTO_INCREMENT PRIMARY KEY`, `projeto_id INT NOT NULL`, `funcao_id INT NOT NULL`, `quantidade INT NOT NULL DEFAULT 1`, `preenchidas INT NOT NULL DEFAULT 0`, `descricao TEXT NULL`, `nivel_desejado ENUM('iniciante','intermediario','avancado','qualquer') DEFAULT 'qualquer'`, `status ENUM('aberta','fechada') DEFAULT 'aberta'`, `criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP`. |
| FK `projeto_id` | → `projetos(id)` `ON DELETE CASCADE` (vagas somem junto com o projeto). |
| FK `funcao_id` | → `funcoes(id)` `ON DELETE RESTRICT` (função do catálogo não pode ser removida enquanto houver vaga referenciando). |

**Regras de negócio:**
- `quantidade > 0` (validado no POST e no PATCH);
- `preenchidas <= quantidade` — o backend nunca permite ultrapassar (nem ao reduzir a quantidade);
- `preenchidas` é incrementada automaticamente ao aceitar uma candidatura vinculada à vaga;
- vaga pode ser reaberta (`status` volta para `aberta`) quando um membro sai, quando aplicável;
- **Somente o owner altera vagas** (POST/PATCH/DELETE); a leitura (GET) é liberada para membros e dono.

#### `GET /projetos/:projetoId/vagas` (Membro/dono)
Lista as vagas do projeto com o nome da função (JOIN `funcoes`).
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Vagas carregadas com sucesso",
    "nItens": 2,
    "dados": [
      {
        "id": 1,
        "projeto_id": 10,
        "funcao_id": 1,
        "funcao_nome": "Backend",
        "quantidade": 2,
        "preenchidas": 1,
        "descricao": "Desenvolvedor Node.js para APIs REST",
        "nivel_desejado": "intermediario",
        "status": "aberta",
        "criado_em": "2026-08-08T12:00:00.000Z"
      }
    ]
  }
  ```
- **Erros:** 403 (usuário não é membro/dono do projeto), 404 (projeto inexistente).

#### `POST /projetos/:projetoId/vagas` (Somente owner)
Cria uma nova vaga no projeto.
- **Request Body:**
  ```json
  {
    "funcao_id": 1,
    "quantidade": 2,
    "descricao": "Desenvolvedor Node.js para APIs REST",
    "nivel_desejado": "intermediario"
  }
  ```
- **Response (200 OK):** `dados` com a vaga criada (mesma estrutura do GET, incluindo `funcao_nome`).
- **Erros:** 400 (`funcao_id` inexistente, `quantidade <= 0` ou `nivel_desejado` fora do ENUM), 403 (não é owner), 404 (projeto inexistente).

#### `PATCH /projetos/:projetoId/vagas/:vagaId` (Somente owner)
Atualiza os campos editáveis da vaga: `funcao_id`, `quantidade`, `descricao`, `nivel_desejado` e `status`. Ao reduzir a quantidade, o backend valida que ela não fique abaixo de `preenchidas`.
- **Request Body:**
  ```json
  {
    "quantidade": 3,
    "nivel_desejado": "avancado",
    "status": "fechada"
  }
  ```
- **Response (200 OK):** `dados` com a vaga atualizada.
- **Erros:** 400 (validação, ex.: `quantidade < preenchidas`), 403 (não é owner), 404 (vaga inexistente no projeto).

#### `DELETE /projetos/:projetoId/vagas/:vagaId` (Somente owner)
Remove uma vaga do projeto.
- **Response (200 OK):** `{ "sucesso": true, "message": "Vaga removida com sucesso", "dados": null }`.
- **Erros:** 403 (não é owner), 404 (vaga inexistente no projeto), **409** (vaga com `preenchidas > 0` — já possui membros alocados e não pode ser removida).

#### `GET /projetos/:id` (Requer Token) — novo campo `vagas`
O detalhamento do projeto (seção 3) passa a incluir o array **`vagas`** em `dados`, com a mesma estrutura do `GET /projetos/:projetoId/vagas` (incluindo `funcao_nome`):
```json
{
  "sucesso": true,
  "message": "Detalhes do projeto carregados com sucesso",
  "dados": {
    "id": "10",
    "name": "MonteSquad Web",
    "description": "Plataforma para...",
    "status": "Aberto",
    "membersLimit": 6,
    "members": [],
    "tasks": [],
    "messages": [],
    "applications": [],
    "vagas": [
      {
        "id": 1,
        "funcao_id": 1,
        "funcao_nome": "Backend",
        "quantidade": 2,
        "preenchidas": 1,
        "nivel_desejado": "intermediario",
        "status": "aberta"
      }
    ]
  }
}
```
Vagas com `status = 'fechada'` ou já totalmente preenchidas (`preenchidas >= quantidade`) também aparecem no array — o frontend decide como exibi-las.

---

### 22. Evolução ETAPA 5 — Candidatura direcionada por vaga/função

A ETAPA 5 conecta as candidaturas (seção 5) às vagas por função criadas na ETAPA 4 (seção 21). A candidatura deixa de ser genérica e passa a ser **direcionada**: o candidato informa a `vaga_id` da função à qual deseja se candidatar. Ao aprovar uma candidatura vinculada a vaga, o backend incrementa `preenchidas` da vaga e a fecha automaticamente quando ela lota.

**Novidades no banco** (migração aditiva e idempotente `scripts/migrar_evolucao_etapa5.js` + sync em `Tabelas.sql`/`Insert.sql`):

| Aspecto | Detalhe |
|---|---|
| Coluna **`candidaturas.vaga_id`** | `INT NULL` — vaga pretendida. `NULL` = candidatura genérica (sem vaga), comportamento anterior mantido. |
| FK `vaga_id` | → `vagas_projeto(id)` `ON DELETE SET NULL` — se a vaga for removida, a candidatura permanece e `vaga_id` volta a `NULL`. |

**Regras de negócio:**
- `vaga_id` é **opcional** no POST — candidatura sem vaga continua aceita;
- quando `vaga_id` é informada, a vaga **deve pertencer ao projeto** e estar **aberta** (`status = 'aberta'` e `preenchidas < quantidade`) — caso contrário, **400**;
- **candidatura duplicada** (mesmo usuário + mesma vaga no mesmo projeto) → **409**;
- usuário não pode se candidatar ao **próprio projeto** → **400**;
- usuário **já membro** do projeto não pode se candidatar novamente → **400**;
- ao **aprovar** uma candidatura com `vaga_id`, o backend incrementa `vagas_projeto.preenchidas`; se `preenchidas >= quantidade`, a vaga é fechada (`status = 'fechada'`) automaticamente;
- as validações existentes permanecem: limite de membros do projeto (`limite_membros`) verificado no aceite.

#### `POST /projetos/:projetoId/candidaturas` (Requer Token)
Candidata-se ao projeto, opcionalmente direcionado a uma vaga/função específica.
- **Request Body:**
  ```json
  {
    "vaga_id": 12,
    "mensagem": "Quero contribuir no backend"
  }
  ```
  (`vaga_id` é opcional — omita para candidatura genérica.)
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Candidatura enviada com sucesso",
    "dados": {
      "id": 45,
      "usuario_id": 3,
      "projeto_id": 10,
      "vaga_id": 12,
      "status": "pendente",
      "mensagem": "Quero contribuir no backend"
    }
  }
  ```
- **Erros:** 400 (`vaga_id` não pertence ao projeto ou vaga fechada/lotada; candidatura ao próprio projeto; usuário já membro), 404 (projeto inexistente), **409** (candidatura duplicada para a mesma vaga).

#### `GET /projetos/:projetoId/candidaturas` (Somente dono)
Lista as candidaturas pendentes do projeto. A resposta **agora inclui `vaga_id` e `funcao_nome`** (LEFT JOIN `vagas_projeto` → `funcoes`); candidaturas sem vaga retornam `vaga_id: null` e `funcao_nome: null`.
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Candidaturas pendentes",
    "nItens": 1,
    "dados": [
      {
        "id": 45,
        "usuario_id": 3,
        "usuario_nome": "João Silva",
        "usuario_bio": "Desenvolvedor Backend Node.js",
        "vaga_id": 12,
        "funcao_nome": "Backend",
        "status": "pendente",
        "mensagem": "Quero contribuir no backend",
        "criado_em": "2026-08-08T12:00:00.000Z"
      }
    ]
  }
  ```
- **Erros:** 403 (não é dono do projeto), 404 (projeto inexistente).

#### `PATCH /projetos/:projetoId/candidaturas/:candidaturaId` (Somente dono)
Aprova ou rejeita uma candidatura (`status`: `aceito` | `rejeitado`). Ao **aprovar** uma candidatura com `vaga_id`:
- incrementa `vagas_projeto.preenchidas`;
- se `preenchidas >= quantidade`, muda a vaga para `status = 'fechada'` automaticamente;
- insere o candidato em `membros_equipe` (as validações existentes de limite de membros continuam valendo).
- **Request Body:**
  ```json
  {
    "status": "aceito"
  }
  ```
- **Response (200 OK):** `{ "sucesso": true, "message": "Candidatura aprovada com sucesso", "dados": { "id": 45, "status": "aceito" } }` (ou `"Candidatura recusada com sucesso"` / `"rejeitado"` para rejeição).
- **Erros:** 400 (status inválido, candidatura já processada, limite de membros atingido), 403 (não é dono do projeto), 404 (candidatura inexistente no projeto).

---

### 23. Evolução ETAPA 6 — Função do membro dentro do projeto (soft-delete e saída)

A ETAPA 6 registra o **papel real de cada membro** do squad. `membros_equipe` passa a guardar a vaga ocupada (`vaga_id`), a função real (`funcao_id` — vinda preferencialmente da vaga) e um **status de ciclo de vida** (`ativo` | `saiu` | `removido`) com `saiu_em`, preservando o histórico: ninguém é apagado fisicamente do projeto ao sair ou ser removido (**soft-delete**). A aprovação de candidatura (seção 22) agora cria o membro já vinculado à vaga/função da candidatura, e o endpoint de remoção de membro deixa de apagar o registro.

**Novidades no banco** (migração aditiva e idempotente `scripts/migrar_evolucao_etapa6.js` + sync em `Tabelas.sql`/`Insert.sql`):

| Aspecto | Detalhe |
|---|---|
| Coluna **`membros_equipe.vaga_id`** | `INT NULL` — vaga ocupada pelo membro. `NULL` = sem vaga vinculada (ex.: owner). |
| FK `vaga_id` | → `vagas_projeto(id)` `ON DELETE SET NULL` — se a vaga for removida, o membro permanece e `vaga_id` volta a `NULL`. |
| Coluna **`membros_equipe.funcao_id`** | `INT NULL` — função real do membro no projeto, vinda preferencialmente da vaga no aceite da candidatura. |
| FK `funcao_id` | → `funcoes(id)` `ON DELETE SET NULL`. |
| Coluna **`membros_equipe.status`** | `ENUM('ativo','saiu','removido') DEFAULT 'ativo'` — soft-state: `ativo` (atualmente no squad), `saiu` (saiu voluntariamente via `POST /sair`), `removido` (removido pelo dono). |
| Coluna **`membros_equipe.saiu_em`** | `DATETIME NULL` — data/hora em que o membro saiu ou foi removido. `NULL` enquanto `status = 'ativo'`. |

**Regras de negócio:**
- **soft-delete:** sair ou ser removido **nunca apaga** o registro de `membros_equipe` — apenas atualiza `status` e `saiu_em`, preservando o histórico do membro no projeto;
- apenas membros com `status = 'ativo'` aparecem na listagem, contam para `preenchidas` das vagas e para o `limite_membros`;
- ao sair/remover um membro com `vaga_id` preenchida, o backend **decrementa** `vagas_projeto.preenchidas` e **reabre** a vaga (`status = 'aberta'`) se ela estava fechada por lotação;
- **owner não sai nem é removido:** `POST /projetos/:projetoId/sair` como owner → **400**; `DELETE /projetos/:projetoId/membros/:usuarioId` do owner → **400**;
- aprovação de candidatura cria/atualiza o membro com `vaga_id` e `funcao_id` da vaga; candidatura sem vaga → `vaga_id`/`funcao_id` `NULL`;
- o owner continua com papel Owner, sem `vaga_id`/`funcao_id` vinculados.

#### `GET /projetos/:projetoId/membros` (Membro/dono)
Lista os **membros ativos** do projeto (`status = 'ativo'`), com a função real (JOIN `funcoes`) e a vaga ocupada (JOIN `vagas_projeto`). Membros que saíram (`saiu`) ou foram removidos (`removido`) **não aparecem** na listagem — o histórico permanece apenas no banco.
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Membros carregados com sucesso",
    "nItens": 2,
    "dados": [
      {
        "id": 1,
        "usuario_id": 1,
        "usuario_nome": "João Silva",
        "role": "Owner",
        "vaga_id": null,
        "funcao_id": null,
        "funcao_nome": null,
        "status": "ativo",
        "saiu_em": null
      },
      {
        "id": 7,
        "usuario_id": 3,
        "usuario_nome": "Maria Souza",
        "role": "membro",
        "vaga_id": 12,
        "funcao_id": 1,
        "funcao_nome": "Backend",
        "status": "ativo",
        "saiu_em": null
      }
    ]
  }
  ```
- **Erros:** 403 (usuário não é membro/dono do projeto), 404 (projeto inexistente).

#### `DELETE /projetos/:projetoId/membros/:usuarioId` (Somente dono)
Remove um membro do projeto — agora **soft-delete**: o registro é atualizado para `status = 'removido'` e `saiu_em = NOW()` (nada é apagado do banco). Se o membro ocupava uma vaga (`vaga_id` preenchida), a vaga é **liberada**: `preenchidas` é decrementada e, se estava fechada por lotação, volta para `status = 'aberta'`.
- **Response (200 OK):** `{ "sucesso": true, "message": "Membro removido do projeto", "dados": null }`.
- **Erros:** 400 (tentativa de remover o **owner**; usuário não é membro ativo), 403 (não é dono do projeto), 404 (projeto ou membro inexistente).

#### `POST /projetos/:projetoId/sair` (Membro)
O membro autenticado **sai voluntariamente** do projeto: `status = 'saiu'` e `saiu_em = NOW()`. Assim como na remoção, a vaga ocupada é liberada (decremento de `preenchidas` + reabertura se necessário). Sem Request Body.
- **Response (200 OK):** `{ "sucesso": true, "message": "Você saiu do projeto", "dados": null }`.
- **Erros:** **400** (o **owner não pode sair** — deve transferir o projeto ou encerrá-lo), 403 (usuário não é membro do projeto), 404 (projeto inexistente).

#### `PATCH /projetos/:projetoId/candidaturas/:candidaturaId` (Somente dono) — aprovação cria membro com função da vaga
Ao **aprovar** uma candidatura (seção 22), o backend agora **insere o membro em `membros_equipe` já vinculado à vaga/função**:
- `vaga_id` = `candidaturas.vaga_id` (vaga pretendida);
- `funcao_id` = `vagas_projeto.funcao_id` (função da vaga — "a função vem preferencialmente da vaga");
- `status = 'ativo'` e `saiu_em = NULL`;
- candidatura **sem** vaga (`vaga_id` nulo): membro criado com `vaga_id = NULL` e `funcao_id = NULL` (comportamento anterior, sem vínculo);
- as demais regras do aceite permanecem: incremento de `preenchidas`, fechamento automático da vaga quando lota e validação do `limite_membros`.

**Estrutura do registro criado em `membros_equipe`:**

| Campo | Origem |
|---|---|
| `projeto_id` | projeto da candidatura |
| `usuario_id` | candidato aprovado |
| `vaga_id` | `candidaturas.vaga_id` |
| `funcao_id` | `vagas_projeto.funcao_id` (função da vaga) |
| `status` | `'ativo'` |
| `saiu_em` | `NULL` |

---

### 24. Evolução ETAPA 7 — Tasks com habilidades e dificuldade

A ETAPA 7 permite que cada tarefa indique o **conhecimento esperado** (habilidades) e a **dificuldade**, preparando o terreno para filtros e recomendações futuras por habilidade e dificuldade. A criação e a edição de tarefas passam a aceitar `dificuldade` e uma lista de `habilidades` (ids), e a listagem passa a devolver a dificuldade e as habilidades com nome. A relação N:N entre tarefas e habilidades fica na nova tabela **`habilidades_tarefa`**.

**Novidades no banco** (migração aditiva e idempotente `scripts/migrar_evolucao_etapa7.js` + sync em `Tabelas.sql`/`Insert.sql`):

| Aspecto | Detalhe |
|---|---|
| Tabela **`habilidades_tarefa`** | Relação N:N entre tarefas e habilidades — `tarefa_id` + `habilidade_id` em **PK composta**. |
| FK `tarefa_id` | → `tarefas(id)` `ON DELETE CASCADE` — remover a tarefa apaga os vínculos de habilidade. |
| FK `habilidade_id` | → `habilidades(id)` `ON DELETE CASCADE` — remover a habilidade apaga os vínculos das tarefas. |
| Coluna **`tarefas.dificuldade`** | `ENUM('iniciante','intermediaria','avancada') DEFAULT 'intermediaria'` — dificuldade esperada da tarefa. |

**Regras de negócio:**
- `dificuldade` é **opcional** — quando omitida, assume `'intermediaria'` (DEFAULT);
- `habilidades` é **opcional** — quando omitida ou `[]`, a tarefa fica sem vínculos de habilidade;
- na **edição** (`PATCH`), a lista de `habilidades` enviada **substitui** a lista anterior (os vínculos antigos de `habilidades_tarefa` são removidos e os novos inseridos);
- ao listar, cada tarefa traz `dificuldade` e `habilidades` com `id` + `nome` (JOIN `habilidades_tarefa` → `habilidades`); tarefa sem habilidade retorna `habilidades: []`;
- o mesmo enriquecimento vale para as tarefas exibidas em `dados.tasks` do `GET /projetos/:id` (seção 3).

#### `POST /projetos/:projetoId/tarefas` (Membro/dono) — aceita dificuldade e habilidades
Cria a tarefa. Além dos campos existentes (seção 6), o body agora aceita `dificuldade` e `habilidades`.
- **Request Body:**
  ```json
  {
    "titulo": "Criar API de Login",
    "descricao": "Implementar autenticação JWT",
    "prioridade": "high",
    "responsavel_id": 2,
    "dificuldade": "intermediaria",
    "habilidades": [1, 7, 9]
  }
  ```
- **Response (201 OK):** `dados` com a tarefa criada, incluindo `dificuldade` e `habilidades` (array com `id` e `nome`):
  ```json
  {
    "sucesso": true,
    "message": "Tarefa criada com sucesso",
    "dados": {
      "id": 51,
      "projeto_id": 10,
      "titulo": "Criar API de Login",
      "status": "todo",
      "prioridade": "high",
      "responsavel_id": 2,
      "dificuldade": "intermediaria",
      "habilidades": [
        { "id": 1, "nome": "Node.js" },
        { "id": 7, "nome": "Express" },
        { "id": 9, "nome": "JWT" }
      ]
    }
  }
  ```
- **Erros:** 400 (validação, ex.: `dificuldade` fora do ENUM, `habilidade_id` inexistente), 403 (não é membro/dono), 404 (projeto inexistente).

#### `PATCH /projetos/:projetoId/tarefas/:tarefaId` (Membro/dono) — atualiza dificuldade e substitui habilidades
Edita a tarefa. Quando `dificuldade` é enviada, atualiza a coluna; quando `habilidades` é enviada, a lista **substitui** os vínculos existentes em `habilidades_tarefa`. Campos omitidos permanecem inalterados.
- **Request Body:**
  ```json
  {
    "titulo": "Criar API de Login com refresh token",
    "dificuldade": "avancada",
    "habilidades": [1, 9]
  }
  ```
- **Response (200 OK):** `dados` com a tarefa atualizada (mesma estrutura do POST, com `dificuldade` e `habilidades`).
- **Erros:** 400 (validação, ex.: `dificuldade` fora do ENUM, `habilidade_id` inexistente), 403 (não é membro/dono), 404 (tarefa inexistente no projeto).

#### `GET /projetos/:projetoId/tarefas` (Membro/dono) — resposta inclui dificuldade e habilidades
Lista as tarefas do projeto. Cada item da resposta agora inclui `dificuldade` e `habilidades` (nomes).
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Tarefas carregadas com sucesso",
    "nItens": 1,
    "dados": [
      {
        "id": 51,
        "projeto_id": 10,
        "titulo": "Criar API de Login",
        "status": "doing",
        "prioridade": "high",
        "responsavel_id": 2,
        "dificuldade": "intermediaria",
        "habilidades": [
          { "id": 1, "nome": "Node.js" },
          { "id": 7, "nome": "Express" },
          { "id": 9, "nome": "JWT" }
        ]
      }
    ]
  }
  ```
- **Erros:** 403 (não é membro/dono), 404 (projeto inexistente).

---

### 25. Evolução ETAPA 9 — Abandonar, remover responsável e reatribuir task

A ETAPA 9 permite **trocar o responsável de uma tarefa sem perder evidência de contribuição anterior**. O responsável atual pode **abandonar** a tarefa, o owner pode **remover o responsável** ou **reatribuir** a tarefa a outro membro ativo — e toda troca fica registrada na nova tabela **`historico_responsaveis_tarefa`**. Commits já registrados, a timeline e o histórico permanecem intactos.

**Novidades no banco** (migração aditiva e idempotente `scripts/migrar_evolucao_etapa9.js` + sync em `Tabelas.sql`/`Insert.sql`):

| Aspecto | Detalhe |
|---|---|
| Tabela **`historico_responsaveis_tarefa`** | Histórico de responsáveis de cada tarefa — `id BIGINT AUTO_INCREMENT PRIMARY KEY`, `tarefa_id INT NOT NULL`, `usuario_id INT NOT NULL` (responsável da ação), `acao ENUM('assumiu','abandonou','removido','reatribuido','concluiu') NOT NULL`, `realizado_por INT NULL` (quem executou a ação), `criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP`. |
| FK `tarefa_id` | → `tarefas(id)` `ON DELETE CASCADE` — remover a tarefa apaga o histórico de responsáveis. |
| FK `usuario_id` | → `usuarios(id)` `ON DELETE CASCADE` — remover o usuário apaga seus registros de histórico. |
| FK `realizado_por` | → `usuarios(id)` `ON DELETE SET NULL` — remover o usuário que executou a ação preserva o registro (`realizado_por` volta a `NULL`). |

**Significado do ENUM `acao`:**

| Valor | Quando é registrado |
|---|---|
| `assumiu` | membro assume a tarefa (endpoint `POST /assumir` da seção 15). |
| `abandonou` | responsável atual abandona a tarefa (`POST /abandonar`). |
| `removido` | owner remove o responsável da tarefa (`POST /remover-responsavel`). |
| `reatribuido` | owner reatribui a tarefa a outro membro (`POST /reatribuir`). |
| `concluiu` | tarefa concluída. |

**Regras de negócio:**
- **abandonar** (`POST /abandonar`): apenas o **responsável atual** pode abandonar a tarefa — outro usuário recebe **403**; `responsavel_id` volta a `NULL` e o status retorna para `todo` (ou regra definida); commits já registrados e o histórico permanecem;
- **remover responsável** (`POST /remover-responsavel`): somente o **owner**; `responsavel_id` volta a `NULL` e o registro grava quem removeu (`realizado_por` = owner, `acao = 'removido'`);
- **reatribuir** (`POST /reatribuir`): somente o **owner**; o novo responsável deve ser **membro ativo** do projeto (`membros_equipe.status = 'ativo'`);
- **nenhuma troca de responsável apaga evidência de contribuição anterior** (critério de aceite da ETAPA 9) — commits, timeline e histórico de responsáveis permanecem.

#### `POST /projetos/:projetoId/tarefas/:tarefaId/abandonar` (Responsável atual)
O responsável atual abandona a tarefa: `responsavel_id` volta a `NULL`, o status volta para `todo` e o evento é registrado com `acao = 'abandonou'` em `historico_responsaveis_tarefa`. Sem Request Body.
- **Response (200 OK):** `{ "sucesso": true, "message": "Tarefa abandonada", "dados": { "id": 51, "status": "todo", "responsavel_id": null } }`.
- **Erros:** 400 (tarefa sem responsável), **403** (usuário autenticado não é o responsável atual), 404 (tarefa inexistente no projeto).

#### `POST /projetos/:projetoId/tarefas/:tarefaId/remover-responsavel` (Somente owner)
O owner remove o responsável da tarefa: `responsavel_id` volta a `NULL` e o evento é registrado com `acao = 'removido'` e `realizado_por` = id do owner. Sem Request Body.
- **Response (200 OK):** `{ "sucesso": true, "message": "Responsável removido da tarefa", "dados": { "id": 51, "status": "todo", "responsavel_id": null } }`.
- **Erros:** 400 (tarefa sem responsável), 403 (não é dono do projeto), 404 (tarefa inexistente no projeto).

#### `POST /projetos/:projetoId/tarefas/:tarefaId/reatribuir` (Somente owner)
O owner reatribui a tarefa a outro responsável. O evento é registrado com `acao = 'reatribuido'` e `realizado_por` = id do owner.
- **Request Body:**
  ```json
  {
    "usuario_id": 3
  }
  ```
- **Response (200 OK):** `dados` com a tarefa atualizada, incluindo o novo `responsavel_id`.
- **Erros:** 400 (`usuario_id` ausente ou **não é membro ativo** do projeto), 403 (não é dono do projeto), 404 (tarefa inexistente no projeto).

#### `GET /projetos/:projetoId/tarefas/:tarefaId/historico-responsaveis` (Membro/dono)
Lista o histórico de responsáveis da tarefa (mais recentes primeiro), com **nomes via JOIN** (`usuarios` para o responsável da ação e para quem a executou).
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Histórico de responsáveis carregado",
    "nItens": 3,
    "dados": [
      {
        "id": 12,
        "tarefa_id": 51,
        "usuario_id": 3,
        "usuario_nome": "Maria Souza",
        "acao": "reatribuido",
        "realizado_por": 1,
        "realizado_por_nome": "João Silva",
        "criado_em": "2026-08-08T12:00:00.000Z"
      }
    ]
  }
  ```
- **Erros:** 403 (usuário não é membro/dono do projeto), 404 (tarefa inexistente no projeto).

---

### 26. Evolução ETAPA 10 — Soft-delete de tarefas e histórico de participação permanente

A ETAPA 10 garante que **nenhuma contribuição histórica legítima seja apagada**: excluir uma tarefa deixa de ser um `DELETE` físico e vira **soft-delete** (coluna `excluida_em`), preservando commits, timeline, histórico de responsáveis e vínculos de habilidade; e a participação em um projeto — inclusive de quem **saiu** ou foi **removido** — permanece no histórico do perfil. Sair do squad ou excluir uma tarefa não elimina portfólio nem métricas passadas.

**Novidades no banco** (migração aditiva e idempotente `scripts/migrar_evolucao_etapa10.js` + sync em `Tabelas.sql`/`Insert.sql`):

| Aspecto | Detalhe |
|---|---|
| Coluna **`tarefas.excluida_em`** | `DATETIME NULL` — data/hora do soft-delete da tarefa. `NULL` = tarefa ativa (não excluída). Marcada com `NOW()` ao excluir. |

**Regras de negócio:**
- **soft-delete de tarefas:** excluir uma tarefa **nunca apaga o registro** — apenas atualiza `excluida_em = NOW()`. Commits vinculados, timeline, `historico_responsaveis_tarefa` (ETAPA 9) e `habilidades_tarefa` (ETAPA 7) permanecem intactos como evidência;
- tarefas com `excluida_em` preenchido **não aparecem** na listagem (`GET /projetos/:projetoId/tarefas` filtra `excluida_em IS NULL`), não contam para o Kanban/quadro nem para contagens de tarefas;
- **histórico de participação permanente:** membros com `status = 'saiu'` ou `'removido'` (ETAPA 6) continuam registrados em `membros_equipe` e seguem aparecendo no **histórico de participação do perfil** do usuário — sair ou ser removido **não elimina** o projeto do portfólio nem as métricas históricas legítimas (tasks verificadas, commits, reputação);
- a listagem de membros ativos (`GET /projetos/:projetoId/membros`, seção 23) continua retornando apenas `status = 'ativo'`; o histórico completo fica disponível no perfil.

#### `DELETE /projetos/:projetoId/tarefas/:tarefaId` (Membro/dono) — agora soft-delete
Exclui a tarefa de forma **lógica**: em vez de `DELETE FROM tarefas`, o backend executa `UPDATE tarefas SET excluida_em = NOW() WHERE id = ? AND projeto_id = ? AND excluida_em IS NULL`. A tarefa some da listagem e do Kanban, mas o registro e toda a evidência associada (commits, timeline, histórico de responsáveis, habilidades) permanecem no banco. Sem Request Body.
- **Response (200 OK):** `{ "sucesso": true, "message": "Tarefa excluída com sucesso", "dados": null }`.
- **Erros:** 403 (não é membro/dono do projeto), 404 (tarefa inexistente no projeto ou já excluída — `excluida_em` preenchido).

#### `GET /projetos/:projetoId/tarefas` (Membro/dono) — filtra tarefas excluídas
A listagem agora retorna **apenas tarefas ativas**, aplicando o filtro `excluida_em IS NULL` na consulta. Tarefas soft-deletadas não aparecem no resultado, no `nItens` nem no Kanban. A estrutura da resposta permanece a da seção 25 (com `dificuldade` e `habilidades`).
- **Erros:** 403 (não é membro/dono do projeto), 404 (projeto inexistente).

#### Histórico de participação permanente — membros `saiu`/`removido` continuam no perfil
O perfil do usuário continua exibindo o projeto no histórico mesmo depois de **sair** (`POST /projetos/:projetoId/sair`) ou ser **removido** (`DELETE /projetos/:projetoId/membros/:usuarioId`) — as contribuições passadas não são apagadas. O registro de `membros_equipe` permanece com `status = 'saiu'`/`'removido'` e `saiu_em` preenchido (ETAPA 6), e as métricas históricas legítimas (tasks verificadas, commits, reputação) continuam vinculadas ao usuário/projeto. Remover/sair do squad **não elimina portfólio nem métricas históricas** (critério de aceite da ETAPA 10).
---

### 27. Evolução ETAPA 11 — Portfólio verificável

A ETAPA 11 transforma **entregas GitHub em evidência profissional verificável no perfil público**: o novo endpoint **público** `GET /usuarios/:id/portfolio` agrega, por projeto, a participação e as contribuições reais do usuário — **função exercida**, **tasks verificadas por merge**, **commits**, **PRs mergeados** e **tecnologias** — sem exigir login. O perfil público consegue mostrar evidências sem vazar dados privados (critério de aceite da ETAPA 11). A etapa **não altera o banco de dados**: é uma agregação somente-leitura sobre tabelas existentes (ETAPAS 1/2, 4, 6, 7 e 10), sem migração nova.

**Fontes de dados (agregação somente-leitura — sem migração):**

| Fonte | O que fornece | Critério |
|---|---|---|
| **`membros_equipe`** | **participação** do usuário (projetos + função) | JOIN `projetos`; entram **todos** os `status` (`ativo`/`saiu`/`removido`) — sair/remover do squad **não elimina o portfólio** (contrato ETAPA 10, seção 26). Função via `funcoes` — `COALESCE(membros_equipe.funcao_id, vagas_projeto.funcao_id)` — com fallback para `membros_equipe.funcao` (ETAPA 4, seção 21; ETAPA 6, seção 23). Projetos ordenados pela entrada mais recente (`entrou_em DESC`). |
| **`tarefas`** | `tasksVerificadas` | tasks do usuário (`responsavel_id = :id`) concluídas por merge GitHub (`concluida_via = 'github_merge'` — seção 15) e **não excluídas** (`excluida_em IS NULL` — soft-delete ETAPA 10, seção 26, não conta). |
| **`github_commits`** | `commits` | commits registrados pelo webhook (seções 12/18) cujo autor GitHub está vinculado à conta MontesSquad (`usuarios.github_user_id = github_commits.author_github_id`), agrupados por projeto. |
| **`github_pull_requests`** | `prsMergeados` | PRs com `estado = 'merged'` vinculados a tasks do usuário (JOIN `tarefas` por `tarefa_id` + `responsavel_id = :id`) — mesma semântica do Top Contributors (seção 17). |
| **`habilidades_projeto`** | `tecnologias[]` | nomes das habilidades do projeto (JOIN `habilidades`, seção 9), ordenados alfabeticamente (`ORDER BY h.nome`). |

**Regras de negócio:**
- o endpoint é **público** — não exige token: qualquer visitante do perfil público consulta o portfólio sem login;
- **404** apenas quando o usuário **não existe** (`SELECT id FROM usuarios` → `"Usuário não encontrado"`); usuário existente **sem participação** responde `200` com `projetos: []`;
- cada item de `projetos[]` traz `projetoId`, `projetoNome`, `funcao` (ou `null`), `tasksVerificadas`, `commits`, `prsMergeados`, `tecnologias` (array) e `contribuicoes` (array);
- `contribuicoes[]` é a **evidência por task do próprio usuário**: `tarefaId`, `titulo`, `prNumero`, `prUrl`, `commits` (contagem de commits da task) e `mergeadoEm`, da mais recente para a mais antiga (`concluida_em DESC`); sem task verificada → `contribuicoes: []`;
- toda métrica é agregada **somente para o usuário da rota** — o endpoint nunca expõe evidência de outros membros do projeto.

**Regra de privacidade (repositórios privados):**
- o portfólio é público, mas **não vaza detalhes técnicos de repositório privado**: para projetos cujo repositório é **privado**, os detalhes técnicos (títulos de tarefa/PR, número e URL do PR, mensagens de commit) ficam **ocultos** e a contribuição é exibida apenas como **"Contribuição verificada em projeto privado"**;
- permanecem visíveis somente **contagens agregadas** (`tasksVerificadas`, `commits`, `prsMergeados`), **tecnologias** e a evidência por task **do próprio usuário** — sem expor código, branches, mensagens ou URLs internas;
- critério de aceite da ETAPA 11: o **perfil público mostra evidências sem vazar dados privados**.

#### `GET /usuarios/:id/portfolio` (Público — sem token)
Portfólio público e verificável do usuário: agrega por projeto a participação (`membros_equipe`), tasks verificadas por merge GitHub, commits, PRs mergeados e tecnologias. Sem Request Body.
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Portfólio do usuário",
    "nItens": 1,
    "dados": {
      "projetos": [
        {
          "projetoId": 5,
          "projetoNome": "Sistema Financeiro",
          "funcao": "Backend",
          "tasksVerificadas": 4,
          "commits": 32,
          "prsMergeados": 4,
          "tecnologias": ["Node.js", "MySQL"],
          "contribuicoes": [
            {
              "tarefaId": 51,
              "titulo": "API de autenticação",
              "prNumero": 15,
              "prUrl": "https://github.com/organizacao/sistema-financeiro/pull/15",
              "commits": 8,
              "mergeadoEm": "2026-08-01T14:30:00.000Z"
            }
          ]
        }
      ]
    }
  }
  ```
- **Erros:** 404 (usuário inexistente — `"Usuário não encontrado"`).

---

### 28. Evolução ETAPA 12 — Reputação técnica separada do XP

A ETAPA 12 separa **gamificação de qualidade técnica**: o **XP** continua representando **atividade/engajamento** (concluir task, participar, colaborar, receber avaliação — acumulado em `estatisticas_usuario`/`eventos_xp`, seções 14/18), enquanto a **reputação técnica** passa a representar **evidência de entrega e confiança** (tasks verificadas por merge, PRs mergeados, commits válidos, projetos com entrega), gravada na nova tabela **`reputacao_tecnica_usuario`**. Subir XP **não altera automaticamente** a reputação técnica (critério de aceite da ETAPA 12): são métricas independentes.

**Novidades no banco** (migração aditiva e idempotente `scripts/migrar_evolucao_etapa12.js` + sync em `Tabelas.sql`/`Insert.sql`):

| Aspecto | Detalhe |
|---|---|
| Tabela **`reputacao_tecnica_usuario`** | 1 linha por usuário — `usuario_id INT PRIMARY KEY`, `score DECIMAL(10,2) DEFAULT 0` (reputação técnica atual), `tasks_verificadas INT DEFAULT 0`, `prs_mergeados INT DEFAULT 0`, `commits_validos INT DEFAULT 0`, `projetos_com_entrega INT DEFAULT 0` e `atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` (último recálculo). |
| FK `usuario_id` | → `usuarios(id)` `ON DELETE CASCADE` — remover o usuário apaga sua linha de reputação técnica. |

**XP vs Reputação técnica (conceito):**

| Aspecto | XP — engajamento | Reputação técnica — evidência de entrega |
|---|---|---|
| Onde vive | `estatisticas_usuario` + `eventos_xp` (seções 14/18) | `reputacao_tecnica_usuario` |
| O que mede | atividade/participação: concluir task, participar, colaborar, receber avaliação | entrega verificada: tasks verificadas por merge, PRs mergeados, commits válidos, projetos com entrega |
| Como é atualizado | eventos de XP (ex.: **+150 XP** por merge GitHub — seção 18) | recalculo do score no backend, a partir do banco |
| Independência | subir XP **não** altera reputação técnica (critério de aceite ETAPA 12) | — |

**Fórmula do score (pesos):** o score é calculado **somente no backend**, derivado de dados do banco — **nunca** confiando em valores vindos do frontend. O serviço `src/services/reputacaoTecnica.js` expõe `recalcularReputacao(usuarioId)`, que lê as evidências do usuário e grava (ou atualiza) a linha em `reputacao_tecnica_usuario`. O score é a soma ponderada das evidências:

```text
score = (commits_validos      × P_commit)
      + (prs_mergeados        × P_pr)
      + (tasks_verificadas    × P_task)
      + (projetos_com_entrega × P_projeto)
```

Pesos por evidência (escala de pontos por evidência documentada no PLANO — exemplo ETAPA 13; definidos como constantes em código):

| Fator | Peso | Semântica |
|---|---|---|
| `tasks_verificadas` | +50 | task concluída por merge GitHub (`concluida_via = 'github_merge'` — seção 15) |
| `prs_mergeados` | +30 | PR com `estado = 'merged'` vinculado a task do usuário (seções 12/17) |
| `commits_validos` | +1 | commit registrado pelo webhook e vinculado a task MontesSquad (seções 12/18) |
| `projetos_com_entrega` | +20 | projeto com ao menos uma entrega verificada do usuário |

**Nota:** os pesos são **constantes definidas em código** em `src/services/reputacaoTecnica.js` — a tabela segue a escala documentada no PLANO e serve de referência; o backend é a fonte de verdade final do score.

**Quando o score é recalculado** (sempre no backend, a partir do banco):
- **merge de PR GitHub** — o webhook `pull_request` com `closed` (merged) conclui a task (seção 18) e dispara o recalculo da reputação do responsável;
- **conclusão manual de task** — ao concluir a tarefa manualmente, o sistema recalcula a reputação do responsável;
- o recálculo é **idempotente**: deriva tudo do banco e pode ser reexecutado sem efeitos colaterais (o `score` é re-derivado, nunca incrementado).

#### `GET /usuarios/:id/reputacao-tecnica` (Público — sem token)
Retorna a reputação técnica do usuário: o `score` atual e as evidências que o compõem. **Público** — não exige token (mesmo padrão do portfólio da ETAPA 11, seção 27): qualquer visitante consulta a reputação técnica sem login. Complementa o `GET /usuarios/:id/reputacao` (seção 8), que segue retornando XP/nível/avaliações (engajamento) e continua exigindo token.
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Reputação técnica obtida",
    "dados": {
      "score": 165.0,
      "tasks_verificadas": 2,
      "prs_mergeados": 1,
      "commits_validos": 15,
      "projetos_com_entrega": 1
    }
  }
  ```
- **Erros:** 404 (usuário inexistente).
---

### 29. Evolução ETAPA 14 — Privacidade e repositórios privados

A ETAPA 14 formaliza a **privacidade de repositórios e dados GitHub**: garante que a integração GitHub **não exponha conteúdo privado** — nem para visitantes, nem para usuários fora do projeto, nem no portfólio público. A ETAPA 11 (seção 27) já ocultava detalhes técnicos de repositórios privados no portfólio; a ETAPA 14 **generaliza e centraliza** esse controle com duas colunas novas em `projetos` (`visibilidade` e `permitir_portfolio_publico`) e um serviço interno único de decisão de privacidade.

**Regras de privacidade (obrigatórias da etapa):**

1. **visitante não vê detalhes GitHub privados** — endpoints públicos (ex.: portfólio) nunca expõem conteúdo técnico de repositório privado;
2. **usuário fora do projeto não vê branch/commit/PR privado** — a atividade GitHub do repositório (branch automática, commits, PRs — seções 14/15) só é exposta a membros/dono do projeto;
3. **portfólio público não mostra mensagem de commit privada sem autorização** — mensagens de commit/PR de projeto privado ficam ocultas no perfil público;
4. **URL privada não deve ser exposta indevidamente** — `repositorioUrl`/`figmaUrl`/`discordUrl`/`documentacaoUrl` são ocultadas para quem não é membro de projeto privado;
5. **tokens nunca vão para o frontend** — token de acesso GitHub, `github_installation_id` e demais segredos são exclusivos do servidor;
6. **logs não devem conter secrets** — nenhum log registra tokens, authorization headers ou dados sensíveis;
7. **payloads devem ser minimizados** — cada resposta expõe apenas os campos necessários ao papel do usuário (membro/dono/visitante).

**Novidades no banco** (migração aditiva e idempotente `scripts/migrar_evolucao_etapa14.js` + sync em `Tabelas.sql`/`Insert.sql`):

| Coluna | Tipo | Default | Semântica |
|---|---|---|---|
| `projetos.visibilidade` | `ENUM('publico','privado')` | `'publico'` | visibilidade do projeto: `'publico'` (padrão — comportamento atual) ou `'privado'` (só membros/dono veem detalhes técnicos e URLs) |
| `projetos.permitir_portfolio_publico` | `BOOLEAN` | `TRUE` | autoriza o projeto a exibir contribuições detalhadas no portfólio público; `FALSE` restringe o portfólio a contagens agregadas mesmo em projeto público |

Regra de composição (usada pelo portfólio e pelo serviço de privacidade): um projeto é tratado como **privado no portfólio** quando `visibilidade = 'privado'` **OU** `permitir_portfolio_publico = FALSE`.

**Serviço interno `src/services/githubPrivacy.js` (sem rota — não é endpoint):**

Centraliza as decisões de privacidade GitHub para que nenhum controller replique a regra manualmente:

| Função | Propósito |
|---|---|
| `canViewRepositoryActivity(userId, projectId)` | decide se o usuário pode ver a **atividade do repositório** (branch automática, commits, PRs) do projeto — membros/dono podem; usuário fora do projeto **não**; visitante (sem token) nunca |
| `canExposeContributionPublicly(projectId, contribution)` | decide se uma contribuição específica pode ser exibida **publicamente** (portfólio) — respeita `visibilidade`, `permitir_portfolio_publico` e a regra de não expor mensagem de commit/PR privada |

O serviço é a **fonte de verdade única** das regras de privacidade: controllers e o portfólio consultam essas funções antes de montar a resposta (regra 7 — payload minimizado). Não possui rota/endpoint próprio.

#### `GET /projetos/:id` (Requer Token) — novos campos `visibilidade` e `permitirPortfolioPublico`

O detalhamento do projeto (seção 3) passa a incluir **`visibilidade`** e **`permitirPortfolioPublico`** (camelCase) em `dados`, além dos campos atuais (`vagas` — seção 21 —, members, tasks, messages, applications):

```json
{
  "sucesso": true,
  "message": "Detalhes do projeto carregados com sucesso",
  "dados": {
    "id": "10",
    "name": "MonteSquad Web",
    "description": "Plataforma para...",
    "status": "Aberto",
    "membersLimit": 6,
    "visibilidade": "publico",
    "permitirPortfolioPublico": true,
    "repositorioUrl": "https://github.com/exemplo/montesquad",
    "figmaUrl": "https://figma.com/exemplo",
    "discordUrl": null,
    "documentacaoUrl": null,
    "members": [],
    "tasks": [],
    "messages": [],
    "applications": [],
    "vagas": []
  }
}
```

**Ocultação de URLs (regra 4):** quando o projeto tem `visibilidade = 'privado'` e o usuário autenticado **não é membro/dono**, os campos `repositorioUrl`, `figmaUrl`, `discordUrl` e `documentacaoUrl` são **omitidos da resposta** (não retornam valor). Membros e o dono continuam vendo as URLs normalmente.

#### `PATCH /projetos/:id` (Somente dono do projeto) — campos de privacidade

O dono atualiza a privacidade do projeto pelo endpoint de edição do projeto. **Somente o dono** (papel Owner) pode alterar esses campos — outro usuário recebe **403**.

- **Request Body** (aceita os campos de privacidade da etapa; campos ausentes permanecem inalterados):
  ```json
  {
    "visibilidade": "privado",
    "permitir_portfolio_publico": false
  }
  ```
- **Validação:**
  - `visibilidade` deve ser `'publico'` ou `'privado'` — qualquer outro valor → **400**;
  - `permitir_portfolio_publico` deve ser booleano (`true`/`false`) — outro tipo → **400**.
- **Response (200 OK):** contrato de resposta padrão (`sucesso`, `message`, `dados` com o projeto atualizado — incluindo `visibilidade`/`permitirPortfolioPublico`).
- **Erros:** 400 (valor de `visibilidade` inválido ou `permitir_portfolio_publico` não booleano), 403 (usuário não é dono do projeto), 404 (projeto inexistente).

#### `GET /usuarios/:id/portfolio` (Público — sem token) — campo `privado` e contribuições ocultas

O portfólio (seção 27) passa a respeitar a privacidade definida na ETAPA 14: cada item de `projetos[]` ganha o campo **`privado`** (booleano). Um projeto é `privado: true` quando `visibilidade = 'privado'` **OU** `permitir_portfolio_publico = FALSE`.

- `privado: false` → comportamento atual (seção 27): contagens agregadas + `contribuicoes[]` detalhadas;
- `privado: true` → **`contribuicoes` não é incluída** no item; permanecem apenas as **contagens agregadas** (`tasksVerificadas`, `commits`, `prsMergeados`), `tecnologias` e o campo `privado: true` — nenhuma evidência detalhada (título de task/PR, número e URL do PR, mensagem de commit) é exposta:

```json
{
  "sucesso": true,
  "message": "Portfólio do usuário",
  "nItens": 2,
  "dados": {
    "projetos": [
      {
        "projetoId": 5,
        "projetoNome": "Sistema Financeiro",
        "funcao": "Backend",
        "privado": false,
        "tasksVerificadas": 4,
        "commits": 32,
        "prsMergeados": 4,
        "tecnologias": ["Node.js", "MySQL"],
        "contribuicoes": [
          {
            "tarefaId": 51,
            "titulo": "API de autenticação",
            "prNumero": 15,
            "prUrl": "https://github.com/organizacao/sistema-financeiro/pull/15",
            "commits": 8,
            "mergeadoEm": "2026-08-01T14:30:00.000Z"
          }
        ]
      },
      {
        "projetoId": 8,
        "projetoNome": "Dashboard Interno",
        "funcao": "Fullstack",
        "privado": true,
        "tasksVerificadas": 3,
        "commits": 18,
        "prsMergeados": 2,
        "tecnologias": ["React", "Node.js"]
      }
    ]
  }
}
```

- **Erros:** 404 (usuário inexistente — `"Usuário não encontrado"`).
---

### 30. Evolução ETAPA 15 — Timeline de atividade do projeto

A ETAPA 15 cria a **timeline de atividade do projeto**: um histórico legível das principais ações do squad — membros que entraram/saíram, tarefas criadas/assumidas/abandonadas/concluídas e atividade GitHub (commits e PRs) — gravado na nova tabela **`eventos_projeto`** e exposto pelo endpoint `GET /projetos/:projetoId/eventos`. Critério de aceite da etapa: a timeline é uma **visão de produto para usuários** e **não substitui logs técnicos** — o detalhamento técnico (commits, PRs e timeline da tarefa) continua disponível nas seções 14/15.

**Novidades no banco** (migração aditiva e idempotente `scripts/migrar_evolucao_etapa15.js` + sync em `Tabelas.sql`/`Insert.sql`):

| Aspecto | Detalhe |
|---|---|
| Tabela **`eventos_projeto`** | Evento da timeline de um projeto — `id BIGINT AUTO_INCREMENT PRIMARY KEY`, `projeto_id INT NOT NULL`, `usuario_id INT NULL` (autor do evento), `tipo VARCHAR(100) NOT NULL`, `entidade_tipo VARCHAR(50) NULL` (ex.: `tarefa`, `commit`, `pr`, `membro`), `entidade_id VARCHAR(100) NULL` (id da entidade relacionada), `titulo VARCHAR(255) NOT NULL`, `metadados JSON NULL`, `criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP`. |
| FK `projeto_id` | → `projetos(id)` `ON DELETE CASCADE` — remover o projeto apaga todos os eventos da timeline. |
| FK `usuario_id` | → `usuarios(id)` `ON DELETE SET NULL` — remover o usuário preserva o evento (`usuario_id` volta a `NULL`); o nome é resolvido por JOIN no momento da leitura. |

**Tipos de evento (coluna `tipo`):**

| tipo | Quando é registrado |
|---|---|
| `membro_entrou` | membro entra no squad (candidatura aprovada). |
| `membro_saiu` | membro sai do projeto (saída voluntária ou remoção pelo dono). |
| `task_criada` | tarefa criada no projeto. |
| `task_assumida` | membro assume uma tarefa. |
| `task_abandonada` | responsável abandona a tarefa. |
| `commit_detectado` | commit detectado no repositório GitHub vinculado. |
| `pr_aberto` | pull request aberto no repositório GitHub vinculado. |
| `pr_mergeado` | pull request mergeado no repositório GitHub vinculado. |
| `task_concluida` | tarefa concluída (kanban ou merge verificado). |
| `reavaliacao` | reavaliação registrada — tipo previsto na ETAPA 15, disparo ainda não implementado (reservado para etapas futuras). |

**Onde cada evento é disparado:**

| tipo | Ponto de disparo |
|---|---|
| `membro_entrou` | `src/controllers/candidaturas.js` — na aprovação da candidatura (`PATCH /projetos/:projetoId/candidaturas/:candidaturaId`, seção 5). |
| `membro_saiu` | `src/controllers/membros.js` — na saída do membro (`POST /projetos/:projetoId/sair`, seção 23) e na remoção pelo dono (`DELETE /projetos/:projetoId/membros/:usuarioId`, seção 23). |
| `task_criada`, `task_assumida`, `task_abandonada`, `task_concluida` | `src/controllers/tarefas.js` — criar (`POST /projetos/:projetoId/tarefas`, seção 6), assumir (`POST .../assumir`, seção 15), abandonar (`POST .../abandonar`, seção 25) e concluir tarefa. |
| `commit_detectado`, `pr_aberto`, `pr_mergeado` | `src/services/githubEvents.js` — no processamento dos eventos do GitHub (seções 14/15). |

**Regras de negócio:**
- **autenticação e autorização:** o endpoint exige token (`verificarToken`) e somente **membro ou dono** do projeto acessa a timeline (`somenteMembroOuDonoDoProjeto`) — visitante e usuário fora do projeto recebem **403**;
- **visão de produto, não log técnico:** a timeline é um resumo legível das ações do squad e **não substitui os logs técnicos** (critério de aceite da ETAPA 15) — commits, PRs e timeline detalhada da tarefa continuam nas seções 14/15;
- **ordenação:** eventos retornados do **mais recente para o mais antigo** (`criado_em` desc);
- **limite:** a resposta traz no máximo os **50 eventos mais recentes** do projeto;
- **`usuario_nome`:** cada evento inclui o nome do autor via JOIN com `usuarios`; usuário removido (`usuario_id NULL`) retorna `usuario_nome: null`;
- **metadados:** `metadados` (JSON) carrega dados extras por tipo de evento (ex.: número/URL do PR, branch do commit) sem alterar o contrato de leitura.

#### `GET /projetos/:projetoId/eventos` (Membro/dono)
Lista a timeline de atividade do projeto: eventos de `eventos_projeto` ordenados por `criado_em` **desc** (mais recentes primeiro), limitados aos **50 mais recentes**, cada um com `usuario_nome`. Sem Request Body.

- **Response (200 OK):**

```json
{
  "sucesso": true,
  "message": "Eventos do projeto",
  "nItens": 3,
  "dados": [
    {
      "id": 1,
      "projeto_id": 10,
      "usuario_id": 5,
      "tipo": "task_concluida",
      "entidade_tipo": "tarefa",
      "entidade_id": "51",
      "titulo": "API de autenticação concluída",
      "metadados": { "status": "done" },
      "criado_em": "2026-08-09T14:30:00.000Z",
      "usuario_nome": "Maria Souza"
    },
    {
      "id": 2,
      "projeto_id": 10,
      "usuario_id": 5,
      "tipo": "commit_detectado",
      "entidade_tipo": "commit",
      "entidade_id": "9f2a1c",
      "titulo": "Commit 9f2a1c — Ajusta autenticação",
      "metadados": { "branch": "main", "sha": "9f2a1c..." },
      "criado_em": "2026-08-09T13:12:00.000Z",
      "usuario_nome": "Maria Souza"
    },
    {
      "id": 3,
      "projeto_id": 10,
      "usuario_id": 5,
      "tipo": "pr_mergeado",
      "entidade_tipo": "pr",
      "entidade_id": "15",
      "titulo": "PR #15 mergeado — API de autenticação",
      "metadados": { "prNumero": 15, "prUrl": "https://github.com/organizacao/montesquad/pull/15" },
      "criado_em": "2026-08-09T14:35:00.000Z",
      "usuario_nome": "Maria Souza"
    }
  ]
}
```

- **Erros:** 403 (usuário não é membro/dono do projeto), 404 (projeto inexistente).
---
### 31. Evolução ETAPA 16 — Matching Desenvolvedor ↔ Projeto

A ETAPA 16 cria o **matching Desenvolvedor ↔ Projeto**: o endpoint `GET /matching/projetos` recomenda projetos compatíveis com o perfil do usuário autenticado. O score é **100% determinístico** (fórmula fixa, sem IA) e **explicável** — cada recomendação retorna os **fatores com percentuais** que justificaram o score e uma lista `explicacao[]` com frases em pt-BR (critério de aceite da etapa: *"Score precisa ser explicável: API retorna os fatores que justificaram a recomendação"*). Os pesos estão **documentados em código** na constante `PESOS_MATCHING` (`src/services/matching.js`).

**Fórmula do score — pesos `PESOS_MATCHING` (documentados em código):**

| Peso | Critério | O que avalia |
|---|---|---|
| **40%** | Habilidades em comum | Interseção entre as habilidades do usuário (`habilidades_usuario`, seção 20) e as habilidades exigidas pelo projeto (`habilidades_projeto`). |
| **25%** | Função procurada | Compatibilidade entre as funções de interesse do usuário (`funcoes_usuario`, seção 20) e as funções procuradas pelo projeto. |
| **15%** | Nível desejado | Compatibilidade entre o nível do usuário e o `vagas.nivel_desejado` (seção 21). |
| **10%** | Disponibilidade | Compatibilidade entre a `usuarios.disponibilidade_horas_semana` (seção 20) e a carga esperada pelo projeto. |
| **10%** | Outras afinidades | Projeto aberto + vaga aberta + usuário ainda não é membro do projeto. |

O `score` final é a soma dos percentuais atingidos por critério (0–100). **Não há mudança de banco nesta etapa** — o algoritmo reutiliza tabelas existentes (`habilidades_usuario`, `habilidades_projeto`, `funcoes_usuario`, `vagas`, `usuarios`), sem migração nem coluna nova.

**Regras de negócio:**
- **autenticação:** o endpoint exige token (`verificarToken`) — sem token ou token inválido, **401**;
- **recomendação determinística:** o score usa pesos fixos (`PESOS_MATCHING`), sem IA e sem aleatoriedade — a mesma entrada produz sempre o mesmo resultado;
- **score explicável (critério de aceite):** cada recomendação traz `fatores` com os percentuais por critério e `explicacao[]` em pt-BR justificando a recomendação — o consumidor nunca recebe um score "caixa-preta";
- **não recomenda os próprios projetos:** projetos em que o usuário já é membro ou dono não entram na recomendação (fator "outras afinidades");
- **ordenação:** recomendações ordenadas por `score` decrescente (mais compatíveis primeiro).

#### `GET /matching/projetos` (Requer Token)
Lista os projetos recomendados para o usuário autenticado, ordenados por `score` decrescente. Cada recomendação traz o `projeto` (`id`, `titulo`, `descricao`, `tecnologias` — mesmo shape de projeto da seção 3), o `score` (0–100), os `fatores` com os percentuais que justificaram o score e a `explicacao[]` em pt-BR. Sem Request Body.

- **Response (200 OK):**

```json
{
  "sucesso": true,
  "message": "Projetos recomendados",
  "nItens": 1,
  "dados": {
    "recomendacoes": [
      {
        "projeto": {
          "id": 3,
          "titulo": "Sistema Financeiro",
          "descricao": "Plataforma de controle financeiro para pequenas empresas.",
          "tecnologias": ["Node.js", "MySQL"]
        },
        "score": 92,
        "fatores": {
          "habilidades": 32,
          "funcao": 25,
          "nivel": 15,
          "disponibilidade": 10,
          "outras": 10
        },
        "explicacao": [
          "Você possui 4 das 5 habilidades exigidas pelo projeto (Node.js, SQL, API REST, Git).",
          "Sua função de interesse (Backend) está entre as funções procuradas pelo projeto.",
          "Seu nível (intermediario) atende ao nível desejado das vagas (intermediario).",
          "Sua disponibilidade semanal (20h) é compatível com a carga esperada do projeto.",
          "O projeto está aberto, possui vagas abertas e você ainda não é membro."
        ]
      }
    ]
  }
}
```

- **Erros:** 401 (token ausente/inválido — `verificarToken`).

**Explicabilidade (critério de aceite):** o par `fatores` + `explicacao[]` torna o score auditável — `fatores` mostra o percentual de cada critério (a soma dos cinco fatores é o `score`) e `explicacao[]` traduz cada fator para uma frase em pt-BR. É isso que permite ao frontend mostrar o *porquê* da recomendação, e não apenas o número.

**Frontend (squad-hub):** a seção **"Recomendados para você"** do dashboard consome `GET /matching/projetos` e exibe os projetos recomendados com o percentual de compatibilidade (`score`, ex.: "Compatibilidade: 92%") e as justificativas (`explicacao[]`).
