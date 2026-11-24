// Login com Google na versão web: redireciona para o Google pelo Supabase e volta para o app.
import { supabase } from './supabase';

export async function entrarComGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) return { erro: error.message };
  return {};
}

export async function sairDoGoogle() {}
