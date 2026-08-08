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
