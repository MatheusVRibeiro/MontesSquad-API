import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara } from "./helpers/bootstrap.js";

describe("Regras de Negócio — Tarefas em Projetos Finalizados e Tarefas Concluídas", () => {
  const tokenMembro = tokenPara({ id: 2, nome: "Lucas", email: "lucas@email.com" });
  const tokenOwner = tokenPara({ id: 5, nome: "Owner", email: "owner@email.com" });

  describe("Projeto Finalizado", () => {
    const pool = criarPoolFake([
      // Middleware somenteMembroOuDonoDoProjeto / somenteDonoDoProjeto
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ criador_id: 5 }], []],
      },
      {
        match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo' limit 1$/i.test(sql),
        resposta: () => [[{ id: 1 }], []],
      },
      // Projeto com status 'finalizado'
      {
        match: (sql) => /^select status from projetos where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ status: "finalizado" }], []],
      },
    ]);
    const app = buildApp(pool);

    it("POST /projetos/1/tarefas em projeto finalizado → 400", async () => {
      const res = await request(app)
        .post("/projetos/1/tarefas")
        .set("Authorization", `Bearer ${tokenMembro}`)
        .send({ titulo: "Nova Task" });

      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.message).toBe("Não é possível criar tarefas em um projeto finalizado");
    });

    it("PATCH /projetos/1/tarefas/10 em projeto finalizado → 400", async () => {
      const res = await request(app)
        .patch("/projetos/1/tarefas/10")
        .set("Authorization", `Bearer ${tokenMembro}`)
        .send({ titulo: "Titulo Editado" });

      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.message).toBe("Não é possível alterar tarefas de um projeto finalizado");
    });

    it("DELETE /projetos/1/tarefas/10 em projeto finalizado → 400", async () => {
      const res = await request(app)
        .delete("/projetos/1/tarefas/10")
        .set("Authorization", `Bearer ${tokenOwner}`);

      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.message).toBe("Não é possível excluir tarefas de um projeto finalizado");
    });

    it("POST /projetos/1/tarefas/10/assumir em projeto finalizado → 400", async () => {
      const res = await request(app)
        .post("/projetos/1/tarefas/10/assumir")
        .set("Authorization", `Bearer ${tokenMembro}`);

      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.message).toBe("Não é possível alterar tarefas de um projeto finalizado");
    });

    it("POST /projetos/1/tarefas/10/abandonar em projeto finalizado → 400", async () => {
      const res = await request(app)
        .post("/projetos/1/tarefas/10/abandonar")
        .set("Authorization", `Bearer ${tokenMembro}`);

      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.message).toBe("Não é possível alterar tarefas de um projeto finalizado");
    });

    it("POST /projetos/1/tarefas/10/remover-responsavel em projeto finalizado → 400", async () => {
      const res = await request(app)
        .post("/projetos/1/tarefas/10/remover-responsavel")
        .set("Authorization", `Bearer ${tokenOwner}`);

      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.message).toBe("Não é possível alterar tarefas de um projeto finalizado");
    });

    it("POST /projetos/1/tarefas/10/reatribuir em projeto finalizado → 400", async () => {
      const res = await request(app)
        .post("/projetos/1/tarefas/10/reatribuir")
        .set("Authorization", `Bearer ${tokenOwner}`)
        .send({ usuario_id: 3 });

      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.message).toBe("Não é possível alterar tarefas de um projeto finalizado");
    });
  });

  describe("Tarefas Concluídas (status: 'done')", () => {
    const pool = criarPoolFake([
      // Middleware
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ criador_id: 5 }], []],
      },
      {
        match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo' limit 1$/i.test(sql),
        resposta: () => [[{ id: 1 }], []],
      },
      // Projeto em andamento
      {
        match: (sql) => /^select status from projetos where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ status: "em_andamento" }], []],
      },
      // Tarefa com status 'done'
      {
        match: (sql) => /^select id, responsavel_id, status from tarefas where id = \? and projeto_id = \? limit 1$/i.test(sql),
        resposta: () => [[{ id: 10, responsavel_id: 2, status: "done" }], []],
      },
      {
        match: (sql) => /^select status from tarefas where id = \? and projeto_id = \? limit 1$/i.test(sql),
        resposta: () => [[{ status: "done" }], []],
      },
    ]);
    const app = buildApp(pool);

    it("POST /projetos/1/tarefas/10/assumir em tarefa concluída → 400", async () => {
      const res = await request(app)
        .post("/projetos/1/tarefas/10/assumir")
        .set("Authorization", `Bearer ${tokenMembro}`);

      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.message).toBe("Não é possível assumir uma tarefa que já foi concluída");
    });

    it("POST /projetos/1/tarefas/10/abandonar em tarefa concluída → 400", async () => {
      const res = await request(app)
        .post("/projetos/1/tarefas/10/abandonar")
        .set("Authorization", `Bearer ${tokenMembro}`);

      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.message).toBe("Não é possível abandonar uma tarefa que já foi concluída");
    });

    it("POST /projetos/1/tarefas/10/remover-responsavel em tarefa concluída → 400", async () => {
      const res = await request(app)
        .post("/projetos/1/tarefas/10/remover-responsavel")
        .set("Authorization", `Bearer ${tokenOwner}`);

      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.message).toBe("Não é possível alterar o responsável de uma tarefa já concluída");
    });

    it("POST /projetos/1/tarefas/10/reatribuir em tarefa concluída → 400", async () => {
      const res = await request(app)
        .post("/projetos/1/tarefas/10/reatribuir")
        .set("Authorization", `Bearer ${tokenOwner}`)
        .send({ usuario_id: 3 });

      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.message).toBe("Não é possível reatribuir uma tarefa já concluída");
    });
  });
});
