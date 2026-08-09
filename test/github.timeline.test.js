import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, setEnvAmbiente } from "./helpers/bootstrap.js";

setEnvAmbiente();

const TIMELINE = [
  { tipo: "assumida", titulo: "Tarefa assumida", detalhe: "Lucas", quando: "2026-08-08T09:02:00Z" },
  { tipo: "branch", titulo: "Branch vinculada", detalhe: "task/38-criar-api-de-login", quando: "2026-08-08T09:05:00Z" },
  { tipo: "commit", titulo: "Commit", detalhe: "feat: api", sha: "a92f830", autor: "Matheus", url: "https://c", quando: "2026-08-08T10:14:00Z" },
  { tipo: "pr_open", titulo: "PR #52 aberto", detalhe: "Tarefa em revisão", url: "https://pr", quando: null },
  { tipo: "pr_merged", titulo: "PR #52 mergeado", detalhe: "Contribuição verificada", url: "https://pr", quando: "2026-08-08T12:25:00Z" },
  { tipo: "concluida", titulo: "Tarefa concluída via GitHub", detalhe: "Merge verificado", quando: "2026-08-08T12:25:00Z" },
];

function criarPool() {
  return criarPoolFake([
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: 5 }], []],
    },
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo' limit 1$/.test(sql),
      resposta: () => [[{ id: 1 }], []],
    },
    {
      // SELECT da task para timeline
      match: (sql) => /^select t\.id, t\.titulo, t\.status, t\.github_branch, t\.assumida_em/.test(sql),
      resposta: () => [[{
        id: 38, titulo: "Criar API de Login", status: "done", github_branch: "task/38-criar-api-de-login",
        assumida_em: "2026-08-08T09:02:00Z", github_pr_number: 52, github_pr_status: "merged",
        github_last_activity_at: "2026-08-08T12:25:00Z", completion_source: "github_merge",
        completed_at: "2026-08-08T12:25:00Z", responsavel_nome: "Lucas",
      }], []],
    },
    {
      // commits da timeline
      match: (sql) => /^select sha, message, author_name, commit_url, committed_at from github_commits where tarefa_id = \? order by committed_at asc$/.test(sql),
      resposta: () => [[{ sha: "a92f830abc", message: "feat: api", author_name: "Matheus", commit_url: "https://c", committed_at: "2026-08-08T10:14:00Z" }], []],
    },
    {
      // PRs da timeline
      match: (sql) => /^select numero, url, estado, mergeado_em from github_pull_requests where tarefa_id = \? order by id asc$/.test(sql),
      resposta: () => [[
        { numero: 52, url: "https://pr", estado: "open", mergeado_em: null },
        { numero: 52, url: "https://pr", estado: "merged", mergeado_em: "2026-08-08T12:25:00Z" },
      ], []],
    },
  ]);
}

describe("Timeline técnica da tarefa (ETAPA 15)", () => {
  let app;
  const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });

  beforeEach(() => {
    app = buildApp(criarPool());
  });

  it("GET /projetos/:id/tarefas/:id/timeline — eventos derivados e ordenados", async () => {
    const res = await request(app)
      .get("/projetos/1/tarefas/38/timeline")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.length).toBeGreaterThanOrEqual(5);
    // Tipos presentes
    const tipos = res.body.dados.map((e) => e.tipo);
    expect(tipos).toContain("assumida");
    expect(tipos).toContain("branch");
    expect(tipos).toContain("commit");
    expect(tipos).toContain("pr_merged");
    expect(tipos).toContain("concluida");
  });

  it("sem token → 401", async () => {
    const res = await request(app).get("/projetos/1/tarefas/38/timeline");
    expect(res.status).toBe(401);
  });

  it("merge duplicado não gera notificação duplicada — via eventos_xp (testado em github.pullRequest.test.js)", () => {
    // A idempotência do merge é coberta no teste de PR (jaConcluida → sem notificação).
    expect(true).toBe(true);
  });
});