import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Cartao } from './ui';
import { Capa, Chip, Nota } from './jogos';
import { IconeComentario, IconeCoracao, IconeMarcador, IconeTrofeu } from './icons';
import {
  REACOES,
  curtirReview,
  desbloquear,
  desfazerAmizade,
  enviarPedido,
  reagir,
  responderPedido,
  tempoRelativo,
  textoHoras,
  verboAtividade,
} from '../lib/social';
import { atualizarContagens } from '../lib/contagens';
import { useAuth } from '../lib/auth';
import { Denunciar } from './Denunciar';
import { ConteudoSpoiler } from './Spoiler';
import { ALVO_TOQUE, palette, sombra, useTheme } from '../theme';

/** Foto redonda; sem foto, a inicial sobre lilás. */
export function Avatar({ url, nome, tamanho = 40 }) {
  const { cores, fonts } = useTheme();
  const inicial = (nome || '?').replace('@', '').charAt(0).toUpperCase();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        borderWidth: tamanho > 50 ? 3 : 2,
        borderColor: cores.borda,
        backgroundColor: palette.lilas,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text style={{ fontFamily: fonts.display, fontSize: tamanho * 0.42, color: palette.tinta }}>{inicial}</Text>
      )}
    </View>
  );
}

/** Bolinha vermelha com número (avisos). */
export function Selo({ valor, style }) {
  const { cores, fonts } = useTheme();
  if (!valor) return null;
  return (
    <View
      style={[
        { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: cores.destaque, borderWidth: 2, borderColor: cores.borda, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.monoMedia, fontSize: 11, color: cores.textoNoDestaque }}>{valor > 99 ? '99+' : valor}</Text>
    </View>
  );
}

/** Botão compacto (44px de altura) para ações dentro de listas. */
export function BotaoPequeno({ titulo, onPress, variante = 'neutro', desabilitado, accessibilityLabel }) {
  const { cores, fonts } = useTheme();
  const fundo = variante === 'primario' ? cores.primario : variante === 'destaque' ? cores.destaque : cores.superficie;
  const cor = variante === 'primario' ? cores.textoNoPrimario : variante === 'destaque' ? cores.textoNoDestaque : cores.texto;
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel}
      aria-disabled={!!desabilitado}
      disabled={desabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        { minHeight: ALVO_TOQUE, paddingHorizontal: 12, borderWidth: 3, borderColor: cores.borda, borderRadius: 10, backgroundColor: fundo, alignItems: 'center', justifyContent: 'center', opacity: desabilitado ? 0.6 : 1 },
        pressed ? null : sombra(cores, 2),
      ]}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: 14, color: cor }}>{titulo}</Text>
    </Pressable>
  );
}

/**
 * Botão que muda conforme a relação: Adicionar, Cancelar pedido, Aceitar, Amigos ou Desbloquear.
 * aoMudar(novaRelacao) ou aoMudar(null, mensagemDeErro).
 */
export function BotaoRelacao({ pessoa, relacao, aoMudar }) {
  const [enviando, setEnviando] = useState(false);
  const nome = `@${pessoa.username}`;

  async function executar(acao, novaPadrao) {
    setEnviando(true);
    const r = await acao();
    setEnviando(false);
    if (r.erro) return aoMudar?.(null, r.erro);
    atualizarContagens();
    aoMudar?.(typeof r.dados === 'string' ? r.dados : novaPadrao);
  }

  if (relacao === 'self') return null;
  if (relacao === 'friends') return <BotaoPequeno titulo="Amigos" desabilitado accessibilityLabel={`Você e ${nome} são amigos`} />;
  if (relacao === 'sent') {
    return (
      <BotaoPequeno titulo="Cancelar pedido" accessibilityLabel={`Cancelar pedido para ${nome}`} desabilitado={enviando}
        onPress={() => executar(() => desfazerAmizade(pessoa.id), 'none')} />
    );
  }
  if (relacao === 'received') {
    return (
      <BotaoPequeno titulo="Aceitar" variante="primario" accessibilityLabel={`Aceitar pedido de ${nome}`} desabilitado={enviando}
        onPress={() => executar(() => responderPedido(pessoa.id, true), 'friends')} />
    );
  }
  if (relacao === 'blocked') {
    return (
      <BotaoPequeno titulo="Desbloquear" accessibilityLabel={`Desbloquear ${nome}`} desabilitado={enviando}
        onPress={() => executar(() => desbloquear(pessoa.id), 'none')} />
    );
  }
  return (
    <BotaoPequeno titulo="Adicionar" variante="primario" accessibilityLabel={`Adicionar ${nome} como amigo`} desabilitado={enviando}
      onPress={() => executar(() => enviarPedido(pessoa.id), 'sent')} />
  );
}

