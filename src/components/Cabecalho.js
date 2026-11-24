import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Titulo } from './ui';
import { IconeVoltar } from './icons';
import { ALVO_TOQUE, useTheme } from '../theme';

/** Cabeçalho com botão voltar e título grande. */
export function Cabecalho({ titulo, voltar = true }) {
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
      <Titulo style={{ fontSize: 30 }}>{titulo}</Titulo>
    </View>
  );
}
