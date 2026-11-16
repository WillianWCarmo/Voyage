// Dados e cálculos do transporte (linhas, paradas, ônibus, rotas).
// Os valores abaixo são o "plano B" (sem internet). Quando o app conecta, o FleetProvider
// (fleet.tsx) chama applyTransit() e substitui os dados pelos que vêm da API local.

export type Stop = { id: string; name: string; x: number; y: number };
export type LineKind = "urbana" | "regional";
export type Line = {
  id: string;
  code: string;
  name: string;
  kind: LineKind;
  color: string;
  fare: number;
  stopIds: string[];
};
export type Bus = {
  id: string;
  lineId: string;
  dist: number; // distância percorrida ao longo da linha (unidades do mapa)
  dir: 1 | -1;
  speed: number; // unidades do mapa por minuto simulado
};

// Mapa esquemático 360 x 440
export const MAP_W = 360;
export const MAP_H = 440;
export const TIME_SCALE = 4; // 1s real = 4s simulados
export const NOMINAL_SPEED = 16; // unidades por minuto simulado
export const TRANSFER_MINUTES = 4;

const stopList: Stop[] = [
  { id: "term", name: "Terminal Central", x: 180, y: 230 },
  { id: "centro", name: "Praça Central", x: 180, y: 140 },
  { id: "vilarosa", name: "Vila Rosa", x: 60, y: 90 },
  { id: "avprinc", name: "Av. Principal", x: 240, y: 110 },
  { id: "hosp", name: "Hospital Municipal", x: 300, y: 80 },
  { id: "fatec", name: "Fatec", x: 300, y: 200 },
  { id: "rodo", name: "Rodoviária", x: 100, y: 230 },
  { id: "jdsao", name: "Jardim São Sebastião", x: 70, y: 350 },
  { id: "norte", name: "Jardim Norte", x: 180, y: 40 },
  { id: "parque", name: "Parque Municipal", x: 190, y: 370 },
  { id: "distrito", name: "Distrito Industrial", x: 330, y: 285 },
  { id: "matao", name: "Matão", x: 335, y: 420 },
];

export const STOPS: Record<string, Stop> = stopList.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<string, Stop>,
);

export const STOP_LIST: Stop[] = [...stopList].sort((a, b) =>
  a.name.localeCompare(b.name, "pt-BR"),
);

export const LINES: Line[] = [
  { id: "201", code: "201", name: "Centro · Vila Rosa", kind: "urbana", color: "#0951A0", fare: 5.5, stopIds: ["term", "centro", "vilarosa"] },
  { id: "302", code: "302", name: "Terminal · Jardim São Sebastião", kind: "urbana", color: "#F2A900", fare: 5.5, stopIds: ["term", "rodo", "jdsao"] },
  { id: "405", code: "405", name: "Centro · Hospital", kind: "urbana", color: "#7B2CFF", fare: 5.5, stopIds: ["centro", "avprinc", "hosp"] },
  { id: "118", code: "118", name: "Fatec · Centro", kind: "urbana", color: "#00C9A7", fare: 5.5, stopIds: ["fatec", "term", "centro"] },
  { id: "507", code: "507", name: "Jardim Norte · Parque", kind: "urbana", color: "#E5484D", fare: 5.5, stopIds: ["norte", "centro", "term", "parque"] },
  { id: "710", code: "710", name: "Taquaritinga · Matão", kind: "regional", color: "#192440", fare: 12, stopIds: ["term", "fatec", "distrito", "matao"] },
];

export const LINE_MAP: Record<string, Line> = LINES.reduce(
  (acc, l) => {
    acc[l.id] = l;
    return acc;
  },
  {} as Record<string, Line>,
);

export type TransitData = { stops: Stop[]; lines: Line[] };

