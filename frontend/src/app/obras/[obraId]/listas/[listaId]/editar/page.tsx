import Link from "next/link";
import { ArrowLeft, ImageOff, ListChecks } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { obterLista } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { RenomearListaForm } from "@/components/renomear-lista-form";
import { RemoverFotoButton } from "@/components/remover-foto-button";
import { ExcluirListaButton } from "@/components/excluir-lista-button";

export default async function EditarListaPage({
  params,
}: {
  params: Promise<{ obraId: string; listaId: string }>;
}) {
  const { obraId, listaId } = await params;
  const { lista, listaMestra, fotos } = await obterLista(obraId, listaId);

  return (
    <MobileShell wide>
      <header className="flex items-center gap-3 pt-6 pb-4">
        <Link
          href={`/obras/${obraId}/listas/${listaId}`}
          className="size-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors -ml-1.5"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-semibold text-foreground">Editar lista</h1>
      </header>

      <div className="flex flex-col gap-4 pb-10">
        <Card className="p-4 gap-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Informações
          </h2>
          <RenomearListaForm obraId={obraId} listaId={listaId} nomeAtual={lista.nome} />
          <div>
            <p className="text-xs text-muted-foreground">Data de cadastro</p>
            <p className="text-sm text-foreground">{formatDateTime(lista.createdAt)}</p>
          </div>
        </Card>

        <Card className="p-4 gap-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Fotos usadas para montar a lista
          </h2>
          {fotos.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <ImageOff className="size-4" />
              Nenhuma foto — os itens foram adicionados manualmente.
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {fotos.map((foto) => (
                <div key={foto.id} className="relative aspect-square">
                  <a
                    href={foto.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block size-full rounded-lg overflow-hidden border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={foto.downloadUrl}
                      alt="Foto da lista"
                      className="size-full object-cover"
                    />
                  </a>
                  <div className="absolute top-1 right-1">
                    <RemoverFotoButton obraId={obraId} listaId={listaId} fotoId={foto.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 gap-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <ListChecks className="size-3.5" />
            Itens ({listaMestra.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {listaMestra.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">{item.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantidade} {item.unidade}
                  {item.especificacao ? ` · ${item.especificacao}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 gap-3 border-destructive/30">
          <h2 className="text-xs font-semibold text-destructive uppercase tracking-wide">
            Zona de risco
          </h2>
          <ExcluirListaButton obraId={obraId} listaId={listaId} />
        </Card>
      </div>
    </MobileShell>
  );
}
