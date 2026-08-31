import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { forbidden, notFound, ok, serverError } from "../lib/response";
import type {
  DivergenciaIA,
  ItemListaMestra,
  Obra,
  ObraCompleta,
  OrcamentoFornecedor,
} from "../lib/types";

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

    const obra: Obra = {
      obraId: metadata.obraId,
      userId: metadata.userId,
      nome: metadata.nome,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
    };

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
      .filter((i) => i.entityType === "ORCAMENTO")
      .map((i) => ({
        id: i.orcamentoId,
        obraId: i.obraId,
        nomeLoja: i.nomeLoja,
        data: i.data,
        condicaoPagamento: i.condicaoPagamento,
        totalGeral: i.totalGeral,
        status: i.status,
        s3Key: i.s3Key,
        erroMensagem: i.erroMensagem,
        itens: i.itens ?? [],
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      }));

    const divergencias: DivergenciaIA[] = items
      .filter((i) => i.entityType === "DIVERGENCIA")
      .map((i) => ({
        id: i.divergenciaId,
        obraId: i.obraId,
        loja: i.loja,
        itemId: i.itemId,
        item: i.item,
        alerta: i.alerta,
        impactoFinanceiro: i.impactoFinanceiro,
        status: i.status,
        createdAt: i.createdAt,
      }));

    const payload: ObraCompleta = { obra, listaMestra, orcamentos, divergencias };
    return ok(payload);
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
