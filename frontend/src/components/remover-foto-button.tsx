"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function RemoverFotoButton({
  obraId,
  listaId,
  fotoId,
}: {
  obraId: string;
  listaId: string;
  fotoId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  async function remover() {
    setRemovendo(true);
    try {
      const res = await fetch(`/api/obras/${obraId}/listas/${listaId}/fotos/${fotoId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao remover foto.");
      toast.success(
        data.itensRemovidos > 0
          ? `Foto removida — ${data.itensRemovidos} item(ns) da lista também foram removidos.`
          : "Foto removida"
      );
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Erro ao remover foto", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="size-7 rounded-full bg-background/90 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shadow-sm"
            aria-label="Remover foto"
          />
        }
      >
        <Trash2 className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover esta foto?</DialogTitle>
          <DialogDescription>
            Os itens da lista que vieram dessa foto também serão removidos. Essa ação não pode
            ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={removendo}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={remover} disabled={removendo}>
            {removendo ? "Removendo..." : "Remover foto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