// Troca os dados embutidos pelos que vieram da API local, mantendo as MESMAS referências
// (STOPS, STOP_LIST, LINES, LINE_MAP) para o resto do app continuar funcionando.
export function applyTransit(data: TransitData): boolean {
  if (!Array.isArray(data?.stops) || !Array.isArray(data?.lines) || data.lines.length === 0) return false;

  const stopIds = new Set<string>();
  for (const stop of data.stops) {
    if (
      !stop || typeof stop.id !== "string" || !stop.id.trim() ||
      typeof stop.name !== "string" || !stop.name.trim() ||
      !Number.isFinite(Number(stop.x)) || !Number.isFinite(Number(stop.y)) ||
      stopIds.has(stop.id)
    ) return false;
    stopIds.add(stop.id);
  }

  const lineIds = new Set<string>();
  for (const line of data.lines) {
    if (
      !line || typeof line.id !== "string" || !line.id.trim() ||
      typeof line.code !== "string" || !line.code.trim() ||
      typeof line.name !== "string" || !line.name.trim() ||
      !["urbana", "regional"].includes(line.kind) ||
      typeof line.color !== "string" ||
      !Number.isFinite(Number(line.fare)) || Number(line.fare) < 0 ||
      !Array.isArray(line.stopIds) || line.stopIds.length < 2 ||
      line.stopIds.some((id) => !stopIds.has(id)) ||
      lineIds.has(line.id)
    ) return false;
    lineIds.add(line.id);
  }

  Object.keys(STOPS).forEach((k) => delete STOPS[k]);
  data.stops.forEach((s) => (STOPS[s.id] = s));
  STOP_LIST.splice(0, STOP_LIST.length, ...[...data.stops].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
  LINES.splice(0, LINES.length, ...data.lines);
  Object.keys(LINE_MAP).forEach((k) => delete LINE_MAP[k]);
  data.lines.forEach((l) => (LINE_MAP[l.id] = l));
  Object.keys(geoCache).forEach((k) => delete geoCache[k]);
  return true;
}

// ---------- Geometria ----------
type Geometry = { points: Stop[]; cum: number[]; length: number };
const geoCache: Record<string, Geometry> = {};

export function geometry(line: Line): Geometry {
  if (geoCache[line.id]) return geoCache[line.id];
  const points = line.stopIds.map((id) => STOPS[id]);
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(
      cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y),
    );
  }
  const g = { points, cum, length: cum[cum.length - 1] };
  geoCache[line.id] = g;
  return g;
}

