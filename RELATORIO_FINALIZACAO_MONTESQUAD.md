# RELATÓRIO DE FINALIZAÇÃO — MontesSquad (squad-hub + MontesSquad-API)

> **Data:** 07/08/2026 · **Autor:** Hermes Agent (análise 4 subagents paralelos + execução real)
> **Stack:** Backend Express+MySQL (JS puro, porta 3333) · Frontend TanStack Start + React 19 + Vite + Tailwind + shadcn
> **Objetivo:** documento único de aprovação e execução para finalizar o projeto 100% — backend, frontend e integração.

---

## SUMÁRIO EXECUTIVO

- **O que está pronto:** infraestrutura (banco remoto OK, backend sobe, login real OK, build+tsc OK), CRUD de projetos, auth, tarefas, candidaturas (backend), telas completas no frontend.
- **O que impede "100%":** 7 críticos no backend (mural quebrado, IDOR, habilidades-projeto, reputação/notificações sem endpoint, senhas plaintext), 4 críticos no frontend (candidaturas/mural/perfil/projetos não persistem), ~16 altos, ~14 médios, fallbacks silenciosos de mock em toda parte.
- **Plano:** 7 fases, 34 subetapas, cada uma com arquivos, critérios de aceite, segurança e testes. Execução com subagentes (máx 4/lote), revisão do agente principal, commits PT-BR por fase.

---

## ESTADO ATUAL VERIFICADO (execução real)

| Item | Resultado |
|---|---|
| Banco MySQL remoto 212.85.3.212 | ✅ Conecta |
| Backend na porta 3333 | ✅ Sobe |
| `POST /login` admin@email.com/admin123 | ✅ 200 + JWT |
| `POST /login` lucas@email.com/senha123 | ✅ 200 + JWT |
| `POST /login` senha errada | ✅ 401 |
| Frontend `npm run build` | ✅ 29.51s |
| Frontend `npx tsc --noEmit` | ✅ 0 erros |
| Frontend `npx eslint src` | ❌ 11.412 CRLF + 4 any + 8 warnings |
| Portas 3333/5173/3000 | Livres (servidores parados) |
| Git backend | `AGENTS.md` untracked |
| Git frontend | ahead 1 commit do origin |

**Credenciais de teste:** lucas@email.com/senha123 · fernanda@email.com/senha456 · roberto@email.com/senha789 · juliana@email.com/senha012 · admin@email.com/admin123

---

## RESULTADO FASE-01 (validação pós-migração — 07/08/2026)

> Migração `scripts/migrar_fase01.js` aplicada no banco remoto + re-teste completo. FASE-01 **APROVADA** ✅

| Subetapa | Verificação | Resultado |
|---|---|---|
| 1.A Mural `content` | POST com `{content}` → 201; `{content:"   "}` → 400 | ✅ |
| 1.A Mural autorização | Não-membro → 403 (Fernanda p/ projeto 1); membro → 201 (Roberto é membro p/ projeto 1) | ✅ |
| 1.B IDOR PATCH /usuarios/:id | chain `verificarToken → somenteProprioOuAdm → editarUsuario` (smoke) | ✅ |
| 1.C–1.E Habilidades | controllers com PK composta, exports OK (smoke 0 falhas) | ✅ |
| 1.F Transação candidaturas | código revisado | ✅ |
| 1.G Senhas bcrypt | seed com hashes (Insert.sql); login real admin/lucas → **200**; plaintext rejeitado | ✅ |
| 1.G Rate limit | 11º login → **429** com headers `RateLimit-Policy: 10;w=900`; rota autenticada segue 200 com limite estourado | ✅ |
| 1.H Validação | senha curta 400, email inválido 400, duplicado 409 | ✅ |
| 1.I Anti-enumeração | login inexistente 401, senha errada 401 (idênticos), recuperar-senha inexistente 200 genérico | ✅ |
| 1.J GET /projetos/:id | revisado | ✅ |
| Drift schema `projetos` | colunas `repositorio_url/figma_url/discord_url/documentacao_url` presentes; POST /projetos → **200** (id 6 criado e removido em teste) | ✅ |
| Smoke test (sem DB) | `scripts/smoke_test.js` → **0 falhas** (23 checks) | ✅ |
| Sintaxe | `node -c` em controllers/middlewares/routes/index → 0 erros | ✅ |
| Dados de teste | mensagens 5–7 e projeto 6 removidos (banco como encontrado) | ✅ |

