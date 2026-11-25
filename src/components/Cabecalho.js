import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Titulo } from './ui';
import { IconeVoltar } from './icons';
import { ALVO_TOQUE, useTheme } from '../theme';

/** Cabeçalho com botão voltar e título grande. */
export function Cabecalho({ titulo, voltar = true, direita }) {
  const { cores } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: voltar ? -12 : 0 }}>
      {voltar ? (
        <Pressable
          role="button"
          aria-label="Voltar"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={{ width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' }}
        >
          <IconeVoltar cor={cores.texto} tamanho={24} />
        </Pressable>
      ) : null}
      <Titulo style={{ fontSize: 30, flex: 1 }}>{titulo}</Titulo>
      {direita}
    </View>
  );
}

/** Cabeçalho das abas: título grande e linha grossa embaixo. */
export function CabecalhoAba({ titulo, direita, children }) {
  const { cores } = useTheme();
  return (
    <View style={{ marginHorizontal: -24, marginTop: -24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 12, borderBottomWidth: 3, borderColor: cores.borda }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: ALVO_TOQUE }}>
        <Titulo>{titulo}</Titulo>
        {direita}
      </View>
      {children}
    </View>
  );
}
