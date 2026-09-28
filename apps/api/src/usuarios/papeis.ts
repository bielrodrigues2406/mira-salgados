export const PAPEIS = ['ADMIN', 'MEMBRO'] as const;
export type Papel = (typeof PAPEIS)[number];
