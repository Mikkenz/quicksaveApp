import { forwardRef, useRef, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { urlCapa } from '../../lib/igdb';
import { nomeDoPeriodo, numero, perfilDeJogador } from '../../lib/rewind';
import { palette, useTheme } from '../../theme';

// Tamanho lógico do cartão; a imagem sai em 1080 x 1920 (formato de stories)
export const LARGURA = 300;
export const ALTURA = 533;

function Numero({ valor, rotulo }) {
  const { fonts } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: palette.tinta }}>{numero(valor)}</Text>
      <Text style={{ fontFamily: fonts.monoMedia, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: palette.tinta }}>{rotulo}</Text>
    </View>
  );
}

/** O cartão que vira imagem. "semCapa" é usado na web se a capa não puder entrar na imagem. */
export const CartaoRewind = forwardRef(function CartaoRewind({ rewind, semCapa }, ref) {
  const { fonts } = useTheme();
  const d = rewind.data || {};
  const favorito = (d.top || [])[0];
  const perfil = perfilDeJogador(d, rewind.kind);
  const capa = favorito && !semCapa ? urlCapa(favorito.cover, 't_cover_big') : null;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{ width: LARGURA, height: ALTURA, backgroundColor: palette.roxo, padding: 18, justifyContent: 'space-between' }}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fonts.monoMedia, fontSize: 11, letterSpacing: 2, color: palette.creme }}>QUICKSAVE REWIND</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 42, color: palette.creme }}>{nomeDoPeriodo(rewind)}</Text>
        <Text style={{ fontFamily: fonts.displayMedia, fontSize: 16, color: palette.lilas }}>@{rewind.username}</Text>
      </View>

      <View style={{ backgroundColor: palette.creme, borderWidth: 3, borderColor: palette.tinta, borderRadius: 14, paddingVertical: 12, flexDirection: 'row', boxShadow: `5px 5px 0px ${palette.tinta}` }}>
        <Numero valor={d.jogos} rotulo="Jogos" />
        <Numero valor={d.zerados} rotulo="Zerados" />
        <Numero valor={d.horas} rotulo="Horas" />
      </View>

      {favorito ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={{ width: 74, height: 99, borderWidth: 3, borderColor: palette.tinta, borderRadius: 10, overflow: 'hidden', backgroundColor: '#5c1024', justifyContent: 'flex-end' }}>
            {capa ? (
              <Image source={{ uri: capa }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
            ) : (
              <Text numberOfLines={4} style={{ color: palette.creme, fontSize: 10, padding: 4, fontFamily: fonts.displayMedia }}>{favorito.name}</Text>
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.monoMedia, fontSize: 10, letterSpacing: 1.4, color: palette.lilas }}>MAIOR NOTA</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, lineHeight: 23, color: palette.creme }} numberOfLines={3}>{favorito.name}</Text>
            <Text style={{ fontFamily: fonts.monoMedia, fontSize: 13, color: palette.creme }}>Nota {favorito.rating}</Text>
          </View>
        </View>
      ) : (
        <View />
      )}

      <View style={{ backgroundColor: palette.vermelho, borderWidth: 3, borderColor: palette.tinta, borderRadius: 14, padding: 12, gap: 2 }}>
        <Text style={{ fontFamily: fonts.monoMedia, fontSize: 10, letterSpacing: 1.4, color: palette.creme }}>PERFIL DE JOGADOR</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 27, color: palette.creme }}>{perfil.titulo}</Text>
        <Text style={{ fontFamily: fonts.corpo, fontSize: 13, color: palette.creme }}>{perfil.descricao}</Text>
      </View>

      <Text style={{ fontFamily: fonts.monoMedia, fontSize: 10, letterSpacing: 1.2, color: palette.creme, textAlign: 'center' }}>
        QUICKSAVEGAMES.COM.BR
      </Text>
    </View>
  );
});

async function compartilharNaWeb(dataUri, nomeArquivo) {
  const blob = await (await fetch(dataUri)).blob();
  const arquivo = typeof File !== 'undefined' ? new File([blob], nomeArquivo, { type: 'image/png' }) : null;
  if (arquivo && navigator.canShare?.({ files: [arquivo] })) {
    await navigator.share({ files: [arquivo], title: 'Meu Rewind no Quicksave' });
    return 'compartilhado';
  }
  // Sem compartilhar no navegador: baixa a imagem
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return 'baixado';
}

/** Gera a imagem do cartão e abre o compartilhar (celular) ou compartilha/baixa (web). */
export function useCompartilharRewind(rewind) {
  const ref = useRef(null);
  const [semCapa, setSemCapa] = useState(false);
  const [estado, setEstado] = useState({ enviando: false, mensagem: null, erro: null });

  async function capturar(sem) {
    return captureRef(ref, {
      format: 'png',
      quality: 1,
      width: 1080,
      height: 1920,
      result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
      ...(Platform.OS === 'web' ? { useCORS: true } : null),
    });
  }

  async function compartilhar() {
    setEstado({ enviando: true, mensagem: null, erro: null });
    const nome = `quicksave-rewind-${rewind.id}.png`;
    try {
      let uri;
      try {
        uri = await capturar(semCapa);
      } catch (e) {
        if (Platform.OS !== 'web' || semCapa) throw e;
        // Na web, a capa de outro site pode bloquear a imagem: tenta de novo sem ela
        setSemCapa(true);
        await new Promise((r) => setTimeout(r, 150));
        uri = await capturar(true);
      }
      if (Platform.OS === 'web') {
        const r = await compartilharNaWeb(uri, nome);
        setEstado({ enviando: false, mensagem: r === 'baixado' ? 'Imagem baixada.' : null, erro: null });
      } else {
        const Sharing = require('expo-sharing');
        if (!(await Sharing.isAvailableAsync())) throw new Error('compartilhar indisponível');
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartilhar meu Rewind' });
        setEstado({ enviando: false, mensagem: null, erro: null });
      }
    } catch (e) {
      if (e?.name === 'AbortError') {
        setEstado({ enviando: false, mensagem: null, erro: null });
        return;
      }
      console.warn('Compartilhar Rewind:', e?.message || e);
      setEstado({ enviando: false, mensagem: null, erro: 'Não foi possível gerar a imagem agora. Tente de novo.' });
    }
  }

  return { ref, semCapa, compartilhar, ...estado };
}
