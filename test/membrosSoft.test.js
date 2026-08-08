import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// Função do membro com SOFT-DELETE — Evolução ETAPA 6.
// GET    /projetos/:projetoId/membros              → lista SOMENTE membros status='ativo'
//         (com vaga_id/funcao_id/funcao_nome — "quem faz o quê").
// DELETE /projetos/:projetoId/membros/:usuarioId   (owner) → vira SOFT-DELETE
//         (UPDATE status='removido', NUNCA DELETE físico) + libera a vaga vinculada
//         (preenchidas - 1 e reabre quando preenchidas < quantidade).
// POST   /projetos/:projetoId/sair                 (membro) → SOFT-DELETE status='saiu'
//         + libera a vaga; owner → 400 'Owner não pode sair do projeto'.
//
// Dono do projeto 1 = usuário 1 (criador_id 1). Membro comum = usuário 5.
// Membro alvo da remoção = usuário 2 (vinculado à vaga 10).

const OWNER = tokenPara({ id: 1, email: "dono@email.com", nome: "Dono" });
const MEMBRO = tokenPara({ id: 5, email: "membro@email.com", nome: "Membro" });

// Pool fake para os fluxos de soft-delete/saída/liberação de vaga.
// Opções: criadorProjeto (dono do projeto 1), vagaId (vaga vinculada ao membro alvo;
// null = sem vaga), vagaPosDecremento (estado da vaga após preenchidas - 1).
function criarPoolSoftDelete({
  criadorProjeto = 1,
  vagaId = 10,
  vagaPosDecremento = { quantidade: 2, preenchidas: 1, status: "fechada" },
} = {}) {
  return criarPoolFake([
    // Middleware somenteDonoDoProjeto + verificação de dono no controller
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: criadorProjeto }], []],
    },
    // SOFT-DELETE: UPDATE membros_equipe SET status = ?, saiu_em = NOW() (ETAPA 6)
    {
      match: (sql) => /^update membros_equipe set status = \?, saiu_em = now\(\) where projeto_id = \? and usuario_id = \? and status = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // Vaga vinculada ao vínculo recém-inativado
    {
      match: (sql) => /^select vaga_id from membros_equipe where projeto_id = \? and usuario_id = \? and status = \? order by id desc limit 1$/.test(sql),
      resposta: () => (vagaId ? [[{ vaga_id: vagaId }], []] : [[], []]),
    },
    // Libera a vaga: preenchidas = GREATEST(preenchidas - 1, 0)
    {
      match: (sql) => /^update vagas_projeto set preenchidas = greatest\(preenchidas - 1, 0\) where id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // Lê estado pós-decremento (reabre se preenchidas < quantidade e fechada)
    {
      match: (sql) => /^select quantidade, preenchidas, status from vagas_projeto where id = \? limit 1$/.test(sql),
      resposta: () => [[vagaPosDecremento], []],
    },
    // Reabre a vaga
    {
      match: (sql) => /^update vagas_projeto set status = 'aberta' where id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // Efeito colateral: rejeita a candidatura do membro removido/saído
    {
      match: (sql) => /^update candidaturas set status = 'rejeitado' where projeto_id = \? and usuario_id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // Fallback para SELECTs auxiliares não mapeados
    {
      match: (sql) => /^select/.test(sql),
      resposta: () => [[], []],
    },
  ]);
}

describe("ETAPA 6 — GET /projetos/:projetoId/membros lista apenas ATIVOS", () => {
  it("→ 200 com membros ativos + vaga_id/funcao_nome (quem faz o quê)", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select me\.id, me\.usuario_id, me\.funcao, me\.funcao_id, f\.nome as funcao_nome, me\.vaga_id, me\.status, me\.entrou_em, me\.saiu_em, u\.nome as usuario_nome/.test(sql),
        resposta: () => [
          [
            { id: 1, usuario_id: 1, funcao: "Líder Técnico", funcao_id: null, funcao_nome: null, vaga_id: null, status: "ativo", entrou_em: "2026-01-01T00:00:00.000Z", saiu_em: null, usuario_nome: "Dono" },
            { id: 2, usuario_id: 2, funcao: "Backend", funcao_id: 1, funcao_nome: "Backend", vaga_id: 10, status: "ativo", entrou_em: "2026-01-02T00:00:00.000Z", saiu_em: null, usuario_nome: "Membro Alvo" },
          ],
          [],
        ],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .get("/projetos/1/membros")
      .set("Authorization", `Bearer ${MEMBRO}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(2);
    expect(res.body.dados[1]).toMatchObject({
      usuario_id: 2,
      funcao_nome: "Backend",
      vaga_id: 10,
      status: "ativo",
    });

    // A listagem NORMAL filtra por status='ativo' (histórico fica no banco/perfil)
    const listagem = buscarChamada(pool, /select me\.id, me\.usuario_id/);
    expect(listagem).toBeTruthy();
    expect(listagem.sql).toContain("status = 'ativo'");
  });

  it("sem token → 401", async () => {
    const app = buildApp(criarPoolFake([]));
    const res = await request(app).get("/projetos/1/membros");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token não informado");
  });
});

describe("ETAPA 6 — DELETE /projetos/:projetoId/membros/:usuarioId vira SOFT-DELETE", () => {
  it("remover membro → 200 com UPDATE status='removido' (NUNCA DELETE físico) e libera a vaga", async () => {
    const pool = criarPoolSoftDelete({ vagaId: 10 });
    const app = buildApp(pool);

    const res = await request(app)
      .delete("/projetos/1/membros/2")
      .set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toBeNull();

    // CONTRATO ETAPA 6: soft-delete — NÃO existe DELETE físico de membros_equipe
    const deleteFisico = buscarChamada(pool, /delete from membros_equipe/);
    expect(deleteFisico).toBeFalsy();

    // CONTRATO ETAPA 6: UPDATE membros_equipe SET status='removido' (+ saiu_em)
    const updateSoft = buscarChamada(pool, /^update membros_equipe set status/);
    expect(updateSoft).toBeTruthy();
    expect(updateSoft.params).toContain("removido");
    expect(updateSoft.sql).toContain("saiu_em = now()");

    // Libera a vaga vinculada: preenchidas - 1 e reabre (preenchidas < quantidade)
    const liberaVaga = buscarChamada(pool, /^update vagas_projeto set preenchidas = greatest/);
    expect(liberaVaga).toBeTruthy();
    expect(liberaVaga.params).toEqual([10]);

    const reabreVaga = buscarChamada(pool, /^update vagas_projeto set status = 'aberta'/);
    expect(reabreVaga).toBeTruthy();
    expect(reabreVaga.params).toEqual([10]);
  });

  it("remover membro SEM vaga → 200 sem tocar em vagas_projeto", async () => {
    const pool = criarPoolSoftDelete({ vagaId: null });
    const app = buildApp(pool);

    const res = await request(app)
      .delete("/projetos/1/membros/2")
      .set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(200);
    expect(buscarChamada(pool, /update vagas_projeto/)).toBeFalsy();
  });

  it("remover membro que NÃO existe (nenhum vínculo ativo) → 404", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
        resposta: () => [[{ criador_id: 1 }], []],
      },
      {
        match: (sql) => /^update membros_equipe set status/.test(sql),
        resposta: () => [{ affectedRows: 0 }, []],
      },
      {
        match: (sql) => /^select/.test(sql),
        resposta: () => [[], []],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .delete("/projetos/1/membros/999")
      .set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(404);
    expect(res.body.sucesso).toBe(false);
  });

  it("sem token → 401", async () => {
    const app = buildApp(criarPoolFake([]));
    const res = await request(app).delete("/projetos/1/membros/2");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token não informado");
  });
});

describe("ETAPA 6 — POST /projetos/:projetoId/sair (saída voluntária)", () => {
  it("membro sai → 200 com UPDATE status='saiu' e libera a vaga", async () => {
    const pool = criarPoolSoftDelete({ vagaId: 10 });
    const app = buildApp(pool);

    const res = await request(app)
      .post("/projetos/1/sair")
      .set("Authorization", `Bearer ${MEMBRO}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toBeNull();

    // CONTRATO ETAPA 6: sair = soft-delete status='saiu' (nunca DELETE físico)
    const deleteFisico = buscarChamada(pool, /delete from membros_equipe/);
    expect(deleteFisico).toBeFalsy();

    const updateSair = buscarChamada(pool, /^update membros_equipe set status/);
    expect(updateSair).toBeTruthy();
    expect(updateSair.params).toContain("saiu");
    expect(updateSair.sql).toContain("saiu_em = now()");

    // Libera a vaga vinculada do membro que saiu
    const liberaVaga = buscarChamada(pool, /^update vagas_projeto set preenchidas = greatest/);
    expect(liberaVaga).toBeTruthy();
    expect(liberaVaga.params).toEqual([10]);
  });

  it("OWNER não pode sair do projeto → 400 'Owner não pode sair do projeto'", async () => {
    const app = buildApp(criarPoolSoftDelete({ criadorProjeto: 1 }));
    const res = await request(app)
      .post("/projetos/1/sair")
      .set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(400);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Owner não pode sair do projeto");
  });

  it("membro de outro projeto / sem vínculo ativo → 404", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
        resposta: () => [[{ criador_id: 1 }], []],
      },
      {
        match: (sql) => /^update membros_equipe set status/.test(sql),
        resposta: () => [{ affectedRows: 0 }, []],
      },
      {
        match: (sql) => /^select/.test(sql),
        resposta: () => [[], []],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .post("/projetos/1/sair")
      .set("Authorization", `Bearer ${MEMBRO}`);

    expect(res.status).toBe(404);
    expect(res.body.sucesso).toBe(false);
  });

  it("projeto inexistente → 404 'Projeto não encontrado'", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
        resposta: () => [[], []],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .post("/projetos/999/sair")
      .set("Authorization", `Bearer ${MEMBRO}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Projeto não encontrado");
  });

  it("sem token → 401", async () => {
    const app = buildApp(criarPoolFake([]));
    const res = await request(app).post("/projetos/1/sair");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token não informado");
  });
});
