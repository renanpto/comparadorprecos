import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { badRequest, forbidden, notFound, ok, serverError } from "../lib/response";
import type { ItemCotado } from "../lib/types";

type Acao = "aceito" | "ignorado";

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    const divergenciaId = event.pathParameters?.divergenciaId;
    if (!obraId || !divergenciaId) return notFound();

    const body = event.body ? JSON.parse(event.body) : {};
    const acao = body.acao as Acao;
    if (acao !== "aceito" && acao !== "ignorado") {
      return badRequest("Campo 'acao' deve ser 'aceito' ou 'ignorado'.");
    }

    const obraResult = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.metadata() },
      })
    );
    if (!obraResult.Item) return notFound("Obra não encontrada.");
    if (obraResult.Item.userId !== userId) return forbidden();

    const divergenciaResult = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.divergencia(divergenciaId) },
      })
    );
    const divergencia = divergenciaResult.Item;
    if (!divergencia) return notFound("Divergência não encontrada.");

    const novoStatus = acao === "aceito" ? "ACEITA" : "IGNORADA";
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.divergencia(divergenciaId) },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": novoStatus },
      })
    );

    // "Ignorar" = usuário decidiu que a diferença não invalida a comparação de preço:
    // remove a flag divergente do item cotado correspondente. "Aceitar" mantém a flag.
    if (acao === "ignorado") {
      const orcamentosResult = await ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
          ExpressionAttributeValues: {
            ":pk": pk.obra(obraId),
            ":prefix": "ORCAMENTO#",
          },
        })
      );

      for (const orcamento of orcamentosResult.Items ?? []) {
        if (orcamento.nomeLoja !== divergencia.loja) continue;
        const itens: ItemCotado[] = orcamento.itens ?? [];
        const idx = itens.findIndex((i) => i.itemId === divergencia.itemId);
        if (idx === -1) continue;

        const itensAtualizados = [...itens];
        itensAtualizados[idx] = { ...itensAtualizados[idx], divergente: false };

        await ddb.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: pk.obra(obraId), SK: sk.orcamento(orcamento.orcamentoId) },
            UpdateExpression: "SET itens = :itens",
            ExpressionAttributeValues: { ":itens": itensAtualizados },
          })
        );
      }
    }

    return ok({ id: divergenciaId, status: novoStatus });
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
