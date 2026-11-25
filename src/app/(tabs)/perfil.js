import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Aviso, Tela, Texto, Titulo } from '../../components/ui';
import { ConteudoPerfil } from '../../components/ConteudoPerfil';
import { MenuPerfil } from '../../components/MenuPerfil';
import { Avatar } from '../../components/social';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../theme';

/** Três tracinhos no canto da foto, para mostrar que ela abre o menu. */
function MarcaMenu() {
  const { cores } = useTheme();
  return (
    <View
      style={{ position: 'absolute', right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: cores.borda, backgroundColor: cores.superficie, alignItems: 'center', justifyContent: 'center', gap: 2.5 }}
    >
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 12, height: 2.5, borderRadius: 2, backgroundColor: cores.texto }} />
      ))}
    </View>
  );
}

export default function Perfil() {
  const { perfil, sessao, menorDeIdade } = useAuth();
  const userId = sessao?.user?.id;
  const [menu, setMenu] = useState(false);

  return (
    <Tela>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
        <Pressable role="button" aria-label="Abrir menu do perfil" aria-expanded={menu} onPress={() => setMenu(true)} hitSlop={6}>
          <Avatar url={perfil?.avatar_url} nome={perfil?.display_name || perfil?.username} tamanho={76} />
          <MarcaMenu />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Titulo style={{ fontSize: 28 }}>@{perfil?.username}</Titulo>
          {perfil?.display_name ? <Texto>{perfil.display_name}</Texto> : null}
          {perfil?.bio ? <Texto suave style={{ fontSize: 15 }}>{perfil.bio}</Texto> : null}
        </View>
      </View>

      <ConteudoPerfil userId={userId} meu>
        {menorDeIdade ? <Aviso tipo="info">Como você tem menos de 18 anos, seus registros ficam visíveis só para amigos e grupos.</Aviso> : null}
      </ConteudoPerfil>

      <MenuPerfil aberto={menu} aoFechar={() => setMenu(false)} />
    </Tela>
  );
}
