# Quicksave App: plano (versão Expo)

Um "Letterboxd para jogos" com a identidade do Quicksave. Esta versão substitui o plano antigo, que era em PWA.

Mockup de referência: canvas "Quicksave App: mockup nativo" (10 telas de celular + a aba App no admin do site).

## 1. Decisões tomadas

| Tema | Decisão |
|---|---|
| Tipo de app | Nativo, com **Expo (React Native) + Expo Router**. Um código só gera o app Android e a versão web |
| Distribuição | **Android em APK** baixado pelo site (fora da Play Store por enquanto). **iPhone usa a versão web** |
| Login | **Conta própria com e-mail e senha** + **Google**. Apple fica para quando houver conta paga de desenvolvedor (US$ 99 por ano) |
| Banco | **Projeto Supabase novo**, separado do banco do site |
| Nota | 1 a 10 |
| Amizade | Pedido + aceite (mútua), com bloqueio |
| Grupos | Privados, até 20 pessoas, só entra quem é convidado por um amigo. Quem entra compartilha com o grupo os registros "Amigos" |
| Comunidades | Públicas, por tema, em formato de fórum, sem feed de atividades dos membros (fase 4) |
| Notificações | Dentro do app (sino no Início). Push no celular fica para depois |
| Visibilidade | Cada registro escolhe Amigos (padrão) ou Todos |
| Feed | Abas **Amigos** (padrão) e **Popular** (mais jogados em 7 dias + reviews públicas em alta) |
| Idade | Sem idade mínima. **Menores de 18**: registros só para amigos e perfil fora do Popular e da busca pública. **Menores de 12**: autorização de um responsável por e-mail |
| Admin | Fica **no site** (quicksavegames.com.br/admin), numa aba **App** com estatísticas, usuários, denúncias e o Rewind |
| Link no site | Só uma página `/app` com o download do APK e o link para a versão web |
| Linguagem | JavaScript (sem TypeScript) |

## 2. Arquitetura

```
App Android (APK) ─┐
                   ├──► Supabase (novo): Auth + Postgres com RLS + Storage + Edge Functions
Versão web ────────┘                                         │
 (Vercel Hobby, app.quicksavegames.com.br)                   └── Edge Function "igdb" ──► IGDB
Site quicksavegames.com.br/admin ──► lê o banco do app só pelo servidor (chave secreta na Vercel)
cron-job.org ──► Edge Function do Rewind e keep-alive
```

- **IGDB pela Edge Function do Supabase.** O segredo da Twitch fica nos segredos do Supabase, com fila, cache em tabela e limite de 4 req/s. Crédito "Dados de jogos: IGDB.com" visível.
- **A chave anon do Supabase vai dentro do app** (é pública por natureza). A segurança vem do RLS. A chave secreta (service role) nunca entra no app, só nas Edge Functions e no servidor do site.
- **Builds:** EAS Build (cota gratuita) gera o APK. EAS Update (cota gratuita) entrega atualizações só de JavaScript sem precisar de APK novo.
- **Push (fase posterior):** Expo Notifications + Firebase Cloud Messaging (grátis).

## 3. Custos

| Item | Custo |
|---|---|
| Supabase Free, Vercel Hobby, cron-job.org, IGDB não comercial | R$ 0 |
| Expo/EAS no plano gratuito | R$ 0 (cota mensal de builds limitada) |
| Firebase (push) | R$ 0 |
| E-mail de confirmação de conta | O SMTP embutido do Supabase é muito limitado e só serve para testes. Para o beta: um SMTP com plano gratuito (ex.: Resend ou Brevo) |
| Play Store (futuro) | US$ 25 uma vez |
| App Store e login com Apple (futuro) | US$ 99 por ano |

## 4. Estrutura de pastas proposta

```
Quicksave-App/
  src/
    app/                  telas (Expo Router: cada arquivo é uma rota)
      (auth)/             boas-vindas, entrar, criar-conta, esqueci-senha
      (tabs)/             inicio, buscar, registrar, amigos, perfil
      completar-perfil.js
      jogo/[id].js        (fase 2)
      u/[username].js     perfil de outra pessoa (fase 3)
      grupo/              novo.js e [id].js (fase 3)
      atividade/[id].js   atividade com comentários (fase 3)
      notificacoes.js     (fase 3)
      rewind/[mes].js     (fase 5)
      _layout.js          fontes, sessão e redirecionamento logado/deslogado
    components/           Botao, Campo, Chip, Capa, Card...
    theme/                cores, fontes, bordas, sombras (claro e escuro)
    lib/                  supabase.js, auth.js, igdb.js
    hooks/
  supabase/
    migrations/           001_base.sql, 002_jogos.sql... (você roda no SQL Editor)
    functions/            igdb/, rewind/ (Edge Functions)
  assets/                 ícone, splash, fontes
  docs/                   PLANO.md, mockups/
  app.json, eas.json, package.json
```

## 5. Fases

Cada fase é uma branch, com explicação antes e sem commit até você aprovar.

| Fase | Entrega | Pronto quando |
|---|---|---|
| **1. Fundação** | Projeto Expo, tema visual, navegação por abas (telas vazias), login com e-mail/senha e Google, completar perfil, SQL base + RLS, versão web rodando, primeiro APK | Você cria conta, entra pelo Google, escolhe o @ e vê as abas no celular (APK) e no navegador |
| **2. Jogos** | Edge Function do IGDB (fila + cache), busca, página do jogo, registrar, perfil com diário | Você registra 10 jogos e eles aparecem no perfil |
| **3. Social** | Pedidos de amizade, bloqueio, feed Amigos e Popular, perfil de outras pessoas, curtidas em reviews, horas jogadas, grupos privados, reações e comentários, notificações dentro do app, proteções de menores | Dois usuários de teste se veem, interagem num grupo e o RLS bloqueia o resto |
| **4. Comunidades** | Comunidades públicas por tema (fórum): tópicos com jogos anexados, respostas, curtidas, moderação pelo criador e denúncias | Uma comunidade de teste com tópicos, respostas e uma denúncia registrada |
| **5. Rewind** | Cálculo em SQL, aba Rewind no admin do site, stories, imagem para compartilhar | Rewind de teste publicado e visto por 2 usuários |
| **6. Admin e beta** | Aba App no admin do site (estatísticas, usuários, denúncias), página `/app` no site, LGPD (termos, privacidade, excluir conta, e-mail de autorização do responsável), backup | Beta fechado com ~20 pessoas |
| **7. Depois** | Push no celular, listas, importação da Steam, Play Store, App Store e login Apple | Conforme o feedback |

## 6. Riscos

- **SMTP do Supabase:** sem um SMTP próprio, as confirmações de e-mail param depois de poucas mensagens por hora.
- **APK fora da loja:** a pessoa precisa permitir "fontes desconhecidas", e alguns celulares mostram avisos. Explicar isso na página `/app`.
- **Menores de idade:** LGPD (art. 14) e a lei de proteção de crianças no ambiente digital (ECA Digital). Vale uma revisão jurídica antes do beta aberto.
- **Pausa do Supabase gratuito** após 1 semana sem uso: keep-alive diário pelo cron-job.org. Sem backup automático: `pg_dump` semanal (fase 5).
- **IGDB:** uso só não comercial. Se o app tiver receita um dia, rever os termos.
