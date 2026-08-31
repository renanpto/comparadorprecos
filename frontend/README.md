# OrçaFácil AI — Frontend

Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui, mobile-first.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Estrutura

- `src/app/page.tsx` — Dashboard da obra
- `src/app/analise/` — Fluxo de upload + análise de IA + divergências
- `src/app/comparativo/` — Matriz comparativa (por fornecedor / split-buy)
- `src/lib/types.ts` — Tipos de domínio compartilhados
- `src/lib/api-client.ts` — Cliente da API do backend (ver `../backend/`)

## Variáveis de ambiente

Ver `../documentacao/deploy.md` para a lista de variáveis exigidas por ambiente (dev/prod) no Amplify Hosting.
