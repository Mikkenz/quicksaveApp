import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Aviso, Botao, Campo, Cartao, Rotulo, Tela, Texto } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { Opcoes } from '../../components/jogos';
import { BotaoPequeno } from '../../components/social';
import { Etiqueta } from '../../components/comunidades';
import { useAuth } from '../../lib/auth';
import { apagarPeriodo, criarPeriodo, gerarRewind, periodosAdmin, publicarRewind } from '../../lib/rewind';
import { useTheme } from '../../theme';

const TIPOS = [
  { valor: 'year', rotulo: 'Anual' },
  { valor: 'month', rotulo: 'Mensal' },
];

const anoAtual = new Date().getFullYear();
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

function Periodo({ p, aoMudar, aoErro }) {
  const { cores, fonts } = useTheme();
  const [ocupado, setOcupado] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  async function executar(chave, promessa, pedirConfirmacao) {
    if (pedirConfirmacao && confirmar !== chave) return setConfirmar(chave);
    setConfirmar(null);
    setOcupado(chave);
    const r = await promessa();
    setOcupado(null);
    if (r.erro) return aoErro(r.erro);
    aoMudar(chave === 'gerar' ? `Rewind gerado para ${r.dados} pessoas.` : null);
  }

  return (
    <Cartao style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Etiqueta texto={p.kind === 'year' ? 'Anual' : 'Mensal'} destaque />
        <Etiqueta texto={p.status === 'published' ? 'Publicado' : 'Rascunho'} />
      </View>
      <Text style={{ fontFamily: fonts.display, fontSize: 20, color: cores.texto }}>{p.title}</Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>
        {p.id} · {dataBR(p.starts_on)} a {dataBR(p.ends_on)}
      </Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: cores.textoSuave }}>
        {p.generated_at ? `Gerado em ${dataHora(p.generated_at)} para ${p.people} pessoas` : 'Ainda não gerado'}
        {p.status === 'published' ? ` · visto por ${p.seen}` : ''}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <BotaoPequeno titulo={ocupado === 'gerar' ? 'Gerando...' : p.generated_at ? 'Gerar de novo' : 'Gerar'} onPress={() => executar('gerar', () => gerarRewind(p.id))} desabilitado={!!ocupado} />
        {p.generated_at ? <BotaoPequeno titulo="Ver o meu" onPress={() => router.push(`/rewind/${p.id}`)} /> : null}
        {p.generated_at && p.status === 'draft' ? (
          <BotaoPequeno
            titulo={confirmar === 'publicar' ? 'Confirmar: avisar todo mundo' : 'Publicar'}
            variante="primario"
            onPress={() => executar('publicar', () => publicarRewind(p.id, true), true)}
            desabilitado={!!ocupado}
          />
        ) : null}
        {p.status === 'published' ? (
          <BotaoPequeno titulo={confirmar === 'despublicar' ? 'Confirmar' : 'Despublicar'} onPress={() => executar('despublicar', () => publicarRewind(p.id, false), true)} desabilitado={!!ocupado} />
        ) : null}
        <BotaoPequeno titulo={confirmar === 'apagar' ? 'Confirmar: apagar' : 'Apagar'} variante="destaque" onPress={() => executar('apagar', () => apagarPeriodo(p.id), true)} desabilitado={!!ocupado} />
      </View>
    </Cartao>
  );
}

export default function AdminRewind() {
  const { perfil } = useAuth();
  const { cores } = useTheme();
  const [lista, setLista] = useState(null);
  const [tipo, setTipo] = useState('year');
  const [codigo, setCodigo] = useState(String(anoAtual));
  const [titulo, setTitulo] = useState(`Rewind ${anoAtual}`);
  const [inicio, setInicio] = useState(`01/01/${anoAtual}`);
  const [fim, setFim] = useState(`31/12/${anoAtual}`);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLista(await periodosAdmin());
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const paraISO = (br) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  };

  async function criar() {
    setErro(null);
    setOk(null);
    const ini = paraISO(inicio);
    const fi = paraISO(fim);
    if (!ini || !fi) return setErro('Use datas no formato dd/mm/aaaa.');
    setSalvando(true);
    const r = await criarPeriodo(codigo.trim(), tipo, titulo.trim(), ini, fi);
    setSalvando(false);
    if (r.erro) return setErro(r.erro);
    setOk('Período salvo. Agora toque em Gerar.');
    carregar();
  }

  if (perfil?.role !== 'admin') {
    return (
      <Tela>
        <Cabecalho titulo="Admin" />
        <Texto suave>Só admins podem ver esta tela.</Texto>
      </Tela>
    );
  }

  return (
    <Tela>
      <Cabecalho titulo="Admin · Rewind" />
      <Texto suave style={{ fontSize: 15 }}>
        Gere a prévia, confira o seu e publique. Publicar avisa no sino todo mundo que tem Rewind no período. O mensal é criado e publicado sozinho no dia 1 (pelo pg_cron).
      </Texto>
      <Aviso>{erro}</Aviso>
      <Aviso tipo="sucesso">{ok}</Aviso>

      <View style={{ gap: 14 }}>
        {lista === null ? <ActivityIndicator color={cores.link} /> : null}
        {lista && lista.length === 0 ? <Texto suave>Nenhum período ainda.</Texto> : null}
        {(lista || []).map((p) => (
          <Periodo
            key={p.id}
            p={p}
            aoErro={setErro}
            aoMudar={(msg) => {
              setErro(null);
              setOk(msg);
              carregar();
            }}
          />
        ))}
      </View>

      <View style={{ gap: 12, marginTop: 8 }}>
        <Rotulo>Novo período (ou editar um existente pelo código)</Rotulo>
        <Opcoes
          rotulo="Tipo"
          opcoes={TIPOS}
          valor={tipo}
          colunas={2}
          onChange={(v) => {
            setTipo(v);
            if (v === 'year') {
              setCodigo(String(anoAtual));
              setTitulo(`Rewind ${anoAtual}`);
            }
          }}
        />
        <Campo rotulo="Código" value={codigo} onChangeText={setCodigo} autoCapitalize="none" dica="Ano: 2026. Mês: 2026-11." />
        <Campo rotulo="Título" value={titulo} onChangeText={setTitulo} maxLength={60} />
        <Campo rotulo="Início (dd/mm/aaaa)" value={inicio} onChangeText={setInicio} keyboardType="numbers-and-punctuation" />
        <Campo rotulo="Fim (dd/mm/aaaa)" value={fim} onChangeText={setFim} keyboardType="numbers-and-punctuation" />
        <Botao titulo="Salvar período" variante="primario" onPress={criar} carregando={salvando} />
      </View>
    </Tela>
  );
}
