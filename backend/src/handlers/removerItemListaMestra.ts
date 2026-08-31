import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DeleteCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { conflict, forbidden, notFound, ok, serverError } from "../lib/response";

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    const listaId = event.pathParameters?.listaId;
    const itemId = event.pathParameters?.itemId;
    if (!obraId || !listaId || !itemId) return notFound();

    const obraResult = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.metadata() },
      })
    );
    if (!obraResult.Item) return notFound("Obra não encontrada.");
    if (obraResult.Item.userId !== userId) return forbidden();

    const itemResult = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.item(listaId, itemId) },
      })
    );
    if (!itemResult.Item) return notFound("Item não encontrado.");

    const orcamentosResult = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": pk.obra(obraId),
          ":prefix": sk.orcamento(listaId, ""),
        },
      })
    );
    const temOrcamentoProcessado = (orcamentosResult.Items ?? []).some(
      (o) => o.status === "PROCESSADO"
    );
    if (temOrcamentoProcessado) {
      return conflict(
        "Não é possível remover um item depois que orçamentos já foram processados nesta lista."
      );
    }

    await ddb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.item(listaId, itemId) },
      })
    );

    return ok({ id: itemId });
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
