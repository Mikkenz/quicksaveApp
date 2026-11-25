import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { IconeBuscar } from './icons';
import { Capa, Chip } from './jogos';
import { anoDe, buscarJogos } from '../lib/igdb';
import { ALVO_TOQUE, sombra, useTheme } from '../theme';

export function LinhaJogo({ jogo, aoRegistrar }) {
  const { cores, fonts, borda } = useTheme();
  const meta = [anoDe(jogo.first_release), jogo.developer].filter(Boolean).join(' · ');
  const abrir = () => router.push(`/jogo/${jogo.igdb_id}`);
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderColor: cores.divisor }}>
      <Pressable onPress={abrir} role="link" aria-label={`Abrir ${jogo.name}`} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }}>
        <Capa imageId={jogo.cover_image_id} nome={jogo.name} largura={56} tamanho="t_cover_small" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 16, lineHeight: 19, color: cores.texto }} numberOfLines={2}>
            {jogo.name}
          </Text>
          {meta ? <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }} numberOfLines={1}>{meta}</Text> : null}
          {jogo.platforms?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {jogo.platforms.slice(0, 3).map((p) => <Chip key={p} texto={p} />)}
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        role="button"
        aria-label={`Registrar ${jogo.name}`}
        onPress={aoRegistrar || (() => router.push(`/registro/${jogo.igdb_id}`))}
        style={[
          { width: ALVO_TOQUE, height: ALVO_TOQUE, borderWidth: borda.largura, borderColor: cores.borda, borderRadius: 10, backgroundColor: cores.primario, alignItems: 'center', justifyContent: 'center' },
          sombra(cores, 3),
        ]}
      >
        <Text style={{ color: cores.textoNoPrimario, fontSize: 24, fontFamily: fonts.display, lineHeight: 26 }}>+</Text>
      </Pressable>
    </View>
  );
}

export function CampoBusca({ valor, onChange, autoFocus, placeholder = 'Buscar jogos' }) {
  const { cores, fonts, borda } = useTheme();
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderWidth: borda.largura, borderColor: cores.borda, borderRadius: 12, backgroundColor: cores.superficie, paddingHorizontal: 14 },
        sombra(cores, 4),
      ]}
    >
      <IconeBuscar cor={cores.texto} tamanho={22} />
      <TextInput
        aria-label={placeholder}
        placeholder={placeholder}
        placeholderTextColor={cores.textoSuave}
        value={valor}
        onChangeText={onChange}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        style={{ flex: 1, minHeight: 44, fontFamily: fonts.corpo, fontSize: 18, color: cores.texto }}
      />
    </View>
  );
}

/** Busca com espera de 400 ms enquanto a pessoa digita. */
export function useBuscaJogos(texto) {
  const [estado, setEstado] = useState({ itens: [], carregando: false, erro: null });
  const ultima = useRef(0);
  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) {
      setEstado({ itens: [], carregando: false, erro: null });
      return;
    }
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    const pedido = ++ultima.current;
    const t = setTimeout(async () => {
      const r = await buscarJogos(q);
      if (pedido !== ultima.current) return; // chegou uma busca mais nova
      setEstado({ itens: r.itens, carregando: false, erro: r.erro || null });
    }, 400);
    return () => clearTimeout(t);
  }, [texto]);
  return estado;
}
