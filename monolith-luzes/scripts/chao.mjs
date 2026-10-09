/*
 * Luzes no mapa.
 * Um objeto de luz solto no chão é um Tile com a imagem do item (todos veem) e uma AmbientLight ligada a ele.
 * O estado do objeto (item, aceso, tempo, coberta) mora na flag do Tile. "Carregar junto" passa esse estado
 * para a flag do token: a luz vira luz do token (anda com a animação do próprio token, sem atraso) e um ícone
 * pequeno aparece no canto do token. Largar devolve o Tile ao chão.
 * Jogadores não criam Tiles nem luzes: as operações vão para o GM ativo pelo socket.
 */
import { ID, esc, fonteDe, ehObjeto, podeAcender, cfg } from "./config.mjs";
import { aceso, coberta, restante, carregadas, abastecer, aviso, luzDaFonte, temCobertura, textoFim, tempoTexto } from "./luz.mjs";
import { aoAlcance, passarTempo, pontoNoRetangulo } from "./calculo.mjs";

const CANAL = `module.${ID}`;
const TAM = 0.5; // lado do ícone no chão, em quadrados
const IMG_PADRAO = "icons/sundries/lights/torch-brown.webp";

/* ---------- Estado ---------- */

export const estado = (tile) => tile?.flags?.[ID]?.colocada ?? null;

/** Estado de um item que sai do inventário (uma unidade). */
export function estadoDoItem(item) {
  const data = item.toObject();
  delete data._id;
  if (data.system && "quantity" in data.system) data.system.quantity = 1;
  for (const k of ["aceso", "restante", "coberta"]) delete data.flags?.[ID]?.[k];
  return { chave: foundry.utils.randomID(), item: data, aceso: aceso(item), restante: restante(item), coberta: coberta(item), origem: item.actor?.uuid ?? null };
}

function dadosDoItem(e) {
  const d = foundry.utils.deepClone(e.item);
  d.flags ??= {};
  d.flags[ID] = { ...(d.flags[ID] ?? {}), aceso: !!e.aceso, restante: Number(e.restante) || 0, coberta: !!e.coberta };
  return d;
}

/** Devolve ao inventário; uma tocha nova e apagada junta na pilha igual. */
async function guardarNoInventario(actor, e) {
  const d = dadosDoItem(e);
  const novo = !e.aceso && !(e.restante > 0);
  const pilha = novo && actor.items.find((i) => i.name === d.name && i.type === d.type && fonteDe(i) && !aceso(i) && !(restante(i) > 0));
  if (pilha) await pilha.update({ "system.quantity": (pilha.system.quantity ?? 0) + 1 });
  else await actor.createEmbeddedDocuments("Item", [d]);
}

const origemDe = (e) => { try { return e?.origem ? fromUuidSync(e.origem) : null; } catch { return null; } };

/* ---------- Geometria ---------- */

const retTile = (t) => ({ x: t.x, y: t.y, w: t.width, h: t.height });
const retToken = (t) => { const s = t.parent.grid.size; return { x: t.x, y: t.y, w: t.width * s, h: t.height * s }; };
export const alcanca = (token, tile) => aoAlcance(retToken(token), retTile(tile), token.parent.grid.size, 1);
/** O ponto está a até um quadrado (5 ft) da borda do token? */
const pertoDoPonto = (token, p) => aoAlcance(retToken(token), { x: p.x, y: p.y, w: 0, h: 0 }, token.parent.grid.size, 1);

/** Objetos no chão a um quadrado do token. */
export function colocadasPerto(token) {
  return (token?.parent?.tiles ?? []).filter((t) => estado(t) && (!t.hidden || game.user.isGM) && alcanca(token, t));
}

/* ---------- Pedidos ao GM ---------- */

export function pedir(acao, dados) {
  if (game.user.isGM) return executar(acao, dados, game.user);
  if (!game.users.activeGM) return ui.notifications.warn("Nenhum Mestre online: só o Mestre mexe em objetos no mapa.");
  game.socket.emit(CANAL, { acao, dados, userId: game.user.id });
}

