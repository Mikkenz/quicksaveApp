// Números dos avisos (sino do Início e aba Amigos), compartilhados entre as telas.
// Atualiza ao abrir o app, a cada minuto e sempre que alguma tela chama atualizarContagens().
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { contagens } from './social';

let atual = { notificacoes: 0, pedidos: 0, convites: 0 };
const ouvintes = new Set();

export async function atualizarContagens() {
  atual = await contagens();
  ouvintes.forEach((f) => f(atual));
}

export function useContagens() {
  const [valor, setValor] = useState(atual);
  useEffect(() => {
    ouvintes.add(setValor);
    return () => ouvintes.delete(setValor);
  }, []);
  return valor;
}

/** Usado uma vez, no layout das abas. */
export function useAtualizacaoDasContagens() {
  useEffect(() => {
    atualizarContagens();
    const t = setInterval(atualizarContagens, 60000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') atualizarContagens();
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, []);
}
