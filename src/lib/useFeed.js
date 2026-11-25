import { useCallback, useRef, useState } from 'react';
import { POR_PAGINA } from './social';

/** Lista paginada de atividades. "buscar(antesDe)" devolve uma página. */
export function useFeed(buscar) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [temMais, setTemMais] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const pedido = useRef(0);

  const recarregar = useCallback(async () => {
    const meu = ++pedido.current;
    setCarregando(true);
    const pagina = await buscar(null);
    if (meu !== pedido.current) return;
    setItens(pagina);
    setTemMais(pagina.length === POR_PAGINA);
    setCarregando(false);
    setCarregou(true);
  }, [buscar]);

  const carregarMais = useCallback(async () => {
    if (carregando || itens.length === 0) return;
    const meu = ++pedido.current;
    setCarregando(true);
    const pagina = await buscar(itens[itens.length - 1].event_id);
    if (meu !== pedido.current) return;
    setItens((atual) => [...atual, ...pagina.filter((p) => !atual.some((a) => a.event_id === p.event_id))]);
    setTemMais(pagina.length === POR_PAGINA);
    setCarregando(false);
  }, [buscar, carregando, itens]);

  return { itens, setItens, carregando, temMais, carregou, recarregar, carregarMais };
}