---

# PLANO DE EXECUÇÃO — 7 FASES / 34 SUBETAPAS

---

## FASE-01 — Backend: correções críticas de contrato e autorização

**Objetivo:** eliminar todos os bugs 🔴 CRÍTICOS e 🟠 ALTO do backend que quebram a integração ou a segurança.
**Dependências:** nenhuma. **Duração estimada:** 1 lote de 4 subagentes.
**Entregável:** backend com rotas corrigidas, autorização correta, seed seguro, rate limit e validação.

### Subetapas

**1.A — Corrigir contrato do Mural (`content` vs `conteudo`)**
- Arquivos: `src/controllers/mensagens.js:40`
- O que: aceitar `content` como alias de `conteudo` (`const conteudo = body.conteudo || body.content`), e devolver `content` na listagem para casar com o frontend. Atualizar `docs/api.md`.
- Critério: `POST /projetos/:id/mensagens` com `{content}` retorna 201 e a mensagem aparece no `GET /projetos/:id`.
- Segurança: validar `conteudo` não-vazio.

### 1.B — Corrigir IDOR em `PATCH /usuarios/:id`
- Arquivos: `backend/src/middlewares/auth.js` (novo `somenteProprioOuAdm`), `backend/src/routes/routes.js:33`
- O que: criar middleware que permite edição apenas se `req.usuarioAutenticado.id == req.params.id` OU `tipo === 'adm'`. Aplicar na rota.
- Critério: usuário A tentando `PATCH /usuarios/B` → 403; usuário A editando a si → 200; adm editando qualquer → 200.
- Segurança: 🔴 bloqueia troca de senha de terceiros.

### 1.C — Corrigir `POST /habilidades-projeto` (middleware lê body)
- Arquivos: `backend/src/middlewares/auth.js:71-80`, `backend/src/routes/routes.js:63`
- O que: `somenteDonoDoProjeto` deve aceitar `projeto_id` vindo do body quando não houver param de rota.
- Critério: `POST /habilidades-projeto` com `projeto_id` no body → 200/201 (não mais 400).

### 1.D — Corrigir autorização `PATCH/DELETE /habilidades-projeto/:id`
- Arquivos: `auth.js`, `habilidades_projeto.js`
- O que: antes de autorizar, buscar `projeto_id` da linha de `habilidades_projeto` pelo `:id`, e então verificar dono do projeto.
- Critério: dono do projeto edita/apaga linha → 200; não-dono → 403.

### 1.E — Corrigir CRUD de `habilidades_usuario` e `habilidades_projeto` (PK composta)
- Arquivos: `habilidades_usuario.js`, `habilidades_projeto.js`
- O que: (1) `editar*` deve usar WHERE com os valores ANTIGOS (ou mudar a rota para receber `usuario_id`+`habilidade_id`); remover query duplicada. (2) `apagar*` deve apagar UMA linha específica (por `usuario_id`+`habilidade_id` no body/query), não todas. (3) `listar*` deve filtrar por `usuario_id`/`projeto_id` (query param).
- Critério: adicionar/editar/remover 1 habilidade funciona; listar retorna só as do usuário/projeto.

### 1.F — Transação em `atualizarStatusCandidatura`
- Arquivo: `candidaturas.js:163-183`
- O que: envolver `UPDATE candidaturas` + `INSERT membros_equipe` em `START TRANSACTION`/`COMMIT`/`ROLLBACK`.
- Critério: se o INSERT falhar, o UPDATE é revertido.

### 1.G — Segurança de senhas: hash no seed + remover fallback plaintext
- Arquivos: `Insert.sql`, `autenticacao.js:57-68`
- O que: (1) gerar hashes bcrypt para as senhas do seed (ou script `npm run db:seed` que hasheia); (2) remover a comparação em texto puro — exigir sempre hash bcrypt.
- Critério: login com senha do seed funciona (hash); senha plaintext no banco NÃO é aceita.
- Segurança: 🔴 elimina senhas em claro.

