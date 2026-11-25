import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Aviso, Botao, Cartao, Rotulo, Tela, Texto, Titulo } from '../../components/ui';
import { LinksTermos } from '../../components/LinksTermos';
import { Capa, Nota, Opcoes } from '../../components/jogos';
import { useAuth } from '../../lib/auth';
import { dataCurta, favoritosDe, meusRegistros, rotuloStatus } from '../../lib/registros';
import { ALVO_TOQUE, palette, useTheme } from '../../theme';

const ABAS = [
  { valor: 'diario', rotulo: 'Diário' },
  { valor: 'reviews', rotulo: 'Reviews' },
  { valor: 'quero', rotulo: 'Quero jogar' },
];

function Numero({ valor, rotulo }) {
  const { cores, fonts } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 24, color: cores.texto }}>{valor}</Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: cores.textoSuave }}>{rotulo}</Text>
    </View>
  );
}

function LinhaRegistro({ r, aba }) {
  const { cores, fonts } = useTheme();
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
            {rotuloStatus(r.status)}{r.platform ? ` · ${r.platform}` : ''}{r.visibility === 'public' ? ' · Todos' : ''}
          </Text>
        )}
      </View>
      <Nota valor={r.rating} tamanho={36} />
    </Pressable>
  );
}

export default function Perfil() {
  const { perfil, sessao, menorDeIdade, sair } = useAuth();
  const { cores, fonts, borda } = useTheme();
  const userId = sessao?.user?.id;
  const [registros, setRegistros] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [aba, setAba] = useState('diario');
  const [saindo, setSaindo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      meusRegistros(userId, { limite: 500 }).then(setRegistros);
      favoritosDe(userId).then(setFavoritos);
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
      reviews: registros.filter((r) => r.review).length,
    };
  }, [registros, ano]);

  const lista = useMemo(() => {
    if (aba === 'reviews') return registros.filter((r) => r.review);
    if (aba === 'quero') return registros.filter((r) => r.status === 'wishlist');
    return registros.filter((r) => r.status !== 'wishlist');
  }, [registros, aba]);

  const inicial = (perfil?.display_name || perfil?.username || '?').charAt(0).toUpperCase();
  const vagas = [1, 2, 3, 4].map((p) => favoritos.find((f) => f.position === p));

  return (
    <Tela>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: cores.borda, backgroundColor: palette.lilas, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          {perfil?.avatar_url ? (
            <Image source={{ uri: perfil.avatar_url }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ fontFamily: fonts.display, fontSize: 32, color: palette.tinta }}>{inicial}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Titulo style={{ fontSize: 28 }}>@{perfil?.username}</Titulo>
          {perfil?.bio || perfil?.display_name ? <Texto>{perfil?.bio || perfil?.display_name}</Texto> : null}
        </View>
      </View>
      <Botao titulo="Editar perfil" onPress={() => router.push('/editar-perfil')} />

      <Cartao style={{ flexDirection: 'row', padding: 0 }}>
        <Numero valor={numeros.ano} rotulo={`Jogos ${ano}`} />
        <View style={{ width: 2, backgroundColor: cores.divisor }} />
        <Numero valor={numeros.zerados} rotulo="Zerados" />
        <View style={{ width: 2, backgroundColor: cores.divisor }} />
        <Numero valor={numeros.reviews} rotulo="Reviews" />
      </Cartao>

      {menorDeIdade ? <Aviso tipo="info">Como você tem menos de 18 anos, seus registros ficam visíveis só para amigos.</Aviso> : null}

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
        {favoritos.length === 0 ? <Texto suave style={{ fontSize: 14 }}>Escolha até 4 favoritos na página de cada jogo.</Texto> : null}
      </View>

      <Opcoes rotulo="Lista do perfil" opcoes={ABAS} valor={aba} onChange={setAba} colunas={3} />
      <View>
        {lista.length === 0 ? (
          <Texto suave style={{ paddingVertical: 8 }}>
            {aba === 'reviews' ? 'Nenhuma review ainda.' : aba === 'quero' ? 'Nenhum jogo na lista.' : 'Nenhum jogo registrado ainda. Use a aba Buscar.'}
          </Texto>
        ) : null}
        {lista.map((r) => <LinhaRegistro key={r.game_id} r={r} aba={aba} />)}
      </View>

      <View style={{ height: 12 }} />
      <LinksTermos />
      <Botao
        titulo="Sair"
        onPress={async () => {
          setSaindo(true);
          await sair();
        }}
        carregando={saindo}
      />
    </Tela>
  );
}
