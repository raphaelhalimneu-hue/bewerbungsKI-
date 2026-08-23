import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { customFetch, useGetMe } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

type AnalyzeResult = {
  score: number;
  summary: string;
  strengths: string[];
  improvements: Array<{ title: string; tip: string }>;
};

type PerfectResult = {
  letter?: string;
  preview?: string;
  changes?: string[];
  locked?: boolean;
};

type StoredDocument = {
  name: string;
  cv_html?: string | null;
  profile_data?: { jobad?: { description?: string } } | null;
};

type MeProfile = {
  is_premium?: boolean;
  is_unlimited?: boolean;
  credits?: number;
  documents_count?: number;
};

function htmlToText(html: string): string {
  return html
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#039;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Returns true when the account has exhausted its free quota and needs an upgrade. */
function computeIsLocked(profile: MeProfile | undefined | null): boolean {
  if (!profile) return false;
  const isPremium = !!profile.is_premium;
  const isUnlimited = !!profile.is_unlimited;
  const credits = Number(profile.credits ?? 0);
  const docCount = Number(profile.documents_count ?? 0);
  // Locked: free user (no premium, no unlimited, no credits) who already has at least 1 document
  return !isPremium && !isUnlimited && credits <= 0 && docCount >= 1;
}

function getErrorMessage(error: unknown): string | 'locked' {
  const code = (error as { data?: { error?: string } })?.data?.error;
  switch (code) {
    case 'upgrade_required':
    case 'editing_requires_entitlement':
      return 'locked';
    case 'cv_too_short':
    case 'letter_too_short':
      return 'Bitte füge mindestens 80 Zeichen aus deinem Lebenslauf ein.';
    case 'daily_limit_reached':
      return 'Dein Tageslimit für diesen Check ist erreicht. Bitte versuche es morgen erneut.';
    case 'email_unverified':
      return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
    case 'busy_try_again':
      return 'Der KI-Check ist gerade stark ausgelastet. Bitte versuche es gleich noch einmal.';
    default:
      return 'Der Check konnte nicht durchgeführt werden. Bitte versuche es erneut.';
  }
}

function LockedBanner({ colors, styles }: { colors: ReturnType<typeof useColors>; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.lockedCard}>
      <View style={styles.lockedIconRow}>
        <Feather name="lock" size={28} color={colors.primary} />
      </View>
      <Text style={styles.lockedTitle}>Gratis-Bewerbung verbraucht</Text>
      <Text style={styles.lockedBody}>
        Du hast deine kostenlose Bewerbung bereits erstellt. Schalte dein Konto frei, um den
        CV-Check und die Perfektionierung weiter zu nutzen.
      </Text>
      <TouchableOpacity
        style={styles.lockedButton}
        activeOpacity={0.85}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Linking.openURL('https://bewerbungski.com/#pricing');
        }}
      >
        <Feather name="zap" size={16} color={colors.primaryForeground} />
        <Text style={styles.lockedButtonText}>Jetzt freischalten – bewerbungski.com</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ScannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { documentId: rawDocumentId } = useLocalSearchParams<{ documentId?: string | string[] }>();
  const documentId = Array.isArray(rawDocumentId) ? rawDocumentId[0] : rawDocumentId;
  const [cvText, setCvText] = useState('');
  const [jobText, setJobText] = useState('');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [improvedText, setImprovedText] = useState<string | null>(null);
  const [improvementChanges, setImprovementChanges] = useState<string[]>([]);
  const [improvedLocked, setImprovedLocked] = useState(false);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPerfecting, setIsPerfecting] = useState(false);
  const [error, setError] = useState('');
  const [serverLocked, setServerLocked] = useState(false);
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Fetch user profile to detect free-user lock state before any API call
  const { data: meData } = useGetMe({ query: { enabled: !!user } as any });
  const profile = meData as MeProfile | undefined;
  const profileLocked = computeIsLocked(profile);
  const isLocked = profileLocked || serverLocked;

  useEffect(() => {
    if (!documentId || !user) return;
    let cancelled = false;
    setIsLoadingDocument(true);
    setError('');

    customFetch<StoredDocument>(`/api/documents/${documentId}`)
      .then((document) => {
        if (cancelled) return;
        const extractedText = htmlToText(document.cv_html ?? '');
        if (extractedText.length < 80) {
          setError('Aus diesem Dokument konnte kein ausreichender Lebenslauf-Text geladen werden. Füge ihn bitte unten ein.');
          return;
        }
        setCvText(extractedText);
        setJobText(document.profile_data?.jobad?.description ?? '');
        setResult(null);
        setImprovedText(null);
        setImprovementChanges([]);
        Haptics.selectionAsync();
      })
      .catch(() => {
        if (!cancelled) setError('Dein Dokument konnte nicht geladen werden. Bitte versuche es noch einmal.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDocument(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, user?.id]);

  async function analyze() {
    const text = cvText.trim();
    if (text.length < 80) {
      setError('Bitte füge mindestens 80 Zeichen aus deinem Lebenslauf ein.');
      return;
    }

    setError('');
    setResult(null);
    setIsAnalyzing(true);
    try {
      const response = await customFetch<AnalyzeResult>('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          cvText: text,
          jobText: jobText.trim() || undefined,
          docType: 'cv',
          language: 'de',
        }),
      });
      setResult(response);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      if (msg === 'locked') {
        setServerLocked(true);
      } else {
        setError(msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function perfect() {
    const text = cvText.trim();
    if (text.length < 80) {
      setError('Bitte füge mindestens 80 Zeichen aus deinem Lebenslauf ein.');
      return;
    }

    setError('');
    setIsPerfecting(true);
    try {
      const response = await customFetch<PerfectResult>('/api/perfect', {
        method: 'POST',
        body: JSON.stringify({
          letterText: text,
          jobText: jobText.trim() || undefined,
          docType: 'cv',
          language: 'de',
        }),
      });
      const textToShow = response.locked ? response.preview : response.letter;
      if (!textToShow) {
        setError('Die verbesserte Version konnte nicht angezeigt werden. Bitte versuche es erneut.');
        return;
      }
      setImprovedText(textToShow);
      setImprovedLocked(Boolean(response.locked));
      setImprovementChanges(Array.isArray(response.changes) ? response.changes : []);
      setResult(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      if (msg === 'locked') {
        setServerLocked(true);
      } else {
        setError(msg);
      }
    } finally {
      setIsPerfecting(false);
    }
  }

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: topPad, backgroundColor: colors.background }]}>
        <Feather name="lock" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { marginTop: 16 }]}>Bitte anmelden</Text>
        <Text style={styles.emptyText}>Melde dich im Tab „Erstellen" an, um deinen Lebenslauf prüfen zu lassen.</Text>
      </View>
    );
  }

  const score = result ? Math.max(0, Math.min(100, Math.round(result.score))) : 0;
  const scoreColor = score >= 70 ? colors.success : score >= 45 ? colors.accentForeground : colors.destructive;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: bottomPad + 118 }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={100}
      >
        <View style={styles.heading}>
          <View style={styles.headingIcon}>
            <Feather name="check-circle" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>CV-Check</Text>
            <Text style={styles.subtitle}>Erhalte klare Hinweise von einem KI-Bewerbungscoach.</Text>
          </View>
        </View>

        {/* Locked state: show upgrade banner instead of the input form */}
        {isLocked ? (
          <LockedBanner colors={colors} styles={styles} />
        ) : (
          <View style={styles.card}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Lebenslauf</Text>
              {isLoadingDocument ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>
            <TextInput
              value={cvText}
              onChangeText={(value) => {
                setCvText(value);
                setError('');
              }}
              placeholder="Füge hier den Text deines Lebenslaufs ein …"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              autoCorrect={false}
              style={styles.cvInput}
              testID="cv-check-input"
            />
            <Text style={styles.hint}>{cvText.trim().length} Zeichen · mindestens 80 erforderlich</Text>

            <Text style={[styles.label, { marginTop: 18 }]}>Stellenanzeige <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              value={jobText}
              onChangeText={setJobText}
              placeholder="Füge die Stellenanzeige ein, damit die Tipps besser passen."
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              autoCorrect={false}
              style={styles.jobInput}
              testID="cv-check-job-input"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, (isAnalyzing || isPerfecting || cvText.trim().length < 80) && styles.disabled]}
              onPress={analyze}
              disabled={isAnalyzing || isPerfecting || cvText.trim().length < 80}
              activeOpacity={0.85}
              testID="run-cv-check"
            >
              {isAnalyzing ? <ActivityIndicator color={colors.primaryForeground} /> : <Feather name="search" size={18} color={colors.primaryForeground} />}
              <Text style={styles.primaryButtonText}>{isAnalyzing ? 'Wird geprüft …' : 'Lebenslauf prüfen'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, (isAnalyzing || isPerfecting || cvText.trim().length < 80) && styles.disabled]}
              onPress={perfect}
              disabled={isAnalyzing || isPerfecting || cvText.trim().length < 80}
              activeOpacity={0.85}
              testID="perfect-cv"
            >
              {isPerfecting ? <ActivityIndicator color={colors.primary} /> : <Feather name="edit-3" size={17} color={colors.primary} />}
              <Text style={styles.secondaryButtonText}>{isPerfecting ? 'Wird verbessert …' : 'Lebenslauf perfektionieren'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {result ? (
          <View style={styles.card}>
            <View style={styles.scoreRow}>
              <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
                <Text style={[styles.scoreValue, { color: scoreColor }]}>{score}</Text>
                <Text style={styles.scoreCaption}>von 100</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scoreTitle}>Dein Eindruck im CV-Check</Text>
                <Text style={styles.summary}>{result.summary}</Text>
              </View>
            </View>

            {result.strengths?.length ? (
              <View style={styles.resultSection}>
                <View style={styles.sectionHeading}>
                  <Feather name="check" size={17} color={colors.success} />
                  <Text style={styles.sectionTitle}>Stärken</Text>
                </View>
                {result.strengths.map((strength, index) => (
                  <View key={`${strength}-${index}`} style={styles.bulletRow}>
                    <View style={[styles.bullet, { backgroundColor: colors.success }]} />
                    <Text style={styles.bulletText}>{strength}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {result.improvements?.length ? (
              <View style={styles.resultSection}>
                <View style={styles.sectionHeading}>
                  <Feather name="zap" size={17} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Verbesserungstipps</Text>
                </View>
                {result.improvements.map((improvement, index) => (
                  <View key={`${improvement.title}-${index}`} style={styles.tipCard}>
                    <Text style={styles.tipTitle}>{improvement.title}</Text>
                    <Text style={styles.tipText}>{improvement.tip}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {improvedText ? (
          <View style={styles.card}>
            <View style={styles.sectionHeading}>
              <Feather name="edit-3" size={17} color={colors.primary} />
              <Text style={styles.sectionTitle}>Verbesserte Version</Text>
            </View>
            <View style={styles.improvedBox}>
              <Text selectable={!improvedLocked} style={styles.improvedText}>{improvedText}</Text>
            </View>
            {improvedLocked ? (
              <View style={styles.lockHint}>
                <Feather name="lock" size={15} color={colors.mutedForeground} />
                <Text style={styles.lockHintText}>Dies ist eine geschützte Vorschau. Schalte dein Konto frei, um den vollständigen Text zu erhalten.</Text>
              </View>
            ) : null}
            {improvementChanges.length ? (
              <View style={styles.changeList}>
                <Text style={styles.changeTitle}>Das wurde verbessert</Text>
                {improvementChanges.map((change, index) => (
                  <View key={`${change}-${index}`} style={styles.bulletRow}>
                    <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                    <Text style={styles.bulletText}>{change}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    content: { paddingHorizontal: 16 },
    centered: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 36 },
    emptyTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', color: colors.foreground },
    emptyText: { marginTop: 8, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' as const },
    heading: { flexDirection: 'row' as const, gap: 12, marginBottom: 18, alignItems: 'center' as const },
    headingIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.accent },
    title: { fontSize: 24, lineHeight: 30, fontFamily: 'Inter_700Bold', color: colors.foreground },
    subtitle: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius + 4, padding: 16, marginBottom: 16 },
    labelRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
    label: { fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground },
    optional: { fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    cvInput: { minHeight: 190, marginTop: 8, padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.background, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    jobInput: { minHeight: 110, marginTop: 8, padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.background, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    hint: { marginTop: 6, fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    error: { marginTop: 12, color: colors.destructive, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
    primaryButton: { minHeight: 50, marginTop: 18, backgroundColor: colors.primary, borderRadius: colors.radius, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 9 },
    primaryButtonText: { color: colors.primaryForeground, fontSize: 15, fontFamily: 'Inter_700Bold' },
    secondaryButton: { minHeight: 46, marginTop: 10, borderWidth: 1, borderColor: colors.primary, borderRadius: colors.radius, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 8 },
    secondaryButtonText: { color: colors.primary, fontSize: 14, fontFamily: 'Inter_700Bold' },
    disabled: { opacity: 0.5 },
    scoreRow: { flexDirection: 'row' as const, gap: 16, alignItems: 'center' as const },
    scoreCircle: { width: 96, height: 96, borderRadius: 48, borderWidth: 6, alignItems: 'center' as const, justifyContent: 'center' as const },
    scoreValue: { fontSize: 29, lineHeight: 33, fontFamily: 'Inter_700Bold' },
    scoreCaption: { fontSize: 11, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
    scoreTitle: { fontSize: 16, lineHeight: 21, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 4 },
    summary: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    resultSection: { marginTop: 22 },
    sectionHeading: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7, marginBottom: 10 },
    sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground },
    bulletRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 9, marginBottom: 8 },
    bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
    bulletText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', color: colors.foreground },
    tipCard: { backgroundColor: colors.muted, borderRadius: colors.radius, padding: 12, marginBottom: 9 },
    tipTitle: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 3 },
    tipText: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    improvedBox: { backgroundColor: colors.background, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 12 },
    improvedText: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', color: colors.foreground },
    lockHint: { flexDirection: 'row' as const, gap: 7, alignItems: 'flex-start' as const, marginTop: 12 },
    lockHintText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    changeList: { marginTop: 18 },
    changeTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 8 },
    // Locked-state banner
    lockedCard: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary, borderRadius: colors.radius + 4, padding: 24, marginBottom: 16, alignItems: 'center' as const },
    lockedIconRow: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 16 },
    lockedTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.foreground, textAlign: 'center' as const, marginBottom: 10 },
    lockedBody: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' as const, marginBottom: 20 },
    lockedButton: { flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const, backgroundColor: colors.primary, borderRadius: colors.radius, paddingHorizontal: 20, paddingVertical: 13 },
    lockedButtonText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primaryForeground },
  });
}