### 1.G — Rate limiting
- Arquivos: `backend/package.json` (+`express-rate-limit`), `index.js`
- O que: limitar `/login`, `/recuperar-senha`, `/resetar-senha`, `POST /usuarios` (ex: 10 req/15min por IP).
- Critério: 11ª tentativa de login no mesmo IP → 429.

### 1.H — Validação de input + erros de negócio amigáveis
- Arquivos: todos os controllers
- O que: validar email (regex), senha mínima (6), enums (`status`, `prioridade`, `nivel`, `tipo`), URLs, `limite_membros` numérico; capturar `ER_DUP_ENTRY` → 409 "E-mail já cadastrado"; ENUM inválido → 400.
- Critério: inputs inválidos retornam 400/409 com mensagem amigável, nunca 500.

### 1.I — Anti-enumeração + JWT_SECRET obrigatório
- Arquivos: `autenticacao.js:93-98`, `auth.js:5`, `autenticacao.js:7`
- O que: login retorna 401 genérico ("Credenciais inválidas") para usuário inexistente e senha errada; `recuperarSenha` retorna 200 genérico sempre. Remover fallback `dev-secret-key` (exigir JWT_SECRET no boot).
- Critério: não dá para distinguir email válido de inválido.

### 1.J — Restringir `GET /projetos/:id` (mural/membros/tasks privados)
- Arquivo: `projetos.js:164-377`
- O que: se o usuário não é dono nem membro, não retornar `messages`, `tasks`, `applications` (ou aplicar `somenteMembroOuDonoDoProjeto` na rota e criar rota pública enxuta).
- Critério: usuário externo vê só dados básicos do projeto.

### 1.K — Atualizar `docs/api.md`
- O que: documentar todos os endpoints (resetar-senha, habilidades*, membros, tarefas, candidaturas GET/PATCH, DELETE), contrato do mural corrigido, e os novos endpoints da FASE-02.
- Critério: doc cobre 100% das rotas.

**Validação da fase:** subir backend, rodar curl em cada rota corrigida (login, PATCH usuário IDOR, mural, habilidades-projeto, habilidades-usuario, candidatura aceita). `npm test` quando existir (FASE-06).

---

## FASE-02 — BACKEND: novos endpoints (reputação + notificações)

**Objetivo:** criar os endpoints que o frontend já consome mas não existem.
**Dependência:** FASE-01 · **Duração:** 1 lote de 2-3 subagentes.

### 2.A — Tabela `notificacoes`
- Arquivo: `backend/src/database/createDatabase/Tabelas.sql` (novo bloco) + SQL de migração
- O que: `CREATE TABLE notificacoes (id INT AI PK, usuario_id INT NOT NULL FK usuarios ON DELETE CASCADE, tipo ENUM('application','message','task','system','approved'), titulo VARCHAR(150), descricao TEXT, link VARCHAR(255), lida BOOLEAN DEFAULT FALSE, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`.
- Critério: tabela criada no banco remoto (rodar SQL).

### 2.B — Controller `reputacao.js` + rota `GET /usuarios/:id/reputacao`
- Arquivos: `backend/src/controllers/reputacao.js` (novo), `routes.js`
- O que: agregar `estatisticas_usuario` (level, xp, xp_para_proximo, media_notas, total_avaliacoes, projetos_concluidos) + `avaliacoes` (reviews com autor/projeto/nota/comentário) + `conquistas_usuario` (conquistas com ícone) + histórico de projetos (membros_equipe + projetos). Aceitar `me` como alias do usuário autenticado.
- Formato de resposta: casar com o tipo `Reputation` do frontend (`level`, `xp`, `xpToNext`, `rating`, `reviewsCount`, `projectsCompleted`, `achievements[]`, `reviews[]`, `history[]`).
- Critério: `GET /usuarios/me/reputacao` com token retorna objeto completo; sem token → 401.