/** Linha de pessoa: foto, nome e @, com ações à direita. */
export function LinhaPessoa({ pessoa, subtitulo, children, aoTocar }) {
  const { cores, fonts } = useTheme();
  const abrir = aoTocar || (() => router.push(`/u/${pessoa.username}`));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 2, borderColor: cores.divisor }}>
      <Pressable role="link" aria-label={`Perfil de @${pessoa.username}`} onPress={abrir} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: ALVO_TOQUE }}>
        <Avatar url={pessoa.avatar_url} nome={pessoa.display_name || pessoa.username} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 16, color: cores.texto }} numberOfLines={1}>
            {pessoa.display_name || `@${pessoa.username}`}
          </Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }} numberOfLines={1}>
            {subtitulo || `@${pessoa.username}`}
          </Text>
        </View>
      </Pressable>
      {children}
    </View>
  );
}

function TextoReview({ texto, spoiler, linhas, aberto }) {
  const { cores, fonts } = useTheme();
  if (!texto) return null;
  return (
    <ConteudoSpoiler spoiler={spoiler} aberto={aberto}>
      <Text style={{ fontFamily: fonts.corpoItalico, fontSize: 16, lineHeight: 23, color: cores.texto }} numberOfLines={linhas}>
        “{texto}”
      </Text>
    </ConteudoSpoiler>
  );
}

const ICONES_REACAO = { curti: IconeCoracao, quero: IconeMarcador, gg: IconeTrofeu };

