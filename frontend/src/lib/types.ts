export type CondicaoPagamento = "À Vista / PIX" | "Cartão / Prazo";

export type StatusOrcamento = "PENDENTE_UPLOAD" | "PROCESSANDO" | "PROCESSADO" | "ERRO";

export type StatusDivergencia = "PENDENTE" | "ACEITA" | "IGNORADA";

export type TipoDivergencia = "ESPECIFICACAO_DIFERENTE" | "ITEM_NAO_COTADO" | "ITEM_EXTRA";

export interface Obra {
  obraId: string;
  nome: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumoLista {
  listaId: string;
  nome: string;
  createdAt: string;
  totalOrcamentos: number;
  totalOrcamentosProcessados: number;
}

export interface ObraComListas {
  obra: Obra;
  listas: ResumoLista[];
}

export interface Lista {
  listaId: string;
  obraId: string;
  nome: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemListaMestra {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string; // 'm', 'm²', 'un', 'kg'
  especificacao?: string;
  fotoId?: string;
}

export interface FotoLista {
  id: string;
  downloadUrl: string;
  createdAt: string;
}

export interface ItemCotado {
  itemId: string;
  nomeLoja: string;
  descricaoNoOrcamento: string;
  precoUnitario: number;
  precoTotal: number;
  divergente: boolean;
  motivoDivergencia?: string;
}

export interface OrcamentoFornecedor {
  id: string;
  nomeLoja: string;
  data: string;
  condicaoPagamento: CondicaoPagamento;
  totalGeral: number;
  status: StatusOrcamento;
  erroMensagem?: string;
  itens: ItemCotado[];
}

export interface DivergenciaIA {
  id: string;
  loja: string;
  item: string;
  tipo: TipoDivergencia;
  alerta: string;
  impactoFinanceiro?: string;
  status: StatusDivergencia;
}

export interface ListaCompleta {
  lista: Lista;
  listaMestra: ItemListaMestra[];
  orcamentos: OrcamentoFornecedor[];
  divergencias: DivergenciaIA[];
  fotos: FotoLista[];
}

export interface CotacaoPorItem {
  loja: string;
  orcamentoId: string;
  precoTotal: number;
  divergente: boolean;
}

export interface ItemSplitBuy {
  itemId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  especificacao?: string;
  melhorLoja: string | null;
  precoTotal: number | null;
  cotacoes: CotacaoPorItem[];
}

export interface Comparativo {
  orcamentos: OrcamentoFornecedor[];
  splitBuy: { itens: ItemSplitBuy[]; totalSplit: number; itensSemCotacao: number };
  menorFornecedor: {
    nomeLoja: string;
    totalGeral: number;
    condicaoPagamento: CondicaoPagamento;
  } | null;
  economiaTotal: number;
  economiaPercent: number;
}
