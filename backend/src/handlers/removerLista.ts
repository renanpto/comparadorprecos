import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DeleteCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { forbidden, notFound, ok, serverError } from "../lib/response";

const s3 = new S3Client({});
const BUCKET = process.env.UPLOADS_BUCKET as string;

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

    const s3Keys = items
      .filter((i) => i.entityType === "ORCAMENTO" || i.entityType === "FOTO")
      .map((i) => i.s3Key)
      .filter((key): key is string => Boolean(key));

    await Promise.all(
      items.map((item) =>
        ddb.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { PK: item.PK, SK: item.SK },
          })
        )
      )
    );

    if (s3Keys.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: s3Keys.map((Key) => ({ Key })) },
        })
      );
    }

    return ok({ id: listaId });
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
