# Plano — Backend AWS do OrçaFácil AI + Reorganização do Repo + Integração com Frontend Real

## Contexto

O frontend do OrçaFácil AI (Next.js 16 + shadcn/ui, 3 telas: dashboard, análise/upload, comparativo) foi construído inicialmente 100% com dados mock (`src/lib/mock-data.ts`), sem nenhuma persistência ou IA real. O objetivo agora é colocar o fluxo completo para rodar de ponta a ponta: cadastro/login real, upload de fotos/PDFs de orçamento, extração automática dos itens via IA (Bedrock), detecção de divergências entre fornecedores, e o comparativo final — tudo com dados reais.

O usuário decidiu usar o ecossistema AWS (API Gateway, Cognito, Lambda, DynamoDB, Bedrock, S3, Secrets Manager, Amplify) na conta já configurada no CLI local (conta `581613954392`, região `us-east-1`), com **AWS SAM** como IaC (já disponível no ambiente). Recursos precisam deixar claro no nome a qual ambiente pertencem (dev/prod), seguindo o princípio de isolamento já usado por outros projetos nesta conta (stacks totalmente separadas por ambiente), mas com convenção de nomes própria do OrçaFácil.

O repositório GitHub https://github.com/renanpto/comparadorprecos já foi criado (vazio, sem remote configurado localmente ainda). O usuário pediu que o repo seja isolado (não monorepo com outros projetos da conta) e organizado em `frontend/`, `backend/`, `documentacao/` — o código Next.js atual (hoje na raiz) precisa ser movido para `frontend/`. O login deve ter tela própria (não Cognito Hosted UI), consistente com o design mobile-first já criado.

Testes já confirmaram: Bedrock funciona via inference profile `us.anthropic.claude-sonnet-4-5-20250929-v1:0` (invocação direta ao model ID falha — o modelo exige inference profile), com suporte a input imagem+texto e output texto — adequado para ler fotos de orçamentos manuscritos.

---

## 1. Reorganização do repositório

Estrutura final:
```
comparadorprecos/
  frontend/        <- conteúdo atual da raiz do Next.js
  backend/         <- novo projeto SAM
  documentacao/    <- arquitetura, runbook de deploy, decisões de nomenclatura
  README.md        <- novo, visão geral do monorepo
  .gitignore       <- novo, cobrindo frontend/ e backend/
```

- `git mv src public package.json package-lock.json next.config.ts tsconfig.json components.json eslint.config.mjs postcss.config.mjs README.md AGENTS.md frontend/` (preserva histórico).
- `AGENTS.md` é regenerado automaticamente por `next dev` (fica em `frontend/AGENTS.md` dali em diante) — criar `frontend/CLAUDE.md` com `@AGENTS.md` apontando para o arquivo local, e escrever um `CLAUDE.md` novo na raiz descrevendo a estrutura do monorepo.
- Novo `.gitignore` de raiz: mantém os padrões atuais (`node_modules`, `.next`, `*.tsbuildinfo`, `.env*` etc., que o git já aplica em qualquer profundidade) e adiciona `backend/.aws-sam/`. `backend/samconfig.toml` deve ser versionado (não guarda segredos).
- Nenhuma variável de ambiente hardcoded existe hoje — a reorganização não quebra nada em runtime, só exige rodar os comandos npm de dentro de `frontend/`.
- `documentacao/` recebe: este plano de arquitetura, diagrama de entidades DynamoDB, decisões de nomenclatura AWS, runbook de deploy.

---

## 2. Schema de dados — DynamoDB (single-table)

Tabela única `OrcaFacil-{Env}` (ex. `OrcaFacil-Dev`), `PAY_PER_REQUEST`. Justificativa: o padrão de acesso dominante é "buscar tudo sobre uma obra" em uma única tela — com tabela única isso é uma única Query por `PK=OBRA#obraId`, em vez de 3-4 chamadas com tabelas separadas.

| Entidade | PK | SK | Atributos principais |
|---|---|---|---|
| Obra (metadata) | `OBRA#obraId` | `METADATA` | nome, userId (sub do Cognito), createdAt/updatedAt, `GSI1PK=USER#userId`, `GSI1SK=OBRA#createdAt#obraId` |
| Item lista mestra | `OBRA#obraId` | `ITEM#itemId` | nome, quantidade, unidade, especificacao |
| Orçamento fornecedor | `OBRA#obraId` | `ORCAMENTO#orcamentoId` | nomeLoja, data, condicaoPagamento, totalGeral, status (PENDENTE_UPLOAD/PROCESSANDO/PROCESSADO/ERRO), s3Key, `itens` (List<Map> = `ItemCotado[]` embutido), erroMensagem |
| Divergência | `OBRA#obraId` | `DIVERGENCIA#divergenciaId` | loja, itemId, item, alerta, impactoFinanceiro, status (PENDENTE/ACEITA/IGNORADA) |

