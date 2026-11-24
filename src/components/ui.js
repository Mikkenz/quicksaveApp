import { forwardRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ALVO_TOQUE, sombra, useTheme } from '../theme';

/** Tela com fundo creme, área segura e rolagem opcional. */
export function Tela({ children, rolar = true, style, contentStyle }) {
  const { cores } = useTheme();
  const conteudo = rolar ? (
    <ScrollView
      contentContainerStyle={[styles.conteudo, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.conteudo, { flex: 1 }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: cores.fundo }, style]} edges={['top', 'left', 'right']}>
      {conteudo}
    </SafeAreaView>
  );
}

export function Titulo({ children, style, nivel = 1 }) {
  const { cores, fonts } = useTheme();
  const tamanho = nivel === 1 ? 34 : nivel === 2 ? 24 : 19;
  return (
    <Text
      role="heading"
      style={[{ fontFamily: fonts.display, fontSize: tamanho, lineHeight: tamanho * 1.1, color: cores.texto }, style]}
    >
      {children}
    </Text>
  );
}

export function Texto({ children, style, suave, ...rest }) {
  const { cores, fonts } = useTheme();
  return (
    <Text
      style={[{ fontFamily: fonts.corpo, fontSize: 17, lineHeight: 24, color: suave ? cores.textoSuave : cores.texto }, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}

/** Rótulo em mono caixa-alta. */
export function Rotulo({ children, style, ...rest }) {
  const { cores, fonts } = useTheme();
  return (
    <Text
      style={[{ fontFamily: fonts.monoMedia, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: cores.textoSuave }, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}

/**
 * Botão com borda de 3px e sombra deslocada.
 * variante: 'destaque' (vermelho), 'primario' (roxo), 'neutro' (superfície), 'escuro'
 */
export function Botao({ titulo, onPress, variante = 'neutro', carregando, desabilitado, icone, style, accessibilityLabel }) {
  const { cores, fonts, borda } = useTheme();
  const fundo = {
    destaque: cores.destaque,
    primario: cores.primario,
    neutro: cores.superficie,
    escuro: cores.texto,
  }[variante];
  const corTexto = {
    destaque: cores.textoNoDestaque,
    primario: cores.textoNoPrimario,
    neutro: cores.texto,
    escuro: cores.fundo,
  }[variante];
  const inativo = desabilitado || carregando;
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel}
      aria-disabled={!!inativo}
      aria-busy={!!carregando}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        styles.botao,
        {
          backgroundColor: fundo,
          borderColor: cores.borda,
          borderWidth: borda.largura,
          borderRadius: borda.raio,
          opacity: inativo ? 0.6 : 1,
        },
        pressed ? { transform: [{ translateX: 2 }, { translateY: 2 }], ...sombra(cores, 2) } : sombra(cores, 4),
        style,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <View style={styles.botaoLinha}>
          {icone}
          <Text style={{ fontFamily: fonts.display, fontSize: 17, color: corTexto }}>{titulo}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Link de texto com área de toque de 44px. */
export function LinkTexto({ titulo, onPress, style }) {
  const { cores, fonts } = useTheme();
  return (
    <Pressable
      role="link"
      onPress={onPress}
      hitSlop={8}
      style={{ minHeight: ALVO_TOQUE, justifyContent: 'center' }}
    >
      <Text style={[{ fontFamily: fonts.corpoForte, fontSize: 16, color: cores.primario, textDecorationLine: 'underline' }, style]}>
        {titulo}
      </Text>
    </Pressable>
  );
}

/** Campo com rótulo visível, dica e erro. */
export const Campo = forwardRef(function Campo({ rotulo, dica, erro, dicaCor, style, ...input }, ref) {
  const { cores, fonts, borda } = useTheme();
  const [foco, setFoco] = useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      <Rotulo nativeID={input.nativeID ? `${input.nativeID}-rotulo` : undefined}>{rotulo}</Rotulo>
      <TextInput
        ref={ref}
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.textoSuave}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        style={{
          minHeight: 50,
          borderWidth: borda.largura,
          borderColor: erro ? cores.erro : cores.borda,
          borderRadius: borda.raio,
          backgroundColor: cores.superficie,
          paddingHorizontal: 14,
          fontFamily: fonts.corpo,
          fontSize: 17,
          color: cores.texto,
          ...(foco ? sombra(cores, 3) : null),
        }}
        {...input}
      />
      {erro ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.mono, fontSize: 13, color: cores.erro }}>{erro}</Text>
      ) : dica ? (
        <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: dicaCor || cores.textoSuave }}>{dica}</Text>
      ) : null}
    </View>
  );
});

/** Caixa de mensagem (erro ou aviso) que leitores de tela anunciam. */
export function Aviso({ children, tipo = 'erro' }) {
  const { cores, fonts, borda } = useTheme();
  if (!children) return null;
  const cor = tipo === 'erro' ? cores.erro : tipo === 'sucesso' ? cores.sucesso : cores.primario;
  return (
    <View
      accessibilityLiveRegion="polite"
      role="alert"
      style={{ borderWidth: borda.largura, borderColor: cor, borderRadius: borda.raio, padding: 12, backgroundColor: cores.superficie }}
    >
      <Text style={{ fontFamily: fonts.corpo, fontSize: 15, lineHeight: 21, color: cores.texto }}>{children}</Text>
    </View>
  );
}

export function Cartao({ children, style }) {
  const { cores, borda } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: cores.superficie, borderWidth: borda.largura, borderColor: cores.borda, borderRadius: borda.raioCartao, padding: 16 },
        sombra(cores, 4),
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { padding: 24, gap: 16, flexGrow: 1 },
  botao: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  botaoLinha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
