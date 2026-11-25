import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Aviso, Botao, Rotulo, Tela, Texto } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { BotaoPequeno, LinhaPessoa, ListaAtividades } from '../../components/social';
import { useAuth } from '../../lib/auth';
import { atualizarContagens } from '../../lib/contagens';
import {
  apagarGrupo,
  avisosDoGrupo,
  convidarParaGrupo,
  feedGrupo,
  meusAmigos,
  meusGrupos,
  membrosDoGrupo,
  responderConvite,
  sairDoGrupo,
  tirarDoGrupo,
} from '../../lib/social';
import { useFeed } from '../../lib/useFeed';
import { useTheme } from '../../theme';

export default function Grupo() {
  const { id } = useLocalSearchParams();
  const grupoId = String(id);
  const { sessao } = useAuth();
  const userId = sessao?.user?.id;
  const { cores } = useTheme();

  const [grupo, setGrupo] = useState(undefined);
  const [membros, setMembros] = useState([]);
  const [amigos, setAmigos] = useState([]);
  const [painel, setPainel] = useState(null); // 'pessoas' | 'convidar'
  const [confirmar, setConfirmar] = useState(null);
  const [erro, setErro] = useState(null);

  const buscar = useCallback((antes) => feedGrupo(grupoId, antes), [grupoId]);
  const feed = useFeed(buscar);
  const { recarregar: recarregarFeed } = feed;

  const carregar = useCallback(async () => {
    const [gs, ms] = await Promise.all([meusGrupos(), membrosDoGrupo(grupoId)]);
    const g = gs.find((x) => x.id === grupoId) || null;
    setGrupo(g);
    setMembros(ms);
    if (g?.my_status === 'member') recarregarFeed();
  }, [grupoId, recarregarFeed]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const dono = grupo?.owner_id === userId;
  const idsNoGrupo = useMemo(() => new Set(membros.map((m) => m.user_id)), [membros]);
  const convidaveis = amigos.filter((a) => !idsNoGrupo.has(a.id));

  async function acao(promessa, depois) {
    setErro(null);
    const r = await promessa;
    if (r.erro) {
      setErro(r.erro);
      return false;
    }
    atualizarContagens();
    if (depois) depois();
    else carregar();
    return true;
  }

  function abrirPainel(nome) {
    setConfirmar(null);
    if (painel === nome) return setPainel(null);
    setPainel(nome);
    if (nome === 'convidar') meusAmigos().then(setAmigos);
  }

  function confirmarOu(chave, executar) {
    if (confirmar !== chave) return setConfirmar(chave);
    setConfirmar(null);
    executar();
  }

  if (grupo === undefined) {
    return (
      <Tela>
        <Cabecalho titulo="Grupo" />
        <ActivityIndicator color={cores.link} />
      </Tela>
    );
  }

  if (!grupo) {
    return (
      <Tela>
        <Cabecalho titulo="Grupo" />
        <Texto suave>Este grupo não existe mais ou você não faz parte dele.</Texto>
      </Tela>
    );
  }

  if (grupo.my_status === 'invited') {
    return (
      <Tela>
        <Cabecalho titulo={grupo.name} />
        {grupo.description ? <Texto>{grupo.description}</Texto> : null}
        <Texto suave style={{ fontSize: 15 }}>
          {grupo.invited_by ? `@${grupo.invited_by} convidou você. ` : ''}Ao entrar, as pessoas do grupo passam a ver os seus registros marcados como "Amigos".
        </Texto>
        <Aviso>{erro}</Aviso>
        <Botao titulo="Entrar no grupo" variante="destaque" onPress={() => acao(responderConvite(grupoId, true))} />
        <Botao titulo="Recusar convite" onPress={() => acao(responderConvite(grupoId, false), () => router.back())} />
      </Tela>
    );
  }

  const membrosAtivos = membros.filter((m) => m.status === 'member');

  return (
    <Tela>
      <Cabecalho titulo={grupo.name} />
      {grupo.description ? <Texto>{grupo.description}</Texto> : null}
      <Texto suave style={{ fontSize: 14 }}>
        Grupo privado · {membrosAtivos.length} {membrosAtivos.length === 1 ? 'pessoa' : 'pessoas'}
        {membros.length > membrosAtivos.length ? ` · ${membros.length - membrosAtivos.length} convite(s) pendente(s)` : ''}
      </Texto>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <BotaoPequeno titulo="Convidar amigos" variante={painel === 'convidar' ? 'primario' : 'neutro'} onPress={() => abrirPainel('convidar')} />
        <BotaoPequeno titulo="Pessoas" variante={painel === 'pessoas' ? 'primario' : 'neutro'} onPress={() => abrirPainel('pessoas')} />
        <BotaoPequeno
          titulo={grupo.notify ? 'Avisos ligados' : 'Avisos desligados'}
          accessibilityLabel={grupo.notify ? 'Avisos de atividade ligados. Toque para desligar.' : 'Avisos de atividade desligados. Toque para ligar.'}
          onPress={() => acao(avisosDoGrupo(grupoId, !grupo.notify))}
        />
      </View>

      <Aviso>{erro}</Aviso>

      {painel === 'convidar' ? (
        <View style={{ gap: 4 }}>
          <Rotulo>Convidar amigos</Rotulo>
          {convidaveis.length === 0 ? <Texto suave style={{ fontSize: 15 }}>Todos os seus amigos já estão no grupo ou foram convidados.</Texto> : null}
          {convidaveis.map((a) => (
            <LinhaPessoa key={a.id} pessoa={a}>
              <BotaoPequeno titulo="Convidar" variante="primario" accessibilityLabel={`Convidar @${a.username}`} onPress={() => acao(convidarParaGrupo(grupoId, a.id))} />
            </LinhaPessoa>
          ))}
        </View>
      ) : null}

      {painel === 'pessoas' ? (
        <View style={{ gap: 4 }}>
          <Rotulo>Pessoas no grupo</Rotulo>
          {membros.map((m) => (
            <LinhaPessoa
              key={m.user_id}
              pessoa={{ ...m, id: m.user_id }}
              subtitulo={`@${m.username}${m.is_owner ? ' · criou o grupo' : ''}${m.status === 'invited' ? ' · convidado' : ''}`}
            >
              {dono && !m.is_owner ? (
                <BotaoPequeno
                  titulo={confirmar === `tirar-${m.user_id}` ? 'Confirmar' : m.status === 'invited' ? 'Cancelar' : 'Tirar'}
                  accessibilityLabel={`Tirar @${m.username} do grupo`}
                  onPress={() => confirmarOu(`tirar-${m.user_id}`, () => acao(tirarDoGrupo(grupoId, m.user_id)))}
                />
              ) : null}
            </LinhaPessoa>
          ))}
          <View style={{ gap: 8, marginTop: 10 }}>
            {dono ? <BotaoPequeno titulo="Editar nome e descrição" onPress={() => router.push(`/grupo/novo?id=${grupoId}`)} /> : null}
            <BotaoPequeno
              titulo={confirmar === 'sair' ? 'Toque de novo para sair' : 'Sair do grupo'}
              onPress={() => confirmarOu('sair', () => acao(sairDoGrupo(grupoId), () => router.back()))}
            />
            {dono ? (
              <BotaoPequeno
                titulo={confirmar === 'apagar' ? 'Toque de novo para apagar o grupo' : 'Apagar grupo'}
                variante="destaque"
                onPress={() => confirmarOu('apagar', () => acao(apagarGrupo(grupoId), () => router.back()))}
              />
            ) : null}
            {dono ? (
              <Texto suave style={{ fontSize: 14 }}>Se você sair, a pessoa mais antiga do grupo passa a ser a dona.</Texto>
            ) : null}
          </View>
        </View>
      ) : null}

      <Rotulo>Atividade do grupo</Rotulo>
      <ListaAtividades
        {...feed}
        aoErro={setErro}
        vazio={<Texto suave>Ainda não há atividade. Quando alguém do grupo registrar um jogo, aparece aqui.</Texto>}
      />
    </Tela>
  );
}