- `ItemCotado[]` fica embutido dentro do item `ORCAMENTO` (o próprio type TS já modela assim), bem abaixo do limite de 400KB por item.
- GSI1 único (PK/SK string, projeção ALL), presente só em itens `entityType=OBRA`, usado por `ListarObras`.
- Autorização a nível de dado: toda Lambda valida `obra.userId === sub do JWT` antes de ler/escrever (a PK não inclui o userId).

---

## 3. Template SAM (`backend/template.yaml`)

**Duas stacks CloudFormation totalmente separadas** (`orcafacil-backend-dev` / `orcafacil-backend-prod`), mesmo template parametrizado por `Env`, deployado 2x. Isolamento total de dados, blast radius contido, permite destruir/recriar dev sem risco a prod.

Convenção de nomes (parâmetro `Env`, AllowedValues `[dev, prod]`):
- Stack: `orcafacil-backend-{env}`
- DynamoDB: `OrcaFacil-{Env}` (ex. `OrcaFacil-Dev`)
- S3 uploads: `orcafacil-uploads-{env}-581613954392` (minúsculo + account id p/ unicidade global)
- Cognito: User Pool `OrcaFacil-UserPool-{Env}`, App Client `OrcaFacil-WebClient-{Env}`
- API Gateway HTTP API: `OrcaFacil-Api-{Env}`
- Lambdas: `OrcaFacil-{Proposito}-{Env}` (ex. `OrcaFacil-CriarObra-Dev`)
- Secret: `orcafacil/cognito/app-client-{env}`
- Tags em todos os recursos: `Project=OrcaFacil`, `Environment={env}`

Recursos principais:
1. **DynamoDB** `OrcaFacilTable` — PAY_PER_REQUEST, PK/SK string, GSI1, PITR habilitado só em prod.
2. **S3** `UploadsBucket` — CORS (PUT/GET, origem = parâmetro `FrontendOrigin`), bloqueio de acesso público total, notificação S3→Lambda direta via `Events` do SAM.
3. **Cognito UserPool** — política de senha padrão, auto-verificação de e-mail, self-signup habilitado.
4. **Cognito UserPoolClient** — `GenerateSecret: true` (client confidencial, ver seção 6), `ALLOW_USER_PASSWORD_AUTH` + `ALLOW_REFRESH_TOKEN_AUTH`, `PreventUserExistenceErrors: ENABLED`.
5. **Secrets Manager** `CognitoClientSecret` — JSON `{clientId, clientSecret}` populado automaticamente no deploy via `Fn::Sub`/`GetAtt`.
6. **HttpApi** — `Authorizers.CognitoAuthorizer` (JWT, Issuer = user pool, Audience = client id), CORS = `FrontendOrigin`.
7. **8 Lambda functions** (seção 4) — Runtime `nodejs22.x`, `BuildMethod: esbuild`, cada uma com policy mínima (DynamoDBCrudPolicy escopado à tabela, S3 policy escopada ao bucket, statement customizado `bedrock:InvokeModel`/`bedrock:Converse` escopado ao ARN do inference profile).
8. Parâmetros `Env` e `FrontendOrigin` (URL do Amplify, ou `http://localhost:3000` em dev).
9. Outputs: `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `CognitoClientSecretArn`, `UploadsBucketName`, `TableName` — lidos via `describe-stacks` para alimentar as env vars do Amplify.

---

## 4. Lambda functions (Node.js 22.x + TypeScript, AWS SDK v3, esbuild)

| # | Nome lógico | Trigger | Rota/Evento | Responsabilidade |
|---|---|---|---|---|
| 1 | CriarObra | API GW | `POST /obras` | Cria item OBRA com `userId` = sub do JWT |
| 2 | ListarObras | API GW | `GET /obras` | Query GSI1 por `USER#sub` |
| 3 | ObterObra | API GW | `GET /obras/{obraId}` | Query `PK=OBRA#obraId`, monta payload completo (obra + lista mestra + orçamentos + divergências); valida ownership |
| 4 | GerarUrlUpload | API GW | `POST /obras/{obraId}/orcamentos` | Cria orçamento (status `PENDENTE_UPLOAD`), gera URL S3 presigned (PUT) |
| 5 | ObterOrcamento | API GW | `GET /obras/{obraId}/orcamentos/{id}` | GetItem leve para polling de status |
| 6 | ProcessarOrcamento | S3 `ObjectCreated` | evento S3 | Chama Bedrock (extração), atualiza o orçamento, roda reconciliação entre orçamentos da obra (2ª chamada Bedrock), atualiza itens mestre/divergências, seta `PROCESSADO`/`ERRO`. Timeout 5min, 1024MB+ |
| 7 | ResolverDivergencia | API GW | `PATCH /obras/{obraId}/divergencias/{id}` | `{acao: aceito\|ignorado}`, atualiza status |
| 8 | ObterComparativo | API GW | `GET /obras/{obraId}/comparativo` | Calcula on-the-fly visão "por fornecedor" e "split-buy" + economia total |

