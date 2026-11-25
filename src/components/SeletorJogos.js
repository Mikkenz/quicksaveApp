import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Rotulo, Texto } from './ui';
import { Capa } from './jogos';
import { CampoBusca, useBuscaJogos } from './busca';
import { anoDe } from '../lib/igdb';
import { ALVO_TOQUE, useTheme } from '../theme';

/** Capas dos jogos anexados a um tópico ou resposta. jogos: [{ id, name, cover }] */
export function JogosAnexados({ jogos, largura = 64 }) {
  const { cores, fonts } = useTheme();
  if (!jogos?.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
      {jogos.map((j) => (
        <Pressable key={j.id} role="link" aria-label={`Abrir ${j.name}`} onPress={() => router.push(`/jogo/${j.id}`)} style={{ width: largura, gap: 4 }}>
          <Capa imageId={j.cover} nome={j.name} largura={largura} tamanho="t_cover_small" />
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: cores.texto }} numberOfLines={2}>{j.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Escolhe até "maximo" jogos pela busca do IGDB. valor: [{ id, name, cover }] */
export function SeletorJogos({ valor, onChange, maximo = 5 }) {
  const { cores, fonts, borda } = useTheme();
  const [texto, setTexto] = useState('');
  const { itens, carregando } = useBuscaJogos(texto);
  const cheio = valor.length >= maximo;

  function adicionar(j) {
    if (cheio || valor.some((v) => v.id === j.igdb_id)) return;
    onChange([...valor, { id: j.igdb_id, name: j.name, cover: j.cover_image_id }]);
    setTexto('');
  }

  return (
    <View style={{ gap: 8 }}>
      <Rotulo>Jogos anexados ({valor.length}/{maximo})</Rotulo>
      {valor.map((j) => (
        <View key={j.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: cores.borda, borderRadius: 10, padding: 6, backgroundColor: cores.superficie }}>
          <Capa imageId={j.cover} nome={j.name} largura={32} tamanho="t_cover_small" />
          <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 14, color: cores.texto }} numberOfLines={1}>{j.name}</Text>
          <Pressable
            role="button"
            aria-label={`Tirar ${j.name}`}
            onPress={() => onChange(valor.filter((v) => v.id !== j.id))}
            style={{ width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: cores.texto }}>×</Text>
          </Pressable>
        </View>
      ))}
      {cheio ? (
        <Texto suave style={{ fontSize: 14 }}>Limite de {maximo} jogos atingido.</Texto>
      ) : (
        <>
          <CampoBusca valor={texto} onChange={setTexto} placeholder="Buscar um jogo para anexar" />
          {carregando ? <ActivityIndicator color={cores.link} /> : null}
          {texto.trim().length >= 2
            ? itens.slice(0, 6).map((j) => (
                <Pressable
                  key={j.igdb_id}
                  role="button"
                  aria-label={`Anexar ${j.name}`}
                  onPress={() => adicionar(j)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: ALVO_TOQUE, paddingVertical: 4, borderBottomWidth: 2, borderColor: cores.divisor }}
                >
                  <Capa imageId={j.cover_image_id} nome={j.name} largura={32} tamanho="t_cover_small" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 14, color: cores.texto }} numberOfLines={1}>{j.name}</Text>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: cores.textoSuave }}>{anoDe(j.first_release) || ''}</Text>
                  </View>
                  <View style={{ borderWidth: borda.largura, borderColor: cores.borda, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: cores.primario }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 13, color: cores.textoNoPrimario }}>Anexar</Text>
                  </View>
                </Pressable>
              ))
            : null}
        </>
      )}
    </View>
  );
}
