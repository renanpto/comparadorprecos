"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, HardHat } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Etapa = "cadastro" | "confirmacao";

export default function CadastroPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("cadastro");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao cadastrar.");
      setEtapa("confirmacao");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao cadastrar.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleConfirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code: codigo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Código inválido.");
      router.push("/login");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Código inválido.");
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

      {etapa === "cadastro" ? (
        <form onSubmit={handleCadastro} className="flex flex-col gap-4">
          <div>
            <h2 className="font-semibold text-foreground">Criar conta</h2>
            <p className="text-sm text-muted-foreground">
              Compare orçamentos de obra sem trabalho manual.
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 8 caracteres, com maiúscula, minúscula e número.
            </p>
          </div>

          <Button type="submit" size="lg" className="h-12 mt-2" disabled={carregando}>
            {carregando ? "Criando conta..." : "Criar conta"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="text-primary font-medium">
              Entrar
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleConfirmar} className="flex flex-col gap-4">
          <div>
            <h2 className="font-semibold text-foreground">Confirme seu e-mail</h2>
            <p className="text-sm text-muted-foreground">
              Enviamos um código de verificação para {email}.
            </p>
          </div>

          {erro && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="codigo">Código de verificação</Label>
            <Input
              id="codigo"
              inputMode="numeric"
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </div>

          <Button type="submit" size="lg" className="h-12 mt-2" disabled={carregando}>
            {carregando ? "Confirmando..." : "Confirmar e entrar"}
          </Button>
        </form>
      )}
    </MobileShell>
  );
}
