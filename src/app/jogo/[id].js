import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Aviso, Botao, Cartao, Rotulo, Texto, Titulo } from '../../components/ui';
import { IconeVoltar } from '../../components/icons';
import { Capa, Chip, CreditoIGDB, Nota, Opcoes } from '../../components/jogos';
import { useAuth } from '../../lib/auth';
import { anoDe } from '../../lib/igdb';
import { useJogo } from '../../lib/useJogo';
import { STATUS, alternarFavorito, estatisticasJogo, favoritosDe, meuRegistro, salvarRegistro } from '../../lib/registros';
import { reviewsDoJogo } from '../../lib/social';
import { CartaoReview } from '../../components/social';
import { ALVO_TOQUE, palette, useTheme } from '../../theme';

function Estatistica({ valor, rotulo, cor }) {
  const { cores, fonts } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: cor || cores.texto }}>{valor}</Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: cores.textoSuave }}>{rotulo}</Text>
    </View>
  );
}

export default function PaginaJogo() {
  const { id } = useLocalSearchParams();
  const gameId = Number(id);
  const { sessao } = useAuth();
  const userId = sessao?.user?.id;
  const { cores, fonts } = useTheme();
  const { jogo, carregando, erro } = useJogo(id);
  const [registro, setRegistro] = useState(null);
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [favorito, setFavorito] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async () => {
    if (!userId || !Number.isInteger(gameId)) return;
    const [reg, st, rv, favs] = await Promise.all([
      meuRegistro(userId, gameId),
      estatisticasJogo(gameId),
      reviewsDoJogo(gameId),
      favoritosDe(userId),
    ]);
    setRegistro(reg);
    setStats(st);
    setReviews(rv);
    setFavorito(favs.some((f) => f.game_id === gameId));
  }, [userId, gameId]);

  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar])
  );

  async function mudarStatus(status) {
    if (!jogo || salvando) return;
    setAviso(null);
    setSalvando(true);
    const r = await salvarRegistro(userId, gameId, { status });
    setSalvando(false);
    if (r.erro) setAviso(r.erro);
    else {
      setRegistro(r.registro);
      estatisticasJogo(gameId).then(setStats);
    }
  }

  async function favoritar() {
    setAviso(null);
    const r = await alternarFavorito(gameId);
    if (r.erro) setAviso(r.erro);
    else setFavorito(r.favorito);
  }

  const meta = jogo ? [anoDe(jogo.first_release), jogo.developer, jogo.genres?.[0]].filter(Boolean).join(' · ') : '';

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ height: 190, backgroundColor: '#3a0a18', borderBottomWidth: 3, borderColor: cores.borda }}>
          <SafeAreaView edges={['top']}>
            <Pressable
              role="button"
              aria-label="Voltar"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={{ margin: 12, width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: 22, borderWidth: 3, borderColor: palette.tinta, backgroundColor: palette.creme, alignItems: 'center', justifyContent: 'center' }}
            >
              <IconeVoltar cor={palette.tinta} tamanho={20} />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: -64 }}>
            <Capa imageId={jogo?.cover_image_id} nome={jogo?.name} largura={104} />
            <View style={{ flex: 1, paddingTop: 72, gap: 4 }}>
              <Titulo style={{ fontSize: 26, lineHeight: 29 }}>{jogo?.name || (carregando ? ' ' : 'Jogo')}</Titulo>
              {meta ? <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>{meta}</Text> : null}
            </View>
          </View>

          {carregando && !jogo ? <ActivityIndicator color={cores.link} /> : null}
          <Aviso>{erro}</Aviso>

          {jogo ? (
            <>
              <Cartao style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 6 }}>
                <Estatistica valor={stats?.media ? String(stats.media).replace('.', ',') : '–'} rotulo="Média" cor={cores.destaque} />
                <Estatistica valor={stats?.registros ?? 0} rotulo="Registros" />
                <Estatistica valor={reviews.length} rotulo="Reviews" />
              </Cartao>

              <View style={{ gap: 8 }}>
                <Rotulo>Seu status</Rotulo>
                <Opcoes
                  rotulo="Seu status"
                  colunas={4}
                  opcoes={STATUS.map((s) => ({ valor: s.valor, rotulo: s.rotulo, descricao: s.longo }))}
                  valor={registro?.status}
                  onChange={(v) => v && mudarStatus(v)}
                />
              </View>

              {registro?.rating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Nota valor={registro.rating} />
                  <Texto>Sua nota{registro.platform ? ` · ${registro.platform}` : ''}</Texto>
                </View>
              ) : null}

              <Aviso>{aviso}</Aviso>

              <Botao
                titulo={registro ? 'Editar nota e review' : 'Avaliar e escrever review'}
                variante="destaque"
                onPress={() => router.push(`/registro/${gameId}`)}
              />
              <Botao titulo={favorito ? 'Tirar dos favoritos' : 'Adicionar aos favoritos'} onPress={favoritar} />

              {jogo.platforms?.length ? (
                <View style={{ gap: 8 }}>
                  <Rotulo>Plataformas</Rotulo>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {jogo.platforms.map((p) => <Chip key={p} texto={p} />)}
                  </View>
                </View>
              ) : null}

              {jogo.summary ? (
                <View style={{ gap: 8 }}>
                  <Rotulo>Resumo (em inglês, do IGDB)</Rotulo>
                  <Texto style={{ fontSize: 16 }}>{jogo.summary}</Texto>
                </View>
              ) : null}

              <View style={{ gap: 10 }}>
                <Rotulo>Reviews</Rotulo>
                {reviews.length === 0 ? <Texto suave>Ainda não há reviews deste jogo que você possa ver.</Texto> : null}
                {reviews.map((r) => (
                  <CartaoReview
                    key={r.user_id}
                    r={r}
                    jogo={jogo}
                    aoMudar={(nova, msg) =>
                      msg ? setAviso(msg) : setReviews((lista) => lista.map((x) => (x.user_id === nova.user_id ? nova : x)))
                    }
                  />
                ))}
              </View>
              <CreditoIGDB />
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
