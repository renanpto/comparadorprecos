# Runbook de deploy — OrçaFácil AI

## 1. Backend (AWS SAM)

```bash
cd backend
npm install
sam build
sam deploy --config-env dev    # primeiro deploy do ambiente dev
sam deploy --config-env prod   # primeiro deploy do ambiente prod
```

Capturar os Outputs de cada stack (usados nas env vars do frontend):

```bash
aws cloudformation describe-stacks --stack-name orcafacil-backend-dev --query "Stacks[0].Outputs" --output table
aws cloudformation describe-stacks --stack-name orcafacil-backend-prod --query "Stacks[0].Outputs" --output table
```

Outputs relevantes: `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `CognitoClientSecretArn`, `UploadsBucketName`, `TableName`.

## 2. Frontend (Amplify Hosting)

Por enquanto só o ambiente **dev** está provisionado: um único app Amplify (`comparadorprecos`, appId `d1psw5lkdac2q0`) conectado ao GitHub, rastreando a branch `develop`. Quando o `prod` for provisionado, seguir o mesmo padrão: outro app Amplify separado, rastreando `main`, com seu próprio compute role e suas próprias env vars — não reaproveitar o app do dev.

O build spec fica em `amplify.yml` **na raiz do repo** (não dentro de `frontend/`) — Amplify Hosting em modo monorepo (`AMPLIFY_MONOREPO_APP_ROOT` setado no app) exige o arquivo nesse local, no formato `applications:` (lista), com `appRoot: frontend`. Um `amplify.yml` dentro de `frontend/` no formato single-app quebra o build com `Monorepo spec provided without "applications" key`.

**Passo crítico, fácil de esquecer**: Next.js Server Components/Route Handlers rodando no compute SSR do Amplify **não recebem `process.env` automaticamente** a partir das env vars configuradas no app/branch — isso é documentado e intencional (evita vazar segredos de build para o runtime sem querer). É preciso escrever as variáveis desejadas em `.env.production` durante o `build` do `amplify.yml`:

```yaml
build:
  commands:
    - env | grep -e BACKEND_API_URL -e COGNITO_ -e NEXT_PUBLIC_ >> .env.production
    - npm run build
```

Sem essa linha, todo `process.env.X` dentro de uma Route Handler volta `undefined` em produção (funciona normalmente em `npm run dev` local, o que torna o bug fácil de não notar até testar no Amplify de verdade).

Passos para (re)criar um app Amplify:
1. Push do repo para o GitHub (`git remote add origin https://github.com/renanpto/comparadorprecos.git`).
2. Console Amplify → New app → conectar ao repo, branch `develop` (dev) — ou `main` para um futuro app de prod.
3. App settings → General → "App root directory" = `frontend` (isso seta `AMPLIFY_MONOREPO_APP_ROOT`).
4. Environment variables da branch (`aws amplify update-branch --app-id <id> --branch-name <branch> --environment-variables ...`, ou via console):
   - `BACKEND_API_URL` = `ApiUrl` da stack correspondente
   - `COGNITO_USER_POOL_ID` = `UserPoolId`
   - `COGNITO_CLIENT_ID` = `UserPoolClientId`
   - `COGNITO_CLIENT_SECRET_ARN` = `CognitoClientSecretArn`
   - `NEXT_PUBLIC_APP_ENV` = `dev` ou `prod`
   - Nenhum desses valores é um segredo em si (o segredo real do Cognito só é lido em runtime via Secrets Manager, usando o compute role) — por isso é seguro que fiquem em env vars simples, conforme a própria recomendação da AWS.
5. Criar um IAM role de compute SSR dedicado ao ambiente (trust policy: `Service: amplify.amazonaws.com`) com uma policy escopada a `secretsmanager:GetSecretValue` no ARN do secret daquele ambiente, e anexar via `aws amplify update-app --app-id <id> --compute-role-arn <arn>`. **Atenção**: setar um compute role customizado substitui totalmente as permissões padrão do Amplify — não existe permissão "herdada" do role padrão.
6. Depois que o app Amplify existir e tiver um domínio, atualizar `FrontendOrigin` em `backend/samconfig.toml` (perfil do ambiente correspondente) com o domínio real (`https://<branch>.<appId>.amplifyapp.com`) e rodar `sam deploy` de novo — o CORS do bucket S3 (upload direto do browser) só aceita as origens configuradas ali. `FrontendOrigin` é uma `CommaDelimitedList`, então dá pra manter `http://localhost:3000` junto com o domínio real.
7. Após qualquer mudança de env var/compute role feita fora de um push (via CLI diretamente), disparar um novo deploy para aplicar: `aws amplify start-job --app-id <id> --branch-name <branch> --job-type RELEASE`.

## 3. Verificação ponta a ponta

Ver seção 9 de `arquitetura.md` para o roteiro completo via curl + navegador.
