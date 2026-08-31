import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { badRequest, created, forbidden, notFound, serverError } from "../lib/response";
import type { ItemListaMestra } from "../lib/types";

const s3 = new S3Client({});
const BUCKET = process.env.UPLOADS_BUCKET as string;

const EXTENSAO_POR_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

interface ItemInput {
  nome: string;
  quantidade: number;
  unidade: string;
  especificacao?: string;
  fotoRef?: string;
}

interface FotoInput {
  ref: string;
  imageBase64: string;
  contentType: string;
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    const listaId = event.pathParameters?.listaId;
    if (!obraId || !listaId) return notFound();

    const body = event.body ? JSON.parse(event.body) : {};
    const itensInput = body.itens as ItemInput[] | undefined;
    const fotosInput = (body.fotos as FotoInput[] | undefined) ?? [];

    if (!Array.isArray(itensInput) || itensInput.length === 0) {
      return badRequest("Campo 'itens' deve ser uma lista não vazia.");
    }
    for (const item of itensInput) {
      if (
        typeof item.nome !== "string" ||
        !item.nome.trim() ||
        typeof item.quantidade !== "number" ||
        item.quantidade <= 0 ||
        typeof item.unidade !== "string" ||
        !item.unidade.trim()
      ) {
        return badRequest(
          "Cada item precisa de 'nome', 'quantidade' (> 0) e 'unidade' válidos."
        );
      }
    }
    for (const foto of fotosInput) {
      if (
        typeof foto.ref !== "string" ||
        !foto.ref ||
        typeof foto.imageBase64 !== "string" ||
        !foto.imageBase64 ||
        !EXTENSAO_POR_CONTENT_TYPE[foto.contentType]
      ) {
        return badRequest("Cada foto precisa de 'ref', 'imageBase64' e 'contentType' válidos.");
      }
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

    const now = new Date().toISOString();

    // Itens são adicionados em lotes ao longo do tempo ("+ Adicionar" na lista já
    // existente), então a ordem de exibição precisa continuar a partir do maior
    // "ordem" já salvo — não pode reiniciar em 1 a cada novo lote.
    const itensExistentesResult = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": pk.obra(obraId),
          ":prefix": sk.itemPrefix(listaId),
        },
      })
    );
    const maiorOrdemExistente = (itensExistentesResult.Items ?? []).reduce(
      (max, item) => Math.max(max, typeof item.ordem === "number" ? item.ordem : 0),
      0
    );

    // Persiste as fotos aprovadas (upload no S3 + registro FOTO) e monta o mapa ref -> fotoId real.
    const refParaFotoId = new Map<string, string>();
    await Promise.all(
      fotosInput.map(async (foto) => {
        const fotoId = randomUUID();
        refParaFotoId.set(foto.ref, fotoId);
        const extensao = EXTENSAO_POR_CONTENT_TYPE[foto.contentType];
        const s3Key = `obras/${obraId}/listas/${listaId}/fotos/${fotoId}/original.${extensao}`;
        const bytes = Buffer.from(foto.imageBase64, "base64");

        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: s3Key,
            Body: bytes,
            ContentType: foto.contentType,
          })
        );
        await ddb.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: {
              PK: pk.obra(obraId),
              SK: sk.foto(listaId, fotoId),
              entityType: "FOTO",
              obraId,
              listaId,
              fotoId,
              s3Key,
              contentType: foto.contentType,
              createdAt: now,
            },
          })
        );
      })
    );

    const itensCriados: ItemListaMestra[] = itensInput.map((item) => ({
      id: randomUUID(),
      nome: item.nome.trim(),
      quantidade: item.quantidade,
      unidade: item.unidade.trim(),
      especificacao: item.especificacao?.trim() || undefined,
      fotoId: item.fotoRef ? refParaFotoId.get(item.fotoRef) : undefined,
    }));

    await Promise.all(
      itensCriados.map((item, index) =>
        ddb.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: {
              PK: pk.obra(obraId),
              SK: sk.item(listaId, item.id),
              entityType: "ITEM_MESTRE",
              obraId,
              listaId,
              itemId: item.id,
              nome: item.nome,
              quantidade: item.quantidade,
              unidade: item.unidade,
              especificacao: item.especificacao,
              fotoId: item.fotoId,
              ordem: maiorOrdemExistente + index + 1,
              createdAt: now,
            },
          })
        )
      )
    );

    return created({ itens: itensCriados });
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