function responder(user, texto) {
  if (!texto) return;
  if (user.isSelf) ui.notifications.warn(texto);
  else game.socket.emit(CANAL, { acao: "aviso", userId: user.id, texto });
}

async function executar(acao, dados, user) {
  try {
    responder(user, await OPS[acao]?.(dados ?? {}, user));
  } catch (err) {
    console.error(`${ID} |`, err);
    responder(user, "Não deu para mexer no objeto de luz (veja o console).");
  }
}

export function registrarSocket() {
  game.socket.on(CANAL, (msg) => {
    if (msg?.acao === "aviso") { if (msg.userId === game.user.id) ui.notifications.warn(msg.texto); return; }
    if (!game.users.activeGM?.isSelf || !OPS[msg?.acao]) return;
    const user = game.users.get(msg.userId);
    if (user) executar(msg.acao, msg.dados, user);
  });
}

function achar({ sceneId, tileId, tokenId }) {
  const scene = game.scenes.get(sceneId);
  return { scene, tile: scene?.tiles.get(tileId), token: tokenId ? scene?.tokens.get(tokenId) : null };
}

/** O token pode mexer no objeto: é de quem pediu e (para jogador) está a um quadrado. */
function conferir(token, tile, user) {
  if (!token) return "Selecione o token que vai pegar o objeto.";
  if (!token.testUserPermission(user, "OWNER")) return "Esse token não é seu.";
  if (!user.isGM && tile && !alcanca(token, tile)) return "Longe demais: chegue a um quadrado do objeto.";
  return null;
}

async function criarTile(scene, e, cx, cy) {
  const tam = Math.round(scene.grid.size * TAM);
  const [tile] = await scene.createEmbeddedDocuments("Tile", [{
    texture: { src: e.item?.img || IMG_PADRAO },
    x: Math.round(cx - tam / 2), y: Math.round(cy - tam / 2), width: tam, height: tam,
    flags: { [ID]: { colocada: { ...e, chave: e.chave || foundry.utils.randomID() } } }
  }]);
  return tile;
}

/** Canto de baixo à direita do token: o objeto fica ao lado, à vista. */
const cantoDo = (token) => { const r = retToken(token); return { x: r.x + r.w, y: r.y + r.h }; };

