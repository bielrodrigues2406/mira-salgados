import type { PedidoDetalhe } from '../../core/models/pedido';
import type { ProducaoDoDia, ProducaoPorDia } from '../../core/models/producao';
import type { Preparo, UnidadeVenda } from '../../core/models/produto';
import type { AcertoDiario, ClienteComFiado } from '../../core/models/relatorios';
import { dataCurta, dataPorExtenso } from './datas';
import { formatarMoeda } from './dinheiro';
import { contagem, numero } from './textos';
import { negrito } from './whatsapp';

// Textos prontos para colar ou abrir no WhatsApp. Curtos, em linhas, com
// negrito só nos números que importam: são lidos no celular, de relance.

const PREPARO: Record<Preparo, string> = {
  FRITO: '',
  ASSADO: ' (assado)',
  CONGELADO: ' (congelado)',
};

function salgado(nome: string, preparo: Preparo, unidades: number): string {
  return `• ${numero(unidades)} ${nome}${PREPARO[preparo]}`;
}

/** O que cada produtor faz no dia, por salgado. */
export function mensagemDaProducaoDoDia(data: string, producao: ProducaoDoDia): string {
  const porProdutor = new Map<string, { nome: string; unidades: number; linhas: string[] }>();
  for (const grupo of producao.consolidado) {
    for (const linha of grupo.linhas) {
      const atual = porProdutor.get(linha.produtor.id) ?? {
        nome: linha.produtor.nome,
        unidades: 0,
        linhas: [],
      };
      atual.unidades += linha.unidades;
      atual.linhas.push(salgado(linha.produto.nome, grupo.preparo, linha.unidades));
      porProdutor.set(linha.produtor.id, atual);
    }
  }
  const blocos = [...porProdutor.values()]
    .sort((a, b) => b.unidades - a.unidades)
    .map((carga) =>
      [`${negrito(carga.nome)}: ${numero(carga.unidades)}`, ...carga.linhas].join('\n'),
    );
  return [
    negrito(`Produção de ${dataPorExtenso(data).toLowerCase()}`),
    `${contagem(producao.unidades, 'salgado', 'salgados')} em ${contagem(producao.quantidadePedidos, 'encomenda', 'encomendas')}`,
    '',
    blocos.join('\n\n'),
  ].join('\n');
}

/** A semana, dia a dia; com um produtor escolhido, só a parte dele. */
export function mensagemDaSemana(
  producao: ProducaoPorDia,
  produtorId: string | null = null,
): string {
  const dias = producao.dias.flatMap((dia) => {
    const cargas = dia.produtores.filter(
      (carga) => !produtorId || carga.produtor.id === produtorId,
    );
    const unidades = cargas.reduce((soma, carga) => soma + carga.unidades, 0);
    if (unidades === 0) return [];
    const linhas = cargas.flatMap((carga) => [
      ...(produtorId ? [] : [`${carga.produtor.nome}: ${numero(carga.unidades)}`]),
      ...carga.salgados.map((item) => salgado(item.produto.nome, item.preparo, item.unidades)),
    ]);
    return [[`${negrito(dataCurta(dia.data))}: ${numero(unidades)}`, ...linhas].join('\n')];
  });
  const nome = produtorId
    ? producao.dias
        .flatMap((dia) => dia.produtores)
        .find((carga) => carga.produtor.id === produtorId)?.produtor.nome
    : undefined;
  const titulo = negrito(
    `Produção${nome ? ` de ${nome}` : ''}: ${dataCurta(producao.de)} a ${dataCurta(producao.ate)}`,
  );
  return [titulo, '', dias.length > 0 ? dias.join('\n\n') : 'Nada marcado.'].join('\n');
}