### 2.C — Controller `notificacoes.js` + rotas
- Arquivos: `backend/src/controllers/notificacoes.js` (novo), `GET /notificacoes`, `POST /notificacoes/ler-tudo`
- O que: listar notificações do usuário autenticado (mais recentes primeiro); marcar todas como lidas. Formato casa com `AppNotification` do frontend (`id`, `type`, `title`, `description`, `createdAt`, `read`, `link`).
- Critério: `GET /notificacoes` retorna lista do usuário; `POST /ler-tudo` zera não-lidas.

### 2.D — Disparar notificações em eventos
- Arquivos: `candidaturas.js`, `mensagens.js`, `tarefas.js`
- O que: ao criar candidatura → notifica dono do projeto; ao aprovar/rejeitar → notifica candidato; ao enviar mensagem → notifica membros; ao atribuir tarefa → notifica responsável.
- Critério: eventos geram linhas na tabela `notificacoes`.

### 2.E — Rotas + middlewares
- Arquivo: `routes.js`
- O que: registrar as novas rotas com `verificarToken` (reputação: próprio usuário ou adm; notificações: próprio usuário).
- Critério: autorização correta (usuário não vê reputação/notificações de outro).

**Validação da fase:** curl com token real: `GET /usuarios/me/reputacao`, `GET /notificacoes`, `POST /notificacoes/ler-tudo`; conferir notificações criadas após candidatura/mensagem.

**✅ STATUS 2026-08-07 — FASE-02 CONCLUÍDA (2.A–2.E):**
- ✅ 2.A — Tabela `notificacoes` criada no BD remoto (`scripts/migrar_fase02.js` idempotente, auditado) + sincronizada nos 3 SQLs: `Tabelas.sql` (CREATE, §15), `Insert.sql` (seed §15, 5 linhas consistentes com usuários 1-4), `drop.sql` (DROP).
- ✅ 2.B — `src/controllers/reputacao.js` (obterReputacao + alias `me`) com contrato camelCase casado com o tipo `Reputation` do frontend; rota `GET /usuarios/:id/reputacao` com `verificarToken`.
- ✅ 2.C — `src/controllers/notificacoes.js` (`listarNotificacoes`, `marcarTodasLidas`, utilitária `criarNotificacao(pool, {...})` que NUNCA lança); rotas `GET /notificacoes` e `POST /notificacoes/ler-tudo`.
- ✅ 2.D — Disparos: candidatura → dono (`application`); aprovação `status === "aceito"` → candidato (`approved`, fora da tx); mensagem → demais membros (`message`); tarefa com `responsavel_id` → responsável (`task`).
- ✅ 2.E — Rotas registradas com `verificarToken` (sem token → 401, validado).
- **Validação executada:** `node -c` (7 arquivos OK) · smoke do skill (0 falhas) · E2E com banco REAL (servidor spawnado porta 3999): login admin → 200, `GET /notificacoes` → 200 + shape `{sucesso, message, dados, nItens}`, `POST /ler-tudo` → 200, `GET /usuarios/5/reputacao` → 200 + dados, sem token → 401 — **8/8 ✅**.
- Commit: `8a051f3` (push main).

---

## FASE-03 — FRONTEND: integração com API real (candidaturas, mural, perfil, projetos)

**Objetivo:** eliminar os 4 críticos do frontend — tudo passa a persistir no backend.
**Dependência:** FASE-01 (contratos corrigidos) · **Duração:** 1 lote de 4 subagentes.

### 3.A — Candidaturas reais
- Arquivos: `frontend/src/services/projects.ts:169` (`requestProjectJoin`), `frontend/src/components/projects/ProjectCard.tsx`, `frontend/src/routes/projetos.$id.tsx:66`
- O que: substituir `applyToProjectLocal` por chamada real `POST /projetos/:id/candidaturas` (com `mensagem`); tratar sucesso/erro com toast; remover fallback local.
- Critério: candidatura aparece no backend (`GET /projetos/:id/candidaturas` como dono) e na aba Candidaturas.

### 3.B — Mural real
- Arquivo: `frontend/src/services/projectDetail.ts:404`
- O que: enviar `conteudo` (alinhado com FASE-01.A); remover fallback local; mostrar erro real se falhar.
- Critério: mensagem persiste no backend e aparece para outros membros.

