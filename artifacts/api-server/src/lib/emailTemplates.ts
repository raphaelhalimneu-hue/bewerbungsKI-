export interface DocumentEmailData {
  documentId: string;
  documentName: string;
  jobTitle?: string;
  jobCompany?: string;
  hasCoverLetter: boolean;
  appUrl: string;
  language?: string;
}

// Translations for the email template
const translations: Record<string, {
  subject: (name: string) => string;
  greeting: string;
  intro: (name: string) => string;
  bodyText: string;
  viewDocuments: string;
  tipTitle: string;
  tipText: string;
  documentsIncluded: string;
  cvLabel: string;
  coverLetterLabel: string;
  footer: string;
  appName: string;
}> = {
  de: {
    subject: (name) => `✅ Deine Bewerbungsunterlagen sind fertig – ${name}`,
    greeting: "Hallo,",
    intro: (name) => `deine Bewerbungsunterlagen für <strong>${name}</strong> wurden erfolgreich erstellt!`,
    bodyText: "Melde dich in der App an, um deine Dokumente anzusehen und als PDF oder Word herunterzuladen:",
    viewDocuments: "Unterlagen ansehen & herunterladen",
    tipTitle: "💡 Tipp",
    tipText: "Du kannst deine Unterlagen jederzeit in der App bearbeiten und erneut herunterladen.",
    documentsIncluded: "Enthaltene Dokumente:",
    cvLabel: "📄 Lebenslauf",
    coverLetterLabel: "✉️ Anschreiben",
    footer: "Du erhältst diese E-Mail, weil du BewerbungsKI verwendet hast.",
    appName: "BewerbungsKI",
  },
  en: {
    subject: (name) => `✅ Your application documents are ready – ${name}`,
    greeting: "Hello,",
    intro: (name) => `your application documents for <strong>${name}</strong> have been successfully created!`,
    bodyText: "Sign in to the app to view your documents and download them as PDF or Word:",
    viewDocuments: "View & download documents",
    tipTitle: "💡 Tip",
    tipText: "You can edit your documents anytime in the app and download them again.",
    documentsIncluded: "Documents included:",
    cvLabel: "📄 CV / Resume",
    coverLetterLabel: "✉️ Cover Letter",
    footer: "You're receiving this email because you used BewerbungsKI.",
    appName: "BewerbungsKI",
  },
  tr: {
    subject: (name) => `✅ Başvuru belgeleriniz hazır – ${name}`,
    greeting: "Merhaba,",
    intro: (name) => `<strong>${name}</strong> için başvuru belgeleriniz başarıyla oluşturuldu!`,
    bodyText: "Belgelerinizi görüntülemek ve PDF veya Word olarak indirmek için uygulamaya giriş yapın:",
    viewDocuments: "Belgeleri görüntüle ve indir",
    tipTitle: "💡 İpucu",
    tipText: "Belgelerinizi istediğiniz zaman uygulamada düzenleyebilir ve tekrar indirebilirsiniz.",
    documentsIncluded: "Dahil edilen belgeler:",
    cvLabel: "📄 Özgeçmiş",
    coverLetterLabel: "✉️ Ön Yazı",
    footer: "BewerbungsKI kullandığınız için bu e-postayı alıyorsunuz.",
    appName: "BewerbungsKI",
  },
  ar: {
    subject: (name) => `✅ وثائق طلبك جاهزة – ${name}`,
    greeting: "مرحباً،",
    intro: (name) => `تم إنشاء وثائق طلبك لـ <strong>${name}</strong> بنجاح!`,
    bodyText: "قم بتسجيل الدخول إلى التطبيق لعرض وثائقك وتنزيلها بصيغة PDF أو Word:",
    viewDocuments: "عرض وتنزيل الوثائق",
    tipTitle: "💡 نصيحة",
    tipText: "يمكنك تعديل وثائقك في أي وقت في التطبيق وتنزيلها مرة أخرى.",
    documentsIncluded: "الوثائق المتضمنة:",
    cvLabel: "📄 السيرة الذاتية",
    coverLetterLabel: "✉️ خطاب التقديم",
    footer: "تتلقى هذا البريد الإلكتروني لأنك استخدمت BewerbungsKI.",
    appName: "BewerbungsKI",
  },
  uk: {
    subject: (name) => `✅ Ваші документи для заявки готові – ${name}`,
    greeting: "Привіт,",
    intro: (name) => `ваші документи для заявки на <strong>${name}</strong> успішно створені!`,
    bodyText: "Увійдіть у додаток, щоб переглянути та завантажити документи у форматі PDF або Word:",
    viewDocuments: "Переглянути та завантажити",
    tipTitle: "💡 Порада",
    tipText: "Ви можете редагувати документи в будь-який час у додатку та завантажувати їх знову.",
    documentsIncluded: "Включені документи:",
    cvLabel: "📄 Резюме",
    coverLetterLabel: "✉️ Супровідний лист",
    footer: "Ви отримуєте цей лист, тому що використовували BewerbungsKI.",
    appName: "BewerbungsKI",
  },
  ru: {
    subject: (name) => `✅ Ваши документы для заявки готовы – ${name}`,
    greeting: "Привет,",
    intro: (name) => `ваши документы для заявки на <strong>${name}</strong> успешно созданы!`,
    bodyText: "Войдите в приложение, чтобы просмотреть и скачать документы в формате PDF или Word:",
    viewDocuments: "Просмотреть и скачать",
    tipTitle: "💡 Совет",
    tipText: "Вы можете редактировать документы в любое время в приложении и скачивать их снова.",
    documentsIncluded: "Включённые документы:",
    cvLabel: "📄 Резюме",
    coverLetterLabel: "✉️ Сопроводительное письмо",
    footer: "Вы получаете это письмо, потому что использовали BewerbungsKI.",
    appName: "BewerbungsKI",
  },
  pl: {
    subject: (name) => `✅ Twoje dokumenty aplikacyjne są gotowe – ${name}`,
    greeting: "Cześć,",
    intro: (name) => `twoje dokumenty aplikacyjne dla <strong>${name}</strong> zostały pomyślnie utworzone!`,
    bodyText: "Zaloguj się do aplikacji, aby wyświetlić i pobrać dokumenty jako PDF lub Word:",
    viewDocuments: "Wyświetl i pobierz dokumenty",
    tipTitle: "💡 Wskazówka",
    tipText: "Możesz edytować dokumenty w dowolnym momencie w aplikacji i pobierać je ponownie.",
    documentsIncluded: "Dołączone dokumenty:",
    cvLabel: "📄 CV",
    coverLetterLabel: "✉️ List motywacyjny",
    footer: "Otrzymujesz ten e-mail, ponieważ korzystałeś z BewerbungsKI.",
    appName: "BewerbungsKI",
  },
  es: {
    subject: (name) => `✅ Tus documentos de solicitud están listos – ${name}`,
    greeting: "Hola,",
    intro: (name) => `tus documentos de solicitud para <strong>${name}</strong> han sido creados con éxito.`,
    bodyText: "Inicia sesión en la app para ver y descargar tus documentos en PDF o Word:",
    viewDocuments: "Ver y descargar documentos",
    tipTitle: "💡 Consejo",
    tipText: "Puedes editar tus documentos en cualquier momento en la aplicación y volver a descargarlos.",
    documentsIncluded: "Documentos incluidos:",
    cvLabel: "📄 Currículum",
    coverLetterLabel: "✉️ Carta de presentación",
    footer: "Recibes este correo porque usaste BewerbungsKI.",
    appName: "BewerbungsKI",
  },
};

