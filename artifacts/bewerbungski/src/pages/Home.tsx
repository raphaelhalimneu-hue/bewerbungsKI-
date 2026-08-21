import { Layout } from "../components/Layout";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { FiArrowRight, FiCheck, FiZap, FiLayout, FiGlobe, FiLinkedin, FiDownload, FiCamera } from "react-icons/fi";
import { useEffect, useMemo, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { renderCVContent, type CVContent } from "../lib/buildCVHTML";

// ── FAQ accordion ─────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "16px 20px", cursor: "pointer",
        transition: "border-color .15s",
        borderColor: open ? "var(--brand)" : "var(--border)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{q}</span>
        <span style={{ color: "var(--brand)", fontSize: 18, flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </div>
      {open && <p style={{ marginTop: 10, fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>{a}</p>}
    </div>
  );
}

// ── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{
      background: "var(--bg2)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "20px 18px",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: "var(--brand-l)", color: "var(--brand)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, marginBottom: 12,
      }}>
        {icon}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

// ── Example CV showcase (rendered with a real template) ──────────────────────
const EXAMPLE_PFLEGE: CVContent = {
  name: "Laura Sommer",
  title: "Examinierte Pflegefachkraft",
  contact: "Lindenstraße 24, 30159 Hannover · +49 170 1234567 · laura.sommer@mail.de",
  profile: "Examinierte Pflegefachkraft mit acht Jahren Erfahrung in der stationären Alten- und Langzeitpflege. Sicher in Grund- und Behandlungspflege, Pflegeplanung und Dokumentation nach aktuellen Standards. Übernimmt Verantwortung für Auszubildende und arbeitet eng mit Ärzten und Angehörigen zusammen. Ruhig und zugewandt, auch in fordernden Situationen.",
  experience: [
    { position: "Auszubildende Altenpflege", company: "Seniorenheim am Park", location: "Hannover", period: "08/2015 – 07/2018", bullets: ["Erlernen der Grund- und Behandlungspflege unter Anleitung erfahrener Fachkräfte", "Unterstützung bei Mobilisation, Aktivierung und Alltagsbegleitung der Bewohner", "Mitwirkung an Pflegedokumentation und Übergaben im Drei-Schicht-System"] },
    { position: "Examinierte Pflegefachkraft", company: "Seniorenheim am Park", location: "Hannover", period: "08/2018 – 06/2022", bullets: ["Eigenverantwortliche Pflege und Betreuung von 24 Bewohnern in allen Pflegegraden", "Erstellung und Aktualisierung von Pflegeplanungen sowie lückenlose Pflegedokumentation", "Durchführung von Medikamentengabe und Vitalzeichenkontrollen nach ärztlicher Verordnung", "Enge Zusammenarbeit mit Ärzten, Therapeuten und Angehörigen"] },
    { position: "Pflegefachkraft & Praxisanleiterin", company: "AWO Pflegezentrum", location: "Hannover", period: "07/2022 – heute", bullets: ["Fachliche Anleitung und Bewertung von jährlich bis zu 6 Auszubildenden", "Einarbeitung neuer Kolleginnen und Kollegen sowie Mitgestaltung der Dienstplanung", "Wundmanagement und Umsetzung aktueller Expertenstandards auf der Station", "Ansprechpartnerin für Qualitätsprüfungen des MDK — Station zuletzt mit Note 1,2 bewertet"] },
  ],
  education: [
    { degree: "Realschulabschluss", institution: "Realschule Hannover-Mitte", location: "Hannover", period: "2015", note: "Abschlussnote 2,1" },
    { degree: "Ausbildung zur examinierten Altenpflegerin", institution: "Pflegeschule Hannover", location: "Hannover", period: "08/2015 – 07/2018", note: "Theoretische Ausbildung parallel zur praktischen Tätigkeit, Abschlussnote 1,8" },
    { degree: "Weiterbildung Praxisanleitung (300 Std.)", institution: "Bildungszentrum Pflege Niedersachsen", location: "Hannover", period: "01/2022 – 06/2022", note: "Berufsbegleitend, mit Zertifikat abgeschlossen" },
  ],
  skills: ["Grund- und Behandlungspflege", "Pflegedokumentation & Pflegeplanung", "Medikamentenmanagement", "Wundversorgung & Expertenstandards", "Praxisanleitung von Auszubildenden", "Mobilisation & Lagerungstechniken", "Umgang mit demenziell erkrankten Menschen", "Hygiene- und Infektionsschutz"],
  languages: [{ name: "Deutsch", level: "Muttersprache" }, { name: "Englisch", level: "Gut in Wort und Schrift" }, { name: "Polnisch", level: "Grundkenntnisse" }],
  signature: "Hannover, den 13.08.2026",
};

// One example per app language, adapted to the CV standards of that country.
const EXAMPLE_EN: CVContent = {
  name: "Laura Sommer",
  title: "Registered Care Nurse",
  contact: "Hanover, Germany · +49 170 1234567 · laura.sommer@mail.de · linkedin.com/in/laurasommer",
  profile: "Registered care nurse with eight years of experience in residential long-term care. Skilled in basic and treatment care, care planning and documentation to current standards. Mentors trainees and works closely with physicians and families. Calm and empathetic, even in demanding situations.",
  experience: [
    { position: "Care Trainee", company: "Seniorenheim am Park", location: "Hanover, Germany", period: "Aug 2015 – Jul 2018", bullets: ["Learned basic and treatment care under the guidance of experienced staff", "Supported mobilisation, activation and daily-life assistance of residents", "Contributed to care documentation and shift handovers"] },
    { position: "Registered Care Nurse", company: "Seniorenheim am Park", location: "Hanover, Germany", period: "Aug 2018 – Jun 2022", bullets: ["Independently cared for 24 residents across all care levels", "Created and updated care plans with complete documentation", "Administered medication and monitored vital signs as prescribed"] },
    { position: "Care Nurse & Clinical Mentor", company: "AWO Care Centre", location: "Hanover, Germany", period: "Jul 2022 – present", bullets: ["Mentored and assessed up to 6 trainees per year", "Onboarded new colleagues and contributed to shift planning", "Wound management and implementation of current expert standards", "Point of contact for quality audits — ward last rated 1.2 (excellent)"] },
  ],
  education: [
    { degree: "Secondary School Certificate", institution: "Realschule Hannover-Mitte", location: "Hanover", period: "2015", note: "" },
    { degree: "Vocational Qualification in Geriatric Nursing", institution: "Pflegeschule Hannover", location: "Hanover", period: "2015 – 2018", note: "Final grade: 1.8 (very good)" },
    { degree: "Clinical Mentorship Certificate (300 hrs)", institution: "Bildungszentrum Pflege Niedersachsen", location: "Hanover", period: "2022", note: "Completed alongside full-time work" },
  ],
  skills: ["Basic & treatment care", "Care planning & documentation", "Medication management", "Wound care & expert standards", "Mentoring of trainees", "Mobilisation & positioning techniques", "Dementia care", "Hygiene & infection control"],
  languages: [{ name: "German", level: "Native" }, { name: "English", level: "Fluent" }, { name: "Polish", level: "Basic" }],
  signature: "References available upon request",
};

const EXAMPLE_TR: CVContent = {
  name: "Elif Kaya",
  title: "Hemşire",
  contact: "Lindenstraße 24, 30459 Hannover · +49 170 1234567 · elif.kaya@mail.de",
  profile: "Yatılı bakım ve uzun süreli bakım alanında sekiz yıllık deneyime sahip hemşire. Temel bakım, tedavi bakımı, bakım planlaması ve güncel standartlara uygun dokümantasyon konularında yetkin. Stajyerlere rehberlik eder, doktorlar ve hasta yakınlarıyla yakın iş birliği içinde çalışır. Zor durumlarda dahi sakin ve güler yüzlü.",
  experience: [
    { position: "Hemşirelik Stajyeri", company: "Seniorenheim am Park", location: "Hannover, Almanya", period: "08/2015 – 07/2018", bullets: ["Deneyimli uzmanların rehberliğinde temel ve tedavi bakımını öğrenme", "Sakinlerin mobilizasyonu ve günlük yaşam desteği", "Bakım dokümantasyonu ve vardiya devirlerine katkı"] },
    { position: "Hemşire", company: "Seniorenheim am Park", location: "Hannover, Almanya", period: "08/2018 – 06/2022", bullets: ["Tüm bakım derecelerinden 24 sakinin bakımını bağımsız olarak üstlenme", "Bakım planlarının oluşturulması ve eksiksiz dokümantasyon", "Doktor talimatına göre ilaç uygulama ve vital bulgu takibi"] },
    { position: "Hemşire & Uygulama Eğitmeni", company: "AWO Bakım Merkezi", location: "Hannover, Almanya", period: "07/2022 – devam ediyor", bullets: ["Yılda 6 stajyerin eğitimi ve değerlendirilmesi", "Yeni çalışanların oryantasyonu ve vardiya planlamasına katkı", "Yara bakımı ve güncel uzman standartlarının uygulanması", "Kalite denetimlerinde iletişim kişisi — servis son denetimde 1,2 ile değerlendirildi"] },
  ],
  education: [
    { degree: "Ortaokul Diploması", institution: "Realschule Hannover-Mitte", location: "Hannover", period: "2015", note: "" },
    { degree: "Yaşlı Bakımı Meslek Eğitimi", institution: "Pflegeschule Hannover", location: "Hannover", period: "08/2015 – 07/2018", note: "Diploma notu: 1,8 (çok iyi)" },
    { degree: "Uygulama Eğitmenliği Sertifikası (300 saat)", institution: "Bildungszentrum Pflege Niedersachsen", location: "Hannover", period: "01/2022 – 06/2022", note: "Çalışırken tamamlandı" },
  ],
  skills: ["Temel ve tedavi bakımı", "Bakım planlaması ve dokümantasyon", "İlaç yönetimi", "Yara bakımı", "Stajyer eğitimi", "Mobilizasyon teknikleri", "Demans hastalarıyla iletişim", "Hijyen ve enfeksiyon koruması"],
  languages: [{ name: "Türkçe", level: "Ana dil" }, { name: "Almanca", level: "Çok iyi (C1)" }, { name: "İngilizce", level: "Orta" }],
  signature: "Hannover, 13.08.2026",
};

const EXAMPLE_AR: CVContent = {
  name: "أمينة الخالدي",
  title: "ممرضة معتمدة",
  contact: "هانوفر، ألمانيا · ‎+49 170 1234567 · amina.alkhalidi@mail.de",
  profile: "ممرضة معتمدة بخبرة ثماني سنوات في الرعاية السكنية طويلة الأمد. متمكنة من الرعاية الأساسية والعلاجية، وتخطيط الرعاية والتوثيق وفق أحدث المعايير. تشرف على المتدربين وتتعاون عن قرب مع الأطباء وذوي المرضى. هادئة ومتعاطفة حتى في المواقف الصعبة.",
  experience: [
    { position: "متدربة تمريض", company: "Seniorenheim am Park", location: "هانوفر، ألمانيا", period: "08/2015 – 07/2018", bullets: ["تعلّم الرعاية الأساسية والعلاجية بإشراف كوادر ذات خبرة", "المساعدة في تحريك المقيمين ودعم أنشطتهم اليومية", "المشاركة في توثيق الرعاية وتسليم المناوبات"] },
    { position: "ممرضة معتمدة", company: "Seniorenheim am Park", location: "هانوفر، ألمانيا", period: "08/2018 – 06/2022", bullets: ["رعاية مستقلة لـ 24 مقيمًا من جميع درجات الرعاية", "إعداد خطط الرعاية وتحديثها مع توثيق كامل", "إعطاء الأدوية ومراقبة العلامات الحيوية حسب وصف الطبيب"] },
    { position: "ممرضة ومشرفة تدريب", company: "مركز AWO للرعاية", location: "هانوفر، ألمانيا", period: "07/2022 – حتى الآن", bullets: ["تدريب وتقييم حتى 6 متدربين سنويًا", "تأهيل الزملاء الجدد والمشاركة في تخطيط المناوبات", "إدارة العناية بالجروح وتطبيق أحدث المعايير المهنية", "جهة الاتصال لتدقيق الجودة — حصل القسم على تقييم 1.2 (ممتاز)"] },
  ],
  education: [
    { degree: "الشهادة الإعدادية", institution: "Realschule Hannover-Mitte", location: "هانوفر", period: "2015", note: "" },
    { degree: "تأهيل مهني في تمريض المسنين", institution: "Pflegeschule Hannover", location: "هانوفر", period: "08/2015 – 07/2018", note: "التقدير النهائي: 1.8 (جيد جدًا)" },
    { degree: "شهادة إشراف تدريبي (300 ساعة)", institution: "Bildungszentrum Pflege Niedersachsen", location: "هانوفر", period: "01/2022 – 06/2022", note: "بالتوازي مع العمل" },
  ],
  skills: ["الرعاية الأساسية والعلاجية", "تخطيط الرعاية والتوثيق", "إدارة الأدوية", "العناية بالجروح", "تدريب المتدربين", "تقنيات التحريك والتموضع", "التعامل مع مرضى الخرف", "النظافة والوقاية من العدوى"],
  languages: [{ name: "العربية", level: "اللغة الأم" }, { name: "الألمانية", level: "ممتاز (C1)" }, { name: "الإنجليزية", level: "جيد" }],
  signature: "هانوفر، 13.08.2026",
};

const EXAMPLE_ES: CVContent = {
  name: "Lucía Fernández",
  title: "Enfermera de cuidados",
  contact: "Lindenstraße 24, 30459 Hannover · +49 170 1234567 · lucia.fernandez@mail.de",
  profile: "Enfermera con ocho años de experiencia en cuidados residenciales de larga duración. Competente en cuidados básicos y terapéuticos, planificación de cuidados y documentación según los estándares actuales. Tutoriza a estudiantes en prácticas y colabora estrechamente con médicos y familiares. Serena y empática incluso en situaciones exigentes.",
  experience: [
    { position: "Aprendiz de cuidados geriátricos", company: "Seniorenheim am Park", location: "Hannover, Alemania", period: "08/2015 – 07/2018", bullets: ["Aprendizaje de cuidados básicos y terapéuticos bajo supervisión de personal experimentado", "Apoyo en la movilización, activación y acompañamiento diario de los residentes", "Participación en la documentación de cuidados y los relevos de turno"] },
    { position: "Enfermera de cuidados", company: "Seniorenheim am Park", location: "Hannover, Alemania", period: "08/2018 – 06/2022", bullets: ["Atención autónoma de 24 residentes de todos los grados de dependencia", "Elaboración y actualización de planes de cuidados con documentación completa", "Administración de medicación y control de constantes según prescripción médica"] },
    { position: "Enfermera y tutora de prácticas", company: "Centro de cuidados AWO", location: "Hannover, Alemania", period: "07/2022 – actualidad", bullets: ["Tutorización y evaluación de hasta 6 estudiantes al año", "Acogida de nuevos compañeros y participación en la planificación de turnos", "Gestión de heridas y aplicación de los estándares profesionales vigentes", "Persona de contacto en auditorías de calidad — unidad valorada con 1,2 (sobresaliente)"] },
  ],
  education: [
    { degree: "Educación Secundaria (Realschulabschluss)", institution: "Realschule Hannover-Mitte", location: "Hannover", period: "2015", note: "" },
    { degree: "Formación profesional en cuidados geriátricos", institution: "Pflegeschule Hannover", location: "Hannover", period: "08/2015 – 07/2018", note: "Nota final: 1,8 (notable alto)" },
    { degree: "Certificado de tutora de prácticas (300 h)", institution: "Bildungszentrum Pflege Niedersachsen", location: "Hannover", period: "01/2022 – 06/2022", note: "Compatibilizado con el trabajo" },
  ],
  skills: ["Cuidados básicos y terapéuticos", "Planificación y documentación de cuidados", "Gestión de medicación", "Cura de heridas", "Tutorización de estudiantes", "Técnicas de movilización", "Atención a personas con demencia", "Higiene y prevención de infecciones"],
  languages: [{ name: "Español", level: "Lengua materna" }, { name: "Alemán", level: "Muy alto (C1)" }, { name: "Inglés", level: "Intermedio" }],
  signature: "Hannover, 13/08/2026",
};

const EXAMPLE_PL: CVContent = {
  name: "Agnieszka Kowalska",
  title: "Pielęgniarka opiekuńcza",
  contact: "Lindenstraße 24, 30459 Hannover · +49 170 1234567 · agnieszka.kowalska@mail.de",
  profile: "Pielęgniarka z ośmioletnim doświadczeniem w stacjonarnej opiece długoterminowej. Biegła w pielęgnacji podstawowej i leczniczej, planowaniu opieki oraz dokumentacji zgodnej z aktualnymi standardami. Opiekunka praktykantów, blisko współpracuje z lekarzami i rodzinami podopiecznych. Spokojna i empatyczna także w wymagających sytuacjach.",
  experience: [
    { position: "Praktykantka opieki", company: "Seniorenheim am Park", location: "Hanower, Niemcy", period: "08/2015 – 07/2018", bullets: ["Nauka pielęgnacji podstawowej i leczniczej pod okiem doświadczonej kadry", "Wsparcie przy mobilizacji, aktywizacji i codziennym towarzyszeniu mieszkańcom", "Udział w dokumentacji opieki i przekazywaniu zmian"] },
    { position: "Pielęgniarka opiekuńcza", company: "Seniorenheim am Park", location: "Hanower, Niemcy", period: "08/2018 – 06/2022", bullets: ["Samodzielna opieka nad 24 mieszkańcami o wszystkich stopniach niesamodzielności", "Tworzenie i aktualizacja planów opieki oraz kompletna dokumentacja", "Podawanie leków i kontrola parametrów życiowych zgodnie z zaleceniami lekarza"] },
    { position: "Pielęgniarka i opiekunka praktyk", company: "Centrum opieki AWO", location: "Hanower, Niemcy", period: "07/2022 – obecnie", bullets: ["Szkolenie i ocena do 6 praktykantów rocznie", "Wdrażanie nowych pracowników i współtworzenie grafiku", "Leczenie ran i wdrażanie aktualnych standardów eksperckich", "Osoba kontaktowa przy audytach jakości — oddział oceniony na 1,2 (bardzo dobrze)"] },
  ],
  education: [
    { degree: "Wykształcenie średnie (Realschulabschluss)", institution: "Realschule Hannover-Mitte", location: "Hanower", period: "2015", note: "" },
    { degree: "Kształcenie zawodowe w opiece geriatrycznej", institution: "Pflegeschule Hannover", location: "Hanower", period: "08/2015 – 07/2018", note: "Ocena końcowa: 1,8 (bardzo dobra)" },
    { degree: "Certyfikat opiekuna praktyk (300 godz.)", institution: "Bildungszentrum Pflege Niedersachsen", location: "Hanower", period: "01/2022 – 06/2022", note: "Ukończone równolegle z pracą" },
  ],
  skills: ["Pielęgnacja podstawowa i lecznicza", "Planowanie opieki i dokumentacja", "Zarządzanie lekami", "Opatrywanie ran", "Szkolenie praktykantów", "Techniki mobilizacji", "Opieka nad osobami z demencją", "Higiena i ochrona przed zakażeniami"],
  languages: [{ name: "Polski", level: "Język ojczysty" }, { name: "Niemiecki", level: "Bardzo dobry (C1)" }, { name: "Angielski", level: "Podstawowy" }],
  signature: "Wyrażam zgodę na przetwarzanie moich danych osobowych dla potrzeb niezbędnych do realizacji procesu rekrutacji (RODO).",
};

const EXAMPLE_RU: CVContent = {
  name: "Анна Шмидт",
  title: "Медицинская сестра по уходу",
  contact: "Lindenstraße 24, 30459 Hannover · +49 170 1234567 · anna.schmidt@mail.de",
  profile: "Медицинская сестра с восьмилетним опытом работы в стационарном долгосрочном уходе. Уверенно владеет базовым и лечебным уходом, планированием ухода и документацией по актуальным стандартам. Наставница практикантов, тесно сотрудничает с врачами и родственниками. Спокойна и внимательна даже в сложных ситуациях.",
  experience: [
    { position: "Практикантка по уходу", company: "Seniorenheim am Park", location: "Ганновер, Германия", period: "08/2015 – 07/2018", bullets: ["Освоение базового и лечебного ухода под руководством опытных специалистов", "Помощь в мобилизации, активизации и повседневном сопровождении жильцов", "Участие в ведении документации и передаче смен"] },
    { position: "Медицинская сестра по уходу", company: "Seniorenheim am Park", location: "Ганновер, Германия", period: "08/2018 – 06/2022", bullets: ["Самостоятельный уход за 24 жильцами всех степеней потребности в уходе", "Составление и обновление планов ухода, полная документация", "Выдача медикаментов и контроль жизненных показателей по назначению врача"] },
    { position: "Медсестра и наставница практикантов", company: "Центр ухода AWO", location: "Ганновер, Германия", period: "07/2022 – по настоящее время", bullets: ["Обучение и аттестация до 6 практикантов в год", "Адаптация новых сотрудников и участие в планировании смен", "Уход за ранами и внедрение актуальных экспертных стандартов", "Контактное лицо при проверках качества — отделение оценено на 1,2 (отлично)"] },
  ],
  education: [
    { degree: "Среднее образование (Realschulabschluss)", institution: "Realschule Hannover-Mitte", location: "Ганновер", period: "2015", note: "" },
    { degree: "Профессиональное образование по уходу за пожилыми", institution: "Pflegeschule Hannover", location: "Ганновер", period: "08/2015 – 07/2018", note: "Итоговая оценка: 1,8 (очень хорошо)" },
    { degree: "Сертификат наставника практики (300 ч.)", institution: "Bildungszentrum Pflege Niedersachsen", location: "Ганновер", period: "01/2022 – 06/2022", note: "Без отрыва от работы" },
  ],
  skills: ["Базовый и лечебный уход", "Планирование ухода и документация", "Работа с медикаментами", "Уход за ранами", "Наставничество практикантов", "Техники мобилизации", "Уход за людьми с деменцией", "Гигиена и защита от инфекций"],
  languages: [{ name: "Русский", level: "Родной" }, { name: "Немецкий", level: "Свободно (C1)" }, { name: "Английский", level: "Базовый" }],
  signature: "Ганновер, 13.08.2026",
};

const EXAMPLE_UK: CVContent = {
  name: "Оксана Мельник",
  title: "Медична сестра з догляду",
  contact: "Lindenstraße 24, 30459 Hannover · +49 170 1234567 · oksana.melnyk@mail.de",
  profile: "Медична сестра з восьмирічним досвідом роботи в стаціонарному довготривалому догляді. Впевнено володіє базовим і лікувальним доглядом, плануванням догляду та документацією за актуальними стандартами. Наставниця практикантів, тісно співпрацює з лікарями та родичами. Спокійна й уважна навіть у складних ситуаціях.",
  experience: [
    { position: "Практикантка з догляду", company: "Seniorenheim am Park", location: "Ганновер, Німеччина", period: "08/2015 – 07/2018", bullets: ["Опанування базового та лікувального догляду під керівництвом досвідчених фахівців", "Допомога в мобілізації, активізації та повсякденному супроводі мешканців", "Участь у веденні документації та передачі змін"] },
    { position: "Медична сестра з догляду", company: "Seniorenheim am Park", location: "Ганновер, Німеччина", period: "08/2018 – 06/2022", bullets: ["Самостійний догляд за 24 мешканцями всіх ступенів потреби в догляді", "Складання та оновлення планів догляду, повна документація", "Видача ліків і контроль життєвих показників за призначенням лікаря"] },
    { position: "Медсестра та наставниця практикантів", company: "Центр догляду AWO", location: "Ганновер, Німеччина", period: "07/2022 – дотепер", bullets: ["Навчання та оцінювання до 6 практикантів на рік", "Адаптація нових колег і участь у плануванні змін", "Догляд за ранами та впровадження актуальних експертних стандартів", "Контактна особа під час перевірок якості — відділення оцінено на 1,2 (відмінно)"] },
  ],
  education: [
    { degree: "Середня освіта (Realschulabschluss)", institution: "Realschule Hannover-Mitte", location: "Ганновер", period: "2015", note: "" },
    { degree: "Професійна освіта з догляду за літніми людьми", institution: "Pflegeschule Hannover", location: "Ганновер", period: "08/2015 – 07/2018", note: "Підсумкова оцінка: 1,8 (дуже добре)" },
    { degree: "Сертифікат наставниці практики (300 год.)", institution: "Bildungszentrum Pflege Niedersachsen", location: "Ганновер", period: "01/2022 – 06/2022", note: "Без відриву від роботи" },
  ],
  skills: ["Базовий і лікувальний догляд", "Планування догляду та документація", "Робота з медикаментами", "Догляд за ранами", "Наставництво практикантів", "Техніки мобілізації", "Догляд за людьми з деменцією", "Гігієна та захист від інфекцій"],
  languages: [{ name: "Українська", level: "Рідна" }, { name: "Німецька", level: "Вільно (C1)" }, { name: "Англійська", level: "Базовий" }],
  signature: "Ганновер, 13.08.2026",
};

const EXAMPLE_BY_LANG: Record<string, CVContent> = {
  de: EXAMPLE_PFLEGE, en: EXAMPLE_EN, tr: EXAMPLE_TR, ar: EXAMPLE_AR,
  es: EXAMPLE_ES, pl: EXAMPLE_PL, ru: EXAMPLE_RU, uk: EXAMPLE_UK,
};

const CAPTION_BY_LANG: Record<string, string> = {
  de: "Erstellt mit", en: "Created with", tr: "Şununla oluşturuldu:", ar: "تم إنشاؤها بواسطة",
  es: "Creado con", pl: "Utworzono w", ru: "Создано с помощью", uk: "Створено за допомогою",
};
const TEMPLATE_WORD_BY_LANG: Record<string, string> = {
  de: "Vorlage", en: "Template", tr: "Şablon", ar: "القالب",
  es: "Plantilla", pl: "Szablon", ru: "Шаблон", uk: "Шаблон",
};
type TransformationCopy = {
  before: string;
  after: string;
  beforeTitle: string;
  afterTitle: string;
  heading: string;
  raw: string;
  improvements: string[];
};

const TRANSFORMATION_BY_LANG: Record<string, TransformationCopy> = {
  de: {
    before: "Vorher", after: "Nachher", beforeTitle: "Mittelmäßig & unvollständig", afterTitle: "Ausführliche Top-Bewerbung",
    heading: "Aus wenigen Angaben wird eine Bewerbung, die überzeugt.",
    raw: "„Ich bin Pflegefachkraft und arbeite seit mehreren Jahren in einem Heim. Ich kann mit Menschen gut umgehen und suche eine neue Stelle in Hannover.“",
    improvements: ["klare fachliche Positionierung", "Erfolge statt allgemeiner Aussagen", "passend zur Stelle formuliert"],
  },
  en: {
    before: "Before", after: "After", beforeTitle: "Notes & raw text", afterTitle: "Polished application",
    heading: "A few details become an application that makes an impression.",
    raw: "“I am a care nurse and have worked in a care home for several years. I work well with people and am looking for a new role in Hanover.”",
    improvements: ["a clear professional profile", "real achievements, not generic claims", "tailored to the role"],
  },
  tr: {
    before: "Önce", after: "Sonra", beforeTitle: "Notlar ve taslak", afterTitle: "Güçlendirilmiş başvuru",
    heading: "Birkaç bilgi, güçlü bir başvuruya dönüşür.",
    raw: "“Hemşireyim ve birkaç yıldır bir bakım evinde çalışıyorum. İnsanlarla iyi anlaşırım ve Hannover'de yeni bir iş arıyorum.”",
    improvements: ["net mesleki konumlandırma", "genel ifadeler yerine başarılar", "pozisyona göre uyarlanmış anlatım"],
  },
  ar: {
    before: "قبل", after: "بعد", beforeTitle: "ملاحظات ومسودة", afterTitle: "طلب توظيف مُحسَّن",
    heading: "بضع معلومات تتحول إلى طلب توظيف مقنع.",
    raw: "«أنا ممرضة وأعمل منذ عدة سنوات في دار رعاية. أتعامل جيدًا مع الناس وأبحث عن وظيفة جديدة في هانوفر.»",
    improvements: ["صورة مهنية واضحة", "إنجازات بدل العبارات العامة", "صياغة تناسب الوظيفة"],
  },
  es: {
    before: "Antes", after: "Después", beforeTitle: "Notas y texto inicial", afterTitle: "Candidatura perfeccionada",
    heading: "Unos pocos datos se convierten en una candidatura convincente.",
    raw: "“Soy enfermera y trabajo desde hace varios años en una residencia. Se me da bien tratar con las personas y busco un nuevo puesto en Hannover.”",
    improvements: ["perfil profesional claro", "logros en lugar de frases genéricas", "texto adaptado al puesto"],
  },
  pl: {
    before: "Przed", after: "Po", beforeTitle: "Notatki i szkic", afterTitle: "Dopracowana aplikacja",
    heading: "Kilka informacji zmienia się w przekonującą aplikację.",
    raw: "„Jestem pielęgniarką i od kilku lat pracuję w domu opieki. Dobrze dogaduję się z ludźmi i szukam nowej pracy w Hanowerze.”",
    improvements: ["jasny profil zawodowy", "osiągnięcia zamiast ogólników", "tekst dopasowany do stanowiska"],
  },
  ru: {
    before: "До", after: "После", beforeTitle: "Заметки и черновик", afterTitle: "Улучшенное заявление",
    heading: "Несколько деталей превращаются в убедительное заявление.",
    raw: "«Я медсестра и уже несколько лет работаю в доме ухода. Я хорошо лажу с людьми и ищу новую работу в Ганновере.»",
    improvements: ["чёткий профессиональный профиль", "достижения вместо общих фраз", "текст под конкретную вакансию"],
  },
  uk: {
    before: "До", after: "Після", beforeTitle: "Нотатки та чернетка", afterTitle: "Удосконалена заявка",
    heading: "Кілька деталей перетворюються на переконливу заявку.",
    raw: "«Я медсестра й уже кілька років працюю в будинку догляду. Добре ладнаю з людьми та шукаю нову роботу в Ганновері.»",
    improvements: ["чіткий професійний профіль", "досягнення замість загальних фраз", "текст для конкретної вакансії"],
  },
};
type ExampleLetter = {
  label: string;        // small heading above the letter page ("Bewerbung", "Cover letter", …)
  cvLabel: string;      // small heading above the CV page
  recipient: string[];  // recipient address block
  city: string;         // city + date line
  subject: string;
  salutation: string;
  paragraphs: string[];
  closing: string;
  rtl?: boolean;
};

const LETTER_BY_LANG: Record<string, ExampleLetter> = {
  de: {
    label: "Bewerbung", cvLabel: "Lebenslauf",
    recipient: ["Caritas Pflegezentrum Hannover", "Frau Petra Wagner", "Marienstraße 12", "30171 Hannover"],
    city: "Hannover, den 13.08.2026",
    subject: "Bewerbung als examinierte Pflegefachkraft",
    salutation: "Sehr geehrte Frau Wagner,",
    paragraphs: [
      "mit großem Interesse habe ich Ihre Stellenanzeige gelesen. Als examinierte Pflegefachkraft mit acht Jahren Erfahrung in der stationären Alten- und Langzeitpflege möchte ich mein Können gern in Ihr Team einbringen.",
      "In meiner aktuellen Position im AWO Pflegezentrum übernehme ich die eigenverantwortliche Betreuung von Bewohnerinnen und Bewohnern aller Pflegegrade. Zu meinen Aufgaben gehören die Erstellung und Aktualisierung von Pflegeplanungen, eine lückenlose Pflegedokumentation, die Medikamentengabe und Vitalzeichenkontrolle nach ärztlicher Verordnung sowie das Wundmanagement. Dabei arbeite ich eng mit Ärzten, Therapeuten und Angehörigen zusammen.",
      "Zusätzlich bin ich als zertifizierte Praxisanleiterin für die fachliche Anleitung und Bewertung von jährlich bis zu sechs Auszubildenden verantwortlich. Auch neue Kolleginnen und Kollegen arbeite ich ein. Bei der letzten MDK-Prüfung wurde meine Station mit der Note 1,2 bewertet. Zu diesem Ergebnis trage ich mit sorgfältiger Dokumentation und der konsequenten Umsetzung aktueller Expertenstandards bei.",
      "Zuvor war ich im Seniorenheim am Park tätig und betreute dort eigenverantwortlich 24 Bewohnerinnen und Bewohner in allen Pflegegraden. Dort sammelte ich umfassende Erfahrung in der Grund- und Behandlungspflege, der Mobilisation und Aktivierung sowie in Übergaben und der Zusammenarbeit im Drei-Schicht-System.",
      "Meine Ausbildung zur examinierten Altenpflegerin absolvierte ich an der Pflegeschule Hannover. Die Weiterbildung zur Praxisanleitung mit 300 Stunden schloss ich berufsbegleitend am Bildungszentrum Pflege Niedersachsen ab. Diese Verbindung aus praktischer Pflege, Anleitung und strukturiertem Arbeiten möchte ich nun in Ihr Team einbringen.",
      "Ich arbeite ruhig und zugewandt, auch in fordernden Situationen, und übernehme Verantwortung dort, wo eine verlässliche Pflege und klare Zusammenarbeit gefragt sind. Über die Einladung zu einem persönlichen Gespräch freue ich mich.",
    ],
    closing: "Mit freundlichen Grüßen",
  },
  en: {
    label: "Cover Letter", cvLabel: "CV",
    recipient: ["Caritas Care Centre Hanover", "Ms Petra Wagner", "Marienstraße 12", "30171 Hanover, Germany"],
    city: "Hanover, 13 August 2026",
    subject: "Application for the position of Registered Care Nurse",
    salutation: "Dear Ms Wagner,",
    paragraphs: [
      "I am writing to apply for the position of Registered Care Nurse at your facility. With eight years of experience in residential long-term care, I would be delighted to bring my skills to your team.",
      "In my current role at the AWO Care Centre I independently care for residents across all care levels, manage wound care and, as a certified clinical mentor, train and assess up to six trainees per year. In the most recent quality audit my ward was rated 1.2 (excellent) — a result I contributed to through meticulous documentation and consistent application of current expert standards.",
      "I am particularly drawn to your facility's commitment to person-centred care. That is exactly how I understand my profession: professionally confident, calm and attentive — even in demanding situations.",
      "I would welcome the opportunity to discuss my application in a personal interview.",
    ],
    closing: "Yours sincerely,",
  },
  tr: {
    label: "Ön Yazı", cvLabel: "Özgeçmiş",
    recipient: ["Caritas Bakım Merkezi Hannover", "Sayın Petra Wagner", "Marienstraße 12", "30171 Hannover"],
    city: "Hannover, 13.08.2026",
    subject: "Hemşire pozisyonu için başvuru",
    salutation: "Sayın Wagner,",
    paragraphs: [
      "İlanınızı büyük bir ilgiyle okudum. Yatılı ve uzun süreli bakımda sekiz yıllık deneyime sahip bir hemşire olarak bilgi ve becerilerimi ekibinize katmak istiyorum.",
      "AWO Bakım Merkezi'ndeki mevcut görevimde tüm bakım derecelerinden sakinlerin bakımını bağımsız olarak üstleniyor, yara bakımını yönetiyor ve sertifikalı uygulama eğitmeni olarak her yıl altı stajyere kadar eğitim veriyorum. Son kalite denetiminde servisim 1,2 (çok iyi) ile değerlendirildi — titiz dokümantasyon ve güncel standartların uygulanmasıyla bu sonuca katkıda bulundum.",
      "Kurumunuzun insana zaman ayıran bakım anlayışı beni çok etkiledi. Mesleğimi ben de tam olarak böyle anlıyorum: uzman, sakin ve güler yüzlü — zor durumlarda bile.",
      "Sizi şahsen tanımak için bir görüşme davetinizden mutluluk duyarım.",
    ],
    closing: "Saygılarımla,",
  },
  ar: {
    label: "رسالة التقديم", cvLabel: "السيرة الذاتية", rtl: true,
    recipient: ["مركز كاريتاس للرعاية – هانوفر", "السيدة بيترا فاغنر", "Marienstraße 12", "30171 هانوفر"],
    city: "هانوفر، 13.08.2026",
    subject: "طلب توظيف لوظيفة ممرضة معتمدة",
    salutation: "السيدة فاغنر المحترمة،",
    paragraphs: [
      "قرأتُ إعلانكم الوظيفي باهتمام كبير. بصفتي ممرضة معتمدة بخبرة ثماني سنوات في الرعاية السكنية طويلة الأمد، يسعدني أن أضع خبرتي في خدمة فريقكم.",
      "في عملي الحالي بمركز AWO للرعاية أتولى بشكل مستقل رعاية مقيمين من جميع درجات الرعاية، وأدير العناية بالجروح، وأدرّب بصفتي مشرفة تدريب معتمدة حتى ستة متدربين سنويًا. وفي آخر تدقيق للجودة حصل قسمي على تقييم 1.2 (ممتاز) — نتيجة ساهمتُ فيها بالتوثيق الدقيق وتطبيق أحدث المعايير المهنية.",
      "ما يجذبني إلى مؤسستكم هو التزامكم برعاية تمنح الإنسان وقتًا واهتمامًا حقيقيين. وهكذا أفهم مهنتي تمامًا: كفاءة مهنية وهدوء وتعاطف — حتى في المواقف الصعبة.",
      "يسعدني جدًا تلقّي دعوتكم لمقابلة شخصية.",
    ],
    closing: "مع خالص التحية والتقدير،",
  },
  es: {
    label: "Carta de presentación", cvLabel: "Currículum",
    recipient: ["Centro de cuidados Caritas Hannover", "Sra. Petra Wagner", "Marienstraße 12", "30171 Hannover, Alemania"],
    city: "Hannover, 13 de agosto de 2026",
    subject: "Candidatura al puesto de enfermera de cuidados",
    salutation: "Estimada Sra. Wagner:",
    paragraphs: [
      "He leído su oferta de empleo con gran interés. Como enfermera con ocho años de experiencia en cuidados residenciales de larga duración, me encantaría aportar mis conocimientos a su equipo.",
      "En mi puesto actual en el centro AWO atiendo de forma autónoma a residentes de todos los grados de dependencia, gestiono la cura de heridas y, como tutora de prácticas certificada, formo y evalúo hasta seis estudiantes al año. En la última auditoría de calidad mi unidad obtuvo una valoración de 1,2 (sobresaliente), un resultado al que contribuí con una documentación rigurosa y la aplicación de los estándares profesionales vigentes.",
      "Me atrae especialmente el compromiso de su centro con una atención centrada en la persona. Así entiendo yo mi profesión: con seguridad profesional, serenidad y cercanía, también en situaciones exigentes.",
      "Sería un placer poder presentarme personalmente en una entrevista.",
    ],
    closing: "Atentamente,",
  },
  pl: {
    label: "List motywacyjny", cvLabel: "CV",
    recipient: ["Centrum Opieki Caritas Hannover", "Pani Petra Wagner", "Marienstraße 12", "30171 Hanower, Niemcy"],
    city: "Hanower, 13.08.2026",
    subject: "Aplikacja na stanowisko pielęgniarki opiekuńczej",
    salutation: "Szanowna Pani,",
    paragraphs: [
      "z dużym zainteresowaniem zapoznałam się z Państwa ogłoszeniem. Jako pielęgniarka z ośmioletnim doświadczeniem w stacjonarnej opiece długoterminowej chętnie wniosę swoje umiejętności do Państwa zespołu.",
      "W obecnej pracy w centrum AWO samodzielnie opiekuję się mieszkańcami o wszystkich stopniach niesamodzielności, prowadzę leczenie ran oraz — jako certyfikowana opiekunka praktyk — szkolę i oceniam do sześciu praktykantów rocznie. Podczas ostatniego audytu jakości mój oddział otrzymał ocenę 1,2 (bardzo dobrą), do czego przyczyniłam się starannie prowadzoną dokumentacją i wdrażaniem aktualnych standardów.",
      "Szczególnie bliskie jest mi Państwa podejście: opieka z czasem i uwagą dla człowieka. Dokładnie tak rozumiem swój zawód — profesjonalnie, spokojnie i z empatią, także w wymagających sytuacjach.",
      "Będzie mi bardzo miło osobiście przedstawić się podczas rozmowy kwalifikacyjnej.",
    ],
    closing: "Z wyrazami szacunku",
  },
  ru: {
    label: "Сопроводительное письмо", cvLabel: "Резюме",
    recipient: ["Центр ухода Caritas, Ганновер", "Г-же Петре Вагнер", "Marienstraße 12", "30171 Ганновер, Германия"],
    city: "Ганновер, 13.08.2026",
    subject: "Отклик на вакансию медицинской сестры по уходу",
    salutation: "Уважаемая госпожа Вагнер!",
    paragraphs: [
      "С большим интересом прочитала Ваше объявление о вакансии. Как медицинская сестра с восьмилетним опытом работы в стационарном долгосрочном уходе, я хотела бы применить свои знания и навыки в Вашей команде.",
      "На нынешнем месте работы в центре AWO я самостоятельно ухаживаю за жильцами всех степеней потребности в уходе, отвечаю за уход за ранами и как сертифицированная наставница ежегодно обучаю до шести практикантов. При последней проверке качества моё отделение получило оценку 1,2 (отлично) — результат, в который я внесла вклад тщательной документацией и применением актуальных стандартов.",
      "Меня привлекает подход Вашего учреждения: уход с вниманием и временем для человека. Именно так я понимаю свою профессию — профессионально, спокойно и с душой, даже в сложных ситуациях.",
      "Буду рада приглашению на личное собеседование.",
    ],
    closing: "С уважением,",
  },
  uk: {
    label: "Супровідний лист", cvLabel: "Резюме",
    recipient: ["Центр догляду Caritas, Ганновер", "Пані Петрі Вагнер", "Marienstraße 12", "30171 Ганновер, Німеччина"],
    city: "Ганновер, 13.08.2026",
    subject: "Відгук на вакансію медичної сестри з догляду",
    salutation: "Шановна пані Вагнер!",
    paragraphs: [
      "З великим інтересом прочитала Ваше оголошення про вакансію. Як медична сестра з восьмирічним досвідом роботи в стаціонарному довготривалому догляді, я хотіла б застосувати свої знання та навички у Вашій команді.",
      "На теперішньому місці роботи в центрі AWO я самостійно доглядаю за мешканцями всіх ступенів потреби в догляді, відповідаю за догляд за ранами і як сертифікована наставниця щороку навчаю до шести практикантів. Під час останньої перевірки якості моє відділення отримало оцінку 1,2 (відмінно) — результат, до якого я доклалася ретельною документацією та впровадженням актуальних стандартів.",
      "Мене приваблює підхід Вашого закладу: догляд з увагою та часом для людини. Саме так я розумію свою професію — професійно, спокійно і з душею, навіть у складних ситуаціях.",
      "Буду рада запрошенню на особисту співбесіду.",
    ],
    closing: "З повагою,",
  },
};

function buildLetterHTML(cv: CVContent, letter: ExampleLetter): string {
  const gold = "#92400e";
  const dir = letter.rtl ? "rtl" : "ltr";
  return `
<div dir="${dir}" style="position:relative;overflow:hidden;background:#fff;color:#1c1917;padding:46px 52px 50px;max-width:794px;min-height:1000px;font-family:'Playfair Display',serif;">
  <div style="position:absolute;top:-130px;${letter.rtl ? "right" : "left"}:-90px;width:520px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(191,219,254,.45),rgba(191,219,254,0) 68%);"></div>
  <div style="position:absolute;bottom:-150px;${letter.rtl ? "left" : "right"}:-130px;width:460px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(254,243,199,.55),rgba(254,243,199,0) 68%);"></div>
  <div style="position:relative;">
    <div style="text-align:center;padding-bottom:20px;border-bottom:1px solid ${gold};">
      <div style="font-size:24px;font-weight:700;letter-spacing:1.5px;">${cv.name}</div>
      <div style="font-family:'Inter',sans-serif;font-size:11px;color:${gold};letter-spacing:2px;text-transform:uppercase;margin-top:5px;">${cv.title}</div>
      <div style="font-family:'Inter',sans-serif;font-size:10.5px;color:#78716c;margin-top:8px;">${cv.contact}</div>
    </div>
    <div style="font-family:'Inter',sans-serif;font-size:12px;line-height:1.8;color:#374151;margin-top:30px;">
      ${letter.recipient.join("<br>")}
    </div>
    <div style="font-family:'Inter',sans-serif;font-size:12px;color:#374151;text-align:${letter.rtl ? "left" : "right"};margin-top:18px;">${letter.city}</div>
    <div style="font-family:'Inter',sans-serif;font-size:13px;font-weight:700;color:#1c1917;margin-top:26px;">${letter.subject}</div>
    <div style="font-family:'Inter',sans-serif;font-size:12.5px;line-height:1.85;color:#374151;margin-top:20px;">
      <p style="margin:0 0 14px;">${letter.salutation}</p>
      ${letter.paragraphs.map(p => `<p style="margin:0 0 14px;">${p}</p>`).join("")}
      <p style="margin:22px 0 0;">${letter.closing}</p>
      <p style="margin:8px 0 0;font-family:'Playfair Display',serif;font-size:17px;">${cv.name}</p>
    </div>
  </div>
</div>`;
}

function buildBeforeCV(cv: CVContent): CVContent {
  return {
    ...cv,
    profile: cv.profile.split(". ").slice(0, 1).join(". ") + ".",
    experience: cv.experience.map(item => ({
      ...item,
      bullets: item.bullets.slice(0, 1),
    })),
    skills: cv.skills.slice(0, 5),
    languages: cv.languages.slice(0, 2),
  };
}

function buildBeforeLetter(cv: CVContent, letter: ExampleLetter, lang: string): ExampleLetter {
  const copy = TRANSFORMATION_BY_LANG[lang] || TRANSFORMATION_BY_LANG.de;
  return {
    ...letter,
    subject: letter.subject.split(" ").slice(0, 5).join(" "),
    paragraphs: [
      copy.raw.replace(/^["„«]|["”»]$/g, ""),
      lang === "de"
        ? "Ich würde mich über eine Chance freuen und erzähle Ihnen gern mehr über mich."
        : "I would be happy to tell you more about myself in an interview.",
    ],
  };
}

function ShowcasePage({ label, html }: { label: string; html: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ textAlign: "center", fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>{label}</p>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", padding: "4px 2px 12px" }}>
        <div style={{
          width: 794, margin: "0 auto",
          borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)",
          boxShadow: "0 18px 50px rgba(15,23,42,.14)", background: "#fff", flexShrink: 0,
        }}>
          <div style={{ width: 794, background: "#fff", userSelect: "none" }}
            dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}

function ShowcaseScore({ score, accent }: { score: number; accent: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      margin: "0 auto 18px", fontSize: 13, color: "var(--muted)",
    }}>
      <span>Beispiel-ATS-Score</span>
      <strong style={{ color: accent, fontSize: 20 }}>{score}/100</strong>
    </div>
  );
}

