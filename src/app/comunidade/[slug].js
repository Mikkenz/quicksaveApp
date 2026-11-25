import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Aviso, Botao, Cartao, Rotulo, Tela, Texto } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { Opcoes } from '../../components/jogos';
import { BotaoPequeno } from '../../components/social';
import { CartaoTopico } from '../../components/comunidades';
import { Denunciar } from '../../components/Denunciar';
import { CampoBusca } from '../../components/busca';
import { useAuth } from '../../lib/auth';
import {
  TIPOS_TOPICO,
  TOPICOS_POR_PAGINA,
  buscarTopicos,
  comunidade,
  marcarVista,
  participar,
  sairDaComunidade,
  topicos,
} from '../../lib/comunidades';
import { useTheme } from '../../theme';

const FILTROS = [{ valor: 'todos', rotulo: 'Todos' }, ...TIPOS_TOPICO];

export default function PaginaComunidade() {
  const { slug } = useLocalSearchParams();
  const { menorDeIdade } = useAuth();
  const { cores } = useTheme();
  const [c, setC] = useState(undefined);
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [verRegras, setVerRegras] = useState(false);
  const [confirmarEntrada, setConfirmarEntrada] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [erro, setErro] = useState(null);
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const ultimaBusca = useRef(0);
  const comunidadeId = c?.id;

  // Busca de tópicos só nesta comunidade
  useEffect(() => {
    const q = busca.trim();
    if (!comunidadeId || q.length < 2) {
      setAchados([]);
      return;
    }
    setBuscando(true);
    const meu = ++ultimaBusca.current;
    const t = setTimeout(async () => {
      const r = await buscarTopicos(q, comunidadeId);
      if (meu !== ultimaBusca.current) return;
      setAchados(r);
      setBuscando(false);
    }, 350);
    return () => clearTimeout(t);
  }, [busca, comunidadeId]);

  const carregarTopicos = useCallback(async (com, tipo, offset = 0) => {
    setCarregando(true);
    const pagina = await topicos(com.id, tipo === 'todos' ? null : tipo, offset);
    setLista((atual) => (offset === 0 ? pagina : [...atual, ...pagina.filter((p) => !atual.some((a) => a.id === p.id))]));
    setTemMais(pagina.length === TOPICOS_POR_PAGINA);
    setCarregando(false);
  }, []);

  const carregar = useCallback(async () => {
    const com = await comunidade(String(slug || ''));
    setC(com);
    if (!com) return;
    carregarTopicos(com, filtro, 0);
    if (com.my_role) marcarVista(com.id);
  }, [slug, filtro, carregarTopicos]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function entrar() {
    // Mostra as regras antes de entrar
    if (c.rules && !confirmarEntrada) {
      setConfirmarEntrada(true);
      setVerRegras(true);
      return;
    }
    setErro(null);
    const r = await participar(c.id);
    setConfirmarEntrada(false);
    if (r.erro) return setErro(r.erro);
    carregar();
  }

  async function sair() {
    if (!confirmarSaida) return setConfirmarSaida(true);
    setConfirmarSaida(false);
    setErro(null);
    const r = await sairDaComunidade(c.id);
    if (r.erro) return setErro(r.erro);
    carregar();
  }

  if (c === undefined) {
    return (
      <Tela>
        <Cabecalho titulo="Comunidade" />
        <ActivityIndicator color={cores.link} />
      </Tela>
    );
  }

  if (!c) {
    return (
      <Tela>
        <Cabecalho titulo="Comunidade" />
        <Texto suave>Comunidade não encontrada.</Texto>
      </Tela>
    );
  }

  const membros = `${c.members} ${c.members === 1 ? 'membro' : 'membros'}`;

  return (
    <Tela>
      <Cabecalho titulo={c.name} />
      {c.description ? <Texto>{c.description}</Texto> : null}
      <Texto suave style={{ fontSize: 14 }}>
        {membros}{c.owner_username ? ` · criada por @${c.owner_username}` : ''}
      </Texto>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {c.banned ? (
          <BotaoPequeno titulo="Você foi banido" desabilitado />
        ) : !c.my_role ? (
          <BotaoPequeno titulo={confirmarEntrada ? 'Aceito as regras, participar' : 'Participar'} variante="primario" onPress={entrar} />
        ) : c.my_role === 'owner' ? null : (
          <BotaoPequeno titulo={confirmarSaida ? 'Toque de novo para sair' : 'Sair da comunidade'} onPress={sair} />
        )}
        {c.rules ? <BotaoPequeno titulo={verRegras ? 'Esconder regras' : 'Regras'} onPress={() => setVerRegras(!verRegras)} /> : null}
        {c.can_moderate ? <BotaoPequeno titulo="Gerenciar" onPress={() => router.push(`/comunidade/gerenciar/${c.slug}`)} /> : null}
        {c.can_moderate && c.open_reports ? (
          <BotaoPequeno titulo={`Denúncias (${c.open_reports})`} variante="destaque" onPress={() => router.push('/denuncias')} />
        ) : null}
        {c.my_role === 'owner' ? null : <Denunciar tipo="community" alvo={c.id} descricao="esta comunidade" />}
      </View>

      {verRegras && c.rules ? (
        <Cartao style={{ gap: 6 }}>
          <Rotulo>Regras</Rotulo>
          <Texto style={{ fontSize: 16 }}>{c.rules}</Texto>
        </Cartao>
      ) : null}

      <Aviso>{erro}</Aviso>

      {c.can_post ? (
        <Botao titulo="Novo tópico" variante="destaque" onPress={() => router.push(`/topico/novo?comunidade=${c.id}&nome=${encodeURIComponent(c.name)}`)} />
      ) : c.my_role && menorDeIdade ? (
        <Aviso tipo="info">Você pode ler e curtir. Postar e responder fica liberado a partir dos 18 anos.</Aviso>
      ) : !c.my_role && !c.banned ? (
        <Texto suave style={{ fontSize: 15 }}>Toque em Participar para postar e responder.</Texto>
      ) : null}

      <BotaoPequeno
        titulo={mostrarBusca ? 'Fechar busca' : 'Buscar tópicos'}
        onPress={() => {
          setMostrarBusca(!mostrarBusca);
          setBusca('');
        }}
      />

      {mostrarBusca ? (
        <View style={{ gap: 12 }}>
          <CampoBusca valor={busca} onChange={setBusca} placeholder={`Buscar em ${c.name}`} autoFocus />
          {buscando ? <ActivityIndicator color={cores.link} /> : null}
          {busca.trim().length < 2 ? (
            <Texto suave style={{ fontSize: 15 }}>Digite pelo menos 2 letras. A busca olha o título e o texto dos tópicos.</Texto>
          ) : !buscando && achados.length === 0 ? (
            <Texto suave style={{ fontSize: 15 }}>Nenhum tópico encontrado.</Texto>
          ) : null}
          {achados.map((t) => <CartaoTopico key={t.id} t={{ ...t, community_name: null }} />)}
        </View>
      ) : (
      <>
      <Opcoes rotulo="Filtrar tópicos" opcoes={FILTROS} valor={filtro} onChange={setFiltro} colunas={2} />

      <View style={{ gap: 14 }}>
        {!carregando && lista.length === 0 ? <Texto suave>Nenhum tópico ainda.</Texto> : null}
        {lista.map((t) => <CartaoTopico key={t.id} t={t} />)}
        {temMais ? <BotaoPequeno titulo="Carregar mais" onPress={() => carregarTopicos(c, filtro, lista.length)} desabilitado={carregando} /> : null}
        {carregando ? <ActivityIndicator color={cores.link} /> : null}
      </View>
      </>
      )}
    </Tela>
  );
}
