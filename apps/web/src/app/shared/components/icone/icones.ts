// Ícones de traço no grid 24x24, na linha do Lucide. O forno não existe no
// Lucide e foi desenhado para o sistema. Cada ícone é uma lista de formas SVG
// renderizadas pelo template, sem innerHTML.

export type Forma =
  | { tipo: 'path'; d: string; preenchido?: boolean }
  | { tipo: 'circle'; cx: number; cy: number; r: number }
  | { tipo: 'rect'; x: number; y: number; width: number; height: number; rx: number };

const p = (d: string): Forma => ({ tipo: 'path', d });
const c = (cx: number, cy: number, r: number): Forma => ({ tipo: 'circle', cx, cy, r });
const r = (x: number, y: number, width: number, height: number, rx: number): Forma => ({
  tipo: 'rect',
  x,
  y,
  width,
  height,
  rx,
});

export const ICONES = {
  pedidos: [
    r(8, 2, 8, 4, 1),
    p('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'),
    p('M12 11h4M12 16h4M8 11h.01M8 16h.01'),
  ],
  producao: [
    p(
      'M17 21a1 1 0 0 0 1-1v-5.35c0-.46.32-.84.73-1.04a4 4 0 0 0-2.14-7.59 5 5 0 0 0-9.18 0 4 4 0 0 0-2.14 7.59c.41.2.73.58.73 1.04V20a1 1 0 0 0 1 1z',
    ),
    p('M6 17h12'),
  ],
  clientes: [
    p('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'),
    c(9, 7, 4),
    p('M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'),
  ],
  produtos: [
    p(
      'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z',
    ),
    p('M12 22V12M3.3 7 12 12l8.7-5M7.5 4.27l9 5.15'),
  ],
  relatorios: [p('M3 3v16a2 2 0 0 0 2 2h16'), p('M18 17V9M13 17V5M8 17v-3')],
  produtor: [c(12, 8, 4), p('M20 21a8 8 0 0 0-16 0')],
  sair: [p('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9')],
  email: [r(2, 4, 20, 16, 2), p('m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7')],
  cadeado: [r(3, 11, 18, 11, 2), p('M7 11V7a5 5 0 0 1 10 0v4')],
  olho: [
    p(
      'M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0',
    ),
    c(12, 12, 3),
  ],
  olhoFechado: [
    p('M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68'),
    p('M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20'),
    p('M14.12 14.12a3 3 0 1 1-4.24-4.24'),
  ],
  alerta: [c(12, 12, 9), p('M12 8v4M12 16h.01')],
  chevronAbaixo: [p('m6 9 6 6 6-6')],
  chevronAcima: [p('m18 15-6-6-6 6')],
  construcao: [p('M2 20h20M5 20V8l7-5 7 5v12'), p('M9 20v-6h6v6')],
} satisfies Record<string, readonly Forma[]>;

export type NomeIcone = keyof typeof ICONES;
