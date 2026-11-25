import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Aviso, Cartao, Rotulo, Texto } from './ui';
import { Capa, Nota, Opcoes } from './jogos';
import { ListaAtividades } from './social';
import { dataCurta, favoritosDe, meusRegistros, rotuloStatus } from '../lib/registros';
import { feedPessoa } from '../lib/social';
import { useFeed } from '../lib/useFeed';
import { ALVO_TOQUE, useTheme } from '../theme';

const ABAS = [
  { valor: 'atividade', rotulo: 'Atividade' },
  { valor: 'diario', rotulo: 'Diário' },
  { valor: 'reviews', rotulo: 'Reviews' },
  { valor: 'quero', rotulo: 'Quero jogar' },
];

/** Atividades da pessoa, com reações e comentários. */
function AtividadePessoa({ userId, meu }) {
  const [erro, setErro] = useState(null);
  const buscar = useCallback((antes) => feedPessoa(userId, antes), [userId]);
  const feed = useFeed(buscar);
  const { recarregar } = feed;

  useFocusEffect(
    useCallback(() => {
      if (userId) recarregar();
    }, [userId, recarregar])
  );

  return (
    <View style={{ gap: 14 }}>
      <Aviso>{erro}</Aviso>
      <ListaAtividades
        {...feed}
        aoErro={setErro}
        vazio={
          <Texto suave style={{ paddingVertical: 8 }}>
            {meu ? 'Quando você registrar jogos, suas atividades e as reações dos amigos aparecem aqui.' : 'Nenhuma atividade que você possa ver.'}
          </Texto>
        }
      />
    </View>
  );
}

function Numero({ valor, rotulo }) {
  const { cores, fonts } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: cores.texto }}>{valor}</Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: cores.textoSuave, textAlign: 'center' }}>{rotulo}</Text>
    </View>
  );
}

function LinhaRegistro({ r, aba, meu }) {
  const { cores, fonts } = useTheme();
  const horas = ['finished', 'dropped'].includes(r.status) && r.hours_played != null ? ` · ${r.hours_played} h` : '';
  return (
    <Pressable
      role="link"
      aria-label={`${r.games?.name}, ${rotuloStatus(r.status)}`}
      onPress={() => router.push(`/jogo/${r.game_id}`)}
      style={{ flexDirection: 'row', gap: 12, alignItems: aba === 'reviews' ? 'flex-start' : 'center', paddingVertical: 8, borderBottomWidth: 2, borderColor: cores.divisor, minHeight: ALVO_TOQUE }}
    >
      {aba === 'diario' ? (
        <Text style={{ width: 48, fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>{dataCurta(r.updated_at)}</Text>
      ) : null}
      <Capa imageId={r.games?.cover_image_id} nome={r.games?.name} largura={40} tamanho="t_cover_small" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 16, color: cores.texto }} numberOfLines={2}>{r.games?.name}</Text>
        {aba === 'reviews' ? (
          <Text style={{ fontFamily: fonts.corpoItalico, fontSize: 15, color: cores.texto }} numberOfLines={3}>“{r.review}”</Text>
        ) : (
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>
            {rotuloStatus(r.status)}{horas}{r.platform ? ` · ${r.platform}` : ''}{meu && r.visibility === 'public' ? ' · Todos' : ''}
          </Text>
        )}
      </View>
      <Nota valor={r.rating} tamanho={36} />
    </Pressable>
  );
}

/** Números, favoritos e listas de um perfil (o seu ou o de outra pessoa). O banco só devolve o que você pode ver. */
export function ConteudoPerfil({ userId, meu, children }) {
  const { cores, borda } = useTheme();
  const [registros, setRegistros] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [aba, setAba] = useState('diario');
  const [carregou, setCarregou] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      Promise.all([meusRegistros(userId, { limite: 500 }), favoritosDe(userId)]).then(([regs, favs]) => {
        setRegistros(regs);
        setFavoritos(favs);
        setCarregou(true);
      });
    }, [userId])
  );

  const ano = new Date().getFullYear();
  const numeros = useMemo(() => {
    const doAno = registros.filter((r) =>
      [r.started_at, r.finished_at, r.created_at].some((d) => d && String(d).startsWith(String(ano)))
    );
    return {
      ano: doAno.filter((r) => r.status !== 'wishlist').length,
      zerados: registros.filter((r) => r.status === 'finished').length,
      horas: doAno.reduce((soma, r) => soma + (['finished', 'dropped'].includes(r.status) ? r.hours_played || 0 : 0), 0),
      reviews: registros.filter((r) => r.review).length,
    };
  }, [registros, ano]);

  const lista = useMemo(() => {
    if (aba === 'reviews') return registros.filter((r) => r.review);
    if (aba === 'quero') return registros.filter((r) => r.status === 'wishlist');
    return registros.filter((r) => r.status !== 'wishlist');
  }, [registros, aba]);

  const vagas = [1, 2, 3, 4].map((p) => favoritos.find((f) => f.position === p));
  const divisor = <View style={{ width: 2, backgroundColor: cores.divisor }} />;

  return (
    <>
      <Cartao style={{ flexDirection: 'row', padding: 0 }}>
        <Numero valor={numeros.ano} rotulo={`Jogos ${ano}`} />
        {divisor}
        <Numero valor={numeros.zerados} rotulo="Zerados" />
        {divisor}
        <Numero valor={numeros.horas} rotulo={`Horas ${ano}`} />
        {divisor}
        <Numero valor={numeros.reviews} rotulo="Reviews" />
      </Cartao>

      {children}

      <View style={{ gap: 8 }}>
        <Rotulo>Favoritos</Rotulo>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {vagas.map((f, i) =>
            f ? (
              <Pressable key={i} role="link" aria-label={`Favorito: ${f.games?.name}`} onPress={() => router.push(`/jogo/${f.game_id}`)} style={{ flex: 1 }}>
                <Capa imageId={f.games?.cover_image_id} nome={f.games?.name} largura={76} style={{ width: '100%', height: undefined, aspectRatio: 3 / 4 }} />
              </Pressable>
            ) : (
              <View key={i} style={{ flex: 1, aspectRatio: 3 / 4, borderWidth: borda.largura, borderStyle: 'dashed', borderColor: cores.textoSuave, borderRadius: 10 }} />
            )
          )}
        </View>
        {meu && favoritos.length === 0 ? <Texto suave style={{ fontSize: 14 }}>Escolha até 4 favoritos na página de cada jogo.</Texto> : null}
      </View>

      <Opcoes rotulo="Lista do perfil" opcoes={ABAS} valor={aba} onChange={setAba} colunas={2} />
      {aba === 'atividade' ? (
        <AtividadePessoa userId={userId} meu={meu} />
      ) : (
      <View>
        {carregou && lista.length === 0 ? (
          <Texto suave style={{ paddingVertical: 8 }}>
            {aba === 'reviews'
              ? 'Nenhuma review ainda.'
              : aba === 'quero'
                ? 'Nenhum jogo na lista.'
                : meu
                  ? 'Nenhum jogo registrado ainda. Use a aba Buscar.'
                  : 'Nenhum jogo registrado que você possa ver.'}
          </Texto>
        ) : null}
        {lista.map((r) => <LinhaRegistro key={r.game_id} r={r} aba={aba} meu={meu} />)}
      </View>
      )}
    </>
  );
}
