/**
 * Cinemática e geometria articulada da mascote Empadinha, fiel à prévia
 * aprovada em `design/empadinha/preview.html`.
 *
 * Cada gesto é curto, finito (toca uma única vez, sem loop contínuo) e possui
 * uma pose estática equivalente para `prefers-reduced-motion: reduce`.
 */

export type PoseEmpadinha =
  'pronta' | 'conferir' | 'marcar' | 'folhear' | 'acenar' | 'concluir' | 'revisar';

export interface EstadoEmpadinha {
  tilt: number;
  nod: number;
  crown: number;
  lean: number;
  board: number;
  gaze: number;
  blink: number;
  handX: number;
  handY: number;
  handAngle: number;
  palm: number;
  write: number;
  check: number;
  page: number;
  turn: number;
  grip: number;
  think: number;
  smile: number;
}

export interface DefinicaoGesto {
  readonly descricao: string;
  readonly quadros: readonly (readonly [number, Partial<EstadoEmpadinha>])[];
  readonly estatico: Partial<EstadoEmpadinha>;
}

export interface GeometriaEmpadinha {
  readonly corpoTransform: string;
  readonly tampaTransform: string;
  readonly bracoApoioPath: string;
  readonly pranchetaTransform: string;
  readonly folhaBaseLinhas: string;
  readonly folhaBaseTiquePath: string | null;
  readonly folhaVersoVisivel: boolean;
  readonly folhaFrenteVisivel: boolean;
  readonly folhaVirandoVerso: boolean;
  readonly folhaVirandoTransform: string;
  readonly folhaFrenteTiquePath: string | null;
  readonly luvaApoioTransform: string;
  readonly luvaApoioPath: string;
  readonly bracoLivrePath: string;
  readonly bracoLivreLarguraContorno: number;
  readonly bracoLivreLarguraPreenchimento: number;
  readonly lapisOpacidade: number;
  readonly lapisHastePath: string;
  readonly lapisPontaPath: string;
  readonly luvaLivreTransform: string;
  readonly luvaLivrePath: string;
  readonly luvaLivrePalmaVisivel: boolean;
  readonly sobrancelhaEsquerdaPath: string;
  readonly sobrancelhaDireitaPath: string;
  readonly bocaPath: string;
  readonly olhosFechados: boolean;
  readonly olhoEsquerdoCx: number;
  readonly olhoEsquerdoCy: number;
  readonly olhoDireitoCx: number;
  readonly olhoDireitoCy: number;
  readonly olhoRy: number;
  readonly brilhoOlhoVisivel: boolean;
  readonly brilhoEsquerdoCx: number;
  readonly brilhoEsquerdoCy: number;
  readonly brilhoDireitoCx: number;
  readonly brilhoDireitoCy: number;
}

export const ESTADO_REPOUSO: EstadoEmpadinha = {
  tilt: 0,
  nod: 0,
  crown: 0,
  lean: 0,
  board: 0,
  gaze: 0,
  blink: 0,
  handX: 397,
  handY: 263,
  handAngle: 0.35,
  palm: 0,
  write: 0,
  check: 0,
  page: 0,
  turn: 0,
  grip: 0,
  think: 0,
  smile: 0,
};

const LENDO: Partial<EstadoEmpadinha> = { tilt: -5, nod: 2, crown: 2, lean: -4, board: 1, gaze: 1 };
const ESCREVENDO: Partial<EstadoEmpadinha> = { ...LENDO, write: 1, handAngle: 0.48 };
const MARCADO: Partial<EstadoEmpadinha> = { ...ESCREVENDO, check: 1 };
const CONCLUIDO: Partial<EstadoEmpadinha> = { check: 1, tilt: 2, nod: 4, crown: 5, smile: 1 };
const FOLHEANDO: Partial<EstadoEmpadinha> = { ...LENDO, page: 1, check: 1 };
const ACENANDO: Partial<EstadoEmpadinha> = { tilt: 2, handX: 440, handY: 182, palm: 1, smile: 1 };
const REVISANDO: Partial<EstadoEmpadinha> = {
  ...LENDO,
  handX: 319,
  handY: 254,
  handAngle: -0.42,
  think: 1,
};

