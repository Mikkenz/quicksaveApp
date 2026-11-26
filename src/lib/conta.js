// Conta: excluir (LGPD), baixar meus dados, autorização do responsável e redefinir senha.
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

async function invocar(nome, body) {
  const { data, error } = await supabase.functions.invoke(nome, { body: body || {} });
  if (!error) return { dados: data };
  // A função responde com { erro: '...' } e um status de erro
  let codigo = null;
  try {
    codigo = (await error.context?.json?.())?.erro || null;
  } catch {
    // sem corpo
  }
  console.warn(`${nome}:`, codigo || error.message);
  return { erro: codigo || 'falhou' };
}

/** Apaga a conta. "confirmacao" é o @ digitado pela pessoa. */
export async function excluirConta(confirmacao) {
  const r = await invocar('excluir-conta', { confirmacao });
  if (r.erro === 'confirmacao') return { erro: 'O @ digitado não confere com o seu.' };
  if (r.erro) return { erro: 'Não foi possível excluir agora. Tente de novo em alguns minutos.' };
  await supabase.auth.signOut();
  return {};
}

/** Envia (ou reenvia) o e-mail de autorização ao responsável. */
export async function pedirAutorizacao() {
  const r = await invocar('responsavel');
  if (!r.erro) return { ok: true, jaAutorizado: Boolean(r.dados?.ja_autorizado) };
  if (r.erro === 'aguarde') return { erro: 'Um e-mail foi enviado há pouco. Espere 10 minutos para pedir de novo.' };
  if (r.erro === 'sem_responsavel') return { erro: 'Falta o e-mail do responsável no seu perfil.' };
  return { erro: 'Não foi possível enviar o e-mail agora. Tente de novo mais tarde.' };
}

/** Gera o arquivo com os seus dados e compartilha (celular) ou baixa (web). */
export async function baixarMeusDados() {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error || !data) {
    console.warn('export_my_data:', error?.message);
    return { erro: 'Não foi possível gerar o arquivo agora. Tente de novo.' };
  }
  const texto = JSON.stringify(data, null, 2);
  const nome = `quicksave-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { ok: true, baixado: true };
  }

  const { File, Paths } = require('expo-file-system');
  const Sharing = require('expo-sharing');
  const arquivo = new File(Paths.cache, nome);
  arquivo.create({ overwrite: true });
  arquivo.write(texto);
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'application/json', dialogTitle: 'Salvar meus dados' });
  return { ok: true };
}

/** Para onde o link do e-mail de "esqueci a senha" deve voltar. */
export function linkRedefinirSenha() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/redefinir-senha`;
  return Linking.createURL('/redefinir-senha');
}

/**
 * No celular, o link do e-mail chega como quicksave://redefinir-senha#access_token=...&type=recovery.
 * Aqui a sessão é criada a partir dele (na web, o Supabase já faz isso sozinho).
 */
export async function tratarLinkDeRecuperacao(url) {
  if (!url || !url.includes('#')) return false;
  const params = new URLSearchParams(url.split('#')[1]);
  const acesso = params.get('access_token');
  const renovacao = params.get('refresh_token');
  if (!acesso || !renovacao) return false;
  const { error } = await supabase.auth.setSession({ access_token: acesso, refresh_token: renovacao });
  if (error) console.warn('link de recuperação:', error.message);
  // true só para o link de "Esqueci a senha": é ele que libera a tela de senha nova
  return !error && params.get('type') === 'recovery';
}
