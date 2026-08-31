# OrçaFácil AI

SaaS mobile-first que elimina o trabalho manual de comparar orçamentos informais de obra (fotos de balcão, notas manuscritas e PDFs), usando IA para extrair itens/preços e detectar divergências entre fornecedores.

## Estrutura do repositório

```
frontend/       Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
backend/        AWS SAM (Lambda + API Gateway + DynamoDB + Cognito + S3 + Bedrock)
documentacao/   Arquitetura, schema de dados, runbook de deploy
```

## Ambientes

Todos os recursos AWS são deployados em duas stacks totalmente isoladas por ambiente (`dev` e `prod`), com nomes de recursos sufixados (`orcafacil-*-dev` / `orcafacil-*-prod`). Ver `documentacao/arquitetura.md`.

## Começando

- Frontend: ver `frontend/README.md`
- Backend: ver `backend/README.md`
