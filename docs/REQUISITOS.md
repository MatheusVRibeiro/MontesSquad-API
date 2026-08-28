# Análise de Requisitos — MontesSquad-API (Backend)

> **Propósito deste arquivo:** dar à IA (ou qualquer dev novo) o contexto COMPLETO do produto antes de tocar no código. Leia antes de qualquer tarefa. Complementa o GUIA_DESENVOLVEDOR.md (foco técnico); aqui o foco é PRODUTO + REQUISITOS.
> Última atualização: 2026-08-28

---

## 1. Visão Geral

**Objetivo do projeto:** API REST do **MontesSquad** — plataforma de formação de squads e projetos colaborativos com integração profunda ao GitHub. O produto conecta pessoas a projetos reais, organiza a contribuição (kanban com tasks, vagas por função, candidaturas direcionadas) e transforma entregas verificáveis (commits, PRs mergeados) em portfólio e reputação profissional. Princípio de produto: *"O MontesSquad deve conectar pessoas a projetos reais, organizar a contribuição e transformar entregas verificáveis em reputação profissional."*

**Público-alvo / usuários:** Desenvolvedores (candidatos a squads), donos de projetos, e visitantes (perfis/portfólios públicos). Consumido pelo frontend `squad-hub` (TanStack Start).

**Tipo:** API REST (plataforma SaaS de squads + GitHub) — TCC.

**Status:** ativo em desenvolvimento — 17 de 19 etapas do plano de evolução concluídas (ETAPAS 0–17); ETAPA 18 (segurança + regressão + E2E) em validação. Suíte: 383/383 testes (52 arquivos).

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Linguagem | JavaScript (Node.js) | — |
| Framework | Express | ^4.21.2 |
| Banco de dados | MySQL (Hostinger em produção; pool stubado nos testes) | — |
| ORM | nenhum (SQL direto via mysql2) | ^3.12.0 |
| Autenticação | JWT (jsonwebtoken, 8h) + bcryptjs; GitHub OAuth (state anti-CSRF) | ^9.0.3 / ^3.0.3 |
| Testes | Vitest + supertest (pool MySQL mockado) | ^4.1.10 / ^7.2.2 |
| Deploy | Hostinger (BD remoto); porta 3333 | — |
| Outros | @octokit/rest + @octokit/app + @octokit/webhooks (GitHub App), nodemailer (e-mail), express-rate-limit (MemoryStore), cors, dotenv | ^22.0.1 / ^16.1.4 / ^14.2.0 / ^9.0.5 / ^7.5.1 |

*Versões reais do package.json — nunca inventar.*

---

## 3. Atores / Papéis

| Ator | Descrição | Permissões principais |
|------|-----------|----------------------|
| Membro (usuário comum) | Desenvolvedor com conta local ou via GitHub | Criar projeto, candidatar-se a vagas, assumir/abandonar tasks, contribuir (commits/PRs), ver portfólio/reputação, matching |
| Dono do projeto (owner) | Criador de um projeto | CRUD de vagas, aprovar/rejeitar candidaturas, remover/reatribuir responsável, sair bloqueado, visibilidade/privacidade do projeto |
| Membro do squad | Usuário aprovado em projeto | Kanban do projeto, tasks recomendadas, timeline, rankings do projeto |
| Visitante | Não autenticado | Ver projetos/perfis/portfólios públicos (fail-closed para dados privados) |
| ADM | Conta administrativa (seed `admin@email.com`) | Gestão de usuários |

---

## 4. Requisitos Funcionais (RF)

> Formato: `RF-01` — <título> — <descrição do comportamento esperado, mensurável>

### Módulo: Autenticação e identidade (ETAPAS 1–2)
- **RF-01** — Cadastro/login local — `POST /login` (token JWT na raiz da resposta) e cadastro por e-mail/senha (bcryptjs); recuperação/reset de senha por token (expiração 15 min, e-mail via nodemailer).
- **RF-02** — Login/cadastro com GitHub OAuth — `GET /auth/github` → `GET /auth/github/callback` → `POST /auth/github/complete-profile`; `state` anti-CSRF; token GitHub só no backend; usuário novo entra em onboarding (CompleteProfile).
- **RF-03** — Conta existente com mesmo e-mail — não vincula automaticamente: exige login local para confirmar o vínculo (fluxo "email-exists").
- **RF-04** — Conectar/desconectar GitHub — `GET /github/me`, `GET /github/connect`, `DELETE /github/disconnect`; GitHub ID já vinculado a outra conta → 409; desconexão bloqueada se for o único método de login (exige senha local antes).

