import type { S3Handler } from "aws-lambda";
import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ddb, TABLE_NAME, pk, sk } from "../lib/dynamo";
import {
  extrairOrcamento,
  reconciliarItens,
  type OrcamentoParaReconciliacao,
} from "../lib/bedrock";
import type { ItemCotado } from "../lib/types";

const s3 = new S3Client({});

const CONTENT_TYPE_POR_EXTENSAO: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

const KEY_REGEX = /^obras\/([^/]+)\/orcamentos\/([^/]+)\/original\.(\w+)$/;

export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const bucket = record.s3.bucket.name;
    const match = KEY_REGEX.exec(key);
    if (!match) {
      console.error("Chave S3 fora do padrão esperado, ignorando:", key);
      continue;
    }
    const [, obraId, orcamentoId, extensao] = match;

    try {
      await processarUmOrcamento(bucket, key, obraId, orcamentoId, extensao);
    } catch (err) {
      console.error(`Falha ao processar orçamento ${orcamentoId} da obra ${obraId}:`, err);
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: pk.obra(obraId), SK: sk.orcamento(orcamentoId) },
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
  orcamentoId: string,
  extensao: string
) {
  const now = () => new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk.obra(obraId), SK: sk.orcamento(orcamentoId) },
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
    itemId: "", // resolvido na fase de reconciliação abaixo
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
      Key: { PK: pk.obra(obraId), SK: sk.orcamento(orcamentoId) },
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

  await reconciliarObra(obraId);
}

async function reconciliarObra(obraId: string) {
  const now = () => new Date().toISOString();

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": pk.obra(obraId) },
    })
  );
  const items = result.Items ?? [];

  const orcamentosComItens = items.filter(
    (i) => i.entityType === "ORCAMENTO" && (i.itens ?? []).length > 0
  );
  if (orcamentosComItens.length === 0) return;

  const entrada: OrcamentoParaReconciliacao[] = orcamentosComItens.map((o) => ({
    orcamentoId: o.orcamentoId,
    nomeLoja: o.nomeLoja,
    itens: (o.itens as ItemCotado[]).map((i) => ({
      descricaoNoOrcamento: i.descricaoNoOrcamento,
      quantidade: i.quantidade ?? 0,
      unidade: i.unidade ?? "",
      precoUnitario: i.precoUnitario,
      precoTotal: i.precoTotal,
    })),
  }));

  const reconciliacao = await reconciliarItens(entrada);

  // --- lista mestra: substitui o conjunto anterior pelo novo (upsert + remove órfãos) ---
  const mestreExistente = items.filter((i) => i.entityType === "ITEM_MESTRE");
  const novosIds = new Set(reconciliacao.itensMestre.map((i) => i.id));
  await Promise.all([
    ...reconciliacao.itensMestre.map((item) =>
      ddb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: pk.obra(obraId),
            SK: sk.item(item.id),
            entityType: "ITEM_MESTRE",
            obraId,
            itemId: item.id,
            nome: item.nome,
            quantidade: item.quantidade,
            unidade: item.unidade,
            especificacao: item.especificacao,
          },
        })
      )
    ),
    ...mestreExistente
      .filter((m) => !novosIds.has(m.itemId))
      .map((m) =>
        ddb.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { PK: pk.obra(obraId), SK: sk.item(m.itemId) },
          })
        )
      ),
  ]);

  // --- atualiza itemId/divergente/motivoDivergencia em cada orçamento ---
  for (const orcamento of orcamentosComItens) {
    const itensAtuais: ItemCotado[] = orcamento.itens ?? [];
    const itensAtualizados = itensAtuais.map((item) => {
      const atualizacao = reconciliacao.itensCotadosAtualizados.find(
        (a) =>
          a.orcamentoId === orcamento.orcamentoId &&
          a.descricaoNoOrcamento === item.descricaoNoOrcamento
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
        Key: { PK: pk.obra(obraId), SK: sk.orcamento(orcamento.orcamentoId) },
        UpdateExpression: "SET itens = :itens, #status = :status, updatedAt = :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":itens": itensAtualizados,
          ":status": "PROCESSADO",
          ":now": now(),
        },
      })
    );
  }

  // --- divergências: recomputa preservando status já decidido pelo usuário (loja+item) ---
  const divergenciasExistentes = items.filter((i) => i.entityType === "DIVERGENCIA");
  const statusAnteriorPorChave = new Map(
    divergenciasExistentes.map((d) => [`${d.loja}|${d.itemId}`, d.status])
  );

  await Promise.all(
    divergenciasExistentes.map((d) =>
      ddb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { PK: pk.obra(obraId), SK: sk.divergencia(d.divergenciaId) },
        })
      )
    )
  );

  await Promise.all(
    reconciliacao.divergencias.map((d) => {
      const chave = `${d.loja}|${d.itemId}`;
      const divergenciaId = randomUUID();
      return ddb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: pk.obra(obraId),
            SK: sk.divergencia(divergenciaId),
            entityType: "DIVERGENCIA",
            obraId,
            divergenciaId,
            loja: d.loja,
            itemId: d.itemId,
            item: d.item,
            alerta: d.alerta,
            impactoFinanceiro: d.impactoFinanceiro,
            status: statusAnteriorPorChave.get(chave) ?? "PENDENTE",
            createdAt: now(),
          },
        })
      );
    })
  );
}
