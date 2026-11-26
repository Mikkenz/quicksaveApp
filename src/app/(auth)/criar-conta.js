import { useState } from 'react';
import { View } from 'react-native';
import { Aviso, Botao, Campo, Tela, Texto } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { Caixa, CampoUsuario, CamposIdade, useUsuarioDisponivel } from '../../components/CamposPerfil';
import { LinksTermos } from '../../components/LinksTermos';
import { supabase } from '../../lib/supabase';
import { VERSAO_TERMOS } from '../../lib/termos';
import { IDADE_RESPONSAVEL, erroEmail, erroSenha, idade, lerData } from '../../lib/validacao';

export default function CriarConta() {
  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [aceite, setAceite] = useState(false);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState(null);
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const disponibilidade = useUsuarioDisponivel(usuario);

  async function criar() {
    setErroGeral(null);
    const iso = lerData(nascimento);
    const precisaResponsavel = iso && idade(iso) < IDADE_RESPONSAVEL;
    const e = {
      nome: nome.trim() ? null : 'Digite seu nome.',
      email: erroEmail(email),
      senha: erroSenha(senha),
      data: iso ? null : 'Use o formato DD/MM/AAAA.',
      responsavel: precisaResponsavel && erroEmail(responsavel) ? 'Digite o e-mail do responsável.' : null,
    };
    setErros(e);
    if (Object.values(e).some(Boolean)) return;
    if (disponibilidade.status !== 'livre') {
      setErroGeral(
        !usuario
          ? 'Escolha um @usuário.'
          : disponibilidade.status === 'desconhecido'
            ? 'Não conseguimos verificar o @usuário agora. Tente de novo em instantes.'
            : disponibilidade.status === 'verificando'
              ? 'Aguarde a verificação do @usuário.'
              : 'Escolha um @usuário disponível.'
      );
      return;
    }
    if (!aceite) {
      setErroGeral('Para criar a conta, aceite os termos e a política de privacidade.');
      return;
    }
    setCarregando(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: {
          display_name: nome.trim(),
          username: usuario,
          birth_date: iso,
          guardian_email: precisaResponsavel ? responsavel.trim() : null,
          terms_version: VERSAO_TERMOS,
        },
      },
    });
    setCarregando(false);
    if (error) {
      if (error.code === 'user_already_exists') setErroGeral('Já existe uma conta com esse e-mail. Tente entrar.');
      else if (error.code === 'weak_password') setErroGeral('Essa senha é fraca. Use uma mais longa e difícil de adivinhar.');
      else if (error.code === 'over_email_send_rate_limit') setErroGeral('Muitos cadastros agora. Tente de novo em alguns minutos.');
      else setErroGeral('Não foi possível criar a conta agora. Tente de novo.');
      return;
    }
    // Se a confirmação de e-mail estiver ligada, ainda não há sessão
    if (!data.session) setEnviado(true);
  }

  if (enviado) {
    return (
      <Tela rodape>
        <Cabecalho titulo="Confirme seu e-mail" />
        <Texto>
          Enviamos um link para {email.trim()}. Abra o e-mail, toque no link e depois volte aqui para entrar.
        </Texto>
      </Tela>
    );
  }

  return (
    <Tela rodape>
      <Cabecalho titulo="Criar conta" />
      <Campo rotulo="Nome" value={nome} onChangeText={setNome} autoComplete="name" maxLength={50} erro={erros.nome} />
      <CampoUsuario valor={usuario} onChange={setUsuario} estado={disponibilidade} />
      <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" erro={erros.email} />
      <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="new-password" textContentType="newPassword" erro={erros.senha} dica="Mínimo de 8 caracteres" />
      <CamposIdade
        nascimento={nascimento}
        setNascimento={setNascimento}
        responsavel={responsavel}
        setResponsavel={setResponsavel}
        erroData={erros.data}
        erroResponsavel={erros.responsavel}
      />
      <Caixa marcado={aceite} onChange={setAceite}>
        <Texto style={{ fontSize: 15, lineHeight: 21 }}>Li e aceito os termos de uso e a política de privacidade.</Texto>
      </Caixa>
      <LinksTermos />
      <Aviso>{erroGeral}</Aviso>
      <View style={{ flex: 1 }} />
      <Botao titulo="Criar conta" variante="destaque" onPress={criar} carregando={carregando} />
      <Texto suave style={{ fontSize: 14, textAlign: 'center' }}>Enviaremos um link para confirmar seu e-mail.</Texto>
    </Tela>
  );
}
