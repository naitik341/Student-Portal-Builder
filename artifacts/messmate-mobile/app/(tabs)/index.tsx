import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type Meal = 'Breakfast' | 'Lunch' | 'Dinner';
type Screen = 'meal' | 'rating' | 'tags' | 'thanks' | 'already';
type Palette = ReturnType<typeof useColors>;

interface Submission {
  meal: Meal;
  rating: number;
  tags: string[];
  comment: string;
  createdAt: string;
}

const SUBMISSIONS_KEY = '@messmate/submissions-v1';
const OFFLINE_QUEUE_KEY = '@messmate/offline-queue-v1';
const negativeTags = [
  'Too salty',
  'Too oily',
  'Too spicy',
  'Bland',
  'Cold food',
  'Undercooked',
  'Not enough quantity',
  'Stale',
  'Dirty plates',
  'Long queue',
  'Hair/insect found',
  'Late service',
];
const positiveTags = [
  'Tasty',
  'Fresh',
  'Hot & on time',
  'Good quantity',
  'Clean',
  'Great variety',
  'Healthy',
];
const ratingLabels = ['Terrible', 'Bad', 'Okay', 'Good', 'Loved it'];
const faceTones = (colors: Palette) => [
  colors.ratingOne,
  colors.ratingTwo,
  colors.ratingThree,
  colors.ratingFour,
  colors.ratingFive,
];

const mealOptions: { meal: Meal; icon: string; color: keyof Palette }[] = [
  { meal: 'Breakfast', icon: '🍳', color: 'breakfast' },
  { meal: 'Lunch', icon: '🍛', color: 'lunch' },
  { meal: 'Dinner', icon: '🌙', color: 'dinner' },
];

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function suggestedMeal(): Meal {
  const hour = new Date().getHours();
  if (hour < 11) return 'Breakfast';
  if (hour < 16) return 'Lunch';
  return 'Dinner';
}