export const GESTOS_EMPADINHA: Record<Exclude<PoseEmpadinha, 'pronta'>, DefinicaoGesto> = {
  conferir: {
    descricao: 'Ergue a prancheta, lê, marca um item e confirma com a cabeça.',
    quadros: [
      [0, {}],
      [440, LENDO],
      [610, LENDO],
      [675, { ...LENDO, blink: 1 }],
      [735, LENDO],
      [980, LENDO],
      [1290, ESCREVENDO],
      [1420, { ...ESCREVENDO, check: 0.32 }],
      [1600, MARCADO],
      [1730, { ...MARCADO, write: 0.88 }],
      [1980, { check: 1 }],
      [2200, CONCLUIDO],
      [2340, { ...CONCLUIDO, nod: 2, crown: 2 }],
      [2600, { check: 1 }],
    ],
    estatico: { ...LENDO, check: 1 },
  },
  marcar: {
    descricao: 'Faz um tique no papel, com a prancheta firme na outra mão.',
    quadros: [
      [0, {}],
      [340, LENDO],
      [630, ESCREVENDO],
      [760, { ...ESCREVENDO, check: 0.32 }],
      [960, MARCADO],
      [1090, { ...MARCADO, write: 0.88 }],
      [1370, { ...LENDO, check: 1 }],
      [1700, { check: 1 }],
    ],
    estatico: { ...LENDO, check: 1 },
  },
  folhear: {
    descricao: 'Levanta o canto da folha, vira a página e retoma a leitura.',
    quadros: [
      [0, { page: 1, check: 1 }],
      [370, FOLHEANDO],
      [650, { ...FOLHEANDO, grip: 1 }],
      [820, { ...FOLHEANDO, grip: 1, turn: 0.13 }],
      [1000, { ...FOLHEANDO, grip: 1, turn: 0.29 }],
      [1080, { ...FOLHEANDO, grip: 0.82, turn: 0.37, handX: 205, handY: 175 }],
      [1210, { ...FOLHEANDO, grip: 0.22, turn: 0.63, handX: 220, handY: 201 }],
      [1430, { ...FOLHEANDO, turn: 1, handX: 332, handY: 247 }],
      [1770, { ...LENDO, page: 1, turn: 1 }],
      [2120, { page: 1, turn: 1 }],
    ],
    estatico: { ...LENDO, page: 1, turn: 1 },
  },
  acenar: {
    descricao: 'Cumprimenta com a mão livre. A prancheta fica na outra mão.',
    quadros: [
      [0, {}],
      [240, { ...ACENANDO, handX: 429, handY: 206, palm: 0.55 }],
      [460, { ...ACENANDO, handX: 441, handAngle: -0.36 }],
      [655, { ...ACENANDO, handX: 450, handY: 179, handAngle: 0.33 }],
      [845, { ...ACENANDO, handX: 440, handY: 178, handAngle: -0.29 }],
      [1020, { ...ACENANDO, handX: 448, handY: 184, handAngle: 0.23 }],
      [1180, { ...ACENANDO, handY: 200, handAngle: 0.08, palm: 0.7 }],
      [1510, {}],
    ],
    estatico: ACENANDO,
  },
  concluir: {
    descricao: 'Dá um aceno curto com a cabeça, com o item marcado.',
    quadros: [
      [0, { check: 1 }],
      [180, { check: 1, crown: -3, smile: 0.45 }],
      [365, { ...CONCLUIDO, blink: 0.78 }],
      [460, { ...CONCLUIDO, blink: 0.1 }],
      [660, { ...CONCLUIDO, crown: 1, nod: 1 }],
      [1010, { check: 1 }],
    ],
    estatico: CONCLUIDO,
  },
  revisar: {
    descricao: 'Inclina a cabeça, leva a mão ao rosto e confere a prancheta de novo.',
    quadros: [
      [0, {}],
      [360, { ...LENDO, think: 0.35 }],
      [700, REVISANDO],
      [925, { ...REVISANDO, gaze: 0.62 }],
      [1200, { ...REVISANDO, tilt: -7, gaze: 1.23, handX: 316 }],
      [1400, { ...REVISANDO, gaze: 1.15 }],
      [1630, LENDO],
      [1960, {}],
    ],
    estatico: REVISANDO,
  },
};

