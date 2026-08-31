"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  ImageIcon,
  FileText,
  Sparkles,
  AlertTriangle,
  Check,
  X,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { DivergenciaIA } from "@/lib/types";
import { toast } from "sonner";

type Etapa = "upload" | "enviando" | "processando" | "divergencias" | "concluido" | "erro";

const CONTENT_TYPES_ACEITOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export default function AnalisePage() {
  const { obraId } = useParams<{ obraId: string }>();
  const router = useRouter();

  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [progresso, setProgresso] = useState(0);
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const [erroMensagem, setErroMensagem] = useState<string | null>(null);
  const [divergencias, setDivergencias] = useState<DivergenciaIA[]>([]);
  const [resolvendo, setResolvendo] = useState<Record<string, boolean>>({});

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (etapa !== "processando") return;
    setProgresso(10);

    const progressInterval = setInterval(() => {
      setProgresso((p) => (p < 90 ? p + Math.random() * 8 : p));
    }, 500);

    const pollInterval = setInterval(async () => {
      if (!orcamentoId) return;
      try {
        const res = await fetch(`/api/obras/${obraId}/orcamentos/${orcamentoId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao consultar status.");

        if (data.status === "PROCESSADO") {
          setProgresso(100);
          clearInterval(progressInterval);
          clearInterval(pollInterval);
          const obraRes = await fetch(`/api/obras/${obraId}`, { cache: "no-store" });
          const obraData = await obraRes.json();
          const pendentes: DivergenciaIA[] = (obraData.divergencias ?? []).filter(
            (d: DivergenciaIA) => d.status === "PENDENTE"
          );
          setDivergencias(pendentes);
          setEtapa(pendentes.length > 0 ? "divergencias" : "concluido");
        } else if (data.status === "ERRO") {
          clearInterval(progressInterval);
          clearInterval(pollInterval);
          setErroMensagem(data.erroMensagem ?? "Não foi possível processar o orçamento.");
          setEtapa("erro");
        }
      } catch {
        // erro de rede pontual durante o poll — tenta de novo no próximo tick
      }
    }, 2000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(pollInterval);
    };
  }, [etapa, orcamentoId, obraId]);

  async function handleArquivoSelecionado(file: File) {
    if (!CONTENT_TYPES_ACEITOS.includes(file.type)) {
      toast.error("Formato não suportado", {
        description: "Envie uma foto (JPG/PNG/WEBP) ou um PDF.",
      });
      return;
    }

    setEtapa("enviando");
    try {
      const res = await fetch(`/api/obras/${obraId}/orcamentos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao iniciar upload.");

      const uploadRes = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Falha ao enviar o arquivo.");

      setOrcamentoId(data.orcamentoId);
      setEtapa("processando");
    } catch (err) {
      toast.error("Falha no upload", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
      setEtapa("upload");
    }
  }

  async function resolver(divergenciaId: string, acao: "aceito" | "ignorado") {
    setResolvendo((prev) => ({ ...prev, [divergenciaId]: true }));
    try {
      const res = await fetch(`/api/obras/${obraId}/divergencias/${divergenciaId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao resolver divergência.");

      setDivergencias((prev) => prev.filter((d) => d.id !== divergenciaId));
      toast(acao === "aceito" ? "Divergência aceita" : "Divergência ignorada");
    } catch (err) {
      toast.error("Erro", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setResolvendo((prev) => ({ ...prev, [divergenciaId]: false }));
    }
  }

  function reiniciar() {
    setOrcamentoId(null);
    setErroMensagem(null);
    setDivergencias([]);
    setProgresso(0);
    setEtapa("upload");
  }

  return (
    <MobileShell>
      <header className="flex items-center gap-3 pt-6 pb-4">
        <Link
          href={`/obras/${obraId}`}
          className="size-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors -ml-1.5"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-semibold text-foreground">Adicionar Orçamento</h1>
      </header>

      {(etapa === "upload" || etapa === "enviando") && (
        <div className="flex-1 flex flex-col pb-10">
          <p className="text-sm text-muted-foreground mb-6">
            Tire uma foto do orçamento, envie da galeria ou anexe um PDF. A IA faz o resto.
          </p>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => e.target.files?.[0] && handleArquivoSelecionado(e.target.files[0])}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && handleArquivoSelecionado(e.target.files[0])}
          />
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => e.target.files?.[0] && handleArquivoSelecionado(e.target.files[0])}
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={etapa === "enviando"}
              onClick={() => cameraInputRef.current?.click()}
              className="aspect-square rounded-2xl border-2 border-dashed border-primary/40 bg-accent/50 flex flex-col items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              <Camera className="size-7 text-primary" />
              <span className="text-sm font-medium text-foreground">Câmera</span>
            </button>
            <button
              disabled={etapa === "enviando"}
              onClick={() => galleryInputRef.current?.click()}
              className="aspect-square rounded-2xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              <ImageIcon className="size-7 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Galeria</span>
            </button>
          </div>

          <button
            disabled={etapa === "enviando"}
            onClick={() => pdfInputRef.current?.click()}
            className="mt-3 w-full rounded-2xl border border-border bg-muted/30 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <div className="size-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Anexar PDF</p>
              <p className="text-xs text-muted-foreground">
                Orçamentos digitais ou digitalizados
              </p>
            </div>
          </button>

          {etapa === "enviando" && (
            <p className="text-sm text-center text-muted-foreground mt-6">Enviando arquivo...</p>
          )}
        </div>
      )}

      {etapa === "processando" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 pb-16">
          <div className="relative size-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-accent" />
            <div
              className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"
              style={{ animationDuration: "0.9s" }}
            />
            <Sparkles className="size-9 text-primary" />
          </div>
          <div className="text-center px-6">
            <p className="font-semibold text-foreground">Analisando orçamento com IA</p>
            <p className="text-sm text-muted-foreground mt-1 min-h-5">
              Extraindo itens e comparando com os demais orçamentos...
            </p>
          </div>
          <div className="w-full px-8">
            <Progress value={progresso} />
          </div>
        </div>
      )}

      {etapa === "erro" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 pb-16 px-4">
          <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Não foi possível processar</p>
            <p className="text-sm text-muted-foreground mt-1">{erroMensagem}</p>
          </div>
          <Button onClick={reiniciar} className="mt-2">
            <RotateCcw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      )}

      {etapa === "concluido" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 pb-16 px-4">
          <div className="size-16 rounded-full bg-success/10 flex items-center justify-center">
            <Check className="size-8 text-success" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Orçamento processado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Nenhuma divergência encontrada com os outros orçamentos.
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={reiniciar}>
              Adicionar outro
            </Button>
            <Button onClick={() => router.push(`/obras/${obraId}/comparativo`)}>
              Ver comparativo
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {etapa === "divergencias" && (
        <div className="flex-1 flex flex-col pb-28">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-warning text-warning-foreground">
              {divergencias.length} divergência{divergencias.length !== 1 ? "s" : ""} encontrada
              {divergencias.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Revise as inconsistências identificadas pela IA antes de comparar os orçamentos.
          </p>

          <div className="flex flex-col gap-3">
            {divergencias.map((d) => (
              <Card key={d.id} className="p-4 gap-3 border-l-4 border-l-warning">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-4.5 mt-0.5 shrink-0 text-warning" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{d.item}</span>
                      <span className="text-[11px] text-muted-foreground">· {d.loja}</span>
                    </div>
                    <p className="text-sm text-foreground mt-1 leading-snug">{d.alerta}</p>
                    {d.impactoFinanceiro && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Impacto financeiro:{" "}
                        <span className="font-medium text-foreground">{d.impactoFinanceiro}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pl-7">
                  <Button
                    size="sm"
                    className="h-8 flex-1"
                    disabled={resolvendo[d.id]}
                    onClick={() => resolver(d.id, "aceito")}
                  >
                    <Check className="size-3.5" />
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1"
                    disabled={resolvendo[d.id]}
                    onClick={() => resolver(d.id, "ignorado")}
                  >
                    <X className="size-3.5" />
                    Ignorar
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {divergencias.length === 0 && (
            <Alert className="mt-2">
              <Check className={cn("size-4")} />
              <AlertDescription>Todas as divergências foram resolvidas.</AlertDescription>
            </Alert>
          )}

          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-6 pt-4 bg-gradient-to-t from-background via-background to-transparent">
            <Button
              size="lg"
              disabled={divergencias.length > 0}
              className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg shadow-primary/30"
              onClick={() => router.push(`/obras/${obraId}/comparativo`)}
            >
              Ver comparativo
              <ArrowRight className="size-5" />
            </Button>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
