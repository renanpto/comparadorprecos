import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { badRequest, forbidden, notFound, ok, serverError } from "../lib/response";
import type { Lista } from "../lib/types";

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    const listaId = event.pathParameters?.listaId;
    if (!obraId || !listaId) return notFound();

    const body = event.body ? JSON.parse(event.body) : {};
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    if (!nome) return badRequest("Campo 'nome' é obrigatório.");

    const obraResult = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.metadata() },
      })
    );
    if (!obraResult.Item) return notFound("Obra não encontrada.");
    if (obraResult.Item.userId !== userId) return forbidden();

    const listaResult = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.lista(listaId) },
      })
    );
    if (!listaResult.Item) return notFound("Lista não encontrada.");

    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.lista(listaId) },
        UpdateExpression: "SET nome = :nome, updatedAt = :now",
        ExpressionAttributeValues: { ":nome": nome, ":now": now },
      })
    );

    const lista: Lista = {
      listaId,
      obraId,
      nome,
      createdAt: listaResult.Item.createdAt,
      updatedAt: now,
    };
    return ok(lista);
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
