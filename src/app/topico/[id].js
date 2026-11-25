import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Aviso, Cartao, Rotulo, Tela, Texto, Titulo } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { Avatar, BotaoPequeno } from '../../components/social';
import { Acao, BotaoCurtir, Etiqueta } from '../../components/comunidades';
import { JogosAnexados, SeletorJogos } from '../../components/SeletorJogos';
import { Denunciar } from '../../components/Denunciar';
import { ConteudoSpoiler, MarcarSpoiler } from '../../components/Spoiler';
import {
  apagarResposta,
  apagarTopico,
  comunidade as buscarComunidade,
  participar,
  curtirResposta,
  curtirTopico,
  moderarResposta,
  moderarTopico,
  respostas as buscarRespostas,
  responder,
  rotuloTipo,
  topico as buscarTopico,
} from '../../lib/comunidades';
import { tempoRelativo } from '../../lib/social';
import { useTheme } from '../../theme';

function Autor({ username, avatar, quando, editado }) {
  const { cores, fonts } = useTheme();
  return (
    <Pressable role="link" aria-label={`Perfil de @${username}`} onPress={() => router.push(`/u/${username}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
      <Avatar url={avatar} nome={username} tamanho={30} />
      <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 14, color: cores.texto }}>@{username}</Text> · {tempoRelativo(quando)}
        {editado ? ' · editado' : ''}
      </Text>
    </Pressable>
  );
}

function AvisoRemovido({ porAutor, escondido }) {
  return (
    <Texto suave style={{ fontSize: 15, fontStyle: 'italic' }}>
      {escondido ? 'Escondido após denúncias, aguardando a moderação.' : porAutor ? 'Removido pelo autor.' : 'Removido pela moderação.'}
    </Texto>
  );
}

function Resposta({ r, podeModerar, aoMudar, aoErro }) {
  const { cores, fonts } = useTheme();
  const [confirmar, setConfirmar] = useState(null);
  const fora = r.removed || r.hidden;

  async function executar(chave, promessa) {
    if (confirmar !== chave) return setConfirmar(chave);
    setConfirmar(null);
    const res = await promessa();
    if (res.erro) return aoErro(res.erro);
    aoMudar();
  }

  return (
    <View style={{ gap: 6, paddingVertical: 10, borderBottomWidth: 2, borderColor: cores.divisor }}>
      <Autor username={r.username} avatar={r.avatar_url} quando={r.created_at} editado={r.edited} />
      {fora && !podeModerar ? (
        <AvisoRemovido porAutor={r.removed_by_author} escondido={r.hidden && !r.removed} />
      ) : (
        <>
          {fora ? <AvisoRemovido porAutor={r.removed_by_author} escondido={r.hidden && !r.removed} /> : null}
          <ConteudoSpoiler spoiler={r.has_spoilers} aberto={r.is_author}>
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: fonts.corpo, fontSize: 16, lineHeight: 23, color: cores.texto, opacity: fora ? 0.6 : 1 }}>{r.body}</Text>
              <JogosAnexados jogos={r.games} largura={48} />
            </View>
          </ConteudoSpoiler>
        </>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
        {fora ? null : (
          <BotaoCurtir
            curtido={r.liked}
            total={r.like_count}
            rotulo="Curtir resposta"
            aoTocar={async () => {
              const res = await curtirResposta(r.id);
              if (res.erro) aoErro(res.erro);
              else aoMudar();
            }}
          />
        )}
        {r.is_author && !r.removed ? (
          <Acao titulo={confirmar === 'apagar' ? 'Confirmar' : 'Apagar'} perigo onPress={() => executar('apagar', () => apagarResposta(r.id))} />
        ) : null}
        {podeModerar && !r.is_author ? (
          fora ? (
            <Acao titulo={confirmar === 'restaurar' ? 'Confirmar' : 'Restaurar'} onPress={() => executar('restaurar', () => moderarResposta(r.id, 'restore'))} />
          ) : (
            <Acao titulo={confirmar === 'remover' ? 'Confirmar' : 'Remover'} perigo onPress={() => executar('remover', () => moderarResposta(r.id, 'remove'))} />
          )
        ) : null}
        {!r.is_author && !fora ? <Denunciar tipo="reply" alvo={r.id} descricao="esta resposta" compacto /> : null}
      </View>
    </View>
  );
}

export default function PaginaTopico() {
  const { id } = useLocalSearchParams();
  const topicoId = Number(id);
  const { cores, fonts, borda } = useTheme();
  const [t, setT] = useState(undefined);
  const [lista, setLista] = useState([]);
  const [texto, setTexto] = useState('');
  const [jogos, setJogos] = useState([]);
  const [anexar, setAnexar] = useState(false);
  const [spoiler, setSpoiler] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [erro, setErro] = useState(null);
  const [com, setCom] = useState(null); // comunidade do tópico (para saber se você participa)
  const [verRegras, setVerRegras] = useState(false);
  const [entrando, setEntrando] = useState(false);

  const carregar = useCallback(async () => {
    if (!Number.isInteger(topicoId)) return setT(null);
    const [top, resp] = await Promise.all([buscarTopico(topicoId), buscarRespostas(topicoId)]);
    setT(top);
    setLista(resp);
    if (top) buscarComunidade(top.community_slug).then(setCom);
  }, [topicoId]);

  async function entrarNaComunidade() {
    // Com regras, mostra antes; o segundo toque confirma
    if (com.rules && !verRegras) return setVerRegras(true);
    setErro(null);
    setEntrando(true);
    const r = await participar(com.id);
    setEntrando(false);
    if (r.erro) return setErro(r.erro);
    setVerRegras(false);
    carregar();
  }

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function enviar() {
    if (!texto.trim() || enviando) return;
    setErro(null);
    setEnviando(true);
    const r = await responder(topicoId, texto.trim(), jogos.map((j) => j.id), spoiler);
    setEnviando(false);
    if (r.erro) return setErro(r.erro);
    setTexto('');
    setSpoiler(false);
    setJogos([]);
    setAnexar(false);
    carregar();
  }

  async function moderar(acao, chave) {
    if (chave && confirmar !== chave) return setConfirmar(chave);
    setConfirmar(null);
    setErro(null);
    const r = acao === 'apagar' ? await apagarTopico(topicoId) : await moderarTopico(topicoId, acao);
    if (r.erro) return setErro(r.erro);
    carregar();
  }

  if (t === undefined) {
    return (
      <Tela>
        <Cabecalho titulo="Tópico" />
        <ActivityIndicator color={cores.link} />
      </Tela>
    );
  }
  if (!t) {
    return (
      <Tela>
        <Cabecalho titulo="Tópico" />
        <Texto suave>Este tópico não existe mais ou não está disponível.</Texto>
      </Tela>
    );
  }

  const fora = t.removed || t.hidden;

  return (
    <Tela>
      <Cabecalho titulo={t.community_name} />
      <Pressable role="link" onPress={() => router.push(`/comunidade/${t.community_slug}`)} style={{ minHeight: 44, justifyContent: 'center', marginTop: -12 }}>
        <Text style={{ fontFamily: fonts.monoMedia, fontSize: 12, color: cores.link }}>VER A COMUNIDADE</Text>
      </Pressable>

      <Cartao style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Etiqueta texto={rotuloTipo(t.kind)} destaque={t.kind === 'indicacao'} />
          {t.pinned ? <Etiqueta texto="Fixado" /> : null}
          {t.locked ? <Etiqueta texto="Trancado" /> : null}
        </View>
        <Titulo nivel={2}>{t.title}</Titulo>
        <Autor username={t.username} avatar={t.avatar_url} quando={t.created_at} editado={t.edited} />
        {fora ? <AvisoRemovido porAutor={t.removed_by_author} escondido={t.hidden && !t.removed} /> : null}
        <ConteudoSpoiler spoiler={t.has_spoilers} aberto={t.is_author}>
          <View style={{ gap: 10 }}>
            {t.body ? <Text style={{ fontFamily: fonts.corpo, fontSize: 17, lineHeight: 25, color: cores.texto, opacity: fora ? 0.6 : 1 }}>{t.body}</Text> : null}
            <JogosAnexados jogos={t.games} largura={72} />
          </View>
        </ConteudoSpoiler>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
          {fora ? null : (
            <BotaoCurtir
              curtido={t.liked}
              total={t.like_count}
              rotulo="Curtir tópico"
              aoTocar={async () => {
                const r = await curtirTopico(t.id);
                if (r.erro) setErro(r.erro);
                else carregar();
              }}
            />
          )}
          {t.is_author && !t.removed ? (
            <>
              <Acao titulo="Editar" onPress={() => router.push(`/topico/novo?editar=${t.id}`)} />
              <Acao titulo={confirmar === 'apagar' ? 'Confirmar' : 'Apagar'} perigo onPress={() => moderar('apagar', 'apagar')} />
            </>
          ) : null}
          {!t.is_author && !fora ? <Denunciar tipo="post" alvo={t.id} descricao="este tópico" compacto /> : null}
        </View>
      </Cartao>

      {com && !com.my_role && !com.banned && !fora ? (
        <View style={{ gap: 10, borderWidth: borda.largura, borderColor: cores.borda, borderRadius: borda.raioCartao, borderStyle: 'dashed', padding: 14 }}>
          <Texto style={{ fontSize: 16 }}>
            Você ainda não participa de <Text style={{ fontFamily: fonts.corpoForte }}>{com.name}</Text>. Participe para responder e ver os tópicos novos na aba Comunidades.
          </Texto>
          {verRegras && com.rules ? (
            <View style={{ gap: 4 }}>
              <Rotulo>Regras</Rotulo>
              <Texto style={{ fontSize: 15 }}>{com.rules}</Texto>
            </View>
          ) : null}
          <BotaoPequeno
            titulo={entrando ? 'Entrando...' : verRegras && com.rules ? 'Aceito as regras, participar' : 'Participar da comunidade'}
            variante="primario"
            onPress={entrarNaComunidade}
            desabilitado={entrando}
          />
        </View>
      ) : null}

      {t.can_moderate ? (
        <View style={{ gap: 6 }}>
          <Rotulo>Moderação</Rotulo>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <BotaoPequeno titulo={t.pinned ? 'Desafixar' : 'Fixar'} onPress={() => moderar(t.pinned ? 'unpin' : 'pin')} />
            <BotaoPequeno titulo={t.locked ? 'Destrancar' : 'Trancar'} onPress={() => moderar(t.locked ? 'unlock' : 'lock')} />
            {fora ? (
              <BotaoPequeno titulo={confirmar === 'restore' ? 'Confirmar' : 'Restaurar'} onPress={() => moderar('restore', 'restore')} />
            ) : (
              <BotaoPequeno titulo={confirmar === 'remove' ? 'Confirmar remoção' : 'Remover'} variante="destaque" onPress={() => moderar('remove', 'remove')} />
            )}
          </View>
        </View>
      ) : null}

      <Aviso>{erro}</Aviso>

      <Rotulo>Respostas ({lista.length})</Rotulo>
      {lista.length === 0 ? <Texto suave style={{ fontSize: 15 }}>Ninguém respondeu ainda.</Texto> : null}
      <View>
        {lista.map((r) => (
          <Resposta key={r.id} r={r} podeModerar={t.can_moderate} aoMudar={carregar} aoErro={setErro} />
        ))}
      </View>

      {t.can_reply ? (
        <View style={{ gap: 8 }}>
          <TextInput
            aria-label="Escrever resposta"
            placeholder="Escreva uma resposta"
            placeholderTextColor={cores.textoSuave}
            value={texto}
            onChangeText={setTexto}
            maxLength={3000}
            multiline
            style={{ minHeight: 90, textAlignVertical: 'top', borderWidth: borda.largura, borderColor: cores.borda, borderRadius: 12, backgroundColor: cores.superficie, padding: 12, fontFamily: fonts.corpo, fontSize: 16, color: cores.texto }}
          />
          <MarcarSpoiler valor={spoiler} onChange={setSpoiler} />
          {anexar ? <SeletorJogos valor={jogos} onChange={setJogos} maximo={3} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BotaoPequeno titulo={anexar ? 'Fechar jogos' : 'Anexar jogo'} onPress={() => setAnexar(!anexar)} />
            <View style={{ flex: 1 }} />
            <BotaoPequeno titulo={enviando ? 'Enviando...' : 'Responder'} variante="primario" onPress={enviar} desabilitado={!texto.trim() || enviando} />
          </View>
        </View>
      ) : t.locked ? (
        <Texto suave style={{ fontSize: 15 }}>Este tópico foi trancado pela moderação.</Texto>
      ) : fora || (com && !com.my_role) ? null : (
        <Texto suave style={{ fontSize: 15 }}>Responder fica liberado a partir dos 18 anos.</Texto>
      )}
    </Tela>
  );
}
