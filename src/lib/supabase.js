import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

// No Android, o localStorage vem do expo-sqlite (recomendação atual da Expo).
// Na web, o navegador já tem localStorage.
if (Platform.OS !== 'web') {
  require('expo-sqlite/localStorage/install');
}

// Usa só a origem (https://xxxx.supabase.co), mesmo se colarem a Callback URL por engano
function origem(texto) {
  try {
    return texto ? new URL(texto.trim()).origin : texto;
  } catch {
    return texto;
  }
}

const url = origem(process.env.EXPO_PUBLIC_SUPABASE_URL);
const chave = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigurado = Boolean(url && chave);

if (!supabaseConfigurado) {
  console.warn('Supabase sem configuração: preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local');
}

export const supabase = createClient(url || 'https://configure.supabase.co', chave || 'configure', {
  auth: {
    storage: globalThis.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Na web o login com Google volta para a página com o token na URL
    detectSessionInUrl: Platform.OS === 'web',
  },
});
