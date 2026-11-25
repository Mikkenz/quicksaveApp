import { supabase } from './supabase';

export const STATUS = [
  { valor: 'wishlist', rotulo: 'Quero', longo: 'Quero jogar' },
  { valor: 'playing', rotulo: 'Jogando', longo: 'Jogando' },
  { valor: 'finished', rotulo: 'Zerei', longo: 'Zerei' },
  { valor: 'dropped', rotulo: 'Larguei', longo: 'Larguei' },
];

export const PLATAFORMAS = ['PS5', 'PS4', 'Xbox Series', 'Xbox One', 'Switch 2', 'Switch', 'PC', 'Steam Deck', 'Celular', 'Outra'];

export const VISIBILIDADE = [
  { valor: 'friends', rotulo: 'Amigos' },
  { valor: 'public', rotulo: 'Todos' },
];

export const rotuloStatus = (v) => STATUS.find((s) => s.valor === v)?.longo || v;

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function dataCurta(iso, comAno = false) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${Number(d)} ${MESES[Number(m) - 1]}${comAno ? ` ${a}` : ''}`;
}

export async function meuRegistro(userId, gameId) {
  const { data } = await supabase.from('logs').select('*').eq('user_id', userId).eq('game_id', gameId).maybeSingle();
  return data;
}

export async function salvarRegistro(userId, gameId, campos) {
  const { data, error } = await supabase
    .from('logs')
    .upsert({ user_id: userId, game_id: gameId, ...campos }, { onConflict: 'user_id,game_id' })
    .select('*')
    .single();
  if (error) {
    console.warn('salvarRegistro:', error.message);
    return { erro: 'Não foi possível salvar agora. Tente de novo.' };
  }
  return { registro: data };
}

export async function apagarRegistro(userId, gameId) {
  const { error } = await supabase.from('logs').delete().eq('user_id', userId).eq('game_id', gameId);
  if (error) return { erro: 'Não foi possível apagar agora. Tente de novo.' };
  return {};
}

const COM_JOGO = '*, games(igdb_id, name, cover_image_id, first_release)';

export async function meusRegistros(userId, { status, comReview, limite = 50 } = {}) {
  let q = supabase.from('logs').select(COM_JOGO).eq('user_id', userId).order('updated_at', { ascending: false }).limit(limite);
  if (status) q = q.eq('status', status);
  if (comReview) q = q.not('review', 'is', null);
  const { data, error } = await q;
  if (error) console.warn('meusRegistros:', error.message);
  return data || [];
}

export async function estatisticasJogo(gameId) {
  const { data } = await supabase.rpc('game_stats', { p_game: gameId });
  return Array.isArray(data) ? data[0] : data;
}

export async function alternarFavorito(gameId) {
  const { data, error } = await supabase.rpc('toggle_favorite', { p_game: gameId });
  if (error) {
    if (error.message?.includes('favoritos_cheios')) return { erro: 'Você já tem 4 favoritos. Tire um no seu perfil para colocar este.' };
    return { erro: 'Não foi possível mudar os favoritos agora.' };
  }
  return { favorito: data };
}

export async function favoritosDe(userId) {
  const { data } = await supabase
    .from('favorites')
    .select('position, game_id, games(igdb_id, name, cover_image_id)')
    .eq('user_id', userId)
    .order('position');
  return data || [];
}
