import nodemailer from "nodemailer";
import { getSettings } from "./settings";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmailList(value?: string | null): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of value.split(/[\n,;]+/)) {
    const email = part.trim();
    if (!email || !EMAIL_RE.test(email)) continue;
    const normalized = email.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    emails.push(email);
  }
  return emails;
}

export function getOrderRecipients(extraEmail?: string | null): string[] {
  const settings = getSettings();
  return [
    ...parseEmailList(settings.orderEmailTo),
    ...parseEmailList(settings.orderExtraEmail),
    ...parseEmailList(extraEmail),
  ];
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
}: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}): Promise<void> {
  const s = getSettings();

  if (!s.smtpHost) throw new Error("SMTP host není nastaven. Nastavte ho v Nastavení.");
  if (!s.smtpUser) throw new Error("SMTP uživatel není nastaven. Nastavte ho v Nastavení.");
  if (!s.smtpPass) throw new Error("SMTP heslo není nastaveno. Nastavte ho v Nastavení.");

  const port = Number(s.smtpPort) || 587;
  const secure = s.smtpSecure === "true" || port === 465;
  const from = s.smtpFrom || s.smtpUser;
  const replyToList = parseEmailList(s.smtpReplyTo);
  const replyTo = replyToList.length > 0 ? replyToList.join(", ") : undefined;
  if (to.length === 0) {
    throw new Error("Není nastaven žádný příjemce objednávek. Doplňte ho v Nastavení.");
  }

  const transporter = nodemailer.createTransport({ host: s.smtpHost, port, secure, auth: { user: s.smtpUser, pass: s.smtpPass } });

  await transporter.sendMail({ from, replyTo, to: to.join(", "), subject, html, text, attachments });
}

export async function testSmtpConnection(): Promise<void> {
  const s = getSettings();
  if (!s.smtpHost) throw new Error("SMTP host není nastaven.");
  const port = Number(s.smtpPort) || 587;
  const secure = s.smtpSecure === "true" || port === 465;
  const transporter = nodemailer.createTransport({ host: s.smtpHost, port, secure, auth: { user: s.smtpUser, pass: s.smtpPass } });
  await transporter.verify();
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, firstName: string): Promise<void> {
  await sendEmail({
    to: [to],
    subject: "Obnovení hesla — Kantýna",
    text: `Dobrý den ${firstName},\n\nPro obnovení hesla klikněte na odkaz:\n${resetUrl}\n\nOdkaz je platný 1 hodinu.\n\nPokud jste o obnovení hesla nežádali, tento e-mail ignorujte.`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fffdf8;border-radius:16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#F59E0B,#EA580C);display:flex;align-items:center;justify-content:center">
          <span style="color:white;font-size:20px">🍽</span>
        </div>
        <span style="font-size:20px;font-weight:800;background:linear-gradient(135deg,#D97706,#EA580C);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Kantýna</span>
      </div>
      <h2 style="color:#1c1917;font-size:18px;margin:0 0 8px">Obnovení hesla</h2>
      <p style="color:#57534e;font-size:14px;line-height:1.6">Dobrý den <strong>${firstName}</strong>,</p>
      <p style="color:#57534e;font-size:14px;line-height:1.6">Pro obnovení hesla klikněte na tlačítko níže. Odkaz je platný <strong>1 hodinu</strong>.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#F59E0B,#EA580C);color:white;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;box-shadow:0 6px 16px -6px rgba(245,158,11,0.5)">Obnovit heslo</a>
      </div>
      <p style="color:#a8a29e;font-size:12px">Pokud jste o obnovení hesla nežádali, tento e-mail ignorujte.</p>
    </div>`,
  });
}

export async function testSmtpConnectionWith(config: {
  host: string; port: string; user: string; pass: string; secure: string;
}): Promise<void> {
  if (!config.host) throw new Error("SMTP host není zadán.");
  const port = Number(config.port) || 587;
  const secure = config.secure === "true" || port === 465;
  const transporter = nodemailer.createTransport({ host: config.host, port, secure, auth: { user: config.user, pass: config.pass } });
  await transporter.verify();
}
