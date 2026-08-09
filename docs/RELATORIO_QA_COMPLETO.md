# 🧪 Relatório QA Completo — MontesSquad (2026-08-09)

Skills usadas: **dogfood** (QA exploratório navegador) + **playwright-skill** (automação browser local). 3 subagents via API (funcional, integração, negócio). **Fluxos testados: 25/25 OK no backend + 10 telas no navegador.**

## Resultado por área

| Área | Resultado |
|---|---|
| **Navegador (Playwright)** | ✅ 10/10 OK — login, dashboard, explorar, busca, detalhe projeto, abas (Mural/Membros/Atividade/Recomendadas), perfil, modo escuro, criar projeto, notificações, logout |
| **QA Funcional (API, 16 fluxos)** | ✅ 16/16 OK — cadastro, recuperar senha, logout, projeto, vaga, task, mural, matching, recomendações, timeline, notificações, portfólio, reputação, rankings, privacidade, github status |
| **QA Negócio (API, 2 usuários)** | ✅ 9/9 OK — candidatura→membro, vaga incrementa, assumir task, **race condition (1 vence/409)**, XP idempotente, sair (ex-membro 403), remover membro, abandonar, notificações |
| **QA Integração (FE↔BE)** | ⚠️ **2 CRÍTICO · 3 ALTO · 4 MÉDIO · 3 BAIXO** |

## 🐛 Bugs encontrados (integração FE↔BE)

### 🔴 CRÍTICO
| # | Bug | Evidência |
|---|---|---|
| C1 | **ETAPA 17 quebrada**: backend `taskMatching.js` devolve `dados:{recomendacoes:[]}`; frontend `taskMatching.ts:88` valida `Array.isArray(data.dados)` → **aba "Recomendadas" sempre em erro** | `taskMatching.ts:88` vs `taskMatching.js:50` — confirmado live |
| C2 | **Mutações Kanban + Encerrar projeto com fallback localStorage silencioso em PROD** — `catch{}` grava localStorage e mostra toast "sucesso" com escrita **nunca persistida** | `projectDetail.ts:473-643,706-716` + `KanbanBoard.tsx:226,249,452,483` |

### 🟠 ALTO
| # | Bug | Evidência |
|---|---|---|
| A1 | `projetos.$id` sem card de erro → **skeleton infinito** em falha da API | `projetos.$id.tsx:270` |
| A2 | **Permissão por nome persiste**: `meus-projetos.tsx:21` (`createdBy === user.name`), `projetos.$id.tsx:203` (`applications.find(name===)`) | quebra com homônimos |
| A3 | **`signOut` não chama `POST /logout`** — token não revogado no servidor (pós-auditoria A1) | AuthContext.tsx |

### 🟡 MÉDIO
| # | Bug | Evidência |
|---|---|---|
| M1 | Dashboard **mascara erros de query** (mostra "Level 1"/"0 projetos"/XP 0 como se reais) | dashboard.tsx |
| M2 | **`getPortfolio("me")` → 404** — rota pública sem alias "me" (só reputação trata); quebra se perfil chamar com `me` | `portfolio.ts:128` vs `portfolio.js` (confirmado live 404) |
| M3 | `permitirPortfolioPublico` number vs boolean; `KanbanStatus` sem `'review'` | `projectDetail.ts:348` vs backend |

### 🔵 BAIXO
| # | Bug | Evidência |
|---|---|---|
| B1 | `membersCount` no GET /projetos/:id soma `COUNT+1` → mostra sempre 1 a mais | projetos.js |
| B2 | Código morto: `getVagasProjeto`, `requestProjectJoin` (setTimeout falso) | vagas.ts, projects.ts |
| B3 | Resetar senha com token inválido vaza `"jwt malformed"` no campo `dados` | usuarios.js |

## ✅ Corrigido durante o QA
- **UI/UX**: botão "Continuar com GitHub" movido para **abaixo** do botão "Entrar" (padrão correto) — verificado no navegador (`login.tsx`)

## 📋 Pendências de produção (conhecidas)
- GitHub App real (envs GITHUB_*) p/ E2E ponta a ponta
- SMTP Mailtrap (recuperar senha não envia e-mail real)
- Rate limit por-processo (MemoryStore — ok p/ 1 instância)