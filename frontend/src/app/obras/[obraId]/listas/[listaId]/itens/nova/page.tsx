"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  ImageIcon,
  ListChecks,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { comprimirImagem } from "@/lib/image";
import { toast } from "sonner";

interface Linha {
  nome: string;
  quantidade: string;
  unidade: string;
  especificacao: string;
  fotoRef?: string;
}

interface ItemSugerido {
  nome: string;
  quantidade: number;
  unidade: string;
  especificacao?: string;
}

interface FotoPendente {
  ref: string;
  base64: string;
  contentType: string;
}

function linhaVazia(): Linha {
  return { nome: "", quantidade: "", unidade: "", especificacao: "" };
}

function linhaEstaVazia(l: Linha) {
  return !l.nome.trim() && !l.quantidade.trim() && !l.unidade.trim() && !l.especificacao.trim();
}

export default function NovosItensPage() {
  const { obraId, listaId } = useParams<{ obraId: string; listaId: string }>();
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia()]);
  const [fotosPendentes, setFotosPendentes] = useState<FotoPendente[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [extraindo, setExtraindo] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  function atualizarLinha(idx: number, campo: keyof Linha, valor: string) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  }

  function adicionarLinha() {
    setLinhas((prev) => [...prev, linhaVazia()]);
  }

  function removerLinha(idx: number) {
    setLinhas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  function aplicarItensExtraidos(itens: ItemSugerido[], fotoRef: string) {
    const novasLinhas: Linha[] = itens.map((i) => ({
      nome: i.nome ?? "",
      quantidade: i.quantidade != null ? String(i.quantidade) : "",
      unidade: i.unidade ?? "",
      especificacao: i.especificacao ?? "",
      fotoRef,
    }));
    setLinhas((prev) => {
      const preservadas = prev.filter((l) => !linhaEstaVazia(l));
      return [...preservadas, ...novasLinhas];
    });
  }

  async function handleFotoSelecionada(file: File) {
    setExtraindo(true);
    try {
      const { base64, contentType } = await comprimirImagem(file);
      const res = await fetch(`/api/obras/${obraId}/listas/${listaId}/itens/extrair-foto`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, contentType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao extrair itens da foto.");

      if (!data.itens || data.itens.length === 0) {
        toast.error("Nenhum item identificado", {
          description: "Tente uma foto mais nítida ou adicione os itens manualmente.",
        });
        return;
      }

      const fotoRef = crypto.randomUUID();
      setFotosPendentes((prev) => [...prev, { ref: fotoRef, base64, contentType }]);
      aplicarItensExtraidos(data.itens, fotoRef);
      toast("Itens extraídos da foto", {
        description: "Confira abaixo — a leitura da caligrafia pode ter erros.",
      });
    } catch (err) {
      toast.error("Falha ao processar a foto", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setExtraindo(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const linhasPreenchidas = linhas.filter((l) => l.nome.trim());
    const itens = linhasPreenchidas.map((l) => ({
      nome: l.nome.trim(),
      quantidade: Number(l.quantidade),
      unidade: l.unidade.trim(),
      especificacao: l.especificacao.trim() || undefined,
      fotoRef: l.fotoRef,
    }));

    if (itens.length === 0) {
      setErro("Adicione pelo menos um item.");
      return;
    }
    if (itens.some((i) => !i.quantidade || i.quantidade <= 0 || !i.unidade)) {
      setErro("Cada item precisa de quantidade (maior que 0) e unidade.");
      return;
    }

    const refsUsadas = new Set(itens.map((i) => i.fotoRef).filter(Boolean));
    const fotos = fotosPendentes.filter((f) => refsUsadas.has(f.ref));

    setCarregando(true);
    try {
      const res = await fetch(`/api/obras/${obraId}/listas/${listaId}/itens`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itens, fotos }),
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
    <MobileShell wide>
      <div className="max-w-md mx-auto w-full">
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

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => e.target.files?.[0] && handleFotoSelecionada(e.target.files[0])}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={(e) => e.target.files?.[0] && handleFotoSelecionada(e.target.files[0])}
        />

        <div className="mb-6">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="size-3.5 text-primary" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Tirar foto da lista
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={extraindo}
              onClick={() => cameraInputRef.current?.click()}
              className="h-20 rounded-2xl border-2 border-dashed border-primary/40 bg-accent/50 flex flex-col items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              {extraindo ? (
                <Loader2 className="size-5 text-primary animate-spin" />
              ) : (
                <Camera className="size-5 text-primary" />
              )}
              <span className="text-xs font-medium text-foreground">Câmera</span>
            </button>
            <button
              type="button"
              disabled={extraindo}
              onClick={() => galleryInputRef.current?.click()}
              className="h-20 rounded-2xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              {extraindo ? (
                <Loader2 className="size-5 text-muted-foreground animate-spin" />
              ) : (
                <ImageIcon className="size-5 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-foreground">Galeria</span>
            </button>
          </div>
          {extraindo && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Lendo a lista com IA...
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-border" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            ou adição manual
          </p>
          <div className="h-px flex-1 bg-border" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pb-8">
        {erro && (
          <Alert variant="destructive" className="max-w-md mx-auto w-full">
            <AlertCircle className="size-4" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
