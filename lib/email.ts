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

export async function sendVerifyEmail(to: string, verifyUrl: string, firstName: string): Promise<void> {
  const subject = "Ověř svou e-mailovou adresu — Kantýna";
  const text = `Ahoj ${firstName},\n\npro dokončení registrace klikni na odkaz:\n${verifyUrl}\n\nOdkaz platí 24 hodin.`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg,#F59E0B,#EA580C); height: 4px; border-radius: 2px; margin-bottom: 24px;"></div>
      <h1 style="font-size: 20px; color: #1a1208; margin-bottom: 16px;">Vítej v Kantýně!</h1>
      <p style="font-size: 14px; color: #3d2c1a; line-height: 1.6;">Ahoj <strong>${escapeHtml(firstName)}</strong>,</p>
      <p style="font-size: 14px; color: #3d2c1a; line-height: 1.6;">Pro dokončení registrace klikni na tlačítko níže:</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg,#F59E0B,#EA580C); color: white; text-decoration: none; border-radius: 9999px; font-weight: 600; font-size: 14px;">
          Ověřit e-mail
        </a>
      </p>
      <p style="font-size: 12.5px; color: #7a6552; line-height: 1.6;">Odkaz platí 24 hodin. Pokud jsi se neregistroval, tento e-mail můžeš ignorovat.</p>
      <p style="font-size: 11px; color: #9b8474; margin-top: 24px; word-break: break-all;">Nebo zkopíruj URL: ${verifyUrl}</p>
    </div>
  `;
  await sendEmail({ to: [to], subject, html, text });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, firstName: string): Promise<void> {
  const subject = "Obnovení hesla — Kantýna";
  const text = `Ahoj ${firstName},\n\npro obnovení hesla klikni na odkaz:\n${resetUrl}\n\nOdkaz platí 1 hodinu.`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg,#F59E0B,#EA580C); height: 4px; border-radius: 2px; margin-bottom: 24px;"></div>
      <h1 style="font-size: 20px; color: #1a1208; margin-bottom: 16px;">Obnovení hesla</h1>
      <p style="font-size: 14px; color: #3d2c1a; line-height: 1.6;">Ahoj <strong>${escapeHtml(firstName)}</strong>,</p>
      <p style="font-size: 14px; color: #3d2c1a; line-height: 1.6;">Klikni na tlačítko níže pro nastavení nového hesla:</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg,#F59E0B,#EA580C); color: white; text-decoration: none; border-radius: 9999px; font-weight: 600; font-size: 14px;">
          Nastavit nové heslo
        </a>
      </p>
      <p style="font-size: 12.5px; color: #7a6552; line-height: 1.6;">Odkaz platí 1 hodinu. Pokud jsi o reset nepožádal, tento e-mail můžeš ignorovat.</p>
      <p style="font-size: 11px; color: #9b8474; margin-top: 24px; word-break: break-all;">Nebo zkopíruj URL: ${resetUrl}</p>
    </div>
  `;
  await sendEmail({ to: [to], subject, html, text });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function testSmtpConnection(): Promise<void> {
  const s = getSettings();
  if (!s.smtpHost) throw new Error("SMTP host není nastaven.");
  const port = Number(s.smtpPort) || 587;
  const secure = s.smtpSecure === "true" || port === 465;
  const transporter = nodemailer.createTransport({ host: s.smtpHost, port, secure, auth: { user: s.smtpUser, pass: s.smtpPass } });
  await transporter.verify();
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
