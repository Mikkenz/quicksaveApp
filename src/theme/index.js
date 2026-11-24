import { useColorScheme } from 'react-native';

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
  destaque: palette.vermelho,
  textoNoDestaque: palette.creme,
  sucesso: palette.verde,
  erro: palette.vermelho,
};

const dark = {
  fundo: '#14090f',
  superficie: '#23141d',
  texto: palette.creme,
  textoSuave: '#cdb8d6',
  borda: palette.creme,
  sombra: '#000000',
  divisor: '#3d2a36',
  primario: '#b56ccc',
  textoNoPrimario: palette.tinta,
  destaque: '#e0402e',
  textoNoDestaque: palette.tinta,
  sucesso: '#6fd08f',
  erro: '#ff7a68',
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

export function useTheme() {
  const esquema = useColorScheme();
  const cores = esquema === 'dark' ? dark : light;
  return { cores, fonts, borda, escuro: esquema === 'dark' };
}
