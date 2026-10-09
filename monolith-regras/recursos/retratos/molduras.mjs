/**
 * Retratos: molduras embutidas de Monolith, desenhadas em SVG (512×512, centro 256).
 * Cada moldura é uma função (cor, forma) → SVG, então a tinta e a máscara quadrada saem de graça.
 * A faixa de todas fica entre o raio 230 e 256: o recorte padrão (0.92) passa por baixo dela.
 */

const C = 256;

/* ---------- Cores ---------- */

function rgb(hex) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const hex = (r) => "#" + r.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
/** Mistura a cor com outra (t = 0 mantém, 1 vira a outra). */
export function misturar(a, b, t) {
  const x = rgb(a), y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
}
export const clarear = (c, t) => misturar(c, "#ffffff", t);
export const escurecer = (c, t) => misturar(c, "#000000", t);
export const corValida = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c ?? ""));

/* ---------- Formas ---------- */

/** Contorno de raio médio r: círculo ou quadrado de cantos vivos. */
function contorno(forma, r, attrs) {
  if (forma === "quadrado") return `<rect x="${C - r}" y="${C - r}" width="${2 * r}" height="${2 * r}" fill="none" ${attrs}/>`;
  return `<circle cx="${C}" cy="${C}" r="${r}" fill="none" ${attrs}/>`;
}

/** Pontos ao longo do contorno de raio r (n por volta; no quadrado: cantos e meios). */
function pontos(forma, r, n) {
  if (forma === "quadrado") {
    const d = r;
    return [[-d, -d], [0, -d], [d, -d], [d, 0], [d, d], [0, d], [-d, d], [-d, 0]].map(([x, y]) => [C + x, C + y]);
  }
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  });
}

function gradiente(id, claro, base, escuro) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${claro}"/><stop offset="0.45" stop-color="${base}"/><stop offset="1" stop-color="${escuro}"/></linearGradient>`;
}

