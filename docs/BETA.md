# Passo a passo do beta (Fase 6)

Siga na ordem. Cada parte diz onde clicar e o que copiar. Nenhuma chave entra no GitHub: elas ficam só no Supabase, na Vercel, no GitHub Secrets e no seu `.env.local`.

## 1. Banco do app (Supabase do APP)
1. **SQL Editor:** rode `supabase/migrations/010_beta.sql`.
2. Publique as duas funções novas (na pasta do app):
```powershell
npx.cmd supabase functions deploy excluir-conta
```
```powershell
npx.cmd supabase functions deploy responsavel
```

## 2. E-mails pelo Resend (gratuito: 3.000 por mês, 100 por dia)
1. Crie a conta em resend.com.
2. **Domains > Add Domain:** `quicksavegames.com.br`, região São Paulo (sa-east-1) se aparecer.
3. O Resend mostra 3 ou 4 registros de DNS (um MX e alguns TXT: SPF e DKIM). Crie cada um no painel onde você administra o DNS do domínio (o mesmo onde está o domínio do site). Copie **Tipo, Nome e Valor** exatamente como aparecem.
4. Volte ao Resend e clique em **Verify**. Pode levar de minutos a algumas horas.
5. **API Keys > Create API Key** (permissão "Sending access"). Copie a chave (começa com `re_`). Ela aparece uma vez só.

### 2a. Supabase do app usando o Resend
**Authentication > Emails > SMTP Settings** (ou "Set up SMTP"):
- Enable custom SMTP: ligado
- Sender email: `noreply@quicksavegames.com.br`
- Sender name: `Quicksave`
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: a chave `re_...` do passo 5

Em **Authentication > Rate Limits**, o limite de e-mails por hora pode subir (ex.: 30).

### 2b. Segredos das funções
**Edge Functions > Secrets**, crie:
- `RESEND_API_KEY` = a chave `re_...`
- `EMAIL_REMETENTE` = `Quicksave <noreply@quicksavegames.com.br>`

## 3. Versão web na Vercel (app.quicksavegames.com.br)
1. Vercel > **Add New > Project** > importe o repositório `quicksaveApp`.
2. Framework: "Other". O `vercel.json` já define o build (`npx expo export -p web`) e a pasta (`dist`).
3. **Environment Variables:** as mesmas do `.env.local` do app:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
4. Deploy. Depois, **Settings > Domains > Add**: `app.quicksavegames.com.br`. A Vercel mostra um registro **CNAME** (`app` → `cname.vercel-dns.com`): crie no DNS do domínio.

### 3a. Endereços liberados
- **Supabase do app > Authentication > URL Configuration:**
  - Site URL: `https://app.quicksavegames.com.br`
  - Redirect URLs (adicione, mantendo as que já existem):
    - `https://app.quicksavegames.com.br/**`
    - `quicksave://**`
    - `http://localhost:8081/**`
- **Google Cloud > Credenciais > cliente Web do app:** em "Origens JavaScript autorizadas", adicione `https://app.quicksavegames.com.br`.

### 3b. Nome no login do Google (gratuito)
Se o cliente do app estiver no **mesmo projeto do Google Cloud do site**, já está feito. Se estiver em outro projeto:
**Google Auth Platform > Branding**:
- Nome do app: `Quicksave`; logo: o mascote (`assets/icon.png`)
- Página inicial: `https://quicksavegames.com.br`
- Política de privacidade: `https://quicksavegames.com.br/app/privacidade`
- Termos: `https://quicksavegames.com.br/app/termos`
- Domínios autorizados: `quicksavegames.com.br`
Depois, **Verification Center** > peça a verificação da marca.

## 4. Site (aba App do admin e páginas /app)
No projeto do **site** na Vercel e no `.env.local` do site, crie:
- `APP_SUPABASE_URL` = Project URL do Supabase do **app**
- `APP_SUPABASE_SECRET_KEY` = Supabase do **app** > Project Settings > API Keys > **Secret key** (botão "Reveal")

Elas ficam só no servidor (sem `NEXT_PUBLIC_`). Depois do deploy, a aba **App** aparece no admin para administradores.

## 5. Backup e "manter acordado" (GitHub Actions)
1. Repositório do app > **Settings > General > Danger Zone > Change visibility > Public**.
   Antes, confira que nenhum `.env` foi enviado (o `.gitignore` já bloqueia `.env*.local`).
2. **Settings > Secrets and variables > Actions > New repository secret**, crie:
   - `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (os do app)
   - `SUPABASE_DB_URL`: Supabase do app > botão **Connect** > **Session pooler** > copie a URI e troque `[YOUR-PASSWORD]` pela senha do banco
   - `BACKUP_SENHA`: uma senha longa só sua. **Guarde num lugar seguro**: sem ela o backup não abre.
3. **Actions > Banco (manter acordado e backup) > Run workflow** para testar. O backup aparece em "Artifacts" no fim da execução.

Para abrir um backup no futuro: `gpg -d quicksave-app-AAAA-MM-DD.tar.gz.gpg > backup.tar.gz` (pede a senha).

## 6. APK do beta
```powershell
npx.cmd eas-cli@latest build --profile preview --platform android
```
1. Quando terminar, baixe o `.apk` pelo link do EAS.
2. GitHub do app > **Releases > Draft a new release** > tag `v0.1.0`, título "Beta 0.1.0".
3. Anexe o APK com o nome **`quicksave.apk`** (o link da página /app sempre aponta para esse nome na versão mais recente). Publique.

### Atualizações sem APK novo
Mudanças só de JavaScript chegam sozinhas para quem tem o APK do beta:
```powershell
npx.cmd eas-cli@latest update --branch preview --message "o que mudou"
```
Se a mudança adicionar biblioteca nativa, aí sim é preciso um APK novo (e subir a versão em `app.json`).

## 7. Testes finais
- Criar conta com e-mail: o e-mail de confirmação chega pelo Resend.
- "Esqueci a senha": o link abre a tela "Senha nova" (web e APK).
- Conta de 10 anos: o responsável recebe o e-mail, abre `quicksavegames.com.br/app/autorizar`, autoriza, e a aba Amigos libera.
- Minha conta: "Gerar arquivo" baixa os dados; "Excluir minha conta" apaga e volta para as boas-vindas.
- Admin do site > App: números, usuários (suspender e reativar) e denúncias.
- Página `quicksavegames.com.br/app`: botão do APK baixa o arquivo; botão da web abre o app.