const OPS = {
  /** Item da ficha solto no mapa. */
  async colocar({ itemUuid, sceneId, tokenId, x, y }, user) {
    const item = await fromUuid(itemUuid);
    const scene = game.scenes.get(sceneId);
    if (!item?.actor || !scene || !ehObjeto(item) || !fonteDe(item)) return;
    if (!item.testUserPermission(user, "OWNER")) return "Esse item não é seu.";
    if (!user.isGM) {
      const token = tokenId ? scene.tokens.get(tokenId) : null;
      if (!token || token.actor?.id !== item.actor.id) return "Largue a luz perto do token do personagem.";
      if (!pertoDoPonto(token, { x, y })) return "Longe demais: solte a até um quadrado (5 ft) do seu token.";
    }
    if (!((item.system.quantity ?? 0) > 0)) return `${item.name}: não sobrou nenhum.`;
    await criarTile(scene, estadoDoItem(item), x, y);
    const q = item.system.quantity - 1;
    // A unidade acesa é a que foi para o chão; a pilha que fica está apagada e inteira.
    if (q <= 0) await item.delete();
    else await item.update({ "system.quantity": q, [`flags.${ID}.aceso`]: false, [`flags.${ID}.restante`]: 0, [`flags.${ID}.coberta`]: false });
  },

  async alternar(dados, user) {
    const { tile, token } = achar(dados);
    const e = estado(tile);
    if (!e) return;
    if (!podeAcender(user)) return "Só o Mestre acende e apaga as luzes.";
    if (!user.isGM) { const erro = conferir(token, tile, user); if (erro) return erro; }
    if (e.aceso) return tile.update({ [`flags.${ID}.colocada.aceso`]: false });
    const f = fonteDe(e.item);
    if (!f) return `${e.item?.name}: não é mais uma fonte de luz.`;
    const r = await abastecer(f, Number(e.restante) || 0, token?.actor ?? null, user, e.item.name);
    if (r.erro) return r.erro;
    await tile.update({ [`flags.${ID}.colocada.aceso`]: true, [`flags.${ID}.colocada.restante`]: r.restante });
  },

  async cobrir(dados, user) {
    const { tile, token } = achar(dados);
    const e = estado(tile);
    if (!e || !temCobertura(fonteDe(e.item))) return;
    if (!podeAcender(user)) return "Só o Mestre acende e apaga as luzes.";
    if (!user.isGM) { const erro = conferir(token, tile, user); if (erro) return erro; }
    await tile.update({ [`flags.${ID}.colocada.coberta`]: !e.coberta });
  },

  /** Do chão para o inventário de quem pegou, com tudo (acesa, tempo, coberta). */
  async pegar(dados, user) {
    const { tile, token } = achar(dados);
    const e = estado(tile);
    if (!e) return;
    const erro = conferir(token, tile, user);
    if (erro) return erro;
    if (!token.actor) return "Esse token não tem ficha.";
    // Aceso não vai para o inventário: fica na mão (carregado junto).
    if (e.aceso) return OPS.carregar(dados, user);
    await guardarNoInventario(token.actor, e);
    await tile.delete();
  },

  /** Liga o objeto ao token: ele vai junto e a luz anda com o token. */
  async carregar(dados, user) {
    const { tile, token } = achar(dados);
    const e = estado(tile);
    if (!e) return;
    const erro = conferir(token, tile, user);
    if (erro) return erro;
    await token.update({ [`flags.${ID}.carregadas`]: [...carregadas(token), { ...e, chave: e.chave || foundry.utils.randomID() }] });
    await tile.delete();
  },

  /** Solta no chão, ao lado do token, um objeto que ele carregava junto. */
  async largar({ sceneId, tokenId, chave }, user) {
    const { scene, token } = achar({ sceneId, tokenId });
    const e = carregadas(token).find((x) => x.chave === chave);
    if (!e) return;
    const erro = conferir(token, null, user);
    if (erro) return erro;
    const p = cantoDo(token);
    await criarTile(scene, e, p.x, p.y);
    await token.update({ [`flags.${ID}.carregadas`]: carregadas(token).filter((x) => x.chave !== chave) });
  }
};

/* ---------- Objetos que o token carrega junto (o dono do token resolve sozinho) ---------- */

async function mudarCarregada(token, chave, fn) {
  const l = carregadas(token).map((e) => ({ ...e }));
  const e = l.find((x) => x.chave === chave);
  if (!e || (await fn(e)) === false) return;
  await token.update({ [`flags.${ID}.carregadas`]: l });
}

export function alternarCarregada(token, chave) {
  if (!podeAcender()) return ui.notifications.warn("Só o Mestre acende e apaga as luzes.");
  return mudarCarregada(token, chave, async (e) => {
    if (e.aceso) { e.aceso = false; return; }
    const f = fonteDe(e.item);
    if (!f) return false;
    const r = await abastecer(f, Number(e.restante) || 0, token.actor, game.user, e.item.name);
    if (r.erro) { ui.notifications.warn(r.erro); return false; }
    e.aceso = true;
    e.restante = r.restante;
  });
}

export function cobrirCarregada(token, chave) {
  if (!podeAcender()) return;
  return mudarCarregada(token, chave, (e) => { e.coberta = !e.coberta; });
}

/** Do token para o inventário do próprio token. */
export async function guardarCarregada(token, chave) {
  const e = carregadas(token).find((x) => x.chave === chave);
  if (!e || !token.actor) return;
  // Nada fica aceso no inventário: guardar apaga a chama (o tempo que sobrou fica).
  await guardarNoInventario(token.actor, { ...e, aceso: false });
  await token.update({ [`flags.${ID}.carregadas`]: carregadas(token).filter((x) => x.chave !== chave) });
}

/** Token do ator na cena atual: o selecionado, ou o primeiro. */
export function tokenDaMao(actor) {
  if (!actor || !canvas?.scene) return null;
  return canvas.tokens.controlled.find((t) => t.actor === actor)?.document ?? actor.getActiveTokens(false, true)[0] ?? null;
}

