import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { badRequest, created, forbidden, notFound, serverError } from "../lib/response";
import type { Lista } from "../lib/types";

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    if (!obraId) return notFound();

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

    const listaId = randomUUID();
    const now = new Date().toISOString();
    const lista: Lista = { listaId, obraId, nome, createdAt: now, updatedAt: now };

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: pk.obra(obraId),
          SK: sk.lista(listaId),
          entityType: "LISTA",
          ...lista,
        },
      })
    );

    return created(lista);
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
