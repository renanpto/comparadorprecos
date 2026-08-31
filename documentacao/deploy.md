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

Dois apps Amplify separados (um por ambiente), "App root directory" = `frontend`.

1. Push do repo para o GitHub (`git remote add origin https://github.com/renanpto/comparadorprecos.git`).
2. Console Amplify → New app → conectar ao repo, branch `develop` (app dev) e branch `main` (app prod).
3. App settings → General → "App root directory" = `frontend`. O build spec já está versionado em `frontend/amplify.yml` (Amplify detecta automaticamente).
4. App settings → Environment variables, por app:
   - `BACKEND_API_URL` = `ApiUrl` da stack correspondente
   - `COGNITO_USER_POOL_ID` = `UserPoolId`
   - `COGNITO_CLIENT_ID` = `UserPoolClientId`
   - `COGNITO_CLIENT_SECRET_ARN` = `CognitoClientSecretArn`
   - `NEXT_PUBLIC_APP_ENV` = `dev` ou `prod`
5. App settings → IAM role de compute SSR: anexar policy permitindo `secretsmanager:GetSecretValue` no ARN do secret daquele ambiente.
6. Depois que o app Amplify existir e tiver um domínio, atualizar `FrontendOrigin` em `backend/samconfig.toml` (perfil `prod`, e o de `dev` se usar preview URL) com o domínio real e rodar `sam deploy` de novo — o CORS do S3/API Gateway só aceita a origem configurada.

## 3. Verificação ponta a ponta

Ver seção 9 de `arquitetura.md` para o roteiro completo via curl + navegador.
