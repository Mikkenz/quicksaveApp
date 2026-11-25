import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Aviso, Botao, Rotulo, Tela, Texto } from '../../components/ui';
import { CabecalhoAba } from '../../components/Cabecalho';
import { CampoBusca } from '../../components/busca';
import { IconeGrupo } from '../../components/icons';
import { BotaoPequeno, BotaoRelacao, LinhaPessoa } from '../../components/social';
import { useAuth } from '../../lib/auth';
import { AvisoResponsavel } from '../../components/AvisoConta';
import { atualizarContagens } from '../../lib/contagens';
import {
  buscarPessoas,
  desbloquear,
  meusAmigos,
  meusBloqueios,
  meusGrupos,
  pedidosDeAmizade,
  responderConvite,
  responderPedido,
} from '../../lib/social';
import { ALVO_TOQUE, useTheme } from '../../theme';

function Secao({ titulo, children }) {
  return (
    <View style={{ gap: 4 }}>
      <Rotulo>{titulo}</Rotulo>
      {children}
    </View>
  );
}

function BuscaPessoas({ texto, aoErro }) {
  const [itens, setItens] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const ultima = useRef(0);

  useEffect(() => {
    const q = texto.trim();
    if (q.replace('@', '').length < 2) {
      setItens([]);
      return;
    }
    setBuscando(true);
    const meu = ++ultima.current;
    const t = setTimeout(async () => {
      const r = await buscarPessoas(q);
      if (meu !== ultima.current) return;
      setItens(r);
      setBuscando(false);
    }, 350);
    return () => clearTimeout(t);
  }, [texto]);

  return (
    <Secao titulo="Pessoas">
      {!buscando && itens.length === 0 ? (
        <Texto suave style={{ fontSize: 15 }}>Ninguém encontrado. Para menores de 18, digite o @ exato.</Texto>
      ) : null}
      {itens.map((p) => (
        <LinhaPessoa key={p.id} pessoa={p}>
          <BotaoRelacao
            pessoa={p}
            relacao={p.relation}
            aoMudar={(nova, erro) => (erro ? aoErro(erro) : setItens((l) => l.map((x) => (x.id === p.id ? { ...x, relation: nova } : x))))}
          />
        </LinhaPessoa>
      ))}
    </Secao>
  );
}

function LinhaGrupo({ g }) {
  const { cores, fonts, borda } = useTheme();
  return (
    <Pressable
      role="link"
      aria-label={`Grupo ${g.name}, ${g.members} ${g.members === 1 ? 'pessoa' : 'pessoas'}`}
      onPress={() => router.push(`/grupo/${g.id}`)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, minHeight: ALVO_TOQUE, borderBottomWidth: 2, borderColor: cores.divisor }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 10, borderWidth: borda.largura, borderColor: cores.borda, backgroundColor: cores.primario, alignItems: 'center', justifyContent: 'center' }}>
        <IconeGrupo cor={cores.textoNoPrimario} tamanho={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 16, color: cores.texto }} numberOfLines={1}>{g.name}</Text>
        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>
          {g.members} {g.members === 1 ? 'pessoa' : 'pessoas'}
        </Text>
      </View>
    </Pressable>
  );
}

