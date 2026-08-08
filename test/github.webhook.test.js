import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { buildApp, criarPoolFake, setEnvAmbiente } from "./helpers/bootstrap.js";

setEnvAmbiente();
process.env.GITHUB_WEBHOOK_SECRET = "segredo-teste-webhook";

function assinar(payloadObj) {
  const raw = JSON.stringify(payloadObj);
  const sig = "sha256=" + crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET).update(raw, "utf8").digest("hex");
  return { raw, sig };
}

// Mocks do pool: INSERT IGNORE delivery, SELECT isDeliveryDuplicate, UPDATE processado/falha.
function criarPoolWebhook() {
  return criarPoolFake([
    {
      match: (sql) => /^insert ignore into github_webhook_deliveries/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    {
      match: (sql) => /^select processado from github_webhook_deliveries where delivery_id = \? limit 1$/.test(sql),
      resposta: (params) => {
        // delivery "dup-1" já foi processado
        if (params[0] === "dup-1") return [[{ processado: true }], []];
        return [[], []];
      },
    },
    {
      match: (sql) => /^update github_webhook_deliveries set processado = true/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    {
      match: (sql) => /^update github_webhook_deliveries set erro = \?/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
  ]);
}

const payloadBase = { action: "opened", repository: { id: 11, full_name: "empresa/repo" } };

describe("Webhook GitHub — assinatura e idempotência (ETAPA 4)", () => {
  let app;

  beforeEach(() => {
    app = buildApp(criarPoolWebhook());
  });

  it("assinatura correta → 200 e delivery processado", async () => {
    const { raw, sig } = assinar({ ...payloadBase, action: "opened" });
    const res = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "del-abc")
      .set("X-GitHub-Event", "pull_request")
      .set("X-Hub-Signature-256", sig)
      .send(raw)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.processado).toBe(true);
  });

  it("assinatura inválida → 401", async () => {
    const { raw } = assinar(payloadBase);
    const res = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "del-bad")
      .set("X-GitHub-Event", "push")
      .set("X-Hub-Signature-256", "sha256=" + "0".repeat(64))
      .send(raw)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(401);
    expect(res.body.message).toContain("Assinatura");
  });

  it("assinatura ausente → rejeita (401)", async () => {
    const { raw } = assinar(payloadBase);
    const res = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "del-nosig")
      .set("X-GitHub-Event", "push")
      .send(raw)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(401);
  });

  it("body adulterado (assinatura de outro payload) → 401", async () => {
    const { raw } = assinar(payloadBase);
    const adulterado = raw.replace("opened", "closed");
    const res = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "del-tamper")
      .set("X-GitHub-Event", "pull_request")
      .set("X-Hub-Signature-256", "sha256=" + crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET).update(raw, "utf8").digest("hex"))
      .send(adulterado)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(401);
  });

  it("delivery novo → processa (200)", async () => {
    const { raw, sig } = assinar(payloadBase);
    const res = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "del-novo-1")
      .set("X-GitHub-Event", "push")
      .set("X-Hub-Signature-256", sig)
      .send(raw)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.idempotente).toBeUndefined();
  });

  it("delivery repetido (já processado) → 200 idempotente sem reprocessar", async () => {
    const { raw, sig } = assinar(payloadBase);
    const res = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Delivery", "dup-1")
      .set("X-GitHub-Event", "push")
      .set("X-Hub-Signature-256", sig)
      .send(raw)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.idempotente).toBe(true);
  });

  it("X-GitHub-Delivery ausente → 400", async () => {
    const { raw, sig } = assinar(payloadBase);
    const res = await request(app)
      .post("/github/webhook")
      .set("X-GitHub-Event", "push")
      .set("X-Hub-Signature-256", sig)
      .send(raw)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("X-GitHub-Delivery");
  });
});