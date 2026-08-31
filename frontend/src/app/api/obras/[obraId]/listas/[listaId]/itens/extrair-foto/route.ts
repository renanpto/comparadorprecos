import { NextResponse } from "next/server";
import { extrairItensDeFoto, ApiError } from "@/lib/api-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ obraId: string; listaId: string }> }
) {
  const { obraId, listaId } = await params;
  const { imageBase64, contentType } = await request.json();
  if (!imageBase64 || !contentType) {
    return NextResponse.json(
      { error: "Campos 'imageBase64' e 'contentType' são obrigatórios." },
      { status: 400 }
    );
  }
  try {
    const resultado = await extrairItensDeFoto(obraId, listaId, imageBase64, contentType);
    return NextResponse.json(resultado);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao extrair itens da foto.";
    return NextResponse.json({ error: message }, { status });
  }
}
