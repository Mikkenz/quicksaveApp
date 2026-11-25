import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Etiqueta } from '../comunidades';
import { ALVO_TOQUE, palette, sombra, useTheme } from '../../theme';

/** Cartão de um Rewind (lista e destaque no Início). */
export function CartaoRewindLista({ r, destaque }) {
  const { cores, fonts, borda } = useTheme();
  const corTexto = destaque ? palette.creme : cores.texto;
  return (
    <Pressable
      role="link"
      aria-label={`${destaque ? 'Seu Rewind chegou: ' : ''}${r.title}${r.seen ? '' : ', novo'}${r.status === 'draft' ? ', rascunho' : ''}`}
      onPress={() => router.push(`/rewind/${r.id}`)}
      style={[
        {
          minHeight: ALVO_TOQUE,
          padding: 16,
          gap: 6,
          borderWidth: borda.largura,
          borderColor: cores.borda,
          borderRadius: borda.raioCartao,
          backgroundColor: destaque ? palette.roxo : cores.superficie,
        },
        sombra(cores, 4),
      ]}
    >
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Etiqueta texto={r.kind === 'year' ? 'Rewind anual' : 'Rewind mensal'} destaque={!destaque} />
        {r.seen ? null : <Etiqueta texto="Novo" />}
        {r.status === 'draft' ? <Etiqueta texto="Rascunho (só admin)" /> : null}
      </View>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: corTexto }}>
        {destaque ? `${r.title} chegou` : r.title}
      </Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: corTexto }}>Toque para ver</Text>
    </Pressable>
  );
}
