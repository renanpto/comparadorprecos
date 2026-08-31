import { NextResponse } from "next/server";
import { obterOrcamento, ApiError } from "@/lib/api-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ obraId: string; orcamentoId: string }> }
) {
  const { obraId, orcamentoId } = await params;
  try {
    const orcamento = await obterOrcamento(obraId, orcamentoId);
    return NextResponse.json(orcamento);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao consultar orçamento.";
    return NextResponse.json({ error: message }, { status });
  }
}
