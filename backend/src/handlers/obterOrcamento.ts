import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { forbidden, notFound, ok, serverError } from "../lib/response";
import type { OrcamentoFornecedor } from "../lib/types";

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    const listaId = event.pathParameters?.listaId;
    const orcamentoId = event.pathParameters?.orcamentoId;
    if (!obraId || !listaId || !orcamentoId) return notFound();

    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk.obra(obraId), SK: sk.orcamento(listaId, orcamentoId) },
      })
    );
    const item = result.Item;
    if (!item) return notFound("Orçamento não encontrado.");
    if (item.userId !== userId) return forbidden();

    const orcamento: OrcamentoFornecedor = {
      id: item.orcamentoId,
      obraId: item.obraId,
      listaId: item.listaId,
      nomeLoja: item.nomeLoja,
      data: item.data,
      condicaoPagamento: item.condicaoPagamento,
      totalGeral: item.totalGeral,
      status: item.status,
      s3Key: item.s3Key,
      erroMensagem: item.erroMensagem,
      itens: item.itens ?? [],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };

    return ok(orcamento);
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
