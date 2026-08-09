import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// Regressão de segurança — Lote 2 da auditoria (docs/RELATORIO_AUDITORIA_SEGURANCA.md):
//   A2  ex-membro (saiu/removido) NÃO mantém acesso ao projeto
//   A3  IDOR write em /habilidades-projeto (dono validado pelo projeto REAL)
//   A4  IDOR write em /habilidades-usuario (usuario_id sempre do token)
//   M7  GET /usuarios não expõe email/tipo
//   M8  GET /projetos/:id/membros não expõe email/bio/localização
//   M9  PATCH /projetos/:id não aceita criador_id (mass assignment)
//   M10 projeto privado não vaza vagas para não-membros

const DONO = tokenPara({ id: 1, email: "dono@email.com", nome: "Dono" });
const ATACANTE = tokenPara({ id: 5, email: "atacante@email.com", nome: "Atacante" });

describe("A2 — ex-membro (saiu/removido) não mantém acesso ao projeto", () => {
  it("GET /projetos/1/tarefas com vínculo inativo → 403 (middleware filtra status='ativo')", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
        resposta: () => [[{ criador_id: 1 }], []], // dono é o usuário 1, não o 5
      },
      {
        match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo' limit 1$/.test(sql),
        resposta: () => [[], []], // ex-membro: nenhum vínculo ATIVO
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .get("/projetos/1/tarefas")
      .set("Authorization", `Bearer ${ATACANTE}`);

    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toContain("membro do squad");
  });
});

describe("A3 — IDOR write em /habilidades-projeto", () => {
  it("PATCH /habilidades-projeto/:id com projeto de OUTRO dono no body → 403 (sem UPDATE)", async () => {
    const pool = criarPoolFake([
      {
        // Middleware somenteDonoDoProjeto valida params.id (=1, projeto do ATACANTE) → passa
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
        resposta: (params) => (params[0] === "1" ? [[{ criador_id: 5 }], []] : [[{ criador_id: 1 }], []]),
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .patch("/habilidades-projeto/1")
      .set("Authorization", `Bearer ${ATACANTE}`)
      .send({ projeto_id: 2, habilidade_id: 3 }); // projeto 2 é do DONO (id 1)

    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toContain("proprietário do projeto");
    // Nenhuma escrita em habilidades_projeto foi executada
    expect(buscarChamada(pool, /update habilidades_projeto/)).toBeUndefined();
    expect(buscarChamada(pool, /delete from habilidades_projeto/)).toBeUndefined();
  });

  it("DELETE /habilidades-projeto/:id com projeto de OUTRO dono no body → 403", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
        resposta: (params) => (params[0] === "1" ? [[{ criador_id: 5 }], []] : [[{ criador_id: 1 }], []]),
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .delete("/habilidades-projeto/1")
      .set("Authorization", `Bearer ${ATACANTE}`)
      .send({ projeto_id: 2, habilidade_id: 3 });

    expect(res.status).toBe(403);
    expect(buscarChamada(pool, /delete from habilidades_projeto/)).toBeUndefined();
  });

  it("dono do projeto REAL consegue editar → 200", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
        resposta: () => [[{ criador_id: 1 }], []],
      },
      {
        match: (sql) => /^update habilidades_projeto set projeto_id = \?, habilidade_id = \? where projeto_id = \? and habilidade_id = \?$/.test(sql),
        resposta: () => [{ affectedRows: 1 }, []],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .patch("/habilidades-projeto/1")
      .set("Authorization", `Bearer ${DONO}`)
      .send({ projeto_id: 2, habilidade_id: 3 });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });
});

describe("A4 — IDOR write em /habilidades-usuario", () => {
  it("POST /habilidades-usuario com usuario_id de OUTRO no body → insere com o id do TOKEN", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^insert into habilidades_usuario \(usuario_id, habilidade_id, nivel\) values \(\?, \?, \?\)$/.test(sql),
        resposta: () => [{ insertId: 1, affectedRows: 1 }, []],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .post("/habilidades-usuario")
      .set("Authorization", `Bearer ${ATACANTE}`)
      .send({ usuario_id: 999, habilidade_id: 1, nivel: "avancado" }); // tenta gravar no perfil de outro

    expect(res.status).toBe(200);
    expect(res.body.dados.usuario_id).toBe(5); // resposta reflete o token, não o body

    const insert = buscarChamada(pool, /^insert into habilidades_usuario/);
    expect(insert).toBeDefined();
    expect(insert.params[0]).toBe(5); // usuario_id gravado = token (nunca 999)
  });

  it("PATCH /habilidades-usuario/:id com usuario_id de OUTRO no body → altera as PRÓPRIAS", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^update habilidades_usuario set nivel = \? where usuario_id = \? and habilidade_id = \?$/.test(sql),
        resposta: () => [{ affectedRows: 1 }, []],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .patch("/habilidades-usuario/1")
      .set("Authorization", `Bearer ${ATACANTE}`)
      .send({ usuario_id: 999, habilidade_id: 1, nivel: "iniciante" });

    expect(res.status).toBe(200);
    const update = buscarChamada(pool, /^update habilidades_usuario/);
    expect(update).toBeDefined();
    expect(update.params[1]).toBe(5); // WHERE usuario_id = token (nunca 999)
  });
});

