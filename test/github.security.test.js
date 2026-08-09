import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { buildApp, criarPoolFake, tokenPara, setEnvAmbiente } from "./helpers/bootstrap.js";

setEnvAmbiente();
process.env.GITHUB_APP_ID = "123";
process.env.GITHUB_PRIVATE_KEY = "key-mock";
process.env.GITHUB_WEBHOOK_SECRET = "segredo-teste-seg";
process.env.GITHUB_CLIENT_ID = "client-teste";
process.env.GITHUB_CLIENT_SECRET = "secret-teste";

const { Module } = await import("node:module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "../services/githubApp" || request.endsWith("services/githubApp")) {
    return {
      getRepositoryById: async () => ({ id: 100, full_name: "empresa/repo", default_branch: "main", html_url: "https://x" }),
      listInstallationRepositories: async () => [],
    };
  }
  return originalLoad.apply(this, arguments);
};

function criarPool() {
  return criarPoolFake([
    { match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql), resposta: () => [[{ criador_id: 5 }], []] },
    { match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo' limit 1$/.test(sql), resposta: (params) => (params[1] === 99 ? [[], []] : [[{ id: 1 }], []]) },
    // webhook delivery (registerDelivery + isDeliveryDuplicate)
    { match: (sql) => /^insert ignore into github_webhook_deliveries/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => /^select processado from github_webhook_deliveries where delivery_id = \? limit 1$/.test(sql), resposta: () => [[], []] },
    { match: (sql) => /^update github_webhook_deliveries set processado = true/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => /^select id, titulo from projetos where id = \?$/.test(sql), resposta: () => [[{ id: 1, titulo: "P" }], []] },
    { match: (sql) => /^update projetos set github_repository_id/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => /^select github_repository_id, github_repository_full_name/.test(sql), resposta: () => [[{ github_repository_id: 100, github_repository_full_name: "empresa/repo", github_installation_id: 5, github_default_branch: "main", github_connected_at: new Date(), repositorio_url: "https://x" }], []] },
    { match: (sql) => /^update projetos set\s+github_repository_id = null/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => /^select github_user_id, github_login, github_avatar_url, github_connected_at from usuarios where id = \? limit 1$/.test(sql), resposta: () => [[{ github_user_id: null, github_login: null, github_avatar_url: null, github_connected_at: null }], []] },
    { match: (sql) => /^update usuarios set github_user_id = null/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => /^select t\.github_branch, t\.github_pr_number/.test(sql), resposta: () => [[{ github_branch: null, github_pr_number: null, github_pr_url: null, github_pr_status: null, github_last_activity_at: null, completion_source: null, completed_at: null }], []] },
    { match: (sql) => /^select t\.github_branch, p\.github_repository_id as repository_id/.test(sql), resposta: () => [[{ github_branch: null, repository_id: null }], []] },
    { match: (sql) => /^select t\.id, t\.titulo, t\.status, t\.github_branch, t\.assumida_em/.test(sql), resposta: () => [[{ id: 38, titulo: "T", status: "todo", github_branch: null, assumida_em: null, github_pr_number: null, github_pr_status: null, github_last_activity_at: null, completion_source: null, completed_at: null, responsavel_nome: null }], []] },
    { match: (sql) => /^select sha, message, author_name, commit_url, committed_at from github_commits where tarefa_id/.test(sql), resposta: () => [[], []] },
    { match: (sql) => /^select numero, url, estado, mergeado_em from github_pull_requests where tarefa_id/.test(sql), resposta: () => [[], []] },
  ]);
}

describe("Segurança da superfície GitHub (ETAPA 16)", () => {
  let app;
  const tokenOwner = tokenPara({ id: 5, email: "admin@email.com", nome: "Admin", tipo: "adm" });
  const tokenMembro = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
  const tokenVisitante = tokenPara({ id: 99, email: "visit@email.com", nome: "Visitante" });

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp(criarPool());
  });

  it("webhook usa assinatura, não JWT — sem assinatura → 401 mesmo com token válido no header", async () => {
    const res = await request(app)
      .post("/github/webhook")
      .set("Authorization", `Bearer ${tokenOwner}`)
      .set("X-GitHub-Delivery", "d-seg")
      .set("X-GitHub-Event", "push")
      .send('{"repository":{"id":1},"ref":"refs/heads/main"}')
      .set("Content-Type", "application/json");
    expect(res.status).toBe(401);
  });

  it("webhook com assinatura VÁLIDA → 200 (não exige JWT)", async () => {
    const raw = JSON.stringify({ action: "opened", repository: { id: 1 } });
    const sig = "sha256=" + crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET).update(raw, "utf8").digest("hex");
    const res = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "d-ok")
      .set("X-GitHub-Event", "pull_request")
      .set("X-Hub-Signature-256", sig)
      .send(raw)
      .set("Content-Type", "application/json");
    expect(res.status).toBe(200);
  });

  it("conectar repositório — visitante → 403 (somente owner)", async () => {
    const res = await request(app)
      .post("/projetos/1/github/repository")
      .set("Authorization", `Bearer ${tokenVisitante}`)
      .send({ installationId: 5, repositoryId: 100 });
    expect(res.status).toBe(403);
  });

  it("status/commits/timeline da task — visitante → 403 (membro/dono)", async () => {
    const a = await request(app).get("/projetos/1/tarefas/38/github").set("Authorization", `Bearer ${tokenVisitante}`);
    const b = await request(app).get("/projetos/1/tarefas/38/commits").set("Authorization", `Bearer ${tokenVisitante}`);
    const c = await request(app).get("/projetos/1/tarefas/38/timeline").set("Authorization", `Bearer ${tokenVisitante}`);
    expect(a.status).toBe(403);
    expect(b.status).toBe(403);
    expect(c.status).toBe(403);
  });

  it("todos os endpoints de configuração sem token → 401", async () => {
    const rotas = [
      ["post", "/projetos/1/github/repository", { installationId: 5, repositoryId: 100 }],
      ["get", "/projetos/1/github/status"],
      ["delete", "/projetos/1/github/repository"],
      ["get", "/github/me"],
      ["get", "/github/connect"],
      ["delete", "/github/disconnect"],
      ["get", "/projetos/1/tarefas/38/github"],
      ["get", "/projetos/1/tarefas/38/commits"],
      ["get", "/projetos/1/tarefas/38/timeline"],
      ["get", "/projetos/1/rankings/committers"],
      ["get", "/rankings/committers"],
      ["get", "/projetos/1/rankings/contributors"],
      ["get", "/rankings/contributors"],
    ];
    for (const [metodo, rota, body] of rotas) {
      const req = request(app)[metodo](rota);
      if (body) req.send(body);
      const res = await req;
      expect(res.status, `${metodo.toUpperCase()} ${rota} deveria ser 401`).toBe(401);
    }
  });

  it("installation token e private key NUNCA aparecem em respostas", async () => {
    const res = await request(app).get("/github/me").set("Authorization", `Bearer ${tokenOwner}`);
    const corpo = JSON.stringify(res.body).toLowerCase();
    expect(corpo).not.toContain("private_key");
    expect(corpo).not.toContain("installation_token");
    expect(corpo).not.toContain("access_token");
  });

  it("payload sem installationId/repositoryId → 400", async () => {
    const res = await request(app)
      .post("/projetos/1/github/repository")
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("OAuth callback com state inválido → 401 (anti-CSRF)", async () => {
    const res = await request(app).get("/github/callback?code=x&state=invalido");
    expect(res.status).toBe(401);
  });
});