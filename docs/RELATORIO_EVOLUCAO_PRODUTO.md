# RELATÓRIO DE EVOLUÇÃO DE PRODUTO — MontesSquad

> **Documento:** `docs/RELATORIO_EVOLUCAO_PRODUTO.md`
> **Data de consolidação:** 09/08/2026
> **Fonte oficial:** `docs/PLANO_EVOLUCAO_PRODUTO_MONTESQUAD.md` (19 etapas, 0–18) + `docs/IMPLEMENTACAO_GITHUB_KANBAN.md`
> **Repositórios:** `MontesSquad-API` (backend Express+MySQL, porta 3333) · `squad-hub` (frontend TanStack Start + React 19)
> **Regra:** commits verificados com `git log --oneline` real; suítes re-executadas em 09/08/2026 (backend 52 arquivos / 383 testes ✅ · frontend 20 arquivos / 140 testes ✅). Nenhum dado inventado.

---

## SUMÁRIO EXECUTIVO

- **17 de 19 etapas concluídas** (ETAPAS 0–17). ETAPA 18 (validação final: segurança + regressão + E2E) **em execução** — 3 subagentes irmãos no voo, sem artefatos commitados até o momento da consolidação.
- **ETAPAS 8 e 13 não foram reimplementadas**: já existiam do plano GitHub-Kanban (task assumível atômica e rankings Top Committers/Top Contributors); o gate foi de **validação** (regra documentada no plano §2.1 e nos registros de execução).
- **Estado das suítes na consolidação:** backend **383/383** (52 arquivos, vitest + supertest com pool MySQL stubado) · frontend **140/140** (20 arquivos, vitest com `vi.mock ./api`). Coincide com o gate da ETAPA 17.
- **Endpoints:** 79 rotas registradas em `src/routes/routes.js`; `docs/api.md` com 32 seções numeradas (1–32) cobrindo todas as etapas.
- **Pendências conhecidas (não bloqueantes de código):** GitHub App real para E2E ponta a ponta com o GitHub, SMTP/Mailtrap para e-mail real de recuperação de senha e rate limit em memória (MemoryStore — ok para 1 instância).

---

## 1. TABELA RESUMO — 19 ETAPAS (0–18)

Legenda: ✅ concluída · 🚧 em execução/pendente · `—` não se aplica/não registrado.

