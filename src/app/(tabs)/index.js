import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Aviso, Botao, Rotulo, Tela, Texto } from '../../components/ui';
import { CabecalhoAba } from '../../components/Cabecalho';
import { Capa, Opcoes } from '../../components/jogos';
import { IconeBuscar, IconeSino } from '../../components/icons';
import { CartaoReview, ListaAtividades, Selo } from '../../components/social';
import { useAuth } from '../../lib/auth';
import { atualizarContagens, useContagens } from '../../lib/contagens';
import { feedAmigos, jogosPopulares, reviewsEmAlta } from '../../lib/social';
import { useFeed } from '../../lib/useFeed';
import { meusRewinds } from '../../lib/rewind';
import { CartaoRewindLista } from '../../components/rewind/CartaoLista';
import { ALVO_TOQUE, useTheme } from '../../theme';

const ABAS = [
  { valor: 'amigos', rotulo: 'Amigos' },
  { valor: 'popular', rotulo: 'Popular' },
];

function BotaoBuscar() {
  const { cores, borda } = useTheme();
  return (
    <Pressable
      role="button"
      aria-label="Buscar jogos"
      onPress={() => router.push('/buscar')}
      style={{ width: ALVO_TOQUE + 4, height: ALVO_TOQUE + 4, borderRadius: 24, borderWidth: borda.largura, borderColor: cores.borda, backgroundColor: cores.superficie, alignItems: 'center', justifyContent: 'center' }}
    >
      <IconeBuscar cor={cores.texto} tamanho={22} />
    </Pressable>
  );
}

function BotaoSino() {
  const { cores, borda } = useTheme();
  const { notificacoes } = useContagens();
  return (
    <Pressable
      role="button"
      aria-label={notificacoes ? `Notificações, ${notificacoes} novas` : 'Notificações'}
      onPress={() => router.push('/notificacoes')}
      style={{ width: ALVO_TOQUE + 4, height: ALVO_TOQUE + 4, borderRadius: 24, borderWidth: borda.largura, borderColor: cores.borda, backgroundColor: cores.superficie, alignItems: 'center', justifyContent: 'center' }}
    >
      <IconeSino cor={cores.texto} tamanho={24} />
      <Selo valor={notificacoes} style={{ position: 'absolute', top: -6, right: -6 }} />
    </Pressable>
  );
}

function FeedAmigos() {
  const { precisaAutorizacao } = useAuth();
  const [erro, setErro] = useState(null);
  const feed = useFeed(feedAmigos);
  const { recarregar } = feed;

  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar])
  );

  return (
    <View style={{ gap: 14 }}>
      <Aviso>{erro}</Aviso>
      <ListaAtividades
        {...feed}
        aoErro={setErro}
        vazio={
          <View style={{ gap: 12 }}>
            <Texto suave>
              {precisaAutorizacao
                ? 'Quando seu responsável autorizar, você vai poder adicionar amigos e ver o que eles estão jogando aqui.'
                : 'Aqui aparece o que seus amigos estão jogando. Que tal adicionar alguém?'}
            </Texto>
            {precisaAutorizacao ? null : <Botao titulo="Encontrar amigos" variante="primario" onPress={() => router.push('/amigos')} />}
          </View>
        }
      />
    </View>
  );
}

function Popular() {
  const { cores, fonts } = useTheme();
  const [jogos, setJogos] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [carregou, setCarregou] = useState(false);
  const [erro, setErro] = useState(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([jogosPopulares(), reviewsEmAlta()]).then(([j, r]) => {
        setJogos(j);
        setReviews(r);
        setCarregou(true);
      });
    }, [])
  );

  function trocar(nova, msg) {
    if (msg) return setErro(msg);
    setReviews((lista) => lista.map((r) => (r.user_id === nova.user_id && r.game_id === nova.game_id ? nova : r)));
  }

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 10 }}>
        <Rotulo>Mais jogados da semana</Rotulo>
        {carregou && jogos.length === 0 ? <Texto suave>Ainda não há jogos registrados nesta semana.</Texto> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8, paddingBottom: 6 }}>
          {jogos.map((j, i) => (
            <Pressable
              key={j.game_id}
              role="link"
              aria-label={`${i + 1}º, ${j.name}, ${j.players} ${j.players === 1 ? 'pessoa' : 'pessoas'}`}
              onPress={() => router.push(`/jogo/${j.game_id}`)}
              style={{ width: 96, gap: 4 }}
            >
              <Capa imageId={j.cover_image_id} nome={j.name} largura={96} />
              <Text style={{ fontFamily: fonts.display, fontSize: 13, color: cores.texto }} numberOfLines={2}>{j.name}</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: cores.textoSuave }}>
                {j.players} {j.players === 1 ? 'pessoa' : 'pessoas'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: 12 }}>
        <Rotulo>Reviews em alta</Rotulo>
        <Aviso>{erro}</Aviso>
        {carregou && reviews.length === 0 ? <Texto suave>Nenhuma review pública nos últimos 30 dias.</Texto> : null}
        {reviews.map((r) => <CartaoReview key={`${r.user_id}-${r.game_id}`} r={r} aoMudar={trocar} />)}
      </View>
    </View>
  );
}

export default function Inicio() {
  const [aba, setAba] = useState('amigos');
  const [rewind, setRewind] = useState(null);

  useFocusEffect(
    useCallback(() => {
      atualizarContagens();
      // Destaque do Rewind: o mais recente publicado, se ainda não foi visto ou saiu há menos de 30 dias
      meusRewinds().then((lista) => {
        const r = lista.find((x) => x.status === 'published');
        const recente = r?.published_at && Date.now() - new Date(r.published_at).getTime() < 30 * 86400000;
        setRewind(r && (!r.seen || recente) ? r : null);
      });
    }, [])
  );

  return (
    <Tela>
      <CabecalhoAba
        titulo="Início"
        direita={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <BotaoBuscar />
            <BotaoSino />
          </View>
        }
      >
        <Opcoes rotulo="O que mostrar" opcoes={ABAS} valor={aba} onChange={setAba} colunas={2} />
      </CabecalhoAba>
      {rewind ? <CartaoRewindLista r={rewind} destaque /> : null}
      {aba === 'amigos' ? <FeedAmigos /> : <Popular />}
    </Tela>
  );
}
