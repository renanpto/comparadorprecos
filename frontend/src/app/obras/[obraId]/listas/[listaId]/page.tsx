import Link from "next/link";
import {
  Plus,
  ChevronRight,
  ArrowLeft,
  ListChecks,
  Clock,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { obterLista } from "@/lib/api-client";
import { formatBRL, formatDate } from "@/lib/utils";
import type { StatusOrcamento } from "@/lib/types";

const STATUS_LABEL: Record<StatusOrcamento, string> = {
  PENDENTE_UPLOAD: "Aguardando envio",
  PROCESSANDO: "Analisando com IA...",
  PROCESSADO: "Processado",
  ERRO: "Falha no processamento",
};

export default async function ListaPage({
  params,
}: {
  params: Promise<{ obraId: string; listaId: string }>;
}) {
  const { obraId, listaId } = await params;
  const { lista, listaMestra, orcamentos } = await obterLista(obraId, listaId);

  const processados = orcamentos.filter((o) => o.status === "PROCESSADO");

  return (
    <MobileShell noPadding wide>
      <header className="bg-primary text-primary-foreground px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={`/obras/${obraId}`}
              className="size-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors -ml-1.5"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">
              Lista de cotação
            </p>
          </div>
          <Link
            href={`/obras/${obraId}/listas/${listaId}/editar`}
            className="size-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label="Editar lista"
          >
            <Pencil className="size-4" />
          </Link>
        </div>
        <h1 className="text-2xl font-bold mt-1">{lista.nome}</h1>
      </header>

      <main className="flex-1 px-4 pt-6 pb-28">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground flex items-center gap-1.5">
            <ListChecks className="size-4" />
            Itens a cotar ({listaMestra.length})
          </h2>
          <Link
            href={`/obras/${obraId}/listas/${listaId}/itens/nova`}
            className="text-sm text-primary font-medium"
          >
            + Adicionar
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
          {listaMestra.map((item) => (
            <Card key={item.id} className="p-3 gap-0.5">
              <p className="text-sm font-medium text-foreground">{item.nome}</p>
              <p className="text-xs text-muted-foreground">
                {item.quantidade} {item.unidade}
                {item.especificacao ? ` · ${item.especificacao}` : ""}
              </p>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Orçamentos</h2>
          {processados.length > 0 && (
            <Link
              href={`/obras/${obraId}/listas/${listaId}/comparativo`}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {orcamentos.map((orc) => {
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
                <Link key={orc.id} href={`/obras/${obraId}/listas/${listaId}/comparativo`}>
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
          href={
            listaMestra.length > 0
              ? `/obras/${obraId}/listas/${listaId}/analise`
              : `/obras/${obraId}/listas/${listaId}/itens/nova`
          }
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
        >
          <Plus className="size-5" />
          Adicionar Orçamento
        </Link>
      </div>
    </MobileShell>
  );
}
