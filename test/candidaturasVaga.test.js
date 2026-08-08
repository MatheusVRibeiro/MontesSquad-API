import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// Candidatura direcionada por vaga — Evolução ETAPA 5.
// POST   /projetos/:projetoId/candidaturas   (qualquer logado) — body { vaga_id?, mensagem }
//         Validações: vaga pertence ao projeto (400), vaga aberta (400),
//         duplicada pendente (409), próprio projeto (400), já membro (400).
// PATCH  /projetos/:projetoId/candidaturas/:candidaturaId (owner) — aprovar incrementa
//         vagas_projeto.preenchidas e fecha a vaga quando preenchidas >= quantidade.
// GET    /projetos/:projetoId/candidaturas   (owner) — inclui vaga_id + funcao_nome.
//
// Dono = usuário 1 (criador_id 1); candidato = usuário 5; vaga padrão id 10 (projeto 1, aberta).

const OWNER = tokenPara({ id: 1, email: "dono@email.com", nome: "Dono" });
const CANDIDATO = tokenPara({ id: 5, email: "candidato@email.com", nome: "Candidato" });

function criarPoolCandidaturaVaga({
  criadorProjeto = 1,
  vagaProjetoId = 1,
  vagaStatus = "aberta",
  vagaExiste = true,
  duplicataStatus = null,
  membro = false,
  vagaPosIncremento = { quantidade: 1, preenchidas: 1 },
} = {}) {
  return criarPoolFake([
    // Middleware somenteDonoDoProjeto (GET/PATCH) — dono do projeto
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: criadorProjeto }], []],
    },
    // PATCH — limite de membros do projeto (atualizarStatusCandidatura)
    {
      match: (sql) => /^select limite_membros from projetos where id = \?$/.test(sql),
      resposta: () => [[{ limite_membros: 5 }], []],
    },
    // POST — SELECT do projeto (candidatarSe)
    {
      match: (sql) => /^select id, criador_id from projetos where id = \?$/.test(sql),
      resposta: () => [[{ id: 1, criador_id: criadorProjeto }], []],
    },
    // POST — SELECT de membro da equipe (já membro ATIVO não pode se candidatar)
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo'$/.test(sql),
      resposta: () => (membro ? [[{ id: 9 }], []] : [[], []]),
    },
    // POST — SELECT de candidatura duplicada (pendente → 409; aceito → já membro 400)
    {
      match: (sql) => /^select id, status from candidaturas where usuario_id = \? and projeto_id = \?$/.test(sql),
      resposta: () => (duplicataStatus ? [[{ id: 5, status: duplicataStatus }], []] : [[], []]),
    },
    // POST — SELECT da vaga (pertence ao projeto + aberta)
    {
      match: (sql) => /^select id, projeto_id, status from vagas_projeto where id = \? and projeto_id = \? limit 1$/.test(sql),
      resposta: () =>
        vagaExiste
          ? [[{ id: 10, projeto_id: vagaProjetoId, status: vagaStatus }], []]
          : [[], []],
    },
    // POST — INSERT da candidatura (com vaga_id)
    {
      match: (sql) => /^insert into candidaturas \(usuario_id, projeto_id, vaga_id, status, mensagem\) values \(\?, \?, \?, 'pendente', \?\)$/.test(sql),
      resposta: () => [{ insertId: 77, affectedRows: 1 }, []],
    },
    // PATCH — SELECT da candidatura a aprovar/rejeitar (com vaga_id)
    {
      match: (sql) => /^select \* from candidaturas where id = \? and projeto_id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 55, usuario_id: 2, projeto_id: 1, vaga_id: 10, status: "pendente", mensagem: "Quero entrar" }], []],
    },
    // PATCH — contagem atual de membros ATIVOS (limite de membros)
    {
      match: (sql) => /^select count\(\*\) as total from membros_equipe where projeto_id = \? and status = 'ativo'$/.test(sql),
      resposta: () => [[{ total: 0 }], []],
    },
    // PATCH — UPDATE do status da candidatura (transação)
    {
      match: (sql) => /^update candidaturas set status = \? where id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // PATCH — ETAPA 6: função da vaga (JOIN vagas_projeto.funcao_id → funcoes.nome)
    {
      match: (sql) => /^select v\.funcao_id, f\.nome as funcao_nome from vagas_projeto v left join funcoes f on v\.funcao_id = f\.id where v\.id = \? limit 1$/.test(sql),
      resposta: () => [[{ funcao_id: 1, funcao_nome: "Backend" }], []],
    },
    // PATCH — INSERT do novo membro na equipe com vaga/função (transação, ETAPA 6)
    {
      match: (sql) => /^insert into membros_equipe \(usuario_id, projeto_id, vaga_id, funcao_id, funcao, status\) values \(\?, \?, \?, \?, \?, 'ativo'\)$/.test(sql),
      resposta: () => [{ insertId: 7, affectedRows: 1 }, []],
    },
    // PATCH — ETAPA 5: incrementa ocupação da vaga ao aprovar
    {
      match: (sql) => /^update vagas_projeto set preenchidas = preenchidas \+ 1 where id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // PATCH — lê ocupação pós-incremento (fecha vaga se preenchidas >= quantidade)
    {
      match: (sql) => /^select quantidade, preenchidas from vagas_projeto where id = \? limit 1$/.test(sql),
      resposta: () => [[vagaPosIncremento], []],
    },
    // PATCH — fecha a vaga quando lotada
    {
      match: (sql) => /^update vagas_projeto set status = 'fechada' where id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // GET — listagem de candidaturas com vaga_id + funcao_nome
    {
      match: (sql) => /^select c\.id, c\.usuario_id, c\.status, c\.mensagem, c\.criado_em, c\.vaga_id, u\.nome as usuario_nome, u\.bio as usuario_bio, v\.funcao_id, f\.nome as funcao_nome from candidaturas c join usuarios u on c\.usuario_id = u\.id left join vagas_projeto v on c\.vaga_id = v\.id left join funcoes f on v\.funcao_id = f\.id where c\.projeto_id = \? and c\.status = 'pendente'$/.test(sql),
      resposta: () => [
        [
          {
            id: 55,
            usuario_id: 2,
            status: "pendente",
            mensagem: "Quero entrar",
            criado_em: "2026-08-08T12:00:00.000Z",
            vaga_id: 10,
            usuario_nome: "João Silva",
            usuario_bio: null,
            funcao_id: 1,
            funcao_nome: "Backend",
          },
        ],
        [],
      ],
    },
    // Notificações (criarNotificacao — INSERT + SELECT de retorno)
    {
      match: (sql) => /^insert into notificacoes /.test(sql),
      resposta: () => [{ insertId: 1, affectedRows: 1 }, []],
    },
    {
      match: (sql) => /^select id, usuario_id, tipo, titulo, descricao, lida, link, criado_em from notificacoes where id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 1 }], []],
    },
  ]);
}

