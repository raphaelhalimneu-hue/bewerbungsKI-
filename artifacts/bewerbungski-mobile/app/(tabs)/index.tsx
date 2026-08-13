import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Switch, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from 'react-native-keyboard-controller';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGenerateDocument, useCreateDocument, customFetch } from '@workspace/api-client-react';
import { router, useFocusEffect } from 'expo-router';

// ─────────────────────── Types ───────────────────────
type Personal = { firstName: string; lastName: string; title: string; email: string; phone: string; city: string; birthDate: string; };
type Exp = { id: string; company: string; position: string; city: string; start: string; end: string; current: boolean; description: string; };
type Edu = { id: string; school: string; degree: string; field: string; start: string; end: string; };
type Skill = { id: string; name: string; };
type Lang = { id: string; language: string; level: string; };
type JobAd = { title: string; company: string; description: string; };
type Form = { personal: Personal; experience: Exp[]; education: Edu[]; skills: Skill[]; languages: Lang[]; jobad: JobAd; docLang: string; };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

const LANG_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Muttersprache'];

const DOC_LANGS = [
  { value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' },
  { value: 'tr', label: 'Türkçe' }, { value: 'ar', label: 'العربية' },
  { value: 'es', label: 'Español' }, { value: 'pl', label: 'Polski' },
  { value: 'ru', label: 'Русский' }, { value: 'uk', label: 'Українська' },
];

function blankForm(): Form {
  return {
    personal: { firstName: '', lastName: '', title: '', email: '', phone: '', city: '', birthDate: '' },
    experience: [{ id: uid(), company: '', position: '', city: '', start: '', end: '', current: false, description: '' }],
    education: [{ id: uid(), school: '', degree: '', field: '', start: '', end: '' }],
    skills: [],
    languages: [{ id: uid(), language: 'Deutsch', level: 'Muttersprache' }],
    jobad: { title: '', company: '', description: '' },
    docLang: 'de',
  };
}

// ─────────────────────── Auth Screen ───────────────────────
function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) { setError('Bitte E-Mail und Passwort eingeben.'); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'login') await signIn(email, password);
      else await signUp(email, password);
    } catch (e: any) {
      setError(e.message === 'EMAIL_EXISTS' ? 'E-Mail bereits registriert. Bitte einloggen.' : e.message || 'Fehler aufgetreten.');
    } finally { setLoading(false); }
  };

  const s = makeStyles(colors);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.authContainer, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View style={s.logoBox}><Text style={{ fontSize: 32 }}>✨</Text></View>
          <Text style={s.logoTitle}>BewerbungsKI</Text>
          <Text style={s.logoSub}>KI-Bewerbungen in Minuten</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>{mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</Text>
          {error ? <Text style={s.errorText}>{error}</Text> : null}
          <Text style={s.label}>E-Mail</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.mutedForeground} />
          <Text style={s.label}>Passwort</Text>
          <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="Passwort" secureTextEntry placeholderTextColor={colors.mutedForeground} />
          <TouchableOpacity style={s.primaryBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>{mode === 'login' ? 'Anmelden' : 'Registrieren'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.primary, fontSize: 14 }}>{mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Bereits registriert? Anmelden'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────── Wizard ───────────────────────
export default function CreateScreen() {
  const { user, loading: authLoading } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(blankForm);
  const [skillInput, setSkillInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genPhase, setGenPhase] = useState('');
  const [genError, setGenError] = useState('');
  const generateMutation = useGenerateDocument();
  const createMutation = useCreateDocument();

  // ── Freetext quick entry ──
  const [ftOpen, setFtOpen] = useState(false);
  const [ftText, setFtText] = useState('');
  const [ftLoading, setFtLoading] = useState(false);
  const [ftError, setFtError] = useState('');
  const [ftSuccess, setFtSuccess] = useState('');

  const STEPS = ['👤 Persönlich', '💼 Erfahrung', '🎓 Ausbildung', '🔧 Kenntnisse', '✨ Stellenanzeige'];

  useFocusEffect(React.useCallback(() => { setGenError(''); }, []));

  const s = makeStyles(colors);
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const botPad = isWeb ? 34 : insets.bottom;

  // ── Personal helpers ──
  const sp = (k: keyof Personal, v: string) => setForm(f => ({ ...f, personal: { ...f.personal, [k]: v } }));

  // ── Experience helpers ──
  const addExp = () => setForm(f => ({ ...f, experience: [...f.experience, { id: uid(), company: '', position: '', city: '', start: '', end: '', current: false, description: '' }] }));
  const se = (i: number, k: keyof Exp, v: any) => setForm(f => { const a = [...f.experience]; a[i] = { ...a[i], [k]: v }; return { ...f, experience: a }; });
  const delExp = (i: number) => setForm(f => ({ ...f, experience: f.experience.filter((_, x) => x !== i) }));

  // ── Education helpers ──
  const addEdu = () => setForm(f => ({ ...f, education: [...f.education, { id: uid(), school: '', degree: '', field: '', start: '', end: '' }] }));
  const ed = (i: number, k: keyof Edu, v: string) => setForm(f => { const a = [...f.education]; a[i] = { ...a[i], [k]: v }; return { ...f, education: a }; });
  const delEdu = (i: number) => setForm(f => ({ ...f, education: f.education.filter((_, x) => x !== i) }));

  // ── Skills/Lang helpers ──
  const addSkill = () => { if (!skillInput.trim()) return; setForm(f => ({ ...f, skills: [...f.skills, { id: uid(), name: skillInput.trim() }] })); setSkillInput(''); };
  const delSkill = (i: number) => setForm(f => ({ ...f, skills: f.skills.filter((_, x) => x !== i) }));
  const addLang = () => setForm(f => ({ ...f, languages: [...f.languages, { id: uid(), language: '', level: 'B2' }] }));
  const sl = (i: number, k: keyof Lang, v: string) => setForm(f => { const a = [...f.languages]; a[i] = { ...a[i], [k]: v }; return { ...f, languages: a }; });
  const delLang = (i: number) => setForm(f => ({ ...f, languages: f.languages.filter((_, x) => x !== i) }));

  async function importFreetext() {
    if (ftText.trim().length < 30 || ftLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFtLoading(true); setFtError(''); setFtSuccess('');
    try {
      const res = await customFetch<{ data: any }>('/api/parse-freetext', {
        method: 'POST',
        body: JSON.stringify({ text: ftText }),
      });
      const d = res?.data || {};
      setForm(f => {
        const next: Form = { ...f };
        if (d.personal) {
          const p = d.personal;
          next.personal = {
            ...f.personal,
            ...(p.firstName ? { firstName: p.firstName } : {}),
            ...(p.lastName ? { lastName: p.lastName } : {}),
            ...(p.title ? { title: p.title } : {}),
            ...(p.email ? { email: p.email } : {}),
            ...(p.phone ? { phone: p.phone } : {}),
            ...(p.city ? { city: p.city } : {}),
          };
        }
        if (Array.isArray(d.experience) && d.experience.length) {
          next.experience = d.experience.map((e: any) => ({
            id: uid(), company: e.company || '', position: e.position || '', city: e.city || '',
            start: e.start || '', end: e.end || '', current: !!e.current, description: e.description || '',
          }));
        }
        const eduItems: Edu[] = [];
        if (Array.isArray(d.education)) {
          for (const e of d.education) {
            eduItems.push({ id: uid(), school: e.institution || '', degree: e.degree || '', field: e.field || '', start: e.start || '', end: e.end || '' });
          }
        }
        if (d.school && (d.school.name || d.school.type)) {
          eduItems.push({ id: uid(), school: d.school.name || '', degree: d.school.type || '', field: '', start: '', end: d.school.year || '' });
        }
        if (eduItems.length) next.education = eduItems;
        if (Array.isArray(d.skills) && d.skills.length) {
          next.skills = d.skills.map((sk: any) => ({ id: uid(), name: sk.name || '' })).filter((sk: Skill) => sk.name);
        }
        if (Array.isArray(d.languages) && d.languages.length) {
          next.languages = d.languages.map((l: any) => ({ id: uid(), language: l.language || '', level: l.level || 'B2' })).filter((l: Lang) => l.language);
        }
        if (d.jobad) {
          next.jobad = {
            ...f.jobad,
            ...(d.jobad.title ? { title: d.jobad.title } : {}),
            ...(d.jobad.company ? { company: d.jobad.company } : {}),
            ...(d.jobad.description ? { description: d.jobad.description } : {}),
          };
        }
        return next;
      });
      setFtOpen(false); setFtText('');
      setFtSuccess('Daten übernommen! Bitte prüfe die Felder.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setFtError('Analyse fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setFtLoading(false);
    }
  }

  // ── Generate ──
  async function handleGenerate() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerating(true); setGenError('');
    try {
      const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const docLangInfo: Record<string, string> = {
        de: '', en: ' WICHTIG: Schreibe den gesamten Inhalt auf Englisch.',
        tr: ' WICHTIG: Schreibe den gesamten Inhalt auf Türkisch.',
        ar: ' WICHTIG: Schreibe den gesamten Inhalt auf Arabisch (Hocharabisch).',
        es: ' WICHTIG: Schreibe den gesamten Inhalt auf Spanisch.',
        pl: ' WICHTIG: Schreibe den gesamten Inhalt auf Polnisch.',
        ru: ' WICHTIG: Schreibe den gesamten Inhalt auf Russisch.',
        uk: ' WICHTIG: Schreibe den gesamten Inhalt auf Ukrainisch.',
      };
      const langInstr = docLangInfo[form.docLang] || '';

      setGenPhase('Lebenslauf wird erstellt …');
      const cvRes = await generateMutation.mutateAsync({ data: {
        type: 'cv',
        systemPrompt: 'Du bist ein professioneller Bewerbungsexperte. Antworte nur mit HTML-Inhalt, kein Markdown. Schreibe wie ein Mensch, keine KI-Floskeln.',
        userPrompt: `Erstelle Lebenslauf-HTML für:\n${JSON.stringify(form, null, 2)}\nOptimiert für: ${form.jobad.title || 'allgemein'} bei ${form.jobad.company || 'unbekannt'}.\nDatum: ${today}${langInstr}\n\nHTML-Gerüst (Inline-Styles, nicht ändern):\n<div style="font-family:Helvetica,Arial,sans-serif;color:#1f2937;padding:38px 46px 42px;">\n<div style="text-align:center;padding-bottom:18px;border-bottom:1.5px solid #1f2937;">\n<div style="font-size:28px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">VORNAME NACHNAME</div>\n<div style="font-size:13px;color:#6b7280;margin-top:6px;letter-spacing:1.5px;text-transform:uppercase;">BERUFSBEZEICHNUNG</div>\n<div style="font-size:11.5px;color:#6b7280;margin-top:10px;">Adresse · Telefon · E-Mail</div></div>\n<!-- Sektionen folgen -->\n</div>`,
      } });

      let letterText = '';
      if (form.jobad.title) {
        setGenPhase('Anschreiben wird erstellt …');
        const letterRes = await generateMutation.mutateAsync({ data: {
          type: 'letter',
          systemPrompt: 'Du bist Experte für Bewerbungsunterlagen. Schreibe wie ein echter Bewerber, keine KI-Phrasen. Nur den Anschreiben-Text, kein HTML.',
          userPrompt: `Anschreiben für: ${form.personal.firstName} ${form.personal.lastName}\nStelle: ${form.jobad.title} bei ${form.jobad.company}\nErfahrung: ${form.experience.slice(0, 3).map(e => `${e.position} bei ${e.company}`).join('; ')}\nSkills: ${form.skills.slice(0, 8).map(s => s.name).join(', ')}\nBeschreibung: ${form.jobad.description || 'nicht angegeben'}\n350–400 Wörter, formal, überzeugend. Beginne mit: "${form.personal.city || 'Ort'}, den ${today}"${langInstr}`,
        } });
        letterText = letterRes.result;
      }

      setGenPhase('Wird gespeichert …');
      await createMutation.mutateAsync({ data: {
        name: `${form.personal.firstName} ${form.personal.lastName}${form.jobad.title ? ' – ' + form.jobad.title : ''}`,
        template: 'modern',
        cvHtml: cvRes.result,
        coverLetter: letterText,
        jobTitle: form.jobad.title,
        jobCompany: form.jobad.company,
        profileData: form as any,
      } });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGenerating(false);
      router.navigate('/(tabs)/documents');
    } catch (e: any) {
      setGenerating(false);
      if (e?.data?.error === 'free_limit_reached') router.navigate('/(tabs)/account');
      else setGenError(e.message || 'Ein Fehler ist aufgetreten.');
    }
  }

  if (authLoading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} size="large" /></View>;
  if (!user) return <AuthScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Generating overlay */}
      <Modal visible={generating} transparent animationType="fade">
        <View style={s.genOverlay}>
          <View style={s.genCard}>
            <Text style={{ fontSize: 48, marginBottom: 20 }}>✨</Text>
            <Text style={s.genPhase}>{genPhase}</Text>
            <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          </View>
        </View>
      </Modal>

      {/* Step progress bar */}
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        <Text style={s.headerTitle}>{STEPS[step]}</Text>
        <View style={s.stepRow}>
          {STEPS.map((_, i) => (
            <View key={i} style={[s.stepDot, { backgroundColor: i <= step ? colors.primary : colors.border, width: i === step ? 28 : 8 }]} />
          ))}
        </View>
      </View>

      <KeyboardAwareScrollViewCompat style={{ flex: 1 }} contentContainerStyle={[s.scrollContent, { paddingBottom: botPad + 120 }]} keyboardShouldPersistTaps="handled" bottomOffset={120}>

        {/* Step 0: Personal */}
        {step === 0 && (
          <View>
            {!ftOpen && (
              <TouchableOpacity style={[s.addBtn, { marginBottom: 16 }]} onPress={() => { Haptics.selectionAsync(); setFtOpen(true); setFtSuccess(''); }}>
                <Text style={{ fontSize: 15 }}>⚡</Text>
                <Text style={s.addBtnText}>Schnell eintippen</Text>
              </TouchableOpacity>
            )}
            {ftOpen && (
              <View style={[s.card, { marginBottom: 16 }]}>
                <View style={s.itemHeader}>
                  <Text style={s.cardTitle}>⚡ Schnell eintippen</Text>
                  <TouchableOpacity onPress={() => { setFtOpen(false); setFtError(''); }}><Feather name="x" size={18} color={colors.mutedForeground} /></TouchableOpacity>
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 10, fontFamily: 'Inter_400Regular' }}>
                  Beschreibe deinen Werdegang einfach in eigenen Worten – am besten chronologisch, mit der Schule beginnend. Die KI sortiert alles automatisch in die richtigen Felder. Du kannst alles auf einmal beschreiben oder nur einzelne Teile – die KI füllt nur die Felder aus, zu denen du etwas schreibst.
                </Text>
                <TextInput
                  style={[s.input, { minHeight: 140, textAlignVertical: 'top', marginBottom: 12 }]}
                  value={ftText}
                  onChangeText={setFtText}
                  placeholder="Erzähl einfach drauflos – am besten der Reihe nach: Schule, Ausbildung, Beruf. Was kannst du?"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                />
                {ftError ? <Text style={s.errorText}>{ftError}</Text> : null}
                <TouchableOpacity
                  style={[s.primaryBtn, { opacity: ftLoading || ftText.trim().length < 30 ? 0.5 : 1 }]}
                  onPress={importFreetext}
                  disabled={ftLoading || ftText.trim().length < 30}
                  activeOpacity={0.85}
                >
                  {ftLoading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={s.primaryBtnText}>KI analysiert…</Text>
                    </View>
                  ) : (
                    <Text style={s.primaryBtnText}>KI ausfüllen lassen</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            {ftSuccess ? <Text style={{ color: '#16a34a', fontSize: 13, marginBottom: 12, fontFamily: 'Inter_500Medium' }}>{ftSuccess}</Text> : null}
            <Field label="Vorname *" value={form.personal.firstName} onChangeText={v => sp('firstName', v)} placeholder="Max" colors={colors} />
            <Field label="Nachname *" value={form.personal.lastName} onChangeText={v => sp('lastName', v)} placeholder="Mustermann" colors={colors} />
            <Field label="Berufsbezeichnung" value={form.personal.title} onChangeText={v => sp('title', v)} placeholder="Software Entwickler" colors={colors} />
            <Field label="E-Mail" value={form.personal.email} onChangeText={v => sp('email', v)} placeholder="max@example.com" keyboardType="email-address" colors={colors} />
            <Field label="Telefon" value={form.personal.phone} onChangeText={v => sp('phone', v)} placeholder="+49 170 1234567" keyboardType="phone-pad" colors={colors} />
            <Field label="Wohnort" value={form.personal.city} onChangeText={v => sp('city', v)} placeholder="Berlin" colors={colors} />
            <Field label="Geburtsdatum" value={form.personal.birthDate} onChangeText={v => sp('birthDate', v)} placeholder="01.01.1990" colors={colors} />
          </View>
        )}

        {/* Step 1: Experience */}
        {step === 1 && (
          <View>
            {form.experience.map((exp, i) => (
              <View key={exp.id} style={s.itemCard}>
                <View style={s.itemHeader}>
                  <Text style={s.itemNum}>Job {i + 1}</Text>
                  {form.experience.length > 1 && <TouchableOpacity onPress={() => delExp(i)}><Feather name="trash-2" size={18} color={colors.destructive} /></TouchableOpacity>}
                </View>
                <Field label="Unternehmen" value={exp.company} onChangeText={v => se(i, 'company', v)} placeholder="Firma GmbH" colors={colors} />
                <Field label="Position" value={exp.position} onChangeText={v => se(i, 'position', v)} placeholder="Software Entwickler" colors={colors} />
                <Field label="Ort" value={exp.city} onChangeText={v => se(i, 'city', v)} placeholder="Berlin" colors={colors} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}><Field label="Von" value={exp.start} onChangeText={v => se(i, 'start', v)} placeholder="01/2022" colors={colors} /></View>
                  {!exp.current && <View style={{ flex: 1 }}><Field label="Bis" value={exp.end} onChangeText={v => se(i, 'end', v)} placeholder="12/2024" colors={colors} /></View>}
                </View>
                <View style={s.switchRow}>
                  <Text style={s.label}>Aktuell tätig</Text>
                  <Switch value={exp.current} onValueChange={v => se(i, 'current', v)} trackColor={{ true: colors.primary }} />
                </View>
                <Field label="Tätigkeiten (optional)" value={exp.description} onChangeText={v => se(i, 'description', v)} placeholder="Aufgaben & Erfolge …" multiline colors={colors} />
              </View>
            ))}
            <TouchableOpacity style={s.addBtn} onPress={addExp}>
              <Feather name="plus" size={18} color={colors.primary} />
              <Text style={s.addBtnText}>Weiterer Job</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Education */}
        {step === 2 && (
          <View>
            {form.education.map((edu, i) => (
              <View key={edu.id} style={s.itemCard}>
                <View style={s.itemHeader}>
                  <Text style={s.itemNum}>Ausbildung {i + 1}</Text>
                  {form.education.length > 1 && <TouchableOpacity onPress={() => delEdu(i)}><Feather name="trash-2" size={18} color={colors.destructive} /></TouchableOpacity>}
                </View>
                <Field label="Schule / Universität" value={edu.school} onChangeText={v => ed(i, 'school', v)} placeholder="TU Berlin" colors={colors} />
                <Field label="Abschluss" value={edu.degree} onChangeText={v => ed(i, 'degree', v)} placeholder="Bachelor of Science" colors={colors} />
                <Field label="Studiengang / Fach" value={edu.field} onChangeText={v => ed(i, 'field', v)} placeholder="Informatik" colors={colors} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}><Field label="Von" value={edu.start} onChangeText={v => ed(i, 'start', v)} placeholder="10/2018" colors={colors} /></View>
                  <View style={{ flex: 1 }}><Field label="Bis" value={edu.end} onChangeText={v => ed(i, 'end', v)} placeholder="09/2021" colors={colors} /></View>
                </View>
              </View>
            ))}
            <TouchableOpacity style={s.addBtn} onPress={addEdu}>
              <Feather name="plus" size={18} color={colors.primary} />
              <Text style={s.addBtnText}>Weiterer Abschluss</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Skills & Languages */}
        {step === 3 && (
          <View>
            <Text style={s.sectionTitle}>Kenntnisse</Text>
            <View style={s.skillRow}>
              <TextInput style={[s.input, { flex: 1 }]} value={skillInput} onChangeText={setSkillInput} placeholder="z.B. Python, Excel, CAD …" placeholderTextColor={colors.mutedForeground} onSubmitEditing={addSkill} returnKeyType="done" />
              <TouchableOpacity style={s.addIconBtn} onPress={addSkill}><Feather name="plus" size={20} color="#fff" /></TouchableOpacity>
            </View>
            <View style={s.chipRow}>
              {form.skills.map((sk, i) => (
                <TouchableOpacity key={sk.id} style={s.chip} onPress={() => delSkill(i)}>
                  <Text style={s.chipText}>{sk.name}</Text>
                  <Feather name="x" size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.sectionTitle, { marginTop: 24 }]}>Sprachen</Text>
            {form.languages.map((lang, i) => (
              <View key={lang.id} style={s.langRow}>
                <TextInput style={[s.input, { flex: 1 }]} value={lang.language} onChangeText={v => sl(i, 'language', v)} placeholder="Sprache" placeholderTextColor={colors.mutedForeground} />
                <View style={s.levelBtns}>
                  {LANG_LEVELS.map(lv => (
                    <TouchableOpacity key={lv} onPress={() => sl(i, 'level', lv)} style={[s.levelBtn, lang.level === lv && { backgroundColor: colors.primary }]}>
                      <Text style={[s.levelBtnText, lang.level === lv && { color: '#fff' }]}>{lv}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {form.languages.length > 1 && <TouchableOpacity onPress={() => delLang(i)}><Feather name="trash-2" size={16} color={colors.destructive} /></TouchableOpacity>}
              </View>
            ))}
            <TouchableOpacity style={s.addBtn} onPress={addLang}>
              <Feather name="plus" size={18} color={colors.primary} />
              <Text style={s.addBtnText}>Weitere Sprache</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 4: Job Ad + Generate */}
        {step === 4 && (
          <View>
            <View style={s.card}>
              <Text style={s.cardTitle}>Stellenanzeige (optional)</Text>
              <Text style={[s.label, { marginBottom: 6, color: colors.mutedForeground, fontSize: 13 }]}>Angaben verbessern die Qualität erheblich.</Text>
              <Field label="Stellentitel" value={form.jobad.title} onChangeText={v => setForm(f => ({ ...f, jobad: { ...f.jobad, title: v } }))} placeholder="Software Entwickler" colors={colors} />
              <Field label="Unternehmen" value={form.jobad.company} onChangeText={v => setForm(f => ({ ...f, jobad: { ...f.jobad, company: v } }))} placeholder="Musterfirma GmbH" colors={colors} />
              <Field label="Stellenbeschreibung" value={form.jobad.description} onChangeText={v => setForm(f => ({ ...f, jobad: { ...f.jobad, description: v } }))} placeholder="Anforderungen, Aufgaben …" multiline colors={colors} />
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Dokumentensprache</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {DOC_LANGS.map(l => (
                  <TouchableOpacity key={l.value} onPress={() => setForm(f => ({ ...f, docLang: l.value }))} style={[s.langChip, form.docLang === l.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <Text style={[s.langChipText, form.docLang === l.value && { color: '#fff' }]}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {genError ? <Text style={s.errorText}>{genError}</Text> : null}

            <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>✨</Text>
              <Text style={[s.cardTitle, { textAlign: 'center', marginBottom: 6 }]}>Alles bereit?</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>KI erstellt Lebenslauf{form.jobad.title ? ' + Anschreiben' : ''} — dauert ca. 20 Sekunden.</Text>
              {!form.personal.firstName && <Text style={[s.errorText, { marginBottom: 12 }]}>Bitte Vornamen in Schritt 1 eingeben.</Text>}
              <TouchableOpacity style={[s.primaryBtn, { width: '100%', opacity: !form.personal.firstName ? 0.5 : 1 }]} onPress={handleGenerate} disabled={!form.personal.firstName} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>✨ Jetzt generieren</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAwareScrollViewCompat>

      {/* Bottom nav */}
      <View style={[s.bottomNav, { paddingBottom: botPad + 8 }]}>
        <TouchableOpacity style={[s.navBtn, step === 0 && { opacity: 0.3 }]} onPress={() => { Haptics.selectionAsync(); setStep(s => Math.max(0, s - 1)); }} disabled={step === 0}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
          <Text style={s.navBtnText}>Zurück</Text>
        </TouchableOpacity>
        {step < 4 && (
          <TouchableOpacity style={s.navBtnPrimary} onPress={() => { Haptics.selectionAsync(); setStep(s => Math.min(4, s + 1)); }}>
            <Text style={s.navBtnPrimaryText}>Weiter</Text>
            <Feather name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Field helper ──
function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, colors }: any) {
  const s = makeStyles(colors);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType || 'default'}
        multiline={!!multiline}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

// ── Styles ──
function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    authContainer: { paddingHorizontal: 24 },
    logoBox: { width: 80, height: 80, borderRadius: 22, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    logoTitle: { fontSize: 28, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold' },
    logoSub: { fontSize: 14, color: colors.mutedForeground, marginTop: 4 },
    header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 18, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 10 },
    stepRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
    stepDot: { height: 6, borderRadius: 3 },
    scrollContent: { padding: 20 },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    cardTitle: { fontSize: 16, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 14 },
    label: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 5 },
    input: { backgroundColor: colors.muted, borderRadius: 10, padding: 12, fontSize: 15, color: colors.foreground, borderWidth: 1, borderColor: colors.border, fontFamily: 'Inter_400Regular' },
    errorText: { color: colors.destructive, fontSize: 13, marginBottom: 8, fontFamily: 'Inter_400Regular' },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' as const, justifyContent: 'center' as const },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
    itemCard: { backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
    itemHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 12 },
    itemNum: { fontSize: 14, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: colors.primary },
    addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed' as const, justifyContent: 'center' as const },
    addBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
    switchRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 14 },
    skillRow: { flexDirection: 'row' as const, gap: 10, marginBottom: 12 },
    addIconBtn: { backgroundColor: colors.primary, borderRadius: 10, width: 46, alignItems: 'center' as const, justifyContent: 'center' as const },
    chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
    chip: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    chipText: { color: colors.primary, fontSize: 13, fontFamily: 'Inter_500Medium' },
    sectionTitle: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 12 },
    langRow: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border, gap: 8 },
    levelBtns: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
    levelBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted },
    levelBtnText: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
    langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, marginRight: 8, backgroundColor: colors.muted },
    langChipText: { fontSize: 13, color: colors.foreground, fontFamily: 'Inter_500Medium' },
    bottomNav: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, paddingHorizontal: 20, paddingTop: 14, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 },
    navBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    navBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    navBtnPrimary: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary },
    navBtnPrimaryText: { fontSize: 16, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: '#fff' },
    genOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', alignItems: 'center' as const, justifyContent: 'center' as const },
    genCard: { backgroundColor: '#fff', borderRadius: 24, padding: 36, alignItems: 'center' as const, width: 280 },
    genPhase: { fontSize: 16, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', color: '#0f172a', textAlign: 'center' as const },
  });
}
