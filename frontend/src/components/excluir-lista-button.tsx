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

export function ExcluirListaButton({ obraId, listaId }: { obraId: string; listaId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    setExcluindo(true);
    try {
      const res = await fetch(`/api/obras/${obraId}/listas/${listaId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir lista.");
      toast.success("Lista excluída");
      router.push(`/obras/${obraId}`);
      router.refresh();
    } catch (err) {
      toast.error("Erro ao excluir lista", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
      setExcluindo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" className="w-full" />}>
        <Trash2 className="size-4" />
        Excluir lista inteira
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir esta lista inteira?</DialogTitle>
          <DialogDescription>
            Isso remove permanentemente os itens, orçamentos, divergências e fotos dessa lista de
            cotação. Essa ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={excluir} disabled={excluindo}>
            {excluindo ? "Excluindo..." : "Excluir lista"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
