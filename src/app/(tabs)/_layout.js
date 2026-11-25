import { Tabs } from 'expo-router';
import { IconeAmigos, IconeComunidades, IconeInicio, IconePerfil, IconeRegistrar } from '../../components/icons';
import { useAtualizacaoDasContagens, useContagens } from '../../lib/contagens';
import { useTheme } from '../../theme';

const ABAS = [
  { nome: 'index', titulo: 'Início', Icone: IconeInicio },
  { nome: 'comunidades', titulo: 'Comunidades', Icone: IconeComunidades },
  { nome: 'registrar', titulo: 'Registrar', Icone: IconeRegistrar },
  { nome: 'amigos', titulo: 'Amigos', Icone: IconeAmigos },
  { nome: 'perfil', titulo: 'Perfil', Icone: IconePerfil },
];

export default function TabsLayout() {
  const { cores, fonts } = useTheme();
  useAtualizacaoDasContagens();
  const { pedidos, convites } = useContagens();
  const pendentesAmigos = pedidos + convites;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: cores.fundo },
        tabBarActiveTintColor: cores.link,
        tabBarInactiveTintColor: cores.textoSuave,
        tabBarStyle: { backgroundColor: cores.superficie, borderTopWidth: 3, borderTopColor: cores.borda, minHeight: 64 },
        tabBarLabelStyle: { fontFamily: fonts.monoMedia, fontSize: 10, letterSpacing: 0.2, textTransform: 'uppercase' },
        tabBarBadgeStyle: { backgroundColor: cores.destaque, color: cores.textoNoDestaque, fontFamily: fonts.monoMedia, fontSize: 11 },
      }}
    >
      {ABAS.map(({ nome, titulo, Icone }) => (
        <Tabs.Screen
          key={nome}
          name={nome}
          options={{
            title: titulo,
            tabBarIcon: ({ color }) => <Icone cor={color} tamanho={26} />,
            tabBarBadge: nome === 'amigos' && pendentesAmigos > 0 ? pendentesAmigos : undefined,
            tabBarAccessibilityLabel:
              nome === 'amigos' && pendentesAmigos > 0 ? `Amigos, ${pendentesAmigos} pendentes` : undefined,
          }}
        />
      ))}
    </Tabs>
  );
}
