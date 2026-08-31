import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { badRequest, conflict, created, forbidden, notFound, serverError } from "../lib/response";

const s3 = new S3Client({});
const BUCKET = process.env.UPLOADS_BUCKET as string;

const EXTENSAO_POR_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    const listaId = event.pathParameters?.listaId;
    if (!obraId || !listaId) return notFound();

    const body = event.body ? JSON.parse(event.body) : {};
    const contentType = body.contentType as string | undefined;
    if (!contentType || !EXTENSAO_POR_CONTENT_TYPE[contentType]) {
      return badRequest(
        "Campo 'contentType' inválido. Aceitos: " +
          Object.keys(EXTENSAO_POR_CONTENT_TYPE).join(", ")
      );
    }

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

    const itensResult = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": pk.obra(obraId),
          ":prefix": sk.itemPrefix(listaId),
        },
        Select: "COUNT",
      })
    );
    if (!itensResult.Count) {
      return conflict(
        "Esta lista ainda não tem itens. Cadastre a lista de itens antes de enviar orçamentos."
      );
    }

    const orcamentoId = randomUUID();
    const extensao = EXTENSAO_POR_CONTENT_TYPE[contentType];
    const s3Key = `obras/${obraId}/listas/${listaId}/orcamentos/${orcamentoId}/original.${extensao}`;
    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: pk.obra(obraId),
          SK: sk.orcamento(listaId, orcamentoId),
          entityType: "ORCAMENTO",
          obraId,
          listaId,
          orcamentoId,
          userId,
          status: "PENDENTE_UPLOAD",
          s3Key,
          nomeLoja: "",
          data: "",
          condicaoPagamento: "À Vista / PIX",
          totalGeral: 0,
          itens: [],
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: BUCKET, Key: s3Key, ContentType: contentType }),
      { expiresIn: 300 }
    );

    return created({ orcamentoId, uploadUrl, s3Key });
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
