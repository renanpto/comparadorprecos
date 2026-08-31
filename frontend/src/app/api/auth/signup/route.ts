import { NextResponse } from "next/server";
import { signUp, mensagemErroCognito } from "@/lib/cognito";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
  }
  try {
    await signUp(email, password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/signup]", err);
    return NextResponse.json({ error: mensagemErroCognito(err) }, { status: 400 });
  }
}
