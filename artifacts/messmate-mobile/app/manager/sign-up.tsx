import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, type Href, useRouter } from 'expo-router';
import { useAuth, useSignUp } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
  orange: '#F06A14',
  cream: '#F1ECEC',
  ink: '#292421',
  muted: '#796F6A',
  white: '#FFFFFF',
  line: '#DED5D1',
  error: '#A83222',
};

export default function ManagerSignUp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const isFetching = fetchStatus === 'fetching';
  const needsEmailVerification =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0;

  const finishSignUp = async () => {
    await signUp.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          setNotice('Complete the remaining account security step to continue.');
          return;
        }
        router.replace(decorateUrl('/manager') as Href);
      },
    });
  };

  const handleCreateAccount = async () => {
    setFormError('');
    setNotice('');
    try {
      const { error } = await signUp.password({ emailAddress, password });
      if (error) {
        setFormError(error instanceof Error ? error.message : 'We could not create your account. Check your details and try again.');
        return;
      }

      if (
        signUp.status === 'missing_requirements' &&
        signUp.unverifiedFields.includes('email_address') &&
        signUp.missingFields.length === 0
      ) {
        await signUp.verifications.sendEmailCode();
        setNotice('A verification code has been sent to your email.');
      } else if (signUp.status === 'complete') {
        await finishSignUp();
      } else {
        setFormError('Your account needs additional information. Please contact your MessMate administrator for help.');
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Account creation failed. Please try again.');
    }
  };

  const handleVerifyEmail = async () => {
    setFormError('');
    setNotice('');
    try {
      await signUp.verifications.verifyEmailCode({ code: verificationCode });
      if (signUp.status === 'complete') {
        await finishSignUp();
      } else {
        setFormError('That code could not complete verification. Check it and try again.');
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Email verification failed. Please try again.');
    }
  };

  if (isSignedIn) return null;

  const emailError =
    errors.fields.emailAddress?.message ?? errors.fields.password?.message;

  return (
    <KeyboardAwareScrollViewCompat
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: (Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top) + 26,
          paddingBottom: (Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom) + 28,
        },
      ]}
      bottomOffset={28}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Ionicons name="restaurant" size={19} color={COLORS.white} />
        </View>
        <Text style={styles.brandWordmark}>MESSMATE</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>STAFF PORTAL</Text>
        <Text style={styles.title}>Join the{'\n'}service team.</Text>
        <Text style={styles.subtitle}>
          Create an account with your staff email.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.formTitle}>
          {needsEmailVerification ? 'Verify your email' : 'Create account'}
        </Text>
        <Text style={styles.formSubtitle}>
          {needsEmailVerification
            ? 'Enter the one-time code we sent to your inbox.'
            : 'Your staff access is checked securely after sign-in.'}
        </Text>

        {needsEmailVerification ? (
          <>
            <Text style={styles.label}>Verification code</Text>
            <TextInput
              testID="manager-sign-up-verification-code"
              style={styles.input}
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="Enter code"
              placeholderTextColor={COLORS.muted}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              accessibilityLabel="Email verification code"
            />
            {errors.fields.code?.message ? (
              <Text style={styles.error}>{errors.fields.code.message}</Text>
            ) : null}
            <Pressable
              testID="manager-sign-up-verify-button"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                (isFetching || !verificationCode) && styles.buttonDisabled,
              ]}
              onPress={handleVerifyEmail}
              disabled={isFetching || !verificationCode}
            >
              {isFetching ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Verify email</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.textButton}
              onPress={() => signUp.verifications.sendEmailCode()}
            >
              <Text style={styles.textButtonLabel}>Send a new code</Text>
            </Pressable>
            <View nativeID="clerk-captcha" />
          </>
        ) : (
          <>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              testID="manager-sign-up-email"
              style={styles.input}
              value={emailAddress}
              onChangeText={setEmailAddress}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel="Email address"
              returnKeyType="next"
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="manager-sign-up-password"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              placeholderTextColor={COLORS.muted}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              accessibilityLabel="Password"
              onSubmitEditing={handleCreateAccount}
            />
            {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
            <Pressable
              testID="manager-create-account-button"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                (isFetching || !emailAddress || !password) && styles.buttonDisabled,
              ]}
              onPress={handleCreateAccount}
              disabled={isFetching || !emailAddress || !password}
            >
              {isFetching ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </Pressable>
            {/* Required for Clerk's bot sign-up protection. */}
            <View nativeID="clerk-captcha" />
          </>
        )}

        {formError ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
            <Text style={styles.errorBannerText}>{formError}</Text>
          </View>
        ) : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.signupRow}>
          <Text style={styles.signupText}>Already have an account? </Text>
          <Link href="/manager/sign-in" asChild>
            <Pressable accessibilityRole="link">
              <Text style={styles.signupLink}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <Text style={styles.footer}>MESSMATE · SERVICE TEAM</Text>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWordmark: {
    color: COLORS.ink,
    fontFamily: 'ArchivoBlack_400Regular',
    fontSize: 14,
    letterSpacing: 1.1,
  },
  hero: {
    marginTop: 38,
    marginBottom: 27,
  },
  eyebrow: {
    color: COLORS.orange,
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    letterSpacing: 1.7,
    marginBottom: 10,
  },
  title: {
    color: COLORS.ink,
    fontFamily: 'ArchivoBlack_400Regular',
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.1,
  },
  subtitle: {
    color: COLORS.muted,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 9,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E9E0DC',
    shadowColor: '#513625',
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 9 },
    elevation: 3,
  },
  formTitle: {
    color: COLORS.ink,
    fontFamily: 'ArchivoBlack_400Regular',
    fontSize: 21,
  },
  formSubtitle: {
    color: COLORS.muted,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
    marginBottom: 20,
  },
  label: {
    color: COLORS.ink,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    marginBottom: 7,
  },
  input: {
    height: 50,
    backgroundColor: '#FCFAF9',
    color: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    marginBottom: 15,
  },
  primaryButton: {
    minHeight: 51,
    borderRadius: 13,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.84,
  },
  buttonDisabled: {
    opacity: 0.52,
  },
  textButton: {
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textButtonLabel: {
    color: COLORS.orange,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  error: {
    color: COLORS.error,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    marginTop: -8,
    marginBottom: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: 11,
    backgroundColor: '#FFF2EF',
    marginTop: 14,
  },
  errorBannerText: {
    color: COLORS.error,
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 17,
  },
  notice: {
    color: COLORS.ink,
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 17,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 22,
  },
  signupText: {
    color: COLORS.muted,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
  },
  signupLink: {
    color: COLORS.orange,
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
  },
  footer: {
    color: COLORS.muted,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.4,
    textAlign: 'center',
    marginTop: 22,
  },
});