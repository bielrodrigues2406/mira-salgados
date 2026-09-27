import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { hoje } from '../../../shared/utils/datas';
import { ProducaoDeHoje } from './producao-de-hoje';

describe('ProducaoDeHoje', () => {
  let fixture: ComponentFixture<ProducaoDeHoje>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  async function montar(resposta: { status?: number; porProdutor?: unknown[] }): Promise<void> {
    TestBed.configureTestingModule({
      imports: [ProducaoDeHoje],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProducaoDeHoje);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    const requisicao = await vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne(
        (r) => r.url === '/api/v1/relatorios/producao-do-dia' && r.params.get('data') === hoje(),
      );
    });
    if (resposta.status) {
      requisicao.flush(null, { status: resposta.status, statusText: 'Erro' });
    } else {
      requisicao.flush({ data: { porProdutor: resposta.porProdutor ?? [] } });
    }
    await fixture.whenStable();
  }

  afterEach(() => {
    backend.verify();
  });

  it('mostra a carga de cada produtor e leva ao consolidado', async () => {
    await montar({
      porProdutor: [
        { produtor: { id: 'mira', nome: 'Mira' }, unidades: 1200 },
        { produtor: { id: 'celia', nome: 'Célia' }, unidades: 1 },
      ],
    });

    const textos = [...tela.querySelectorAll('.produtor')].map((p) =>
      [...p.children].map((filho) => filho.textContent.trim()),
    );
    expect(textos).toEqual([
      ['Mira', '1.200', 'salgados'],
      ['Célia', '1', 'salgado'],
    ]);
    expect(tela.querySelector('a')?.getAttribute('href')).toBe('/producao?modo=consolidado');
  });

  it('some quando não há produção hoje', async () => {
    await montar({ porProdutor: [] });

    expect(tela.querySelector('a')).toBeNull();
  });

  it('some quando a consulta falha, sem atrapalhar a lista', async () => {
    await montar({ status: 500 });

    expect(tela.querySelector('a')).toBeNull();
  });
});
