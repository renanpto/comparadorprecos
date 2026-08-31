import { NextResponse } from "next/server";
import { criarObra, ApiError } from "@/lib/api-client";

export async function POST(request: Request) {
  const { nome } = await request.json();
  if (!nome || typeof nome !== "string") {
    return NextResponse.json({ error: "Campo 'nome' é obrigatório." }, { status: 400 });
  }
  try {
    const obra = await criarObra(nome);
    return NextResponse.json(obra, { status: 201 });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao criar obra.";
    return NextResponse.json({ error: message }, { status });
  }
}