### Módulo: Perfil técnico (ETAPA 3)
- **RF-05** — Perfil completo — bio, localização, tecnologias com nível por tecnologia, funções de interesse (9 funções seed em `funcoes`/`funcoes_usuario`), disponibilidade semanal, objetivo profissional; `perfil_completo` calculado no backend; `GET/PATCH /usuarios/me/perfil`, `PUT /usuarios/me/funcoes`, `PUT /usuarios/me/habilidades`.

### Módulo: Projetos, vagas e candidaturas (ETAPAS 4–6)
- **RF-06** — Vagas por função — CRUD em `/projetos/:projetoId/vagas` (somente owner); `vagas_projeto` com quantidade, nível desejado, status aberta/fechada; DELETE bloqueado com membros vinculados.
- **RF-07** — Candidatura direcionada — `POST /projetos/:projetoId/candidaturas` com `vaga_id`; validações: vaga do projeto (400), vaga aberta (400), duplicada (409), não-candidatar ao próprio projeto, membro não recandidata; aprovação incrementa `preenchidas` e fecha vaga lotada (transacional).
- **RF-08** — Função do membro — `membros_equipe` com `funcao_id`/`vaga_id` e soft-state (`ativo`/`saiu`/`removido`); `POST /projetos/:projetoId/sair` (owner bloqueado); saída libera a vaga.

### Módulo: Tasks e Kanban (ETAPAS 7–10)
- **RF-09** — Tasks com habilidades e dificuldade — `habilidades_tarefa` + `tarefas.dificuldade` (iniciante/intermediaria/avancada); payload de criação/edição com `habilidades[]`.
- **RF-10** — Task assumível com concorrência segura — `POST .../tarefas/:tarefaId/assumir` com UPDATE atômico `WHERE responsavel_id IS NULL`; `affectedRows=0` → 409 "Esta tarefa já foi assumida".
- **RF-11** — Abandonar/remover/reatribuir — endpoints dedicados com histórico em `historico_responsaveis_tarefa` (assumiu/abandonou/removido/reatribuido/concluiu); abandono só pelo responsável; remoção/reatribuição só pelo owner; reatribuição exige membro ativo.
- **RF-12** — Histórico permanente — soft-delete de tarefas (`excluida_em`); listagem filtra excluídas; contribuições históricas permanecem após saída do projeto.

### Módulo: GitHub-Kanban (base das ETAPAS 8/13)
- **RF-13** — GitHub App + webhook — conexão de repositório ao projeto, webhook seguro e idempotente (chave_idempotencia), identidade GitHub do usuário, branch gerada por task.
- **RF-14** — Automação do Kanban via PR — push registra commits vinculados à task; PR mergeado → task `done`; XP autoritativo calculado no backend; timeline técnica da tarefa; notificações de PR.

### Módulo: Portfólio e reputação (ETAPAS 11–12)
- **RF-15** — Portfólio verificável — `GET /usuarios/:id/portfolio` (público): projetos + função + tasks verificadas + commits + PRs mergeados + tecnologias + contribuições.
- **RF-16** — Reputação técnica separada do XP — `reputacao_tecnica_usuario` (score DECIMAL calculado SÓ no backend: pesos 50/30/1/20 — task verificada/PR mergeado/commit/projeto com entrega); subir XP não altera reputação.

### Módulo: Rankings (ETAPA 13)
- **RF-17** — Top Committers / Top Contributors — `GET /rankings/committers` e `/rankings/contributors` (globais e por projeto, filtros `?periodo=30d&limit=10`); ponderação: commit +1, PR aberto +5, PR mergeado +30, task verificada +50, com teto anti-manipulação por task.

### Módulo: Privacidade (ETAPA 14)
- **RF-18** — Projetos privados — `projetos.visibilidade ENUM('publico','privado')` + `permitir_portfolio_publico`; não-membro de projeto privado não vê branch/commit/PR/URLs (fail-closed); portfólio público marca `privado:true` e oculta contribuições.