### 3.C — Perfil persiste
- Arquivos: `frontend/src/routes/perfil.tsx:119-130`, `frontend/src/services/` (novo `updateUserProfile`)
- O que: `save()` chama `PATCH /usuarios/:id` (nome, bio, localizacao) + `POST /habilidades-usuario` (skills); remover `setTimeout(400)` fake; mostrar loading real.
- Critério: recarregar a página → perfil mantém nome/bio/local/skills.

### 3.D — Criar projeto sem "fingir sucesso"
- Arquivo: `frontend/src/services/projectDetail.ts:166-259`
- O que: em erro, lançar/retornar erro real (toast de erro, não criar `local-<timestamp>`); navegar só em sucesso.
- Critério: com backend fora, aparece erro e NÃO cria projeto local.

### 3.E — Persistir tecnologias na criação
- Arquivos: `frontend/src/services/projectDetail.ts:177`, `frontend/src/routes/projetos.novo.tsx`
- O que: após `POST /projetos`, chamar `POST /habilidades-projeto` para cada tecnologia; no `GET /projetos` (listagem), exibir badges de stack.
- Critério: projeto criado com stack aparece com badges na listagem após reload.

### 3.F — Skills no cadastro
- Arquivos: `frontend/src/contexts/AuthContext.tsx:126-145`, `frontend/src/routes/register.tsx`
- O que: `signUp` envia skills → `POST /habilidades-usuario` após criar usuário.
- Critério: skills do cadastro aparecem no perfil.

### 3.G — Alinhar permissões do Kanban
- Arquivos: `frontend/src/components/projects/KanbanBoard.tsx`, `backend/src/routes/routes.js:90`
- O que: decidir — liberar `POST /projetos/:id/tarefas` para membros no backend (mais coerente com a UI) OU restringir a UI a dono. Recomendado: liberar para membros (o PATCH já é de membro).
- Critério: membro cria tarefa → 200 e persiste.

### 3.H — `isOwner`/`isMember` por id (não por nome)
- Arquivo: `frontend/src/routes/projetos.$id.tsx:123-125`
- O que: comparar `user.id` com `criador_id`/ids de membros (o backend já retorna `members[].id`).
- Critério: homônimos não quebram permissões.

**Validação da fase:** navegador — criar projeto com stack, candidatar, aprovar candidatura, mural, kanban, perfil; recarregar e conferir persistência; console sem erros.

**✅ STATUS 2026-08-07 — FASE-03 (3.A–3.D CONCLUÍDAS, testes reais no navegador):**
- ✅ 3.A — `applyToProjectLocal` → `POST /projetos/:id/candidaturas` real (sem fallback local; lança erro). Testado na UI (projeto 2, Fernanda): candidatura id=5 `pendente` no backend com mensagem + `usuario_bio` refletindo perfil salvo.
- ✅ 3.B — `addLocalMuralMessage` → `POST /projetos/:id/mensagens` real (sem fallback). Testado na UI (projeto 7): mensagem id=9 persistida (`remetente_nome: "Admin MontesSquad"`).
- ✅ 3.C — `src/services/perfil.ts` novo (`updateUserProfile` PATCH /usuarios/:id + `syncUserSkills` com normalização de acentos/best-effort); `save()` sem `setTimeout(400)` fake, `updateUser` só após 200. Testado: bio editada na UI e confirmada no banco real via API.
- ✅ 3.D — `createProject` sem `local-<timestamp>` (throw em erro, navega só em sucesso). Testado na UI: "Squad QA FASE-03" criado → **id real 7** no backend (criador_id 5, status aberto).
- 🐛 **Bug corrigido (descoberto no teste)**: `cadastrarProjeto` não vinculava o criador em `membros_equipe` → dono era tratado como "visitante" (mural/kanban 🔒). Fix: INSERT do vínculo após criar projeto (commit `b1b3560`). Projeto 7 vinculado retroativamente. Pós-fix: aba Mural desbloqueada, "2/5 membros", botão Encerrar Projeto visível.
- 🧹 Também: `updateLocalApplicationStatus` (aprovar/rejeitar candidatura) sem fallback "finge sucesso" — agora lança erro real.
- **Commits:** backend `b1b3560` (fix vínculo) + frontend `e422aa3` (FASE-03 3.A–3.D) — push main.
- 🔄 **3.E–3.H CONCLUÍDAS (2026-08-07, commits `18cd3da` + `a19e288`):**
  - ✅ 3.E — Backend `listarProjetos` retorna `tecnologias` (GROUP_CONCAT habilidades_projeto+habilidades); `createProject` persiste stack via `POST /habilidades-projeto` (best-effort, normalização de acentos); `fetchProjects` mapeia tecnologias. Testado na UI: projeto id=8 "Squad Stack 3E" → `tecnologias: ['Node.js', 'React']` no backend.
  - ✅ 3.F — `signUp` (AuthContext) faz POST /usuarios → auto-login (`loginAndMap`) → `syncUserSkills` best-effort; `register.tsx` navega /dashboard ou /login.
  - ✅ 3.G — `POST /projetos/:projetoId/tarefas` liberado p/ membros (`somenteMembroOuDonoDoProjeto`); KanbanBoard já usava `readOnly={!isMember}`.
  - ✅ 3.H — `isOwner`/`isMember` por **id** (creatorId mapeado de criador_id + `members[].id`), sem comparação por nome.
