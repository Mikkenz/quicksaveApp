import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Aviso, Botao, Campo, Tela, Texto } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { useAuth } from '../../lib/auth';
import { criarComunidade, criarEndereco } from '../../lib/comunidades';

export default function NovaComunidade() {
  const { menorDeIdade } = useAuth();
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [enderecoMexido, setEnderecoMexido] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [regras, setRegras] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const enderecoFinal = enderecoMexido ? endereco : criarEndereco(nome);

  async function criar() {
    setErro(null);
    const limpo = criarEndereco(enderecoFinal);
    if (nome.trim().length < 3) return setErro('O nome precisa ter pelo menos 3 letras.');
    if (limpo.length < 3) return setErro('O endereço precisa ter pelo menos 3 letras ou números.');
    setSalvando(true);
    const r = await criarComunidade(nome.trim(), limpo, descricao.trim(), regras.trim());
    setSalvando(false);
    if (r.erro) return setErro(r.erro);
    router.replace(`/comunidade/${r.dados}`);
  }

  if (menorDeIdade) {
    return (
      <Tela>
        <Cabecalho titulo="Nova comunidade" />
        <Aviso tipo="info">No beta, só maiores de 18 anos podem criar comunidades.</Aviso>
      </Tela>
    );
  }

  return (
    <Tela>
      <Cabecalho titulo="Nova comunidade" />
      <Texto suave style={{ fontSize: 15 }}>
        Comunidades são públicas: qualquer pessoa pode ler e participar. Você vira dono e pode nomear até 5 moderadores.
      </Texto>
      <Campo rotulo="Nome" value={nome} onChangeText={setNome} maxLength={50} placeholder="Ex.: Jogos de terror" dica={`${nome.length}/50`} />
      <Campo
        rotulo="Endereço"
        value={enderecoFinal}
        onChangeText={(t) => {
          setEnderecoMexido(true);
          // Enquanto digita, deixa o hífen do fim (ele só some ao criar)
          setEndereco(
            t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 36)
          );
        }}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={36}
        dica={`Endereço no app: /comunidade/${enderecoFinal || 'endereco'}. Não muda depois.`}
      />
      <Campo rotulo="Descrição (opcional)" value={descricao} onChangeText={setDescricao} maxLength={300} multiline dica={`${descricao.length}/300`} />
      <Campo
        rotulo="Regras (opcional)"
        value={regras}
        onChangeText={setRegras}
        maxLength={2000}
        multiline
        placeholder="Ex.: Marque spoilers. Sem ofensas. Indicações com o motivo."
        dica="Aparecem para quem for participar."
      />
      <Aviso>{erro}</Aviso>
      <View style={{ flex: 1 }} />
      <Botao titulo="Criar comunidade" variante="destaque" onPress={criar} carregando={salvando} />
    </Tela>
  );
}
