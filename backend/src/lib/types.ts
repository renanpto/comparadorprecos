export type CondicaoPagamento = "À Vista / PIX" | "Cartão / Prazo";

export type StatusOrcamento =
  | "PENDENTE_UPLOAD"
  | "PROCESSANDO"
  | "PROCESSADO"
  | "ERRO";

export type StatusDivergencia = "PENDENTE" | "ACEITA" | "IGNORADA";

export type TipoDivergencia = "ESPECIFICACAO_DIFERENTE" | "ITEM_NAO_COTADO" | "ITEM_EXTRA";

export interface Obra {
  obraId: string;
  userId: string;
  nome: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lista {
  listaId: string;
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

export interface ItemListaMestra {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
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
  // quantidade/unidade não fazem parte do contrato exposto ao frontend, mas ficam
  // guardadas aqui para permitir re-rodar a reconciliação (fase 2 do Bedrock) usando
  // os orçamentos já processados, sem precisar reler a imagem original.
  quantidade?: number;
  unidade?: string;
  precoUnitario: number;
  precoTotal: number;
  divergente: boolean;
  motivoDivergencia?: string;
}

export interface OrcamentoFornecedor {
  id: string;
  obraId: string;
  listaId: string;
  nomeLoja: string;
  data: string;
  condicaoPagamento: CondicaoPagamento;
  totalGeral: number;
  status: StatusOrcamento;
  s3Key?: string;
  erroMensagem?: string;
  itens: ItemCotado[];
  createdAt: string;
  updatedAt: string;
}

export interface DivergenciaIA {
  id: string;
  obraId: string;
  listaId: string;
  loja: string;
  itemId: string;
  item: string;
  tipo: TipoDivergencia;
  alerta: string;
  impactoFinanceiro?: string;
  status: StatusDivergencia;
  createdAt: string;
}

export interface ListaCompleta {
  lista: Lista;
  listaMestra: ItemListaMestra[];
  orcamentos: OrcamentoFornecedor[];
  divergencias: DivergenciaIA[];
  fotos: FotoLista[];
}
