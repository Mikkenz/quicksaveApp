import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { IconeOlhoFechado } from './icons';
import { Caixa } from './CamposPerfil';
import { useTheme } from '../theme';

/**
 * Esconde o conteúdo atrás de um aviso de spoiler (como no Letterboxd).
 * aberto: começa aberto (ex.: para o próprio autor).
 */
export function ConteudoSpoiler({ spoiler, aberto = false, children }) {
  const { cores, fonts, borda } = useTheme();
  const [mostrar, setMostrar] = useState(!spoiler || aberto);
  if (mostrar) return children;
  return (
    <Pressable
      role="button"
      aria-label="Pode conter spoilers. Toque para ler."
      onPress={() => setMostrar(true)}
      style={({ pressed }) => ({
        minHeight: 96,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderWidth: borda.largura,
        borderStyle: 'dashed',
        borderColor: cores.textoSuave,
        borderRadius: 12,
        backgroundColor: pressed ? cores.divisor : cores.superficie,
      })}
    >
      <IconeOlhoFechado cor={cores.textoSuave} tamanho={30} />
      <Text style={{ fontFamily: fonts.monoMedia, fontSize: 13, color: cores.textoSuave, textAlign: 'center' }}>
        Pode conter spoilers. Toque para ler.
      </Text>
    </Pressable>
  );
}

/** Checkbox "Contém spoilers" usado em todos os campos de texto. */
export function MarcarSpoiler({ valor, onChange }) {
  const { cores, fonts } = useTheme();
  return (
    <View>
      <Caixa marcado={valor} onChange={onChange}>
        <Text style={{ fontFamily: fonts.corpo, fontSize: 15, color: cores.texto }}>Contém spoilers</Text>
      </Caixa>
    </View>
  );
}
