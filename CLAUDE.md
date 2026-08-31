# OrçaFácil AI — monorepo

Repositório isolado com três pastas de topo:

- `frontend/` — Next.js. Tem seu próprio `frontend/CLAUDE.md` (aponta para `frontend/AGENTS.md`, autogerenciado pelo `next dev`).
- `backend/` — AWS SAM (Node.js/TypeScript). Ver `backend/README.md` e `documentacao/arquitetura.md`.
- `documentacao/` — plano de arquitetura, schema DynamoDB, runbook de deploy.

Rode comandos de cada camada de dentro da sua própria pasta (`cd frontend && npm run dev`, `cd backend && sam build`).