export default function Amigos() {
  const { precisaAutorizacao } = useAuth();
  const { fonts } = useTheme();
  const [busca, setBusca] = useState('');
  const [amigos, setAmigos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [bloqueios, setBloqueios] = useState([]);
  const [carregou, setCarregou] = useState(false);
  const [erro, setErro] = useState(null);

  const recarregar = useCallback(async () => {
    const [a, p, g, b] = await Promise.all([meusAmigos(), pedidosDeAmizade(), meusGrupos(), meusBloqueios()]);
    setAmigos(a);
    setPedidos(p);
    setGrupos(g);
    setBloqueios(b);
    setCarregou(true);
    atualizarContagens();
  }, []);

  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar])
  );

  async function acao(promessa) {
    setErro(null);
    const r = await promessa;
    if (r.erro) setErro(r.erro);
    recarregar();
  }

  const recebidos = pedidos.filter((p) => p.direction === 'received');
  const enviados = pedidos.filter((p) => p.direction === 'sent');
  const convites = grupos.filter((g) => g.my_status === 'invited');
  const membro = grupos.filter((g) => g.my_status === 'member');

  if (precisaAutorizacao) {
    return (
      <Tela>
        <CabecalhoAba titulo="Amigos" />
        <AvisoResponsavel texto="Para adicionar amigos e entrar em grupos, seu responsável precisa autorizar. Enquanto isso, você pode usar o seu diário normalmente." />
      </Tela>
    );
  }

  return (
    <Tela>
      <CabecalhoAba titulo="Amigos">
        <CampoBusca valor={busca} onChange={setBusca} placeholder="Buscar pessoas por @ ou nome" />
      </CabecalhoAba>
      <Aviso>{erro}</Aviso>

      {busca.trim().length >= 2 ? (
        <BuscaPessoas texto={busca} aoErro={setErro} />
      ) : (
        <>
          {recebidos.length ? (
            <Secao titulo={`Pedidos recebidos (${recebidos.length})`}>
              {recebidos.map((p) => (
                <LinhaPessoa key={p.id} pessoa={p}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <BotaoPequeno titulo="Aceitar" variante="primario" accessibilityLabel={`Aceitar pedido de @${p.username}`} onPress={() => acao(responderPedido(p.id, true))} />
                    <BotaoPequeno titulo="Recusar" accessibilityLabel={`Recusar pedido de @${p.username}`} onPress={() => acao(responderPedido(p.id, false))} />
                  </View>
                </LinhaPessoa>
              ))}
            </Secao>
          ) : null}

          {convites.length ? (
            <Secao titulo={`Convites para grupos (${convites.length})`}>
              {convites.map((g) => (
                <View key={g.id} style={{ gap: 8, paddingVertical: 8 }}>
                  <Texto style={{ fontSize: 16 }}>
                    {g.invited_by ? `@${g.invited_by} convidou você para ` : 'Convite para '}
                    <Text style={{ fontFamily: fonts.corpoForte }}>{g.name}</Text> ({g.members} {g.members === 1 ? 'pessoa' : 'pessoas'}).
                  </Texto>
                  <Texto suave style={{ fontSize: 14 }}>
                    Ao entrar, as pessoas do grupo passam a ver os seus registros marcados como "Amigos".
                  </Texto>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <BotaoPequeno titulo="Entrar no grupo" variante="primario" onPress={() => acao(responderConvite(g.id, true))} />
                    <BotaoPequeno titulo="Recusar" onPress={() => acao(responderConvite(g.id, false))} />
                  </View>
                </View>
              ))}
            </Secao>
          ) : null}

          <Secao titulo="Grupos">
            {carregou && membro.length === 0 ? (
              <Texto suave style={{ fontSize: 15 }}>Crie um grupo privado para acompanhar o que um círculo de amigos está jogando.</Texto>
            ) : null}
            {membro.map((g) => <LinhaGrupo key={g.id} g={g} />)}
            <View style={{ marginTop: 8 }}>
              <Botao titulo="Criar grupo" onPress={() => router.push('/grupo/novo')} />
            </View>
          </Secao>

          <Secao titulo={`Amigos (${amigos.length})`}>
            {carregou && amigos.length === 0 ? (
              <Texto suave style={{ fontSize: 15 }}>Busque pessoas pelo @ ou pelo nome no campo acima.</Texto>
            ) : null}
            {amigos.map((a) => <LinhaPessoa key={a.id} pessoa={a} />)}
          </Secao>

          {enviados.length ? (
            <Secao titulo={`Pedidos enviados (${enviados.length})`}>
              {enviados.map((p) => (
                <LinhaPessoa key={p.id} pessoa={p} subtitulo={`@${p.username} · aguardando`}>
                  <BotaoRelacao pessoa={p} relacao="sent" aoMudar={(n, e) => (e ? setErro(e) : recarregar())} />
                </LinhaPessoa>
              ))}
            </Secao>
          ) : null}

          {bloqueios.length ? (
            <Secao titulo="Bloqueados">
              {bloqueios.map((b) => (
                <LinhaPessoa key={b.id} pessoa={b} aoTocar={() => {}}>
                  <BotaoPequeno titulo="Desbloquear" accessibilityLabel={`Desbloquear @${b.username}`} onPress={() => acao(desbloquear(b.id))} />
                </LinhaPessoa>
              ))}
            </Secao>
          ) : null}
        </>
      )}
    </Tela>
  );
}
