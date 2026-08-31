import { NextResponse } from "next/server";
import { criarItensListaMestra, ApiError, type ItemListaMestraInput } from "@/lib/api-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ obraId: string; listaId: string }> }
) {
  const { obraId, listaId } = await params;
  const { itens } = (await request.json()) as { itens?: ItemListaMestraInput[] };
  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: "Campo 'itens' deve ser uma lista não vazia." }, { status: 400 });
  }
  try {
    const resultado = await criarItensListaMestra(obraId, listaId, itens);
    return NextResponse.json(resultado, { status: 201 });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao criar itens.";
    return NextResponse.json({ error: message }, { status });
  }
}
