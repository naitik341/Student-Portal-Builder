import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Text as SvgText } from 'react-native-svg';

export type MenuItem = {
  id: number;
  name: string;
  imageData: string | null;
  isVeg: boolean;
  meals: ('Breakfast' | 'Lunch' | 'Dinner')[];
  sortOrder: number;
  active: boolean;
};

export type ItemSelectProps = {
  items: MenuItem[];
  selectedIds: number[];
  headingLine1: string;
  headingLine2: string;
  onToggle: (id: number) => void;
  onProceed: () => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  reduceMotion: boolean;
};

export type ItemCardProps = {
  item: MenuItem;
  selected: boolean;
  onPress: () => void;
  editable?: boolean;
  reduceMotion?: boolean;
};

const C = {
  cream: '#F1ECEC',
  orange: '#F06A14',
  orangePressed: '#D9570A',
  ink: '#000000',
  white: '#FCFCFC',
  pureWhite: '#FFFFFF',
  veg: '#118A1A',
  nonVeg: '#D9151B',
  subtle: '#B9ACAA',
};
const BOLD = 'ArchivoBlack_400Regular';
const DISPLAY = 'Modak_400Regular';

function haptic() {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(8);
  } else {
    void Haptics.selectionAsync().catch(() => undefined);
  }
}

function nameEmoji(name: string) {
  const value = name.toLowerCase();
  if (value.includes('veg combo') || value.includes('burger')) return '🍔';
  if (value.includes('chole') || value.includes('curry')) return '🍛';
  if (value.includes('fried rice') || value.includes('rice')) return '🍚';
  if (value.includes('roll') || value.includes('wrap')) return '🌯';
  if (value.includes('egg')) return '🍳';
  if (value.includes('bread') || value.includes('toast')) return '🥪';
  return '🍽️';
}