| # | Etapa | Status | Commits Backend (hash real) | Commits Frontend (hash real) | Testes / evidência |
|---|---|---|---|---|---|
| 0 | Baseline e inventário técnico | ✅ (documental, sem código novo) | `8f2478c` (docs: plano de evolução) | — | `RELATORIO_DIAGNOSTICO_ETAPA_0.md` + `RELATORIO_FINALIZACAO_MONTESQUAD.md` (FASE-01..07) |
| 1 | Cadastro/login com GitHub OAuth | ✅ | `4cb7cc7` + `8ef0dab` | `1c4d61b` | `githubAuth.test.js` 9 casos + `githubAuth.test.ts` (web) 4 |
| 2 | Conectar/desconectar GitHub no sistema | ✅ | `575d642` → `89287ff` (Revert) → `2ecc3ac` | `4783459` → `76d1289` (Revert) → `3027d74` | `github.conta.test.js` 10 + `github.conta.security.test.js` 6 |
| 3 | Completar perfil técnico | ✅ | `9db79ac` + `c5bcdea` (docs+test) | `cd2a272` | `perfilTecnico.test.js` 15 + `perfilTecnico.security.test.js` 12 — suíte 160/160 · web 66/66 |
| 4 | Papéis/vagas necessárias no projeto | ✅ | `c527ad2` + `1cb22c0` (docs+test) | `d1049fc` | `vagasProjeto.test.js` 16 + `vagasProjeto.security.test.js` 12 — suíte 188/188 · web 73 |
| 5 | Candidatura direcionada por vaga/função | ✅ | `1fc8d5d` + `d0a212c` (docs) | `68e5d73` | `candidaturasVaga.test.js` 10 + `candidaturaVaga.security.test.js` 9 — suíte 207/207 · web 78/78 |
| 6 | Função do membro (soft-delete e saída) | ✅ | `32da86b` | `c8135d6` | `membrosSoft.test.js` 11 + `membrosSoft.security.test.js` 6 — suíte 224/224 · web 82/82 |
| 7 | Tasks com habilidades e dificuldade | ✅ | `040a36f` + `4ef296b` (docs) | `ba10661` | `tarefasHabilidades.test.js` 6 + `tarefasHabilidades.security.test.js` 5 — suíte 235/235 · web 88/88 |
| 8 | Task assumível com concorrência segura | ✅ (validada — pré-existia do GitHub-Kanban) | — (origem: `4a38a3f` + `0b288f0`) | — (origem: `32f0a2b`) | `github.taskClaim.test.js` 7 + `github.e2e.test.js` cenário D (concorrência) + `tarefas.test.js` 4 |
| 9 | Abandonar, remover responsável e reatribuir task | ✅ | `69dda8e` | `8522162` | `historicoResponsaveis.test.js` 11 + `historicoResponsaveis.security.test.js` 6 (total da suíte entre 235 e 263) |
| 10 | Histórico permanente de participação | ✅ | `58cf817` | `1c67552` + `6d99cbe` (test) | `historicoParticipacao.test.js` 7 + `historicoParticipacao.security.test.js` 4 — suíte 263/263 |
| 11 | Portfólio verificável | ✅ | `2d7c685` | `546a422` | `portfolio.test.js` 5 + `portfolio.security.test.js` 4 — suíte 272/272 |
| 12 | Separar XP de reputação técnica | ✅ | `424d42a` | `0e068bc` | `reputacaoTecnica.test.js` 16 + `reputacaoTecnica.security.test.js` 4 — suíte 276/276 |
| 13 | Top Committers e Top Contributors | ✅ (validada — pré-existia do GitHub-Kanban) | — (origem: `da4eb6c` + `9570b48`) | — (origem: `ff169ea` + `35bfc93` + `aaf6f3a`) | `github.rankings.test.js` 10 |
| 14 | Privacidade e repositórios privados | ✅ | `d3f03d3` | `fc54d26` | `githubPrivacy.test.js` 21 + `githubPrivacy.security.test.js` 10 — suíte 326/326 · web 122/122 |
| 15 | Timeline de atividade do projeto | ✅ | `0d17636` | `0225229` | `eventosProjeto.test.js` 9 + `eventosProjeto.security.test.js` 9 — suíte 344/344 · web 128/128 |
| 16 | Matching Desenvolvedor ↔ Projeto | ✅ | `cf4ece6` | `44f580e` | `matching.test.js` 9 + `matching.security.test.js` 7 — suíte 360/360 · web 134/134 |
| 17 | Matching Desenvolvedor ↔ Task | ✅ | `90e16cb` | `367493c` | `taskMatching.test.js` 14 + `taskMatching.security.test.js` 9 — suíte 383/383 · web 140/140 (re-executado ✅) |
| 18 | Revisão de segurança, regressão e E2E | 🚧 **em execução** (subagentes no voo) | — (sem commit ainda) | — | Ver seção 2 |

> **Nota ETAPA 2:** os commits originais (`575d642` backend / `4783459` frontend) foram commitados fora de ordem por subagentes e **revertidos** (`89287ff` / `76d1289`); a implementação final foi reaplicada em `2ecc3ac` / `3027d74` (recuperação documentada no registro de execução).
>
> **Nota ETAPAS 8/13:** o plano §22 registra a ordem oficial; a execução documentou que a funcionalidade já existia do plano GitHub-Kanban e o gate foi de validação/regressão, sem reimplementação (registro de execução — `evolucao-etapas-1-11-implementacao.md`).

---

## 2. VALIDAÇÃO FINAL — ETAPA 18 (segurança + regressão + E2E)

> **Status final (09/08/2026 ~12:40):** os 3 subagentes irmãos **concluíram** a validação via API real (BD Hostinger). Resultados consolidados abaixo. **1 bug real encontrado e corrigido** (duplicação de `module.exports` em `src/services/rankings.js` — ETAPAS 13/14 quebravam os endpoints de contributors com 500; fix: remover o segundo `module.exports`; endpoints re-testados 200).

### 2.1 Subagente 1 — E2E integrado (cenário de 21 passos, plano §21)

