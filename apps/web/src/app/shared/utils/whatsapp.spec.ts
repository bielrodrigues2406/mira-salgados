import { linkDoWhatsApp, negrito } from './whatsapp';

describe('whatsapp', () => {
  it('abre a conversa com o celular, com DDI do Brasil e sem máscara', () => {
    expect(linkDoWhatsApp('Olá!', '(11) 98765-4321')).toBe(
      'https://wa.me/5511987654321?text=Ol%C3%A1!',
    );
  });

  it('sem telefone, deixa escolher o contato', () => {
    expect(linkDoWhatsApp('a b')).toBe('https://wa.me/?text=a%20b');
  });

  it('marca negrito sem quebrar com asteriscos do próprio texto', () => {
    expect(negrito('Mira *Salgados*')).toBe('*Mira Salgados*');
  });
});
