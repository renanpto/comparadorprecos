import "server-only";
import { cookies } from "next/headers";
import type { Tokens } from "./cognito";

const COOKIE_ACCESS = "ofa_at";
const COOKIE_REFRESH = "ofa_rt";
const COOKIE_EMAIL = "ofa_email";

const baseCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function setSession(tokens: Tokens, email: string) {
  const store = await cookies();
  store.set(COOKIE_ACCESS, tokens.accessToken, {
    ...baseCookie,
    maxAge: tokens.expiresIn,
  });
  store.set(COOKIE_EMAIL, email, { ...baseCookie, maxAge: 60 * 60 * 24 * 30 });
  if (tokens.refreshToken) {
    store.set(COOKIE_REFRESH, tokens.refreshToken, {
      ...baseCookie,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_ACCESS);
  store.delete(COOKIE_REFRESH);
  store.delete(COOKIE_EMAIL);
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(COOKIE_ACCESS)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(COOKIE_REFRESH)?.value;
}

export async function getEmail(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(COOKIE_EMAIL)?.value;
}
