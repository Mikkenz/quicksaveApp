import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Aviso, Botao, Campo, Rotulo, Tela, Texto } from '../../../components/ui';
import { Cabecalho } from '../../../components/Cabecalho';
import { BotaoPequeno, LinhaPessoa } from '../../../components/social';
import { useAuth } from '../../../lib/auth';
import {
  apagarComunidade,
  banidosDaComunidade,
  banir,
  comunidade,
  definirModerador,
  desbanir,
  editarComunidade,
  membrosDaComunidade,
} from '../../../lib/comunidades';
import { useTheme } from '../../../theme';

const PAPEL = { owner: 'dono', mod: 'moderador', member: 'membro' };

export default function GerenciarComunidade() {
  const { slug } = useLocalSearchParams();
  const { sessao } = useAuth();
  const userId = sessao?.user?.id;
  const { cores } = useTheme();
  const [c, setC] = useState(undefined);
  const [membros, setMembros] = useState([]);
  const [banidos, setBanidos] = useState([]);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [regras, setRegras] = useState('');
  const [confirmar, setConfirmar] = useState(null);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const com = await comunidade(String(slug || ''));
    setC(com);
    if (!com) return;
    setNome(com.name);
    setDescricao(com.description || '');
    setRegras(com.rules || '');
    const [m, b] = await Promise.all([membrosDaComunidade(com.id), banidosDaComunidade(com.id)]);
    setMembros(m);
    setBanidos(b);
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function acao(promessa, mensagem) {
    setErro(null);
    setOk(null);
    setConfirmar(null);
    const r = await promessa;
    if (r.erro) return setErro(r.erro);
    if (mensagem) setOk(mensagem);
    carregar();
  }

  function confirmarOu(chave, fn) {
    if (confirmar !== chave) return setConfirmar(chave);
    fn();
  }

  async function salvar() {
    if (nome.trim().length < 3) return setErro('O nome precisa ter pelo menos 3 letras.');
    setSalvando(true);
    await acao(editarComunidade(c.id, nome.trim(), descricao.trim(), regras.trim()), 'Informações salvas.');
    setSalvando(false);
  }

  if (c === undefined) {
    return (
      <Tela>
        <Cabecalho titulo="Gerenciar" />
        <ActivityIndicator color={cores.link} />
      </Tela>
    );
  }
  if (!c || !c.can_moderate) {
    return (
      <Tela>
        <Cabecalho titulo="Gerenciar" />
        <Texto suave>Só quem modera a comunidade pode ver esta tela.</Texto>
      </Tela>
    );
  }

  const dono = c.my_role === 'owner';

  return (
    <Tela>
      <Cabecalho titulo="Gerenciar" />
      <Texto suave style={{ fontSize: 15 }}>{c.name}</Texto>
      <Aviso>{erro}</Aviso>
      <Aviso tipo="sucesso">{ok}</Aviso>

      {dono ? (
        <View style={{ gap: 12 }}>
          <Rotulo>Informações</Rotulo>
          <Campo rotulo="Nome" value={nome} onChangeText={setNome} maxLength={50} />
          <Campo rotulo="Descrição" value={descricao} onChangeText={setDescricao} maxLength={300} multiline dica={`${descricao.length}/300`} />
          <Campo rotulo="Regras" value={regras} onChangeText={setRegras} maxLength={2000} multiline dica={`${regras.length}/2000`} />
          <Botao titulo="Salvar informações" variante="primario" onPress={salvar} carregando={salvando} />
        </View>
      ) : null}

      <View style={{ gap: 4 }}>
        <Rotulo>Membros ({membros.length})</Rotulo>
        {dono ? <Texto suave style={{ fontSize: 14 }}>Você pode nomear até 5 moderadores. Eles fixam, trancam e removem tópicos e banem pessoas.</Texto> : null}
        {membros.map((m) => {
          const eu = m.user_id === userId;
          const podeBanir = !eu && m.role !== 'owner' && (m.role !== 'mod' || dono);
          return (
            <LinhaPessoa key={m.user_id} pessoa={{ ...m, id: m.user_id }} subtitulo={`@${m.username} · ${PAPEL[m.role]}`}>
              <View style={{ gap: 4, alignItems: 'flex-end' }}>
                {dono && !eu ? (
                  <BotaoPequeno
                    titulo={m.role === 'mod' ? 'Tirar moderação' : 'Tornar moderador'}
                    onPress={() => acao(definirModerador(c.id, m.user_id, m.role !== 'mod'))}
                  />
                ) : null}
                {podeBanir ? (
                  <BotaoPequeno
                    titulo={confirmar === `banir-${m.user_id}` ? 'Confirmar banimento' : 'Banir'}
                    variante={confirmar === `banir-${m.user_id}` ? 'destaque' : 'neutro'}
                    accessibilityLabel={`Banir @${m.username}`}
                    onPress={() => confirmarOu(`banir-${m.user_id}`, () => acao(banir(c.id, m.user_id), `@${m.username} foi banido.`))}
                  />
                ) : null}
              </View>
            </LinhaPessoa>
          );
        })}
      </View>

      {banidos.length ? (
        <View style={{ gap: 4 }}>
          <Rotulo>Banidos</Rotulo>
          {banidos.map((b) => (
            <LinhaPessoa key={b.user_id} pessoa={{ id: b.user_id, username: b.username }} aoTocar={() => {}}>
              <BotaoPequeno titulo="Desbanir" accessibilityLabel={`Desbanir @${b.username}`} onPress={() => acao(desbanir(c.id, b.user_id))} />
            </LinhaPessoa>
          ))}
        </View>
      ) : null}

      {dono ? (
        <View style={{ gap: 8, marginTop: 12 }}>
          <Rotulo>Zona de perigo</Rotulo>
          <Botao
            titulo={confirmar === 'apagar' ? 'Toque de novo para apagar tudo' : 'Apagar comunidade'}
            variante="destaque"
            onPress={() =>
              confirmarOu('apagar', async () => {
                const r = await apagarComunidade(c.id);
                if (r.erro) return setErro(r.erro);
                router.replace('/comunidades');
              })
            }
          />
          <Texto suave style={{ fontSize: 14 }}>Apaga a comunidade com todos os tópicos e respostas. Não dá para desfazer.</Texto>
        </View>
      ) : null}
    </Tela>
  );
}
