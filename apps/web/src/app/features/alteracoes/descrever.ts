import type { AcaoAuditoria, RegistroDeAlteracao, ValorJson } from '../../core/models/auditoria';
import { ROTULO_PAPEL } from '../../core/models/usuario';
import { APARENCIA_DO_PREPARO } from '../../shared/components/chip-preparo/chip-preparo';
import { APARENCIA_DO_STATUS } from '../../shared/components/chip-status/chip-status';
import type { NomeIcone } from '../../shared/components/icone/icones';
import { dataCurta, momentoCurto } from '../../shared/utils/datas';
import { formatarMoeda } from '../../shared/utils/dinheiro';

/** Áreas do sistema, na ordem do filtro. */
export const AREAS: readonly { entidade: string; rotulo: string }[] = [
  { entidade: 'pedido', rotulo: 'Pedidos' },
  { entidade: 'item_pedido', rotulo: 'Itens de pedido' },
  { entidade: 'pagamento', rotulo: 'Pagamentos' },
  { entidade: 'cliente', rotulo: 'Clientes' },
  { entidade: 'produto', rotulo: 'Produtos' },
  { entidade: 'preco_produto', rotulo: 'Preços' },
  { entidade: 'produtor', rotulo: 'Produtores' },
  { entidade: 'usuario', rotulo: 'Contas' },
];

/** Verbo no masculino e no feminino: "Pedido alterado", "Conta alterada". */
const ACAO: Record<AcaoAuditoria, { verbo: [string, string]; icone: NomeIcone }> = {
  CRIACAO: { verbo: ['criado', 'criada'], icone: 'mais' },
  ATUALIZACAO: { verbo: ['alterado', 'alterada'], icone: 'editar' },
  DESATIVACAO: { verbo: ['desativado', 'desativada'], icone: 'pausado' },
  TRANSICAO_STATUS: { verbo: ['mudou de status', 'mudou de status'], icone: 'historico' },
  EXCLUSAO: { verbo: ['removido', 'removida'], icone: 'fechar' },
  ESTORNO: { verbo: ['estornado', 'estornada'], icone: 'estornar' },
  SENHA_REDEFINIDA: {
    verbo: ['teve a senha redefinida', 'teve a senha redefinida'],
    icone: 'chave',
  },
  SENHA_TROCADA: { verbo: ['trocou a senha', 'trocou a senha'], icone: 'chave' },
};

/** Entidades cujo assunto é feminino ("Conta de ..."). */
const FEMININAS = new Set(['usuario']);

const ROTULO_DO_CAMPO: Record<string, string> = {
  nome: 'Nome',
  telefone: 'Telefone',
  endereco: 'Endereço',
  ativo: 'Situação',
  status: 'Status',
  tipoEntrega: 'Entrega',
  dataEntrega: 'Data de entrega',
  horarioEntrega: 'Horário',
  desconto: 'Desconto',
  taxaEntrega: 'Taxa de entrega',
  observacao: 'Observação',
  clienteId: 'Cliente',
  produtoId: 'Produto',
  produtorId: 'Produtor',
  produtorPadraoId: 'Produtor padrão',
  pedidoId: 'Pedido',
  quantidade: 'Quantidade',
  unidadeVenda: 'Vendido por',
  preparo: 'Preparo',
  precoUnitario: 'Preço unitário',
  preco: 'Preço',
  vigenteDesde: 'Vigente desde',
  vigenteAte: 'Vigente até',
  forma: 'Forma',
  valor: 'Valor',
  estornadoEm: 'Estornado em',
  estornadoPorId: 'Estornado por',
  papel: 'Papel',
  trocarSenha: 'Senha provisória',
};

/** Campos técnicos, que não dizem nada a quem lê o histórico. */
const IGNORADOS = new Set([
  'id',
  'numero',
  'criadoEm',
  'atualizadoEm',
  'usuarioId',
  'registradoPorId',
  'entregadorId',
  'email',
]);

const DINHEIRO = new Set(['desconto', 'taxaEntrega', 'precoUnitario', 'preco', 'valor']);
const MOMENTOS = new Set(['vigenteDesde', 'vigenteAte', 'estornadoEm']);
const FORMAS: Record<string, string> = { DINHEIRO: 'Dinheiro', PIX: 'PIX', FIADO: 'Fiado' };
const ENTREGAS: Record<string, string> = { ENTREGA: 'Entrega', RETIRADA: 'Retirada' };
const UNIDADES: Record<string, string> = { CENTO: 'Cento', UNIDADE: 'Unidade' };

export interface Mudanca {
  campo: string;
  antes: string | null;
  depois: string | null;
}

function texto(registro: RegistroDeAlteracao, campo: string): string | undefined {
  const valor = registro.dadosDepois?.[campo] ?? registro.dadosAntes?.[campo];
  return typeof valor === 'string' ? valor : undefined;
}

function nomeCitado(registro: RegistroDeAlteracao, campo: string): string | undefined {
  const id = texto(registro, campo);
  return id ? registro.referencias[id] : undefined;
}

