import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DeleteCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { conflict, forbidden, notFound, ok, serverError } from "../lib/response";

const s3 = new S3Client({});
const BUCKET = process.env.UPLOADS_BUCKET as string;

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    const listaId = event.pathParameters?.listaId;
    const fotoId = event.pathParameters?.fotoId;
    if (!obraId || !listaId || !fotoId) return notFound();

    const obraResult = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.metadata() },
      })
    );
    if (!obraResult.Item) return notFound("Obra não encontrada.");
    if (obraResult.Item.userId !== userId) return forbidden();

    const fotoResult = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.foto(listaId, fotoId) },
      })
    );
    if (!fotoResult.Item) return notFound("Foto não encontrada.");

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
        "Não é possível remover uma foto depois que orçamentos já foram processados nesta lista."
      );
    }

    const itensResult = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": pk.obra(obraId),
          ":prefix": sk.itemPrefix(listaId),
        },
      })
    );
    const itensDaFoto = (itensResult.Items ?? []).filter((i) => i.fotoId === fotoId);

    await Promise.all(
      itensDaFoto.map((item) =>
        ddb.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { PK: pk.obra(obraId), SK: sk.item(listaId, item.itemId) },
          })
        )
      )
    );

    await ddb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.foto(listaId, fotoId) },
      })
    );

    if (fotoResult.Item.s3Key) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fotoResult.Item.s3Key }));
    }

    return ok({ id: fotoId, itensRemovidos: itensDaFoto.length });
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
