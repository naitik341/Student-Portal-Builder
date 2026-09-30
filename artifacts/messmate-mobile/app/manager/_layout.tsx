import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Redirect, Stack, type Href, useSegments } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { setAuthTokenGetter } from '@workspace/api-client-react';

export default function ManagerLayout() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const segments = useSegments();
  const isAuthRoute = segments.some(
    (segment) => segment === 'sign-in' || segment === 'sign-up',
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      setAuthTokenGetter(null);
      return;
    }

    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  if (!isLoaded) return null;

  if (isSignedIn && isAuthRoute) {
    return <Redirect href={'/manager' as Href} />;
  }

  if (!isSignedIn && !isAuthRoute) {
    return <Redirect href="/manager/sign-in" />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}