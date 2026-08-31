"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ClipboardList } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NovaListaPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch(`/api/obras/${obraId}/listas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar lista.");
      router.push(`/obras/${obraId}/listas/${data.listaId}/itens/nova`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar lista.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <MobileShell className="justify-center">
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="size-12 rounded-2xl bg-primary flex items-center justify-center">
          <ClipboardList className="size-6 text-primary-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Nova lista de cotação</h1>
        <p className="text-sm text-muted-foreground text-center">
          Dê um nome para identificar essa rodada de cotação (ex: &quot;Fase fundação&quot;,
          &quot;Materiais telhado&quot;).
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
          <Label htmlFor="nome">Nome da lista</Label>
          <Input
            id="nome"
            placeholder="Fase fundação"
            required
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        <Button type="submit" size="lg" className="h-12 mt-2" disabled={carregando}>
          {carregando ? "Criando..." : "Criar lista"}
        </Button>
      </form>
    </MobileShell>
  );
}