function vibrate() {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(10);
    }
    return;
  }
  void Haptics.selectionAsync().catch(() => undefined);
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    appShell: {
      flex: 1,
      backgroundColor: colors.background,
    },
    frame: {
      flex: 1,
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
      paddingHorizontal: 22,
    },
    topBar: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    brandMark: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandName: {
      color: colors.foreground,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 18,
      letterSpacing: -0.4,
    },
    managerLink: {
      minHeight: 44,
      justifyContent: 'center',
      paddingLeft: 10,
    },
    managerText: {
      color: colors.mutedForeground,
      fontFamily: 'Poppins_500Medium',
      fontSize: 11,
    },
    progressTrack: {
      height: 4,
      marginTop: 10,
      borderRadius: 9,
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    progressFill: {
      height: 4,
      borderRadius: 9,
      backgroundColor: colors.primary,
    },
    screenMotion: {
      flex: 1,
    },
    stepTop: {
      minHeight: 48,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    backButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -9,
    },
    mainBody: {
      flex: 1,
      paddingTop: 15,
    },
    centeredBody: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 32,
    },
    heading: {
      color: colors.foreground,
      fontFamily: 'Poppins_700Bold',
      fontSize: 29,
      lineHeight: 38,
      letterSpacing: -0.9,
    },
    subheading: {
      color: colors.mutedForeground,
      fontFamily: 'Poppins_400Regular',
      fontSize: 13,
      lineHeight: 21,
      marginTop: 5,
    },
    mealList: {
      gap: 13,
      marginTop: 27,
    },
    mealCardWrap: {
      borderRadius: 24,
    },
    mealCard: {
      minHeight: 96,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      overflow: 'hidden',
      shadowColor: colors.foreground,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 2,
    },
    mealIconBox: {
      width: 58,
      height: 58,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    mealEmoji: {
      fontSize: 31,
      lineHeight: 38,
    },
    mealCopy: {
      flex: 1,
      gap: 3,
    },
    mealTitle: {
      color: colors.foreground,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 17,
    },
    suggestedPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 20,
      backgroundColor: colors.accent,
    },
    suggestedText: {
      color: colors.accentForeground,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 9,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    pulseGlow: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      borderRadius: 24,
    },
    ratingTitle: {
      textAlign: 'center',
      width: '100%',
      marginBottom: 5,
    },
    ratingHint: {
      textAlign: 'center',
      marginBottom: 31,
    },
    faceRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginHorizontal: 0,
    },
    faceOption: {
      flex: 1,
      minHeight: 78,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 4,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    faceArt: {
      width: 50,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    faceLabel: {
      height: 17,
      marginTop: 1,
      color: colors.foreground,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 9,
      textAlign: 'center',
    },
    ratingFootnote: {
      color: colors.mutedForeground,
      fontFamily: 'Poppins_400Regular',
      fontSize: 12,
      marginTop: 27,
    },
    tagScroll: {
      flex: 1,
      marginHorizontal: -2,
    },
    tagScrollContent: {
      paddingHorizontal: 2,
      paddingBottom: 16,
    },
    groupTitle: {
      color: colors.mutedForeground,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 10,
      letterSpacing: 1.1,
      marginTop: 14,
      marginBottom: 9,
      textTransform: 'uppercase',
    },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 8,
    },
    tagChip: {
      width: '100%',
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    tagChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.accent,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.14,
      shadowRadius: 7,
      elevation: 2,
    },
    tagText: {
      flexShrink: 1,
      color: colors.foreground,
      fontFamily: 'Poppins_500Medium',
      fontSize: 11,
      lineHeight: 15,
      textAlign: 'center',
    },
    commentToggle: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      marginTop: 10,
      paddingHorizontal: 2,
    },
    commentToggleText: {
      color: colors.accentForeground,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 12,
    },
    commentPanel: {
      marginTop: 2,
      marginBottom: 10,
    },
    commentInput: {
      minHeight: 94,
      maxHeight: 118,
      borderWidth: 1,
      borderColor: colors.input,
      borderRadius: 18,
      padding: 13,
      color: colors.foreground,
      backgroundColor: colors.card,
      fontFamily: 'Poppins_400Regular',
      fontSize: 12,
      lineHeight: 18,
      textAlignVertical: 'top',
    },
    characterCount: {
      color: colors.mutedForeground,
      fontFamily: 'Poppins_400Regular',
      fontSize: 10,
      textAlign: 'right',
      marginTop: 5,
    },
    stickyFooter: {
      paddingTop: 12,
      paddingBottom: 2,
      backgroundColor: colors.background,
    },
    selectedCount: {
      color: colors.mutedForeground,
      fontFamily: 'Poppins_500Medium',
      fontSize: 11,
      marginBottom: 9,
    },
    submitButton: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      borderRadius: 19,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.2,
      shadowRadius: 9,
      elevation: 3,
    },
    submitButtonPressed: {
      transform: [{ scale: 0.97 }],
    },
    submitText: {
      color: colors.primaryForeground,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 15,
    },
    privacyNote: {
      color: colors.mutedForeground,
      fontFamily: 'Poppins_400Regular',
      fontSize: 10,
      textAlign: 'center',
      marginTop: 8,
    },
    saveError: {
      color: colors.destructive,
      fontFamily: 'Poppins_500Medium',
      fontSize: 11,
      lineHeight: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    successCircle: {
      width: 116,
      height: 116,
      borderRadius: 58,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.success}20`,
      marginBottom: 25,
    },
    successTitle: {
      color: colors.foreground,
      fontFamily: 'Poppins_700Bold',
      fontSize: 27,
      textAlign: 'center',
      letterSpacing: -0.7,
    },
    successCopy: {
      maxWidth: 300,
      color: colors.mutedForeground,
      fontFamily: 'Poppins_400Regular',
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center',
      marginTop: 10,
    },
    studentStat: {
      color: colors.foreground,
      fontFamily: 'Poppins_500Medium',
      fontSize: 12,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 22,
    },
    offlineNote: {
      color: colors.accentForeground,
      fontFamily: 'Poppins_500Medium',
      fontSize: 11,
      lineHeight: 17,
      textAlign: 'center',
      marginTop: 10,
      maxWidth: 270,
    },
    successActions: {
      width: '100%',
      alignItems: 'center',
      marginTop: 30,
    },
    secondaryButton: {
      minHeight: 56,
      minWidth: 210,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 18,
      backgroundColor: colors.primary,
    },
    secondaryButtonText: {
      color: colors.primaryForeground,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 14,
    },
    alreadyIcon: {
      width: 88,
      height: 88,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 44,
      backgroundColor: colors.accent,
      marginBottom: 23,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 13,
    },
    loadingText: {
      color: colors.mutedForeground,
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
    },
    errorText: {
      color: colors.destructive,
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      marginHorizontal: 20,
    },
    confettiLayer: {
      position: 'absolute',
      top: 58,
      alignSelf: 'center',
      width: 1,
      height: 1,
      zIndex: 2,
    },
    confettiPiece: {
      position: 'absolute',
      left: 0,
      top: 0,
    },
  });
}

type AppStyles = ReturnType<typeof makeStyles>;

function FaceDrawing({ rating, tone, ink }: { rating: number; tone: string; ink: string }) {
  const mouthPaths = [
    'M21 47 Q32 32 43 47',
    'M22 44 Q32 37 42 44',
    'M23 41 Q32 43 41 41',
    'M21 38 Q32 51 43 38',
    'M18 35 Q32 54 46 35',
  ];
  return (
    <Svg width={48} height={48} viewBox="0 0 64 64" accessibilityLabel={`${rating} out of 5 face`}>
      <Circle cx="32" cy="32" r="29" fill={tone} />
      <Circle cx="23" cy="25" r="2.7" fill={ink} />
      <Circle cx="41" cy="25" r="2.7" fill={ink} />
      <Path
        d={mouthPaths[rating - 1]}
        fill="none"
        stroke={ink}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function FaceOption({
  rating,
  selected,
  tone,
  ink,
  styles,
  onPress,
}: {
  rating: number;
  selected: boolean;
  tone: string;
  ink: string;
  styles: AppStyles;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const labelOpacity = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: selected ? 1.09 : 1,
        speed: 18,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: selected ? 1 : 0,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start();
  }, [labelOpacity, scale, selected]);

  return (
    <Pressable
      testID={`rating-${rating}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${rating} out of 5, ${ratingLabels[rating - 1]}`}
      onPress={onPress}
      style={[
        styles.faceOption,
        selected ? { borderColor: tone, backgroundColor: `${tone}18` } : null,
      ]}
    >
      <Animated.View style={[styles.faceArt, { transform: [{ scale }] }]}>
        <FaceDrawing rating={rating} tone={tone} ink={ink} />
      </Animated.View>
      <Animated.Text style={[styles.faceLabel, { opacity: labelOpacity }]}>
        {selected ? ratingLabels[rating - 1] : ''}
      </Animated.Text>
    </Pressable>
  );
}

function FaceRating({
  value,
  colors,
  styles,
  onChange,
}: {
  value: number | null;
  colors: Palette;
  styles: AppStyles;
  onChange: (rating: number) => void;
}) {
  const tones = faceTones(colors);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Meal rating"
      style={styles.faceRow}
    >
      {[1, 2, 3, 4, 5].map((rating) => (
        <FaceOption
          key={rating}
          rating={rating}
          tone={tones[rating - 1]}
          ink={colors.foreground}
          selected={value === rating}
          styles={styles}
          onPress={() => onChange(rating)}
        />
      ))}
    </View>
  );
}

function MealCard({
  meal,
  icon,
  tint,
  isSuggested,
  styles,
  reduceMotion,
  onPress,
}: {
  meal: Meal;
  icon: string;
  tint: string;
  isSuggested: boolean;
  styles: AppStyles;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    if (!isSuggested || reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.2,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.05,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isSuggested, pulse, reduceMotion]);

  const handlePress = () => {
    vibrate();
    if (reduceMotion) {
      onPress();
      return;
    }
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.035,
        speed: 25,
        bounciness: 7,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={[styles.mealCardWrap, { transform: [{ scale }] }]}>
      {isSuggested ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.pulseGlow, { backgroundColor: tint, opacity: pulse }]}
        />
      ) : null}
      <Pressable
        testID={`meal-${meal.toLowerCase()}`}
        accessibilityRole="button"
        accessibilityLabel={`${meal}${isSuggested ? ', suggested' : ''}`}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.mealCard,
          pressed && reduceMotion ? { transform: [{ scale: 0.98 }] } : null,
        ]}
      >
        <View style={[styles.mealIconBox, { backgroundColor: `${tint}1C` }]}>
          <Text style={styles.mealEmoji}>{icon}</Text>
        </View>
        <View style={styles.mealCopy}>
          <Text style={styles.mealTitle}>{meal}</Text>
          {isSuggested ? (
            <View style={styles.suggestedPill}>
              <Text style={styles.suggestedText}>Suggested</Text>
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={tint} />
      </Pressable>
    </Animated.View>
  );
}

interface TagChipProps {
  label: string;
  selected: boolean;
  index: number;
  styles: AppStyles;
  colors: Palette;
  reduceMotion: boolean;
  onPress: () => void;
}

function TagChip({
  label,
  selected,
  index,
  styles,
  colors,
  reduceMotion,
  onPress,
}: TagChipProps) {
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 8)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 230,
        delay: index * 22,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 230,
        delay: index * 22,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, reduceMotion, translateY]);

  const handlePress = () => {
    vibrate();
    if (!reduceMotion) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: 80, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, speed: 22, bounciness: 8, useNativeDriver: true }),
      ]).start();
    }
    onPress();
  };

  return (
    <Animated.View
      style={{
        width: '48.5%',
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      <Pressable
        testID={`tag-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        onPress={handlePress}
        style={[styles.tagChip, selected ? styles.tagChipSelected : null]}
      >
        {selected ? <Ionicons name="checkmark-circle" size={16} color={colors.accentForeground} /> : null}
        <Text style={styles.tagText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const confettiDefinition = [
  { x: -76, y: -56, color: 'primary', size: 7, rotate: '42deg' },
  { x: -52, y: -84, color: 'success', size: 6, rotate: '94deg' },
  { x: -23, y: -64, color: 'ratingThree', size: 8, rotate: '12deg' },
  { x: 16, y: -83, color: 'dinner', size: 6, rotate: '71deg' },
  { x: 50, y: -61, color: 'destructive', size: 7, rotate: '35deg' },
  { x: 77, y: -34, color: 'breakfast', size: 6, rotate: '88deg' },
  { x: -91, y: -20, color: 'dinner', size: 5, rotate: '16deg' },
  { x: 90, y: -4, color: 'success', size: 7, rotate: '72deg' },
  { x: -71, y: 8, color: 'breakfast', size: 7, rotate: '22deg' },
  { x: 67, y: 19, color: 'primary', size: 6, rotate: '107deg' },
  { x: -43, y: 28, color: 'destructive', size: 6, rotate: '68deg' },
  { x: 36, y: 34, color: 'ratingThree', size: 7, rotate: '34deg' },
] as const;

function ConfettiBurst({
  active,
  colors,
  styles,
  reduceMotion,
}: {
  active: boolean;
  colors: Palette;
  styles: AppStyles;
  reduceMotion: boolean;
}) {
  const progress = useMemo(
    () => confettiDefinition.map(() => new Animated.Value(0)),
    [],
  );
  useEffect(() => {
    if (!active || reduceMotion) {
      progress.forEach((item) => item.setValue(0));
      return;
    }
    const animations = progress.map((item, index) =>
      Animated.sequence([
        Animated.delay(index * 16),
        Animated.timing(item, {
          toValue: 1,
          duration: 720,
          useNativeDriver: true,
        }),
      ]),
    );
    Animated.parallel(animations).start();
    return () => animations.forEach((animation) => animation.stop());
  }, [active, progress, reduceMotion]);

  if (!active || reduceMotion) return null;
  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {confettiDefinition.map((piece, index) => {
        const moveX = progress[index].interpolate({ inputRange: [0, 1], outputRange: [0, piece.x] });
        const moveY = progress[index].interpolate({ inputRange: [0, 1], outputRange: [0, piece.y] });
        const opacity = progress[index].interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 1, 0] });
        const rotate = progress[index].interpolate({ inputRange: [0, 1], outputRange: ['0deg', piece.rotate] });
        return (
          <Animated.View
            key={`confetti-${index}`}
            style={[
              styles.confettiPiece,
              {
                width: piece.size,
                height: piece.size * 1.45,
                borderRadius: 2,
                backgroundColor: colors[piece.color],
                opacity,
                transform: [{ translateX: moveX }, { translateY: moveY }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function MessMateScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const suggested = useMemo(suggestedMeal, []);
  const [screen, setScreen] = useState<Screen>('meal');
  const [meal, setMeal] = useState<Meal | null>(null);
  const [alreadyMeal, setAlreadyMeal] = useState<Meal | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<Submission[]>([]);
  const [online, setOnline] = useState(true);
  const [savedOffline, setSavedOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(new Animated.Value(1 / 3)).current;
  const previousScreen = useRef<Screen>('meal');
  const direction = useRef(1);
  const countValue = useRef(new Animated.Value(0)).current;
  const checkDraw = useRef(new Animated.Value(48)).current;
  const selectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todayKey = localDateKey(new Date());

  const readLocalData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const values = await AsyncStorage.multiGet([SUBMISSIONS_KEY, OFFLINE_QUEUE_KEY]);
      const storedSubmissions = values[0][1] ? JSON.parse(values[0][1]!) : [];
      const storedQueue = values[1][1] ? JSON.parse(values[1][1]!) : [];
      if (!Array.isArray(storedSubmissions) || !Array.isArray(storedQueue)) {
        throw new Error('Saved feedback data could not be read.');
      }
      setSubmissions(storedSubmissions as Submission[]);
      setOfflineQueue(storedQueue as Submission[]);
    } catch {
      setLoadError('We couldn’t load saved feedback on this device. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void readLocalData();
  }, [readLocalData]);

  useEffect(() => {
    let active = true;
    void Network.getNetworkStateAsync()
      .then((state) => {
        if (active) {
          setOnline(state.isConnected !== false && state.isInternetReachable !== false);
        }
      })
      .catch(() => {
        if (active) setOnline(true);
      });
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduceMotion(query.matches);
      const listener = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
      query.addEventListener?.('change', listener);
      return () => query.removeEventListener?.('change', listener);
    }
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (previousScreen.current === screen) return;
    previousScreen.current = screen;
    const stepValue = screen === 'meal' ? 1 / 3 : screen === 'rating' ? 2 / 3 : screen === 'tags' ? 1 : 1;
    if (!reduceMotion && screen !== 'thanks' && screen !== 'already') {
      progressValue.setValue(stepValue < 1 ? Math.max(0, stepValue - 1 / 3) : 2 / 3);
      Animated.timing(progressValue, {
        toValue: stepValue,
        duration: 260,
        useNativeDriver: false,
      }).start();
      slide.setValue(direction.current * 22);
      Animated.spring(slide, {
        toValue: 0,
        speed: 18,
        bounciness: 4,
        useNativeDriver: true,
      }).start();
    } else {
      progressValue.setValue(stepValue);
      slide.setValue(0);
    }
  }, [progressValue, reduceMotion, screen, slide]);

  useEffect(() => {
    if (screen !== 'rating' || rating === null) return;
    const timeout = setTimeout(() => {
      direction.current = 1;
      setScreen('tags');
    }, 900);
    return () => clearTimeout(timeout);
  }, [rating, screen]);

  useEffect(() => {
    if (screen !== 'thanks') return;
    countValue.setValue(0);
    checkDraw.setValue(48);
    const listenerId = countValue.addListener(({ value }) => setStudentCount(Math.round(value)));
    if (reduceMotion) {
      countValue.setValue(143);
      setStudentCount(143);
      checkDraw.setValue(0);
    } else {
      Animated.parallel([
        Animated.timing(countValue, {
          toValue: 143,
          duration: 1050,
          useNativeDriver: false,
        }),
        Animated.timing(checkDraw, {
          toValue: 0,
          duration: 620,
          useNativeDriver: false,
        }),
      ]).start();
    }
    return () => countValue.removeListener(listenerId);
  }, [checkDraw, countValue, reduceMotion, screen]);

  const goTo = useCallback(
    (next: Screen, nextDirection = 1) => {
      direction.current = nextDirection;
      setScreen(next);
    },
    [],
  );

  const returnToMeals = useCallback(() => {
    setMeal(null);
    setRating(null);
    setTags([]);
    setComment('');
    setCommentOpen(false);
    setSaveError(null);
    goTo('meal', -1);
  }, [goTo]);

  const onMealSelect = (selectedMeal: Meal) => {
    setMeal(selectedMeal);
    const existing = submissions.find(
      (submission) =>
        submission.meal === selectedMeal &&
        localDateKey(new Date(submission.createdAt)) === todayKey,
    );
    if (selectionTimer.current) clearTimeout(selectionTimer.current);
    selectionTimer.current = setTimeout(() => {
      if (existing) {
        setAlreadyMeal(selectedMeal);
        goTo('already');
      } else {
        setRating(null);
        setTags([]);
        setComment('');
        setCommentOpen(false);
        goTo('rating');
      }
    }, 250);
  };

  const chooseRating = (nextRating: number) => {
    setRating(nextRating);
    setTags([]);
    setComment('');
    setCommentOpen(false);
    vibrate();
  };

  const toggleTag = (tag: string) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  const submit = async () => {
    if (!meal || rating === null || saving) return;
    setSaving(true);
    setSaveError(null);
    const submission: Submission = {
      meal,
      rating,
      tags,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
    };
    try {
      const duplicate = submissions.some(
        (item) => item.meal === meal && localDateKey(new Date(item.createdAt)) === todayKey,
      );
      if (duplicate) {
        setAlreadyMeal(meal);
        goTo('already');
        return;
      }
      const nextSubmissions = [...submissions, submission];
      const nextQueue = online ? offlineQueue : [...offlineQueue, submission];
      const storagePairs: [string, string][] = [[SUBMISSIONS_KEY, JSON.stringify(nextSubmissions)]];
      if (!online) storagePairs.push([OFFLINE_QUEUE_KEY, JSON.stringify(nextQueue)]);
      await AsyncStorage.multiSet(storagePairs);
      setSubmissions(nextSubmissions);
      if (!online) {
        setOfflineQueue(nextQueue);
        setSavedOffline(true);
      } else {
        setSavedOffline(false);
      }
      console.log('MessMate feedback submitted:', submission);
      goTo('thanks');
    } catch {
      setSaveError('We couldn’t save your feedback. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const showManagerInfo = () => {
    Alert.alert(
      'Manager sign in',
      'Manager tools are not part of this student app yet.',
    );
  };

  const onPressInStyle = ({ pressed }: { pressed: boolean }) =>
    pressed && !reduceMotion ? { opacity: 0.86 } : null;

  const isMainStep = screen === 'meal' || screen === 'rating' || screen === 'tags';
  const groups =
    rating !== null && rating <= 2
      ? [{ title: 'Let’s fix it', items: negativeTags }]
      : rating === 3
        ? [
            { title: 'Could be better', items: negativeTags },
            { title: 'What was great', items: positiveTags },
          ]
        : [{ title: 'What was great', items: positiveTags }];

  const safeTop = Platform.OS === 'web' ? 67 : insets.top;
  const safeBottom = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View
      style={[
        styles.appShell,
        { paddingTop: safeTop, paddingBottom: safeBottom },
      ]}
    >
      <StatusBar style="dark" backgroundColor={colors.background} />
      <View style={styles.frame}>
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Ionicons name="restaurant" size={17} color={colors.primaryForeground} />
            </View>
            <Text style={styles.brandName}>MessMate</Text>
          </View>
          <Pressable
            testID="manager-sign-in"
            accessibilityRole="link"
            onPress={showManagerInfo}
            style={({ pressed }) => [styles.managerLink, onPressInStyle({ pressed })]}
          >
            <Text style={styles.managerText}>Manager? Sign in</Text>
          </Pressable>
        </View>

        {isMainStep ? (
          <View
            accessibilityLabel={`Step ${screen === 'meal' ? 1 : screen === 'rating' ? 2 : 3} of 3`}
            style={styles.progressTrack}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        ) : null}

        <Animated.View
          key={screen}
          style={[
            styles.screenMotion,
            { transform: [{ translateX: slide }] },
          ]}
        >
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Getting your feedback space ready…</Text>
            </View>
          ) : loadError ? (
            <View style={styles.loadingWrap}>
              <Ionicons name="cloud-offline-outline" size={35} color={colors.destructive} />
              <Text style={styles.errorText}>{loadError}</Text>
              <Pressable
                testID="retry-load"
                onPress={() => void readLocalData()}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  onPressInStyle({ pressed }),
                ]}
              >
                <Text style={styles.secondaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : screen === 'meal' ? (
            <View style={styles.mainBody}>
              <Text style={styles.heading}>How was your meal?</Text>
              <Text style={styles.subheading}>
                A quick rating helps make the next meal better.
              </Text>
              <View style={styles.mealList}>
                {mealOptions.map((option) => (
                  <MealCard
                    key={option.meal}
                    meal={option.meal}
                    icon={option.icon}
                    tint={colors[option.color] as string}
                    isSuggested={suggested === option.meal}
                    styles={styles}
                    reduceMotion={reduceMotion}
                    onPress={() => onMealSelect(option.meal)}
                  />
                ))}
              </View>
              {!online ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 18 }}>
                  <Ionicons name="cloud-offline-outline" size={14} color={colors.mutedForeground} />
                  <Text style={styles.privacyNote}>Offline — feedback will be saved here</Text>
                </View>
              ) : null}
            </View>
          ) : screen === 'rating' ? (
            <View style={{ flex: 1 }}>
              <View style={styles.stepTop}>
                <Pressable
                  testID="back-to-meals"
                  accessibilityRole="button"
                  accessibilityLabel="Back to meal selection"
                  onPress={() => {
                    if (selectionTimer.current) clearTimeout(selectionTimer.current);
                    setMeal(null);
                    goTo('meal', -1);
                  }}
                  style={({ pressed }) => [styles.backButton, onPressInStyle({ pressed })]}
                >
                  <Ionicons name="arrow-back" size={23} color={colors.foreground} />
                </Pressable>
              </View>
              <View style={styles.centeredBody}>
                <Text style={[styles.heading, styles.ratingTitle]}>
                  How was {meal?.toLowerCase()} today?
                </Text>
                <Text style={[styles.subheading, styles.ratingHint]}>
                  Tap the face that feels right
                </Text>
                <FaceRating
                  value={rating}
                  colors={colors}
                  styles={styles}
                  onChange={chooseRating}
                />
                <Text style={styles.ratingFootnote}>
                  {rating === null ? 'Your feedback is anonymous' : 'Got it — moving on'}
                </Text>
              </View>
            </View>
          ) : screen === 'tags' ? (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior="padding"
              keyboardVerticalOffset={0}
            >
              <View style={styles.stepTop}>
                <Pressable
                  testID="back-to-rating"
                  accessibilityRole="button"
                  accessibilityLabel="Back to rating"
                  onPress={() => {
                    setRating(null);
                    setSaveError(null);
                    goTo('rating', -1);
                  }}
                  style={({ pressed }) => [styles.backButton, onPressInStyle({ pressed })]}
                >
                  <Ionicons name="arrow-back" size={23} color={colors.foreground} />
                </Pressable>
              </View>
              <Text style={styles.heading}>
                {rating !== null && rating <= 2
                  ? 'What went wrong?'
                  : rating === 3
                    ? 'Anything stand out?'
                    : 'What was great?'}
              </Text>
              <Text style={styles.subheading}>Pick any that fit. Every detail helps.</Text>
              <ScrollView
                testID="feedback-tags-scroll"
                style={styles.tagScroll}
                contentContainerStyle={styles.tagScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {groups.map((group, groupIndex) => (
                  <View key={group.title}>
                    {groups.length > 1 ? <Text style={styles.groupTitle}>{group.title}</Text> : null}
                    <View style={styles.chipGrid}>
                      {group.items.map((tag, index) => (
                        <TagChip
                          key={tag}
                          label={tag}
                          selected={tags.includes(tag)}
                          index={groupIndex * group.items.length + index}
                          styles={styles}
                          colors={colors}
                          reduceMotion={reduceMotion}
                          onPress={() => toggleTag(tag)}
                        />
                      ))}
                    </View>
                  </View>
                ))}
                <Pressable
                  testID="toggle-comment"
                  accessibilityRole="button"
                  accessibilityState={{ expanded: commentOpen }}
                  onPress={() => {
                    vibrate();
                    setCommentOpen((current) => !current);
                  }}
                  style={({ pressed }) => [
                    styles.commentToggle,
                    onPressInStyle({ pressed }),
                  ]}
                >
                  <Ionicons
                    name={commentOpen ? 'remove-circle-outline' : 'add-circle-outline'}
                    size={19}
                    color={colors.accentForeground}
                  />
                  <Text style={styles.commentToggleText}>
                    {commentOpen ? 'Hide comment' : '+ Add a comment (optional)'}
                  </Text>
                </Pressable>
                {commentOpen ? (
                  <View style={styles.commentPanel}>
                    <TextInput
                      testID="feedback-comment"
                      accessibilityLabel="Optional feedback comment"
                      value={comment}
                      onChangeText={(text) => setComment(text.slice(0, 200))}
                      placeholder="Anything else you’d like us to know?"
                      placeholderTextColor={colors.mutedForeground}
                      maxLength={200}
                      multiline
                      returnKeyType="default"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                      style={styles.commentInput}
                    />
                    <Text style={styles.characterCount}>{comment.length}/200</Text>
                  </View>
                ) : null}
              </ScrollView>
              <View style={styles.stickyFooter}>
                <Text style={styles.selectedCount}>
                  {tags.length} selected
                </Text>
                {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
                <Pressable
                  testID="submit-feedback"
                  accessibilityRole="button"
                  accessibilityLabel="Submit feedback"
                  accessibilityState={{ disabled: saving }}
                  disabled={saving}
                  onPress={() => void submit()}
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && !reduceMotion ? styles.submitButtonPressed : null,
                    saving ? { opacity: 0.75 } : null,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <>
                      <Text style={styles.submitText}>Submit feedback</Text>
                      <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
                    </>
                  )}
                </Pressable>
                <Text style={styles.privacyNote}>Anonymous. Takes 10 seconds.</Text>
              </View>
            </KeyboardAvoidingView>
          ) : screen === 'thanks' ? (
            <View style={[styles.centeredBody, { paddingHorizontal: 10 }]}>
              <ConfettiBurst
                active={rating !== null && rating >= 4}
                colors={colors}
                styles={styles}
                reduceMotion={reduceMotion}
              />
              <View style={styles.successCircle}>
                <Svg width={82} height={82} viewBox="0 0 100 100">
                  <AnimatedPath
                    d="M25 51 L43 68 L76 32"
                    fill="none"
                    stroke={colors.success}
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="80"
                    strokeDashoffset={checkDraw}
                  />
                </Svg>
              </View>
              <Text style={styles.successTitle}>Thanks!</Text>
              <Text style={styles.successCopy}>
                Your feedback helps improve tomorrow’s meal.
              </Text>
              <Text style={styles.studentStat}>
                You’re one of {studentCount} students who rated {meal?.toLowerCase()} today
              </Text>
              {savedOffline ? (
                <Text style={styles.offlineNote}>
                  Saved, will send when online. Your feedback is queued on this device.
                </Text>
              ) : null}
              <View style={styles.successActions}>
                <Pressable
                  testID="rate-another-meal"
                  accessibilityRole="button"
                  onPress={returnToMeals}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    onPressInStyle({ pressed }),
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Rate another meal</Text>
                  <Ionicons name="arrow-forward" size={17} color={colors.primaryForeground} />
                </Pressable>
                {offlineQueue.length > 0 ? (
                  <Text style={styles.privacyNote}>
                    {offlineQueue.length} feedback {offlineQueue.length === 1 ? 'item' : 'items'} saved for later
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.centeredBody}>
              <View style={styles.alreadyIcon}>
                <Ionicons name="checkmark-done" size={39} color={colors.accentForeground} />
              </View>
              <Text style={[styles.successTitle, { fontSize: 24 }]}>
                Already rated {alreadyMeal?.toLowerCase()}
              </Text>
              <Text style={styles.successCopy}>
                Thanks for helping make today’s meal better. Come back for the next meal!
              </Text>
              <View style={styles.successActions}>
                <Pressable
                  testID="choose-another-meal"
                  accessibilityRole="button"
                  onPress={returnToMeals}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    onPressInStyle({ pressed }),
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Choose another meal</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
