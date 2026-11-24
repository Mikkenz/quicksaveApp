import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Aviso, Botao, LinkTexto, Texto } from '../../components/ui';
import { LinksTermos } from '../../components/LinksTermos';
import { entrarComGoogle } from '../../lib/google';
import { palette, useTheme } from '../../theme';

export default function BoasVindas() {
  const { cores, fonts } = useTheme();
  const [carregandoGoogle, setCarregandoGoogle] = useState(false);
  const [erro, setErro] = useState(null);

  async function google() {
    setErro(null);
    setCarregandoGoogle(true);
    const r = await entrarComGoogle();
    setCarregandoGoogle(false);
    if (r.erro) setErro(r.erro);
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.roxo, flex: 1, borderBottomWidth: 3, borderColor: cores.borda }}>
        <ScrollView contentContainerStyle={{ padding: 28, gap: 16, flexGrow: 1, justifyContent: 'flex-end' }}>
          <View
            style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: palette.creme, borderWidth: 3, borderColor: palette.tinta, alignItems: 'center', justifyContent: 'center' }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 34, color: palette.tinta }}>Q</Text>
          </View>
          <Text role="heading"style={{ fontFamily: fonts.display, fontSize: 52, lineHeight: 54, color: palette.creme }}>
            Quicksave
          </Text>
          <Text style={{ fontFamily: fonts.corpo, fontSize: 19, lineHeight: 27, color: palette.creme }}>
            Seu diário de jogos. Registre o que você joga, dê notas, escreva reviews e veja o que seus amigos estão jogando.
          </Text>
        </ScrollView>
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={{ padding: 28, paddingTop: 24, gap: 14 }}>
        <Botao titulo="Criar conta" variante="destaque" onPress={() => router.push('/criar-conta')} />
        <Botao titulo="Continuar com Google" onPress={google} carregando={carregandoGoogle} />
        <Aviso>{erro}</Aviso>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Texto style={{ fontSize: 16 }}>Já tem conta?</Texto>
          <LinkTexto titulo="Entrar" onPress={() => router.push('/entrar')} />
        </View>
        <Texto suave style={{ fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
          Grátis e sem anúncios. Antes de começar, você lê e aceita os termos de uso e a política de privacidade.
        </Texto>
        <LinksTermos centralizado />
      </SafeAreaView>
    </View>
  );
}
