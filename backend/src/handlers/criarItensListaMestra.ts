import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { badRequest, created, forbidden, notFound, serverError } from "../lib/response";
import type { ItemListaMestra } from "../lib/types";

interface ItemInput {
  nome: string;
  quantidade: number;
  unidade: string;
  especificacao?: string;
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    const listaId = event.pathParameters?.listaId;
    if (!obraId || !listaId) return notFound();

    const body = event.body ? JSON.parse(event.body) : {};
    const itensInput = body.itens as ItemInput[] | undefined;
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
    const itensCriados: ItemListaMestra[] = itensInput.map((item) => ({
      id: randomUUID(),
      nome: item.nome.trim(),
      quantidade: item.quantidade,
      unidade: item.unidade.trim(),
      especificacao: item.especificacao?.trim() || undefined,
    }));

    await Promise.all(
      itensCriados.map((item) =>
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
