import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Tela, Texto } from '../components/ui';
import { Cabecalho } from '../components/Cabecalho';
import { CartaoRewindLista } from '../components/rewind/CartaoLista';
import { meusRewinds } from '../lib/rewind';
import { useTheme } from '../theme';

export default function Rewinds() {
  const { cores } = useTheme();
  const [itens, setItens] = useState(null);

  useFocusEffect(
    useCallback(() => {
      meusRewinds().then(setItens);
    }, [])
  );

  return (
    <Tela>
      <Cabecalho titulo="Rewinds" />
      <Texto suave style={{ fontSize: 15 }}>Sua retrospectiva de cada mês e de cada ano. Só você vê, a não ser que compartilhe a imagem.</Texto>
      {itens === null ? <ActivityIndicator color={cores.link} /> : null}
      {itens && itens.length === 0 ? (
        <Texto suave>Nenhum Rewind ainda. O mensal chega no dia 1 de cada mês, se você tiver registrado jogos no mês anterior.</Texto>
      ) : null}
      <View style={{ gap: 14 }}>
        {(itens || []).map((r) => <CartaoRewindLista key={r.id} r={r} />)}
      </View>
    </Tela>
  );
}
