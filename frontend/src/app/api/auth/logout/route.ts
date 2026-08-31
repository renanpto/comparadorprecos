import { NextResponse } from "next/server";
import { logout } from "@/lib/cognito";
import { clearSession, getAccessToken } from "@/lib/session";

export async function POST() {
  const accessToken = await getAccessToken();
  if (accessToken) {
    try {
      await logout(accessToken);
    } catch {
      // token já pode estar expirado/inválido — segue para limpar a sessão local mesmo assim
    }
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
