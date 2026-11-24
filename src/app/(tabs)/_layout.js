import { Tabs } from 'expo-router';
import { IconeAmigos, IconeBuscar, IconeInicio, IconePerfil, IconeRegistrar } from '../../components/icons';
import { useTheme } from '../../theme';

const ABAS = [
  { nome: 'index', titulo: 'Início', Icone: IconeInicio },
  { nome: 'buscar', titulo: 'Buscar', Icone: IconeBuscar },
  { nome: 'registrar', titulo: 'Registrar', Icone: IconeRegistrar },
  { nome: 'amigos', titulo: 'Amigos', Icone: IconeAmigos },
  { nome: 'perfil', titulo: 'Perfil', Icone: IconePerfil },
];

export default function TabsLayout() {
  const { cores, fonts } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: cores.fundo },
        tabBarActiveTintColor: cores.primario,
        tabBarInactiveTintColor: cores.textoSuave,
        tabBarStyle: { backgroundColor: cores.superficie, borderTopWidth: 3, borderTopColor: cores.borda, minHeight: 64 },
        tabBarLabelStyle: { fontFamily: fonts.monoMedia, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
      }}
    >
      {ABAS.map(({ nome, titulo, Icone }) => (
        <Tabs.Screen
          key={nome}
          name={nome}
          options={{ title: titulo, tabBarIcon: ({ color }) => <Icone cor={color} tamanho={26} /> }}
        />
      ))}
    </Tabs>
  );
}
