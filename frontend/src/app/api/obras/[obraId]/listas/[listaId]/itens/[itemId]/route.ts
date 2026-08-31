import { NextResponse } from "next/server";
import { removerItemListaMestra, ApiError } from "@/lib/api-client";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ obraId: string; listaId: string; itemId: string }> }
) {
  const { obraId, listaId, itemId } = await params;
  try {
    const resultado = await removerItemListaMestra(obraId, listaId, itemId);
    return NextResponse.json(resultado);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao remover item.";
    return NextResponse.json({ error: message }, { status });
  }
}
