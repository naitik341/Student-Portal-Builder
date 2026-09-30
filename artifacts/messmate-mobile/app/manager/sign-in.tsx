import React, { useCallback, useEffect, useState } from 'react';
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
import { useSignIn, useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
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

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function ManagerSignIn() {
  useWarmUpBrowser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const isFetching = fetchStatus === 'fetching';

  const finishSignIn = useCallback(async () => {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          setNotice('Complete the remaining account security step to continue.');
          return;
        }
        router.replace(decorateUrl('/manager') as Href);
      },
    });
  }, [router, signIn]);

  const handlePasswordSignIn = async () => {
    setFormError('');
    setNotice('');
    try {
      const { error } = await signIn.password({ emailAddress, password });
      if (error) {
        setFormError(error instanceof Error ? error.message : 'We could not sign you in. Check your details and try again.');
        return;
      }

      if (signIn.status === 'complete') {
        await finishSignIn();
      } else if (signIn.status === 'needs_client_trust') {
        const emailCodeFactor = signIn.supportedSecondFactors.find(
          (factor) => factor.strategy === 'email_code',
        );
        if (emailCodeFactor) {
          await signIn.mfa.sendEmailCode();
          setNotice('A verification code has been sent to your email.');
        } else {
          setFormError('Your account requires another verification method. Contact your MessMate administrator for help.');
        }
      } else if (signIn.status === 'needs_second_factor') {
        setFormError('Your account requires an additional verification method that is not available on this screen.');
      } else {
        setFormError('Your sign-in needs another step. Please try again or contact your administrator.');
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Sign-in failed. Please try again.');
    }
  };

  const handleEmailCode = async () => {
    setFormError('');
    setNotice('');
    try {
      await signIn.mfa.verifyEmailCode({ code: verificationCode });
      if (signIn.status === 'complete') {
        await finishSignIn();
      } else {
        setFormError('That code could not complete verification. Check it and try again.');
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Verification failed. Please try again.');
    }
  };

  const handleGoogleSignIn = useCallback(async () => {
    setFormError('');
    setNotice('');
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({
          scheme: 'messmate-mobile',
          path: 'manager/sign-in',
        }),
      });

      if (createdSessionId) {
        await setActive!({
          session: createdSessionId,
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) {
              setNotice('Complete the remaining account security step to continue.');
              return;
            }
            router.replace(decorateUrl('/manager') as Href);
          },
        });
      } else {
        setFormError('Google sign-in needs additional account information. Please use email and password or contact your administrator.');
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Google sign-in failed. Please try again.');
    }
  }, [router, startSSOFlow]);

  const isVerifying = signIn.status === 'needs_client_trust';
  const emailError = errors.fields.identifier?.message ?? errors.fields.password?.message;

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
        <Text style={styles.title}>Good to{'\n'}see you.</Text>
        <Text style={styles.subtitle}>
          Sign in to manage your MessMate service.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.formTitle}>
          {isVerifying ? 'Check your email' : 'Staff sign in'}
        </Text>
        <Text style={styles.formSubtitle}>
          {isVerifying
            ? 'Enter the security code we sent to your email.'
            : 'Use your staff account to continue.'}
        </Text>

        {isVerifying ? (
          <>
            <Text style={styles.label}>Verification code</Text>
            <TextInput
              testID="manager-verification-code"
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
              testID="manager-verify-button"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                (isFetching || !verificationCode) && styles.buttonDisabled,
              ]}
              onPress={handleEmailCode}
              disabled={isFetching || !verificationCode}
            >
              {isFetching ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Verify and continue</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.textButton}
              onPress={() => signIn.mfa.sendEmailCode()}
            >
              <Text style={styles.textButtonLabel}>Send a new code</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.textButton}
              onPress={() => {
                signIn.reset();
                setVerificationCode('');
                setFormError('');
              }}
            >
              <Text style={styles.textButtonLabel}>Back to sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              testID="manager-google-sign-in"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleGoogleSignIn}
            >
              <Ionicons name="logo-google" size={18} color={COLORS.ink} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR USE EMAIL</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.label}>Email address</Text>
            <TextInput
              testID="manager-email"
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
              testID="manager-password"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.muted}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              accessibilityLabel="Password"
              onSubmitEditing={handlePasswordSignIn}
            />
            {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
            <Pressable
              testID="manager-sign-in-button"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                (isFetching || !emailAddress || !password) && styles.buttonDisabled,
              ]}
              onPress={handlePasswordSignIn}
              disabled={isFetching || !emailAddress || !password}
            >
              {isFetching ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Sign in</Text>
              )}
            </Pressable>
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
          <Text style={styles.signupText}>New to the staff portal? </Text>
          <Link href="/manager/sign-up" asChild>
            <Pressable accessibilityRole="link">
              <Text style={styles.signupLink}>Create account</Text>
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
    fontSize: 42,
    lineHeight: 47,
    letterSpacing: -1.2,
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
  googleButton: {
    minHeight: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
  },
  googleButtonText: {
    color: COLORS.ink,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginVertical: 19,
  },
  dividerLine: {
    height: 1,
    backgroundColor: COLORS.line,
    flex: 1,
  },
  dividerText: {
    color: COLORS.muted,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.1,
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