const CHAVES_ESTADO = Object.keys(ESTADO_REPOUSO) as (keyof EstadoEmpadinha)[];

export function duracaoDoGesto(pose: PoseEmpadinha): number {
  if (pose === 'pronta') return 0;
  const quadros = GESTOS_EMPADINHA[pose].quadros;
  const ultimo = quadros[quadros.length - 1];
  return ultimo ? ultimo[0] : 0;
}

export function quadroEstatico(pose: PoseEmpadinha): EstadoEmpadinha {
  if (pose === 'pronta') return { ...ESTADO_REPOUSO };
  return { ...ESTADO_REPOUSO, ...GESTOS_EMPADINHA[pose].estatico };
}

export function quadroNoInstante(pose: PoseEmpadinha, tempoMs: number): EstadoEmpadinha {
  if (pose === 'pronta') return { ...ESTADO_REPOUSO };
  const quadros = GESTOS_EMPADINHA[pose].quadros;
  const proximoIndice = quadros.findIndex(([instante]) => instante > tempoMs);
  if (proximoIndice < 1) {
    const ultimo = quadros[quadros.length - 1];
    return { ...ESTADO_REPOUSO, ...(ultimo ? ultimo[1] : {}) };
  }
  const anterior = quadros[proximoIndice - 1];
  const proximo = quadros[proximoIndice];
  if (!anterior || !proximo) return { ...ESTADO_REPOUSO };

  const [tempoAntes, estadoAntes] = anterior;
  const [tempoDepois, estadoDepois] = proximo;
  const fracao = (tempoMs - tempoAntes) / (tempoDepois - tempoAntes);
  const suavizado = fracao * fracao * (3 - 2 * fracao);

  const resultado: EstadoEmpadinha = { ...ESTADO_REPOUSO };
  for (const chave of CHAVES_ESTADO) {
    const neutro = ESTADO_REPOUSO[chave];
    const valorAntes = estadoAntes[chave] ?? neutro;
    const valorDepois = estadoDepois[chave] ?? neutro;
    resultado[chave] = valorAntes + (valorDepois - valorAntes) * suavizado;
  }
  return resultado;
}

const RAD_PARA_GRAUS = 180 / Math.PI;
const HINGE_Y = -43;
const TIQUE_INICIO: readonly [number, number] = [-23, 16];
const TIQUE_JOELHO: readonly [number, number] = [-15, 25];
const TIQUE_FIM: readonly [number, number] = [5, 3];

function interpolar(de: number, para: number, t: number): number {
  return de + (para - de) * t;
}

function n(valor: number): string {
  return String(Math.round(valor * 100) / 100);
}

function pontoDoTique(progresso: number): readonly [number, number] {
  const antesDoJoelho = progresso <= 0.32;
  const de = antesDoJoelho ? TIQUE_INICIO : TIQUE_JOELHO;
  const para = antesDoJoelho ? TIQUE_JOELHO : TIQUE_FIM;
  const fracao = antesDoJoelho ? progresso / 0.32 : (progresso - 0.32) / 0.68;
  return [interpolar(de[0], para[0], fracao), interpolar(de[1], para[1], fracao)];
}

function caminhoTique(progresso: number): string | null {
  if (progresso <= 0) return null;
  const [px, py] = pontoDoTique(progresso);
  const joelho = progresso > 0.32 ? ` L${TIQUE_JOELHO[0]} ${TIQUE_JOELHO[1]}` : '';
  return `M${TIQUE_INICIO[0]} ${TIQUE_INICIO[1]}${joelho} L${n(px)} ${n(py)}`;
}

