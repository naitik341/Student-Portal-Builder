import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getListDeliveredFeedbackQueryKey, getListFeedbackDatesQueryKey, useListDeliveredFeedback, useListFeedbackDates } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

const MEALS = ['Breakfast', 'Lunch', 'Dinner'] as const;
type Meal = typeof MEALS[number];
const BOLD = 'ArchivoBlack_400Regular';

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function moveDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function statusOf(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status) : 0;
}

export default function ManagerFeedback() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [date, setDate] = useState(() => localDate(new Date()));
  const [meal, setMeal] = useState<Meal>('Breakfast');
  const [showDates, setShowDates] = useState(false);
  const params = { date, meal };
  const query = useListDeliveredFeedback(params, {
    query: {
      enabled: !!userId,
      queryKey: [...getListDeliveredFeedbackQueryKey(params), userId],
      staleTime: 0,
      refetchOnMount: 'always',
    },
  });
  const datesQuery = useListFeedbackDates({ meal }, {
    query: {
      enabled: !!userId,
      queryKey: [...getListFeedbackDatesQueryKey({ meal }), userId],
      staleTime: 0,
      refetchOnMount: 'always',
    },
  });

  const errorStatus = statusOf(query.error);
  const errorText = errorStatus === 403
    ? 'This account is not authorized to view student feedback. Ask an administrator to add your verified email to MANAGER_EMAILS.'
    : errorStatus === 401
      ? 'Your session has expired. Sign in again to view feedback.'
      : 'Feedback could not be loaded. Check your connection and try again.';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]} testID="manager-feedback-screen">
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 26, paddingBottom: insets.bottom + 30 }]}>
        <Link href="/manager" asChild>
          <Pressable accessibilityRole="link" style={styles.back}>
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
            <Text style={[styles.backText, { color: colors.foreground }]}>MANAGER</Text>
          </Pressable>
        </Link>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>WHAT STUDENTS ARE SAYING</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>MEAL FEEDBACK</Text>
        <Text style={[styles.caption, { color: colors.mutedForeground }]}>Delivered ratings and comments, without student or device details.</Text>

        <View style={[styles.dateBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable testID="feedback-previous-day" accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => setDate(current => moveDate(current, -1))} style={styles.dateButton}>
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
          <View style={styles.dateLabel}>
            <Text style={[styles.dateHeading, { color: colors.mutedForeground }]}>MEAL DATE</Text>
            <Text style={[styles.dateText, { color: colors.foreground }]}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          </View>
          <Pressable testID="feedback-next-day" accessibilityRole="button" accessibilityLabel="Next day" onPress={() => setDate(current => moveDate(current, 1))} style={styles.dateButton}>
            <Ionicons name="chevron-forward" size={22} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.meals}>
          {MEALS.map(option => (
            <Pressable
              key={option}
              testID={`feedback-meal-${option.toLowerCase()}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: meal === option }}
              onPress={() => setMeal(option)}
              style={[styles.mealButton, { backgroundColor: meal === option ? colors.foreground : colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.mealText, { color: meal === option ? colors.card : colors.foreground }]}>{option.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          testID="feedback-date-picker"
          accessibilityRole="button"
          accessibilityState={{ expanded: showDates }}
          onPress={() => {
            if (!showDates) void datesQuery.refetch();
            setShowDates(current => !current);
          }}
          style={[styles.jumpButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="calendar-outline" size={19} color={colors.primary} />
          <Text style={[styles.jumpText, { color: colors.foreground }]}>JUMP TO A DATE WITH {meal.toUpperCase()} FEEDBACK</Text>
          <Ionicons name={showDates ? 'chevron-up' : 'chevron-down'} size={19} color={colors.foreground} />
        </Pressable>
        {showDates && (
          <View style={[styles.dateChoices, { backgroundColor: colors.card, borderColor: colors.border }]} testID="feedback-available-dates">
            {datesQuery.isPending ? (
              <View style={styles.dateMessage}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.mutedForeground }}>Loading dates…</Text></View>
            ) : datesQuery.isError ? (
              <View style={styles.dateMessage}>
                <Text accessibilityRole="alert" style={{ color: colors.destructive }}>
                  {statusOf(datesQuery.error) === 403 ? 'Not authorized to view feedback dates.' : statusOf(datesQuery.error) === 401 ? 'Sign in again to view feedback dates.' : 'Could not load feedback dates.'}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => void datesQuery.refetch()}><Text style={{ color: colors.primary }}>RETRY</Text></Pressable>
              </View>
            ) : !datesQuery.data?.length ? (
              <Text style={[styles.dateMessage, { color: colors.mutedForeground }]}>No delivered {meal.toLowerCase()} feedback yet.</Text>
            ) : (
              <ScrollView nestedScrollEnabled style={styles.dateList}>
                {datesQuery.data.map(entry => (
                  <Pressable
                    key={entry.date}
                    testID={`feedback-jump-${entry.date}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}, ${entry.count} ${entry.count === 1 ? 'response' : 'responses'}`}
                    onPress={() => { setDate(entry.date); setShowDates(false); }}
                    style={[styles.dateChoice, { borderBottomColor: colors.border, backgroundColor: date === entry.date ? colors.secondary : colors.card }]}
                  >
                    <Text style={[styles.choiceDate, { color: colors.foreground }]}>{new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                    <Text style={[styles.choiceCount, { color: colors.mutedForeground }]}>{entry.count} {entry.count === 1 ? 'response' : 'responses'}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {query.isPending || query.isFetching && !query.data ? (
          <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={[styles.stateText, { color: colors.mutedForeground }]}>Loading delivered feedback…</Text></View>
        ) : query.isError ? (
          <View style={styles.state} testID="feedback-load-error">
            <Ionicons name="alert-circle-outline" size={28} color={colors.destructive} />
            <Text accessibilityRole="alert" style={[styles.stateText, { color: colors.destructive }]}>{errorText}</Text>
            <Pressable accessibilityRole="button" onPress={() => void query.refetch()} style={[styles.retry, { backgroundColor: colors.primary }]}>
              <Text style={[styles.retryText, { color: colors.primaryForeground }]}>RETRY</Text>
            </Pressable>
          </View>
        ) : !query.data?.length ? (
          <View style={styles.state} testID="feedback-empty">
            <Ionicons name="chatbox-ellipses-outline" size={32} color={colors.primary} />
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>No delivered feedback for {meal.toLowerCase()} on this date.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Refresh feedback" onPress={() => void query.refetch()} style={[styles.retry, { backgroundColor: colors.primary }]}>
              <Text style={[styles.retryText, { color: colors.primaryForeground }]}>REFRESH</Text>
            </Pressable>
          </View>
        ) : (
          <View testID="feedback-results" style={styles.results}>
            <View style={styles.resultsHeader}>
              <Text style={[styles.count, { color: colors.mutedForeground }]}>{query.data.length} {query.data.length === 1 ? 'RESPONSE' : 'RESPONSES'}{query.isFetching ? ' · UPDATING' : ''}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Refresh feedback" onPress={() => void query.refetch()}>
                <Ionicons name="refresh" size={21} color={colors.primary} />
              </Pressable>
            </View>
            {query.data.map((entry, index) => (
              <View key={`${entry.createdAt}-${index}`} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <Text accessibilityLabel={`${entry.rating} out of 5 stars`} style={[styles.rating, { color: colors.primary }]}>{'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}</Text>
                  <Text style={[styles.time, { color: colors.mutedForeground }]}>{new Date(entry.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
                </View>
                <Text style={[styles.items, { color: colors.foreground }]}>{entry.items.join(', ')}</Text>
                {entry.tags.length > 0 && <View style={styles.tags}>{entry.tags.map((tag, tagIndex) => (
                  <View key={`${tag}-${tagIndex}`} style={[styles.tag, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.tagText, { color: colors.secondaryForeground }]}>{tag}</Text>
                  </View>
                ))}</View>}
                {!!entry.comment && <Text style={[styles.comment, { color: colors.foreground }]}>{entry.comment}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 22, gap: 14 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, alignSelf: 'flex-start' },
  backText: { fontFamily: BOLD, fontSize: 12 },
  eyebrow: { fontFamily: BOLD, fontSize: 10, letterSpacing: 1, marginTop: 12 },
  title: { fontFamily: BOLD, fontSize: 28, lineHeight: 34 },
  caption: { fontSize: 14, lineHeight: 21, marginBottom: 12 },
  dateBar: { borderWidth: 1.5, borderRadius: 17, minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateButton: { minWidth: 48, minHeight: 60, justifyContent: 'center', alignItems: 'center' },
  dateLabel: { alignItems: 'center', flex: 1 },
  dateHeading: { fontFamily: BOLD, fontSize: 9, letterSpacing: 1 },
  dateText: { fontSize: 15, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  meals: { flexDirection: 'row', gap: 6, marginTop: 6 },
  mealButton: { flex: 1, borderWidth: 1.5, borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  mealText: { fontFamily: BOLD, fontSize: 10 },
  jumpButton: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 48, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 13 },
  jumpText: { flex: 1, fontFamily: BOLD, fontSize: 10, lineHeight: 15 },
  dateChoices: { borderWidth: 1.5, borderRadius: 12, overflow: 'hidden' },
  dateMessage: { padding: 18, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  dateList: { maxHeight: 240 },
  dateChoice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  choiceDate: { fontSize: 14, fontWeight: '600' },
  choiceCount: { fontSize: 12 },
  state: { minHeight: 210, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  stateText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  retry: { minHeight: 42, paddingHorizontal: 25, borderRadius: 12, justifyContent: 'center' },
  retryText: { fontFamily: BOLD, fontSize: 12 },
  results: { gap: 12, marginTop: 10 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontFamily: BOLD, fontSize: 10, letterSpacing: 1 },
  card: { borderWidth: 1.5, borderRadius: 18, padding: 17, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rating: { fontSize: 22, letterSpacing: 2 },
  time: { fontSize: 12 },
  items: { fontFamily: BOLD, fontSize: 15 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { fontSize: 12 },
  comment: { fontSize: 14, lineHeight: 21, marginTop: 2 },
});