describe("M7 — GET /usuarios não expõe email/tipo", () => {
  it("listagem retorna apenas campos públicos de perfil", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select id, nome, bio, localizacao, avatar_url, criado_em from usuarios$/.test(sql),
        resposta: () => [
          [
            { id: 1, nome: "Dono", bio: "bio", localizacao: "SP", avatar_url: null, criado_em: "2026-01-01T00:00:00.000Z" },
            { id: 2, nome: "Lucas", bio: null, localizacao: null, avatar_url: null, criado_em: "2026-01-02T00:00:00.000Z" },
          ],
          [],
        ],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app).get("/usuarios").set("Authorization", `Bearer ${ATACANTE}`);

    expect(res.status).toBe(200);
    expect(res.body.dados[0].nome).toBe("Dono");
    expect(res.body.dados[0].email).toBeUndefined();
    expect(res.body.dados[0].tipo).toBeUndefined();
    expect(res.body.dados[1].email).toBeUndefined();
    expect(res.body.dados[1].tipo).toBeUndefined();
  });
});

describe("M8 — GET /projetos/:id/membros não expõe email/bio/localização", () => {
  it("listagem de membros retorna apenas dados públicos do squad", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select me\.id, me\.usuario_id, me\.funcao, me\.funcao_id, f\.nome as funcao_nome, me\.vaga_id, me\.status, me\.entrou_em, me\.saiu_em, u\.nome as usuario_nome from membros_equipe me join usuarios u on me\.usuario_id = u\.id left join funcoes f on me\.funcao_id = f\.id where me\.projeto_id = \? and me\.status = 'ativo' order by me\.entrou_em$/.test(sql),
        resposta: () => [
          [
            {
              id: 1, usuario_id: 1, funcao: "Líder", funcao_id: null, funcao_nome: null,
              vaga_id: null, status: "ativo", entrou_em: "2026-01-01T00:00:00.000Z", saiu_em: null,
              usuario_nome: "Dono",
            },
          ],
          [],
        ],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .get("/projetos/1/membros")
      .set("Authorization", `Bearer ${ATACANTE}`);

    expect(res.status).toBe(200);
    expect(res.body.dados[0].usuario_nome).toBe("Dono");
    expect(res.body.dados[0].usuario_email).toBeUndefined();
    expect(res.body.dados[0].usuario_bio).toBeUndefined();
    expect(res.body.dados[0].usuario_localizacao).toBeUndefined();

    // M8 na fonte: o SELECT gravado NÃO pede mais email/bio/localização
    const select = buscarChamada(pool, /^select me\.id, me\.usuario_id/);
    expect(select).toBeDefined();
    expect(select.sql).not.toContain("u.email");
    expect(select.sql).not.toContain("u.bio");
    expect(select.sql).not.toContain("u.localizacao");
  });
});

