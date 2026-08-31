import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE_NAME = process.env.TABLE_NAME as string;

export const pk = {
  obra: (obraId: string) => `OBRA#${obraId}`,
};

export const sk = {
  metadata: () => "METADATA",
  lista: (listaId: string) => `LISTA#${listaId}`,
  listaPrefix: (listaId: string) => `LISTA#${listaId}#`,
  item: (listaId: string, itemId: string) => `LISTA#${listaId}#ITEM#${itemId}`,
  itemPrefix: (listaId: string) => `LISTA#${listaId}#ITEM#`,
  orcamento: (listaId: string, orcamentoId: string) => `LISTA#${listaId}#ORCAMENTO#${orcamentoId}`,
  divergencia: (listaId: string, divergenciaId: string) =>
    `LISTA#${listaId}#DIVERGENCIA#${divergenciaId}`,
};

export const gsi1 = {
  pk: (userId: string) => `USER#${userId}`,
  sk: (createdAt: string, obraId: string) => `OBRA#${createdAt}#${obraId}`,
};
