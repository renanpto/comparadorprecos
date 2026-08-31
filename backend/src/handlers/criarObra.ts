import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk, sk, gsi1 } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { badRequest, created, forbidden, serverError } from "../lib/response";
import type { Obra } from "../lib/types";

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const body = event.body ? JSON.parse(event.body) : {};
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    if (!nome) return badRequest("Campo 'nome' é obrigatório.");

    const obraId = randomUUID();
    const now = new Date().toISOString();
    const obra: Obra = { obraId, userId, nome, createdAt: now, updatedAt: now };

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: pk.obra(obraId),
          SK: sk.metadata(),
          entityType: "OBRA",
          GSI1PK: gsi1.pk(userId),
          GSI1SK: gsi1.sk(now, obraId),
          ...obra,
        },
      })
    );

    return created(obra);
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
