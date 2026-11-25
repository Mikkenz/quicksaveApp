import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Aviso, Cartao, Tela, Texto } from '../components/ui';
import { Cabecalho } from '../components/Cabecalho';
import { BotaoPequeno } from '../components/social';
import { Etiqueta } from '../components/comunidades';
import { filaDeDenuncias, resolverDenuncia, rotuloMotivo } from '../lib/comunidades';
import { tempoRelativo } from '../lib/social';
import { useTheme } from '../theme';

const TIPO = {
  post: 'Tópico',
  reply: 'Resposta',
  community: 'Comunidade',
  comment: 'Comentário',
  review: 'Review',
  profile: 'Perfil',
};

const REMOVER = {
  post: 'Remover tópico',
  reply: 'Remover resposta',
  community: 'Esconder comunidade',
  comment: 'Apagar comentário',
  review: 'Tirar o texto da review',
  profile: 'Marcar como analisado',
};

function destino(d) {
  if (d.post_id) return `/topico/${d.post_id}`;
  if (d.event_id) return `/atividade/${d.event_id}`;
  if (d.game_id) return `/jogo/${d.game_id}`;
  if (d.profile_username) return `/u/${d.profile_username}`;
  if (d.target_type === 'community' && d.community_slug) return `/comunidade/${d.community_slug}`;
  return null;
}

function ItemDenuncia({ d, aoResolver }) {
  const { cores, fonts } = useTheme();
  const [confirmar, setConfirmar] = useState(null);
  const link = destino(d);

  function tocar(acao) {
    if (confirmar !== acao) return setConfirmar(acao);
    setConfirmar(null);
    aoResolver(d, acao);
  }

  return (
    <Cartao style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Etiqueta texto={TIPO[d.target_type] || d.target_type} destaque />
        <Etiqueta texto={`${d.total} ${d.total === 1 ? 'denúncia' : 'denúncias'}`} />
        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>{tempoRelativo(d.last_at)}</Text>
      </View>
      {d.community_name ? <Texto suave style={{ fontSize: 14 }}>em {d.community_name}</Texto> : null}
      {d.author_username ? <Texto style={{ fontSize: 15 }}>De @{d.author_username}</Texto> : null}
      {d.preview ? (
        <Text style={{ fontFamily: fonts.corpoItalico, fontSize: 15, lineHeight: 21, color: cores.texto }} numberOfLines={6}>
          “{d.preview.trim()}”
        </Text>
      ) : (
        <Texto suave style={{ fontSize: 14 }}>O conteúdo não existe mais.</Texto>
      )}
      <Texto style={{ fontSize: 14 }}>Motivos: {(d.reasons || []).map(rotuloMotivo).join(', ')}</Texto>
      {(d.details || []).map((t, i) => (
        <Texto key={i} suave style={{ fontSize: 14 }}>– {t}</Texto>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {link ? <BotaoPequeno titulo="Ver" onPress={() => router.push(link)} /> : null}
        <BotaoPequeno
          titulo={confirmar === 'remove' ? 'Confirmar' : REMOVER[d.target_type]}
          variante="destaque"
          onPress={() => tocar('remove')}
        />
        <BotaoPequeno titulo={confirmar === 'dismiss' ? 'Confirmar' : 'Está tudo certo'} onPress={() => tocar('dismiss')} />
      </View>
    </Cartao>
  );
}

export default function Denuncias() {
  const { cores } = useTheme();
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    setItens(await filaDeDenuncias());
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function resolver(d, acao) {
    setErro(null);
    const r = await resolverDenuncia(d.target_type, d.target_id, acao);
    if (r.erro) return setErro(r.erro);
    carregar();
  }

  return (
    <Tela>
      <Cabecalho titulo="Denúncias" />
      <Texto suave style={{ fontSize: 15 }}>
        "Está tudo certo" arquiva a denúncia e devolve o conteúdo, se ele tiver sido escondido. Quem denunciou não é mostrado.
      </Texto>
      <Aviso>{erro}</Aviso>
      {itens === null ? <ActivityIndicator color={cores.link} /> : null}
      {itens && itens.length === 0 ? <Texto suave>Nenhuma denúncia aberta.</Texto> : null}
      <View style={{ gap: 14 }}>
        {(itens || []).map((d) => (
          <ItemDenuncia key={`${d.target_type}-${d.target_id}`} d={d} aoResolver={resolver} />
        ))}
      </View>
    </Tela>
  );
}
