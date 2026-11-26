import { useState } from 'react';
import { View } from 'react-native';
import { Aviso, Botao, LinkTexto, Tela, Texto, Titulo } from '../components/ui';
import { Caixa, CampoUsuario, CamposIdade, useUsuarioDisponivel } from '../components/CamposPerfil';
import { LinksTermos } from '../components/LinksTermos';
import { useAuth } from '../lib/auth';
import { pedirAutorizacao } from '../lib/conta';
import { supabase } from '../lib/supabase';
import { VERSAO_TERMOS } from '../lib/termos';
import { IDADE_RESPONSAVEL, erroEmail, idade, lerData } from '../lib/validacao';

const MENSAGENS = {
  usuario_invalido: 'Use de 3 a 20 letras minúsculas, números ou _.',
  usuario_em_uso: 'Esse @usuário acabou de ser usado. Escolha outro.',
  data_invalida: 'Confira a data de nascimento.',
  responsavel_obrigatorio: 'Digite o e-mail do responsável.',
  termos_obrigatorios: 'Para continuar, aceite os termos de uso e a política de privacidade.',
};

function dataParaTexto(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export default function CompletarPerfil() {
  const { perfil, privado, recarregarPerfil, sair } = useAuth();
  const [usuario, setUsuario] = useState(perfil?.username || '');
  const [nascimento, setNascimento] = useState(dataParaTexto(privado?.birth_date));
  const [responsavel, setResponsavel] = useState(privado?.guardian_email || '');
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [aceite, setAceite] = useState(false);
  // Já tinha perfil e só os termos mudaram
  const soTermos = Boolean(perfil?.username && privado?.birth_date && privado?.terms_version);
  const disponibilidadeNova = useUsuarioDisponivel(usuario === perfil?.username ? '' : usuario);
  const disponibilidade = usuario && usuario === perfil?.username ? { status: 'livre' } : disponibilidadeNova;
  const primeiroNome = (perfil?.display_name || '').split(' ')[0];

  async function salvar() {
    setErroGeral(null);
    const iso = lerData(nascimento);
    const precisaResponsavel = iso && idade(iso) < IDADE_RESPONSAVEL;
    const e = {
      data: iso ? null : 'Use o formato DD/MM/AAAA.',
      responsavel: precisaResponsavel && erroEmail(responsavel) ? 'Digite o e-mail do responsável.' : null,
    };
    setErros(e);
    if (Object.values(e).some(Boolean)) return;
    if (disponibilidade.status !== 'livre') {
      setErroGeral('Escolha um @usuário disponível.');
      return;
    }
    if (!aceite) {
      setErroGeral(MENSAGENS.termos_obrigatorios);
      return;
    }
    setCarregando(true);
    const { error } = await supabase.rpc('complete_profile', {
      p_username: usuario,
      p_birth_date: iso,
      p_guardian_email: precisaResponsavel ? responsavel.trim() : null,
      p_terms_version: VERSAO_TERMOS,
    });
    if (error) {
      setCarregando(false);
      const chave = Object.keys(MENSAGENS).find((k) => error.message?.includes(k));
      setErroGeral(chave ? MENSAGENS[chave] : 'Não foi possível salvar agora. Tente de novo.');
      return;
    }
    // Menor de 12: manda o e-mail de autorização ao responsável (se falhar, dá para reenviar depois)
    if (precisaResponsavel) await pedirAutorizacao();
    await recarregarPerfil();
    // Perfil completo: o _layout troca para as abas
  }

  return (
    <Tela rodape>
      <View style={{ height: 24 }} />
      <Titulo>{soTermos ? 'Atualizamos os termos' : primeiroNome ? `Falta pouco, ${primeiroNome}` : 'Falta pouco'}</Titulo>
      <Texto>
        {soTermos
          ? 'Os termos de uso ou a política de privacidade mudaram. Leia e aceite para continuar.'
          : 'Escolha como vão te encontrar no Quicksave.'}
      </Texto>
      <CampoUsuario valor={usuario} onChange={setUsuario} estado={disponibilidade} />
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
      <Botao titulo="Começar" variante="destaque" onPress={salvar} carregando={carregando} />
      <View style={{ alignItems: 'center' }}>
        <LinkTexto titulo="Sair e usar outra conta" onPress={sair} />
      </View>
    </Tela>
  );
}
