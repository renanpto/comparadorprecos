"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ListChecks, Plus, Trash2 } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Linha {
  nome: string;
  quantidade: string;
  unidade: string;
  especificacao: string;
}

function linhaVazia(): Linha {
  return { nome: "", quantidade: "", unidade: "", especificacao: "" };
}

export default function NovosItensPage() {
  const { obraId, listaId } = useParams<{ obraId: string; listaId: string }>();
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia()]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function atualizarLinha(idx: number, campo: keyof Linha, valor: string) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  }

  function adicionarLinha() {
    setLinhas((prev) => [...prev, linhaVazia()]);
  }

  function removerLinha(idx: number) {
    setLinhas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const itens = linhas
      .filter((l) => l.nome.trim())
      .map((l) => ({
        nome: l.nome.trim(),
        quantidade: Number(l.quantidade),
        unidade: l.unidade.trim(),
        especificacao: l.especificacao.trim() || undefined,
      }));

    if (itens.length === 0) {
      setErro("Adicione pelo menos um item.");
      return;
    }
    if (itens.some((i) => !i.quantidade || i.quantidade <= 0 || !i.unidade)) {
      setErro("Cada item precisa de quantidade (maior que 0) e unidade.");
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch(`/api/obras/${obraId}/listas/${listaId}/itens`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itens }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar lista de itens.");
      router.push(`/obras/${obraId}/listas/${listaId}`);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar lista de itens.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <MobileShell>
      <div className="flex flex-col items-center gap-2 pt-6 mb-6">
        <div className="size-12 rounded-2xl bg-primary flex items-center justify-center">
          <ListChecks className="size-6 text-primary-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Itens a cotar</h1>
        <p className="text-sm text-muted-foreground text-center">
          Essa é a lista que os fornecedores devem seguir. A IA vai comparar cada orçamento
          recebido contra ela.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pb-8">
        {erro && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          {linhas.map((linha, idx) => (
            <Card key={idx} className="p-4 gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Item {idx + 1}</p>
                {linhas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removerLinha(idx)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remover item"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`nome-${idx}`}>Nome</Label>
                <Input
                  id={`nome-${idx}`}
                  placeholder="Forro de madeira"
                  value={linha.nome}
                  onChange={(e) => atualizarLinha(idx, "nome", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`quantidade-${idx}`}>Quantidade</Label>
                  <Input
                    id={`quantidade-${idx}`}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="45"
                    value={linha.quantidade}
                    onChange={(e) => atualizarLinha(idx, "quantidade", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`unidade-${idx}`}>Unidade</Label>
                  <Input
                    id={`unidade-${idx}`}
                    placeholder="m², un, kg..."
                    value={linha.unidade}
                    onChange={(e) => atualizarLinha(idx, "unidade", e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`especificacao-${idx}`}>Especificação (opcional)</Label>
                <Input
                  id={`especificacao-${idx}`}
                  placeholder="Pinus, régua 10cm"
                  value={linha.especificacao}
                  onChange={(e) => atualizarLinha(idx, "especificacao", e.target.value)}
                />
              </div>
            </Card>
          ))}
        </div>

        <button
          type="button"
          onClick={adicionarLinha}
          className="w-full h-12 rounded-xl border-2 border-dashed border-border flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
        >
          <Plus className="size-4" />
          Adicionar item
        </button>

        <Button type="submit" size="lg" className="h-12 mt-2" disabled={carregando}>
          {carregando ? "Salvando..." : "Salvar lista"}
        </Button>
      </form>
    </MobileShell>
  );
}
