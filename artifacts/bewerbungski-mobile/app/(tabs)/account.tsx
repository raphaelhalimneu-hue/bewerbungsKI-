import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useGetMe } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { data: profile } = useGetMe({ query: { enabled: !!user } as any });
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const botPad = isWeb ? 34 : insets.bottom;
  const s = makeStyles(colors);

  if (!user) {
    return (
      <View style={[s.centered, { paddingTop: topPad + 40 }]}>
        <Feather name="user" size={48} color={colors.mutedForeground} />
        <Text style={[s.emptyTitle, { marginTop: 16 }]}>Nicht eingeloggt</Text>
        <Text style={s.emptyText}>Erstelle zuerst im Erstellen-Tab ein Konto.</Text>
      </View>
    );
  }

  const isPremium = (profile as any)?.is_premium ?? false;
  const docCount = (profile as any)?.documents_count ?? 0;
  const docLimit = (profile as any)?.document_limit ?? (isPremium ? 33 : 3);

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
            <View style={[s.badge, { backgroundColor: isPremium ? '#fef3c7' : colors.muted }]}>
              <Text style={[s.badgeText, { color: isPremium ? '#92400e' : colors.mutedForeground }]}>
                {isPremium ? '⭐ Premium' : 'Kostenlos'}
              </Text>
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
            <Text style={s.statNum}>{docLimit}</Text>
            <Text style={s.statLabel}>Max. erlaubt</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>8</Text>
            <Text style={s.statLabel}>Sprachen</Text>
          </View>
        </View>

        {/* Premium upgrade */}
        {!isPremium && (
          <TouchableOpacity
            style={s.upgradeCard}
            activeOpacity={0.88}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL('https://bewerbungski.com/pricing'); }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <Text style={{ fontSize: 28 }}>⭐</Text>
              <Text style={s.upgradeTitle}>Premium freischalten</Text>
            </View>
            <Text style={s.upgradeSub}>20 weitere Bewerbungen · 8 Sprachen · Alle Templates</Text>
            <View style={[s.primaryBtn, { marginTop: 16 }]}>
              <Text style={s.primaryBtnText}>9,99 € einmalig → Upgrade</Text>
            </View>
          </TouchableOpacity>
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
    upgradeCard: { backgroundColor: '#0f172a', borderRadius: 18, padding: 20, marginBottom: 16 },
    upgradeTitle: { fontSize: 18, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: '#fff' },
    upgradeSub: { fontSize: 13, color: '#94a3b8', fontFamily: 'Inter_400Regular', lineHeight: 20 },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' as const },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
    menuCard: { backgroundColor: colors.card, borderRadius: 18, marginBottom: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' as const },
    signOutBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 10, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.destructive },
    signOutText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', color: colors.destructive },
  });
}
