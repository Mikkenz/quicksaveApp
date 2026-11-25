import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { carregarJogo } from './igdb';

/**
 * Carrega um jogo: primeiro o que já está no banco (rápido), depois a ficha completa
 * pela função "igdb" se ainda não tiver (resumo etc.).
 */
export function useJogo(id) {
  const [estado, setEstado] = useState({ jogo: null, carregando: true, erro: null });

  useEffect(() => {
    let ativo = true;
    const gameId = Number(id);
    if (!Number.isInteger(gameId)) {
      setEstado({ jogo: null, carregando: false, erro: 'Jogo não encontrado.' });
      return;
    }
    (async () => {
      const { data: salvo } = await supabase.from('games').select('*').eq('igdb_id', gameId).maybeSingle();
      if (!ativo) return;
      if (salvo) setEstado({ jogo: salvo, carregando: !salvo.detailed, erro: null });
      if (salvo?.detailed) return;
      const r = await carregarJogo(gameId);
      if (!ativo) return;
      if (r.jogo) setEstado({ jogo: r.jogo, carregando: false, erro: null });
      else setEstado({ jogo: salvo || null, carregando: false, erro: salvo ? null : r.erro || 'Jogo não encontrado.' });
    })();
    return () => {
      ativo = false;
    };
  }, [id]);

  return estado;
}