/** Botões de reação (Curti, Quero jogar, GG) e o link de comentários. */
function BarraReacoes({ item, aoMudar, comComentarios = true }) {
  const { cores, fonts } = useTheme();
  const [enviando, setEnviando] = useState(false);

  async function tocar(tipo) {
    if (enviando) return;
    setEnviando(true);
    const antes = item.my_reaction;
    const r = await reagir(item.event_id, tipo);
    setEnviando(false);
    if (r.erro) {
      aoMudar?.(item, r.erro);
      return;
    }
    const nova = r.dados || null;
    const contagem = { ...(item.reactions || {}) };
    if (antes) contagem[antes] = Math.max(0, (contagem[antes] || 1) - 1);
    if (nova) contagem[nova] = (contagem[nova] || 0) + 1;
    aoMudar?.({ ...item, my_reaction: nova, reactions: contagem });
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {REACOES.map((r) => {
        const Icone = ICONES_REACAO[r.valor];
        const ativo = item.my_reaction === r.valor;
        const n = item.reactions?.[r.valor] || 0;
        return (
          <Pressable
            key={r.valor}
            role="button"
            aria-pressed={ativo}
            aria-label={`${r.rotulo}${n ? `, ${n}` : ''}`}
            onPress={() => tocar(r.valor)}
            style={{
              minHeight: ALVO_TOQUE,
              minWidth: ALVO_TOQUE,
              paddingHorizontal: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              borderWidth: 2,
              borderColor: cores.borda,
              borderRadius: 22,
              backgroundColor: ativo ? cores.primario : cores.superficie,
            }}
          >
            <Icone cor={ativo ? cores.textoNoPrimario : cores.texto} tamanho={18} />
            <Text style={{ fontFamily: fonts.monoMedia, fontSize: 12, color: ativo ? cores.textoNoPrimario : cores.texto }}>
              {r.valor === 'gg' ? 'GG' : r.rotulo}{n ? ` ${n}` : ''}
            </Text>
          </Pressable>
        );
      })}
      {comComentarios ? (
        <Pressable
          role="link"
          aria-label={`Comentários${item.comments ? `, ${item.comments}` : ''}`}
          onPress={() => router.push(`/atividade/${item.event_id}`)}
          style={{ minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }}
        >
          <IconeComentario cor={cores.texto} tamanho={18} />
          <Text style={{ fontFamily: fonts.monoMedia, fontSize: 12, color: cores.texto }}>{item.comments || 'Comentar'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Cartão de uma atividade do feed: "@ana zerou Hades em 38 h". */
export function CartaoAtividade({ item, aoMudar, comComentarios = true, reviewCompleta }) {
  const { cores, fonts } = useTheme();
  const meuId = useAuth().sessao?.user?.id;
  const horas = textoHoras(item.hours_played, item.type);
  const meta = [horas, item.platform, tempoRelativo(item.created_at)].filter(Boolean).join(' · ');
  return (
    <Cartao style={{ gap: 10, padding: 14 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable role="link" aria-label={`Abrir ${item.game_name}`} onPress={() => router.push(`/jogo/${item.game_id}`)}>
          <Capa imageId={item.cover_image_id} nome={item.game_name} largura={52} tamanho="t_cover_small" />
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: fonts.corpo, fontSize: 16, lineHeight: 22, color: cores.texto }}>
            <Text role="link" onPress={() => router.push(`/u/${item.username}`)} style={{ fontFamily: fonts.display, color: cores.link }}>
              @{item.username}
            </Text>
            {` ${verboAtividade(item.type)} `}
            <Text role="link" onPress={() => router.push(`/jogo/${item.game_id}`)} style={{ fontFamily: fonts.display }}>
              {item.game_name}
            </Text>
          </Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>{meta}</Text>
        </View>
        <Nota valor={item.rating} tamanho={38} />
      </View>
      <TextoReview texto={item.review} spoiler={item.has_spoilers} aberto={item.user_id === meuId} linhas={reviewCompleta ? undefined : 5} />
      <BarraReacoes item={item} aoMudar={aoMudar} comComentarios={comComentarios} />
    </Cartao>
  );
}

/** Review com curtida (página do jogo e Popular). Com "jogo", mostra a capa e o nome. */
export function CartaoReview({ r, jogo, aoMudar }) {
  const { cores, fonts } = useTheme();
  const meuId = useAuth().sessao?.user?.id;
  const [enviando, setEnviando] = useState(false);
  const horas = textoHoras(r.hours_played, 'finished');

  async function curtir() {
    if (enviando) return;
    setEnviando(true);
    const res = await curtirReview(r.user_id, r.game_id ?? jogo?.igdb_id);
    setEnviando(false);
    if (res.erro) {
      aoMudar?.(r, res.erro);
      return;
    }
    aoMudar?.({ ...r, liked: res.dados, likes: Math.max(0, (r.likes || 0) + (res.dados ? 1 : -1)) });
  }

  return (
    <Cartao style={{ gap: 8, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {r.game_name ? (
          <Pressable role="link" aria-label={`Abrir ${r.game_name}`} onPress={() => router.push(`/jogo/${r.game_id}`)}>
            <Capa imageId={r.cover_image_id} nome={r.game_name} largura={40} tamanho="t_cover_small" />
          </Pressable>
        ) : (
          <Avatar url={r.avatar_url} nome={r.display_name || r.username} tamanho={36} />
        )}
        <View style={{ flex: 1 }}>
          {r.game_name ? (
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: cores.texto }} numberOfLines={1}>{r.game_name}</Text>
          ) : null}
          <Pressable role="link" onPress={() => router.push(`/u/${r.username}`)} style={{ minHeight: 28, justifyContent: 'center' }}>
            <Text style={{ fontFamily: r.game_name ? fonts.mono : fonts.display, fontSize: r.game_name ? 13 : 16, color: r.game_name ? cores.textoSuave : cores.texto }}>
              @{r.username}
            </Text>
          </Pressable>
        </View>
        {r.is_friend ? <Chip texto="Amigo" /> : null}
        {r.platform ? <Chip texto={r.platform} /> : null}
        <Nota valor={r.rating} tamanho={36} />
      </View>
      <TextoReview texto={r.review} spoiler={r.has_spoilers} aberto={r.user_id === meuId} linhas={r.game_name ? 6 : undefined} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          role="button"
          aria-pressed={!!r.liked}
          aria-label={`Curtir review${r.likes ? `, ${r.likes} curtidas` : ''}`}
          onPress={curtir}
          style={{ minHeight: ALVO_TOQUE, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: cores.borda, borderRadius: 22, backgroundColor: r.liked ? cores.destaque : cores.superficie }}
        >
          <IconeCoracao cor={r.liked ? cores.textoNoDestaque : cores.texto} tamanho={18} />
          <Text style={{ fontFamily: fonts.monoMedia, fontSize: 12, color: r.liked ? cores.textoNoDestaque : cores.texto }}>{r.likes || 0}</Text>
        </Pressable>
        {horas ? <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>Zerou {horas}</Text> : null}
        {r.user_id !== meuId ? (
          <Denunciar tipo="review" alvo={`${r.user_id}:${r.game_id ?? jogo?.igdb_id}`} descricao={`a review de @${r.username}`} compacto />
        ) : null}
        <Text style={{ flex: 1, textAlign: 'right', fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>{tempoRelativo(r.updated_at)}</Text>
      </View>
    </Cartao>
  );
}

/** Lista de atividades com "Carregar mais". */
export function ListaAtividades({ itens, setItens, carregarMais, temMais, carregando, carregou = true, vazio, aoErro }) {
  const { cores } = useTheme();
  function trocar(novo, erro) {
    if (erro) {
      aoErro?.(erro);
      return;
    }
    setItens((lista) => lista.map((i) => (i.event_id === novo.event_id ? novo : i)));
  }
  return (
    <View style={{ gap: 14 }}>
      {carregou && !carregando && itens.length === 0 ? vazio : null}
      {itens.map((i) => <CartaoAtividade key={i.event_id} item={i} aoMudar={trocar} />)}
      {temMais ? <BotaoPequeno titulo="Carregar mais" onPress={carregarMais} desabilitado={carregando} /> : null}
      {carregando ? <Text style={{ textAlign: 'center', color: cores.textoSuave }}>Carregando...</Text> : null}
    </View>
  );
}