/** Caixa do dia e quanto cabe a cada produtor. */
export function mensagemDoAcerto(acerto: AcertoDiario): string {
  const linhas = [
    negrito(`Acerto de ${dataPorExtenso(acerto.data).toLowerCase()}`),
    `${contagem(acerto.quantidadePedidos, 'encomenda', 'encomendas')} · ${formatarMoeda(acerto.valorMovimentadoCentavos)}`,
    '',
    `Caixa: ${negrito(formatarMoeda(acerto.caixa.totalCentavos))}`,
    `PIX ${formatarMoeda(acerto.caixa.pixCentavos)} · Dinheiro ${formatarMoeda(acerto.caixa.dinheiroCentavos)}`,
  ];
  if (acerto.fiado.valorCentavos > 0)
    linhas.push(`Fiado: ${formatarMoeda(acerto.fiado.valorCentavos)}`);
  if (acerto.semPagamento.valorCentavos > 0) {
    linhas.push(`Sem pagamento: ${formatarMoeda(acerto.semPagamento.valorCentavos)}`);
  }
  linhas.push('', negrito('Para cada produtor'));
  for (const parte of acerto.produtores) {
    const pendente =
      parte.pendenteCentavos > 0 ? ` (falta ${formatarMoeda(parte.pendenteCentavos)})` : '';
    linhas.push(`${parte.produtor.nome}: ${formatarMoeda(parte.aReceberCentavos)}${pendente}`);
  }
  return linhas.join('\n');
}

/** Lembrete gentil de fiado, para mandar ao cliente. Nome inteiro: o cliente pode ser uma empresa. */
export function mensagemDeCobranca(fiado: ClienteComFiado): string {
  const pedidos = fiado.pedidos.map(
    (pedido) =>
      `• ${dataCurta(pedido.dataEntrega)} (pedido #${String(pedido.numero)}): ${formatarMoeda(pedido.emAbertoCentavos)}`,
  );
  return [
    `Olá, ${fiado.cliente.nome.trim()}! Tudo bem?`,
    `Passando para lembrar do valor em aberto das suas encomendas na Mira Salgados:`,
    '',
    ...pedidos,
    '',
    `Total: ${negrito(formatarMoeda(fiado.emAbertoCentavos))}`,
    '',
    'Pode ser por PIX ou dinheiro. Agradecemos a preferência!',
  ].join('\n');
}

const UNIDADE: Record<UnidadeVenda, [string, string]> = {
  CENTO: ['cento', 'centos'],
  UNIDADE: ['unidade', 'unidades'],
};

/** Confirmação para o cliente: itens, quando e quanto. */
export function mensagemDeConfirmacao(pedido: PedidoDetalhe): string {
  const quando = pedido.horarioEntrega
    ? `${dataCurta(pedido.dataEntrega)} às ${pedido.horarioEntrega}`
    : dataCurta(pedido.dataEntrega);
  const itens = pedido.itens.map((item) => {
    const [singular, plural] = UNIDADE[item.unidadeVenda];
    return `• ${contagem(item.quantidade, singular, plural)} de ${item.produto.nome}${PREPARO[item.preparo]}`;
  });
  const { resumo } = pedido;
  const linhas = [
    `Olá, ${pedido.cliente.nome.trim()}! Seu pedido ${negrito(`#${String(pedido.numero)}`)} na Mira Salgados está anotado:`,
    '',
    ...itens,
    '',
    `${pedido.tipoEntrega === 'ENTREGA' ? 'Entrega' : 'Retirada'}: ${negrito(quando)}`,
  ];
  if (pedido.tipoEntrega === 'ENTREGA' && pedido.cliente.endereco) {
    linhas.push(`Endereço: ${pedido.cliente.endereco}`);
  }
  linhas.push(`Total: ${negrito(formatarMoeda(resumo.totalCentavos))}`);
  if (resumo.totalPagoCentavos > 0 && resumo.saldoDevedorCentavos > 0) {
    linhas.push(
      `Já pago: ${formatarMoeda(resumo.totalPagoCentavos)} · Falta: ${formatarMoeda(resumo.saldoDevedorCentavos)}`,
    );
  } else if (resumo.saldoDevedorCentavos === 0 && resumo.totalCentavos > 0) {
    linhas.push('Pagamento recebido. Agradecemos a preferência!');
  }
  linhas.push('', 'Qualquer mudança, é só avisar por aqui.');
  return linhas.join('\n');
}