Fora de escopo do MVP: exclusão de orçamento, Cognito triggers extras, Step Functions/SQS entre extração e reconciliação (rodam sequencialmente na mesma Lambda). Configurar `DestinationConfig.OnFailure` (SQS DLQ) na invocação assíncrona S3→Lambda como rede de segurança.

---

## 5. Bedrock — extração e reconciliação

Modelo: **Claude Sonnet 4.5** via inference profile `us.anthropic.claude-sonnet-4-5-20250929-v1:0` (não Haiku) — a extração lê fotos de orçamentos manuscritos/informais, cenário onde um modelo mais fraco arrisca corromper toda a comparação; volume de chamadas por obra é pequeno, então o delta de custo é irrelevante frente ao risco de dado errado. Haiku fica como otimização futura, a validar com dados reais.

**Fase 1 — Extração** (1 chamada por arquivo, dentro de `ProcessarOrcamento`):
- Bedrock Converse API com tool-use forçado (schema JSON estrito): `nomeLoja`, `data`, `condicaoPagamento`, `itens[]` (descricaoNoOrcamento/quantidade/unidade/precoUnitario/precoTotal), `totalGeral`.
- Imagem: content block `image` (base64). PDF: content block `document` nativo do Bedrock (validar suporte atual na implementação; fallback = rasterizar páginas em imagens).
- Prompt de sistema descreve o domínio (orçamentos informais de material de construção no Brasil, letra manuscrita, mapear condição de pagamento para os 2 valores do enum), instrui preservar o texto original de cada item (o casamento entre fornecedores acontece na fase 2).

**Fase 2 — Reconciliação/Divergência** (1 chamada por obra, após cada novo orçamento processado, reavaliando o conjunto inteiro de forma idempotente):
- Tool-use forçado retornando `itensMestre` (consolidado, casando itens equivalentes entre fornecedores), `itensCotadosAtualizados` (itemId/divergente/motivoDivergencia), `divergencias[]`.
- Regra de negócio central no prompt: **diferença de preço pura não é divergência** (é o propósito da comparação) — só marcar `divergente=true` quando há diferença material de especificação (fracionado vs peça inteira, reforçado vs padrão, quantidade diferente da necessária) que tornaria a comparação de preço injusta sem o usuário saber.
- Erro/imagem ilegível → status `ERRO` + `erroMensagem`. **Nota para o frontend**: `analise/page.tsx` hoje só tem estados `upload/processando/divergencias` — precisa de um novo estado `erro` com opção de tentar novamente.

---

## 6. Autenticação (Cognito, sem Hosted UI)

- **App Client confidencial** (`GenerateSecret: true`), não público — justificativa concreta para o uso pedido de Secrets Manager: todas as chamadas ao Cognito acontecem só no servidor (Route Handlers do Next.js em SSR no Amplify), nunca no browser, então o secret não vaza em bundle JS; usar client confidencial + `SECRET_HASH` eleva a barreira contra chamadas diretas de terceiros ao App Client. O `ClientSecret` fica só no Secrets Manager (nunca em env var estática do Amplify), lido em runtime via SDK com cache em memória por instância.
- Fluxo: `USER_PASSWORD_AUTH` (não SRP) — aceitável porque a senha já trafega do browser até o próprio servidor Next.js via HTTPS antes de ir ao Cognito (SRP existiria para proteger app público→Cognito direto no browser, cenário que não se aplica aqui).
- Novas telas: `frontend/src/app/login/page.tsx`, `frontend/src/app/cadastro/page.tsx` (mobile-first, mesmo design system). Route Handlers: `api/auth/{signup,confirm,login,refresh,logout}/route.ts`.
- Sessão: AccessToken/RefreshToken em cookies httpOnly, Secure, SameSite=Lax. `frontend/src/middleware.ts` protege rotas exceto `/login` e `/cadastro`.
- Autorização da API: HTTP API JWT Authorizer valida o AccessToken do Cognito; cada Lambda lê `userId` de `event.requestContext.authorizer.jwt.claims.sub`.
- Padrão BFF: browser nunca chama a API Gateway diretamente nem vê o AccessToken; Route Handlers fazem proxy fino (cookie → `Authorization: Bearer` → API Gateway).

---

## 7. Integração do frontend com o backend real