- **🎉 FASE-03 100% CONCLUÍDA** — commits: backend `b1b3560` + `18cd3da`, frontend `e422aa3` + `a19e288` (push main).

---

## FASE-04 — FRONTEND: reputação, notificações, dashboard e recuperação de senha

**Objetivo:** substituir os mocks restantes por dados reais e completar telas pendentes.
**Dependência:** FASE-02 (endpoints) · **Duração:** 1 lote de 3-4 subagentes.

### 4.A — Reputação real
- Arquivos: `frontend/src/services/reputation.ts:149-160`, `frontend/src/routes/perfil.tsx`, `frontend/src/routes/dashboard.tsx`
- O que: `fetchReputation` consumir `GET /usuarios/me/reputacao`; remover `MOCK`/`getLocalReputation`; tratar erro com estado vazio/erro.
- Critério: perfil mostra level/XP/avaliações/conquistas/histórico reais do usuário logado.

### 4.B — Notificações reais
- Arquivos: `frontend/src/services/notifications.ts:98-120`, `frontend/src/routes/notificacoes.tsx`, `frontend/src/components/NotificationsMenu.tsx`
- O que: `fetchNotifications` → `GET /notificacoes`; `markAllRead` → `POST /notificacoes/ler-tudo`; remover `MOCK`; contador de não-lidas real.
- Critério: notificação criada (candidatura/mensagem) aparece no sino e na página; marcar lidas persiste.

### 4.C — Dashboard com dados reais
- Arquivo: `frontend/src/routes/dashboard.tsx:87-126`
- O que: substituir XP semanal hardcoded e defaults de tarefas por: tarefas reais via `GET /projetos/:id/tarefas` (dos projetos do usuário); XP semanal vindo da reputação real (ou remover o gráfico se não houver fonte).
- Critério: gráficos refletem dados reais; sem valores inventados.

### 4.D — Página de recuperação de senha
- Arquivos: `frontend/src/routes/` (novo `recuperar-senha.tsx` + `resetar-senha.tsx`), `frontend/src/router.tsx`, `frontend/src/routes/login.tsx:94-100`
- O que: substituir toast "Em breve" por fluxo real: email → `POST /recuperar-senha`; link → `POST /resetar-senha` com token+novaSenha. Ajustar `RESET_PASSWORD_URL` do backend para a URL do frontend.
- Critério: fluxo completo funciona com SMTP configurado (ou documentar que precisa de SMTP real).

### 4.E — Busca global funcional (ou remover)
- Arquivo: `frontend/src/layouts/AppLayout.tsx:119-126`
- O que: implementar busca (filtro de projetos por nome/descrição navegando para `/projetos?q=...`) ou remover o input decorativo.
- Critério: digitar e Enter leva a resultados filtrados.

