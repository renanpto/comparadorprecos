import { NextResponse } from "next/server";
import { obterLista, atualizarLista, removerLista, ApiError } from "@/lib/api-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ obraId: string; listaId: string }> }
) {
  const { obraId, listaId } = await params;
  try {
    const lista = await obterLista(obraId, listaId);
    return NextResponse.json(lista);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao consultar lista.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ obraId: string; listaId: string }> }
) {
  const { obraId, listaId } = await params;
  const { nome } = await request.json();
  if (!nome || typeof nome !== "string") {
    return NextResponse.json({ error: "Campo 'nome' é obrigatório." }, { status: 400 });
  }
  try {
    const lista = await atualizarLista(obraId, listaId, nome);
    return NextResponse.json(lista);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao renomear lista.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ obraId: string; listaId: string }> }
) {
  const { obraId, listaId } = await params;
  try {
    const resultado = await removerLista(obraId, listaId);
    return NextResponse.json(resultado);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao excluir lista.";
    return NextResponse.json({ error: message }, { status });
  }
}
