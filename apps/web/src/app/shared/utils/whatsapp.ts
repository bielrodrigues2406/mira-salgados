/**
 * Mensagens prontas para o WhatsApp. Não há integração com a API do WhatsApp:
 * o sistema monta o texto e abre o aplicativo (wa.me) ou o menu de
 * compartilhamento do celular, e a pessoa escolhe para quem enviar.
 */

/** Link wa.me: com telefone abre a conversa com a pessoa; sem, deixa escolher o contato. */
export function linkDoWhatsApp(texto: string, telefone?: string | null): string {
  const destino = telefone ? `55${telefone.replace(/\D/g, '')}` : '';
  return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`;
}

/** Negrito do WhatsApp; asteriscos do próprio texto são removidos para não quebrar a marcação. */
export function negrito(texto: string): string {
  return `*${texto.replaceAll('*', '')}*`;
}
