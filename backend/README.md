# OrçaFácil AI — Backend

AWS SAM: API Gateway (HTTP API) + Lambda (Node.js 22.x/TypeScript) + DynamoDB + Cognito + S3 + Bedrock + Secrets Manager.

## Requisitos

- AWS CLI configurado com credenciais válidas.
- SAM CLI (`sam --version`).
- Node.js 22+.

## Setup local

```bash
npm install
```

## Build

```bash
sam build
```

## Deploy

Primeiro deploy de cada ambiente (gera `samconfig.toml` já commitado, então normalmente basta):

```bash
sam deploy --config-env dev
sam deploy --config-env prod
```

Para trocar o domínio real do Amplify no CORS/`FrontendOrigin` de produção, edite `parameter_overrides` em `samconfig.toml` antes do deploy (ver `documentacao/deploy.md`).

## Capturar outputs (para alimentar o frontend)

```bash
aws cloudformation describe-stacks --stack-name orcafacil-backend-dev --query "Stacks[0].Outputs" --output table
```

## Estrutura

- `template.yaml` — definição de todos os recursos AWS.
- `src/lib/` — DynamoDB client, auth (claims do JWT), respostas HTTP padronizadas, integração Bedrock (extração + reconciliação).
- `src/handlers/` — uma função por rota/evento (ver `documentacao/arquitetura.md`).

## Ambientes

Duas stacks CloudFormation totalmente isoladas: `orcafacil-backend-dev` e `orcafacil-backend-prod`. Nenhum recurso é compartilhado entre ambientes.
