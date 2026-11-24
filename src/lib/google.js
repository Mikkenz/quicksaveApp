// Login com Google no Android (app nativo).
// A biblioteca tem código nativo: funciona no APK (development ou preview), não no Expo Go.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from './supabase';

const noExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export async function entrarComGoogle() {
  if (noExpoGo) {
    return { erro: 'O login com Google só funciona no app instalado (APK). No Expo Go, use e-mail e senha.' };
  }
  const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
  try {
    await GoogleSignin.hasPlayServices();
    const resposta = await GoogleSignin.signIn();
    if (resposta.type !== 'success') return { cancelado: true };
    const idToken = resposta.data?.idToken;
    if (!idToken) return { erro: 'O Google não devolveu o token de acesso. Tente de novo.' };
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) return { erro: error.message };
    return {};
  } catch (e) {
    if (e?.code === statusCodes.IN_PROGRESS) return { cancelado: true };
    if (e?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { erro: 'O Google Play Services não está disponível neste aparelho.' };
    }
    return { erro: 'Não foi possível entrar com o Google. Tente de novo.' };
  }
}

export async function sairDoGoogle() {
  if (noExpoGo) return;
  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch {
    // sem sessão do Google: nada a fazer
  }
}
