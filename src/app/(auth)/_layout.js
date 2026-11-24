import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

export default function AuthLayout() {
  const { cores } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }} />;
}