### 4.F — Remover fallbacks silenciosos (produção)
- Arquivos: `projects.ts`, `projectDetail.ts`, `reputation.ts`, `notifications.ts`
- O que: em produção (`import.meta.env.PROD`), `catch` deve `console.error` + propagar erro para a UI (estado de erro/empty); manter mock apenas em dev explícito.
- Critério: backend fora → UI mostra erro/estado vazio, nunca dados fictícios.

### 4.G — Limpar mocks e código morto
- Arquivos: `MOCK_PROJECTS`, `getLocalProjects`, `mockDetail`, `getLocalProjectDetail`, `MOCK` (reputation/notifications), `awardLocalXP` (se não houver endpoint), `ProjectsError` (reativar)
- O que: remover ou isolar em `src/services/mocks.ts` (dev-only).
- Critério: `grep -r "MOCK" src/` → zero em produção.

**Validação da fase:** navegador completo — perfil, notificações, dashboard, recuperação de senha; console limpo; backend fora → estados de erro visíveis.

**✅ STATUS 2026-08-07 — FASE-04 CONCLUÍDA (4.A–4.G, testes reais):**
- ✅ 4.A — `fetchReputation` → `GET /usuarios/me/reputacao` (alias `me`), valida `{sucesso, dados}`, PROD lança erro (DEV mantém mock); `perfil.tsx` com `ReputationState` (loading/erro/empty + retry).
- ✅ 4.B — `fetchNotifications` → `GET /notificacoes` (map snake→camel), `markAllRead` → `POST /notificacoes/ler-tudo`; página + sino reais. Testado: candidatura do admin gerou notificação `application` p/ Fernanda (read: True após ler-tudo) ✅.
- ✅ 4.C — `dashboard.tsx` reescrito: XP/nível de `fetchReputation`, tarefas reais via `useQueries` de `GET /projetos/:id/tarefas` (projetos do `history`); sem valores inventados (XP mostra 0 real quando não há estatísticas). Novo `src/services/tasks.ts`.
- ✅ 4.D — Rotas `recuperar-senha.tsx` + `resetar-senha.tsx` (token via `?token=`), registradas no router; login link real → `/recuperar-senha`; backend fallback `RESET_PASSWORD_URL` → `http://localhost:5173/resetar-senha?token=` (commit `a5bde8c`). Smoke real do subagent: POST /recuperar-senha 200, estados do reset OK.
- ✅ 4.E — Busca global (AppLayout form) → Enter navega `/projetos?q=termo`; `projetos.index.tsx` valida `q` e filtra (fuzzyMatch). Testado: "QA FASE" → `/projetos?q=QA+FASE` → listagem filtrou só "Squad QA FASE-03" ✅.
- ✅ 4.F — PROD sem fallback fictício em `projects.ts`/`projectDetail.ts`/`reputation.ts`/`notifications.ts` (console.error + throw; DEV mantém mock).
- ✅ 4.G — Mocks isolados em `src/services/mocks.ts` (dev-only).
- **Commits:** backend `a5bde8c` + frontend `84c0f55` — push main.
- **Pendência documentada:** tabela `estatisticas_usuario` vazia no BD real → reputação mostra 0 (dado real, não bug); seed de estatísticas pode ser adicionado (FASE-05/06).

---

## FASE-05 — QUALIDADE: testes, lint, format, healthcheck, seed seguro

**Objetivo:** garantir confiabilidade e padronização.
**Dependência:** FASE-01 a 04 · **Duração:** 1 lote de 3 subagentes.

### 5.A — Suíte de testes backend (Vitest/Jest + supertest)
- Arquivos: `backend/package.json`, `backend/test/` (novo)
- O que: testes de integração das rotas principais: auth (login ok/errado, IDOR), projetos (CRUD, dono), candidaturas (fluxo completo aceito→membro), mural (content), tarefas (CRUD), habilidades (PK composta), reputação, notificações. Usar banco de teste (ou mock do pool).
- Critério: `npm test` verde.

### 5.B — Testes frontend (vitest)
- Arquivos: `frontend/src/services/*.test.ts`
- O que: unit dos services (fetchProjects mapeamento, fetchReputation, fetchNotifications) com mocks de axios.
- Critério: `npm test` verde.

