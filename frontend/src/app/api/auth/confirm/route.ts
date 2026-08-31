import { NextResponse } from "next/server";
import { confirmSignUp, mensagemErroCognito } from "@/lib/cognito";

export async function POST(request: Request) {
  const { email, code } = await request.json();
  if (!email || !code) {
    return NextResponse.json({ error: "E-mail e código são obrigatórios." }, { status: 400 });
  }
  try {
    await confirmSignUp(email, code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: mensagemErroCognito(err) }, { status: 400 });
  }
}