/** "Pedido #36", "Cliente Ana Paula", "Item Coxinha do Pedido #36". */
export function assunto(registro: RegistroDeAlteracao): string {
  const proprio = registro.referencias[registro.entidadeId];
  const nome = proprio ?? texto(registro, 'nome');
  const pedido = nomeCitado(registro, 'pedidoId');
  switch (registro.entidade) {
    case 'pedido': {
      const numero = registro.dadosDepois?.['numero'] ?? registro.dadosAntes?.['numero'];
      return proprio ?? (typeof numero === 'number' ? `Pedido #${String(numero)}` : 'Pedido');
    }
    case 'item_pedido': {
      const produto = nomeCitado(registro, 'produtoId');
      return [`Item${produto ? ` ${produto}` : ''}`, pedido && `do ${pedido}`]
        .filter(Boolean)
        .join(' ');
    }
    case 'pagamento':
      return pedido ? `Pagamento do ${pedido}` : 'Pagamento';
    case 'preco_produto': {
      const produto = nomeCitado(registro, 'produtoId');
      return produto ? `Preço de ${produto}` : 'Preço';
    }
    case 'cliente':
      return nome ? `Cliente ${nome}` : 'Cliente';
    case 'produto':
      return nome ? `Produto ${nome}` : 'Produto';
    case 'produtor':
      return nome ? `Produtor ${nome}` : 'Produtor';
    case 'usuario':
      return nome ? `Conta de ${nome}` : 'Conta';
    default:
      return registro.entidade;
  }
}

export function titulo(registro: RegistroDeAlteracao): string {
  const [masculino, feminino] = ACAO[registro.acao].verbo;
  return `${assunto(registro)} ${FEMININAS.has(registro.entidade) ? feminino : masculino}`;
}

export function iconeDaAcao(acao: AcaoAuditoria): NomeIcone {
  return ACAO[acao].icone;
}

/** Pedido a que o registro pertence, para abrir o detalhe. */
export function pedidoDoRegistro(registro: RegistroDeAlteracao): string | undefined {
  return registro.entidade === 'pedido' ? registro.entidadeId : texto(registro, 'pedidoId');
}

export function formatarValor(
  campo: string,
  valor: ValorJson | undefined,
  referencias: Record<string, string>,
): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'boolean') {
    if (campo === 'ativo') return valor ? 'Ativo' : 'Inativo';
    return valor ? 'Sim' : 'Não';
  }
  if (typeof valor === 'number') return DINHEIRO.has(campo) ? formatarMoeda(valor) : String(valor);
  if (typeof valor !== 'string') return JSON.stringify(valor);
  if (campo.endsWith('Id')) return referencias[valor] ?? 'Registro removido';
  if (MOMENTOS.has(campo)) return momentoCurto(valor);
  switch (campo) {
    case 'status':
      return valor in APARENCIA_DO_STATUS
        ? APARENCIA_DO_STATUS[valor as keyof typeof APARENCIA_DO_STATUS].rotulo
        : valor;
    case 'preparo':
      return valor in APARENCIA_DO_PREPARO
        ? APARENCIA_DO_PREPARO[valor as keyof typeof APARENCIA_DO_PREPARO].rotulo
        : valor;
    case 'papel':
      return valor in ROTULO_PAPEL ? ROTULO_PAPEL[valor as keyof typeof ROTULO_PAPEL] : valor;
    case 'forma':
      return FORMAS[valor] ?? valor;
    case 'tipoEntrega':
      return ENTREGAS[valor] ?? valor;
    case 'unidadeVenda':
      return UNIDADES[valor] ?? valor;
    case 'dataEntrega':
      return dataCurta(valor);
    case 'horarioEntrega':
      return valor.slice(0, 5);
    default:
      return valor;
  }
}

/**
 * O que mudou, campo a campo. Numa alteração, só os campos diferentes; numa
 * criação, os dados com que nasceu; numa remoção, os que tinha.
 */
export function mudancas(registro: RegistroDeAlteracao): Mudanca[] {
  const antes = registro.dadosAntes ?? {};
  const depois = registro.dadosDepois ?? {};
  const campos = [...new Set([...Object.keys(antes), ...Object.keys(depois)])].filter(
    (campo) => !IGNORADOS.has(campo),
  );
  const ordem = Object.keys(ROTULO_DO_CAMPO);
  campos.sort((a, b) => {
    const [ia, ib] = [ordem.indexOf(a), ordem.indexOf(b)];
    return (ia === -1 ? ordem.length : ia) - (ib === -1 ? ordem.length : ib);
  });
  return campos.flatMap((campo): Mudanca[] => {
    const valorAntes = registro.dadosAntes
      ? formatarValor(campo, antes[campo], registro.referencias)
      : null;
    const valorDepois = registro.dadosDepois
      ? formatarValor(campo, depois[campo], registro.referencias)
      : null;
    if (registro.dadosAntes && registro.dadosDepois && valorAntes === valorDepois) return [];
    if (valorAntes === null && valorDepois === null) return [];
    return [{ campo: ROTULO_DO_CAMPO[campo] ?? campo, antes: valorAntes, depois: valorDepois }];
  });
}