describe("Candidatura por vaga (Evolução ETAPA 5) — POST /projetos/:projetoId/candidaturas", () => {
  it("candidatar com vaga válida → 200 com dados.vaga_id e INSERT com vaga", async () => {
    const pool = criarPoolCandidaturaVaga();
    const app = buildApp(pool);

    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${CANDIDATO}`)
      .send({ vaga_id: 10, mensagem: "Quero contribuir no backend" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.status).toBe("pendente");
    expect(res.body.dados.vaga_id).toBe(10);

    const insert = buscarChamada(pool, /^insert into candidaturas /);
    expect(insert).toBeDefined();
    expect(insert.params).toEqual([5, "1", 10, "Quero contribuir no backend"]);
  });

  it("candidatar sem vaga continua válido → 200 com dados.vaga_id null", async () => {
    const pool = criarPoolCandidaturaVaga();
    const app = buildApp(pool);

    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${CANDIDATO}`)
      .send({ mensagem: "Quero entrar" });

    expect(res.status).toBe(200);
    expect(res.body.dados.vaga_id).toBeNull();

    const insert = buscarChamada(pool, /^insert into candidaturas /);
    expect(insert.params).toEqual([5, "1", null, "Quero entrar"]);
  });

  it("vaga de OUTRO projeto → 400 'Vaga não pertence a este projeto'", async () => {
    const app = buildApp(criarPoolCandidaturaVaga({ vagaProjetoId: 2 }));
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${CANDIDATO}`)
      .send({ vaga_id: 10, mensagem: "Quero entrar" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Vaga não pertence a este projeto");
  });

  it("vaga FECHADA → 400 'Vaga não está aberta'", async () => {
    const app = buildApp(criarPoolCandidaturaVaga({ vagaStatus: "fechada" }));
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${CANDIDATO}`)
      .send({ vaga_id: 10, mensagem: "Quero entrar" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Vaga não está aberta");
  });

  it("candidatura DUPLICADA pendente → 409", async () => {
    const app = buildApp(criarPoolCandidaturaVaga({ duplicataStatus: "pendente" }));
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${CANDIDATO}`)
      .send({ vaga_id: 10, mensagem: "Quero entrar" });

    expect(res.status).toBe(409);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toContain("pendente");
  });

  it("candidatar ao PRÓPRIO projeto → 400", async () => {
    const app = buildApp(criarPoolCandidaturaVaga({ criadorProjeto: 5 }));
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${CANDIDATO}`)
      .send({ vaga_id: 10, mensagem: "eu mesmo" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Você não pode se candidatar ao seu próprio projeto");
  });

  it("usuário já MEMBRO (membros_equipe) → 400 'Você já é membro deste projeto'", async () => {
    const app = buildApp(criarPoolCandidaturaVaga({ membro: true }));
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${CANDIDATO}`)
      .send({ vaga_id: 10, mensagem: "Quero entrar" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Você já é membro deste projeto");
  });

  it("sem token → 401", async () => {
    const app = buildApp(criarPoolFake([]));
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .send({ vaga_id: 10, mensagem: "Quero entrar" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token não informado");
  });
});

describe("Candidatura por vaga (Evolução ETAPA 5) — PATCH aprovação", () => {
  it("aprovar candidatura com vaga → 200 e incrementa preenchidas (+1), fecha vaga lotada", async () => {
    const pool = criarPoolCandidaturaVaga({ vagaPosIncremento: { quantidade: 1, preenchidas: 1 } });
    const app = buildApp(pool);

    const res = await request(app)
      .patch("/projetos/1/candidaturas/55")
      .set("Authorization", `Bearer ${OWNER}`)
      .send({ status: "aceito" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.status).toBe("aceito");

    const updateOcupacao = buscarChamada(pool, /^update vagas_projeto set preenchidas = preenchidas \+ 1/);
    expect(updateOcupacao).toBeDefined();
    expect(updateOcupacao.params).toEqual([10]);

    const fechaVaga = buscarChamada(pool, /^update vagas_projeto set status = 'fechada'/);
    expect(fechaVaga).toBeDefined();
    expect(fechaVaga.params).toEqual([10]);
  });
});

describe("Candidatura por vaga (Evolução ETAPA 5) — GET listagem", () => {
  it("listar candidaturas como owner → 200 com vaga_id + funcao_nome", async () => {
    const app = buildApp(criarPoolCandidaturaVaga());
    const res = await request(app)
      .get("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(1);
    expect(res.body.dados[0]).toMatchObject({
      id: 55,
      vaga_id: 10,
      funcao_nome: "Backend",
      usuario_nome: "João Silva",
    });
  });
});
