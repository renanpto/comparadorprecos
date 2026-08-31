import { NextResponse } from "next/server";
import { obterObra, ApiError } from "@/lib/api-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ obraId: string }> }
) {
  const { obraId } = await params;
  try {
    const obra = await obterObra(obraId);
    return NextResponse.json(obra);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao consultar obra.";
    return NextResponse.json({ error: message }, { status });
  }
}
