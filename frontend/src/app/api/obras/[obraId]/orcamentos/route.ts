import { NextResponse } from "next/server";
import { gerarUrlUpload, ApiError } from "@/lib/api-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ obraId: string }> }
) {
  const { obraId } = await params;
  const { contentType } = await request.json();
  if (!contentType || typeof contentType !== "string") {
    return NextResponse.json({ error: "Campo 'contentType' é obrigatório." }, { status: 400 });
  }
  try {
    const resultado = await gerarUrlUpload(obraId, contentType);
    return NextResponse.json(resultado, { status: 201 });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao iniciar upload.";
    return NextResponse.json({ error: message }, { status });
  }
}
