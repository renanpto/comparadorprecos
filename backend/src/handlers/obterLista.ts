import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import { getUserId, UnauthorizedError } from "../lib/auth";
import { forbidden, notFound, ok, serverError } from "../lib/response";
import type {
  DivergenciaIA,
  ItemListaMestra,
  Lista,
  ListaCompleta,
  OrcamentoFornecedor,
} from "../lib/types";

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
    const listaItem = items.find((i) => i.entityType === "LISTA");
    if (!listaItem) return notFound("Lista não encontrada.");

    const lista: Lista = {
      listaId: listaItem.listaId,
      obraId: listaItem.obraId,
      nome: listaItem.nome,
      createdAt: listaItem.createdAt,
      updatedAt: listaItem.updatedAt,
    };

    const listaMestra: ItemListaMestra[] = items
      .filter((i) => i.entityType === "ITEM_MESTRE")
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map((i) => ({
        id: i.itemId,
        nome: i.nome,
        quantidade: i.quantidade,
        unidade: i.unidade,
        especificacao: i.especificacao,
      }));

    const orcamentos: OrcamentoFornecedor[] = items
      .filter((i) => i.entityType === "ORCAMENTO")
      .map((i) => ({
        id: i.orcamentoId,
        obraId: i.obraId,
        listaId: i.listaId,
        nomeLoja: i.nomeLoja,
        data: i.data,
        condicaoPagamento: i.condicaoPagamento,
        totalGeral: i.totalGeral,
        status: i.status,
        s3Key: i.s3Key,
        erroMensagem: i.erroMensagem,
        itens: i.itens ?? [],
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      }));

    const divergencias: DivergenciaIA[] = items
      .filter((i) => i.entityType === "DIVERGENCIA")
      .map((i) => ({
        id: i.divergenciaId,
        obraId: i.obraId,
        listaId: i.listaId,
        loja: i.loja,
        itemId: i.itemId,
        item: i.item,
        tipo: i.tipo,
        alerta: i.alerta,
        impactoFinanceiro: i.impactoFinanceiro,
        status: i.status,
        createdAt: i.createdAt,
      }));

    const payload: ListaCompleta = { lista, listaMestra, orcamentos, divergencias };
    return ok(payload);
  } catch (err) {
    if (err instanceof UnauthorizedError) return forbidden(err.message);
    return serverError(err);
  }
}
