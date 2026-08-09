import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { buildApp, criarPoolFake, tokenPara, setEnvAmbiente } from "./helpers/bootstrap.js";

setEnvAmbiente();
process.env.GITHUB_APP_ID = "123";
process.env.GITHUB_PRIVATE_KEY = "key-mock";
process.env.GITHUB_WEBHOOK_SECRET = "segredo-teste-e2e";

// ── Mock completo do fluxo GitHub (githubApp + banco) ──
const { Module } = await import("node:module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "../services/githubApp" || request.endsWith("services/githubApp")) {
    return {
      getRepositoryById: async () => ({ id: 100, full_name: "empresa/repo", default_branch: "main", html_url: "https://github.com/empresa/repo" }),
      listInstallationRepositories: async () => [],
    };
  }
  return originalLoad.apply(this, arguments);
};

// Estado simulado do banco para o cenário B (fluxo completo)
const estado = {
  tasks: new Map(),
  prs: new Map(),
  commits: [],
  xp: [],
  eventosXpChaves: new Set(),
};

function criarPool() {
  return criarPoolFake([
    // middlewares
    { match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql), resposta: () => [[{ criador_id: 5 }], []] },
    { match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo' limit 1$/.test(sql), resposta: (params) => (params[1] === 99 ? [[], []] : [[{ id: 1 }], []]) },
    // webhook delivery
    { match: (sql) => /^insert ignore into github_webhook_deliveries/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => /^select processado from github_webhook_deliveries where delivery_id = \? limit 1$/.test(sql), resposta: (params) => (estado.xp.length > 0 && params[0] === "dup-38" ? [[{ processado: true }], []] : [[], []]) },
    { match: (sql) => /^update github_webhook_deliveries set processado = true/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    // conectar repository (ETAPA 5)
    { match: (sql) => /^select id, titulo from projetos where id = \?$/.test(sql), resposta: () => [[{ id: 1, titulo: "Projeto" }], []] },
    { match: (sql) => /^update projetos set github_repository_id/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => /^select github_repository_id, github_repository_full_name/.test(sql), resposta: () => [[{ github_repository_id: 100, github_repository_full_name: "empresa/repo", github_installation_id: 5, github_default_branch: "main", github_connected_at: new Date(), repositorio_url: "https://github.com/empresa/repo" }], []] },
    // assumir task (ETAPA 7)
    { match: (sql) => /^update tarefas set responsavel_id = \?, status = 'doing', assumida_em = now\(\) where id = \? and projeto_id = \? and responsavel_id is null$/i.test(sql), resposta: (params) => {
        if (estado.tasks.get(38)?.responsavel) return [{ affectedRows: 0 }, []];
        estado.tasks.set(38, { ...estado.tasks.get(38), responsavel: params[0], status: "doing" });
        return [{ affectedRows: 1 }, []];
      } },
    { match: (sql) => /^select id, responsavel_id from tarefas where id = \? and projeto_id = \? limit 1$/.test(sql), resposta: () => [[{ id: 38, responsavel_id: 2 }], []] },
    // ETAPA 9: histórico de responsáveis (acao='assumiu' após assumir)
    { match: (sql) => /^insert into historico_responsaveis_tarefa \(tarefa_id, usuario_id, acao, realizado_por\) values \(\?, \?, \?, \?\)$/.test(sql), resposta: () => [{ insertId: 1, affectedRows: 1 }, []] },
    { match: (sql) => /^select github_repository_id from projetos where id = \? limit 1$/.test(sql), resposta: () => [[{ github_repository_id: 100 }], []] },
    { match: (sql) => /^select id, titulo from tarefas where id = \? limit 1$/.test(sql), resposta: () => [[{ id: 38, titulo: "Criar API" }], []] },
    { match: (sql) => /^update tarefas set github_branch = \? where id = \? and projeto_id = \?$/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => /^select t\.id, t\.titulo, t\.status, t\.github_branch, t\.assumida_em/.test(sql), resposta: () => [[{ id: 38, titulo: "Criar API", status: "doing", github_branch: "task/38-criar-api-de-login", assumida_em: new Date(), github_pr_number: null, github_pr_status: null, github_last_activity_at: null, completion_source: null, completed_at: null, responsavel_nome: "Lucas" }], []] },
    // push (ETAPA 8)
    { match: (sql) => /^select t\.id, t\.projeto_id, t\.titulo, t\.status, t\.responsavel_id, t\.github_branch from tarefas t join projetos p/.test(sql) && /t\.github_branch = \?/.test(sql), resposta: () => [[{ id: 38, projeto_id: 1, titulo: "Criar API", status: "doing", responsavel_id: 2, github_branch: "task/38-criar-api-de-login" }], []] },
    { match: (sql) => /^insert ignore into github_commits/.test(sql), resposta: (params) => {
        const sha = params[3];
        if (estado.commits.includes(sha)) return [{ affectedRows: 0 }, []];
        estado.commits.push(sha);
        return [{ affectedRows: 1 }, []];
      } },
    { match: (sql) => /^update tarefas set github_last_activity_at = now\(\)/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    // PR (ETAPA 9)
    { match: (sql) => /^insert into github_pull_requests/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    // PR aberto → status 'review' (atualizarTaskPorPR)
    { match: (sql) => /^update tarefas set github_pr_id = \?, github_pr_number = \?, github_pr_url = \?, github_pr_status = \?, status = 'review'/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => /^select id, status, concluida_via, github_pr_id, responsavel_id from tarefas/.test(sql), resposta: (params) => {
        const t = estado.tasks.get(38) || { status: "review", concluida_via: null, github_pr_id: null, responsavel_id: 2 };
        return [[{ id: 38, status: t.status, concluida_via: t.concluida_via, github_pr_id: t.github_pr_id || null, responsavel_id: t.responsavel_id ?? 2 }], []];
      } },
    // PR merged → done (concluirTaskPorMerge)
    { match: (sql) => /^update tarefas set github_pr_id = \?, github_pr_number = \?, github_pr_url = \?, github_pr_status = 'merged'/.test(sql), resposta: (params) => {
        estado.tasks.set(38, { ...estado.tasks.get(38), status: "done", concluida_via: "github_merge", github_pr_id: params[0] });
        return [{ affectedRows: 1 }, []];
      } },
    { match: (sql) => /^github_pr_status = 'closed'/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    // XP (ETAPA 10)
    { match: (sql) => /^insert ignore into eventos_xp/.test(sql), resposta: (params) => {
        const chave = params[4];
        if (estado.eventosXpChaves.has(chave)) return [{ affectedRows: 0 }, []];
        estado.eventosXpChaves.add(chave);
        return [{ affectedRows: 1 }, []];
      } },
    { match: (sql) => /^select xp, nivel from estatisticas_usuario/.test(sql), resposta: () => [[{ xp: 150, nivel: 1 }], []] },
    { match: (sql) => /^insert into estatisticas_usuario \(usuario_id, xp, nivel\)/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => /^update estatisticas_usuario set nivel = floor\(xp \/ 250\) \+ 1/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    // notificações
    { match: (sql) => /^insert into notificacoes/.test(sql), resposta: () => [{ insertId: 1, affectedRows: 1 }, []] },
    { match: (sql) => /^select id, usuario_id, tipo, titulo, descricao, lida, link, criado_em from notificacoes/.test(sql), resposta: () => [[{ id: 1, usuario_id: 2, tipo: "github", titulo: "T", descricao: "D", lida: 0, link: "/projetos/1", criado_em: "2026-01-01" }], []] },
    // rankings
    { match: (sql) => /^select\s+u\.id as userid/.test(sql), resposta: () => [[], []] },
    // timeline
    { match: (sql) => /^select sha, message, author_name, commit_url, committed_at from github_commits where tarefa_id/.test(sql), resposta: () => [[], []] },
    { match: (sql) => /^select numero, url, estado, mergeado_em from github_pull_requests where tarefa_id/.test(sql), resposta: () => [[], []] },
    { match: (sql) => /^update tarefas set\s+github_repository_id = null/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
  ]);
}

function assinar(payload) {
  const raw = JSON.stringify(payload);
  const sig = "sha256=" + crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET).update(raw, "utf8").digest("hex");
  return { raw, sig };
}

describe("E2E GitHub-Kanban (ETAPA 18)", () => {
  let app;
  const token = tokenPara({ id: 5, email: "admin@email.com", nome: "Admin", tipo: "adm" });
  const tokenLucas = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
  const tokenRoberto = tokenPara({ id: 3, email: "roberto@email.com", nome: "Roberto" });

  beforeEach(() => {
    vi.clearAllMocks();
    estado.tasks.clear();
    estado.commits = [];
    estado.eventosXpChaves.clear();
    app = buildApp(criarPool());
  });

  it("Cenário B: projeto conectado → task → assumir → branch → push → PR → merge → done → XP 1x", async () => {
    // 1. Conectar repositório (owner)
    const conectar = await request(app)
      .post("/projetos/1/github/repository")
      .set("Authorization", `Bearer ${token}`)
      .send({ installationId: 5, repositoryId: 100 });
    expect(conectar.status).toBe(200);
    expect(conectar.body.dados.github_repository_full_name).toBe("empresa/repo");

    // 2. Assumir task → branch gerada
    const assumir = await request(app)
      .post("/projetos/1/tarefas/38/assumir")
      .set("Authorization", `Bearer ${tokenLucas}`);
    expect(assumir.status).toBe(200);
    expect(assumir.body.dados.github_branch).toBe("task/38-criar-api-de-login");

    // 3. Webhook push → commit salvo
    const push = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "e2e-push-1")
      .set("X-GitHub-Event", "push")
      .set("X-Hub-Signature-256", assinar({ ref: "refs/heads/task/38-criar-api-de-login", repository: { id: 100 }, commits: [{ id: "abc123", message: "feat: x", author: { name: "Matheus", username: "MatheusVRibeiro", email: "m@x.com" }, timestamp: "2026-08-08T10:00:00Z", url: "https://c" }] }).sig)
      .send(assinar({ ref: "refs/heads/task/38-criar-api-de-login", repository: { id: 100 }, commits: [{ id: "abc123", message: "feat: x", author: { name: "Matheus", username: "MatheusVRibeiro", email: "m@x.com" }, timestamp: "2026-08-08T10:00:00Z", url: "https://c" }] }).raw)
      .set("Content-Type", "application/json");
    expect(push.status).toBe(200);
    expect(estado.commits).toContain("abc123");

    // 4. PR opened → review
    const prOpen = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "e2e-pr-open")
      .set("X-GitHub-Event", "pull_request")
      .set("X-Hub-Signature-256", assinar({ action: "opened", repository: { id: 100 }, pull_request: { id: 500, number: 52, html_url: "https://pr", head: { ref: "task/38-criar-api-de-login", user: { login: "MatheusVRibeiro" } }, merged: false } }).sig)
      .send(assinar({ action: "opened", repository: { id: 100 }, pull_request: { id: 500, number: 52, html_url: "https://pr", head: { ref: "task/38-criar-api-de-login", user: { login: "MatheusVRibeiro" } }, merged: false } }).raw)
      .set("Content-Type", "application/json");
    expect(prOpen.status).toBe(200);

    // 5. PR merged → done + XP (uma vez)
    const prMerge = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "e2e-pr-merge")
      .set("X-GitHub-Event", "pull_request")
      .set("X-Hub-Signature-256", assinar({ action: "closed", repository: { id: 100 }, pull_request: { id: 500, number: 52, html_url: "https://pr", head: { ref: "task/38-criar-api-de-login" }, merged: true, merged_at: "2026-08-08T12:00:00Z" } }).sig)
      .send(assinar({ action: "closed", repository: { id: 100 }, pull_request: { id: 500, number: 52, html_url: "https://pr", head: { ref: "task/38-criar-api-de-login" }, merged: true, merged_at: "2026-08-08T12:00:00Z" } }).raw)
      .set("Content-Type", "application/json");
    expect(prMerge.status).toBe(200);
    expect(estado.tasks.get(38)?.status).toBe("done");
    expect(estado.eventosXpChaves.has("task:38:github-merge:pr:52")).toBe(true);
  });

  it("Cenário C: reenviar webhooks (duplicidade) → nada duplica indevidamente", async () => {
    const payload = { action: "closed", repository: { id: 100 }, pull_request: { id: 500, number: 52, html_url: "https://pr", head: { ref: "task/38-criar-api-de-login" }, merged: true, merged_at: "2026-08-08T12:00:00Z" } };
    const { raw, sig } = assinar(payload);

    // 1ª entrega (delivery novo) → processa e concede XP
    const primeiro = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "c-primeiro")
      .set("X-GitHub-Event", "pull_request")
      .set("X-Hub-Signature-256", sig)
      .send(raw)
      .set("Content-Type", "application/json");
    expect(primeiro.status).toBe(200);
    expect(estado.eventosXpChaves.has("task:38:github-merge:pr:52")).toBe(true);
    const xpAposPrimeiro = estado.eventosXpChaves.size;

    // 2ª entrega (mesmo PR, delivery novo — GitHub retry) → XP NÃO duplica
    const segundo = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "c-segundo")
      .set("X-GitHub-Event", "pull_request")
      .set("X-Hub-Signature-256", sig)
      .send(raw)
      .set("Content-Type", "application/json");
    expect(segundo.status).toBe(200);
    expect(estado.eventosXpChaves.size).toBe(xpAposPrimeiro);

    // 3ª entrega com MESMO delivery → 200 idempotente (isDeliveryDuplicate)
    const repetido = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "c-segundo")
      .set("X-GitHub-Event", "pull_request")
      .set("X-Hub-Signature-256", sig)
      .send(raw)
      .set("Content-Type", "application/json");
    expect(repetido.status).toBe(200);
  });

  it("Cenário D: concorrência ao assumir — apenas um usuário vence", async () => {
    const a = await request(app).post("/projetos/1/tarefas/38/assumir").set("Authorization", `Bearer ${tokenLucas}`);
    expect(a.status).toBe(200);

    // Roberto tenta assumir a MESMA task (já tem responsável) → 409
    const b = await request(app).post("/projetos/1/tarefas/38/assumir").set("Authorization", `Bearer ${tokenRoberto}`);
    expect(b.status).toBe(409);
  });
});