/** Acender um objeto do inventário: uma unidade vai acesa para a mão do token (nada fica aceso no inventário). */
export async function acenderNaMao(token, item, user = game.user) {
  const f = fonteDe(item);
  if (!f) return;
  const e = estadoDoItem(item);
  const r = await abastecer(f, Number(e.restante) || 0, item.actor, user, item.name);
  if (r.erro) return ui.notifications.warn(r.erro);
  e.aceso = true;
  e.restante = r.restante;
  await token.update({ [`flags.${ID}.carregadas`]: [...carregadas(token), e] });
  const q = (item.system.quantity ?? 1) - 1;
  if (q <= 0) await item.delete();
  else await item.update({ "system.quantity": q, [`flags.${ID}.aceso`]: false, [`flags.${ID}.restante`]: 0, [`flags.${ID}.coberta`]: false });
}

export const largarCarregada = (token, chave) => pedir("largar", { sceneId: token.parent.id, tokenId: token.id, chave });

/* ---------- Luz do objeto no chão (GM) ---------- */

/** Cria ou acerta a AmbientLight do Tile. */
export async function sincronizarLuzDoTile(tile) {
  const e = estado(tile);
  const scene = tile?.parent;
  if (!e || !scene) return;
  const f = fonteDe(e.item);
  const id = tile.getFlag(ID, "luz");
  let luz = id ? scene.lights.get(id) : null;
  // Tile copiado e colado leva a flag junto: cada um precisa da sua luz.
  if (luz && luz.getFlag(ID, "tile") !== tile.id) luz = null;
  const dados = {
    x: Math.round(tile.x + tile.width / 2), y: Math.round(tile.y + tile.height / 2),
    rotation: tile.rotation ?? 0, elevation: tile.elevation ?? 0,
    hidden: !(e.aceso && f), walls: true, vision: false
  };
  if (f) dados.config = luzDaFonte(f, e.coberta, scene);
  if (!luz) {
    const [nova] = await scene.createEmbeddedDocuments("AmbientLight", [{ ...dados, flags: { [ID]: { tile: tile.id } } }]);
    await tile.update({ [`flags.${ID}.luz`]: nova.id });
    return;
  }
  const diff = foundry.utils.diffObject(luz._source, dados);
  if (!foundry.utils.isEmpty(diff)) await luz.update(dados);
}

/** Desconta o tempo dos objetos no chão e dos que os tokens carregam junto. Roda só no GM ativo. */
export async function queimarNoChao(delta) {
  if (!(delta > 0) || !game.settings.get(ID, "queimar")) return;
  for (const scene of game.scenes) {
    for (const tile of scene.tiles) {
      const e = estado(tile);
      const f = e?.aceso && fonteDe(e.item);
      if (!(f?.duracao > 0)) continue;
      const t = passarTempo(Number(e.restante) || 0, f.duracao, delta);
      const dono = origemDe(e);
      if (!t.acabou) {
        await tile.update({ [`flags.${ID}.colocada.restante`]: t.depois });
        if (t.fraca) aviso(dono, `A chama de ${esc(e.item.name)} (no chão) está fraca: uns ${tempoTexto(t.depois)}.`, "fa-fire-flame-simple");
        continue;
      }
      if (f.consumo === "item") await tile.delete();
      else await tile.update({ [`flags.${ID}.colocada`]: { aceso: false, restante: 0, coberta: false } });
      aviso(dono, ...textoFim(f, e.item.name, "no chão"));
    }
    for (const token of scene.tokens) {
      const l = carregadas(token);
      if (!l.some((e) => e.aceso)) continue;
      const nova = [];
      const fins = [];
      for (const e of l) {
        const f = e.aceso && fonteDe(e.item);
        if (!(f?.duracao > 0)) { nova.push(e); continue; }
        const t = passarTempo(Number(e.restante) || 0, f.duracao, delta);
        if (!t.acabou) {
          nova.push({ ...e, restante: t.depois });
          if (t.fraca) aviso(token.actor, `A chama de ${esc(e.item.name)} (${esc(token.name)}) está fraca: uns ${tempoTexto(t.depois)}.`, "fa-fire-flame-simple");
          continue;
        }
        if (f.consumo !== "item") nova.push({ ...e, aceso: false, restante: 0, coberta: false });
        fins.push(textoFim(f, e.item.name, token.name));
      }
      await token.update({ [`flags.${ID}.carregadas`]: nova });
      for (const m of fins) aviso(token.actor, ...m);
    }
  }
}

