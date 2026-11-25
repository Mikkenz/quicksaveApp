import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { SourceSerif4_400Regular, SourceSerif4_400Regular_Italic, SourceSerif4_600SemiBold } from '@expo-google-fonts/source-serif-4';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { AuthProvider, useAuth } from '../lib/auth';
import { tratarLinkDeRecuperacao } from '../lib/conta';
import { ThemeProvider, useTheme } from '../theme';

SplashScreen.preventAutoHideAsync();

function Navegacao() {
  const { carregando, logado, perfilCompleto } = useAuth();
  const { cores, escuro } = useTheme();

  useEffect(() => {
    if (!carregando) SplashScreen.hideAsync();
  }, [carregando]);

  // Link de "Esqueci a senha" no celular: cria a sessão a partir do link (na web, o Supabase já faz isso)
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    Linking.getInitialURL().then(tratarLinkDeRecuperacao);
    const sub = Linking.addEventListener('url', ({ url }) => tratarLinkDeRecuperacao(url));
    return () => sub.remove();
  }, []);

  if (carregando) return null;

  return (
    <>
      <StatusBar style={escuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }}>
        {/* Fora das regras de acesso: abre logado ou não, a partir do e-mail */}
        <Stack.Screen name="redefinir-senha" />
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
          <Stack.Screen name="u/[username]" />
          <Stack.Screen name="grupo/novo" />
          <Stack.Screen name="grupo/[id]" />
          <Stack.Screen name="atividade/[id]" />
          <Stack.Screen name="notificacoes" />
          <Stack.Screen name="buscar" />
          <Stack.Screen name="comunidade/nova" />
          <Stack.Screen name="comunidade/[slug]" />
          <Stack.Screen name="comunidade/gerenciar/[slug]" />
          <Stack.Screen name="topico/novo" />
          <Stack.Screen name="topico/[id]" />
          <Stack.Screen name="denuncias" />
          <Stack.Screen name="rewinds" />
          <Stack.Screen name="rewind/[periodo]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="admin/rewind" />
          <Stack.Screen name="conta" />
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
    <ThemeProvider>
      <AuthProvider>
        <Navegacao />
      </AuthProvider>
    </ThemeProvider>
  );
}
