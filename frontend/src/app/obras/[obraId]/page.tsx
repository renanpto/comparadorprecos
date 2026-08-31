import Link from "next/link";
import { Plus, ChevronRight, Wallet, TrendingDown, Clock, AlertTriangle } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { obterObra } from "@/lib/api-client";
import { formatBRL, formatDate } from "@/lib/utils";
import type { StatusOrcamento } from "@/lib/types";
import { LogoutButton } from "@/components/logout-button";

const STATUS_LABEL: Record<StatusOrcamento, string> = {
  PENDENTE_UPLOAD: "Aguardando envio",
  PROCESSANDO: "Analisando com IA...",
  PROCESSADO: "Processado",
  ERRO: "Falha no processamento",
};

export default async function ObraDashboardPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const { obra, orcamentos } = await obterObra(obraId);

  const processados = orcamentos.filter((o) => o.status === "PROCESSADO");
  const menorPreco =
    processados.length > 0 ? Math.min(...processados.map((o) => o.totalGeral)) : null;

  return (
    <MobileShell noPadding>
      <header className="bg-primary text-primary-foreground px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">Obra ativa</p>
            <h1 className="text-2xl font-bold mt-1">{obra.nome}</h1>
          </div>
          <LogoutButton />
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Wallet className="size-4" />
            <span>{orcamentos.length} orçamentos recebidos</span>
          </div>
        </div>
      </header>

      {menorPreco !== null && (
        <div className="px-4 -mt-5">
          <Card className="p-4 flex items-center gap-3 border-none shadow-md">
            <div className="size-10 rounded-full bg-success/15 flex items-center justify-center shrink-0">
              <TrendingDown className="size-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Melhor cotação até agora</p>
              <p className="font-semibold text-foreground truncate">{formatBRL(menorPreco)}</p>
            </div>
          </Card>
        </div>
      )}

      <main className="flex-1 px-4 pt-6 pb-28">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Orçamentos</h2>
          {processados.length > 0 && (
            <Link
              href={`/obras/${obraId}/comparativo`}
              className="text-sm text-primary font-medium flex items-center gap-0.5"
            >
              Ver comparativo
              <ChevronRight className="size-4" />
            </Link>
          )}
        </div>

        {orcamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum orçamento ainda. Toque em &quot;Adicionar Orçamento&quot; para começar.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {orcamentos.map((orc) => {
              const isMenorPreco = orc.status === "PROCESSADO" && orc.totalGeral === menorPreco;
              const conteudo = (
                <Card className="p-4 gap-2 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        {orc.nomeLoja || "Processando..."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {orc.data ? formatDate(orc.data) : "—"}
                        {orc.condicaoPagamento ? ` · ${orc.condicaoPagamento}` : ""}
                      </p>
                    </div>
                    {isMenorPreco && (
                      <Badge className="bg-success text-success-foreground shrink-0">
                        Menor preço
                      </Badge>
                    )}
                    {orc.status !== "PROCESSADO" && (
                      <Badge
                        variant="outline"
                        className={
                          orc.status === "ERRO"
                            ? "border-destructive text-destructive shrink-0"
                            : "text-muted-foreground shrink-0"
                        }
                      >
                        {orc.status === "PROCESSANDO" && <Clock className="size-3" />}
                        {orc.status === "ERRO" && <AlertTriangle className="size-3" />}
                        {STATUS_LABEL[orc.status]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {orc.status === "PROCESSADO" ? formatBRL(orc.totalGeral) : "—"}
                  </p>
                </Card>
              );
              return orc.status === "PROCESSADO" ? (
                <Link key={orc.id} href={`/obras/${obraId}/comparativo`}>
                  {conteudo}
                </Link>
              ) : (
                <div key={orc.id}>{conteudo}</div>
              );
            })}
          </div>
        )}
      </main>

      <div className="sticky bottom-0 left-0 right-0 px-4 pb-6 pt-4 bg-gradient-to-t from-background via-background to-transparent">
        <Link
          href={`/obras/${obraId}/analise`}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
        >
          <Plus className="size-5" />
          Adicionar Orçamento
        </Link>
      </div>
    </MobileShell>
  );
}