/* ---------- Arrastar da ficha para o mapa ---------- */

/**
 * dropCanvasData: item de luz solto no mapa vira objeto no chão.
 * Em cima de outro token (pilha do Item Piles, entregar a alguém) segue o fluxo normal; em cima do próprio
 * token, o objeto vai para o lado dele. Jogador solta a até um quadrado (5 ft) do seu token; o Mestre, onde quiser.
 */
function aoSoltar(cv, data, event) {
  if (data?.type !== "Item" || !data.uuid || !cfg("colocarNoMapa") || event?.shiftKey) return;
  let item;
  try { item = fromUuidSync(data.uuid); } catch { return; }
  if (!(item instanceof Item) || !item.actor || !item.isOwner || !ehObjeto(item) || !fonteDe(item)) return;
  if (!((item.system.quantity ?? 0) > 0)) return;
  let p = { x: data.x, y: data.y };
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) p = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
  const meus = item.actor.getActiveTokens();
  const embaixo = canvas.tokens.placeables.filter((t) => t.visible && t.bounds?.contains(p.x, p.y));
  if (embaixo.some((t) => !meus.includes(t))) return;
  const dono = embaixo[0] ?? canvas.tokens.controlled.find((t) => meus.includes(t)) ?? meus[0];
  if (embaixo.length) p = cantoDo(dono.document);
  if (!game.user.isGM) {
    if (!dono) { ui.notifications.warn("Ponha o token do personagem na cena para largar a luz no chão."); return false; }
    if (!pertoDoPonto(dono.document, p)) { ui.notifications.warn("Longe demais: solte a até um quadrado (5 ft) do seu token. Com Shift, o Item Piles cuida do item."); return false; }
  }
  pedir("colocar", { itemUuid: item.uuid, sceneId: canvas.scene.id, tokenId: dono?.id, x: Math.round(p.x), y: Math.round(p.y) });
  return false;
}

/** Do inventário para o chão, ao lado do token (botão no HUD). */
export function largarDoInventario(token, item) {
  const p = cantoDo(token);
  return pedir("colocar", { itemUuid: item.uuid, sceneId: token.parent.id, tokenId: token.id, x: Math.round(p.x), y: Math.round(p.y) });
}

/** Põe o nosso dropCanvasData antes dos outros (Item Piles cria pilha e devolve false). */
export function registrarSoltar() {
  const id = Hooks.on("dropCanvasData", aoSoltar);
  const l = Hooks.events?.dropCanvasData;
  if (!Array.isArray(l)) return;
  const i = l.findIndex((h) => h.id === id || h.fn === aoSoltar);
  if (i > 0) l.unshift(...l.splice(i, 1));
}

/* ---------- Clicar no objeto no mapa ---------- */

let paleta = null;

function fecharPaleta() {
  paleta?.remove();
  paleta = null;
}

function tileNoPonto(p) {
  const tiles = (canvas.scene?.tiles.contents ?? []).filter((t) => estado(t) && (!t.hidden || game.user.isGM) && t.object?.visible !== false);
  tiles.sort((a, b) => (b.elevation - a.elevation) || (b.sort - a.sort));
  return tiles.find((t) => pontoNoRetangulo(p, retTile(t), 4)) ?? null;
}

