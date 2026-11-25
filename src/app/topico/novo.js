import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Aviso, Botao, Campo, Rotulo, Tela, Texto } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { Opcoes } from '../../components/jogos';
import { SeletorJogos } from '../../components/SeletorJogos';
import { MarcarSpoiler } from '../../components/Spoiler';
import { TIPOS_TOPICO, criarTopico, editarTopico, topico } from '../../lib/comunidades';
import { useTheme } from '../../theme';

// Novo tópico (?comunidade=<id>&nome=<nome>) ou edição (?editar=<id do tópico>)
export default function NovoTopico() {
  const { comunidade: comunidadeId, nome: nomeComunidade, editar } = useLocalSearchParams();
  const { cores, fonts, borda } = useTheme();
  const [tipo, setTipo] = useState('discussao');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [jogos, setJogos] = useState([]);
  const [spoiler, setSpoiler] = useState(false);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!editar) return;
    topico(Number(editar)).then((t) => {
      if (!t) return;
      setTipo(t.kind);
      setTitulo(t.title);
      setTexto(t.body || '');
      setJogos(t.games || []);
      setSpoiler(Boolean(t.has_spoilers));
    });
  }, [editar]);

  async function publicar() {
    setErro(null);
    if (titulo.trim().length < 3) return setErro('O título precisa ter pelo menos 3 letras.');
    if (tipo === 'indicacao' && jogos.length === 0) return setErro('Numa indicação, anexe pelo menos um jogo.');
    setSalvando(true);
    const ids = jogos.map((j) => j.id);
    const r = editar
      ? await editarTopico(Number(editar), tipo, titulo.trim(), texto.trim(), ids, spoiler)
      : await criarTopico(comunidadeId, tipo, titulo.trim(), texto.trim(), ids, spoiler);
    setSalvando(false);
    if (r.erro) return setErro(r.erro);
    if (editar) router.back();
    else router.replace(`/topico/${r.dados}`);
  }

  return (
    <Tela>
      <Cabecalho titulo={editar ? 'Editar tópico' : 'Novo tópico'} />
      {nomeComunidade ? <Texto suave style={{ fontSize: 15 }}>em {nomeComunidade}</Texto> : null}

      <View style={{ gap: 8 }}>
        <Rotulo>Tipo</Rotulo>
        <Opcoes rotulo="Tipo do tópico" opcoes={TIPOS_TOPICO} valor={tipo} onChange={setTipo} colunas={3} />
      </View>
      <Campo rotulo="Título" value={titulo} onChangeText={setTitulo} maxLength={120} dica={`${titulo.length}/120`} />
      <View style={{ gap: 6 }}>
        <Rotulo>Texto</Rotulo>
        <TextInput
          aria-label="Texto do tópico"
          value={texto}
          onChangeText={setTexto}
          maxLength={5000}
          multiline
          placeholder={tipo === 'indicacao' ? 'Por que você indica? Para quem?' : tipo === 'pergunta' ? 'Explique sua dúvida' : 'Sobre o que vamos conversar?'}
          placeholderTextColor={cores.textoSuave}
          style={{ minHeight: 150, textAlignVertical: 'top', borderWidth: borda.largura, borderColor: cores.borda, borderRadius: 12, backgroundColor: cores.superficie, padding: 12, fontFamily: fonts.corpo, fontSize: 16, color: cores.texto }}
        />
        <Texto suave style={{ fontSize: 13 }}>{texto.length}/5000</Texto>
        <MarcarSpoiler valor={spoiler} onChange={setSpoiler} />
        <Texto suave style={{ fontSize: 13 }}>O título continua visível. Não coloque o spoiler no título.</Texto>
      </View>
      <SeletorJogos valor={jogos} onChange={setJogos} maximo={5} />
      <Aviso>{erro}</Aviso>
      <Botao titulo={editar ? 'Salvar' : 'Publicar'} variante="destaque" onPress={publicar} carregando={salvando} />
    </Tela>
  );
}
