import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ItemHistoricoNotificacao, PainelAutomacoes } from '../../core/models/automacoes';
import { Automacoes } from './automacoes';

const PAINEL_BASE: PainelAutomacoes = {
  estado: {
    canal: 'WHATSAPP',
    modo: 'SIMULADO',
    estado: 'SIMULADO',
    pausado: false,
    motivoPausa: null,
    ultimoErro: null,
    ultimaVerificacaoEm: null,
    atualizadoEm: '2026-10-02T10:00:00.000Z',
  },
  destinos: [
    {
      id: 'dest-1',
      nome: 'Equipe Mira',
      canal: 'WHATSAPP',
      identificadorExterno: 'simulado:equipe-mira@g.us',
      ativo: true,
      aprovadoEm: null,
      criadoEm: '2026-10-02T10:00:00.000Z',
      atualizadoEm: '2026-10-02T10:00:00.000Z',
    },
  ],
  regras: [
    {
      id: 'reg-imediato',
      nome: 'Aviso imediato',
      tipo: 'AVISO_IMEDIATO',
      ativa: false,
      destinoId: 'dest-1',
      destinoNome: 'Equipe Mira',
      filtroEncomenda: 'POR_PREPARO',
      preparos: ['ASSADO'],
      modalidades: [],
      escopoItens: 'TODOS',
      enviarCorrecoes: true,
      enviarCancelamentos: true,
      debounceSegundos: 30,
      diasSemana: [],
      horarioResumo: null,
      fusoHorario: 'America/Sao_Paulo',
      omitirDiasVazios: true,
      incluirConcluidos: true,
      enviarComplementos: false,
      toleranciaAtrasoMinutos: 120,
      atualizadoEm: '2026-10-02T10:00:00.000Z',
    },
    {
      id: 'reg-resumo',
      nome: 'Resumo diário',
      tipo: 'RESUMO_DIARIO',
      ativa: false,
      destinoId: 'dest-1',
      destinoNome: 'Equipe Mira',
      filtroEncomenda: 'POR_PREPARO',
      preparos: ['ASSADO'],
      modalidades: [],
      escopoItens: 'APENAS_FILTRADOS',
      enviarCorrecoes: true,
      enviarCancelamentos: true,
      debounceSegundos: 30,
      diasSemana: [1, 2, 3, 4, 5],
      horarioResumo: '07:00',
      fusoHorario: 'America/Sao_Paulo',
      omitirDiasVazios: true,
      incluirConcluidos: true,
      enviarComplementos: true,
      toleranciaAtrasoMinutos: 120,
      atualizadoEm: '2026-10-02T10:00:00.000Z',
    },
  ],
  fila: { pendentes: 0, incertos: 1, falhas: 0 },
};

const HISTORICO_INCERTO: ItemHistoricoNotificacao = {
  id: 'out-1',
  tipoEvento: 'AVISO_IMEDIATO',
  status: 'INCERTO',
  regraId: 'reg-imediato',
  regraNome: 'Aviso imediato',
  destinoId: 'dest-1',
  destinoNome: 'Equipe Mira',
  pedidoId: 'ped-1',
  pedidoNumero: 1043,
  pedidoRevisao: 1,
  dataReferencia: '2026-10-02',
  textoRenderizado: '*Nova encomenda #1043*\nSex, 2 out · 18:30 · Entrega\n• *100 Esfiha (assado)*',
  tentativas: 1,
  maxTentativas: 5,
  ultimoErro: 'Timeout após possível envio.',
  disponivelEm: '2026-10-02T10:00:00.000Z',
  enviadoEm: null,
  entregueEm: null,
  copiadoManualmenteEm: null,
  criadoEm: '2026-10-02T10:00:00.000Z',
};