/** Token que vai mexer no objeto: o selecionado mais perto ao alcance; o GM usa o selecionado esteja onde estiver. */
function tokenPara(tile) {
  const cena = canvas.scene;
  let tokens = canvas.tokens.controlled.map((t) => t.document).filter((t) => t.isOwner);
  if (game.user.isGM) return tokens[0] ?? null;
  if (!tokens.length) tokens = cena.tokens.filter((t) => t.isOwner && !t.hidden);
  const c = { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
  const dist = (t) => Math.hypot(t.x + (t.width * cena.grid.size) / 2 - c.x, t.y + (t.height * cena.grid.size) / 2 - c.y);
  return tokens.filter((t) => alcanca(t, tile)).sort((a, b) => dist(a) - dist(b))[0] ?? null;
}

function abrirPaleta(tile, cx, cy) {
  fecharPaleta();
  const e = estado(tile);
  const f = fonteDe(e.item);
  const token = tokenPara(tile);
  const longe = !game.user.isGM && !token;
  const bt = (acao, rotulo, icone) => `<button type="button" data-acao="${acao}"><i class="fas ${icone}"></i> ${rotulo}</button>`;
  const botoes = [];
  if (!longe && podeAcender() && f) botoes.push(e.aceso ? bt("alternar", "Apagar", "fa-fire-flame-simple") : bt("alternar", "Acender", "fa-fire"));
  if (!longe && podeAcender() && e.aceso && temCobertura(f)) botoes.push(bt("cobrir", e.coberta ? "Descobrir" : "Cobrir", e.coberta ? "fa-eye" : "fa-eye-slash"));
  if (token) botoes.push(bt("pegar", "Pegar", "fa-hand"), bt("carregar", "Carregar junto", "fa-link"));
  // Mestre: mover pela camada de Tiles (arrastar, girar, Delete) ou apagar direto.
  if (game.user.isGM) botoes.push(bt("mover", "Mover", "fa-up-down-left-right"), bt("remover", "Apagar", "fa-trash"));
  const tempo = e.aceso ? tempoTexto(e.restante) : "";
  let nota = "";
  if (longe) nota = "Longe demais: chegue a um quadrado do objeto.";
  else if (game.user.isGM && !token) nota = "Selecione um token para pegar ou carregar junto.";
  else if (token) nota = `Com ${esc(token.name)}.`;

  const el = document.createElement("div");
  el.id = "monolith-luz-chao";
  el.className = e.aceso ? "aceso" : "";
  el.innerHTML = `<header><img src="${esc(e.item?.img || IMG_PADRAO)}" alt=""><span class="nome">${esc(e.item?.name)}</span>${tempo ? `<span class="tempo">${tempo}</span>` : ""}</header>
    ${botoes.length ? `<div class="acoes">${botoes.join("")}</div>` : ""}${nota ? `<p class="nota">${nota}</p>` : ""}`;
  document.body.append(el);
  const r = el.getBoundingClientRect();
  el.style.left = `${Math.min(cx + 12, window.innerWidth - r.width - 8)}px`;
  el.style.top = `${Math.min(cy + 12, window.innerHeight - r.height - 8)}px`;
  el.addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-acao]");
    if (!b) return;
    ev.preventDefault();
    fecharPaleta();
    if (b.dataset.acao === "mover") { canvas.tiles.activate(); return tile.object?.control({ releaseOthers: true }); }
    if (b.dataset.acao === "remover") return tile.delete();
    pedir(b.dataset.acao, { sceneId: tile.parent.id, tileId: tile.id, tokenId: token?.id ?? null });
  });
  paleta = el;
}

function aoApertar(ev) {
  if (paleta && !paleta.contains(ev.target)) fecharPaleta();
  if (ev.button !== 0 || !canvas?.ready || ev.target !== (canvas.app?.view ?? canvas.app?.canvas)) return;
  // O GM na camada de tiles ou de luzes mexe no Tile como sempre.
  if (game.user.isGM && (canvas.tiles?.active || canvas.lighting?.active)) return;
  const p = canvas.canvasCoordinatesFromClient({ x: ev.clientX, y: ev.clientY });
  const tile = tileNoPonto(p);
  if (!tile) return;
  // Token do próprio jogador em cima do objeto: o clique é para o token.
  if (canvas.tokens.placeables.some((t) => t.isOwner && t.visible && t.bounds?.contains(p.x, p.y))) return;
  ev.stopPropagation();
  ev.preventDefault();
  abrirPaleta(tile, ev.clientX, ev.clientY);
}

