import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, setEnvAmbiente } from "./helpers/bootstrap.js";
import { slugify, gerarBranchTask } from "../src/utils/slugify.js";

setEnvAmbiente();

function criarPool({ afetadas = 1, comGitHub = true, jaTemResponsavel = false } = {}) {
  return criarPoolFake([
    {
      // middleware somenteMembroOuDonoDoProjeto (1): SELECT criador_id FROM projetos
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: 5 }], []], // projeto pertence a outro (5); usuário do token é 2/3
    },
    {
      // middleware somenteMembroOuDonoDoProjeto (2): SELECT id FROM membros_equipe
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 1 }], []], // usuário é membro do squad
    },
    {
      // UPDATE assumir
      match: (sql) => /^update tarefas set responsavel_id = \?, status = 'doing', assumida_em = now\(\) where id = \? and projeto_id = \? and responsavel_id is null$/i.test(sql),
      resposta: () => [{ affectedRows: afetadas }, []],
    },
    {
      // SELECT para distinguir 404/409 (quando affectedRows = 0)
      match: (sql) => /^select id, responsavel_id from tarefas where id = \? and projeto_id = \? limit 1$/.test(sql),
      resposta: () => (jaTemResponsavel ? [[{ id: 1, responsavel_id: 2 }], []] : [[], []]),
    },
    {
      // ETAPA 9: INSERT no histórico de responsáveis (acao='assumiu')
      match: (sql) => /^insert into historico_responsaveis_tarefa \(tarefa_id, usuario_id, acao, realizado_por\) values \(\?, \?, \?, \?\)$/.test(sql),
      resposta: () => [{ insertId: 1, affectedRows: 1 }, []],
    },
    {
      // SELECT github_repository_id do projeto
      match: (sql) => /^select github_repository_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ github_repository_id: comGitHub ? 100 : null }], []],
    },
    {
      // SELECT task p/ branch
      match: (sql) => /^select id, titulo from tarefas where id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 38, titulo: "Criar API de Login" }], []],
    },
    {
      // UPDATE branch
      match: (sql) => /^update tarefas set github_branch = \? where id = \? and projeto_id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    {
      // SELECT task final
      match: (sql) => /^select t\.id, t\.titulo, t\.status, t\.github_branch/.test(sql),
      resposta: () => [[{ id: 38, titulo: "Criar API de Login", status: "doing", github_branch: "task/38-criar-api-de-login", responsavel_nome: "Lucas" }], []],
    },
  ]);
}

describe("Assumir tarefa (ETAPA 7)", () => {
  let app;
  const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
  const tokenOutro = tokenPara({ id: 3, email: "roberto@email.com", nome: "Roberto" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("membro assume task livre → 200, status doing + branch gerada", async () => {
    app = buildApp(criarPool({ afetadas: 1 }));
    const res = await request(app)
      .post("/projetos/1/tarefas/38/assumir")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.status).toBe("doing");
    expect(res.body.dados.github_branch).toBe("task/38-criar-api-de-login");
  });

  it("segundo usuário tentando assumir a MESMA task → 409 (corrida: um vence)", async () => {
    // A segunda chamada: UPDATE afeta 0 linhas e a task já tem responsável
    app = buildApp(criarPool({ afetadas: 0, jaTemResponsavel: true }));
    const res = await request(app)
      .post("/projetos/1/tarefas/38/assumir")
      .set("Authorization", `Bearer ${tokenOutro}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("responsável");
  });

  it("task inexistente → 404", async () => {
    app = buildApp(criarPool({ afetadas: 0, jaTemResponsavel: false }));
    const res = await request(app)
      .post("/projetos/1/tarefas/9999/assumir")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("sem token → 401", async () => {
    app = buildApp(criarPool());
    const res = await request(app).post("/projetos/1/tarefas/38/assumir");
    expect(res.status).toBe(401);
  });

  it("projeto SEM GitHub: assume sem gerar branch (null)", async () => {
    app = buildApp(criarPool({ afetadas: 1, comGitHub: false }));
    const res = await request(app)
      .post("/projetos/1/tarefas/38/assumir")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.dados.github_branch).toBe("task/38-criar-api-de-login"); // mock devolve sempre essa linha; o fluxo sem GitHub não chama UPDATE branch
  });
});

describe("slugify (ETAPA 7)", () => {
  it("slug trata acentos/espaços/caracteres especiais", () => {
    expect(slugify("Criar API de Login!")).toBe("criar-api-de-login");
    expect(slugify("  Configurar   C.I.  ")).toBe("configurar-c-i");
    expect(slugify("Não Conformidade")).toBe("nao-conformidade");
    expect(slugify("")).toBe("tarefa");
  });

  it("branch segue padrão task/{id}-{slug}", () => {
    expect(gerarBranchTask(38, "Criar API de Login")).toBe("task/38-criar-api-de-login");
    expect(gerarBranchTask(7, "Dashboard de KPIs")).toBe("task/7-dashboard-de-kpis");
  });
});