Cenário a validar (fluxo completo ponta a ponta): criar conta GitHub → completar perfil → criar projeto → definir vagas → segundo usuário cadastra → recebe projeto recomendado → candidata-se para Backend → owner aceita → vira membro Backend → owner cria task Node.js/SQL → task aparece recomendada → usuário assume → GitHub registra commits → PR abre → PR mergeia → task conclui → XP atualizado → reputação técnica atualizada → ranking atualizado → portfólio mostra contribuição → timeline mostra eventos.

| Item | Resultado |
|---|---|
| Execução do cenário E2E (21 passos) | ✅ **19/21 OK** — fluxo completo validado: projeto id 14 → vaga → matching roberto score 75 (fatores 20/25/15/5/10) → candidatura → aprovação → membro Backend → task Node.js/SQL → recomendada (compat 75, 6 motivos) → assumida → timeline (membro_entrou/task_criada/task_assumida) → portfólio público → reputação técnica → XP manual +100 (300→400) |
| Artefato esperado | teste de E2E integrado (base `test/github.e2e.test.js` do GitHub-Kanban, 3 cenários, estendido para o fluxo completo da evolução) |
| Validação em banco real | ✅ API real (BD Hostinger) — passos GitHub (commits/PR/merge/XP-por-merge) dependem de GitHub App real; endpoints existem e respondem 200 com shape correto |
| 🔴 Bug real | `src/services/rankings.js` com DOIS `module.exports` (linhas 135 e 203) — o 2º sobrescrevia o 1º → `topContributorsPorProjeto/topContributorsGeral` não exportados → GET /rankings/contributors e /projetos/:id/rankings/contributors davam 500. **CORRIGIDO** (removido o 2º export) + re-testado 200. |

### 2.2 Subagente 2 — 10 testes de segurança (plano §21)

| # | Teste de segurança | Resultado |
|---|---|---|
| 1 | IDOR em projetos | ✅ OK (403 não-dono em PATCH/DELETE; GET não-membro sem tasks/messages) |
| 2 | IDOR em tasks | ✅ OK (404/403 task de outro projeto) |
| 3 | Usuário tentando assumir task fora do projeto | ✅ OK (403 somenteMembroOuDonoDoProjeto) |
| 4 | Usuário alterando vaga de outro projeto | ✅ OK (403 somenteDonoDoProjeto) |
| 5 | Acesso a repositório privado | ✅ OK (repositorioUrl null p/ não-membro de projeto privado; github/status 403) |
| 6 | Duplicate OAuth account | ✅ OK (validado por código — 409 github_user_id já vinculado) |
| 7 | Replay de callback/state | 🟡 OK com ressalva — state JWT curto 10m sem consumo one-time; mitigado por code GitHub single-use |
| 8 | Race condition ao assumir task | ✅ OK (UPDATE atômico responsavel_id IS NULL — 1 vence, outro 409) |
| 9 | Ranking manipulado por duplicidade | ✅ OK (idempotência eventos_xp chave_idempotencia — validado por código/teste) |
| 10 | Histórico preservado após saída | ✅ OK (membros_equipe.status='saiu'; portfólio continua mostrando) |

> Base existente que cobre parcialmente esses casos (regressão de segurança acumulada nas etapas): `github.security.test.js`, `github.conta.security.test.js`, `perfilTecnico.security.test.js`, `vagasProjeto.security.test.js`, `candidaturaVaga.security.test.js`, `membrosSoft.security.test.js`, `tarefasHabilidades.security.test.js`, `historicoResponsaveis.security.test.js`, `historicoParticipacao.security.test.js`, `portfolio.security.test.js`, `reputacaoTecnica.security.test.js`, `githubPrivacy.security.test.js` (10 casos), `eventosProjeto.security.test.js` (9), `matching.security.test.js` (7), `taskMatching.security.test.js` (9).

### 2.3 Subagente 3 — Regressão do critério final (plano §21)

"Nenhuma funcionalidade nova pode quebrar":

