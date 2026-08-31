import { NextResponse } from "next/server";
import { removerFotoLista, ApiError } from "@/lib/api-client";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ obraId: string; listaId: string; fotoId: string }> }
) {
  const { obraId, listaId, fotoId } = await params;
  try {
    const resultado = await removerFotoLista(obraId, listaId, fotoId);
    return NextResponse.json(resultado);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao remover foto.";
    return NextResponse.json({ error: message }, { status });
  }
}
