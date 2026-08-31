import { NextResponse } from "next/server";
import { resolverDivergencia, ApiError } from "@/lib/api-client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ obraId: string; listaId: string; divergenciaId: string }> }
) {
  const { obraId, listaId, divergenciaId } = await params;
  const { acao } = await request.json();
  if (acao !== "aceito" && acao !== "ignorado") {
    return NextResponse.json(
      { error: "Campo 'acao' deve ser 'aceito' ou 'ignorado'." },
      { status: 400 }
    );
  }
  try {
    const resultado = await resolverDivergencia(obraId, listaId, divergenciaId, acao);
    return NextResponse.json(resultado);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao resolver divergência.";
    return NextResponse.json({ error: message }, { status });
  }
}
