import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking, ActivityIndicator, Alert, AppState, AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useGetMe, customFetch } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { data: profile, refetch: refetchMe } = useGetMe({ query: { enabled: !!user } as any });
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const botPad = isWeb ? 34 : insets.bottom;
  const s = makeStyles(colors);

  const [checkoutLoading, setCheckoutLoading] = useState<'premium' | 'power' | null>(null);
  const appState = useRef(AppState.currentState);
  const pendingCheckout = useRef(false);

  // Refresh entitlement when user returns to the app after Stripe checkout
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active' && pendingCheckout.current) {
        pendingCheckout.current = false;
        refetchMe();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [refetchMe]);

  const isPremium = !!(profile as any)?.is_premium;
  const isUnlimited = !!(profile as any)?.is_unlimited;
  const perfectRemaining = Math.max(0, Number((profile as any)?.perfect_remaining ?? 50));

  async function startCheckout(kind: 'single' | 'unlimited', label: 'premium' | 'power') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCheckoutLoading(label);
    try {
      const result = await customFetch<{ url: string }>('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      if (result?.url) {
        pendingCheckout.current = true;
        await Linking.openURL(result.url);
      } else {
        Alert.alert('Fehler', 'Checkout konnte nicht gestartet werden. Bitte versuche es erneut.');
      }
    } catch {
      Alert.alert('Fehler', 'Verbindung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setCheckoutLoading(null);
    }
  }

  if (!user) {
    return (
      <View style={[s.centered, { paddingTop: topPad + 40 }]}>
        <Feather name="user" size={48} color={colors.mutedForeground} />
        <Text style={[s.emptyTitle, { marginTop: 16 }]}>Nicht eingeloggt</Text>
        <Text style={s.emptyText}>Erstelle zuerst im Erstellen-Tab ein Konto.</Text>
      </View>
    );
  }

  const docCount = (profile as any)?.documents_count ?? 0;

  const planLabel = isUnlimited ? 'Power ∞' : isPremium ? 'Premium' : 'Completely free';
  const planColor = isUnlimited
    ? colors.primary
    : isPremium
    ? '#8b5cf6'
    : colors.mutedForeground;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        <Text style={s.headerTitle}>Mein Konto</Text>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: botPad + 60 }]}>
        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(user.email || 'U')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.email}>{user.email}</Text>
            <View style={[s.badge, { backgroundColor: colors.muted }]}>
              <Text style={[s.badgeText, { color: planColor }]}>{planLabel}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statNum}>{docCount}</Text>
            <Text style={s.statLabel}>Bewerbungen</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>{isUnlimited ? `${perfectRemaining}/50` : '∞'}</Text>
            <Text style={s.statLabel}>{isUnlimited ? 'Perfektionierungen' : 'Alle Funktionen'}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>8</Text>
            <Text style={s.statLabel}>Sprachen</Text>
          </View>
        </View>

        {/* Pricing section */}
        {!isUnlimited && (
          <View style={{ marginBottom: 16 }}>
            <Text style={s.sectionTitle}>Pakete</Text>

            {/* Premium package */}
            <View style={[s.packageCard, { marginBottom: 10 }]}>
              <View style={s.packageHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.packageName}>Premium</Text>
                  <Text style={s.packageSub}>Einmalig — 10 Bewerbungen</Text>
                </View>
                <Text style={s.packagePrice}>14,99 €</Text>
              </View>
              <View style={s.featureList}>
                <FeatureRow text="10 Bewerbungen erstellen" colors={colors} />
                <FeatureRow text="Alle Design-Vorlagen & Briefköpfe" colors={colors} />
                <FeatureRow text="PDF- & Word-Download + Drucken" colors={colors} />
                <FeatureRow text="10× KI-Perfektionieren" colors={colors} />
              </View>
              {isPremium ? (
                <View style={[s.activeBtn, { backgroundColor: '#8b5cf620' }]}>
                  <Feather name="check-circle" size={16} color="#8b5cf6" />
                  <Text style={[s.activeBtnText, { color: '#8b5cf6' }]}>✓ Premium aktiv</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.buyBtn, { backgroundColor: colors.muted }]}
                  onPress={() => startCheckout('single', 'premium')}
                  disabled={checkoutLoading !== null}
                  activeOpacity={0.8}
                >
                  {checkoutLoading === 'premium' ? (
                    <ActivityIndicator size="small" color={colors.foreground} />
                  ) : (
                    <Text style={[s.buyBtnText, { color: colors.foreground }]}>Jetzt kaufen →</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Power package */}
            <View style={[s.packageCard, s.packageCardHighlight, { borderColor: colors.primary }]}>
              <View style={[s.bestValueBadge, { backgroundColor: colors.primary }]}>
                <Text style={s.bestValueText}>Bester Deal</Text>
              </View>
              <View style={[s.packageHeader, { marginTop: 8 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.packageName, { color: colors.primary }]}>POWER</Text>
                  <Text style={s.packageSub}>Unbegrenzt Bewerbungen</Text>
                </View>
                <Text style={[s.packagePrice, { color: colors.primary }]}>29,90 €</Text>
              </View>
              <View style={s.featureList}>
                <FeatureRow text="Unbegrenzt Bewerbungen erstellen" colors={colors} highlight />
                <FeatureRow text="50× KI-Perfektionieren" colors={colors} highlight />
                <FeatureRow text="Alle Design-Vorlagen & Briefköpfe" colors={colors} highlight />
                <FeatureRow text="PDF- & Word-Download + Drucken" colors={colors} highlight />
              </View>
              <TouchableOpacity
                style={[s.buyBtn, { backgroundColor: colors.primary }]}
                onPress={() => startCheckout('unlimited', 'power')}
                disabled={checkoutLoading !== null}
                activeOpacity={0.8}
              >
                {checkoutLoading === 'power' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[s.buyBtnText, { color: '#fff' }]}>Jetzt kaufen →</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Power active banner */}
        {isUnlimited && (
          <View style={[s.activeBanner, { borderColor: colors.primary, backgroundColor: `${colors.primary}15` }]}>
            <Feather name="zap" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[s.activeBannerTitle, { color: colors.primary }]}>Power aktiv</Text>
              <Text style={[s.activeBannerSub, { color: colors.mutedForeground }]}>
                Unbegrenzt Bewerbungen · Noch {perfectRemaining} von 50 KI-Perfektionierungen verfügbar
              </Text>
            </View>
          </View>
        )}

        {/* Menu items */}
        <View style={s.menuCard}>
          <MenuItem icon="globe" label="Web-App öffnen" sub="bewerbungski.com" colors={colors} onPress={() => Linking.openURL('https://bewerbungski.com')} />
          <MenuDivider colors={colors} />
          <MenuItem icon="mail" label="Support" sub="support@bewerbungski.com" colors={colors} onPress={() => Linking.openURL('mailto:support@bewerbungski.com')} />
          <MenuDivider colors={colors} />
          <MenuItem icon="shield" label="Datenschutz" colors={colors} onPress={() => Linking.openURL('https://bewerbungski.com/privacy')} />
        </View>

        <TouchableOpacity
          style={s.signOutBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); signOut(); }}
          activeOpacity={0.85}
        >
          <Feather name="log-out" size={18} color={colors.destructive} />
          <Text style={s.signOutText}>Abmelden</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function FeatureRow({ text, colors, highlight }: { text: string; colors: any; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <Feather name="check" size={14} color={highlight ? colors.primary : colors.mutedForeground} />
      <Text style={{ fontSize: 13, color: colors.foreground, fontFamily: 'Inter_400Regular', flex: 1 }}>{text}</Text>
    </View>
  );
}

