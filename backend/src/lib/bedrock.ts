import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({});
const MODEL_ID = process.env.BEDROCK_MODEL_ID as string;

const SYSTEM_DOMINIO = `Você é um assistente especializado em ler orçamentos/cotações informais
(fotos de papel manuscrito, notas de balcão, ou PDFs) que fornecedores enviam em resposta a uma
lista de itens ou peças que alguém precisa comprar — pode ser material de construção, peças de
veículo, ou qualquer outro tipo de item cotado com fornecedores. Preços estão em reais (R$).
Letra pode ser manuscrita e de difícil leitura — faça o melhor possível e nunca invente itens que
não estão na imagem. Preserve o texto original de cada item exatamente como escrito pelo
fornecedor em "descricaoNoOrcamento" (não normalize nem traduza), pois esse texto será usado
depois para comparar com a lista de itens que o comprador pediu para cotar.`;

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
// Fase 2 — compara o orçamento recebido contra a lista mestra (fixa,
// definida pelo usuário antes de qualquer upload)
// ---------------------------------------------------------------------

export interface ItemListaMestraParaComparacao {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  especificacao?: string;
}

export interface ItemCotadoAtualizado {
  descricaoNoOrcamento: string;
  itemId: string; // "" se não corresponde a nenhum item da lista mestra
  divergente: boolean;
  motivoDivergencia?: string;
}

export interface ItemNaoCotado {
  itemId: string; // id na lista mestra
  motivo?: string;
}

export interface ItemExtra {
  descricaoNoOrcamento: string;
  motivo?: string;
}

export interface ComparacaoResultado {
  itensCotadosAtualizados: ItemCotadoAtualizado[];
  itensNaoCotados: ItemNaoCotado[];
  itensExtras: ItemExtra[];
}

const COMPARAR_TOOL: Tool = {
  toolSpec: {
    name: "comparar_com_lista_mestra",
    description:
      "Compara os itens de um orçamento de fornecedor contra a lista mestra de itens que o comprador pediu para cotar, apontando correspondências, divergências, itens não cotados e itens extras.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          itensCotadosAtualizados: {
            type: "array",
            description: "Um registro para cada item do orçamento recebido.",
            items: {
              type: "object",
              properties: {
                descricaoNoOrcamento: {
                  type: "string",
                  description: "Deve ser cópia exata do texto original recebido.",
                },
                itemId: {
                  type: "string",
                  description:
                    "id do item da lista mestra a que este item corresponde, ou string vazia se não corresponder a nenhum.",
                },
                divergente: { type: "boolean" },
                motivoDivergencia: { type: "string" },
              },
              required: ["descricaoNoOrcamento", "itemId", "divergente"],
            },
          },
          itensNaoCotados: {
            type: "array",
            description:
              "Itens da lista mestra que este fornecedor não cotou (não aparecem no orçamento).",
            items: {
              type: "object",
              properties: {
                itemId: { type: "string" },
                motivo: { type: "string" },
              },
              required: ["itemId"],
            },
          },
          itensExtras: {
            type: "array",
            description:
              "Itens cotados pelo fornecedor que não correspondem a nenhum item da lista mestra.",
            items: {
              type: "object",
              properties: {
                descricaoNoOrcamento: { type: "string" },
                motivo: { type: "string" },
              },
              required: ["descricaoNoOrcamento"],
            },
          },
        },
        required: ["itensCotadosAtualizados", "itensNaoCotados", "itensExtras"],
      },
    },
  },
};

const SYSTEM_COMPARACAO = `Você compara um orçamento de fornecedor contra a lista mestra de itens
que o comprador definiu previamente e pediu para cotar. A lista mestra é a fonte da verdade —
foi criada pelo comprador antes de pedir qualquer orçamento, não pelo fornecedor.

Para cada item do orçamento, decida a qual item da lista mestra ele corresponde (mesmo que o
fornecedor descreva com palavras diferentes das da lista) e preencha "itemId" com o id
correspondente. Se um item do orçamento não corresponder a nada da lista mestra, use
itemId="" e registre-o também em "itensExtras".

Regra central: DIFERENÇA DE PREÇO PURA NÃO É DIVERGÊNCIA — é exatamente o propósito da
comparação, então nunca marque divergente=true só porque o preço é alto ou baixo. Só marque
divergente=true quando há diferença MATERIAL entre o que foi pedido (nome/quantidade/unidade/
especificação da lista mestra) e o que o fornecedor está realmente cotando para o mesmo item —
por exemplo: material fracionado vs peça inteira/contínua, versão reforçada vs padrão, marca/
qualidade claramente diferente, quantidade cotada diferente da pedida, ou unidade incompatível.
Nesses casos preencha "motivoDivergencia" explicando a diferença de forma clara para o usuário.

Além disso, todo item da lista mestra que não tiver nenhum item correspondente no orçamento
deve aparecer em "itensNaoCotados" — isso não é uma divergência de especificação, é ausência de
cotação, e é informação importante para o comprador saber que esse fornecedor não cobriu aquele
item.`;

export async function compararOrcamentoComListaMestra(
  listaMestra: ItemListaMestraParaComparacao[],
  orcamento: { nomeLoja: string; itens: ItemExtraido[] }
): Promise<ComparacaoResultado> {
  const response = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_COMPARACAO }],
      messages: [
        {
          role: "user",
          content: [
            {
              text: `Lista mestra de itens pedidos (JSON):\n${JSON.stringify(
                listaMestra,
                null,
                2
              )}\n\nOrçamento recebido do fornecedor "${orcamento.nomeLoja}" (JSON):\n${JSON.stringify(
                orcamento.itens,
                null,
                2
              )}\n\nUse a ferramenta comparar_com_lista_mestra para registrar a comparação.`,
            },
          ],
        },
      ],
      toolConfig: {
        tools: [COMPARAR_TOOL],
        toolChoice: { tool: { name: "comparar_com_lista_mestra" } },
      },
    })
  );

  const toolUse = response.output?.message?.content?.find((c) => c.toolUse)
    ?.toolUse;
  if (!toolUse?.input) {
    throw new Error("Bedrock não retornou comparação estruturada.");
  }
  return toolUse.input as unknown as ComparacaoResultado;
}
