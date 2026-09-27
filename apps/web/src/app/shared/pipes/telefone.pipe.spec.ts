import { formatarTelefone } from './telefone.pipe';

describe('formatarTelefone', () => {
  it.each([
    ['11991342280', '(11) 99134-2280'],
    ['1130214455', '(11) 3021-4455'],
    ['123', '123'],
    [null, ''],
    ['', ''],
  ])('formata %s', (digitos, esperado) => {
    expect(formatarTelefone(digitos)).toBe(esperado);
  });
});
