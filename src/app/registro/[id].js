import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Aviso, Botao, Rotulo, Texto, Titulo } from '../../components/ui';
import { Caixa } from '../../components/CamposPerfil';
import { Capa, Opcoes } from '../../components/jogos';
import { useAuth } from '../../lib/auth';
import { useJogo } from '../../lib/useJogo';
import { PLATAFORMAS, STATUS, VISIBILIDADE, apagarRegistro, dataCurta, meuRegistro, salvarRegistro } from '../../lib/registros';
import { ALVO_TOQUE, useTheme } from '../../theme';

const NOTAS = Array.from({ length: 10 }, (_, i) => ({ valor: i + 1, rotulo: String(i + 1), mono: true, descricao: `Nota ${i + 1}` }));

export default function Registrar() {
  const { id } = useLocalSearchParams();
  const gameId = Number(id);
  const { sessao, menorDeIdade } = useAuth();
  const userId = sessao?.user?.id;
  const { cores, fonts, borda } = useTheme();
  const { jogo, erro: erroJogo } = useJogo(id);

  const [carregado, setCarregado] = useState(false);
  const [existe, setExiste] = useState(false);
  const [status, setStatus] = useState('playing');
  const [plataforma, setPlataforma] = useState(null);
  const [nota, setNota] = useState(null);
  const [review, setReview] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [visibilidade, setVisibilidade] = useState('friends');
  const [datas, setDatas] = useState({});
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);

  useEffect(() => {
    if (!userId || !Number.isInteger(gameId)) return;
    meuRegistro(userId, gameId).then((r) => {
      if (r) {
        setExiste(true);
        setStatus(r.status);
        setPlataforma(r.platform);
        setNota(r.rating);
        setReview(r.review || '');
        setSpoiler(r.has_spoilers);
        setVisibilidade(r.visibility);
        setDatas({ started_at: r.started_at, finished_at: r.finished_at });
      }
      setCarregado(true);
    });
  }, [userId, gameId]);

  function fechar() {
    if (router.canGoBack()) router.back();
    else router.replace(`/jogo/${gameId}`);
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const r = await salvarRegistro(userId, gameId, {
      status,
      platform: plataforma,
      rating: nota,
      review: review.trim() || null,
      has_spoilers: spoiler,
      visibility: menorDeIdade ? 'friends' : visibilidade,
    });
    setSalvando(false);
    if (r.erro) setErro(r.erro);
    else fechar();
  }

  async function apagar() {
    if (!confirmarApagar) {
      setConfirmarApagar(true);
      return;
    }
    setSalvando(true);
    const r = await apagarRegistro(userId, gameId);
    setSalvando(false);
    if (r.erro) setErro(r.erro);
    else fechar();
  }

  const textoData =
    status === 'finished' && datas.finished_at
      ? `Terminei em ${dataCurta(datas.finished_at, true)}`
      : status === 'playing' && datas.started_at
        ? `Comecei em ${dataCurta(datas.started_at, true)}`
        : status === 'finished'
          ? 'A data de hoje fica como término.'
          : status === 'playing'
            ? 'A data de hoje fica como início.'
            : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Capa imageId={jogo?.cover_image_id} nome={jogo?.name} largura={48} tamanho="t_cover_small" />
          <View style={{ flex: 1 }}>
            <Rotulo>{existe ? 'Editar registro' : 'Registrar'}</Rotulo>
            <Titulo nivel={2} style={{ fontSize: 22 }}>{jogo?.name || ' '}</Titulo>
          </View>
          <Pressable role="button" aria-label="Fechar" onPress={fechar} style={{ width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 26, color: cores.texto, fontFamily: fonts.display }}>×</Text>
          </Pressable>
        </View>

        <Aviso>{erroJogo}</Aviso>
        {!carregado ? <ActivityIndicator color={cores.primario} /> : null}

        <View style={{ gap: 8 }}>
          <Rotulo>Status</Rotulo>
          <Opcoes rotulo="Status" colunas={4} opcoes={STATUS.map((s) => ({ valor: s.valor, rotulo: s.rotulo, descricao: s.longo }))} valor={status} onChange={setStatus} />
          {textoData ? <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>{textoData}</Text> : null}
        </View>

        <View style={{ gap: 8 }}>
          <Rotulo>Plataforma</Rotulo>
          <Opcoes rotulo="Plataforma" opcoes={PLATAFORMAS.map((p) => ({ valor: p, rotulo: p, mono: true }))} valor={plataforma} onChange={setPlataforma} permitirLimpar />
        </View>

        <View style={{ gap: 8 }}>
          <Rotulo>Nota (1 a 10)</Rotulo>
          <Opcoes rotulo="Nota de 1 a 10" opcoes={NOTAS} valor={nota} onChange={setNota} colunas={5} permitirLimpar />
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>Toque de novo na nota para tirar.</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Rotulo>Review (opcional)</Rotulo>
          <TextInput
            aria-label="Review"
            multiline
            value={review}
            onChangeText={setReview}
            maxLength={5000}
            placeholder="O que você achou?"
            placeholderTextColor={cores.textoSuave}
            style={{
              minHeight: 110,
              textAlignVertical: 'top',
              borderWidth: borda.largura,
              borderColor: cores.borda,
              borderRadius: 12,
              backgroundColor: cores.superficie,
              padding: 12,
              fontFamily: fonts.corpo,
              fontSize: 16,
              color: cores.texto,
            }}
          />
          <Caixa marcado={spoiler} onChange={setSpoiler}>
            <Texto style={{ fontSize: 15 }}>Contém spoilers</Texto>
          </Caixa>
        </View>

        <View style={{ gap: 8 }}>
          <Rotulo>Quem pode ver</Rotulo>
          {menorDeIdade ? (
            <Texto suave style={{ fontSize: 15 }}>Como você tem menos de 18 anos, seus registros ficam visíveis só para amigos.</Texto>
          ) : (
            <Opcoes rotulo="Quem pode ver" opcoes={VISIBILIDADE} valor={visibilidade} onChange={setVisibilidade} colunas={2} />
          )}
        </View>

        <Aviso>{erro}</Aviso>
        <Botao titulo="Salvar" variante="destaque" onPress={salvar} carregando={salvando} desabilitado={!carregado || !jogo} />
        {existe ? (
          <Botao titulo={confirmarApagar ? 'Toque de novo para apagar' : 'Apagar registro'} onPress={apagar} desabilitado={salvando} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
