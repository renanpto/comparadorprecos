import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { obterComparativo, obterLista } from "@/lib/api-client";
import { ComparativoClient } from "@/components/comparativo-client";

export default async function ComparativoPage({
  params,
}: {
  params: Promise<{ obraId: string; listaId: string }>;
}) {
  const { obraId, listaId } = await params;
  const [comparativo, { lista }] = await Promise.all([
    obterComparativo(obraId, listaId),
    obterLista(obraId, listaId),
  ]);

  return (
    <div className="min-h-dvh w-full bg-muted/40 flex justify-center">
      <div className="w-full max-w-4xl min-h-dvh bg-background flex flex-col">
        <header className="flex items-center gap-3 px-4 pt-6 pb-4 sm:px-6">
          <Link
            href={`/obras/${obraId}/listas/${listaId}`}
            className="size-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors -ml-1.5 shrink-0"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{lista.nome}</p>
            <h1 className="font-semibold text-foreground">Matriz Comparativa</h1>
          </div>
        </header>

        <ComparativoClient comparativo={comparativo} />
      </div>
    </div>
  );
}