function formaLuva(palma: number): string {
  const elevacao = 10 * palma;
  return (
    `M-11 7C-16 3-16-4-12-6Q-9-7-6-3L-7 ${n(-9 - elevacao)}` +
    `Q-7 ${n(-14 - elevacao)} -3 ${n(-13 - elevacao)}L0 ${n(-6 - elevacao)}` +
    `L2 ${n(-12 - elevacao)}Q5 ${n(-16 - elevacao)} 8 ${n(-12 - elevacao)}L7 ${n(-6 - elevacao)}` +
    `L11 ${n(-8 - elevacao)}Q15 ${n(-10 - elevacao)} 16 ${n(-6 - elevacao)}L12 5` +
    `Q10 13 0 13Q-6 13-11 7Z`
  );
}

function movimentoFolha(turn: number): { shear: number; height: number } {
  const angulo = turn * 2 * Math.PI;
  return { shear: 0.19 * Math.sin(angulo), height: Math.cos(angulo) };
}

function dePrancheta(
  board: { x: number; y: number; angleRad: number },
  x: number,
  y: number,
): readonly [number, number] {
  const c = Math.cos(board.angleRad);
  const s = Math.sin(board.angleRad);
  return [board.x + x * c - y * s, board.y + x * s + y * c];
}

/** Constrói caminhos compactos de textura da massa (1 nó SVG por camada de cor). */
function gerarPontosTextura(
  total: number,
  calcularPosicao: (indice: number) => readonly [number, number],
  ehClaro: (indice: number) => boolean,
): { claros: string; escuros: string } {
  const claros: string[] = [];
  const escuros: string[] = [];
  for (let i = 0; i < total; i += 1) {
    const [x, y] = calcularPosicao(i);
    const segmento = `M${n(x)} ${n(y)}h0.01`;
    if (ehClaro(i)) claros.push(segmento);
    else escuros.push(segmento);
  }
  return { claros: claros.join(' '), escuros: escuros.join(' ') };
}

export const TEXTURA_CORPO = gerarPontosTextura(
  72,
  (i) => [129 + ((i * 197 + 89) % 284), 180 + ((i * 97 + 27) % 139)],
  (i) => i % 4 === 0,
);

export const TEXTURA_TAMPA = gerarPontosTextura(
  42,
  (i) => [110 + ((i * 233 + 29) % 338), 55 + ((i * 89 + 41) % 99)],
  (i) => i % 3 === 0,
);

const LUVA_APOIO_PATH = formaLuva(0);