describe("M9 — PATCH /projetos/:id não aceita criador_id (mass assignment)", () => {
  it("criador_id no body é IGNORADO — UPDATE não contém a coluna", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
        resposta: () => [[{ criador_id: 1 }], []], // middleware: DONO é o usuário 1
      },
      {
        match: (sql) => /^update projetos set .+ where id = \?$/.test(sql),
        resposta: () => [{ affectedRows: 1 }, []],
      },
      {
        match: (sql) => /^select id, criador_id, titulo, descricao, status, visibilidade, permitir_portfolio_publico, limite_membros, repositorio_url, figma_url, discord_url, documentacao_url from projetos where id = \? limit 1$/.test(sql),
        resposta: () => [[{ id: 1, criador_id: 1, titulo: "X", descricao: null, status: "aberto", visibilidade: "publico", permitir_portfolio_publico: 1, limite_membros: 5, repositorio_url: null, figma_url: null, discord_url: null, documentacao_url: null }], []],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .patch("/projetos/1")
      .set("Authorization", `Bearer ${DONO}`)
      .send({ criador_id: 999, titulo: "X" }); // tenta transferir o projeto

    expect(res.status).toBe(200);
    expect(res.body.dados.criador_id).toBe(1); // dono inalterado

    const update = buscarChamada(pool, /^update projetos set/);
    expect(update).toBeDefined();
    expect(update.sql).not.toContain("criador_id"); // coluna fora do allowlist
    expect(update.params).not.toContain(999);
  });
});

describe("M10 — projeto privado não vaza vagas para não-membros", () => {
  it("GET /projetos/1 (privado, não-membro) → vagas = []", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select p\.id, p\.criador_id, u\.nome as criador_nome/.test(sql),
        resposta: () => [
          [
            {
              id: 1, criador_id: 1, criador_nome: "Dono", name: "Squad Privado", description: "desc",
              status: "aberto", visibilidade: "privado", permitirPortfolioPublico: 1,
              membersLimit: 5, repositorioUrl: "https://github.com/x", figmaUrl: null,
              discordUrl: null, documentacaoUrl: null, createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          [],
        ],
      },
      {
        match: (sql) => /^select h\.nome from habilidades_projeto hp/.test(sql),
        resposta: () => [[], []],
      },
      {
        match: (sql) => /^select v\.id, v\.funcao_id, f\.nome as funcao_nome/.test(sql),
        resposta: () => [
          [
            {
              id: 1, funcao_id: 1, funcao_nome: "Backend", quantidade: 2, preenchidas: 1,
              descricao: "vaga sensível", nivel_desejado: "pleno", status: "aberta",
              criado_em: "2026-01-01T00:00:00.000Z",
            },
          ],
          [],
        ],
      },
      {
        match: (sql) => /^select u\.id, u\.nome, 'membro' as role from membros_equipe me/.test(sql),
        resposta: () => [[], []],
      },
      {
        // skills de cada membro (members são populados mesmo fora do squad)
        match: (sql) => /^select h\.nome from habilidades_usuario hu/.test(sql),
        resposta: () => [[], []],
      },
      {
        // checagem de privacidade: usuário 5 NÃO é membro
        match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \?$/.test(sql),
        resposta: () => [[], []],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .get("/projetos/1")
      .set("Authorization", `Bearer ${ATACANTE}`);

    expect(res.status).toBe(200);
    expect(res.body.dados.vagas).toEqual([]); // M10: vagas ocultas
    expect(res.body.dados.tasks).toEqual([]);
    expect(res.body.dados.messages).toEqual([]);
    expect(res.body.dados.applications).toEqual([]);
    expect(res.body.dados.repositorioUrl).toBeNull(); // regra ETAPA 14 mantida
  });
});