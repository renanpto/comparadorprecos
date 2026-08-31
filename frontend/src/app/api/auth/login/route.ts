import { NextResponse } from "next/server";
import { login, mensagemErroCognito } from "@/lib/cognito";
import { setSession } from "@/lib/session";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
  }
  try {
    const tokens = await login(email, password);
    await setSession(tokens, email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: mensagemErroCognito(err) }, { status: 401 });
  }
}