/** The same preview card can be used by the student picker and the manager menu. */
export function ItemCard({ item, selected, onPress, editable = false, reduceMotion = false }: ItemCardProps) {
  const [width, setWidth] = useState(160);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  const motionOff = reduceMotion || systemReduceMotion;
  const press = useRef(new Animated.Value(1)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const chosen = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const emoji = nameEmoji(item.name);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setSystemReduceMotion(value); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduceMotion);
    return () => { mounted = false; sub.remove(); };
  }, []);

  useEffect(() => {
    if (motionOff) {
      chosen.setValue(selected ? 1 : 0);
      wiggle.setValue(0);
      return;
    }
    Animated.spring(chosen, { toValue: selected ? 1 : 0, stiffness: 410, damping: 20, mass: 0.8, useNativeDriver: true }).start();
    if (selected) {
      Animated.sequence([
        Animated.timing(wiggle, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 1, duration: 115, useNativeDriver: true }),
        Animated.spring(wiggle, { toValue: 0, stiffness: 460, damping: 17, useNativeDriver: true }),
      ]).start();
    }
  }, [selected, motionOff, chosen, wiggle]);

  const release = () => {
    if (motionOff) return;
    Animated.spring(press, { toValue: 1, stiffness: 500, damping: 15, mass: 0.7, useNativeDriver: true }).start();
  };

  return (
    <Animated.View
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.cardShell,
        selected && styles.cardSelected,
        {
          height: Math.min(170, Math.max(145, width * 1.02)),
          transform: [
            { scale: press },
            { rotate: wiggle.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-1.5deg', '0deg', '1.5deg'] }) },
          ],
        },
      ]}
    >
      <Pressable
        testID={`item-card-${item.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.isVeg ? 'vegetarian' : 'non-vegetarian'}, ${selected ? 'selected' : 'not selected'}${editable ? ', edit item' : ''}`}
        accessibilityState={{ selected }}
        onPressIn={() => {
          if (!motionOff) Animated.timing(press, { toValue: 0.93, duration: 80, useNativeDriver: true }).start();
        }}
        onPressOut={release}
        onPress={() => { haptic(); onPress(); }}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.foodStage} pointerEvents="none">
          <Animated.View
            style={[
              styles.orangeSlab,
              { transform: [{ rotate: chosen.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '-8deg'] }) }] },
            ]}
          />
          {item.imageData ? (
            <Animated.View style={[styles.foodPicture, { transform: [{ scale: chosen.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }, { rotate: chosen.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '3deg'] }) }] }]}>
              <Image source={{ uri: item.imageData }} resizeMode="contain" style={styles.foodImage} accessibilityLabel={`Photo of ${item.name}`} />
            </Animated.View>
          ) : (
            <Animated.Text style={[styles.foodEmoji, { fontSize: Math.min(70, width * 0.42), transform: [{ scale: chosen.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }, { rotate: chosen.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '3deg'] }) }] }]}>{emoji}</Animated.Text>
          )}
        </View>
        <View style={styles.markRow}>
          <View
            style={[styles.vegMark, { borderColor: item.isVeg ? C.veg : C.nonVeg }]}
            accessibilityLabel={item.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
          >
            <View style={[styles.vegDot, { backgroundColor: item.isVeg ? C.veg : C.nonVeg }]} />
          </View>
        </View>
        <View style={styles.nameRow}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={styles.itemName}
          >
            {item.name.toUpperCase()}
          </Text>
        </View>
        {editable ? (
          <View style={styles.editBadge} pointerEvents="none">
            <Ionicons name="pencil" size={16} color={C.pureWhite} />
          </View>
        ) : (
          <Animated.View testID={`item-select-pill-${item.id}`} style={[styles.selectPill, selected && styles.selectedPill, { transform: [{ scale: chosen.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }] }]} pointerEvents="none">
            {selected && <Ionicons name="checkmark" size={15} color={C.pureWhite} style={styles.checkIcon} />}
            <Text style={[styles.selectText, selected && styles.selectedText]}>{selected ? 'SELECTED' : 'SELECT'}</Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function StaggeredCard({ item, selected, index, onPress, reduceMotion }: { item: MenuItem; selected: boolean; index: number; onPress: () => void; reduceMotion: boolean }) {
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) { enter.setValue(1); return; }
    const timer = setTimeout(() => {
      Animated.spring(enter, { toValue: 1, stiffness: 260, damping: 22, mass: 0.8, useNativeDriver: true }).start();
    }, 220 + Math.min(index, 12) * 65);
    return () => clearTimeout(timer);
  }, [index, reduceMotion, enter]);
  return (
    <Animated.View style={[styles.gridCell, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }] }]}>
      <ItemCard item={item} selected={selected} onPress={onPress} reduceMotion={reduceMotion} />
    </Animated.View>
  );
}

function OutlineWord({ text, size, width }: { text: string; size: number; width: number }) {
  const x = width / 2;
  const y = size * 1.02;
  const fontSize = size * Math.min(1, 6 / Math.max(text.length, 6));
  const common = { x, y, fontSize, fontFamily: DISPLAY, textAnchor: 'middle' as const };
  return (
    <View style={styles.orderFrame} accessible accessibilityLabel={text}>
      <Svg width={width} height={size * 1.25} viewBox={`0 0 ${width} ${size * 1.25}`} accessibilityElementsHidden>
        <SvgText {...common} fill={C.ink} stroke={C.ink} strokeWidth={7} strokeLinejoin="round">{text}</SvgText>
        <SvgText {...common} fill={C.orange}>{text}</SvgText>
      </Svg>
    </View>
  );
}

function webClick(muted: boolean) {
  if (muted || Platform.OS !== 'web') return;
  try {
    const AudioClass = (globalThis as unknown as { AudioContext?: new () => AudioContext }).AudioContext;
    if (!AudioClass) return;
    const context = new AudioClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(420, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(230, context.currentTime + 0.045);
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.055);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.06);
    oscillator.onended = () => { void context.close(); };
  } catch {
    // Browsers may block audio before a user gesture.
  }
}

