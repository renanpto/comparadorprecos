import type { S3Handler } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import {
  compararOrcamentoComListaMestra,
  extrairOrcamento,
  type ItemListaMestraParaComparacao,
} from "../lib/bedrock";
import type { ItemCotado, TipoDivergencia } from "../lib/types";

const s3 = new S3Client({});

const CONTENT_TYPE_POR_EXTENSAO: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

const KEY_REGEX =
  /^obras\/([^/]+)\/listas\/([^/]+)\/orcamentos\/([^/]+)\/original\.(\w+)$/;

export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const bucket = record.s3.bucket.name;
    const match = KEY_REGEX.exec(key);
    if (!match) {
      console.error("Chave S3 fora do padrão esperado, ignorando:", key);
      continue;
    }
    const [, obraId, listaId, orcamentoId, extensao] = match;

    try {
      await processarUmOrcamento(bucket, key, obraId, listaId, orcamentoId, extensao);
    } catch (err) {
      console.error(
        `Falha ao processar orçamento ${orcamentoId} (lista ${listaId}, obra ${obraId}):`,
        err
      );
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: pk.obra(obraId), SK: sk.orcamento(listaId, orcamentoId) },
          UpdateExpression: "SET #status = :status, erroMensagem = :erro, updatedAt = :now",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": "ERRO",
            ":erro": err instanceof Error ? err.message : "Erro desconhecido ao processar.",
            ":now": new Date().toISOString(),
          },
        })
      );
      // relança para acionar o retry/DLQ configurados na função
      throw err;
    }
  }
};

async function processarUmOrcamento(
  bucket: string,
  key: string,
  obraId: string,
  listaId: string,
  orcamentoId: string,
  extensao: string
) {
  const now = () => new Date().toISOString();
  const orcamentoKey = { PK: pk.obra(obraId), SK: sk.orcamento(listaId, orcamentoId) };

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: orcamentoKey,
      UpdateExpression: "SET #status = :status, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": "PROCESSANDO", ":now": now() },
    })
  );

  const objeto = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await objeto.Body!.transformToByteArray();
  const contentType =
    objeto.ContentType && objeto.ContentType !== "application/octet-stream"
      ? objeto.ContentType
      : CONTENT_TYPE_POR_EXTENSAO[extensao] ?? "application/octet-stream";

  const extracao = await extrairOrcamento(bytes, contentType);

  const itensExtraidos: ItemCotado[] = extracao.itens.map((item) => ({
    itemId: "", // resolvido abaixo, na comparação com a lista mestra
    nomeLoja: extracao.nomeLoja,
    descricaoNoOrcamento: item.descricaoNoOrcamento,
    quantidade: item.quantidade,
    unidade: item.unidade,
    precoUnitario: item.precoUnitario,
    precoTotal: item.precoTotal,
    divergente: false,
  }));

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: orcamentoKey,
      UpdateExpression:
        "SET nomeLoja = :nomeLoja, #data = :data, condicaoPagamento = :condicaoPagamento, " +
        "totalGeral = :totalGeral, itens = :itens, updatedAt = :now",
      ExpressionAttributeNames: { "#data": "data" },
      ExpressionAttributeValues: {
        ":nomeLoja": extracao.nomeLoja,
        ":data": extracao.data || now().slice(0, 10),
        ":condicaoPagamento": extracao.condicaoPagamento,
        ":totalGeral": extracao.totalGeral,
        ":itens": itensExtraidos,
        ":now": now(),
      },
    })
  );

  const listaMestraResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": pk.obra(obraId),
        ":prefix": sk.itemPrefix(listaId),
      },
    })
  );
  const listaMestra = listaMestraResult.Items ?? [];
  if (listaMestra.length === 0) {
    throw new Error("Esta lista não tem itens cadastrados para comparar o orçamento.");
  }

  const listaMestraParaComparacao: ItemListaMestraParaComparacao[] = listaMestra.map((i) => ({
    id: i.itemId,
    nome: i.nome,
    quantidade: i.quantidade,
    unidade: i.unidade,
    especificacao: i.especificacao,
  }));
  const nomePorItemId = new Map(listaMestraParaComparacao.map((i) => [i.id, i.nome]));

  const comparacao = await compararOrcamentoComListaMestra(listaMestraParaComparacao, {
    nomeLoja: extracao.nomeLoja,
    itens: extracao.itens,
  });

  const itensAtualizados: ItemCotado[] = itensExtraidos.map((item) => {
    const atualizacao = comparacao.itensCotadosAtualizados.find(
      (a) => a.descricaoNoOrcamento === item.descricaoNoOrcamento
    );
    if (!atualizacao) return item;
    return {
      ...item,
      itemId: atualizacao.itemId,
      divergente: atualizacao.divergente,
      motivoDivergencia: atualizacao.motivoDivergencia,
    };
  });

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: orcamentoKey,
      UpdateExpression: "SET itens = :itens, #status = :status, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":itens": itensAtualizados,
        ":status": "PROCESSADO",
        ":now": now(),
      },
    })
  );

  const divergenciasParaCriar: Array<{
    itemId: string;
    item: string;
    tipo: TipoDivergencia;
    alerta: string;
  }> = [];

  for (const item of itensAtualizados) {
    if (!item.divergente) continue;
    divergenciasParaCriar.push({
      itemId: item.itemId,
      item: nomePorItemId.get(item.itemId) ?? item.descricaoNoOrcamento,
      tipo: "ESPECIFICACAO_DIFERENTE",
      alerta: item.motivoDivergencia ?? "Especificação diferente do que foi pedido na lista.",
    });
  }

  for (const naoCotado of comparacao.itensNaoCotados) {
    const nome = nomePorItemId.get(naoCotado.itemId);
    if (!nome) continue; // itemId inválido retornado pela IA, ignora defensivamente
    divergenciasParaCriar.push({
      itemId: naoCotado.itemId,
      item: nome,
      tipo: "ITEM_NAO_COTADO",
      alerta: naoCotado.motivo ?? `${extracao.nomeLoja} não cotou este item.`,
    });
  }

  for (const extra of comparacao.itensExtras) {
    divergenciasParaCriar.push({
      itemId: "",
      item: extra.descricaoNoOrcamento,
      tipo: "ITEM_EXTRA",
      alerta: extra.motivo ?? `${extracao.nomeLoja} cotou um item que não estava na lista.`,
    });
  }

  await Promise.all(
    divergenciasParaCriar.map((d) => {
      const divergenciaId = randomUUID();
      return ddb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: pk.obra(obraId),
            SK: sk.divergencia(listaId, divergenciaId),
            entityType: "DIVERGENCIA",
            obraId,
            listaId,
            divergenciaId,
            loja: extracao.nomeLoja,
            itemId: d.itemId,
            item: d.item,
            tipo: d.tipo,
            alerta: d.alerta,
            status: "PENDENTE",
            createdAt: now(),
          },
        })
      );
    })
  );
}