### Módulo: Timeline (ETAPA 15)
- **RF-19** — Timeline de eventos — `eventos_projeto` + `GET /projetos/:projetoId/eventos` (membro/dono, LIMIT 50, DESC); eventos: membro_entrou/saiu, task_criada/assumida/abandonada/concluida, commit_detectado, pr_aberto/mergeado.

### Módulo: Matching (ETAPAS 16–17)
- **RF-20** — Matching Desenvolvedor ↔ Projeto — `GET /matching/projetos`: score 0–100 determinístico e explicável (40% habilidades / 25% função / 15% nível / 10% disponibilidade / 10% outras; retorna `explicacao[]` em PT-BR; Σ pontos = score); exclui projetos onde já é membro/dono.
- **RF-21** — Matching Desenvolvedor ↔ Task — `GET /projetos/:projetoId/tasks/recomendadas`: recomenda só tasks livres/não excluídas com compatibilidade + motivos; **não bloqueia** assunção manual (recomendação, não autorização).

### Módulo: Infraestrutura
- **RF-22** — Mural e notificações — CRUD do mural do projeto e notificações (inclui `POST /notificacoes/ler-tudo`).
- **RF-23** — Healthcheck — `GET /health` → `{ sucesso: true, banco: "ok" | "erro" }` sem derrubar o boot.

---

## 5. Requisitos Não-Funcionais (RNF)

| Código | Categoria | Requisito |
|--------|-----------|-----------|
| RNF-01 | Segurança | Autorização SEMPRE no backend (nunca confiar no frontend); IDOR bloqueado em projetos/tasks/vagas (403/404); state anti-CSRF no OAuth; token GitHub nunca no frontend |
| RNF-02 | Segurança | Rate limit nas rotas públicas sensíveis (10 req/15min por IP, MemoryStore — ok para 1 instância); logs sem secrets; payloads minimizados |
| RNF-03 | Segurança | Webhook GitHub idempotente (chave_idempotencia) — replay não duplica eventos/XP |
| RNF-04 | Confiabilidade | Operações críticas transacionais (aprovação de candidatura, assumir task, protocolo de vaga); UPDATE atômico contra race condition |
| RNF-05 | Qualidade | 383 testes (vitest + supertest, pool MySQL stubado); cada etapa tem suíte funcional + suíte de segurança; lint obrigatório no gate |
| RNF-06 | Usabilidade | API em PT-BR (mensagens, `explicacao[]` do matching); envelope `{sucesso, dados}`; respostas 409/400/403 com mensagens acionáveis |
| RNF-07 | Portabilidade | Porta 3333 configurável; BD via `.env` (Hostinger em produção); `npm run db:*` aplica migrações por etapa |
| RNF-08 | Privacidade | Fail-closed para dados de repositórios privados; tokens nunca em logs; URL privada não exposta a não-membros |
| RNF-09 | Processo | Uma etapa por vez (gate de conclusão obrigatório — 10 itens); commits em PT-BR (Conventional Commits); nunca pular etapa |

---

## 6. Regras de Negócio

> As regras que o sistema DEVE respeitar (o "contrato" do domínio).

1. **RN-01** — XP e reputação técnica são conceitos separados: subir XP NUNCA altera a reputação técnica (score calculado só no backend, nunca por valor vindo do frontend).
2. **RN-02** — Nenhum score/ranking pode ser manipulado por duplicidade: eventos de XP usam chave_idempotencia; teto de pontos por commits na mesma task.
3. **RN-03** — Contribuições históricas permanecem após saída: sair/remover do squad não apaga portfólio nem métricas (soft-state `ativo/saiu/removido`, nunca DELETE físico que destrua histórico).
4. **RN-04** — Dois usuários clicando simultaneamente NUNCA assumem a mesma task (UPDATE atômico `responsavel_id IS NULL`; perdedor recebe 409).
5. **RN-05** — Conta criada via GitHub não pode desconectar o GitHub sem antes criar senha local (evita conta sem método de login).
6. **RN-06** — GitHub ID já vinculado a outra conta → 409 (duplicate OAuth account rejeitado).
7. **RN-07** — Matching é recomendação, não autorização: score baixo não bloqueia assunção manual de task nem candidatura.
8. **RN-08** — Ranking global considera SOMENTE eventos vinculados a projetos/tasks do MontesSquad.
9. **RN-09** — Projetos privados: visitante e não-membro não recebem dados técnicos privados pela API (fail-closed).
10. **RN-10** — Aprovação de candidatura atualiza ocupação da vaga transacionalmente; vaga lotada é fechada automaticamente.

