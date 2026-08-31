import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({});
const MODEL_ID = process.env.BEDROCK_MODEL_ID as string;

const SYSTEM_DOMINIO = `Você é um assistente especializado em ler orçamentos informais de material de
construção no Brasil (fotos de papel manuscrito, notas de balcão, ou PDFs de orçamento).
Preços estão em reais (R$). Unidades comuns: m, m², m³, kg, un, saco, barra, peça.
Letra pode ser manuscrita e de difícil leitura — faça o melhor possível e nunca invente
itens que não estão na imagem. Preserve o texto original de cada item exatamente como
escrito pelo fornecedor em "descricaoNoOrcamento" (não normalize nem traduza), pois esse
texto será usado depois para comparar itens equivalentes entre fornecedores diferentes.`;

export interface ItemExtraido {
  descricaoNoOrcamento: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  precoTotal: number;
}

export interface ExtracaoOrcamento {
  nomeLoja: string;
  data: string;
  condicaoPagamento: "À Vista / PIX" | "Cartão / Prazo";
  itens: ItemExtraido[];
  totalGeral: number;
}

const EXTRAIR_TOOL: Tool = {
  toolSpec: {
    name: "extrair_orcamento",
    description:
      "Registra os dados extraídos de uma foto ou PDF de orçamento de fornecedor.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          nomeLoja: { type: "string", description: "Nome do fornecedor/loja." },
          data: {
            type: "string",
            description:
              "Data do orçamento em formato ISO YYYY-MM-DD. Se não identificável na imagem, usar a data de hoje.",
          },
          condicaoPagamento: {
            type: "string",
            enum: ["À Vista / PIX", "Cartão / Prazo"],
            description:
              "Mapear a condição de pagamento do documento para um destes dois valores.",
          },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                descricaoNoOrcamento: {
                  type: "string",
                  description: "Texto original do item, como escrito no documento.",
                },
                quantidade: { type: "number" },
                unidade: { type: "string" },
                precoUnitario: { type: "number" },
                precoTotal: { type: "number" },
              },
              required: [
                "descricaoNoOrcamento",
                "quantidade",
                "unidade",
                "precoUnitario",
                "precoTotal",
              ],
            },
          },
          totalGeral: { type: "number" },
        },
        required: ["nomeLoja", "condicaoPagamento", "itens", "totalGeral"],
      },
    },
  },
};

export async function extrairOrcamento(
  bytes: Uint8Array,
  contentType: string
): Promise<ExtracaoOrcamento> {
  const contentBlock = buildDocumentContentBlock(bytes, contentType);

  const response = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_DOMINIO }],
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              text: "Extraia os dados deste orçamento usando a ferramenta extrair_orcamento.",
            },
          ],
        },
      ],
      toolConfig: {
        tools: [EXTRAIR_TOOL],
        toolChoice: { tool: { name: "extrair_orcamento" } },
      },
    })
  );

  const toolUse = response.output?.message?.content?.find((c) => c.toolUse)
    ?.toolUse;
  if (!toolUse?.input) {
    throw new Error("Bedrock não retornou extração estruturada.");
  }
  return toolUse.input as unknown as ExtracaoOrcamento;
}

function buildDocumentContentBlock(
  bytes: Uint8Array,
  contentType: string
): ContentBlock {
  if (contentType === "application/pdf") {
    return {
      document: {
        format: "pdf",
        name: "orcamento",
        source: { bytes },
      },
    };
  }
  const format = contentType.split("/")[1] as "jpeg" | "png" | "gif" | "webp";
  return {
    image: {
      format,
      source: { bytes },
    },
  };
}

// ---------------------------------------------------------------------
// Fase 2 — reconciliação entre orçamentos da mesma obra
// ---------------------------------------------------------------------

export interface OrcamentoParaReconciliacao {
  orcamentoId: string;
  nomeLoja: string;
  itens: ItemExtraido[];
}

export interface ItemMestreReconciliado {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  especificacao?: string;
}

export interface ItemCotadoAtualizado {
  orcamentoId: string;
  descricaoNoOrcamento: string;
  itemId: string;
  divergente: boolean;
  motivoDivergencia?: string;
}

