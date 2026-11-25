import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

// No Android, o localStorage vem do expo-sqlite (o mesmo usado pela sessão do Supabase)
if (Platform.OS !== 'web') {
  require('expo-sqlite/localStorage/install');
}

// Mesmas cores do site quicksavegames.com.br
export const palette = {
  creme: '#ffeecc',
  superficie: '#fff7e0',
  tinta: '#020000',
  roxo: '#8d3da4',
  vermelho: '#c21808',
  lilas: '#b79cce',
  verde: '#1f6b3d',
};

const light = {
  fundo: palette.creme,
  superficie: palette.superficie,
  texto: palette.tinta,
  textoSuave: '#5b4a63',
  borda: palette.tinta,
  sombra: palette.tinta,
  divisor: '#e8d3a8',
  primario: palette.roxo,
  textoNoPrimario: palette.creme,
  link: palette.roxo, // roxo usado como cor de texto (links, @nomes)
  destaque: palette.vermelho,
  textoNoDestaque: palette.creme,
  sucesso: palette.verde,
  erro: palette.vermelho,
  fundoMenu: 'rgba(2, 0, 0, 0.55)',
};

// Modo escuro do site (app/globals.css: --bg, --surface, --ink, --ink-soft, --line, --shadow...)
const dark = {
  fundo: '#170b1e',
  superficie: '#26122f',
  texto: palette.creme,
  textoSuave: '#cdb9dc',
  borda: palette.creme,
  sombra: palette.roxo,
  divisor: '#43264f',
  primario: palette.roxo,
  textoNoPrimario: palette.creme,
  link: palette.lilas, // o roxo não tem contraste suficiente como texto no fundo escuro
  destaque: palette.vermelho,
  textoNoDestaque: palette.creme,
  sucesso: '#7fd49a',
  erro: '#ff8a78',
  fundoMenu: 'rgba(2, 0, 0, 0.7)',
};

// Nomes registrados em useFonts (src/app/_layout.js)
export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayMedia: 'BricolageGrotesque_700Bold',
  corpo: 'SourceSerif4_400Regular',
  corpoForte: 'SourceSerif4_600SemiBold',
  corpoItalico: 'SourceSerif4_400Regular_Italic',
  mono: 'DMMono_400Regular',
  monoMedia: 'DMMono_500Medium',
};

export const borda = { largura: 3, raio: 12, raioCartao: 14 };

// Sombra deslocada sem desfoque (boxShadow funciona na nova arquitetura do React Native e na web)
export function sombra(cores, tamanho = 4) {
  return { boxShadow: `${tamanho}px ${tamanho}px 0px ${cores.sombra}` };
}

export const ALVO_TOQUE = 44;

// Mesma chave do site; guarda 'light' ou 'dark'. Sem nada salvo, segue o celular.
const CHAVE = 'quicksave-theme';

function lerPreferencia() {
  try {
    const v = globalThis.localStorage?.getItem(CHAVE);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

const TemaContext = createContext(null);

export function ThemeProvider({ children }) {
  const sistema = useColorScheme();
  const [preferencia, setPreferencia] = useState(lerPreferencia);
  const escuro = (preferencia || sistema) === 'dark';

  const alternarTema = useCallback(() => {
    const proximo = escuro ? 'light' : 'dark';
    try {
      globalThis.localStorage?.setItem(CHAVE, proximo);
    } catch {
      // sem armazenamento: vale só até fechar o app
    }
    setPreferencia(proximo);
  }, [escuro]);

  // Na web, o fundo da página acompanha (aparece ao rolar além do fim)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = (escuro ? dark : light).fundo;
    }
  }, [escuro]);

  const valor = useMemo(() => ({ escuro, alternarTema }), [escuro, alternarTema]);
  return createElement(TemaContext.Provider, { value: valor }, children);
}

export function useTheme() {
  const ctx = useContext(TemaContext);
  const sistema = useColorScheme();
  const escuro = ctx ? ctx.escuro : sistema === 'dark';
  return { cores: escuro ? dark : light, fonts, borda, escuro, alternarTema: ctx?.alternarTema };
}
