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
  item: (itemId: string) => `ITEM#${itemId}`,
  orcamento: (orcamentoId: string) => `ORCAMENTO#${orcamentoId}`,
  divergencia: (divergenciaId: string) => `DIVERGENCIA#${divergenciaId}`,
};

export const gsi1 = {
  pk: (userId: string) => `USER#${userId}`,
  sk: (createdAt: string, obraId: string) => `OBRA#${createdAt}#${obraId}`,
};
