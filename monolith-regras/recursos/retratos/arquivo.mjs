/**
 * Retratos: imagens, envio ao servidor e aplicação no ator e nos tokens.
 */
import { desenhar, nomeArquivo, subpastaDoTipo, lerPasta, juntarPasta, semVersao, comVersao } from "./compor.mjs";
import { svgMoldura, dataUrlSvg, corValida } from "./molduras.mjs";

const FP = () => foundry.applications.apps.FilePicker.implementation;

/* ---------- Imagens ---------- */

/**
 * Carrega uma imagem para o canvas. Tenta com CORS (para poder exportar);
 * se o site de fora não permitir, carrega mesmo assim e marca `contaminada`.
 */
export function carregarImagem(src) {
  const tentar = (cors) => new Promise((ok, falha) => {
    const img = new Image();
    img.decoding = "async";
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error(`Não foi possível carregar ${src}`));
    img.src = src;
  });
  const local = /^(data:|blob:)/.test(src);
  return tentar(!local).catch((err) => {
    if (local || !/^https?:/i.test(src)) throw err;
    return tentar(false).then((img) => { img.contaminada = true; return img; });
  });
}

const cacheMolduras = new Map();

/** Imagem da moldura pronta para desenhar (embutida tingida, ou arquivo personalizado). */
export async function imagemMoldura(e) {
  if (!e.moldura || e.moldura === "nenhuma") return null;
  let chave, src;
  if (e.moldura === "personalizada") {
    if (!e.molduraArquivo) return null;
    chave = src = e.molduraArquivo;
  } else {
    const tinta = corValida(e.tinta) ? e.tinta : "";
    chave = `${e.moldura}|${tinta}|${e.mascara}`;
    const s = svgMoldura(e.moldura, { tinta, forma: e.mascara });
    if (!s) return null;
    src = dataUrlSvg(s);
  }
  if (!cacheMolduras.has(chave)) {
    const p = carregarImagem(src).catch((err) => { cacheMolduras.delete(chave); throw err; });
    cacheMolduras.set(chave, p);
  }
  return cacheMolduras.get(chave);
}

/** Desenha o token num canvas novo de S×S e devolve o Blob (webp; png se o navegador não souber webp). */
export async function renderizar(e, img, S) {
  const moldura = await imagemMoldura(e).catch(() => null);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  desenhar(canvas.getContext("2d"), e, { img, moldura }, S);
  const blob = await new Promise((ok, falha) => {
    try { canvas.toBlob((b) => (b ? ok(b) : falha(new Error("toBlob vazio"))), "image/webp", 0.92); }
    catch (err) { falha(err); }
  });
  return blob;
}

export const extensaoDe = (blob) => ({ "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/avif": "avif" }[blob?.type] ?? "webp");

export function blobParaDataUrl(blob) {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => falha(r.error);
    r.readAsDataURL(blob);
  });
}
export const dataUrlParaBlob = async (url) => (await fetch(url)).blob();

/* ---------- Pastas e envio ---------- */

const pastasProntas = new Set();

/** Cria a pasta (e as de cima) se faltar. Ignora "já existe". */
export async function garantirPasta(fonte, pasta, bucket = null) {
  const partes = pasta.split("/").filter(Boolean);
  let atual = "";
  for (const p of partes) {
    atual = atual ? `${atual}/${p}` : p;
    const chave = `${fonte}|${bucket ?? ""}|${atual}`;
    if (pastasProntas.has(chave)) continue;
    try {
      await FP().createDirectory(fonte, atual, bucket ? { bucket } : {});
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (!/EEXIST|already exists|exist/i.test(msg)) console.warn(`monolith-regras | retratos: pasta ${atual}`, err);
    }
    pastasProntas.add(chave);
  }
}

/** Destino dos arquivos de um ator: { fonte, bucket, pasta }. */
export function destino(ctx, actor) {
  const base = lerPasta(ctx.get("pasta") || "tokens");
  const tipo = (actor?.isToken ? actor.baseActor?.type : actor?.type) ?? "outros";
  const pasta = ctx.get("subpastas") ? juntarPasta(base.pasta, subpastaDoTipo(tipo)) : base.pasta;
  return { ...base, pasta };
}

