import { NextResponse } from "next/server";
import { obterLista, ApiError } from "@/lib/api-client";

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
