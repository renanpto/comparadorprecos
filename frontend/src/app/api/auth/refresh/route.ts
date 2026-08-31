import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/cognito";
import { clearSession, getEmail, getRefreshToken, setSession } from "@/lib/session";

export async function POST() {
  const refreshToken = await getRefreshToken();
  const email = await getEmail();
  if (!refreshToken || !email) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  try {
    const tokens = await refreshSession(refreshToken, email);
    await setSession(tokens, email);
    return NextResponse.json({ ok: true });
  } catch {
    await clearSession();
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
}
