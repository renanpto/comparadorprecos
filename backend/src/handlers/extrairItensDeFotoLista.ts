import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { extrairItensDeFotoLista } from "../lib/bedrock";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { badRequest, forbidden, notFound, ok, serverError } from "../lib/response";

const CONTENT_TYPES_ACEITOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const TAMANHO_MAXIMO_BYTES = 5.5 * 1024 * 1024;

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    const listaId = event.pathParameters?.listaId;
    if (!obraId || !listaId) return notFound();

    const body = event.body ? JSON.parse(event.body) : {};
    const imageBase64 = body.imageBase64 as string | undefined;
    const contentType = body.contentType as string | undefined;
    if (!imageBase64 || !contentType || !CONTENT_TYPES_ACEITOS.has(contentType)) {
      return badRequest(
        "Campos 'imageBase64' e 'contentType' são obrigatórios. Tipos aceitos: " +
          Array.from(CONTENT_TYPES_ACEITOS).join(", ")
      );
    }

    const bytes = Buffer.from(imageBase64, "base64");
    if (bytes.byteLength > TAMANHO_MAXIMO_BYTES) {
      return badRequest("Imagem muito grande. Envie uma foto com até 5,5MB.");
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

    const itens = await extrairItensDeFotoLista(bytes, contentType);
    return ok({ itens });
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