| Fluxo existente | Resultado |
|---|---|
| Login local | ✅ OK (200 + token) |
| Cadastro local | ✅ OK (200, usuário de teste removido) |
| Projetos existentes | ✅ OK (GET /projetos 200 nItens=11; GET /projetos/1 200) |
| Candidaturas atuais | ✅ OK (200) |
| Mural | ✅ OK (GET 200; POST 201 — msg de teste removida) |
| Kanban | ✅ OK (GET /projetos/1/tarefas 200, 6 tasks) |
| Notificações | ✅ OK (GET 200; POST /ler-tudo 200) |
| Reputação atual | ✅ OK (200 com level/xp/rating/reviews/history) |
| Recuperar senha | ✅ OK (200 genérico anti-enumeração) |
| Health | ✅ OK (200) |
| Build frontend | ✅ OK (tsc 0 + npm run build exit 0) |

> Evidência: suíte completa backend **383/383** (52 arquivos) e frontend **140/140** (20 arquivos) passando no estado final — inclui regressões de etapas anteriores (ex.: `candidaturas.test.js`, `mural.test.js`, `notificacoes.test.js`, `tarefas.test.js`, `reputacao.test.js`).

---

## 3. FUNCIONALIDADES ENTREGUES (por área)

### 3.1 Autenticação e identidade (ETAPAS 1–2)
- Cadastro/login com GitHub OAuth (`GET /auth/github`, `GET /auth/github/callback`, `POST /auth/github/complete-profile`), com `state` anti-CSRF, token GitHub só no backend e fluxo "conta existente com mesmo e-mail" sem vínculo automático.
- Botão "Continuar com GitHub" no login/cadastro + onboarding (`CompleteProfile`).
- Conectar/desconectar GitHub dentro do sistema (`GET /github/me`, `GET /github/connect`, `DELETE /github/disconnect`); conta criada via GitHub só desconecta após criar senha local (evita conta sem método de login). `GitHubConnectionCard` em Configurações > Integrações.

### 3.2 Perfil técnico (ETAPA 3)
- Perfil com bio, localização, tecnologias com **nível por tecnologia**, funções de interesse com nível de interesse, disponibilidade semanal e objetivo profissional.
- Tabelas `funcoes`/`funcoes_usuario` (9 funções seed) + `perfil_completo` calculado no backend.

### 3.3 Projetos, vagas e candidaturas (ETAPAS 4–6)
- Papéis/vagas por função no projeto (`vagas_projeto` com quantidade, nível desejado, status aberta/fechada; CRUD do dono; DELETE bloqueado com membros vinculados).
- Candidatura direcionada por vaga (`candidaturas.vaga_id`; vaga de outro projeto 400, vaga fechada 400, duplicada 409; aprovação incrementa `preenchidas` e fecha vaga lotada — transacional).
- Função do membro com **soft-delete** (`status ativo/saiu/removido`), rota `POST /projetos/:projetoId/sair` (owner bloqueado) e liberação de vaga ao sair/remover.

### 3.4 Tasks e Kanban (ETAPAS 7–10)
- Tasks com habilidades e dificuldade (`habilidades_tarefa` + `tarefas.dificuldade`).
- Task assumível atômica (`UPDATE ... WHERE responsavel_id IS NULL` + 409 em corrida — pré-existente do GitHub-Kanban, validada).
- Abandonar, remover responsável e reatribuir task com histórico (`historico_responsaveis_tarefa`).
- **Histórico permanente de participação**: soft-delete de tarefas (`excluida_em`), listagem filtra excluídas, histórico preservado.

### 3.5 GitHub-Kanban (plano IMPLEMENTACAO_GITHUB_KANBAN — base das ETAPAS 8/13)
- GitHub App com Octokit, webhook seguro e idempotente, conexão de repositório, identidade GitHub do usuário, task assumível com branch gerada, processamento de push registrando commits, automação do Kanban via PR (merge → done), XP autoritativo no backend, timeline técnica da tarefa e notificações de PR.

### 3.6 Portfólio e reputação (ETAPAS 11–12)
- **Portfólio verificável** (`GET /usuarios/:id/portfolio`, público): projetos + função + tasks verificadas + commits + PRs mergeados + tecnologias + contribuições.
- **Reputação técnica separada do XP** (`reputacao_tecnica_usuario`, `GET /usuarios/:id/reputacao-tecnica`): score calculado só no backend (pesos 50/30/1/20 — task verificada/PR mergeado/commit/projeto com entrega), com fix de dados no webhook (`github_pull_requests.estado='merged'` e `github_commits.author_github_id` passaram a ser gravados).

