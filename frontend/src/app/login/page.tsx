"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, HardHat } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível entrar.");
      router.push(searchParams.get("next") ?? "/");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <MobileShell className="justify-center">
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="size-12 rounded-2xl bg-primary flex items-center justify-center">
          <HardHat className="size-6 text-primary-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground">OrçaFácil AI</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold text-foreground">Entrar</h2>
          <p className="text-sm text-muted-foreground">
            Acesse suas obras e orçamentos.
          </p>
        </div>

        {erro && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button type="submit" size="lg" className="h-12 mt-2" disabled={carregando}>
          {carregando ? "Entrando..." : "Entrar"}
        </Button>

        <p className="text-sm text-center text-muted-foreground">
          Não tem conta?{" "}
          <Link href="/cadastro" className="text-primary font-medium">
            Criar conta
          </Link>
        </p>
      </form>
    </MobileShell>
  );
}
