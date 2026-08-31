import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { forbidden, notFound, ok, serverError } from "../lib/response";
import type { ItemListaMestra, OrcamentoFornecedor } from "../lib/types";

interface CotacaoPorItem {
  loja: string;
  orcamentoId: string;
  precoTotal: number;
  divergente: boolean;
}

interface ItemSplitBuy {
  itemId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  especificacao?: string;
  melhorLoja: string;
  precoTotal: number;
  cotacoes: CotacaoPorItem[];
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    if (!obraId) return notFound();

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": pk.obra(obraId) },
      })
    );
    const items = result.Items ?? [];
    const metadata = items.find((i) => i.entityType === "OBRA");
    if (!metadata) return notFound("Obra não encontrada.");
    if (metadata.userId !== userId) return forbidden();

    const listaMestra: ItemListaMestra[] = items
      .filter((i) => i.entityType === "ITEM_MESTRE")
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
        .map((orc) => {
          const cotado = orc.itens.find((it) => it.itemId === itemMestre.id);
          if (!cotado) return null;
          return {
            loja: orc.nomeLoja,
            orcamentoId: orc.id,
            precoTotal: cotado.precoTotal,
            divergente: cotado.divergente,
          };
        })
        .filter((c): c is CotacaoPorItem => c !== null);

      const melhor = cotacoes.reduce(
        (min, c) => (c.precoTotal < min.precoTotal ? c : min),
        cotacoes[0]
      );

      return {
        itemId: itemMestre.id,
        nome: itemMestre.nome,
        quantidade: itemMestre.quantidade,
        unidade: itemMestre.unidade,
        especificacao: itemMestre.especificacao,
        melhorLoja: melhor?.loja ?? "",
        precoTotal: melhor?.precoTotal ?? 0,
        cotacoes,
      };
    });

    const totalSplit = itensSplit.reduce((acc, i) => acc + i.precoTotal, 0);

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
      splitBuy: { itens: itensSplit, totalSplit },
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
