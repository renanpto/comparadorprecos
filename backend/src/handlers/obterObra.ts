import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { forbidden, notFound, ok, serverError } from "../lib/response";
import type { Obra, ObraComListas, ResumoLista } from "../lib/types";

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const userId = getUserId(event);
    const obraId = event.pathParameters?.obraId;
    if (!obraId) return notFound();

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": pk.obra(obraId) },
      })
    );

    const items = result.Items ?? [];
    const metadata = items.find((i) => i.entityType === "OBRA");
    if (!metadata) return notFound("Obra não encontrada.");
    if (metadata.userId !== userId) return forbidden();

    const obra: Obra = {
      obraId: metadata.obraId,
      userId: metadata.userId,
      nome: metadata.nome,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
    };

    const orcamentos = items.filter((i) => i.entityType === "ORCAMENTO");

    const listas: ResumoLista[] = items
      .filter((i) => i.entityType === "LISTA")
      .map((i) => {
        const orcamentosDaLista = orcamentos.filter((o) => o.listaId === i.listaId);
        return {
          listaId: i.listaId,
          nome: i.nome,
          createdAt: i.createdAt,
          totalOrcamentos: orcamentosDaLista.length,
          totalOrcamentosProcessados: orcamentosDaLista.filter(
            (o) => o.status === "PROCESSADO"
          ).length,
        };
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const payload: ObraComListas = { obra, listas };
    return ok(payload);
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
