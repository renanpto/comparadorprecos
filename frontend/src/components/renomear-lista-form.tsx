"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function RenomearListaForm({
  obraId,
  listaId,
  nomeAtual,
}: {
  obraId: string;
  listaId: string;
  nomeAtual: string;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeAtual);
  const [salvando, setSalvando] = useState(false);

  const alterado = nome.trim() !== nomeAtual && nome.trim().length > 0;

  async function salvar() {
    setSalvando(true);
    try {
      const res = await fetch(`/api/obras/${obraId}/listas/${listaId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome: nome.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao renomear lista.");
      toast.success("Lista renomeada");
      router.refresh();
    } catch (err) {
      toast.error("Erro ao renomear", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="nome-lista">Nome da lista</Label>
      <div className="flex gap-2">
        <Input id="nome-lista" value={nome} onChange={(e) => setNome(e.target.value)} />
        {alterado && (
          <Button size="icon" onClick={salvar} disabled={salvando} aria-label="Salvar nome">
            <Save className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