/** Sombra suave da moldura sobre a imagem (só no círculo). */
function sombraInterna(forma, rInterno) {
  if (forma === "quadrado") return "";
  return `<radialGradient id="sombra" cx="0.5" cy="0.5" r="0.5">
      <stop offset="${((rInterno - 22) / 256).toFixed(3)}" stop-color="#000" stop-opacity="0"/>
      <stop offset="${(rInterno / 256).toFixed(3)}" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
}
const usarSombra = (forma, rInterno) => (forma === "quadrado" ? "" : `<circle cx="${C}" cy="${C}" r="${rInterno}" fill="url(#sombra)"/>`);

const svg = (defs, corpo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs>${defs}</defs>${corpo}</svg>`;

/* ---------- Molduras ---------- */

export const MOLDURAS = {
  ferro: {
    cor: "#666c78",
    recorte: 0.93,
    desenho(cor, forma) {
      const claro = clarear(cor, 0.45), escuro = escurecer(cor, 0.55), preto = escurecer(cor, 0.85);
      const rebites = pontos(forma, 245, 8).map(([x, y]) =>
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${claro}" stroke="${preto}" stroke-width="1.5"/>`).join("");
      return svg(gradiente("g", claro, cor, escuro) + sombraInterna(forma, 236),
        usarSombra(forma, 236) +
        contorno(forma, 245, `stroke="url(#g)" stroke-width="20"`) +
        contorno(forma, 254.5, `stroke="${preto}" stroke-width="3"`) +
        contorno(forma, 235.5, `stroke="${preto}" stroke-width="3"`) +
        contorno(forma, 250, `stroke="${claro}" stroke-width="1" stroke-opacity="0.5"`) +
        rebites);
    }
  },
  sangue: {
    cor: "#a3121b",
    recorte: 0.92,
    desenho(cor, forma) {
      const claro = clarear(cor, 0.35), escuro = escurecer(cor, 0.6), brilho = misturar(cor, "#ff8a8a", 0.55);
      const cravos = pontos(forma, 243, forma === "quadrado" ? 8 : 4)
        .filter((_, i) => forma !== "quadrado" || i % 2 === 1)
        .map(([x, y]) => `<rect x="${(x - 7).toFixed(1)}" y="${(y - 7).toFixed(1)}" width="14" height="14" fill="${brilho}" stroke="#07080b" stroke-width="2" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})"/>`).join("");
      return svg(gradiente("g", claro, cor, escuro) + sombraInterna(forma, 232),
        usarSombra(forma, 232) +
        contorno(forma, 243, `stroke="url(#g)" stroke-width="22"`) +
        contorno(forma, 254.5, `stroke="#07080b" stroke-width="3"`) +
        contorno(forma, 233, `stroke="${brilho}" stroke-width="2"`) +
        contorno(forma, 231, `stroke="#07080b" stroke-width="2"`) +
        cravos);
    }
  },
  osso: {
    cor: "#d9cfbb",
    recorte: 0.91,
    desenho(cor, forma) {
      const claro = clarear(cor, 0.5), escuro = escurecer(cor, 0.35), sulco = escurecer(cor, 0.6);
      return svg(gradiente("g", claro, cor, escuro) + sombraInterna(forma, 232),
        usarSombra(forma, 232) +
        contorno(forma, 243, `stroke="url(#g)" stroke-width="24"`) +
        contorno(forma, 243, `stroke="${sulco}" stroke-width="24" stroke-dasharray="2 22" stroke-opacity="0.45"`) +
        contorno(forma, 254.5, `stroke="${sulco}" stroke-width="3"`) +
        contorno(forma, 231.5, `stroke="${sulco}" stroke-width="3"`));
    }
  },
  cobalto: {
    cor: "#28479a",
    recorte: 0.92,
    desenho(cor, forma) {
      const claro = clarear(cor, 0.35), escuro = escurecer(cor, 0.55), runa = misturar(cor, "#cfdcff", 0.6);
      return svg(gradiente("g", claro, cor, escuro) + sombraInterna(forma, 233),
        usarSombra(forma, 233) +
        contorno(forma, 244, `stroke="url(#g)" stroke-width="20"`) +
        contorno(forma, 244, `stroke="${runa}" stroke-width="3" stroke-dasharray="14 10" stroke-opacity="0.7"`) +
        contorno(forma, 254.5, `stroke="#07080b" stroke-width="3"`) +
        contorno(forma, 235, `stroke="${runa}" stroke-width="2"`) +
        contorno(forma, 233, `stroke="#07080b" stroke-width="2"`));
    }
  },
  ouro: {
    cor: "#d29a3a",
    recorte: 0.91,
    desenho(cor, forma) {
      const claro = clarear(cor, 0.55), escuro = escurecer(cor, 0.5), preto = escurecer(cor, 0.85);
      const pedras = pontos(forma, forma === "quadrado" ? 245 : 249, forma === "quadrado" ? 8 : 4)
        .filter((_, i) => forma !== "quadrado" || i % 2 === 0)
        .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${claro}" stroke="${preto}" stroke-width="2"/>`).join("");
      return svg(gradiente("g", claro, cor, escuro) + sombraInterna(forma, 232),
        usarSombra(forma, 232) +
        contorno(forma, 249, `stroke="url(#g)" stroke-width="13"`) +
        contorno(forma, 241, `stroke="${preto}" stroke-width="3"`) +
        contorno(forma, 236, `stroke="url(#g)" stroke-width="7"`) +
        contorno(forma, 255, `stroke="${preto}" stroke-width="2"`) +
        contorno(forma, 232, `stroke="${preto}" stroke-width="1.5"`) +
        pedras);
    }
  }
};

export const IDS_MOLDURAS = Object.keys(MOLDURAS);

/** SVG da moldura embutida, já tingido e na forma da máscara. */
export function svgMoldura(id, { tinta = "", forma = "circulo" } = {}) {
  const m = MOLDURAS[id];
  if (!m) return null;
  return m.desenho(corValida(tinta) ? tinta : m.cor, forma);
}

export const dataUrlSvg = (s) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
