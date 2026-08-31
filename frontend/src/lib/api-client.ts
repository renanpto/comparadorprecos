import "server-only";
import { refreshSession } from "./cognito";
import { getAccessToken, getEmail, getRefreshToken, setSession } from "./session";
import type {
  Comparativo,
  DivergenciaIA,
  ItemListaMestra,
  Lista,
  ListaCompleta,
  Obra,
  ObraComListas,
  OrcamentoFornecedor,
} from "./types";

const BACKEND_API_URL = process.env.BACKEND_API_URL as string;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function renovarSessao(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  const email = await getEmail();
  if (!refreshToken || !email) return null;
  const tokens = await refreshSession(refreshToken, email);
  await setSession(tokens, email);
  return tokens.accessToken;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token = await getAccessToken();
  if (!token) {
    token = (await renovarSessao()) ?? undefined;
    if (!token) throw new ApiError(401, "Não autenticado.");
  }

  const doFetch = (accessToken: string) =>
    fetch(`${BACKEND_API_URL}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      cache: "no-store",
    });

  let res = await doFetch(token);

  if (res.status === 401) {
    const novoToken = await renovarSessao();
    if (novoToken) res = await doFetch(novoToken);
  }

  return res;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `Erro na API (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

export function criarObra(nome: string): Promise<Obra> {
  return apiJson("/obras", { method: "POST", body: JSON.stringify({ nome }) });
}

export function listarObras(): Promise<{ obras: Obra[] }> {
  return apiJson("/obras");
}

export function obterObra(obraId: string): Promise<ObraComListas> {
  return apiJson(`/obras/${obraId}`);
}

export function criarLista(obraId: string, nome: string): Promise<Lista> {
  return apiJson(`/obras/${obraId}/listas`, {
    method: "POST",
    body: JSON.stringify({ nome }),
  });
}

export function obterLista(obraId: string, listaId: string): Promise<ListaCompleta> {
  return apiJson(`/obras/${obraId}/listas/${listaId}`);
}

export interface ItemListaMestraInput {
  nome: string;
  quantidade: number;
  unidade: string;
  especificacao?: string;
}

export function criarItensListaMestra(
  obraId: string,
  listaId: string,
  itens: ItemListaMestraInput[]
): Promise<{ itens: ItemListaMestra[] }> {
  return apiJson(`/obras/${obraId}/listas/${listaId}/itens`, {
    method: "POST",
    body: JSON.stringify({ itens }),
  });
}

export function removerItemListaMestra(
  obraId: string,
  listaId: string,
  itemId: string
): Promise<{ id: string }> {
  return apiJson(`/obras/${obraId}/listas/${listaId}/itens/${itemId}`, {
    method: "DELETE",
  });
}

export function gerarUrlUpload(
  obraId: string,
  listaId: string,
  contentType: string
): Promise<{ orcamentoId: string; uploadUrl: string; s3Key: string }> {
  return apiJson(`/obras/${obraId}/listas/${listaId}/orcamentos`, {
    method: "POST",
    body: JSON.stringify({ contentType }),
  });
}

export function obterOrcamento(
  obraId: string,
  listaId: string,
  orcamentoId: string
): Promise<OrcamentoFornecedor> {
  return apiJson(`/obras/${obraId}/listas/${listaId}/orcamentos/${orcamentoId}`);
}

export function resolverDivergencia(
  obraId: string,
  listaId: string,
  divergenciaId: string,
  acao: "aceito" | "ignorado"
): Promise<{ id: string; status: DivergenciaIA["status"] }> {
  return apiJson(`/obras/${obraId}/listas/${listaId}/divergencias/${divergenciaId}`, {
    method: "PATCH",
    body: JSON.stringify({ acao }),
  });
}

export function obterComparativo(obraId: string, listaId: string): Promise<Comparativo> {
  return apiJson(`/obras/${obraId}/listas/${listaId}/comparativo`);
}
