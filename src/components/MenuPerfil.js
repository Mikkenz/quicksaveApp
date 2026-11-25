import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Botao } from './ui';
import { Avatar } from './social';
import { LinksTermos } from './LinksTermos';
import { useAuth } from '../lib/auth';
import { resumoDenuncias } from '../lib/comunidades';
import { ALVO_TOQUE, useTheme } from '../theme';

/** Item grande do menu, com a linha lilás embaixo (igual ao menu do site). */
function Item({ titulo, onPress }) {
  const { cores, fonts } = useTheme();
  return (
    <Pressable
      role="link"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: ALVO_TOQUE + 8,
        justifyContent: 'center',
        borderBottomWidth: 2,
        borderColor: '#b79cce',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 27, color: cores.texto }}>{titulo}</Text>
    </Pressable>
  );
}

/** Painel lateral do perfil: editar perfil, modo escuro e sair. */
export function MenuPerfil({ aberto, aoFechar }) {
  const { cores, fonts, escuro, alternarTema } = useTheme();
  const { perfil, sair } = useAuth();
  const insets = useSafeAreaInsets();
  const [saindo, setSaindo] = useState(false);
  const [denuncias, setDenuncias] = useState(null);

  // Quem modera alguma comunidade (ou é admin) vê o atalho para as denúncias
  useEffect(() => {
    if (aberto) resumoDenuncias().then(setDenuncias);
  }, [aberto]);

  function ir(rota) {
    aoFechar();
    router.push(rota);
  }

  return (
    <Modal visible={aberto} transparent animationType="fade" onRequestClose={aoFechar} statusBarTranslucent>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View
          role="dialog"
          aria-modal
          aria-label="Menu do perfil"
          style={{
            width: '85%',
            maxWidth: 320,
            backgroundColor: cores.superficie,
            borderRightWidth: 4,
            borderColor: cores.borda,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 20,
          }}
        >
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14 }}>
              <Avatar url={perfil?.avatar_url} nome={perfil?.display_name || perfil?.username} tamanho={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 18, color: cores.texto }} numberOfLines={1}>
                  @{perfil?.username}
                </Text>
                {perfil?.display_name ? (
                  <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }} numberOfLines={1}>{perfil.display_name}</Text>
                ) : null}
              </View>
              <Pressable
                role="button"
                aria-label="Fechar menu"
                onPress={aoFechar}
                style={{ width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: 12, borderWidth: 2.5, borderColor: cores.borda, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 24, color: cores.texto }}>×</Text>
              </Pressable>
            </View>

            <Item titulo="Editar perfil" onPress={() => ir('/editar-perfil')} />
            {denuncias?.can_review ? (
              <Item titulo={denuncias.open ? `Denúncias (${denuncias.open})` : 'Denúncias'} onPress={() => ir('/denuncias')} />
            ) : null}

            <View style={{ marginTop: 24, gap: 6 }}>
              <Pressable
                role="button"
                onPress={alternarTema}
                style={({ pressed }) => ({
                  minHeight: ALVO_TOQUE,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 14,
                  borderWidth: 2.5,
                  borderColor: cores.texto,
                  borderRadius: 8,
                  justifyContent: 'center',
                  backgroundColor: pressed ? '#b79cce' : 'transparent',
                })}
              >
                <Text style={{ fontFamily: fonts.monoMedia, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', color: cores.texto }}>
                  {escuro ? 'Modo claro' : 'Modo escuro'}
                </Text>
              </Pressable>
            </View>

            <View style={{ flex: 1, minHeight: 32 }} />

            <LinksTermos />
            <Botao
              titulo="Sair"
              style={{ marginTop: 8 }}
              carregando={saindo}
              onPress={async () => {
                setSaindo(true);
                await sair();
              }}
            />
          </ScrollView>
        </View>
        <Pressable
          role="button"
          aria-label="Fechar menu"
          onPress={aoFechar}
          style={{ flex: 1, backgroundColor: cores.fundoMenu }}
        />
      </View>
    </Modal>
  );
}
