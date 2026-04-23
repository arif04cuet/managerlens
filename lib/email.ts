import imaps from "imap-simple";
import { simpleParser } from "mailparser";

export type RawEmail = {
  messageId: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  date: Date;
};

export async function fetchNewEmails(
  trackingEmail: string,
  appPassword: string,
  sinceDate: Date = new Date(Date.now() - 7 * 86_400_000)
): Promise<RawEmail[]> {
  const [user, host] = [trackingEmail, resolveImapHost(trackingEmail)];

  const connection = await imaps.connect({
    imap: {
      user,
      password: appPassword,
      host,
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    },
  });

  await connection.openBox("INBOX");

  const searchCriteria = [["SINCE", sinceDate.toDateString()]];
  const fetchOptions = { bodies: ["HEADER", "TEXT", ""], markSeen: false };

  const messages = await connection.search(searchCriteria, fetchOptions);
  connection.end();

  const emails: RawEmail[] = [];

  for (const msg of messages) {
    const all = msg.parts.find((p: { which: string }) => p.which === "");
    if (!all) continue;

    const parsed = await simpleParser(all.body);
    const messageId = parsed.messageId ?? `${Date.now()}-${Math.random()}`;
    const from = parsed.from?.text ?? "unknown";
    const to = parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map((a) => a.text).join(", ") : parsed.to.text) : "";
    const subject = parsed.subject ?? "(no subject)";
    const body = parsed.text ?? (typeof parsed.html === "string" ? parsed.html : "") ?? "";
    const date = parsed.date ?? new Date();

    emails.push({ messageId, subject, from, to, body, date });
  }

  return emails;
}

function resolveImapHost(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain === "gmail.com" || domain === "googlemail.com") return "imap.gmail.com";
  if (domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com")
    return "outlook.office365.com";
  if (domain === "yahoo.com") return "imap.mail.yahoo.com";
  // For custom domains, assume standard IMAP
  return `imap.${domain}`;
}