/* ---------- Ícone no token que carrega algo junto ---------- */

const SIMB = Symbol("monolithLuzes");
const carregarTextura = (src) => (foundry.canvas?.loadTexture ?? globalThis.loadTexture)?.(src).catch?.(() => null) ?? Promise.resolve(null);

export function atualizarIcones(token) {
  if (!token || token.destroyed) return;
  const l = carregadas(token.document);
  let c = token[SIMB];
  if (!l.length) {
    if (c && !c.destroyed) c.destroy({ children: true });
    token[SIMB] = null;
    return;
  }
  if (!c || c.destroyed) {
    c = token[SIMB] = token.addChild(new PIXI.Container());
    c.eventMode = "none";
  }
  const lado = Math.max(16, Math.min(token.w, token.h) * 0.36);
  c.position.set(token.w - lado * 0.8, token.h - lado * 0.8);
  const chave = `${lado}|${l.map((e) => `${e.item?.img}:${e.aceso ? 1 : 0}`).join(";")}`;
  if (c.chave === chave) return;
  c.chave = chave;
  montarIcones(c, l, lado, chave);
}

async function montarIcones(c, l, lado, chave) {
  const texturas = await Promise.all(l.map((e) => carregarTextura(e.item?.img || IMG_PADRAO)));
  if (c.destroyed || c.chave !== chave) return;
  for (const filho of c.removeChildren()) filho.destroy();
  l.forEach((e, i) => {
    const cx = -i * lado * 0.85 + lado / 2, cy = lado / 2;
    const g = new PIXI.Graphics();
    g.lineStyle(2, e.aceso ? 0xffb15e : 0x636b7e, 1).beginFill(0x0e1016, 0.9).drawCircle(cx, cy, lado / 2).endFill();
    c.addChild(g);
    const tex = texturas[i];
    if (!tex) return;
    const s = new PIXI.Sprite(tex);
    s.anchor.set(0.5);
    s.width = s.height = lado * 0.72;
    s.position.set(cx, cy);
    c.addChild(s);
  });
}

/* ---------- Ganchos ---------- */

const souGM = () => !!game.users.activeGM?.isSelf;
const erro = (err) => console.error(`${ID} |`, err);

export function registrarChao() {
  window.addEventListener("pointerdown", aoApertar, { capture: true });
  window.addEventListener("keydown", (ev) => { if (ev.key === "Escape") fecharPaleta(); });
  Hooks.on("canvasPan", fecharPaleta);
  Hooks.on("canvasTearDown", fecharPaleta);

  // Ícone no token.
  Hooks.on("drawToken", (t) => atualizarIcones(t));
  Hooks.on("refreshToken", (t) => atualizarIcones(t));
  Hooks.on("updateToken", (doc, changes) => {
    if (foundry.utils.hasProperty(changes, `flags.${ID}`) && doc.object) atualizarIcones(doc.object);
  });

  // Luz do Tile (só o GM ativo).
  Hooks.on("createTile", (tile) => { if (souGM() && estado(tile)) sincronizarLuzDoTile(tile).catch(erro); });
  Hooks.on("updateTile", (tile, changes) => {
    if (!souGM() || !estado(tile)) return;
    if (["x", "y", "width", "height", "rotation", "elevation", "flags"].some((k) => k in changes)) sincronizarLuzDoTile(tile).catch(erro);
  });
  Hooks.on("deleteTile", (tile) => {
    if (!souGM()) return;
    const id = tile.getFlag(ID, "luz");
    const luz = id ? tile.parent?.lights.get(id) : null;
    if (luz?.getFlag(ID, "tile") === tile.id) luz.delete().catch(erro);
  });
  // O token sumiu: o que ele carregava junto fica no chão.
  Hooks.on("deleteToken", (token) => {
    if (!souGM() || !token.parent) return;
    const p = cantoDo(token);
    for (const e of carregadas(token)) criarTile(token.parent, e, p.x, p.y).catch(erro);
  });
}
