# Quicksave App

Diário de jogos do Quicksave: Android (APK) e versão web, feito com Expo + Supabase. O plano completo está em [docs/PLANO.md](docs/PLANO.md).

## Rodar no computador

```powershell
npm install
npx expo start
```

- **Web:** aperte `w` no terminal (abre em http://localhost:8081).
- **Celular Android com Expo Go:** leia o QR code. No Expo Go, o login com Google não funciona (só e-mail e senha).
- **Celular com o APK de desenvolvimento:** veja "Gerar o APK" abaixo.

## Configuração (uma vez)

### 1. Supabase (projeto novo, separado do site)
1. Em supabase.com, crie um projeto novo (ex.: `quicksave-app`) na região São Paulo.
2. **SQL Editor:** cole e rode, em ordem, cada arquivo de `supabase/migrations/` (`001_base.sql`, `002_aceite_termos.sql`, `003_jogos.sql`, `004_social.sql`...).
3. **Authentication > Sign In / Providers > Email:** deixe ligado, com "Confirm email" ativo.
4. **Authentication > URL Configuration:** em "Site URL", coloque `http://localhost:8081` por enquanto e adicione `http://localhost:8081` também em "Redirect URLs".
5. **Project Settings > API Keys:** copie a "Publishable key". Em **Project Settings > Data API**, copie a "Project URL".
6. Na raiz do projeto, copie `.env.example` para `.env.local` e preencha:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### 2. Google (login)
1. Em console.cloud.google.com, crie um projeto e configure a **tela de consentimento OAuth** (tipo externo, nome Quicksave).
2. **Credenciais > Criar ID do cliente OAuth > Aplicativo da Web:**
   - Origens JavaScript autorizadas: `http://localhost:8081`
   - URIs de redirecionamento autorizados: `https://<seu-projeto>.supabase.co/auth/v1/callback`
3. No Supabase, em **Authentication > Sign In / Providers > Google**, ligue o Google e cole o Client ID e o Client Secret desse cliente Web.
4. Coloque o mesmo Client ID em `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` no `.env.local`.
5. **Cliente Android** (depois do primeiro build, passo 3): **Criar ID do cliente OAuth > Android**, com o pacote `br.com.quicksavegames.app` e o SHA-1 que o comando `npx eas-cli@latest credentials` mostra.

### 3. Gerar o APK (EAS, plano gratuito)
```powershell
npx eas-cli@latest login
```
```powershell
npx eas-cli@latest init
```
```powershell
npx eas-cli@latest build --profile development --platform android
```
- `development`: APK para testar com o servidor do seu computador (`npx expo start`).
- `preview`: APK "de verdade", para distribuir aos testadores.
- As variáveis `EXPO_PUBLIC_*` também precisam existir no EAS para os builds na nuvem: em expo.dev > projeto > Environment variables.

### 4. IGDB (busca de jogos) e a função `igdb`
1. Em dev.twitch.tv/console (conta com 2FA), registre uma aplicação nova, "Quicksave App":
   - OAuth Redirect URL: `http://localhost`
   - Categoria: Application Integration
   - Tipo de cliente: Confidencial
   Copie o **Client ID** e gere um **Client Secret**.
2. Supabase do app > **Edge Functions > Secrets**: crie `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET` com esses valores.
3. Publique a função (na pasta do app):
```powershell
npx.cmd supabase login
```
```powershell
npx.cmd supabase link --project-ref <codigo-do-projeto>
```
```powershell
npx.cmd supabase functions deploy igdb
```
   O `<codigo-do-projeto>` é o trecho antes de `.supabase.co` na Project URL. O deploy pede confirmação: responda `y`.

### 5. Tornar alguém admin
No SQL Editor do app: `update public.profiles set role = 'admin' where username = 'seu_usuario';`

## Estrutura

```
src/app/          telas (Expo Router)
  (auth)/         boas-vindas, entrar, criar-conta, esqueci-senha
  (tabs)/         inicio (feed), comunidades, registrar, amigos, perfil
  buscar.js       busca de jogos (lupa no topo do Início)
  jogo/ registro/ páginas do jogo e formulário de registro
  u/ grupo/ atividade/ notificacoes.js   parte social
  comunidade/ topico/ denuncias.js       comunidades e moderação
  completar-perfil.js
src/components/   componentes visuais (ui.js, ícones, campos de perfil)
src/lib/          supabase, login (auth, google), validações, jogos, registros, social
src/theme/        cores, fontes, bordas e sombras
supabase/migrations/  SQL numerado, rodado manualmente
```
