import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * API odeslání připomínky a „Moje připomínky“ proti dočasné SQLite.
 *
 * Routa je veřejná, takže hlídáme hlavně to, co by šlo zneužít: limity
 * velikosti a počtu, podvržené soubory, past na roboty, rate limit —
 * a že tajný kód nikomu jinému stav cizí připomínky neukáže.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/telegram", async (orig) => ({
  ...(await orig<typeof import("@/lib/telegram")>()),
  sendTelegramFeedbackNotification: vi.fn(async () => {}),
}));

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "feedback-route-")), "test.db");

type Route = typeof import("./route");
type MineRoute = typeof import("./mine/route");
type VoteRoute = typeof import("./vote/route");
let VOTE: VoteRoute["POST"];
let POST: Route["POST"];
let MINE: MineRoute["POST"];
let png: Buffer;

beforeAll(async () => {
  ({ POST } = await import("./route"));
  ({ POST: MINE } = await import("./mine/route"));
  ({ POST: VOTE } = await import("./vote/route"));
  png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#ea580c" } }).png().toBuffer();
});

let ipCounter = 0;
/** Každý test vlastní IP, ať se rate limity nepřelévají mezi případy. */
function freshIp() {
  ipCounter += 1;
  return `10.20.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

async function send(fields: Record<string, string>, files: { data: Buffer | string; type: string }[] = [], ip = freshIp()) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  files.forEach((f, i) => form.append("attachments", new Blob([typeof f.data === "string" ? f.data : new Uint8Array(f.data)], { type: f.type }), `soubor-${i}`));
  const req = new Request("http://localhost/api/feedback", { method: "POST", body: form, headers: { "x-forwarded-for": ip } });
  // Request z FormData si Content-Length dopočítá až při odeslání — tady ho doplníme ručně
  const body = await req.arrayBuffer();
  const res = await POST(new Request(req.url, {
    method: "POST",
    body,
    headers: { "content-type": req.headers.get("content-type")!, "content-length": String(body.byteLength), "x-forwarded-for": ip },
  }) as never);
  return { status: res.status, json: await res.json() as { ok: boolean; error?: string; id?: number; token?: string } };
}

const valid = { category: "chyba", message: "Tlačítko Uložit nic nedělá." };

describe("POST /api/feedback", () => {
  it("uloží platnou připomínku a vrátí tajný kód", async () => {
    const { status, json } = await send(valid);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.id).toBeGreaterThan(0);
    expect(json.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("přijme screenshot", async () => {
    const { status, json } = await send(valid, [{ data: png, type: "image/png" }]);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("odmítne neplatnou kategorii i krátký text", async () => {
    expect((await send({ ...valid, category: "admin" })).status).toBe(400);
    expect((await send({ ...valid, message: "ok" })).status).toBe(400);
  });

  it("odmítne soubor, který není obrázek", async () => {
    const { status, json } = await send(valid, [{ data: "<html><script>alert(1)</script></html>", type: "image/png" }]);
    expect(status).toBe(400);
    expect(json.error).toContain("obrázek");
  });

  it("odmítne víc než 3 obrázky", async () => {
    const four = Array.from({ length: 4 }, () => ({ data: png, type: "image/png" }));
    expect((await send(valid, four)).status).toBe(400);
  });

  it("odmítne požadavek bez Content-Length i příliš velký", async () => {
    const noLength = await POST(new Request("http://localhost/api/feedback", { method: "POST" }) as never);
    expect(noLength.status).toBe(411);
    const huge = await POST(new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "content-length": String(100 * 1024 * 1024) },
    }) as never);
    expect(huge.status).toBe(413);
  });

  it("robotovi s vyplněnou pastí odpoví úspěchem, ale nic neuloží", async () => {
    const { status, json } = await send({ ...valid, website: "http://spam.example" });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.token).toBeUndefined();
  });

  it("po pěti připomínkách z jedné IP vrátí 429", async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) expect((await send(valid, [], ip)).status).toBe(200);
    expect((await send(valid, [], ip)).status).toBe(429);
  });
});

async function mine(items: unknown) {
  const body = JSON.stringify({ items });
  const res = await MINE(new Request("http://localhost/api/feedback/mine", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)), "x-forwarded-for": freshIp() },
  }) as never);
  return { status: res.status, json: await res.json() as { ok: boolean; items?: { id: number; message: string }[] } };
}

describe("POST /api/feedback/mine", () => {
  it("se správným kódem vrátí vlastní připomínku, s cizím nic", async () => {
    const a = (await send({ ...valid, message: "Moje připomínka A" })).json;
    const b = (await send({ ...valid, message: "Cizí připomínka B" })).json;

    const own = await mine([{ id: a.id, token: a.token }]);
    expect(own.status).toBe(200);
    expect(own.json.items?.map((i) => i.message)).toEqual(["Moje připomínka A"]);

    const stolen = await mine([{ id: b.id, token: a.token }]);
    expect(stolen.json.items).toEqual([]);
  });

  it("odmítne nesmyslný požadavek", async () => {
    expect((await mine("nesmysl")).status).toBe(400);
    expect((await mine(Array.from({ length: 51 }, (_, i) => ({ id: i + 1, token: "x".repeat(20) })))).status).toBe(400);
  });
});

async function vote(payload: unknown) {
  const body = JSON.stringify(payload);
  const res = await VOTE(new Request("http://localhost/api/feedback/vote", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)), "x-forwarded-for": freshIp() },
  }) as never);
  return { status: res.status, json: await res.json() as { ok: boolean; votes?: number } };
}

describe("POST /api/feedback/vote", () => {
  it("o nezveřejněné připomínce hlasovat nejde", async () => {
    const created = (await send(valid)).json;
    expect((await vote({ id: created.id, voter: "v".repeat(24), vote: true })).status).toBe(404);
  });

  it("zveřejněná připomínka hlas přijme, druhý hlas stejného prohlížeče ne", async () => {
    const created = (await send(valid)).json;
    const { updateFeedback } = await import("@/lib/feedback");
    updateFeedback(created.id!, { status: "planned", voteTitle: "Shrnutí", votable: true });
    expect((await vote({ id: created.id, voter: "w".repeat(24), vote: true })).json.votes).toBe(1);
    expect((await vote({ id: created.id, voter: "w".repeat(24), vote: true })).json.votes).toBe(1);
    expect((await vote({ id: created.id, voter: "x".repeat(24), vote: true })).json.votes).toBe(2);
  });

  it("odmítne nesmyslný požadavek", async () => {
    expect((await vote({ id: "1", voter: "w".repeat(24), vote: true })).status).toBe(400);
    expect((await vote({ id: 1, voter: "krátký", vote: true })).status).toBe(400);
  });
});
