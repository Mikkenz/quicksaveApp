import { View } from 'react-native';
import { Cartao, Rotulo, Tela, Texto, Titulo } from './ui';
import { useTheme } from '../theme';

/** Tela provisória das abas que chegam nas próximas fases. */
export function EmBreve({ titulo, fase, descricao }) {
  const { cores } = useTheme();
  return (
    <Tela>
      <View style={{ paddingBottom: 12, borderBottomWidth: 3, borderColor: cores.borda, marginHorizontal: -24, paddingHorizontal: 24 }}>
        <Titulo>{titulo}</Titulo>
      </View>
      <Cartao style={{ gap: 8 }}>
        <Rotulo>{fase}</Rotulo>
        <Texto>{descricao}</Texto>
      </Cartao>
    </Tela>
  );
}