function MenuItem({ icon, label, sub, colors, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 }} activeOpacity={0.7}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={18} color={colors.foreground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.foreground }}>{label}</Text>
        {sub && <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 }}>{sub}</Text>}
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function MenuDivider({ colors }: { colors: any }) {
  return <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 14 }} />;
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 22, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: colors.foreground },
    scroll: { padding: 20 },
    centered: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
    emptyTitle: { fontSize: 18, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    emptyText: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center' as const, marginTop: 8, fontFamily: 'Inter_400Regular' },
    profileCard: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: colors.card, borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: colors.border, gap: 14 },
    avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center' as const, justifyContent: 'center' as const },
    avatarText: { fontSize: 22, fontWeight: '700' as const, color: '#fff' },
    email: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    badge: { alignSelf: 'flex-start' as const, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
    badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
    statsRow: { flexDirection: 'row' as const, gap: 10, marginBottom: 16 },
    statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 16, alignItems: 'center' as const, borderWidth: 1, borderColor: colors.border },
    statNum: { fontSize: 26, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: colors.primary },
    statLabel: { fontSize: 11, color: colors.mutedForeground, marginTop: 4, fontFamily: 'Inter_400Regular', textAlign: 'center' as const },
    sectionTitle: { fontSize: 16, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 10 },
    packageCard: { backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border },
    packageCardHighlight: { borderWidth: 2, position: 'relative' as const, overflow: 'visible' as const },
    packageHeader: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, marginBottom: 12, gap: 8 },
    packageName: { fontSize: 17, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: colors.foreground },
    packageSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
    packagePrice: { fontSize: 20, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: colors.foreground },
    featureList: { marginBottom: 14 },
    buyBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' as const, justifyContent: 'center' as const, minHeight: 46 },
    buyBtnText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
    activeBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 8, minHeight: 46 },
    activeBtnText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
    bestValueBadge: { position: 'absolute' as const, top: -12, right: 14, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    bestValueText: { fontSize: 11, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: '#fff' },
    activeBanner: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, borderRadius: 18, borderWidth: 2, padding: 18, marginBottom: 16 },
    activeBannerTitle: { fontSize: 16, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
    activeBannerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
    menuCard: { backgroundColor: colors.card, borderRadius: 18, marginBottom: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' as const },
    signOutBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 10, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.destructive },
    signOutText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', color: colors.destructive },
  });
}
