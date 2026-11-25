// Conversa com a Edge Function "igdb" (o app nunca fala direto com o IGDB).
import { supabase } from './supabase';

async function chamar(corpo) {
  const { data, error } = await supabase.functions.invoke('igdb', { body: corpo });
  if (error) {
    let detalhe = null;
    try {
      detalhe = await error.context?.json?.();
    } catch {
      // sem corpo
    }
    console.warn('igdb falhou:', error.message, detalhe);
    return { erro: detalhe?.mensagem || 'Não foi possível buscar os jogos agora. Tente de novo.' };
  }
  if (data?.erro) return { erro: data.mensagem || 'Não foi possível buscar os jogos agora.' };
  return data;
}

export async function buscarJogos(q) {
  const r = await chamar({ acao: 'buscar', q });
  return r.erro ? { erro: r.erro, itens: [] } : { itens: r.itens || [] };
}

export async function carregarJogo(id) {
  const r = await chamar({ acao: 'jogo', id: Number(id) });
  return r.erro ? { erro: r.erro } : { jogo: r.jogo };
}

/** Endereço da capa no servidor de imagens do IGDB. Tamanhos: t_cover_small, t_cover_big, t_720p */
export function urlCapa(imageId, tamanho = 't_cover_big') {
  return imageId ? `https://images.igdb.com/igdb/image/upload/${tamanho}/${imageId}.jpg` : null;
}

export function anoDe(data) {
  return data ? String(data).slice(0, 4) : null;
}
