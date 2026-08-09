# 🔒 Relatório de Auditoria de Segurança — MontesSquad (2026-08-09)

Auditoria completa com skills de recon (hunt-session, hunt-oauth, hunt-auth-bypass, hunt-brute-force, hunt-idor, hunt-write-gap, hunt-sqli, hunt-nodejs, hunt-xss, hunt-cors, security-arsenal) + triage-validation (7-Question Gate). Testes reais contra API (porta 3333, BD Hostinger) + análise estática. **Nenhum código modificado durante a auditoria.**

## Resumo executivo

**0 CRÍTICO · 4 ALTO · 10 MÉDIO · 15 BAIXO**

Pontos fortes confirmados: **SQLi zero** (216/216 queries parametrizadas), prototype pollution zero, RCE/path traversal zero, anti-enumeração no login/recuperar-senha, bcrypt cost 10, rate limit à prova de spoofing XFF, CORS whitelist correta, JWT_SECRET 256 bits, `.env` fora do git.

---

## 🔴 ALTO (4)

| # | Achado | Evidência | Fix |
|---|--------|-----------|-----|
| A1 | **Sessão JWT sem revogação + sem logout + token sobrevive a troca de senha/disconnect** — primitiva de ATO persistente | Sem rota `/logout`; `verificarToken` stateless (sem denylist/jti); token emitido antes da troca de senha continuou válido (200); após disconnect também | Rota `/logout` + denylist de `jti` checada no `verificarToken`; invalidar tokens na troca de senha e no disconnect; `exp` curto |
| A2 | **Ex-membro (`saiu`/`removido`) mantém acesso de leitura E escrita ao projeto** | `auth.js:161-162` não filtra `status='ativo'`; roberto após sair: GET 200 em tarefas/mensagens/vagas/eventos + criou tarefa, postou mensagem, editou tarefa | Middleware `somenteMembroOuDonoDoProjeto` filtrar `AND status='ativo'` |
| A3 | **IDOR write em `/habilidades-projeto`** — checagem de dono no objeto errado | `PATCH/DELETE /habilidades-projeto/:id` valida `params.id` mas controller usa `projeto_id` do body → lucas deletou habilidade do projeto da fernanda | Validar dono pelo `projeto_id` REAL (do body/registro), não pelo `params.id` |
| A4 | **IDOR write em `/habilidades-usuario`** — `usuario_id` vem do body | lucas inseriu/alterou/removeu habilidades do perfil de fernanda (POST/PATCH/DELETE → 200) | Usar `request.usuarioAutenticado.id` (nunca do body) |
| A5 | **Backdoor `tempLogin` no frontend** — botão "visitante temporário" sem gate de ambiente, presente no bundle de produção | `AuthContext.tsx:148`, `login.tsx:160-177`; confirmado via `grep tempLogin dist/client/*.js` + PoC navegador | Remover backdoor ou gate `import.meta.env.DEV` estrito |

## 🟠 MÉDIO (10)

| # | Achado | Fix |
|---|--------|-----|
| M1 | Token de sessão em query string na redirect pós-callback GitHub (`?token=`) → vazamento via Referer/histórico | Entregar via fragment (`#token`) ou cookie HttpOnly |
| M2 | Rate limit compartilhado entre `/login`, `/recuperar-senha`, `/resetar-senha`, `/usuarios` (1 bucket 10/15min) + sem `trust proxy` → DoS | Instância por rota; `trust proxy` correto atrás de proxy |
| M3 | Vazamento de detalhes internos no error handler (`NODE_ENV` ausente = modo dev; `dados` ecoa `originalErr.message`) | Definir `NODE_ENV=production`; não ecoar detalhes internos |
| M4 | Webhook GitHub inoperante + 500 vazando detalhe interno (`GITHUB_WEBHOOK_SECRET` ausente; `getWebhookSecret()` roda antes da checagem de assinatura) | Reordenar (checar assinatura antes do secret); 503 genérico; configurar secret |
| M5 | Vazamento de mensagens de erro internas (message sempre retorna `err.message`) | Em produção, mensagem genérica; logar detalhes no servidor |
| M6 | Dependências vulneráveis backend — `npm audit`: nodemailer HIGH (CRLF/SSRF), qs moderate (DoS), body-parser low | `npm audit fix`; atualizar nodemailer |
| M7 | `GET /usuarios` expõe email+tipo de todos (13 usuários) a qualquer autenticado | Remover email/tipo da listagem (ou exigir adm) |
| M8 | `GET /projetos/:id/membros` expõe email/bio/localização a qualquer autenticado (mesmo projeto privado) | Remover campos sensíveis; exigir vínculo |
| M9 | Mass assignment: `PATCH /projetos/:id` aceita `criador_id` (transferiu projeto) | Remover `criador_id` do allowlist de edição |
| M10 | Projeto privado vaza vagas (descrição/função/nível) para não-membros | Ocultar vagas de não-membros em projeto privado |
| M11 | Frontend: token de sessão GitHub + token de reset em query string (`?token=`) | Fragment/cookie; limpar da URL |
| M12 | Frontend `npm audit`: 13 vulns (11 high) — axios 1.16.1 (prototype pollution, auth injection, DoS) | `npm audit fix`; atualizar axios |

## 🟡 BAIXO (15)

Enumeração de e-mail via cadastro (409 "E-mail já cadastrado") · `jwt.verify` sem `algorithms`/sem exigir `exp` · Headers de segurança ausentes + `X-Powered-By: Express` · API bound em `0.0.0.0` sem TLS · Token de reset reutilizável · Troca de senha sem senha atual/MFA · Política de senha fraca (6 chars) · OAuth: state não vinculado a sessão server-side; race `ER_DUP_ENTRY` no callback · Membro pode setar `responsavel_id` arbitrário (concede XP) · `GET /github/installations/:id/repositories` sem validação de vínculo · `/usuarios/:id/reputacao-tecnica` visível a qualquer autenticado · Sem rate limit em rotas autenticadas · Token JWT em localStorage (amplificador de XSS) · Sem CSP no SSR · `sha1=` aceito no webhook (downgrade cosmético)

---

## Plano de correção (fase 3)

| Lote | Escopo | Arquivos |
|---|---|---|
| 1 | **Backend auth/sessão** (A1, M1, B-jwt) | `middlewares/auth.js`, `routes.js`, `controllers/githubAuth.js`, `controllers/usuarios.js` |
| 2 | **Backend autorização** (A2, A3, A4, M7, M8, M9, M10) | `middlewares/auth.js`, `controllers/habilidades*.js`, `controllers/projetos.js`, `controllers/usuarios.js`, `controllers/membros.js` |
| 3 | **Backend infra** (M2, M3, M4, M5, M6) | `index.js`, `services/githubWebhook.js`, `routes.js`, `package.json` |
| 4 | **Frontend** (A5, M11, M12) | `AuthContext.tsx`, `login.tsx`, `auth.github.success.tsx`, `complete-profile.tsx`, `resetar-senha.tsx`, `package.json` |