import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, useTheme } from '../../theme';

const DURACAO = 7000; // ms por tela
const PASSO = 50;

function BotaoControle({ titulo, rotulo, onPress, cor, desabilitado, tamanhoTexto }) {
  const { fonts } = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={rotulo || titulo}
      aria-disabled={!!desabilitado}
      disabled={desabilitado}
      onPress={onPress}
      style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 12, borderRadius: 22, borderWidth: 2.5, borderColor: cor, alignItems: 'center', justifyContent: 'center', opacity: desabilitado ? 0.4 : 1 }}
    >
      <Text
        style={
          tamanhoTexto
            ? { fontFamily: fonts.display, fontSize: tamanhoTexto, lineHeight: tamanhoTexto + 2, color: cor }
            : { fontFamily: fonts.monoMedia, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: cor }
        }
      >
        {titulo}
      </Text>
    </Pressable>
  );
}

/**
 * Player de stories em tela cheia.
 * telas: [{ id, fundo, cor, rotulo, interativa, conteudo }]
 */
export function Stories({ telas, aoFechar }) {
  const insets = useSafeAreaInsets();
  const [indice, setIndice] = useState(0);
  const [progresso, setProgresso] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [segurando, setSegurando] = useState(false);
  const [reduzirMovimento, setReduzirMovimento] = useState(false);
  const [leitorDeTela, setLeitorDeTela] = useState(false);
  const tela = telas[indice];
  const ultima = indice === telas.length - 1;
  // Com "reduzir movimento" ou leitor de tela ligado, as telas não avançam sozinhas
  const automatico = !reduzirMovimento && !leitorDeTela;
  const parado = pausado || segurando || !automatico || ultima;
  const progressoRef = useRef(0);
  // No celular, os botões de baixo só aparecem com leitor de tela (TalkBack); na web, sempre
  const mostrarBotoes = Platform.OS === 'web' || leitorDeTela;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => setReduzirMovimento(Boolean(v)));
    AccessibilityInfo.isScreenReaderEnabled?.().then((v) => setLeitorDeTela(Boolean(v)));
    const sub = AccessibilityInfo.addEventListener?.('screenReaderChanged', (v) => setLeitorDeTela(Boolean(v)));
    return () => sub?.remove?.();
  }, []);

  const irPara = useCallback(
    (novo) => {
      const alvo = Math.max(0, Math.min(telas.length - 1, novo));
      progressoRef.current = 0;
      setProgresso(0);
      setIndice(alvo);
    },
    [telas.length]
  );

  const proxima = useCallback(() => irPara(indice + 1), [irPara, indice]);
  const anterior = useCallback(() => irPara(indice - 1), [irPara, indice]);

  useEffect(() => {
    if (parado) return undefined;
    const t = setInterval(() => {
      progressoRef.current += PASSO / DURACAO;
      if (progressoRef.current >= 1) {
        clearInterval(t);
        irPara(indice + 1);
      } else {
        setProgresso(progressoRef.current);
      }
    }, PASSO);
    return () => clearInterval(t);
  }, [parado, indice, irPara]);

  // Teclado na web: setas e Esc
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const tecla = (e) => {
      if (e.key === 'ArrowRight') proxima();
      else if (e.key === 'ArrowLeft') anterior();
      else if (e.key === 'Escape') aoFechar();
      else if (e.key === ' ') setPausado((p) => !p);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [proxima, anterior, aoFechar]);

  const cor = tela.cor;

  return (
    <View style={{ flex: 1, backgroundColor: tela.fundo }}>
      {/* Toque: esquerda volta, direita avança; segurar pausa */}
      {tela.interativa ? null : (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
          <Pressable
            accessible={false}
            onPress={anterior}
            onLongPress={() => setSegurando(true)}
            onPressOut={() => setSegurando(false)}
            delayLongPress={250}
            style={{ flex: 3 }}
          />
          <Pressable
            accessible={false}
            onPress={proxima}
            onLongPress={() => setSegurando(true)}
            onPressOut={() => setSegurando(false)}
            delayLongPress={250}
            style={{ flex: 7 }}
          />
        </View>
      )}

      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 14, gap: 10 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {telas.map((t, i) => (
            <View key={t.id} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: `${cor}40`, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  width: i < indice ? '100%' : i === indice ? `${(parado ? (automatico && !ultima ? progresso : 1) : progresso) * 100}%` : '0%',
                  backgroundColor: cor,
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'DMMono_500Medium', fontSize: 12, letterSpacing: 1.4, color: cor }}>
            {indice + 1} / {telas.length}
          </Text>
          <BotaoControle titulo="×" rotulo="Fechar Rewind" onPress={aoFechar} cor={cor} tamanhoTexto={26} />
        </View>
      </View>

      <View
        style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}
        pointerEvents={tela.interativa ? 'box-none' : 'none'}
        accessible={!tela.interativa}
        aria-label={tela.rotulo}
        accessibilityLiveRegion="polite"
      >
        {tela.conteudo}
      </View>

      {mostrarBotoes ? (
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: insets.bottom + 14, paddingTop: 8 }}
          pointerEvents="box-none"
        >
          <BotaoControle titulo="Anterior" onPress={anterior} cor={cor} desabilitado={indice === 0} />
          {automatico && !ultima ? (
            <BotaoControle titulo={pausado ? 'Continuar' : 'Pausar'} onPress={() => setPausado(!pausado)} cor={cor} />
          ) : null}
          {ultima ? <View style={{ width: 44 }} /> : <BotaoControle titulo="Próximo" onPress={proxima} cor={cor} />}
        </View>
      ) : (
        <View style={{ height: insets.bottom + 24 }} />
      )}
    </View>
  );
}

export const CORES_STORIES = {
  roxo: { fundo: palette.roxo, cor: palette.creme },
  vermelho: { fundo: palette.vermelho, cor: palette.creme },
  creme: { fundo: palette.creme, cor: palette.tinta },
  lilas: { fundo: palette.lilas, cor: palette.tinta },
  tinta: { fundo: '#170b1e', cor: palette.creme },
};
