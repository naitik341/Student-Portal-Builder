import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFeedbackSummary } from '@workspace/api-client-react';

const C = {
  cream: '#F1ECEC',
  orange: '#F06A14',
  orangePressed: '#D9570A',
  ink: '#000000',
  white: '#FCFCFC',
  muted: '#756B69',
  line: '#D7CECC',
  danger: '#B9141A',
};
const BOLD = 'ArchivoBlack_400Regular';
type SummaryResult = Awaited<ReturnType<typeof getFeedbackSummary>>;

function statusOf(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : 0;
}

function messageOf(error: unknown) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'Please try again.');
  }
  return 'Please try again.';
}

export default function ManagerDashboard() {
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const countsByItem = useMemo(() => {
    const groups = new Map<string, SummaryResult['counts']>();
    for (const row of summary?.counts ?? []) {
      groups.set(row.item, [...(groups.get(row.item) ?? []), row]);
    }
    return [...groups.entries()];
  }, [summary]);

  const generateSummary = async () => {
    setLoading(true);
    setError('');
    setAccessDenied(false);
    setSummary(null);
    try {
      const result = await getFeedbackSummary();
      setSummary(result);
    } catch (reason) {
      const forbidden = statusOf(reason) === 403;
      setAccessDenied(forbidden);
      setError(forbidden
        ? 'You are signed in, but this verified email is not authorized as a MessMate manager. Ask an administrator to add it to MANAGER_EMAILS.'
        : statusOf(reason) === 401
          ? 'Your manager session has expired. Sign in again to generate the summary.'
          : messageOf(reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen} testID="manager-dashboard">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: (insets.top || 0) + 25, paddingBottom: Math.max(insets.bottom, 18) + 28 },
          ...(Platform.OS === 'web' ? [styles.webInsets] : []),
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}><Ionicons name="restaurant" size={22} color={C.white} /></View>
            <View>
              <Text style={styles.eyebrow}>MESSMATE</Text>
              <Text style={styles.title}>MANAGER</Text>
            </View>
          </View>
          <Link href="/manager/menu" asChild>
            <Pressable testID="manager-edit-menu" accessibilityRole="link" style={({ pressed }) => [styles.editMenuButton, pressed && styles.pressed]}>
              <Ionicons name="create-outline" size={19} color={C.white} />
              <Text style={styles.editMenuText}>EDIT MENU</Text>
              <Ionicons name="arrow-forward" size={15} color={C.white} />
            </Pressable>
          </Link>
        </View>

        <View style={styles.welcomeCard}>
          <View style={styles.welcomeIcon}><Ionicons name="sunny-outline" size={24} color={C.orange} /></View>
          <Text style={styles.welcomeTitle}>GOOD FOOD, BETTER DAYS.</Text>
          <Text style={styles.welcomeCopy}>Manage the student menu and turn their feedback into something actionable.</Text>
        </View>

        <Link href="/manager/feedback" asChild>
          <Pressable testID="manager-view-feedback" accessibilityRole="link" style={({ pressed }) => [styles.feedbackLink, pressed && styles.pressed]}>
            <Ionicons name="chatbubbles-outline" size={21} color={C.white} />
            <Text style={styles.feedbackLinkText}>VIEW DELIVERED FEEDBACK</Text>
            <Ionicons name="arrow-forward" size={17} color={C.white} />
          </Pressable>
        </Link>

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionKicker}>WHAT STUDENTS ARE SAYING</Text>
            <Text style={styles.sectionTitle}>FEEDBACK SUMMARY</Text>
          </View>
          <View style={styles.sparkIcon}><Ionicons name="sparkles" size={20} color={C.orange} /></View>
        </View>

        <View style={styles.summaryCard} testID="manager-ai-summary">
          <View style={styles.summaryIntro}>
            <Text style={styles.summaryLabel}>AI-POWERED INSIGHTS</Text>
            <Text style={styles.summaryNote}>Generated on request; this action may use AI credits.</Text>
          </View>
          <Pressable
            testID="manager-generate-summary"
            accessibilityRole="button"
            accessibilityLabel="Generate AI feedback summary"
            onPress={() => { void generateSummary(); }}
            disabled={loading}
            style={({ pressed }) => [styles.generateButton, pressed && styles.pressed, loading && styles.disabled]}
          >
            {loading ? <ActivityIndicator color={C.white} size="small" /> : <Ionicons name="sparkles" size={18} color={C.white} />}
            <Text style={styles.generateText}>{loading ? 'GENERATING…' : 'GENERATE AI SUMMARY'}</Text>
          </Pressable>

          {!!error && (
            <View style={styles.errorPanel} testID="manager-summary-error" accessibilityRole="alert">
              <Ionicons name={accessDenied ? 'lock-closed-outline' : 'alert-circle-outline'} size={19} color={C.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {summary && (
            <View style={styles.summaryOutput} testID="manager-summary-result">
              <Text style={styles.outputHeading}>THE BIG PICTURE</Text>
              <Text style={styles.summaryText}>{summary.summary || 'The summary service returned no written summary.'}</Text>
              <View style={styles.countHeadingRow}>
                <Text style={styles.outputHeading}>TOP FEEDBACK BY ITEM</Text>
                <Text style={styles.countTotal}>{summary.counts.reduce((total, count) => total + count.count, 0)} MENTIONS</Text>
              </View>
              {countsByItem.length ? countsByItem.map(([item, rows]) => (
                <View key={item} style={styles.itemGroup}>
                  <Text style={styles.itemName}>{item}</Text>
                  <View style={styles.tags}>
                    {rows.map((row, index) => (
                      <View key={`${row.tag}-${index}`} style={styles.tagCount}>
                        <Text style={styles.tagText}>{row.tag}</Text>
                        <Text style={styles.tagNumber}>{row.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )) : (
                <Text style={styles.emptyCounts}>No item-grouped feedback counts were returned.</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 23, gap: 24 },
  webInsets: { paddingTop: 67, paddingBottom: 34 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: C.orange, fontFamily: BOLD, fontSize: 10, letterSpacing: 1.1 },
  title: { color: C.ink, fontFamily: BOLD, fontSize: 23, lineHeight: 28 },
  editMenuButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 45, paddingHorizontal: 13, borderRadius: 15, backgroundColor: C.orange },
  editMenuText: { color: C.white, fontFamily: BOLD, fontSize: 11 },
  feedbackLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 52, borderRadius: 17, backgroundColor: C.orange },
  feedbackLinkText: { color: C.white, fontFamily: BOLD, fontSize: 12 },
  welcomeCard: { backgroundColor: C.ink, borderRadius: 22, padding: 21, overflow: 'hidden' },
  welcomeIcon: { width: 44, height: 44, backgroundColor: C.white, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  welcomeTitle: { color: C.white, fontFamily: BOLD, fontSize: 20, letterSpacing: -0.5 },
  welcomeCopy: { color: '#E8DEDB', fontSize: 14, lineHeight: 21, marginTop: 7, maxWidth: 550 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  sectionKicker: { color: C.orange, fontFamily: BOLD, fontSize: 10, letterSpacing: 0.7 },
  sectionTitle: { color: C.ink, fontFamily: BOLD, fontSize: 22, marginTop: 4 },
  sparkIcon: { width: 40, height: 40, borderWidth: 1.5, borderColor: C.ink, borderRadius: 14, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { borderWidth: 2, borderColor: C.ink, borderRadius: 22, backgroundColor: C.white, padding: 18 },
  summaryIntro: { marginBottom: 15 },
  summaryLabel: { color: C.ink, fontFamily: BOLD, fontSize: 12 },
  summaryNote: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  generateButton: { minHeight: 52, backgroundColor: C.orange, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  generateText: { color: C.white, fontFamily: BOLD, fontSize: 14 },
  pressed: { transform: [{ scale: 0.96 }], backgroundColor: C.orangePressed },
  disabled: { opacity: 0.62 },
  errorPanel: { borderWidth: 1.5, borderColor: C.danger, borderRadius: 13, backgroundColor: '#FFF2F0', padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 14 },
  errorText: { flex: 1, color: C.danger, fontSize: 13, lineHeight: 19 },
  summaryOutput: { borderTopWidth: 1, borderTopColor: C.line, marginTop: 18, paddingTop: 18 },
  outputHeading: { color: C.ink, fontFamily: BOLD, fontSize: 11, letterSpacing: 0.45 },
  summaryText: { color: C.ink, fontSize: 15, lineHeight: 23, marginTop: 8 },
  countHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 21, marginBottom: 10 },
  countTotal: { color: C.muted, fontFamily: BOLD, fontSize: 9 },
  itemGroup: { borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 12 },
  itemName: { color: C.ink, fontFamily: BOLD, fontSize: 14, marginBottom: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tagCount: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.cream, borderRadius: 16, paddingHorizontal: 10 },
  tagText: { color: C.ink, fontSize: 12 },
  tagNumber: { minWidth: 19, minHeight: 19, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', borderRadius: 10, backgroundColor: C.orange, color: C.white, fontFamily: BOLD, fontSize: 10 },
  emptyCounts: { color: C.muted, fontSize: 13, lineHeight: 19 },
});