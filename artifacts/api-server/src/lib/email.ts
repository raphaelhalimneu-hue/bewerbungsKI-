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

/** Verification email via Resend (verified domain bewerbungski.com). */

const FROM = "BewerbungsKI <noreply@bewerbungski.com>";

const SUBJECTS: Record<string, string> = {
  de: "Dein Bestätigungscode",
  en: "Your confirmation code",
  es: "Tu código de confirmación",
  pl: "Twój kod potwierdzający",
  ru: "Ваш код подтверждения",
  tr: "Onay kodunuz",
  uk: "Ваш код підтвердження",
  ar: "رمز التأكيد الخاص بك",
};

const INTROS: Record<string, string> = {
  de: "Gib diesen Code in BewerbungsKI ein, um deine E-Mail-Adresse zu bestätigen:",
  en: "Enter this code in BewerbungsKI to confirm your email address:",
  es: "Introduce este código en BewerbungsKI para confirmar tu correo electrónico:",
  pl: "Wpisz ten kod w BewerbungsKI, aby potwierdzić swój adres e-mail:",
  ru: "Введите этот код в BewerbungsKI, чтобы подтвердить свой адрес электронной почты:",
  tr: "E-posta adresinizi doğrulamak için bu kodu BewerbungsKI'ye girin:",
  uk: "Введіть цей код у BewerbungsKI, щоб підтвердити свою електронну адресу:",
  ar: "أدخل هذا الرمز في BewerbungsKI لتأكيد بريدك الإلكتروني:",
};

export async function sendVerificationEmail(to: string, code: string, lang = "de"): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  const l = SUBJECTS[lang] ? lang : "de";
  const dir = l === "ar" ? "rtl" : "ltr";
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: `${SUBJECTS[l]}: ${code}`,
      html: `<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1d4ed8;margin:0 0 16px">BewerbungsKI</h2>
        <p style="font-size:15px;color:#222">${INTROS[l]}</p>
        <p style="font-size:34px;font-weight:bold;letter-spacing:8px;text-align:center;background:#f1f5f9;border-radius:8px;padding:16px 0">${code}</p>
        <p style="font-size:12px;color:#888">BewerbungsKI · bewerbungski.com</p>
      </div>`,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Resend error ${resp.status}: ${body.slice(0, 300)}`);
  }
}