export default function ItemSelect({
  items, selectedIds, headingLine1, headingLine2, onToggle, onProceed, onBack,
  loading, error, onRetry, reduceMotion,
}: ItemSelectProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, 430);
  const [muted, setMuted] = useState(true);
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleEnter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const orderEnter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const proceedShake = useRef(new Animated.Value(0)).current;
  const proceedPress = useRef(new Animated.Value(1)).current;
  const gridPulse = useRef(new Animated.Value(1)).current;
  const [leaving, setLeaving] = useState(false);
  const exit = useRef(new Animated.Value(0)).current;
  const sorted = useMemo(() => [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id), [items]);

  useEffect(() => {
    if (reduceMotion) { titleEnter.setValue(1); orderEnter.setValue(1); return; }
    Animated.sequence([
      Animated.timing(titleEnter, { toValue: 1, duration: 330, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(orderEnter, { toValue: 1, stiffness: 360, damping: 15, mass: 0.9, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, titleEnter, orderEnter]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const click = () => { haptic(); webClick(muted); };
  const tryProceed = () => {
    click();
    if (selectedIds.length === 0) {
      setToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(false), 2300);
      if (!reduceMotion) {
        Animated.sequence([
          Animated.timing(gridPulse, { toValue: 1.025, duration: 110, useNativeDriver: true }),
          Animated.spring(gridPulse, { toValue: 1, stiffness: 390, damping: 18, useNativeDriver: true }),
        ]).start();
        Animated.sequence([
          Animated.timing(proceedShake, { toValue: -1, duration: 55, useNativeDriver: true }),
          Animated.timing(proceedShake, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(proceedShake, { toValue: -0.5, duration: 75, useNativeDriver: true }),
          Animated.timing(proceedShake, { toValue: 0, duration: 70, useNativeDriver: true }),
        ]).start();
      }
      return;
    }
    if (leaving) return;
    setLeaving(true);
    if (reduceMotion) { onProceed(); return; }
    Animated.timing(exit, { toValue: 1, duration: 215, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      onProceed();
      exit.setValue(0);
      setLeaving(false);
    });
  };

  const safeTop = Platform.OS === 'web' ? 29 : insets.top + 18;
  const safeBottom = Platform.OS === 'web' ? 22 : Math.max(insets.bottom, 10) + 9;
  const titleSize = Math.min(36, width * 0.096);
  const orderSize = Math.min(65, width * 0.173);

  return (
    <View style={styles.outer} testID="item-select-screen">
      <Animated.View style={[styles.page, { width, opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] }), transform: [{ translateX: exit.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) }] }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: safeTop, paddingBottom: 105 + safeBottom }]}
          testID="item-select-scroll"
        >
          <View style={styles.topbar}>
            <Pressable
              testID="item-select-back"
              accessibilityRole="button"
              accessibilityLabel="Back to meal selection"
              onPress={() => { click(); onBack(); }}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            >
              <Ionicons name="chevron-back" size={24} color={C.pureWhite} style={{ marginLeft: -2 }} />
            </Pressable>
            {Platform.OS === 'web' && (
              <Pressable
                testID="item-select-mute"
                accessibilityRole="button"
                accessibilityLabel={muted ? 'Unmute click sounds' : 'Mute click sounds'}
                onPress={() => setMuted(value => !value)}
                style={styles.muteButton}
              >
                <Ionicons name={muted ? 'volume-mute-outline' : 'volume-low-outline'} size={21} color={C.ink} />
              </Pressable>
            )}
          </View>

          <View style={styles.heading}>
            <Animated.Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.headingLine, { fontSize: titleSize, lineHeight: titleSize * 1.23, opacity: titleEnter, transform: [{ translateY: titleEnter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}
            >
              {headingLine1.toUpperCase()}
            </Animated.Text>
            <Animated.View style={{ opacity: orderEnter, transform: [{ translateY: orderEnter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: orderEnter.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) }, { rotate: orderEnter.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '0deg'] }) }] }}>
               <OutlineWord text={headingLine2.toUpperCase()} size={orderSize} width={width - 26} />
            </Animated.View>
          </View>

          {loading ? (
            <View style={styles.grid} testID="item-select-loading">
              {[0, 1, 2, 3].map(index => (
                <View key={index} style={[styles.gridCell, styles.skeletonCard]}>
                  <View style={styles.skeletonPicture} />
                  <View style={styles.skeletonName} />
                  <View style={styles.skeletonPill} />
                </View>
              ))}
            </View>
          ) : error ? (
            <View style={styles.messagePanel} testID="item-select-error">
              <Text style={styles.messageTitle}>COULDN'T LOAD THE MENU.</Text>
              <Text style={styles.messageBody}>{error}</Text>
              <Pressable testID="item-select-retry" accessibilityRole="button" onPress={() => { click(); onRetry(); }} style={({ pressed }) => [styles.messageAction, pressed && { backgroundColor: C.orangePressed }]}>
                <Text style={styles.messageActionText}>TRY AGAIN</Text>
              </Pressable>
            </View>
          ) : sorted.length === 0 ? (
            <View style={styles.messagePanel} testID="item-select-empty">
              <View style={styles.emptyPlate}><Ionicons name="restaurant-outline" size={36} color={C.orange} /></View>
              <Text style={styles.messageTitle}>NOTHING ON THE MENU YET.</Text>
              <Text style={styles.messageBody}>Check back in a bit, or choose another meal.</Text>
              <Pressable testID="item-select-empty-back" accessibilityRole="button" onPress={() => { click(); onBack(); }} style={({ pressed }) => [styles.messageAction, pressed && { backgroundColor: C.orangePressed }]}>
                <Text style={styles.messageActionText}>GO BACK</Text>
              </Pressable>
            </View>
          ) : (
            <Animated.View style={[styles.grid, { transform: [{ scale: gridPulse }] }]} testID="item-select-grid">
              {sorted.map((item, index) => (
                <StaggeredCard
                  key={item.id}
                  item={item}
                  index={index}
                  selected={selectedIds.includes(item.id)}
                  onPress={() => { webClick(muted); onToggle(item.id); }}
                  reduceMotion={reduceMotion}
                />
              ))}
            </Animated.View>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: safeBottom }]}>
          {toast && <View style={styles.toast} testID="item-select-toast" accessibilityRole="alert"><Text style={styles.toastText}>Pick at least one item</Text></View>}
          <Animated.View style={{ transform: [{ scale: proceedPress }, { translateX: proceedShake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-9, 0, 9] }) }] }}>
            <Pressable
              testID="item-select-proceed"
              accessibilityRole="button"
              accessibilityLabel={`Proceed with ${selectedIds.length} selected ${selectedIds.length === 1 ? 'item' : 'items'}`}
              onPressIn={() => { if (!reduceMotion) Animated.timing(proceedPress, { toValue: 0.93, duration: 85, useNativeDriver: true }).start(); }}
              onPressOut={() => { if (!reduceMotion) Animated.spring(proceedPress, { toValue: 1, stiffness: 500, damping: 15, useNativeDriver: true }).start(); }}
              onPress={tryProceed}
              disabled={loading || !!error || sorted.length === 0 || leaving}
              style={({ pressed }) => [styles.proceedButton, pressed && styles.proceedPressed, (loading || !!error || sorted.length === 0) && styles.proceedDisabled]}
            >
              <Text style={[styles.proceedText, { fontSize: selectedIds.length ? 29 : 36 }]} numberOfLines={1}>
                PROCEED{selectedIds.length ? ` (${selectedIds.length})` : ''}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: C.cream, alignItems: 'center' },
  page: { flex: 1, backgroundColor: C.cream, overflow: 'hidden' },
  scrollContent: { paddingHorizontal: 13 },
  topbar: { height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  backButtonPressed: { transform: [{ scale: 0.93 }] },
  muteButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
   heading: { marginTop: 30, marginBottom: 10 },
   headingLine: { fontFamily: BOLD, fontWeight: 'normal', color: C.ink, letterSpacing: -1.15, includeFontPadding: false },
   orderFrame: { width: '100%', overflow: 'visible', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 17, rowGap: 14 },
  gridCell: { width: '47.55%', marginBottom: 3 },
   cardShell: { width: '100%', height: 170, overflow: 'visible', borderRadius: 18 },
  cardSelected: { backgroundColor: C.orange, padding: 2 },
   card: { flex: 1, overflow: 'visible', backgroundColor: C.white, borderWidth: 3, borderColor: C.ink, borderRadius: 18, flexDirection: 'column' },
  cardPressed: { backgroundColor: '#FFF5ED' },
   foodStage: { height: '55%', width: '100%', alignItems: 'center', justifyContent: 'center' },
   orangeSlab: { position: 'absolute', width: '85%', height: '70%', backgroundColor: C.orange },
   foodPicture: { width: '94%', height: '105%', alignItems: 'center', justifyContent: 'center' },
  foodImage: { width: '100%', height: '100%' },
   foodEmoji: { textAlign: 'center', includeFontPadding: false },
   markRow: { height: 21, width: '100%', paddingRight: 10, alignItems: 'flex-end', justifyContent: 'center' },
   vegMark: { width: 18, height: 18, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
   nameRow: { width: '100%', paddingRight: 10, paddingLeft: 4, height: 32, justifyContent: 'center', alignItems: 'flex-end' },
   itemName: { maxWidth: '100%', textAlign: 'right', color: C.ink, fontFamily: BOLD, fontWeight: 'normal', fontSize: 24, letterSpacing: -0.8, includeFontPadding: false },
   selectPill: { position: 'absolute', right: -8, bottom: -3, minWidth: 76, height: 34, paddingHorizontal: 11, borderRadius: 18, backgroundColor: C.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  selectedPill: { backgroundColor: C.ink },
   selectText: { color: C.pureWhite, fontFamily: BOLD, fontWeight: 'normal', fontSize: 17, includeFontPadding: false },
  selectedText: { fontSize: 12 },
  checkIcon: { marginRight: 2 },
  editBadge: { position: 'absolute', right: -8, bottom: -6, width: 36, height: 36, borderRadius: 18, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 13, paddingTop: 12, backgroundColor: C.cream },
  proceedButton: { minHeight: 61, borderRadius: 19, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  proceedPressed: { backgroundColor: C.orangePressed },
  proceedDisabled: { opacity: 0.48 },
   proceedText: { color: C.pureWhite, fontFamily: BOLD, fontWeight: 'normal', letterSpacing: -1, includeFontPadding: false },
  toast: { alignSelf: 'center', backgroundColor: C.ink, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, marginBottom: 11 },
  toastText: { color: C.pureWhite, fontFamily: BOLD, fontSize: 13 },
  skeletonCard: { height: 168, borderRadius: 18, borderWidth: 3, borderColor: C.subtle, backgroundColor: C.white, padding: 12 },
  skeletonPicture: { height: 83, width: '100%', backgroundColor: '#E8D9D1', transform: [{ rotate: '-8deg' }] },
  skeletonName: { height: 17, width: '80%', backgroundColor: '#E8D9D1', marginTop: 15, alignSelf: 'flex-end' },
  skeletonPill: { height: 28, width: 72, borderRadius: 20, backgroundColor: '#E8D9D1', position: 'absolute', right: -7, bottom: -5 },
  messagePanel: { minHeight: 260, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 25 },
  emptyPlate: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: C.ink, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  messageTitle: { color: C.ink, fontFamily: BOLD, fontWeight: '900', fontSize: 21, lineHeight: 26, textAlign: 'center' },
  messageBody: { color: C.ink, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 9 },
  messageAction: { backgroundColor: C.orange, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 22, marginTop: 21 },
  messageActionText: { color: C.pureWhite, fontFamily: BOLD, fontWeight: '900', fontSize: 15 },
});