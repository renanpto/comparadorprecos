import Link from "next/link";
import { Plus, ChevronRight, ClipboardList } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { obterObra } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

export default async function ObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const { obra, listas } = await obterObra(obraId);

  return (
    <MobileShell noPadding>
      <header className="bg-primary text-primary-foreground px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">Obra</p>
            <h1 className="text-2xl font-bold mt-1">{obra.nome}</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 px-4 pt-6 pb-28">
        <h2 className="font-semibold text-foreground mb-3">Listas de Cotação</h2>

        {listas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma lista ainda. Toque em &quot;Nova Lista de Cotação&quot; para começar a
            cotar itens com fornecedores.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {listas.map((lista) => (
              <Link key={lista.listaId} href={`/obras/${obraId}/listas/${lista.listaId}`}>
                <Card className="p-4 gap-2 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                        <ClipboardList className="size-4 text-accent-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{lista.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(lista.createdAt)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-2" />
                  </div>
                  <div className="flex items-center gap-2 pl-11.5">
                    <Badge variant="outline">
                      {lista.totalOrcamentos} orçamento{lista.totalOrcamentos !== 1 ? "s" : ""}
                    </Badge>
                    {lista.totalOrcamentosProcessados > 0 && (
                      <Badge className="bg-success text-success-foreground">
                        {lista.totalOrcamentosProcessados} processado
                        {lista.totalOrcamentosProcessados !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <div className="sticky bottom-0 left-0 right-0 px-4 pb-6 pt-4 bg-gradient-to-t from-background via-background to-transparent">
        <Link
          href={`/obras/${obraId}/listas/nova`}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
        >
          <Plus className="size-5" />
          Nova Lista de Cotação
        </Link>
      </div>
    </MobileShell>
  );
}