export interface DivergenciaDetectada {
  itemId: string;
  loja: string;
  item: string;
  alerta: string;
  impactoFinanceiro?: string;
}

export interface ReconciliacaoResultado {
  itensMestre: ItemMestreReconciliado[];
  itensCotadosAtualizados: ItemCotadoAtualizado[];
  divergencias: DivergenciaDetectada[];
}

const RECONCILIAR_TOOL: Tool = {
  toolSpec: {
    name: "reconciliar_itens",
    description:
      "Casa itens equivalentes entre orçamentos de fornecedores diferentes da mesma obra, consolida uma lista mestra, e aponta divergências reais de especificação.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          itensMestre: {
            type: "array",
            description:
              "Lista consolidada de itens únicos da obra, casando itens equivalentes entre fornecedores.",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "slug curto e estável, ex: forro-madeira" },
                nome: { type: "string" },
                quantidade: { type: "number" },
                unidade: { type: "string" },
                especificacao: { type: "string" },
              },
              required: ["id", "nome", "quantidade", "unidade"],
            },
          },
          itensCotadosAtualizados: {
            type: "array",
            description:
              "Para cada item de cada orçamento recebido, o itemId da lista mestra correspondente e se há divergência.",
            items: {
              type: "object",
              properties: {
                orcamentoId: { type: "string" },
                descricaoNoOrcamento: {
                  type: "string",
                  description: "Deve ser cópia exata do texto original recebido.",
                },
                itemId: { type: "string" },
                divergente: { type: "boolean" },
                motivoDivergencia: { type: "string" },
              },
              required: ["orcamentoId", "descricaoNoOrcamento", "itemId", "divergente"],
            },
          },
          divergencias: {
            type: "array",
            items: {
              type: "object",
              properties: {
                itemId: { type: "string" },
                loja: { type: "string" },
                item: { type: "string" },
                alerta: { type: "string" },
                impactoFinanceiro: { type: "string" },
              },
              required: ["itemId", "loja", "item", "alerta"],
            },
          },
        },
        required: ["itensMestre", "itensCotadosAtualizados", "divergencias"],
      },
    },
  },
};

const SYSTEM_RECONCILIACAO = `Você compara orçamentos de fornecedores diferentes para a mesma
obra de construção e decide quais itens são "o mesmo item" entre fornecedores, mesmo que
descritos com palavras diferentes.

Regra central: DIFERENÇA DE PREÇO PURA NÃO É DIVERGÊNCIA — é exatamente o propósito da
comparação, então nunca marque divergente=true só porque um fornecedor está mais caro.
Só marque divergente=true quando há diferença MATERIAL de especificação entre o que os
fornecedores realmente estão cotando para o "mesmo" item — por exemplo: material fracionado
vs peça inteira/contínua, versão reforçada vs padrão, marca/qualidade claramente diferente,
ou quantidade cotada diferente da necessária. Nesses casos, preencha motivoDivergencia
explicando a diferença de forma clara para o usuário, e crie uma entrada correspondente em
"divergencias" com um alerta e, se possível, o impacto financeiro estimado dessa diferença.`;

export async function reconciliarItens(
  orcamentos: OrcamentoParaReconciliacao[]
): Promise<ReconciliacaoResultado> {
  const response = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_RECONCILIACAO }],
      messages: [
        {
          role: "user",
          content: [
            {
              text: `Orçamentos extraídos desta obra (JSON):\n${JSON.stringify(
                orcamentos,
                null,
                2
              )}\n\nUse a ferramenta reconciliar_itens para consolidar a lista mestra e apontar divergências reais.`,
            },
          ],
        },
      ],
      toolConfig: {
        tools: [RECONCILIAR_TOOL],
        toolChoice: { tool: { name: "reconciliar_itens" } },
      },
    })
  );

  const toolUse = response.output?.message?.content?.find((c) => c.toolUse)
    ?.toolUse;
  if (!toolUse?.input) {
    throw new Error("Bedrock não retornou reconciliação estruturada.");
  }
  return toolUse.input as unknown as ReconciliacaoResultado;
}
