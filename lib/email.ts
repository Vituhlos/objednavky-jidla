import nodemailer from "nodemailer";
import { getSettings } from "./settings";

export function getOrderRecipients(extraEmail?: string | null): string[] {
  const settings = getSettings();
  const recipients = [settings.orderEmailTo];
  if (extraEmail?.trim()) {
    recipients.push(extraEmail.trim());
  }
  return recipients;
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
  const replyTo = s.smtpReplyTo?.trim() || undefined;

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