- Remover import de `mock-data.ts` nas 3 páginas (pode manter o arquivo atrás de uma flag opcional para dev local sem backend).
- `frontend/src/lib/api-client.ts` (novo) — fetchers tipados server-side para os 8 endpoints.
- `page.tsx` (Dashboard) e `comparativo/page.tsx` viram Server Components assíncronos, buscando dados reais.
- `analise/page.tsx` (client) passa a chamar Route Handlers próprios que fazem proxy à API Gateway: pede URL presigned → PUT direto pro S3 do browser → poll a cada ~2s em `GET .../orcamentos/{id}` até mudar status, substituindo o `setInterval` fake atual pela lógica real (mantendo a mesma UI de progresso).
- Divergências: botões Aceitar/Ignorar chamam `PATCH .../divergencias/{id}`.
- **Nova tela "criar obra"** (nome da obra) — gap identificado: o mock assumia uma obra já existente; o backend agora exige um `obraId` real.
- Variáveis de ambiente (Amplify, por ambiente): `BACKEND_API_URL` (server-only, sem prefixo `NEXT_PUBLIC_`), `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET_ARN`, `NEXT_PUBLIC_APP_ENV`.

---

## 8. Deploy e ambientes

- `backend/samconfig.toml` com perfis `dev`/`prod` (`stack_name`, `parameter_overrides` com `Env`/`FrontendOrigin`). Primeiro deploy: `sam deploy --guided --config-env dev`; seguintes: `sam build && sam deploy --config-env dev|prod`.
- Após cada deploy, capturar Outputs via `aws cloudformation describe-stacks` → alimentam env vars do Amplify.
- **Amplify Hosting: 2 apps separados** (`orcafacil-frontend-dev` → branch `develop`, `orcafacil-frontend-prod` → branch `main`) em vez de 1 app com 2 branches — espelha o isolamento das 2 stacks de backend e evita role de compute SSR compartilhada entre ambientes (cada app precisa de acesso só ao secret do seu próprio ambiente).
  1. `git remote add origin` com a URL do GitHub, renomear `master`→`main`, criar branch `develop`.
  2. Console Amplify → New app → conectar ao repo via GitHub App.
  3. App settings → "App root directory" = `frontend` (suporte nativo do Amplify a monorepo/subpastas).
  4. Build: `npm ci` + `npm run build`, output SSR padrão do Next.js.
  5. Configurar env vars do app com os valores dos Outputs de cada stack.
  6. Anexar service role de compute SSR com `secretsmanager:GetSecretValue` escopado ao secret daquele ambiente.
  7. Problema de ovo-e-galinha: `FrontendOrigin` do S3 CORS só pode ter o domínio real depois que o app Amplify existir — após criar o app, atualizar o parâmetro e rodar `sam deploy` novamente.

---

## 9. Verificação ponta a ponta

**Via CLI/curl** (backend isolado, antes do frontend estar 100% integrado):
1. Criar usuário de teste no Cognito (`sign-up` + `admin-confirm-sign-up` + `initiate-auth --auth-flow USER_PASSWORD_AUTH` com SECRET_HASH) → capturar AccessToken.
2. `curl POST /obras` com Bearer → capturar `obraId`.
3. `curl POST /obras/{obraId}/orcamentos` → capturar `orcamentoId` + `uploadUrl`.
4. `curl PUT --upload-file` com uma **foto real** de orçamento de obra (não mock).
5. Poll `GET .../orcamentos/{id}` até `PROCESSADO`; conferir itens extraídos manualmente contra a foto original.
6. Repetir passos 3-5 com um segundo orçamento com diferença proposital de especificação, para forçar uma divergência detectável.
7. `GET .../obras/{obraId}` → conferir lista mestra e divergências coerentes.
8. `PATCH .../divergencias/{id}` com `acao=aceito`.
9. `GET .../obras/{obraId}/comparativo` → validar manualmente que "por fornecedor" e "split-buy" batem com a soma esperada.
10. Checar CloudWatch Logs da `ProcessarOrcamento` por erros/throttling do Bedrock.

**Manual no navegador** (após Amplify dev deployado):
- Cadastro (e-mail de verificação real do Cognito), confirmar código, login.
- Criar obra, subir foto real de celular (produto é mobile-first — testar em device real), acompanhar tela de processamento com status real.
- Revisar divergências reais geradas pela IA, aceitar/ignorar, conferir persistência ao recarregar.
- Ver comparativo com dados reais (tabs Por Fornecedor / Split-Buy).
- Testar logout e redirecionamento do `middleware.ts` em rota protegida sem sessão; testar expiração/renovação de sessão.

---

## Nota de segurança (não bloqueante)

As credenciais AWS configuradas no CLI local são da conta **root**. Recomenda-se migrar para um usuário/perfil IAM dedicado com permissões escopadas antes de produtizar de verdade — não bloqueia o MVP, mas vale endereçar antes do primeiro deploy em prod.
