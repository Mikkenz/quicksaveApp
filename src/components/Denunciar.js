import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Botao, Rotulo, Texto, Titulo } from './ui';
import { Opcoes } from './jogos';
import { IconeBandeira } from './icons';
import { MOTIVOS_DENUNCIA, denunciar } from '../lib/comunidades';
import { ALVO_TOQUE, useTheme } from '../theme';

/**
 * Botão "Denunciar" que abre uma folha com o motivo.
 * tipo: post, reply, community, comment, review, profile. alvo: id (ou "dono:jogo" para review).
 */
export function Denunciar({ tipo, alvo, descricao = 'este conteúdo', compacto }) {
  const { cores, fonts, borda } = useTheme();
  const insets = useSafeAreaInsets();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState(null);
  const [detalhes, setDetalhes] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [enviado, setEnviado] = useState(false);

  function fechar() {
    setAberto(false);
    setMotivo(null);
    setDetalhes('');
    setErro(null);
    setEnviado(false);
  }

  async function enviar() {
    if (!motivo) return setErro('Escolha um motivo.');
    setErro(null);
    setEnviando(true);
    const r = await denunciar(tipo, alvo, motivo, detalhes.trim());
    setEnviando(false);
    if (r.erro) return setErro(r.erro);
    setEnviado(true);
  }

  return (
    <>
      <Pressable
        role="button"
        aria-label={`Denunciar ${descricao}`}
        onPress={() => setAberto(true)}
        style={{ minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, paddingHorizontal: compacto ? 6 : 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}
      >
        <IconeBandeira cor={cores.textoSuave} tamanho={17} />
        {compacto ? null : <Text style={{ fontFamily: fonts.monoMedia, fontSize: 12, color: cores.textoSuave }}>Denunciar</Text>}
      </Pressable>

      <Modal visible={aberto} transparent animationType="slide" onRequestClose={fechar} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: cores.fundoMenu }}>
          <Pressable role="button" aria-label="Fechar" onPress={fechar} style={{ flex: 1 }} />
          <View
            role="dialog"
            aria-modal
            aria-label="Denunciar"
            style={{ maxHeight: '90%', backgroundColor: cores.fundo, borderTopWidth: borda.largura, borderColor: cores.borda, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: insets.bottom + 16 }}
          >
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
              <Titulo nivel={2}>Denunciar</Titulo>
              {enviado ? (
                <>
                  <Aviso tipo="sucesso">Denúncia enviada. A moderação vai analisar. Obrigado por ajudar a manter o Quicksave seguro.</Aviso>
                  <Botao titulo="Fechar" onPress={fechar} />
                </>
              ) : (
                <>
                  <Texto suave style={{ fontSize: 15 }}>Por que você está denunciando {descricao}? Quem publicou não fica sabendo quem denunciou.</Texto>
                  <Opcoes rotulo="Motivo da denúncia" opcoes={MOTIVOS_DENUNCIA} valor={motivo} onChange={setMotivo} colunas={1} />
                  <View style={{ gap: 6 }}>
                    <Rotulo>Detalhes (opcional)</Rotulo>
                    <TextInput
                      aria-label="Detalhes da denúncia"
                      value={detalhes}
                      onChangeText={setDetalhes}
                      maxLength={500}
                      multiline
                      placeholder="Conte o que aconteceu"
                      placeholderTextColor={cores.textoSuave}
                      style={{ minHeight: 80, textAlignVertical: 'top', borderWidth: borda.largura, borderColor: cores.borda, borderRadius: 12, backgroundColor: cores.superficie, padding: 12, fontFamily: fonts.corpo, fontSize: 16, color: cores.texto }}
                    />
                  </View>
                  <Aviso>{erro}</Aviso>
                  <Botao titulo="Enviar denúncia" variante="destaque" onPress={enviar} carregando={enviando} />
                  <Botao titulo="Cancelar" onPress={fechar} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
