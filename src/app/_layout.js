import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { SourceSerif4_400Regular, SourceSerif4_400Regular_Italic, SourceSerif4_600SemiBold } from '@expo-google-fonts/source-serif-4';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { AuthProvider, useAuth } from '../lib/auth';
import { useTheme } from '../theme';

SplashScreen.preventAutoHideAsync();

function Navegacao() {
  const { carregando, logado, perfilCompleto } = useAuth();
  const { cores, escuro } = useTheme();

  useEffect(() => {
    if (!carregando) SplashScreen.hideAsync();
  }, [carregando]);

  if (carregando) return null;

  return (
    <>
      <StatusBar style={escuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }}>
        <Stack.Protected guard={!logado}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={logado && !perfilCompleto}>
          <Stack.Screen name="completar-perfil" />
        </Stack.Protected>
        <Stack.Protected guard={logado && perfilCompleto}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="jogo/[id]" />
          <Stack.Screen name="registro/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="editar-perfil" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontesProntas, erroFontes] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    SourceSerif4_400Regular,
    SourceSerif4_400Regular_Italic,
    SourceSerif4_600SemiBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  if (!fontesProntas && !erroFontes) return null;

  return (
    <AuthProvider>
      <Navegacao />
    </AuthProvider>
  );
}
