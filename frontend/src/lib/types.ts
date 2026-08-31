export type CondicaoPagamento = "À Vista / PIX" | "Cartão / Prazo";

export type StatusOrcamento = "PENDENTE_UPLOAD" | "PROCESSANDO" | "PROCESSADO" | "ERRO";

export type StatusDivergencia = "PENDENTE" | "ACEITA" | "IGNORADA";

export interface Obra {
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
  alerta: string;
  impactoFinanceiro?: string;
  status: StatusDivergencia;
}

export interface ObraCompleta {
  obra: Obra;
  listaMestra: ItemListaMestra[];
  orcamentos: OrcamentoFornecedor[];
  divergencias: DivergenciaIA[];
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
  melhorLoja: string;
  precoTotal: number;
  cotacoes: CotacaoPorItem[];
}

export interface Comparativo {
  orcamentos: OrcamentoFornecedor[];
  splitBuy: { itens: ItemSplitBuy[]; totalSplit: number };
  menorFornecedor: {
    nomeLoja: string;
    totalGeral: number;
    condicaoPagamento: CondicaoPagamento;
  } | null;
  economiaTotal: number;
  economiaPercent: number;
}
