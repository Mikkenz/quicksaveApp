import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Aviso, Rotulo, Tela, Texto } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { Avatar, BotaoPequeno, CartaoAtividade } from '../../components/social';
import { Denunciar } from '../../components/Denunciar';
import { ConteudoSpoiler, MarcarSpoiler } from '../../components/Spoiler';
import { useAuth } from '../../lib/auth';
import { apagarComentario, atividade, comentar, comentarios, tempoRelativo } from '../../lib/social';
import { ALVO_TOQUE, useTheme } from '../../theme';

function Comentario({ c, aoApagar }) {
  const { cores, fonts } = useTheme();
  const meuId = useAuth().sessao?.user?.id;
  const [confirmar, setConfirmar] = useState(false);
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 2, borderColor: cores.divisor }}>
      <Pressable role="link" aria-label={`Perfil de @${c.username}`} onPress={() => router.push(`/u/${c.username}`)}>
        <Avatar url={c.avatar_url} nome={c.username} tamanho={36} />
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 14, color: cores.texto }}>@{c.username}</Text> · {tempoRelativo(c.created_at)}
        </Text>
        <ConteudoSpoiler spoiler={c.has_spoilers} aberto={c.user_id === meuId}>
          <Text style={{ fontFamily: fonts.corpo, fontSize: 16, lineHeight: 22, color: cores.texto }}>{c.body}</Text>
        </ConteudoSpoiler>
      </View>
      {c.can_delete ? (
        <Pressable
          role="button"
          aria-label={confirmar ? 'Confirmar: apagar comentário' : 'Apagar comentário'}
          onPress={() => (confirmar ? aoApagar(c.id) : setConfirmar(true))}
          style={{ minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: 4 }}
        >
          <Text style={{ fontFamily: fonts.monoMedia, fontSize: 12, color: confirmar ? cores.erro : cores.textoSuave }}>
            {confirmar ? 'Apagar?' : 'Apagar'}
          </Text>
        </Pressable>
      ) : null}
      {c.user_id !== meuId ? <Denunciar tipo="comment" alvo={c.id} descricao={`o comentário de @${c.username}`} compacto /> : null}
    </View>
  );
}

export default function Atividade() {
  const { id } = useLocalSearchParams();
  const eventId = Number(id);
  const { precisaAutorizacao } = useAuth();
  const { cores, fonts, borda } = useTheme();
  const [item, setItem] = useState(undefined);
  const [lista, setLista] = useState([]);
  const [texto, setTexto] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    if (!Number.isInteger(eventId)) return setItem(null);
    const [a, c] = await Promise.all([atividade(eventId), comentarios(eventId)]);
    setItem(a);
    setLista(c);
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function enviar() {
    const corpo = texto.trim();
    if (!corpo || enviando) return;
    setErro(null);
    setEnviando(true);
    const r = await comentar(eventId, corpo, spoiler);
    setEnviando(false);
    if (r.erro) return setErro(r.erro);
    setTexto('');
    setSpoiler(false);
    carregar();
  }

  async function apagar(comentarioId) {
    const r = await apagarComentario(comentarioId);
    if (r.erro) setErro(r.erro);
    carregar();
  }

  if (item === undefined) {
    return (
      <Tela>
        <Cabecalho titulo="Atividade" />
        <ActivityIndicator color={cores.link} />
      </Tela>
    );
  }

  if (!item) {
    return (
      <Tela>
        <Cabecalho titulo="Atividade" />
        <Texto suave>Essa atividade não existe mais ou não está visível para você.</Texto>
      </Tela>
    );
  }

  return (
    <Tela>
      <Cabecalho titulo="Atividade" />
      <CartaoAtividade item={item} reviewCompleta comComentarios={false} aoMudar={(novo, e) => (e ? setErro(e) : setItem(novo))} />

      <Rotulo>Comentários ({lista.length})</Rotulo>
      {lista.length === 0 ? <Texto suave style={{ fontSize: 15 }}>Ninguém comentou ainda.</Texto> : null}
      <View>
        {lista.map((c) => <Comentario key={c.id} c={c} aoApagar={apagar} />)}
      </View>

      <Aviso>{erro}</Aviso>
      {precisaAutorizacao ? null : (
        <View style={{ gap: 8 }}>
          <TextInput
            aria-label="Escrever comentário"
            placeholder="Escreva um comentário"
            placeholderTextColor={cores.textoSuave}
            value={texto}
            onChangeText={setTexto}
            maxLength={500}
            multiline
            style={{
              minHeight: 70,
              textAlignVertical: 'top',
              borderWidth: borda.largura,
              borderColor: cores.borda,
              borderRadius: 12,
              backgroundColor: cores.superficie,
              padding: 12,
              fontFamily: fonts.corpo,
              fontSize: 16,
              color: cores.texto,
            }}
          />
          <MarcarSpoiler valor={spoiler} onChange={setSpoiler} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>{texto.length}/500</Text>
            <BotaoPequeno titulo={enviando ? 'Enviando...' : 'Comentar'} variante="primario" onPress={enviar} desabilitado={!texto.trim() || enviando} />
          </View>
        </View>
      )}
    </Tela>
  );
}