export function ExampleCVShowcase() {
  const { i18n } = useTranslation();
  const lang = EXAMPLE_BY_LANG[i18n.resolvedLanguage || "de"] ? (i18n.resolvedLanguage || "de") : "de";
  const beforeCVHtml = useMemo(() => renderCVContent(buildBeforeCV(EXAMPLE_BY_LANG[lang]), "blobs", undefined, lang), [lang]);
  const cvHtml = useMemo(() => renderCVContent(EXAMPLE_BY_LANG[lang], "blobs", undefined, lang), [lang]);
  const beforeLetterHtml = useMemo(() => buildLetterHTML(EXAMPLE_BY_LANG[lang], buildBeforeLetter(EXAMPLE_BY_LANG[lang], LETTER_BY_LANG[lang], lang)), [lang]);
  const letterHtml = useMemo(() => buildLetterHTML(EXAMPLE_BY_LANG[lang], LETTER_BY_LANG[lang]), [lang]);
  const copy = TRANSFORMATION_BY_LANG[lang] || TRANSFORMATION_BY_LANG.de;

  return (
    <div style={{ width: "100%", minWidth: 0, maxWidth: 860, margin: "0 auto", display: "grid", gap: 28 }}>
      <div style={{ textAlign: "center", background: "linear-gradient(135deg,#fffbeb,#eff6ff)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 18px 16px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--brand)", marginBottom: 5 }}>{copy.heading}</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
          {copy.before} = Ausgangsversion · {copy.after} = von BewerbungsKI perfektionierte Version
        </div>
      </div>
      {/* Each side is a complete application: cover letter + CV. Documents stay at
          their original PDF width and scroll horizontally on narrow screens. */}
      <div style={{ border: "1px solid #fde68a", borderRadius: 18, padding: "22px 12px 8px", background: "#fffbeb", minWidth: 0 }}>
        <h3 style={{ textAlign: "center", color: "#92400e", fontSize: 18, margin: "0 0 20px" }}>◌ {copy.before}: {copy.beforeTitle}</h3>
        <ShowcaseScore score={58} accent="#92400e" />
        <ShowcasePage label={`${copy.before} · ${LETTER_BY_LANG[lang].label}`} html={beforeLetterHtml} />
        <ShowcasePage label={`${copy.before} · ${LETTER_BY_LANG[lang].cvLabel}`} html={beforeCVHtml} />
      </div>
      <div style={{ border: "1px solid #bfdbfe", borderRadius: 18, padding: "22px 12px 8px", background: "linear-gradient(135deg,#eff6ff,#f0fdf4)", minWidth: 0, boxShadow: "0 14px 34px rgba(37,99,235,.12)" }}>
        <h3 style={{ textAlign: "center", color: "var(--brand)", fontSize: 18, margin: "0 0 20px" }}>✨ {copy.after}: {copy.afterTitle}</h3>
        <ShowcaseScore score={84} accent="var(--brand)" />
        <ShowcasePage label={`${copy.after} · ${LETTER_BY_LANG[lang].label}`} html={letterHtml} />
        <ShowcasePage label={`${copy.after} · ${LETTER_BY_LANG[lang].cvLabel}`} html={cvHtml} />
      </div>
      <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: -8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
        <span aria-hidden>✨</span> {CAPTION_BY_LANG[lang]} <strong style={{ color: "var(--brand)" }}>bewerbungski.com</strong> — {TEMPLATE_WORD_BY_LANG[lang]} „Elegant“
      </p>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  // Keep the SEO aggregate rating (JSON-LD) in sync with real in-app ratings
  useEffect(() => {
    customFetch("/api/ratings/summary")
      .then((r: any) => {
        if (!r?.count) return;
        const script = document.querySelector('script[type="application/ld+json"]');
        if (!script) return;
        try {
          const data = JSON.parse(script.textContent || "{}");
          if (data.aggregateRating) {
            data.aggregateRating.ratingValue = String(r.avg);
            data.aggregateRating.ratingCount = String(r.count);
            script.textContent = JSON.stringify(data);
          }
        } catch { /* leave static values */ }
      })
      .catch(() => {});
  }, []);
  const { t, i18n } = useTranslation();

  const features = [
    { icon: <FiLayout />, title: t("home.feat1Title"), desc: t("home.feat1Desc") },
    { icon: <FiZap />,     title: t("home.feat2Title"), desc: t("home.feat2Desc") },
    { icon: <FiGlobe />,   title: t("home.feat3Title"), desc: t("home.feat3Desc") },
    { icon: <FiLinkedin />,title: t("home.feat4Title"), desc: t("home.feat4Desc") },
    { icon: <FiDownload />,title: t("home.feat5Title"), desc: t("home.feat5Desc") },
    { icon: <FiCamera />,  title: t("home.feat6Title"), desc: t("home.feat6Desc") },
  ];


  const faqs = [1, 2, 3, 4, 5].map(n => ({ q: t(`home.faq${n}Q`), a: t(`home.faq${n}A`) }));

  return (
    <Layout>
      {/* ── HERO ── */}
      <div className="fade" style={{ textAlign: "center", padding: "12px 0 48px" }}>
        {/* Free badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#dcfce7", color: "#15803d",
          borderRadius: 999, padding: "6px 16px", fontSize: 13, fontWeight: 700,
          marginBottom: 22, border: "1px solid #bbf7d0",
        }}>
          🎁 {t("home.freeBadge")}
        </div>

        <h1 style={{
          fontFamily: "var(--fd)", fontSize: "clamp(30px,5.5vw,54px)",
          fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.15,
          marginBottom: 18,
        }}>
          {t("home.titlePre")} <em style={{ color: "var(--brand)", fontStyle: "normal" }}>{t("home.titleEm")}</em>
        </h1>

        <p style={{ fontSize: "clamp(15px,2vw,18px)", color: "var(--muted)", maxWidth: 560, margin: "0 auto 28px", lineHeight: 1.65 }}>
          {t("home.subtitle")}
        </p>

        {i18n.resolvedLanguage !== "de" && (
          <p style={{ fontSize: 13, color: "var(--brand)", fontWeight: 600, marginBottom: 16 }}>
            {t("home.germanNote")}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/wizard">
            <button className="btn btn-p btn-lg" style={{ fontSize: 16, padding: "15px 36px" }}>
              {t("home.cta")} <FiArrowRight />
            </button>
          </Link>
          <Link href="/scanner">
            <button className="btn btn-g btn-lg" style={{ fontSize: 16, padding: "15px 28px" }}>
              🔎 {t("scanner.title")}
            </button>
          </Link>
        </div>

        {/* Trust strip */}
        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center",
          gap: "10px 24px", marginTop: 22,
        }}>
          {[t("home.trustFree"), t("home.trustNoCard"), t("home.trustGdpr"), t("home.trustFast")].map(label => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--muted)" }}>
              <FiCheck style={{ color: "var(--ok)", flexShrink: 0 }} /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section style={{ marginBottom: 64 }}>
        <h2 style={{
          fontFamily: "var(--fd)", fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 700,
          textAlign: "center", marginBottom: 32, letterSpacing: "-.01em",
        }}>
          {t("home.howTitle")}
        </h2>
        <div className="grid3">
          {[1, 2, 3].map(n => (
            <div key={n} className="card" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "var(--brand)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--fd)", fontSize: 20, fontWeight: 700, marginBottom: 4,
              }}>
                {n}
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 15 }}>{t(`home.step${n}Title`)}</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{t(`home.step${n}Text`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ marginBottom: 64 }}>
        <h2 style={{
          fontFamily: "var(--fd)", fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 700,
          textAlign: "center", marginBottom: 32, letterSpacing: "-.01em",
        }}>
          {t("home.featTitle")}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          {features.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section style={{ marginBottom: 64 }} aria-labelledby="social-proof-title">
        <div style={{
          maxWidth: 920, margin: "0 auto", padding: "28px 20px 24px",
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: 18, textAlign: "center",
        }}>
          <h2 id="social-proof-title" style={{
            fontFamily: "var(--fd)", fontSize: "clamp(22px,3.5vw,30px)",
            fontWeight: 700, marginBottom: 10, letterSpacing: "-.01em",
          }}>
            {t("home.socialProofTitle")}
          </h2>
          <p style={{ color: "var(--brand)", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {t("home.socialProofText")}
          </p>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 22 }}>
            {t("home.socialProofNote")}
          </p>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 16, alignItems: "start",
          }}>
            <img
              src="/facebook-comments.jpg"
              alt={t("home.socialProofCommentsAlt")}
              loading="lazy"
              style={{ width: "100%", maxHeight: 520, objectFit: "contain", borderRadius: 12, background: "var(--bg)" }}
            />
            <img
              src="/google-reactions.jpg"
              alt={t("home.socialProofCommentsAlt")}
              loading="lazy"
              style={{ width: "100%", maxHeight: 520, objectFit: "contain", borderRadius: 12, background: "var(--bg)" }}
            />
          </div>
        </div>
      </section>

      {/* ── BEFORE / AFTER ── */}
      <section style={{ marginBottom: 64 }}>
        <h2 style={{
          fontFamily: "var(--fd)", fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 700,
          textAlign: "center", marginBottom: 12, letterSpacing: "-.01em",
        }}>
          {t("home.ba.title")}
        </h2>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 14, marginBottom: 28 }}>
          {t("home.ba.subtitle")}
        </p>
        <ExampleCVShowcase />
      </section>

      {/* ── FAQ ── */}
      <section style={{ maxWidth: 680, margin: "0 auto 64px" }}>
        <h2 style={{
          fontFamily: "var(--fd)", fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 700,
          textAlign: "center", marginBottom: 24, letterSpacing: "-.01em",
        }}>
          {t("home.faqTitle")}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faqs.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section style={{
        background: "linear-gradient(135deg, var(--brand) 0%, #0ea5e9 100%)",
        borderRadius: 20, padding: "48px 32px", textAlign: "center",
        marginBottom: 32, color: "#fff",
        boxShadow: "0 8px 32px rgba(26,86,219,.25)",
      }}>
        <h2 style={{ fontFamily: "var(--fd)", fontSize: "clamp(22px,4vw,36px)", fontWeight: 700, marginBottom: 12, letterSpacing: "-.01em" }}>
          {t("home.ctaBottomTitle")}
        </h2>
        <p style={{ fontSize: 16, opacity: .88, marginBottom: 28 }}>
          {t("home.ctaBottomSub")}
        </p>
        <Link href="/wizard">
          <button style={{
            background: "#fff", color: "var(--brand)",
            border: "none", borderRadius: 14, padding: "14px 36px",
            fontSize: 16, fontWeight: 700, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,.15)", transition: "transform .15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "none")}
          >
            {t("home.ctaBottom")} <FiArrowRight />
          </button>
        </Link>
      </section>
    </Layout>
  );
}
