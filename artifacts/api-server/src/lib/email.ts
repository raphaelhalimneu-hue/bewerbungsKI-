import nodemailer from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    // SMTP not configured — log and skip silently
    console.info("[email] SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing), skipping email");
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@bewerbungski.com";

  try {
    await transporter.sendMail({
      from: `BewerbungsKI <${from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return true;
  } catch (err) {
    console.error("[email] Failed to send email:", err);
    return false;
  }
}