---

## 7. Integrações Externas

| Integração | Para quê | Como (API/Webhook/SDK) |
|------------|----------|------------------------|
| GitHub (App + OAuth) | Login OAuth, commits, PRs, merge, identidade do usuário | @octokit/rest + @octokit/app + @octokit/webhooks (webhook com secret) |
| MySQL Hostinger | Banco de dados principal | mysql2 (pool; stubado nos testes) |
| SMTP (Mailtrap em dev) | E-mail de recuperação de senha | nodemailer (SMTP_HOST/USER/PASSWORD no `.env`) |
| squad-hub (frontend) | Único consumidor web da API | REST/JSON com JWT |

---

## 8. Fluxos Principais (User Stories resumidas)

- **Como desenvolvedor, eu quero me cadastrar com GitHub, para** entrar na plataforma sem criar mais uma senha.
  - Fluxo: "Continuar com GitHub" → OAuth → callback (state validado) → onboarding CompleteProfile → resultado: conta criada com `cadastro_origem='github'`.
- **Como dono de projeto, eu quero definir vagas por função, para** formar o squad certo.
  - Fluxo: criar projeto → `POST /projetos/:id/vagas` (2 Backend, 1 QA) → candidaturas direcionadas chegam com a vaga → aprovo → `preenchidas` incrementa → resultado: squad formado com papéis claros.
- **Como membro, eu quero assumir uma task adequada às minhas habilidades, para** contribuir onde tenho afinidade.
  - Fluxo: `GET /projetos/:id/tasks/recomendadas` (compat 95%, motivos) → `POST .../assumir` → branch gerada → commits/PR no GitHub → webhook → PR mergeado → task `done` → resultado: XP + reputação + portfólio atualizados.
- **Como visitante, eu quero ver o portfólio de um desenvolvedor, para** avaliar sua experiência real.
  - Fluxo: `GET /usuarios/:id/portfolio` → projetos + tasks verificadas + PRs mergeados (privados ocultados) → resultado: evidência profissional verificável.

---

## 9. Fora de Escopo / Restrições

- **GitHub App real ainda não configurado** — envs `GITHUB_*` vazias no `.env.example`; E2E ponta a ponta (push/PR/merge real) depende dele; testes usam pool stubado + mocks.
- **SMTP real pendente** — sem `SMTP_*` reais o e-mail de recuperação não é enviado (log "Configuração SMTP ausente").
- **Rate limit em memória (MemoryStore)** — ok para 1 instância; multi-instância exigiria store compartilhado (ex.: Redis).
- **Sem ORM** — SQL direto via mysql2; migrações por scripts (`scripts/migrar_*.js`, `npm run db:etapaN`).
- **Matching sem IA no MVP** — score determinístico com pesos documentados; IA só se regras forem insuficientes.
- **ETAPA 18 em andamento** — validação final de segurança/regressão/E2E (3 subagentes) ainda em consolidação.
- **Não expor segredos** — `.env` no `.gitignore`; nunca commitar credenciais reais.

---

## 10. Referências

- `docs/PLANO_EVOLUCAO_PRODUTO_MONTESQUAD.md` — fonte principal: 19 etapas (0–18) com objetivos, banco, endpoints, regras e gates
- `docs/RELATORIO_EVOLUCAO_PRODUTO.md` — status real das etapas (17/19 concluídas, hashes de commits, suítes)
- `docs/IMPLEMENTACAO_GITHUB_KANBAN.md` — plano base do GitHub-Kanban (ETAPAS 8/13)
- `docs/api.md` — 32 seções de endpoints (cobertura de todas as etapas)
- `docs/RELATORIO_AUDITORIA_SEGURANCA.md`, `docs/RELATORIO_QA_COMPLETO.md` — auditorias
- `README.md` — como rodar, credenciais de seed, autenticação
- Repos irmãos: `../squad-hub` (frontend TanStack Start)
