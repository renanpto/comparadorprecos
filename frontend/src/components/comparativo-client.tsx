"use client";

import { useState } from "react";
import { Share2, Download, Store, Split } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatBRL } from "@/lib/utils";
import type { Comparativo } from "@/lib/types";
import { toast } from "sonner";

type Visao = "fornecedor" | "split";

export function ComparativoClient({ comparativo }: { comparativo: Comparativo }) {
  const [visao, setVisao] = useState<Visao>("split");
  const { orcamentos, splitBuy, menorFornecedor, economiaTotal, economiaPercent } = comparativo;

  function compartilhar() {
    toast.success("Comparativo pronto para compartilhar", {
      description: "Link copiado. Envie pelo WhatsApp.",
    });
  }

  function exportar() {
    toast.success("Exportando PDF...", {
      description: "O comparativo será baixado em instantes.",
    });
  }

  if (orcamentos.length === 0) {
    return (
      <main className="flex-1 px-4 sm:px-6 pb-8">
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum orçamento processado ainda para comparar.
        </p>
      </main>
    );
  }

  return (
    <>
      <div className="px-4 sm:px-6">
        {menorFornecedor && (
          <Card className="p-4 gap-1 border-none bg-success/10 mb-4">
            <p className="text-xs font-medium text-success uppercase tracking-wide">
              Economia total
            </p>
            <p className="text-2xl font-bold text-foreground">
              {formatBRL(economiaTotal)}
              <span className="text-sm font-medium text-muted-foreground ml-1.5">
                ({economiaPercent.toFixed(1)}%)
              </span>
            </p>
            <p className="text-sm text-foreground mt-1">
              Você economiza {formatBRL(economiaTotal)} comprando na{" "}
              <span className="font-semibold">{menorFornecedor.nomeLoja}</span> (
              {menorFornecedor.condicaoPagamento})
            </p>
          </Card>
        )}

        <Tabs value={visao} onValueChange={(v) => setVisao(v as Visao)} className="mb-4">
          <TabsList className="w-full">
            <TabsTrigger value="fornecedor" className="gap-1.5">
              <Store className="size-3.5" />
              Por Fornecedor
            </TabsTrigger>
            <TabsTrigger value="split" className="gap-1.5">
              <Split className="size-3.5" />
              Menor Preço (Split-Buy)
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <main className="flex-1 px-4 sm:px-6 pb-8">
        {visao === "fornecedor" ? (
          <VisaoFornecedor orcamentos={orcamentos} />
        ) : (
          <VisaoSplit splitBuy={splitBuy} />
        )}
      </main>

      <div className="sticky bottom-0 left-0 right-0 px-4 sm:px-6 pb-6 pt-4 bg-gradient-to-t from-background via-background to-transparent flex gap-3">
        <button
          onClick={exportar}
          className="flex-1 h-12 rounded-xl border border-border font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Download className="size-4" />
          Exportar PDF
        </button>
        <button
          onClick={compartilhar}
          className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md shadow-primary/25"
        >
          <Share2 className="size-4" />
          Compartilhar
        </button>
      </div>
    </>
  );
}

function VisaoFornecedor({ orcamentos }: { orcamentos: Comparativo["orcamentos"] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/60 text-muted-foreground text-left">
              <th className="px-4 py-3 font-medium">Fornecedor</th>
              <th className="px-4 py-3 font-medium">Condição</th>
              <th className="px-4 py-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {orcamentos.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-foreground">{o.nomeLoja}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.condicaoPagamento}</td>
                <td className="px-4 py-3 font-semibold text-foreground">
                  {formatBRL(o.totalGeral)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4">
        {orcamentos.map((orc) => (
          <Card key={orc.id} className="p-4 gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{orc.nomeLoja}</p>
                <p className="text-xs text-muted-foreground">{orc.condicaoPagamento}</p>
              </div>
              <p className="font-bold text-foreground">{formatBRL(orc.totalGeral)}</p>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {orc.itens.map((it, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{it.descricaoNoOrcamento}</p>
                    {it.divergente && (
                      <Badge
                        variant="outline"
                        className="mt-1 border-warning text-warning text-[10px] px-1.5 py-0"
                      >
                        Divergente
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground shrink-0">
                    {formatBRL(it.precoTotal)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function VisaoSplit({ splitBuy }: { splitBuy: Comparativo["splitBuy"] }) {
  return (
    <div className="flex flex-col gap-3">
      {splitBuy.itens.map((item) => (
        <Card key={item.itemId} className="p-4 gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{item.nome}</p>
              <p className="text-xs text-muted-foreground">
                {item.quantidade} {item.unidade}
                {item.especificacao ? ` · ${item.especificacao}` : ""}
              </p>
            </div>
            {item.melhorLoja && (
              <Badge className="bg-success text-success-foreground shrink-0">
                {item.melhorLoja}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-1">
            {item.cotacoes.map((c) => (
              <div
                key={c.orcamentoId}
                className={cn(
                  "flex-1 min-w-[45%] rounded-lg border px-3 py-2 text-sm",
                  c.loja === item.melhorLoja ? "border-success bg-success/10" : "border-border"
                )}
              >
                <p className="text-xs text-muted-foreground truncate">{c.loja}</p>
                <p
                  className={cn(
                    "font-semibold",
                    c.loja === item.melhorLoja ? "text-success" : "text-foreground"
                  )}
                >
                  {formatBRL(c.precoTotal)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card className="p-4 gap-1 bg-primary/10 border-none mt-1">
        <p className="text-xs text-muted-foreground">
          Total combinando o menor preço por item
        </p>
        <p className="text-xl font-bold text-foreground">{formatBRL(splitBuy.totalSplit)}</p>
      </Card>
    </div>
  );
}
