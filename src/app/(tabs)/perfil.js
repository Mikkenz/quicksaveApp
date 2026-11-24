import { useState } from 'react';
import { Text, View } from 'react-native';
import { Aviso, Botao, Cartao, Rotulo, Tela, Texto, Titulo } from '../../components/ui';
import { LinksTermos } from '../../components/LinksTermos';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../theme';

export default function Perfil() {
  const { perfil, sessao, menorDeIdade, sair } = useAuth();
  const { cores, fonts } = useTheme();
  const [saindo, setSaindo] = useState(false);
  const inicial = (perfil?.display_name || perfil?.username || '?').charAt(0).toUpperCase();

  return (
    <Tela>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: cores.borda, backgroundColor: '#b79cce', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: fonts.display, fontSize: 32, color: '#020000' }}>{inicial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Titulo style={{ fontSize: 28 }}>@{perfil?.username}</Titulo>
          {perfil?.display_name ? <Texto>{perfil.display_name}</Texto> : null}
        </View>
      </View>
      <Cartao style={{ gap: 6 }}>
        <Rotulo>Conta</Rotulo>
        <Texto>{sessao?.user?.email}</Texto>
        <Texto suave style={{ fontSize: 15 }}>
          Entrou com {sessao?.user?.app_metadata?.provider === 'google' ? 'Google' : 'e-mail e senha'}
        </Texto>
      </Cartao>
      {menorDeIdade ? (
        <Aviso tipo="info">Como você tem menos de 18 anos, seus registros ficam visíveis só para amigos.</Aviso>
      ) : null}
      <Texto suave style={{ fontSize: 15 }}>Diário, reviews e favoritos chegam na Fase 2.</Texto>
      <View style={{ flex: 1 }} />
      <LinksTermos />
      <Botao
        titulo="Sair"
        onPress={async () => {
          setSaindo(true);
          await sair();
        }}
        carregando={saindo}
      />
    </Tela>
  );
}
