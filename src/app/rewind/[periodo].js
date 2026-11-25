import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Tela, Texto } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { Stories } from '../../components/rewind/Stories';
import { montarTelas } from '../../components/rewind/telas';
import { useCompartilharRewind } from '../../components/rewind/Compartilhar';
import { useAuth } from '../../lib/auth';
import { abrirRewind } from '../../lib/rewind';
import { useTheme } from '../../theme';

function Player({ rewind }) {
  const { precisaAutorizacao } = useAuth();
  const share = useCompartilharRewind(rewind);
  const telas = useMemo(
    () => montarTelas(rewind, { ...share, podeCompartilhar: !precisaAutorizacao }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rewind, share.semCapa, share.enviando, share.mensagem, share.erro, precisaAutorizacao]
  );
  return <Stories telas={telas} aoFechar={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}

export default function RewindPeriodo() {
  const { periodo } = useLocalSearchParams();
  const { cores } = useTheme();
  const [rewind, setRewind] = useState(undefined);

  useEffect(() => {
    abrirRewind(String(periodo || '')).then(setRewind);
  }, [periodo]);

  if (rewind === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={cores.link} />
      </View>
    );
  }
  if (!rewind) {
    return (
      <Tela>
        <Cabecalho titulo="Rewind" />
        <Texto suave>Este Rewind não está disponível para você.</Texto>
      </Tela>
    );
  }
  return <Player rewind={rewind} />;
}