/** Envia um Blob para a pasta do ator. Devolve o caminho já com a versão (?v=). */
export async function enviar(ctx, actor, blob, sufixo = "token") {
  const { fonte, bucket, pasta } = destino(ctx, actor);
  if (!pasta) throw new Error(ctx.t("erroPastaRaiz"));
  const id = actor.isToken ? `${actor.baseActor?.id ?? "x"}-${actor.token?.id}` : actor.id;
  const nome = nomeArquivo(actor.name, id, sufixo, extensaoDe(blob));
  await garantirPasta(fonte, pasta, bucket);
  const file = new File([blob], nome, { type: blob.type || "image/webp" });
  const res = await FP().upload(fonte, pasta, file, bucket ? { bucket } : {}, { notify: false });
  if (res === false || res?.status === "error") throw new Error(res?.message ?? ctx.t("erroEnvio"));
  const caminho = res?.path ?? `${pasta}/${nome}`;
  return comVersao(caminho);
}

/* ---------- Aplicar no ator e nos tokens ---------- */

/**
 * Troca a imagem do token do ator (protótipo + tokens já colocados) e, se pedido, o retrato.
 * @param opcoes.todasCenas  também tokens das outras cenas
 * @param opcoes.retrato     novo caminho do retrato, ou null para manter
 * @param opcoes.estado      enquadramento para guardar no ator
 */
export async function aplicar(ctx, actor, src, { todasCenas = false, retrato = null, estado = null } = {}) {
  if (actor.isToken) {
    await actor.token.update({ "texture.src": src });
    if (retrato) await actor.update({ img: retrato });
    return 1;
  }
  const antigo = semVersao(actor.prototypeToken?.texture?.src);
  const upd = { "prototypeToken.texture.src": src };
  if (retrato) upd.img = retrato;
  if (estado) upd[ctx.caminhoFlag("estado")] = estado;
  await actor.update(upd);

  const cenas = todasCenas ? game.scenes.contents : [globalThis.canvas?.scene].filter(Boolean);
  let n = 0;
  for (const cena of cenas) {
    const mudar = cena.tokens
      .filter((t) => t.actorId === actor.id && (t.actorLink || semVersao(t.texture?.src) === antigo))
      .filter((t) => t.canUserModify(game.user, "update"))
      .map((t) => ({ _id: t.id, "texture.src": src }));
    if (!mudar.length) continue;
    try { await cena.updateEmbeddedDocuments("Token", mudar); n += mudar.length; }
    catch (err) { console.warn(`monolith-regras | retratos: tokens da cena ${cena.name}`, err); }
  }
  return n;
}

/**
 * Fluxo completo de quem pode enviar arquivos: sobe o token (e o retrato, se for o caso) e aplica.
 * @param origem  { tipo: "caminho", src } | { tipo: "blob", blob }  (para o modo de retrato "origem")
 * @param modoRetrato  "manter" | "token" | "origem"
 */
export async function salvarLocal(ctx, actor, tokenBlob, { origem = null, modoRetrato = "manter", todasCenas = false, estado = null } = {}) {
  const src = await enviar(ctx, actor, tokenBlob, "token");
  let retrato = null;
  if (modoRetrato === "token") retrato = src;
  else if (modoRetrato === "origem" && origem) {
    if (origem.tipo === "blob") retrato = await enviar(ctx, actor, origem.blob, "retrato");
    else if (origem.src && origem.src !== actor.img) retrato = origem.src;
  }
  const n = await aplicar(ctx, actor, src, { todasCenas, retrato, estado });
  return { src, retrato, tokens: n };
}

export const podeEnviar = () => game.user.can("FILES_UPLOAD");

/** Ícones genéricos que não contam como "retrato de verdade". */
export function imagemPadrao(src) {
  const s = semVersao(src);
  return !s || s === CONST.DEFAULT_TOKEN || s.startsWith("icons/svg/") || s.endsWith("mystery-man.svg");
}