describe('Automacoes', () => {
  let fixture: ComponentFixture<Automacoes>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function aguardar(filtro: (url: string) => boolean): Promise<TestRequest> {
    return vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne((r) => filtro(r.urlWithParams));
    });
  }

  async function montar(historico: ItemHistoricoNotificacao[] = []): Promise<void> {
    TestBed.configureTestingModule({
      imports: [Automacoes],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Automacoes);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    (await aguardar((url) => url === '/api/v1/automacoes')).flush({ data: PAINEL_BASE });
    (await aguardar((url) => url.startsWith('/api/v1/automacoes/historico'))).flush({
      data: historico,
      meta: { page: 1, pageSize: 10, total: historico.length, totalPages: 1 },
    });
    await fixture.whenStable();
  }

  function botao(texto: string): HTMLButtonElement {
    const encontrado = [...tela.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === texto,
    );
    if (!encontrado) throw new Error(`Botão "${texto}" não encontrado`);
    return encontrado;
  }

  afterEach(() => {
    backend.verify();
  });

  it('mostra canal simulado, regras independentes e gera prévia sem enviar', async () => {
    await montar();

    expect(tela.textContent).toContain('Modo simulado');
    expect(tela.textContent).toContain('Aviso imediato');
    expect(tela.textContent).toContain('Resumo diário');
    expect(tela.textContent).toContain('Omitir dias vazios');

    botao('Ver prévia').click();
    const reqPrevia = await aguardar(
      (url) => url === '/api/v1/automacoes/regras/reg-imediato/previa',
    );
    expect(reqPrevia.request.method).toBe('POST');
    reqPrevia.flush({
      data: {
        regraId: 'reg-imediato',
        tipo: 'AVISO_IMEDIATO',
        dataReferencia: '2026-10-02',
        usouExemplo: true,
        quantidadePedidos: 1,
        texto: '*Nova encomenda #1043*\n• *100 Esfiha de carne (assado)*',
      },
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tela.querySelector('.previa-texto')?.textContent).toContain('*Nova encomenda #1043*');
    });
  });

  it('permite pausar envios e reconciliar registro incerto no histórico', async () => {
    await montar([HISTORICO_INCERTO]);

    expect(tela.textContent).toContain('Pedido #1043');
    expect(tela.textContent).toContain('Incerto');
    expect(tela.textContent).toContain('Marcar entregue');
    expect(tela.textContent).toContain('Reenviar');

    botao('Pausar envios').click();
    const reqPausa = await aguardar((url) => url === '/api/v1/automacoes/conexao/pausar');
    expect(reqPausa.request.method).toBe('POST');
    reqPausa.flush({
      data: { ...PAINEL_BASE.estado, estado: 'PAUSADO', pausado: true },
    });
    (await aguardar((url) => url === '/api/v1/automacoes')).flush({
      data: {
        ...PAINEL_BASE,
        estado: { ...PAINEL_BASE.estado, estado: 'PAUSADO', pausado: true },
      },
    });
    await fixture.whenStable();
    expect(tela.textContent).toContain('Retomar envios');

    botao('Marcar entregue').click();
    const reqReconc = await aguardar(
      (url) => url === '/api/v1/automacoes/historico/out-1/reconciliar',
    );
    expect(reqReconc.request.body).toEqual({ acao: 'MARCAR_ENTREGUE' });
    reqReconc.flush({ data: { ...HISTORICO_INCERTO, status: 'ENTREGUE' } });
    (await aguardar((url) => url === '/api/v1/automacoes')).flush({ data: PAINEL_BASE });
    (await aguardar((url) => url.startsWith('/api/v1/automacoes/historico'))).flush({
      data: [{ ...HISTORICO_INCERTO, status: 'ENTREGUE' }],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    await fixture.whenStable();

    expect(tela.textContent).toContain('Entregue');
  });

  it('separa simulação local do teste real explícito com confirmação de destino', async () => {
    await montar();

    // Simulação local não exige canal ativo nem envia ao conector real.
    botao('Simular envio').click();
    const reqSimular = await aguardar(
      (url) => url === '/api/v1/automacoes/regras/reg-imediato/simular',
    );
    expect(reqSimular.request.method).toBe('POST');
    reqSimular.flush({
      data: {
        ...HISTORICO_INCERTO,
        id: 'out-sim',
        tipoEvento: 'TESTE',
        status: 'ACEITO',
        pedidoId: null,
        pedidoNumero: null,
        pedidoRevisao: null,
      },
    });
    (await aguardar((url) => url === '/api/v1/automacoes')).flush({ data: PAINEL_BASE });
    (await aguardar((url) => url.startsWith('/api/v1/automacoes/historico'))).flush({
      data: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
    await fixture.whenStable();
    expect(tela.textContent).toContain('nenhuma mensagem foi enviada ao grupo');

    // Teste real exige abrir painel dedicado e confirmar destino salvo explícito.
    botao('Enviar teste real').click();
    fixture.detectChanges();
    expect(tela.textContent).toContain('simulado:equipe-mira@g.us');

    botao('Confirmar envio real').click();
    const reqTesteReal = await aguardar(
      (url) => url === '/api/v1/automacoes/regras/reg-imediato/testar-envio',
    );
    expect(reqTesteReal.request.method).toBe('POST');
    expect(reqTesteReal.request.body).toEqual({
      destinoId: 'dest-1',
      identificadorExterno: 'simulado:equipe-mira@g.us',
    });
    reqTesteReal.flush({
      data: {
        ...HISTORICO_INCERTO,
        id: 'out-real',
        tipoEvento: 'TESTE',
        status: 'ACEITO',
        pedidoId: null,
        pedidoNumero: null,
        pedidoRevisao: null,
      },
    });
    (await aguardar((url) => url === '/api/v1/automacoes')).flush({ data: PAINEL_BASE });
    (await aguardar((url) => url.startsWith('/api/v1/automacoes/historico'))).flush({
      data: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
    await fixture.whenStable();
    expect(tela.textContent).toContain('Teste real enviado para Equipe Mira');
  });

  it('pareia WhatsApp por QR ou código de 8 dígitos, verifica conexão, seleciona grupo e atualiza pose da Empadinha', async () => {
    await montar();

    // Com 1 envio incerto na fila, a Empadinha aparece em modo revisar.
    expect(tela.querySelector('ms-empadinha img')?.getAttribute('src')).toBe(
      '/empadinha/revisar.webp',
    );

    // Abre painel de pareamento e solicita QR Code.
    botao('Conectar WhatsApp').click();
    fixture.detectChanges();

    botao('Gerar QR Code').click();
    const reqQr = await aguardar((url) => url === '/api/v1/automacoes/conexao/parear');
    expect(reqQr.request.method).toBe('POST');
    expect(reqQr.request.body).toEqual({ metodo: 'QR' });
    reqQr.flush({
      data: {
        qrCode: 'data:image/png;base64,iVBORw0KGgo=',
        mensagem: 'Escaneie o QR Code no aparelho.',
      },
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tela.querySelector('.qr-imagem')?.getAttribute('src')).toBe(
        'data:image/png;base64,iVBORw0KGgo=',
      );
      expect(tela.querySelector('ms-empadinha img')?.getAttribute('src')).toBe(
        '/empadinha/marcando.webp',
      );
    });

    // Gera código de 8 dígitos informando o número do chip.
    const campoTelefone = tela.querySelector<HTMLInputElement>('#pareamento-telefone');
    if (!campoTelefone) throw new Error('Campo de telefone não encontrado');
    campoTelefone.value = '5511999998888';
    campoTelefone.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    botao('Gerar código de 8 dígitos').click();
    const reqCodigo = await aguardar((url) => url === '/api/v1/automacoes/conexao/parear');
    expect(reqCodigo.request.body).toEqual({ metodo: 'CODIGO', telefone: '5511999998888' });
    reqCodigo.flush({
      data: {
        codigo: 'ABCD-1234',
        mensagem: 'Digite este código no WhatsApp.',
      },
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tela.querySelector('.codigo-pareamento')?.textContent.trim()).toBe('ABCD-1234');
    });

    // Verifica conexão: ao ficar CONECTADO e sem pendências, fecha pareamento e muda pose para tudo-certo.
    botao('Verificar conexão').click();
    const reqVerificar = await aguardar((url) => url === '/api/v1/automacoes/conexao/verificar');
    expect(reqVerificar.request.method).toBe('POST');
    reqVerificar.flush({
      data: { ...PAINEL_BASE.estado, modo: 'GOWA', estado: 'CONECTADO' },
    });
    (await aguardar((url) => url === '/api/v1/automacoes')).flush({
      data: {
        ...PAINEL_BASE,
        estado: { ...PAINEL_BASE.estado, modo: 'GOWA', estado: 'CONECTADO' },
        fila: { pendentes: 0, incertos: 0, falhas: 0 },
      },
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tela.querySelector('.pareamento-bloco')).toBeNull();
      expect(tela.querySelector('ms-empadinha img')?.getAttribute('src')).toBe(
        '/empadinha/tudo-certo.webp',
      );
    });

    // Carrega grupos do WhatsApp e preenche destino ao selecionar um grupo.
    botao('Carregar grupos').click();
    const reqGrupos = await aguardar((url) => url === '/api/v1/automacoes/grupos');
    expect(reqGrupos.request.method).toBe('GET');
    reqGrupos.flush({
      data: [
        { id: '120363999@g.us', nome: 'Forno & Cozinha Mira' },
        { id: '120363111@g.us', nome: 'Entregas' },
      ],
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tela.querySelector('#destino-grupo-lista')).not.toBeNull();
    });

    const seletorGrupo = tela.querySelector<HTMLSelectElement>('#destino-grupo-lista');
    if (!seletorGrupo) throw new Error('Seletor de grupo não encontrado');
    seletorGrupo.value = '120363999@g.us';
    seletorGrupo.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(tela.querySelector<HTMLInputElement>('#destino-nome')?.value).toBe(
      'Forno & Cozinha Mira',
    );
    expect(tela.querySelector<HTMLInputElement>('#destino-identificador')?.value).toBe(
      '120363999@g.us',
    );
  });
});