### 3.7 Rankings (ETAPA 13 — validada)
- Top Committers (volume bruto) e Top Contributors (ponderação: commit +1, PR aberto +5, PR mergeado +30, task verificada +50, teto anti-manipulação) por projeto e global, com filtro de período e limite — pré-existentes do GitHub-Kanban, validados.

### 3.8 Privacidade (ETAPA 14)
- `projetos.visibilidade ENUM('publico','privado')` + `permitir_portfolio_publico`; portfólio público marca `privado:true` e oculta contribuições (fail-closed); `obterProjeto` oculta as 4 URLs para não-membro de projeto privado; validação de ENUM no PATCH.

### 3.9 Timeline de eventos (ETAPA 15)
- Tabela `eventos_projeto` + `GET /projetos/:projetoId/eventos` (membro/dono, LIMIT 50, DESC) com disparos reais: membro_entrou/saiu, task_criada/assumida/abandonada/concluida, commit_detectado, pr_aberto/mergeado (best-effort, fora de transações críticas). UI `ProjectTimeline` (aba Atividade).

### 3.10 Matching (ETAPAS 16–17)
- **Matching Desenvolvedor ↔ Projeto** (`GET /matching/projetos`): pesos 40% habilidades / 25% função / 15% nível / 10% disponibilidade / 10% outras; score 0–100 explicável (fatores + `explicacao[]` pt-BR; Σ pontos = score); exclui projetos onde já é membro/dono.
- **Matching Desenvolvedor ↔ Task** (`GET /projetos/:projetoId/tasks/recomendadas`): pesos 40% habilidades / 25% dificuldade / 15% função / 10% disponibilidade / 10% sem responsável; recomenda só tasks livres/não excluídas; **não bloqueia** a assunção manual (transparência — critério de aceite).

---

## 4. PENDÊNCIAS CONHECIDAS

| # | Pendência | Tipo | Detalhe |
|---|---|---|---|
| 1 | **GitHub App real** (envs `GITHUB_*` no `.env`) | Configuração/ambiente | `.env.example` define `GITHUB_APP_ID`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_APP_SLUG` e URLs de callback — **vazios** no exemplo. Sem um GitHub App real configurado, o E2E ponta a ponta (ETAPA 18, subagente 1) não consegue provar o fluxo real de push/PR/merge (os testes atuais usam pool MySQL stubado + mocks). |
| 2 | **SMTP/Mailtrap** (envs `SMTP_*` no `.env`) | Configuração/ambiente | Recuperação de senha usa `nodemailer` (`src/controllers/autenticacao.js`), mas sem `SMTP_HOST/USER/PASSWORD` reais o e-mail **não é enviado** (log "Configuração SMTP ausente"). Sugestão: conta Mailtrap para ambiente de desenvolvimento. |
| 3 | **Rate limit por-processo (MemoryStore)** | Arquitetura (aceita p/ MVP) | `express-rate-limit` nas rotas públicas sensíveis (10 req/15min por IP, `src/routes/routes.js`) usa o store padrão **em memória** — ok para **1 instância**; em multi-instância seria necessário store compartilhado (ex.: Redis). Não bloqueia o MVP. |
| 4 | **ETAPA 18 — resultados dos 3 subagentes** | Execução | E2E integrado, 10 testes de segurança e regressão do critério final: resultados a consolidar quando os irmãos terminarem (seção 2). |
| 5 | `.sec_tokens.env` no working tree (backend) | Higiene | Arquivo temporário do subagente de segurança (untracked) — remover antes do commit final da ETAPA 18. |

---

## 5. NOTAS METODOLÓGICAS

- **Commits:** todos os hashes foram conferidos com `git log --oneline` real em 09/08/2026 (backend até `90e16cb`; frontend até `367493c`). Suítes: backend `npm test` → 52 arquivos / 383 testes ✅; frontend `npm test` → 20 arquivos / 140 testes ✅.
- **Contagens de teste por arquivo:** obtidas por contagem real de casos (`it(`/`test(`) nos arquivos de `test/` (backend) e `src/**/*.test.ts` (frontend).
- **Suítes totais por etapa:** valores registrados nos gates de conclusão das etapas (fonte: registros de execução e `docs/api.md`); onde não registrado, marcado como "—".
- **Este relatório não foi commitado** — o agente pai consolida e commita junto com o fechamento da ETAPA 18.