export function positionAt(line: Line, dist: number): { x: number; y: number } {
  const g = geometry(line);
  const d = Math.min(Math.max(dist, 0), g.length);
  let i = 1;
  while (i < g.cum.length - 1 && g.cum[i] < d) i++;
  const segLen = g.cum[i] - g.cum[i - 1] || 1;
  const t = (d - g.cum[i - 1]) / segLen;
  const a = g.points[i - 1];
  const b = g.points[i];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// ---------- Frota simulada ----------
export function createFleet(): Bus[] {
  const buses: Bus[] = [];
  LINES.forEach((line, li) => {
    const g = geometry(line);
    const count = line.kind === "regional" ? 2 : 3;
    for (let i = 0; i < count; i++) {
      buses.push({
        id: `VY-${line.code}-${String(i + 1).padStart(2, "0")}`,
        lineId: line.id,
        dist: (g.length * (i + 1)) / (count + 1),
        dir: i % 2 === 0 ? 1 : -1,
        speed: NOMINAL_SPEED * (0.88 + ((li * 3 + i) % 5) * 0.06),
      });
    }
  });
  return buses;
}

export function stepFleet(buses: Bus[], dtSec: number): Bus[] {
  return buses.map((b) => {
    if (!LINE_MAP[b.lineId]) return b;
    const g = geometry(LINE_MAP[b.lineId]);
    let dist = b.dist + b.dir * (b.speed / 60) * dtSec * TIME_SCALE;
    let dir = b.dir;
    if (dist >= g.length) {
      dist = g.length - (dist - g.length);
      dir = -1;
    } else if (dist <= 0) {
      dist = -dist;
      dir = 1;
    }
    return { ...b, dist, dir };
  });
}

// Índice (na linha) da próxima parada à frente do ônibus
export function nextStopIndex(bus: Bus, line: Line): number {
  const g = geometry(line);
  if (bus.dir === 1) {
    for (let i = 0; i < g.cum.length; i++) if (g.cum[i] >= bus.dist - 0.01) return i;
    return g.cum.length - 1;
  }
  for (let i = g.cum.length - 1; i >= 0; i--) if (g.cum[i] <= bus.dist + 0.01) return i;
  return 0;
}

// Minutos de relógio até o ônibus chegar à parada `stopIdx` (considera o fator de simulação).
export function etaToStop(bus: Bus, line: Line, stopIdx: number): number {
  const g = geometry(line);
  const sd = g.cum[stopIdx];
  let d: number;
  if (bus.dir === 1) {
    d = sd >= bus.dist ? sd - bus.dist : g.length - bus.dist + (g.length - sd);
  } else {
    d = sd <= bus.dist ? bus.dist - sd : bus.dist + sd;
  }
  return d / (bus.speed * TIME_SCALE);
}

export function nearestEta(
  buses: Bus[],
  line: Line,
  stopIdx: number,
): { bus: Bus; minutes: number } | null {
  let best: { bus: Bus; minutes: number } | null = null;
  for (const bus of buses) {
    if (bus.lineId !== line.id) continue;
    const minutes = etaToStop(bus, line, stopIdx);
    if (!best || minutes < best.minutes) best = { bus, minutes };
  }
  return best;
}

export function linesAtStop(stopId: string): Line[] {
  return LINES.filter((l) => l.stopIds.includes(stopId));
}

// ---------- Planejamento de viagem ----------
export type Leg = { line: Line; from: Stop; to: Stop; stops: number; minutes: number };
export type RouteOption = {
  id: string;
  legs: Leg[];
  wait: number;
  total: number;
  transfers: number;
  fare: number;
};

function makeLeg(line: Line, fromId: string, toId: string): Leg {
  const g = geometry(line);
  const i = line.stopIds.indexOf(fromId);
  const j = line.stopIds.indexOf(toId);
  return {
    line,
    from: STOPS[fromId],
    to: STOPS[toId],
    stops: Math.abs(i - j),
    minutes: Math.max(1, Math.round(Math.abs(g.cum[i] - g.cum[j]) / (NOMINAL_SPEED * TIME_SCALE))),
  };
}

export function findRoutes(originId: string, destId: string, buses: Bus[]): RouteOption[] {
  if (
    !originId || !destId || originId === destId ||
    !STOPS[originId] || !STOPS[destId]
  ) return [];

  const build = (legs: Leg[]): RouteOption => {
    const first = legs[0];
    const idx = first.line.stopIds.indexOf(originId);
    const eta = nearestEta(buses, first.line, idx);
    const wait = eta ? Math.round(eta.minutes) : 5;
    const transfers = legs.length - 1;
    const ride = legs.reduce((sum, l) => sum + l.minutes, 0);
    return {
      id: legs.map((l) => `${l.line.id}:${l.from.id}>${l.to.id}`).join("|"),
      legs,
      wait,
      transfers,
      total: wait + ride + transfers * TRANSFER_MINUTES,
      fare: legs.reduce((sum, leg) => sum + leg.line.fare, 0), // o backend cobra cada embarque/trecho separadamente
    };
  };

  const options: RouteOption[] = [];
  const fromLines = LINES.filter((l) => l.stopIds.includes(originId));
  const toLines = LINES.filter((l) => l.stopIds.includes(destId));

  for (const l of fromLines) {
    if (l.stopIds.includes(destId)) options.push(build([makeLeg(l, originId, destId)]));
  }
  for (const a of fromLines) {
    for (const b of toLines) {
      if (a.id === b.id) continue;
      for (const sid of a.stopIds) {
        if (sid === originId || sid === destId) continue;
        if (b.stopIds.includes(sid)) {
          options.push(build([makeLeg(a, originId, sid), makeLeg(b, sid, destId)]));
        }
      }
    }
  }

  const seen = new Set<string>();
  return options
    .filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)))
    .sort((x, y) => x.total - y.total)
    .slice(0, 5);
}
