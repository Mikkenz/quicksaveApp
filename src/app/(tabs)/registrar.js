import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Aviso, Rotulo, Tela, Texto } from '../../components/ui';
import { CabecalhoAba } from '../../components/Cabecalho';
import { CampoBusca, LinhaJogo, useBuscaJogos } from '../../components/busca';
import { Capa, Chip, CreditoIGDB } from '../../components/jogos';
import { useAuth } from '../../lib/auth';
import { meusRegistros } from '../../lib/registros';
import { useTheme } from '../../theme';

export default function RegistrarAba() {
  const { sessao } = useAuth();
  const { cores, fonts } = useTheme();
  const [texto, setTexto] = useState('');
  const { itens, carregando, erro } = useBuscaJogos(texto);
  const [jogando, setJogando] = useState([]);

  useFocusEffect(
    useCallback(() => {
      if (sessao?.user?.id) meusRegistros(sessao.user.id, { status: 'playing', limite: 10 }).then(setJogando);
    }, [sessao?.user?.id])
  );

  const buscando = texto.trim().length >= 2;

  return (
    <Tela>
      <CabecalhoAba titulo="Registrar">
        <CampoBusca valor={texto} onChange={setTexto} placeholder="Qual jogo você quer registrar?" />
      </CabecalhoAba>

      {buscando ? (
        <>
          {carregando ? <ActivityIndicator color={cores.link} /> : null}
          <Aviso>{erro}</Aviso>
          <View>
            {itens.map((j) => <LinhaJogo key={j.igdb_id} jogo={j} />)}
          </View>
          <CreditoIGDB />
        </>
      ) : (
        <View style={{ gap: 10 }}>
          <Rotulo>Você está jogando</Rotulo>
          {jogando.length === 0 ? <Texto suave>Nada por aqui ainda. Busque um jogo acima e marque como “Jogando”.</Texto> : null}
          {jogando.map((r) => (
            <Pressable
              key={r.game_id}
              role="button"
              aria-label={`Atualizar ${r.games?.name}`}
              onPress={() => router.push(`/registro/${r.game_id}`)}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 2, borderColor: cores.divisor }}
            >
              <Capa imageId={r.games?.cover_image_id} nome={r.games?.name} largura={44} tamanho="t_cover_small" />
              <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 16, color: cores.texto }} numberOfLines={2}>{r.games?.name}</Text>
              {r.platform ? <Chip texto={r.platform} /> : null}
            </Pressable>
          ))}
        </View>
      )}
    </Tela>
  );
}
