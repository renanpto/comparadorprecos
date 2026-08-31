import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { forbidden, notFound, ok, serverError } from "../lib/response";
import type { ItemListaMestra, OrcamentoFornecedor } from "../lib/types";

interface CotacaoPorItem {
  loja: string;
  orcamentoId: string;
  precoTotal: number;
  divergente: boolean;
  descricaoNoOrcamento: string;
  motivoDivergencia?: string;
}

interface ItemSplitBuy {
  itemId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  especificacao?: string;
  melhorLoja: string | null;
  precoTotal: number | null;
  cotacoes: CotacaoPorItem[];
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    const listaId = event.pathParameters?.listaId;
    if (!obraId || !listaId) return notFound();

    const obraResult = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.metadata() },
      })
    );
    if (!obraResult.Item) return notFound("Obra não encontrada.");
    if (obraResult.Item.userId !== userId) return forbidden();

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": pk.obra(obraId),
          ":prefix": sk.lista(listaId),
        },
      })
    );
    const items = result.Items ?? [];
    if (!items.some((i) => i.entityType === "LISTA")) return notFound("Lista não encontrada.");

    const listaMestra: ItemListaMestra[] = items
      .filter((i) => i.entityType === "ITEM_MESTRE")
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((i) => ({
        id: i.itemId,
        nome: i.nome,
        quantidade: i.quantidade,
        unidade: i.unidade,
        especificacao: i.especificacao,
      }));

    const orcamentos: OrcamentoFornecedor[] = items
      .filter((i) => i.entityType === "ORCAMENTO" && i.status === "PROCESSADO")
      .map((i) => ({
        id: i.orcamentoId,
        obraId: i.obraId,
        listaId: i.listaId,
        nomeLoja: i.nomeLoja,
        data: i.data,
        condicaoPagamento: i.condicaoPagamento,
        totalGeral: i.totalGeral,
        status: i.status,
        s3Key: i.s3Key,
        itens: i.itens ?? [],
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      }));

    const itensSplit: ItemSplitBuy[] = listaMestra.map((itemMestre) => {
      const cotacoes: CotacaoPorItem[] = orcamentos
        .map((orc): CotacaoPorItem | null => {
          const cotado = orc.itens.find((it) => it.itemId === itemMestre.id);
          if (!cotado) return null;
          return {
            loja: orc.nomeLoja,
            orcamentoId: orc.id,
            precoTotal: cotado.precoTotal,
            divergente: cotado.divergente,
            descricaoNoOrcamento: cotado.descricaoNoOrcamento,
            motivoDivergencia: cotado.motivoDivergencia,
          };
        })
        .filter((c): c is CotacaoPorItem => c !== null);

      const melhor =
        cotacoes.length > 0
          ? cotacoes.reduce((min, c) => (c.precoTotal < min.precoTotal ? c : min))
          : null;

      return {
        itemId: itemMestre.id,
        nome: itemMestre.nome,
        quantidade: itemMestre.quantidade,
        unidade: itemMestre.unidade,
        especificacao: itemMestre.especificacao,
        melhorLoja: melhor?.loja ?? null,
        precoTotal: melhor?.precoTotal ?? null,
        cotacoes,
      };
    });

    const itensSemCotacao = itensSplit.filter((i) => i.precoTotal === null).length;
    const totalSplit = itensSplit.reduce((acc, i) => acc + (i.precoTotal ?? 0), 0);

    const menorFornecedor = orcamentos.reduce<OrcamentoFornecedor | null>(
      (min, o) => (!min || o.totalGeral < min.totalGeral ? o : min),
      null
    );

    const economiaTotal = menorFornecedor
      ? menorFornecedor.totalGeral - totalSplit
      : 0;
    const economiaPercent =
      menorFornecedor && menorFornecedor.totalGeral > 0
        ? (economiaTotal / menorFornecedor.totalGeral) * 100
        : 0;

    return ok({
      orcamentos,
      splitBuy: { itens: itensSplit, totalSplit, itensSemCotacao },
      menorFornecedor: menorFornecedor
        ? {
            nomeLoja: menorFornecedor.nomeLoja,
            totalGeral: menorFornecedor.totalGeral,
            condicaoPagamento: menorFornecedor.condicaoPagamento,
          }
        : null,
      economiaTotal: economiaTotal > 0 ? economiaTotal : 0,
      economiaPercent: economiaPercent > 0 ? economiaPercent : 0,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