/** Calcula todos os caminhos e transformações SVG para o estado atual. */
export function calcularGeometria(p: EstadoEmpadinha): GeometriaEmpadinha {
  const boardAngleDeg = -13 + p.board * 19;
  const board = {
    x: 132 + p.board * 23,
    y: 245 - p.board * 30,
    angleRad: (boardAngleDeg * Math.PI) / 180,
  };
  const [apoioX, apoioY] = dePrancheta(board, -42, 1);

  const [tiqueX, tiqueY] = dePrancheta(board, ...pontoDoTique(p.check));
  const { shear, height } = movimentoFolha(p.turn);
  const profundidadeFolha = 84;
  const [pegaX, pegaY] = dePrancheta(
    board,
    29 + profundidadeFolha * shear,
    HINGE_Y + profundidadeFolha * height,
  );

  const maoX = interpolar(interpolar(p.handX, tiqueX + 36, p.write), pegaX + 8, p.grip);
  const maoY = interpolar(interpolar(p.handY, tiqueY + 24, p.write), pegaY - 3, p.grip);
  const alcance = Math.max(0, Math.min(1, (390 - maoX) / 126));
  const aceno = p.palm;

  const bracoLivrePath =
    `M378 239 C${n(390 + 14 * aceno)} ${n(250 + 60 * alcance)} ` +
    `${n(maoX + 49 * alcance - 12 * aceno)} ` +
    `${n(maoY + Math.max(48, 281 - maoY) * alcance + 15 * aceno)} ` +
    `${n(maoX)} ${n(maoY)}`;

  const lapisX = maoX - 36;
  const lapisY = maoY - 24;
  const anguloMaoDeg = interpolar(p.handAngle, -0.48, p.grip) * RAD_PARA_GRAUS;
  const escalaLuvaLivre = 1 + 0.2 * p.palm;

  const gazeX = -7 * p.gaze;
  const gazeY = 8 * p.gaze + p.crown * 0.35;
  const aberturaOlho = 1 - p.blink;

  const temPagina = p.page > 0.5;
  const folhaVersoVisivel = temPagina && p.turn >= 0.5 && p.turn < 1;
  const folhaFrenteVisivel = temPagina && p.turn < 0.5;

  return {
    corpoTransform:
      `translate(${n(277 + p.lean)} ${n(306 + p.nod)}) ` +
      `rotate(${n(p.tilt)}) ` +
      `scale(${n(1 + p.nod * 0.0018)} ${n(1 - p.nod * 0.0027)}) ` +
      `translate(-277 -306)`,
    tampaTransform: `translate(0 ${n(p.crown)})`,
    bracoApoioPath: `M162 206 Q${n(Math.min(108, apoioX - 8))} ${n(apoioY - 15)} ${n(apoioX)} ${n(apoioY)}`,
    pranchetaTransform: `translate(${n(board.x)} ${n(board.y)}) rotate(${n(boardAngleDeg)})`,
    folhaBaseLinhas: temPagina ? 'M-22-24H15M-22-9H22M-22 6H4' : 'M-21-24H18M-21-10H10',
    folhaBaseTiquePath: temPagina ? null : caminhoTique(p.check),
    folhaVersoVisivel,
    folhaFrenteVisivel,
    folhaVirandoVerso: height < 0,
    folhaVirandoTransform: `translate(0 ${HINGE_Y}) matrix(1 0 ${n(shear)} ${n(height)} 0 0) translate(0 ${-HINGE_Y})`,
    folhaFrenteTiquePath: caminhoTique(p.check),
    luvaApoioTransform: `translate(${n(apoioX)} ${n(apoioY)}) rotate(${n(-0.43 * RAD_PARA_GRAUS)}) scale(0.82)`,
    luvaApoioPath: LUVA_APOIO_PATH,
    bracoLivrePath,
    bracoLivreLarguraContorno: 25 - 4 * alcance,
    bracoLivreLarguraPreenchimento: 16.5 - 3 * alcance,
    lapisOpacidade: p.write > 0.18 ? Math.min(1, (p.write - 0.18) / 0.22) : 0,
    lapisHastePath: `M${n(lapisX + 6)} ${n(lapisY + 4)} L${n(maoX + 11)} ${n(maoY + 7)}`,
    lapisPontaPath: `M${n(lapisX)} ${n(lapisY)} l7 3 l-3 4 Z`,
    luvaLivreTransform: `translate(${n(maoX)} ${n(maoY)}) rotate(${n(anguloMaoDeg)}) scale(${n(escalaLuvaLivre)})`,
    luvaLivrePath: formaLuva(p.palm),
    luvaLivrePalmaVisivel: p.palm > 0.45,
    sobrancelhaEsquerdaPath: `M225 ${n(203 + 5 * p.gaze)} Q236 ${n(194 + 7 * p.gaze)} 248 ${n(198 + 6 * p.gaze)}`,
    sobrancelhaDireitaPath: `M304 ${n(197 - 6 * p.think)} Q315 ${n(190 - 10 * p.think)} 326 ${n(194 - 4 * p.think)}`,
    bocaPath: `M266 242 Q${n(285 + 6 * p.think)} ${n(259 + 6 * p.smile - 17 * p.think)} 298 ${n(239 + 6 * p.think)}`,
    olhosFechados: aberturaOlho < 0.21,
    olhoEsquerdoCx: 237 + gazeX,
    olhoEsquerdoCy: 221 + gazeY,
    olhoDireitoCx: 316 + gazeX,
    olhoDireitoCy: 215 + gazeY,
    olhoRy: Math.max(1, 12 * aberturaOlho),
    brilhoOlhoVisivel: aberturaOlho > 0.55,
    brilhoEsquerdoCx: 235 + gazeX,
    brilhoEsquerdoCy: 217 + gazeY,
    brilhoDireitoCx: 314 + gazeX,
    brilhoDireitoCy: 211 + gazeY,
  };
}