### 5.C — Lint/format
- Comando: `npm run format` (prettier corrige 11.412 CRLF) + `npx eslint src --fix` + tipar os 4 `any` de `projectDetail.ts` (155, 177, 375, 404).
- Critério: `npm run lint` sem erros.

### 5.D — Healthcheck + `.env.example` + `db:setup`
- Arquivos: `backend/index.js` (`GET /health` com `SELECT 1`), `backend/.env.example`, `backend/package.json` (`db:setup` = migração + seed com bcrypt)
- Critério: `curl /health` → `{sucesso:true, banco:'ok'}`; `npm run db:setup` cria/atualiza schema e seed com senhas hasheadas.

**Validação da fase:** `npm test` (back+front), `npm run lint`, `npm run build`, `curl /health`.

---

## FASE-06 — VALIDAÇÃO FINAL NO NAVEGADOR (E2E manual)

**Objetivo:** provar que o produto funciona de ponta a ponta.
**Dependência:** FASE-01 a 05 · **Duração:** agente principal + browser.

### 6.A — Fluxo completo com usuário real
- Passos: subir backend (3333) + frontend (5173) → cadastrar usuário → login → criar projeto com stack → candidatar-se a outro projeto → dono aprova → mural → kanban (criar/mover tarefa) → perfil (editar + reputação real) → notificações → configurações (trocar senha) → logout.
- Critério: tudo persiste entre reloads; sem mocks visíveis.

### 6.B — Fluxos de erro
- Backend desligado → telas mostram erro/retry (nunca mock); login errado → mensagem; 403 em ações não autorizadas.
- Critério: nenhum fallback silencioso em produção.

### 6.C — Checklist de segurança final
- IDORs fechados (usuários, habilidades, projetos); rate limit ativo; senhas hasheadas; JWT sem fallback; CORS restrito; sem segredos no git (`.env` no `.gitignore`).
- Critério: checklist 100%.

---

## FASE-07 — DOCUMENTAÇÃO E COMMITS

### 7.A — Docs
- `docs/api.md` completo; `README.md` (setup, credenciais de teste, deploy); `RELATORIO_FINALIZACAO` atualizado com resultados.
### 7.B — Commits PT-BR por fase
- `feat(api): ...`, `fix(api): ...`, `feat(web): ...` — um commit por fase, mensagem em PT-BR, sem código quebrado (type-check+build+testes antes).
### 7.C — Push e entrega
- `git push` (backend + frontend) sob comando explícito; relatório final de entrega.

---

## TABELA DE DELEGAÇÃO (subagentes por lote)

| Lote | Fases | Agents | Descrição |
|---|---|---|---|
| 1 | FASE-01 (1.A–1.K) | 4 | Correções críticas backend (contrato, IDOR, habilidades, segurança) |
| 2 | FASE-02 (2.A–2.E) | 2–3 | Novos endpoints (reputação, notificações) |
| 3 | FASE-03 (3.A–3.H) | 4 | Integração frontend (candidaturas, mural, perfil, projetos) |
| 4 | FASE-04 (4.A–4.G) | 3–4 | Frontend real (reputação, notificações, dashboard, senha) |
| 5 | FASE-05 (5.A–5.D) | 3 | Testes, lint, healthcheck, seed |
| 6 | FASE-06 | 0 (principal) | Validação navegador + segurança |
| 7 | FASE-07 | 0 (principal) | Docs + commits PT-BR |

---

## DEFINITION OF DONE (checklist final)

- [ ] Todos os 🔴 CRÍTICOS resolvidos (B1–B7, F1–F4)
- [ ] Todos os 🟠 ALTO resolvidos (A1–A16)
- [ ] Backend `npm test` verde (suíte criada)
- [ ] Frontend `npm test` verde
- [ ] `npm run build` + `npx tsc --noEmit` + `npm run lint` sem erros
- [ ] Navegador: fluxo completo E2E persistindo entre reloads
- [ ] Sem mocks em produção (dados 100% da API)
- [ ] Segurança: sem IDOR, rate limit ativo, senhas hasheadas, JWT sem fallback
- [ ] `docs/api.md` + README atualizados
- [ ] Commits PT-BR por fase, push autorizado