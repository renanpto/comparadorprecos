import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, gsi1 } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { forbidden, ok, serverError } from "../lib/response";
import type { Obra } from "../lib/types";

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :userPk",
        ExpressionAttributeValues: { ":userPk": gsi1.pk(userId) },
        ScanIndexForward: false,
      })
    );

    const obras: Obra[] = (result.Items ?? []).map((item) => ({
      obraId: item.obraId,
      userId: item.userId,
      nome: item.nome,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return ok({ obras });
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
