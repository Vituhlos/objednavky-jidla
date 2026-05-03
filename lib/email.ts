import nodemailer from "nodemailer";
import { getSettings } from "./settings";

export function parseEmailList(value?: string | null): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of value.split(/[\n,;]+/)) {
    const email = part.trim();
    if (!email) continue;
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
    html: `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f5f0e8;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f0e8;padding:32px 16px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden">

        <!-- Header -->
        <tr>
          <td style="background-color:#EA580C;padding:20px 32px">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width:36px;height:36px;background-color:#ffffff;border-radius:8px;text-align:center;vertical-align:middle">
                  <span style="font-size:20px;line-height:36px;display:block">&#127859;</span>
                </td>
                <td style="padding-left:12px">
                  <span style="font-size:20px;font-weight:bold;color:#ffffff;font-family:Arial,Helvetica,sans-serif">Kantýna</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 16px 0;font-size:22px;font-weight:bold;color:#1c1917;font-family:Arial,Helvetica,sans-serif">Obnovení hesla</h2>
            <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#57534e;font-family:Arial,Helvetica,sans-serif">Dobrý den <strong>${firstName}</strong>,</p>
            <p style="margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#57534e;font-family:Arial,Helvetica,sans-serif">Pro obnovení hesla klikněte na tlačítko níže. Odkaz je platný <strong>1&nbsp;hodinu</strong>.</p>

            <!-- Button -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom:28px">
                  <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background-color:#EA580C;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;font-family:Arial,Helvetica,sans-serif">Obnovit heslo</a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 16px 0;font-size:13px;color:#a8a29e;font-family:Arial,Helvetica,sans-serif">Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:</p>
            <p style="margin:0;font-size:12px;color:#a8a29e;word-break:break-all;font-family:Arial,Helvetica,sans-serif">${resetUrl}</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0ebe3">
            <p style="margin:0;font-size:12px;color:#c4b8a8;font-family:Arial,Helvetica,sans-serif">Pokud jste o obnovení hesla nežádali, tento e-mail ignorujte. Váš účet je v bezpečí.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
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
