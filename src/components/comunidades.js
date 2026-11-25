import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Cartao } from './ui';
import { Avatar, Selo } from './social';
import { JogosAnexados } from './SeletorJogos';
import { IconeComentario, IconeComunidades, IconeCoracao } from './icons';
import { rotuloTipo } from '../lib/comunidades';
import { tempoRelativo } from '../lib/social';
import { ALVO_TOQUE, useTheme } from '../theme';

/** Linha de comunidade (lista, busca e em alta). */
export function LinhaComunidade({ c, detalhe }) {
  const { cores, fonts, borda } = useTheme();
  const membros = `${c.members} ${c.members === 1 ? 'membro' : 'membros'}`;
  return (
    <Pressable
      role="link"
      aria-label={`Comunidade ${c.name}, ${membros}${c.new_posts ? `, ${c.new_posts} tópicos novos` : ''}`}
      onPress={() => router.push(`/comunidade/${c.slug}`)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: ALVO_TOQUE, borderBottomWidth: 2, borderColor: cores.divisor }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, borderWidth: borda.largura, borderColor: cores.borda, backgroundColor: cores.destaque, alignItems: 'center', justifyContent: 'center' }}>
        <IconeComunidades cor={cores.textoNoDestaque} tamanho={22} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 16, color: cores.texto }} numberOfLines={1}>{c.name}</Text>
        {c.description ? (
          <Text style={{ fontFamily: fonts.corpo, fontSize: 14, color: cores.textoSuave }} numberOfLines={1}>{c.description}</Text>
        ) : null}
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: cores.textoSuave }}>
          {membros}{detalhe ? ` · ${detalhe}` : ''}
        </Text>
      </View>
      <Selo valor={c.new_posts} />
    </Pressable>
  );
}

/** Cartão de tópico na lista da comunidade. */
export function CartaoTopico({ t }) {
  const { cores, fonts } = useTheme();
  const marcas = [t.has_spoilers ? 'Spoiler' : null, t.pinned ? 'Fixado' : null, t.locked ? 'Trancado' : null, t.removed ? 'Removido' : null, t.hidden ? 'Escondido por denúncias' : null].filter(Boolean);
  return (
    <Pressable role="link" aria-label={`Tópico: ${t.title}`} onPress={() => router.push(`/topico/${t.id}`)}>
      <Cartao style={{ gap: 8, padding: 14, opacity: t.removed || t.hidden ? 0.7 : 1 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <Etiqueta texto={rotuloTipo(t.kind)} destaque={t.kind === 'indicacao'} />
          {marcas.map((m) => <Etiqueta key={m} texto={m} />)}
          {t.community_name ? (
            <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }} numberOfLines={1}>em {t.community_name}</Text>
          ) : null}
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: cores.texto }}>{t.title}</Text>
        {t.has_spoilers ? (
          <Text style={{ fontFamily: fonts.monoMedia, fontSize: 12, color: cores.textoSuave }}>Pode conter spoilers. Abra o tópico para ler.</Text>
        ) : (
          <>
            {t.excerpt ? (
              <Text style={{ fontFamily: fonts.corpo, fontSize: 15, lineHeight: 21, color: cores.texto }} numberOfLines={3}>{t.excerpt}</Text>
            ) : null}
            <JogosAnexados jogos={t.games} largura={48} />
          </>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Avatar url={t.avatar_url} nome={t.username} tamanho={24} />
          <Text style={{ flex: 1, fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }} numberOfLines={1}>
            @{t.username} · {tempoRelativo(t.last_activity_at)}
          </Text>
          <IconeCoracao cor={cores.textoSuave} tamanho={15} />
          <Text style={{ fontFamily: fonts.monoMedia, fontSize: 12, color: cores.textoSuave }}>{t.like_count}</Text>
          <IconeComentario cor={cores.textoSuave} tamanho={15} />
          <Text style={{ fontFamily: fonts.monoMedia, fontSize: 12, color: cores.textoSuave }}>{t.reply_count}</Text>
        </View>
      </Cartao>
    </Pressable>
  );
}

export function Etiqueta({ texto, destaque }) {
  const { cores, fonts } = useTheme();
  return (
    <View style={{ borderWidth: 2, borderColor: cores.borda, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: destaque ? cores.primario : cores.superficie }}>
      <Text style={{ fontFamily: fonts.monoMedia, fontSize: 11, textTransform: 'uppercase', color: destaque ? cores.textoNoPrimario : cores.texto }}>{texto}</Text>
    </View>
  );
}

/** Botão de curtir com contagem (tópicos e respostas). */
export function BotaoCurtir({ curtido, total, aoTocar, rotulo = 'Curtir' }) {
  const { cores, fonts } = useTheme();
  const [enviando, setEnviando] = useState(false);
  return (
    <Pressable
      role="button"
      aria-pressed={!!curtido}
      aria-label={`${rotulo}, ${total || 0} curtidas`}
      disabled={enviando}
      onPress={async () => {
        setEnviando(true);
        await aoTocar();
        setEnviando(false);
      }}
      style={{ minHeight: ALVO_TOQUE, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: cores.borda, borderRadius: 22, backgroundColor: curtido ? cores.destaque : cores.superficie }}
    >
      <IconeCoracao cor={curtido ? cores.textoNoDestaque : cores.texto} tamanho={17} />
      <Text style={{ fontFamily: fonts.monoMedia, fontSize: 12, color: curtido ? cores.textoNoDestaque : cores.texto }}>{total || 0}</Text>
    </Pressable>
  );
}

/** Link de texto pequeno com área de toque de 44px (ações de moderação e autor). */
export function Acao({ titulo, onPress, perigo }) {
  const { cores, fonts } = useTheme();
  return (
    <Pressable role="button" onPress={onPress} style={{ minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: 6 }}>
      <Text style={{ fontFamily: fonts.monoMedia, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', color: perigo ? cores.erro : cores.link }}>{titulo}</Text>
    </Pressable>
  );
}
