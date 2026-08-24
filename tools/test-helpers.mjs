// Sdílené zázemí pro testy v tools/*.test.mjs.

import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Zavaděč lib/
//
// lib/*.ts používá bezpříponové importy ("./db"), které native type-stripping
// v Node neumí rozřešit. Uděláme si spustitelnou kopii s doplněnými příponami
// a node_modules projektu, ať se rozřeší balíčky.
//
// Volej až po nastavení process.env (DB_PATH, PDF_FONT_DIR) — moduly si env
// čtou při načtení.
// ---------------------------------------------------------------------------
export function loadLib() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lib-"));
  const names = fs
    .readdirSync("lib")
    .filter((f) => f.endsWith(".ts"))
    .map((f) => f.replace(/\.ts$/, ""));
  const relativeImport = new RegExp(`from "\\./(${names.join("|")})"`, "g");

  for (const name of names) {
    const src = fs.readFileSync(path.join("lib", `${name}.ts`), "utf8");
    fs.writeFileSync(path.join(dir, `${name}.ts`), src.replace(relativeImport, 'from "./$1.ts"'));
  }
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module" }));
  fs.symlinkSync(path.resolve("node_modules"), path.join(dir, "node_modules"), "junction");

  return (name) => import(pathToFileURL(path.join(dir, `${name}.ts`)).href);
}

// ---------------------------------------------------------------------------
// Fonty pro PDF — v kontejneru DejaVu, jinde náhrada ze systémových fontů.
// Metriky se liší, ale stránkování ani odesílání na fontu nezávisí.
// ---------------------------------------------------------------------------
const DEJAVU_DIR = "/usr/share/fonts/truetype/dejavu";
const FONT_FALLBACKS = {
  win32: ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/segoeuii.ttf"],
  darwin: ["/Library/Fonts/Arial.ttf", "/Library/Fonts/Arial Bold.ttf", "/Library/Fonts/Arial Italic.ttf"],
};

export function resolveFontDir() {
  if (process.env.PDF_FONT_DIR) return process.env.PDF_FONT_DIR;
  if (fs.existsSync(path.join(DEJAVU_DIR, "DejaVuSans.ttf"))) return DEJAVU_DIR;

  const sources = FONT_FALLBACKS[process.platform];
  if (!sources || !sources.every((f) => fs.existsSync(f))) {
    throw new Error("Nenalezeny fonty pro PDF. Nastav PDF_FONT_DIR na adresář s DejaVuSans{,-Bold,-Oblique}.ttf.");
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fonts-"));
  const targets = ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans-Oblique.ttf"];
  sources.forEach((src, i) => fs.copyFileSync(src, path.join(dir, targets[i])));
  return dir;
}

// ---------------------------------------------------------------------------
// Falešný SMTP server
//
// Nemockujeme lib/email.ts — testuje se reálná cesta přes nodemailer, jen
// proti serveru na localhostu. Díky tomu jde věrně nasimulovat i selhání
// odeslání (server odmítne DATA), což je větev, kde se objednávka vrací
// zpět na draft.
// ---------------------------------------------------------------------------
export async function startFakeSmtp() {
  const messages = [];
  let rejectNext = false;

  const server = net.createServer((socket) => {
    let mode = "command";
    let buffer = "";
    let body = "";

    const send = (line) => socket.write(`${line}\r\n`);
    send("220 localhost ESMTP fake");

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      for (;;) {
        const cut = buffer.indexOf("\r\n");
        if (cut === -1) break;
        const line = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);

        if (mode === "data") {
          if (line === ".") {
            mode = "command";
            if (rejectNext) {
              rejectNext = false;
              send("550 Odmítnuto testem");
            } else {
              messages.push(body);
              send("250 OK");
            }
            body = "";
          } else {
            // tečka na začátku řádku je v SMTP zdvojená
            body += `${line.startsWith("..") ? line.slice(1) : line}\n`;
          }
          continue;
        }

        if (mode === "auth-user") { mode = "auth-pass"; send("334 UGFzc3dvcmQ6"); continue; }
        if (mode === "auth-pass") { mode = "command"; send("235 OK"); continue; }

        const verb = line.split(" ")[0].toUpperCase();
        if (verb === "EHLO" || verb === "HELO") {
          send("250-localhost");
          send("250-AUTH PLAIN LOGIN");
          send("250 SIZE 20971520");
        } else if (verb === "AUTH") {
          const mech = (line.split(" ")[1] || "").toUpperCase();
          if (mech === "LOGIN" && line.trim().split(/\s+/).length === 2) {
            mode = "auth-user";
            send("334 VXNlcm5hbWU6");
          } else {
            send("235 OK");
          }
        } else if (verb === "MAIL" || verb === "RCPT" || verb === "RSET" || verb === "NOOP") {
          send("250 OK");
        } else if (verb === "DATA") {
          mode = "data";
          send("354 Konec označ tečkou");
        } else if (verb === "QUIT") {
          send("221 Bye");
          socket.end();
        } else {
          send("250 OK");
        }
      }
    });

    socket.on("error", () => {});
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    port: server.address().port,
    messages,
    /** Příští pokus o odeslání server odmítne (simulace výpadku SMTP). */
    failOnce() { rejectNext = true; },
    reset() { messages.length = 0; rejectNext = false; },
    async close() { await new Promise((resolve) => server.close(resolve)); },
  };
}
