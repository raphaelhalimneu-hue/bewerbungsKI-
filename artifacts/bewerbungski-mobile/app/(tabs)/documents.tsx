import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, ScrollView, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useListDocuments, useDeleteDocument } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

export default function DocumentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: docs, isLoading, refetch } = useListDocuments({ query: { enabled: !!user } as any });
  const deleteMutation = useDeleteDocument();
  const [selected, setSelected] = useState<any>(null);
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const botPad = isWeb ? 34 : insets.bottom;

  const s = makeStyles(colors);

  function fmtDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return iso; }
  }

  async function handleDelete(id: string, name: string) {
    if (Platform.OS === 'web') {
      if (!confirm(`„${name}" löschen?`)) return;
    } else {
      await new Promise(resolve =>
        Alert.alert('Löschen?', `„${name}" wirklich löschen?`, [
          { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Löschen', style: 'destructive', onPress: () => resolve(true) },
        ])
      );
    }
    try {
      await deleteMutation.mutateAsync({ id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
      if (selected?.id === id) setSelected(null);
    } catch {}
  }

  function openScanner(id: string) {
    Haptics.selectionAsync();
    setSelected(null);
    router.navigate({ pathname: '/(tabs)/scanner', params: { documentId: id } });
  }

  if (!user) {
    return (
      <View style={[s.centered, { paddingTop: topPad }]}>
        <Feather name="lock" size={40} color={colors.mutedForeground} />
        <Text style={[s.emptyTitle, { marginTop: 16 }]}>Nicht eingeloggt</Text>
        <Text style={s.emptyText}>Bitte zuerst im Erstellen-Tab anmelden.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        <Text style={s.headerTitle}>Meine Bewerbungen</Text>
      </View>

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={[s.modalHeader, { paddingTop: 20 }]}>
              <TouchableOpacity onPress={() => setSelected(null)} style={s.closeBtn}>
                <Feather name="x" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={s.modalTitle} numberOfLines={1}>{selected.name}</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: botPad + 40 }}>
              <TouchableOpacity
                style={s.scanButton}
                onPress={() => openScanner(selected.id)}
                activeOpacity={0.85}
                testID="check-document"
              >
                <Feather name="check-circle" size={18} color={colors.primaryForeground} />
                <Text style={s.scanButtonText}>Lebenslauf prüfen</Text>
              </TouchableOpacity>
              {selected.cover_letter ? (
                <>
                  <Text style={s.sectionTitle}>✉️ Bewerbung</Text>
                  <View style={[s.card, { marginBottom: 24 }]}>
                    <Text style={s.letterText}>{selected.cover_letter}</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.sectionTitle}>📋 Lebenslauf</Text>
                  <View style={s.card}>
                    <Text style={[s.letterText, { color: colors.mutedForeground }]}>Lebenslauf-Vorschau auf dem Desktop unter bewerbungski.com verfügbar.</Text>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {isLoading ? (
        <View style={s.centered}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : !docs?.length ? (
        <View style={[s.centered, { paddingHorizontal: 40 }]}>
          <Feather name="file-text" size={48} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { marginTop: 16 }]}>Noch keine Bewerbungen</Text>
          <Text style={s.emptyText}>Erstelle deine erste Bewerbung im Erstellen-Tab.</Text>
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={item => (item as any).id}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad + 40 }}
          refreshing={isLoading}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.docCard} onPress={() => setSelected(item)} activeOpacity={0.85}>
              <View style={{ flex: 1 }}>
                <Text style={s.docName} numberOfLines={2}>{(item as any).name}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {(item as any).job_title && <View style={s.tag}><Text style={s.tagText}>{(item as any).job_title}</Text></View>}
                  {(item as any).cover_letter && <View style={[s.tag, { backgroundColor: colors.accent }]}><Text style={[s.tagText, { color: colors.primary }]}>✉️ Bewerbung</Text></View>}
                </View>
                <Text style={s.docDate}>{fmtDate((item as any).created_at)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => openScanner((item as any).id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Lebenslauf prüfen"
                  testID={`check-document-${(item as any).id}`}
                >
                  <Feather name="check-circle" size={19} color={colors.primary} />
                </TouchableOpacity>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                <TouchableOpacity onPress={() => handleDelete((item as any).id, (item as any).name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="trash-2" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 22, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: colors.foreground },
    centered: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
    emptyTitle: { fontSize: 18, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    emptyText: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center' as const, marginTop: 8, fontFamily: 'Inter_400Regular' },
    docCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderColor: colors.border },
    docName: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', color: colors.foreground, lineHeight: 21 },
    docDate: { fontSize: 12, color: colors.mutedForeground, marginTop: 8, fontFamily: 'Inter_400Regular' },
    tag: { backgroundColor: colors.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
    tagText: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
    modalHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
    modalTitle: { flex: 1, fontSize: 17, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: colors.foreground },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: 'center' as const, justifyContent: 'center' as const },
    scanButton: { minHeight: 46, borderRadius: colors.radius, backgroundColor: colors.primary, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, marginBottom: 20 },
    scanButtonText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primaryForeground },
    sectionTitle: { fontSize: 16, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 12 },
    card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
    letterText: { fontSize: 14, lineHeight: 22, color: colors.foreground, fontFamily: 'Inter_400Regular' },
  });
}
