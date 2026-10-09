/**
 * Retratos: composição do token em Canvas2D. Funções puras (sem Foundry), testáveis no Node.
 *
 * Estado do enquadramento (tudo relativo ao lado S da saída, então vale para qualquer tamanho):
 *   x, y      deslocamento do centro da imagem em frações de S (0,0 = centralizada)
 *   zoom      1 = a imagem cobre o quadro inteiro (lado menor = S)
 *   rot       graus, sentido horário
 *   espelharH / espelharV
 *   mascara   "circulo" | "quadrado"
 *   recorte   fração do quadro ocupada pela máscara (a moldura cobre a borda)
 *   moldura   id de moldura embutida, "personalizada" ou "nenhuma"
 *   molduraArquivo  caminho da moldura personalizada
 *   tinta     cor (#rrggbb) que tinge as molduras simples, ou "" para a cor original
 *   fundo     "" (transparente) ou #rrggbb
 */

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;

export function estadoPadrao(extra = {}) {
  return {
    x: 0, y: 0, zoom: 1, rot: 0, espelharH: false, espelharV: false,
    mascara: "circulo", recorte: 0.92,
    moldura: "nenhuma", molduraArquivo: "", tinta: "", fundo: "",
    ...extra
  };
}

/** Só os campos de enquadramento (para guardar no ator sem lixo). */
export function limparEstado(e) {
  const p = estadoPadrao();
  const out = {};
  for (const k of Object.keys(p)) out[k] = e?.[k] ?? p[k];
  out.zoom = limitar(Number(out.zoom) || 1, ZOOM_MIN, ZOOM_MAX);
  out.recorte = limitar(Number(out.recorte) || p.recorte, 0.5, 1);
  return out;
}

export const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/** Escala que faz o lado menor da imagem preencher o quadro. */
export function escalaBase(w, h, S) {
  return S / Math.max(1, Math.min(w, h));
}

/** Transformação da imagem de origem para o quadro de saída S×S. */
export function transformacao(e, w, h, S) {
  const s = escalaBase(w, h, S) * e.zoom;
  return {
    cx: S / 2 + e.x * S,
    cy: S / 2 + e.y * S,
    rot: (e.rot * Math.PI) / 180,
    sx: s * (e.espelharH ? -1 : 1),
    sy: s * (e.espelharV ? -1 : 1)
  };
}

/** Onde cai, na saída, o ponto (px, py) da imagem de origem (em pixels da origem, a partir do canto). */
export function pontoNaSaida(e, w, h, S, px, py) {
  const t = transformacao(e, w, h, S);
  const lx = (px - w / 2) * t.sx;
  const ly = (py - h / 2) * t.sy;
  const c = Math.cos(t.rot), s = Math.sin(t.rot);
  return { x: t.cx + lx * c - ly * s, y: t.cy + lx * s + ly * c };
}

/** Arrastar na tela: dx/dy em pixels de tela, lado é o tamanho do quadro na tela. */
export function arrastar(e, dx, dy, lado) {
  return { ...e, x: e.x + dx / lado, y: e.y + dy / lado };
}

/**
 * Zoom mantendo fixo o ponto sob o cursor.
 * (px, py): posição do cursor em frações do quadro relativas ao centro (-0.5..0.5).
 */
export function zoomNoPonto(e, novoZoom, px = 0, py = 0) {
  const z = limitar(novoZoom, ZOOM_MIN, ZOOM_MAX);
  const k = z / e.zoom;
  return { ...e, zoom: z, x: px - (px - e.x) * k, y: py - (py - e.y) * k };
}

/** Fator de zoom da roda do mouse. */
export const fatorRoda = (deltaY) => Math.exp(-limitar(deltaY, -300, 300) * 0.0015);

export function girar(e, graus) {
  let r = (e.rot + graus) % 360;
  if (r > 180) r -= 360;
  if (r <= -180) r += 360;
  return { ...e, rot: r };
}

/** Desenha o contorno da máscara (círculo ou quadrado) centrado no quadro. */
export function caminhoMascara(ctx, forma, S, recorte) {
  const r = (S / 2) * recorte;
  ctx.beginPath();
  if (forma === "quadrado") ctx.rect(S / 2 - r, S / 2 - r, 2 * r, 2 * r);
  else ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2);
  ctx.closePath();
}

/**
 * Compõe o token.
 * @param ctx      CanvasRenderingContext2D de S×S
 * @param e        estado
 * @param img      imagem de origem (HTMLImageElement, ImageBitmap, canvas) ou null
 * @param moldura  imagem da moldura já pronta (tingida) ou null
 */
export function desenhar(ctx, e, { img = null, moldura = null } = {}, S = ctx.canvas.width) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, S, S);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.save();
  caminhoMascara(ctx, e.mascara, S, e.recorte);
  ctx.clip();
  if (e.fundo) { ctx.fillStyle = e.fundo; ctx.fillRect(0, 0, S, S); }
  if (img) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const t = transformacao(e, w, h, S);
    ctx.translate(t.cx, t.cy);
    ctx.rotate(t.rot);
    ctx.scale(t.sx, t.sy);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  }
  ctx.restore();

  if (moldura) ctx.drawImage(moldura, 0, 0, S, S);
  ctx.restore();
}

/* ---------- Nomes de arquivo ---------- */

export function slug(nome) {
  const s = String(nome ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "ator";
}

/** Nome estável: o mesmo ator sempre grava no mesmo arquivo (a versão vai na query). */
export const nomeArquivo = (nome, id, sufixo = "token", ext = "webp") => `${slug(nome)}-${id}-${sufixo}.${ext}`;

/** Subpasta por tipo de ator. */
export function subpastaDoTipo(tipo) {
  return { character: "personagens", npc: "npcs", vehicle: "veiculos", group: "grupos", encounter: "encontros" }[tipo] ?? slug(tipo || "outros");
}

/** "[data] a/b" | "[s3:bucket] a/b" | "a/b" → { fonte, bucket, pasta } */
export function lerPasta(str, fontePadrao = "data") {
  const bruto = String(str ?? "").trim();
  const m = bruto.match(/^\[([^\]]+)\]\s*(.*)$/u);
  let fonte = fontePadrao, bucket = null, pasta = bruto;
  if (m) {
    const [f, b] = m[1].split(":");
    fonte = f.trim() || fontePadrao;
    bucket = b?.trim() || null;
    pasta = m[2];
  }
  pasta = pasta.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
  return { fonte, bucket, pasta };
}

export function juntarPasta(...partes) {
  return partes.filter(Boolean).join("/").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "");
}

/** Pasta-mãe comum de duas pastas ("tokenizer/pc-images" + "tokenizer/npc-images" → "tokenizer"). */
export function pastaComum(a, b) {
  if (!a) return b ?? "";
  if (!b) return a;
  const pa = a.split("/"), pb = b.split("/");
  const out = [];
  for (let i = 0; i < Math.min(pa.length, pb.length) && pa[i] === pb[i]; i++) out.push(pa[i]);
  return out.join("/");
}

/** Tira a query de versão (?v=123) de um caminho. */
export const semVersao = (src) => String(src ?? "").replace(/\?.*$/, "");
export const comVersao = (src, v = Date.now()) => `${semVersao(src)}?v=${v}`;
