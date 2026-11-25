import { Image, Pressable, Text, View } from 'react-native';
import { urlCapa } from '../lib/igdb';
import { ALVO_TOQUE, palette, sombra, useTheme } from '../theme';

/** Capa do jogo com borda grossa. Sem imagem, mostra o nome sobre um fundo de cor. */
export function Capa({ imageId, nome, largura = 56, altura, tamanho = 't_cover_big', style, inclinada }) {
  const { cores, borda } = useTheme();
  const h = altura || Math.round(largura * 4 / 3);
  const url = urlCapa(imageId, tamanho);
  return (
    <View
      accessible={false}
      style={[
        {
          width: largura,
          height: h,
          borderWidth: borda.largura,
          borderColor: cores.borda,
          borderRadius: largura > 80 ? 12 : 8,
          overflow: 'hidden',
          backgroundColor: '#5c1024',
          justifyContent: 'flex-end',
        },
        inclinada ? { transform: [{ rotate: '-3deg' }] } : null,
        style,
      ]}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
      ) : largura >= 56 ? (
        <Text numberOfLines={3} style={{ color: palette.creme, fontSize: 11, padding: 4, fontWeight: '700' }}>
          {nome}
        </Text>
      ) : null}
    </View>
  );
}

/** Grupo de botões em que só um fica marcado (status, plataforma, nota, visibilidade). */
export function Opcoes({ opcoes, valor, onChange, rotulo, colunas, compacto, permitirLimpar }) {
  const { cores, fonts, borda } = useTheme();
  return (
    <View role="radiogroup" aria-label={rotulo} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: compacto ? 4 : 8 }}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <Pressable
            key={String(o.valor)}
            role="radio"
            aria-checked={ativo}
            aria-label={o.descricao || String(o.rotulo)}
            onPress={() => onChange(ativo && permitirLimpar ? null : o.valor)}
            style={[
              {
                minHeight: ALVO_TOQUE,
                minWidth: compacto ? 0 : ALVO_TOQUE,
                paddingHorizontal: compacto ? 0 : 12,
                borderWidth: borda.largura,
                borderColor: cores.borda,
                borderRadius: 10,
                backgroundColor: ativo ? cores.primario : cores.superficie,
                alignItems: 'center',
                justifyContent: 'center',
              },
              colunas ? { flexBasis: `${100 / colunas - 3}%`, flexGrow: 1 } : null,
              ativo ? sombra(cores, 2) : null,
            ]}
          >
            <Text
              style={{
                fontFamily: o.mono ? fonts.monoMedia : fonts.display,
                fontSize: o.mono ? 15 : 15,
                color: ativo ? cores.textoNoPrimario : cores.texto,
              }}
            >
              {o.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Círculo com a nota (1 a 10). */
export function Nota({ valor, tamanho = 40, destaque }) {
  const { cores, fonts } = useTheme();
  if (valor === null || valor === undefined) return null;
  return (
    <View
      aria-label={`Nota ${valor}`}
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        borderWidth: 3,
        borderColor: cores.borda,
        backgroundColor: destaque ? cores.destaque : cores.primario,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.monoMedia, fontSize: tamanho * 0.38, color: destaque ? cores.textoNoDestaque : cores.textoNoPrimario }}>
        {String(valor).replace('.', ',')}
      </Text>
    </View>
  );
}

export function Chip({ texto }) {
  const { cores, fonts } = useTheme();
  return (
    <View style={{ borderWidth: 2, borderColor: cores.borda, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: cores.superficie }}>
      <Text style={{ fontFamily: fonts.monoMedia, fontSize: 11, color: cores.texto, textTransform: 'uppercase' }}>{texto}</Text>
    </View>
  );
}

export function CreditoIGDB() {
  const { cores, fonts } = useTheme();
  return (
    <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave, textAlign: 'center', marginTop: 8 }}>
      Dados de jogos: IGDB.com
    </Text>
  );
}
