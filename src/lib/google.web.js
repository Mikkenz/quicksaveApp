// Login com Google na versão web: redireciona para o Google pelo Supabase e volta para o app.
import { supabase } from './supabase';

export async function entrarComGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) {
    console.warn('Login Google (web) falhou:', error.message);
    return { erro: 'Não foi possível entrar com o Google agora. Tente de novo ou use e-mail e senha.' };
  }
  return {};
}

export async function sairDoGoogle() {}