const SUPPORTED_LANGS = Object.keys(translations);

function getT(language?: string) {
  const lang = language && SUPPORTED_LANGS.includes(language) ? language : "de";
  return translations[lang];
}

function buildDocumentLabel(data: DocumentEmailData): string {
  if (data.jobTitle && data.jobCompany) return `${data.jobTitle} bei ${data.jobCompany}`;
  if (data.jobTitle) return data.jobTitle;
  if (data.jobCompany) return data.jobCompany;
  return data.documentName;
}

/** Build the URL to the authenticated preview page in the app (language-aware). */
function buildPreviewUrl(appUrl: string, documentId: string, language?: string): string {
  const base = appUrl.replace(/\/$/, "");
  // German lives at root; all other supported languages get a /{lang} prefix.
  const langPrefix = language && language !== "de" && SUPPORTED_LANGS.includes(language)
    ? `/${language}`
    : "";
  return `${base}${langPrefix}/preview/${documentId}`;
}

export function buildDocumentEmail(data: DocumentEmailData): { subject: string; html: string } {
  const t = getT(data.language);
  const label = buildDocumentLabel(data);
  const subject = t.subject(label);

  const previewUrl = buildPreviewUrl(data.appUrl, data.documentId, data.language);
  const isRtl = data.language === "ar";
  const dir = isRtl ? "rtl" : "ltr";

  // Document list (no direct download links — those endpoints require Bearer auth)
  const docsListItems = [
    `<li style="margin-bottom:6px;">${t.cvLabel}</li>`,
    data.hasCoverLetter ? `<li style="margin-bottom:6px;">${t.coverLetterLabel}</li>` : "",
  ].filter(Boolean).join("\n");

  const html = `<!DOCTYPE html>
<html lang="${data.language || "de"}" dir="${dir}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;" dir="${dir}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">${t.appName}</h1>
              <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Bewerbungsunterlagen KI</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#374151;">${t.greeting}</p>
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">
                ${t.intro(label)}
              </p>

              <!-- Document list -->
              <div style="background:#f0f9ff;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#1e40af;">${t.documentsIncluded}</p>
                <ul style="margin:0;padding-${isRtl ? "right" : "left"}:20px;color:#1e40af;font-size:14px;">
                  ${docsListItems}
                </ul>
              </div>

              <p style="margin:0 0 32px;font-size:15px;color:#6b7280;">${t.bodyText}</p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${previewUrl}"
                       style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;letter-spacing:0.2px;">
                      ${t.viewDocuments} →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Tip box -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;margin-bottom:32px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 4px;font-weight:600;font-size:14px;color:#1e40af;">${t.tipTitle}</p>
                    <p style="margin:0;font-size:14px;color:#1e40af;line-height:1.5;">${t.tipText}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">${t.footer}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
