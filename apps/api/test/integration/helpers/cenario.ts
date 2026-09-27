import type { ClienteHttp } from './http.js';
import { dadosDe } from './http.js';

export interface Ref {
  id: string;
  nome: string;
}

export interface Cenario {
  mira: Ref;
  celia: Ref;
  ana: Ref;
  coxinha: Ref;
  kibe: Ref;
}

async function criar<T>(api: ClienteHttp, caminho: string, corpo: object): Promise<T> {
  return dadosDe<T>(await api.post(caminho, corpo).expect(201));
}

/**
 * Cadastro mínimo para pedidos: dois produtores, um cliente e dois produtos
 * com preços (coxinha frita a R$ 95,00 o cento e R$ 1,20 a unidade; kibe frito
 * a R$ 90,00 o cento).
 */
export async function montarCenario(api: ClienteHttp): Promise<Cenario> {
  const mira = await criar<Ref>(api, '/produtores', { nome: 'Mira' });
  const celia = await criar<Ref>(api, '/produtores', { nome: 'Célia' });
  const ana = await criar<Ref>(api, '/clientes', { nome: 'Ana Paula Ribeiro' });
  const coxinha = await criar<Ref>(api, '/produtos', {
    nome: 'Coxinha de frango',
    produtorPadraoId: mira.id,
  });
  const kibe = await criar<Ref>(api, '/produtos', { nome: 'Kibe', produtorPadraoId: celia.id });

  const precos: [Ref, string, string, number][] = [
    [coxinha, 'FRITO', 'CENTO', 9500],
    [coxinha, 'FRITO', 'UNIDADE', 120],
    [kibe, 'FRITO', 'CENTO', 9000],
  ];
  for (const [produto, preparo, unidadeVenda, precoCentavos] of precos) {
    await api
      .post(`/produtos/${produto.id}/precos`, { preparo, unidadeVenda, precoCentavos })
      .expect(201);
  }
  return { mira, celia, ana, coxinha, kibe };
}
