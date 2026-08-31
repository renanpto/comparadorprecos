"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, HardHat } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NovaObraPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/obras", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar obra.");
      router.push(`/obras/${data.obraId}`);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar obra.");
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
        <h1 className="text-xl font-bold text-foreground">Nova obra</h1>
        <p className="text-sm text-muted-foreground text-center">
          Dê um nome para a obra que você vai comparar orçamentos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {erro && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nome">Nome da obra</Label>
          <Input
            id="nome"
            placeholder="Reforma do Telhado"
            required
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        <Button type="submit" size="lg" className="h-12 mt-2" disabled={carregando}>
          {carregando ? "Criando..." : "Criar obra"}
        </Button>
      </form>
    </MobileShell>
  );
}
