import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Tela, Texto } from '../components/ui';
import { Cabecalho } from '../components/Cabecalho';
import { Avatar } from '../components/social';
import { atualizarContagens } from '../lib/contagens';
import { destinoNotificacao, marcarNotificacoesLidas, minhasNotificacoes, tempoRelativo, textoNotificacao } from '../lib/social';
import { ALVO_TOQUE, useTheme } from '../theme';

export default function Notificacoes() {
  const { cores, fonts } = useTheme();
  const [itens, setItens] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      minhasNotificacoes().then(async (lista) => {
        if (!ativo) return;
        setItens(lista);
        if (lista.some((n) => !n.read)) {
          await marcarNotificacoesLidas();
          atualizarContagens();
        }
      });
      return () => {
        ativo = false;
      };
    }, [])
  );

  return (
    <Tela>
      <Cabecalho titulo="Notificações" />
      {itens === null ? <ActivityIndicator color={cores.link} /> : null}
      {itens && itens.length === 0 ? (
        <Texto suave>Nada por aqui ainda. Pedidos de amizade, convites, reações e comentários aparecem nesta tela.</Texto>
      ) : null}
      <View>
        {(itens || []).map((n) => {
          const destino = destinoNotificacao(n);
          const texto = textoNotificacao(n);
          return (
            <Pressable
              key={n.id}
              role={destino ? 'link' : undefined}
              aria-label={`${n.read ? '' : 'Nova: '}${texto}`}
              disabled={!destino}
              onPress={() => destino && router.push(destino)}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, minHeight: ALVO_TOQUE, borderBottomWidth: 2, borderColor: cores.divisor }}
            >
              <Avatar url={n.actor_avatar_url} nome={n.actor_username} tamanho={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: n.read ? fonts.corpo : fonts.corpoForte, fontSize: 16, lineHeight: 22, color: cores.texto }}>{texto}</Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>{tempoRelativo(n.created_at)}</Text>
              </View>
              {n.read ? null : (
                <View accessibilityElementsHidden style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: cores.destaque, borderWidth: 2, borderColor: cores.borda }} />
              )}
            </Pressable>
          );
        })}
      </View>
    </Tela>
  );
}
