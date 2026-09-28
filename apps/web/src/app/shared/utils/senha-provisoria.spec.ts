import { gerarSenhaProvisoria } from './senha-provisoria';

describe('gerarSenhaProvisoria', () => {
  it('gera três grupos de quatro caracteres sem símbolos ambíguos', () => {
    for (let vez = 0; vez < 50; vez++) {
      expect(gerarSenhaProvisoria()).toMatch(
        /^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/,
      );
    }
  });

  it('usa o gerador recebido', () => {
    const zeros = (tamanho: number) => new Uint32Array(tamanho);
    expect(gerarSenhaProvisoria(zeros)).toBe('aaaa-aaaa-aaaa');
  });
});
