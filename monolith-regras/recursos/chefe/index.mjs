/**
 * Recurso "Barra de Chefe" (substitui bossbar 4.0.0 de theripper93, MIT; veja LICENSE-ORIGINAL.txt).
 * O Mestre marca tokens como chefes (HUD do token, controles da cena, macro/API). A lista fica na flag da cena
 * e todos os clientes desenham as barras a partir dela; o socket serve para reapresentar e mover a câmera.
 */
import { Palco } from "./barra.mjs";

export const PADROES = {
  caminhoPV: "attributes.hp.value",
  caminhoPVMax: "attributes.hp.max",
  caminhoPVTemp: "attributes.hp.temp",
  feridas: false,
  largura: 56,
  altura: 10,
  base: 96,
  numeros: false,
  dano: true,
  janelaDano: 3,
  entrada: true,
  rastro: true,
  sangue: true,
  limiarSangue: 25,
  tremor: true,
  limiarTremor: 15,
  fases: true,
  fasesPadrao: "50",
  abate: true,
  textoAbate: "Inimigo Abatido",
  abateNoFim: true,
  ocultarAbatido: true,
  respeitarOculto: true,
  somEntrada: "",
  somFase: "",
  somAbate: "",
  volume: 0.6
};

export const TEMAS = { sangue: "Sangue", vazio: "Vazio", gelo: "Gelo morto", peste: "Peste", icor: "Icor", cinza: "Cinzas" };

/** Estilos do Bossbar original para os temas daqui. */
const TEMA_DO_ESTILO = { default: "sangue", "default-ice": "gelo", "default-grass": "peste", "default-oak": "icor", evil: "vazio", ooze: "peste", royal: "icor", gears: "cinza", steampunk: "icor", segmented: "cinza" };

let C = null;          // ctx do recurso
let palco = null;
let cache = null;      // configuração lida
let demo = [];         // barras de teste (só neste cliente)
let atoresVistos = new Set();

/* ---------- Configuração ---------- */

export function cfg() {
  if (cache) return cache;
  const out = {};
  for (const k of Object.keys(PADROES)) out[k] = C.get(k);
  out.tocar = tocar;
  return (cache = out);
}

function tocar(src) {
  const AH = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
  AH?.play({ src, volume: Number(cfg().volume) || 0.6, autoplay: true, loop: false }, false);
}

export function lerFases(txt) {
  return String(txt ?? "").split(/[,;\s]+/).map(Number).filter((n) => n > 0 && n < 100).sort((a, b) => b - a);
}

/* ---------- Dados da cena ---------- */

export const lista = (scene) => foundry.utils.deepClone(C.getFlag(scene, "chefes") ?? []);
export const salvarLista = (scene, l) => C.setFlag(scene, "chefes", l);

export function novaEntrada(uuid, extra = {}) {
  return { id: foundry.utils.randomID(), uuid, nome: "", epiteto: "", fases: "", tema: "sangue", ocultarPV: false, ocultarNome: false, oculto: false, ...extra };
}

/** Token e ator de uma entrada (aceita uuid de token ou de ator, como o Bossbar guardava). */
export function resolver(e, scene) {
  let doc = null;
  try { doc = fromUuidSync(e.uuid, { strict: false }); } catch { doc = null; }
  if (!doc) return null;
  if (doc.documentName === "Token") return { token: doc, actor: doc.actor };
  if (doc.documentName === "Actor") {
    const token = doc.token ?? scene?.tokens.find((t) => t.actorId === doc.id) ?? null;
    return { token, actor: doc };
  }
  return null;
}

function lerPV(actor) {
  const c = cfg();
  const sys = actor?.system;
  if (!sys) return null;
  const get = foundry.utils.getProperty;
  let max = Number(get(sys, c.caminhoPVMax)) || 0;
  // dnd5e: o máximo efetivo já inclui o PV máximo temporário.
  if (c.caminhoPVMax === "attributes.hp.max" && Number.isFinite(sys.attributes?.hp?.effectiveMax)) max = sys.attributes.hp.effectiveMax;
  let pv = Number(get(sys, c.caminhoPV)) || 0;
  if (c.feridas) pv = max - pv;
  const temp = c.caminhoPVTemp ? Number(get(sys, c.caminhoPVTemp)) || 0 : 0;
  return { pv, max, temp };
}

/** O que este usuário deve ver na cena atual. */
function chefesVisiveis() {
  const scene = game.scenes?.viewed;
  atoresVistos = new Set();
  if (!scene || !C.get("exibir")) return [...demo];
  const c = cfg();
  const gm = game.user.isGM;
  const out = [];
  for (const e of lista(scene)) {
    const r = resolver(e, scene);
    if (!r?.actor) continue;
    const escondido = !!e.oculto || (c.respeitarOculto && !!r.token?.hidden);
    if (escondido && !gm) continue;
    atoresVistos.add(r.actor.uuid);
    const fases = e.fases === "-" ? [] : lerFases(e.fases || c.fasesPadrao);
    out.push({
      id: e.id,
      nome: e.nome || r.token?.name || r.actor.name,
      epiteto: e.epiteto || "",
      fases,
      tema: e.tema || "sangue",
      ocultarPV: !!e.ocultarPV && !gm,
      ocultarNome: !!e.ocultarNome,
      apagado: escondido,
      ler: () => lerPV(r.actor)
    });
  }
  return [...out, ...demo];
}

export function redesenhar({ animar = true } = {}) {
  if (!palco) return;
  palco.sincronizar(chefesVisiveis(), { animar });
}

/* ---------- Ações do Mestre ---------- */

function tokenDoc(alvo) {
  if (!alvo) return null;
  if (typeof alvo === "string") alvo = fromUuidSync(alvo);
  if (alvo.documentName === "Token") return alvo;
  if (alvo.document?.documentName === "Token") return alvo.document;
  if (alvo.documentName === "Actor") return alvo.token ?? alvo.getActiveTokens?.(false, true)?.[0] ?? null;
  return null;
}

function soMestre() {
  if (game.user.isGM) return true;
  ui.notifications.warn(C.t("soMestre"));
  return false;
}

export function entradaDe(token) {
  const t = tokenDoc(token);
  if (!t?.parent) return null;
  return lista(t.parent).find((e) => e.uuid === t.uuid || e.uuid === t.actor?.uuid) ?? null;
}

/** Marca (ou atualiza) um token como chefe na cena dele. */
export async function marcar(token, opcoes = {}) {
  if (!soMestre()) return null;
  const t = tokenDoc(token);
  if (!t?.parent) return null;
  const l = lista(t.parent);
  let e = l.find((x) => x.uuid === t.uuid || x.uuid === t.actor?.uuid);
  if (e) Object.assign(e, opcoes, { uuid: t.uuid });
  else l.push(e = novaEntrada(t.uuid, opcoes));
  await salvarLista(t.parent, l);
  return e;
}

export async function desmarcar(token) {
  if (!soMestre()) return;
  const t = tokenDoc(token);
  if (!t?.parent) return;
  const l = lista(t.parent);
  const nova = l.filter((x) => x.uuid !== t.uuid && x.uuid !== t.actor?.uuid);
  if (nova.length !== l.length) await salvarLista(t.parent, nova);
}

export async function alternar(token) {
  return entradaDe(token) ? desmarcar(token) : marcar(token);
}

export async function ocultar(token, valor) {
  const e = entradaDe(token);
  if (!e) return;
  return marcar(token, { oculto: valor ?? !e.oculto });
}

/** Repete a entrada das barras em todos os clientes. */
export function apresentar(id) {
  C.socket.emitir({ tipo: "revelar", cena: game.scenes.viewed?.id, id });
  palco?.revelar(id);
}

/** Leva a câmera de todos até o token. */
export function focar(token, escala = 1.6) {
  const t = tokenDoc(token);
  if (!t) return;
  const dados = { tipo: "camera", uuid: t.uuid, escala };
  C.socket.emitir(dados);
  aoReceber(dados);
}

function aoReceber(d) {
  if (d?.tipo === "revelar" && (!d.cena || d.cena === game.scenes.viewed?.id)) palco?.revelar(d.id);
  if (d?.tipo === "camera") {
    const t = fromUuidSync(d.uuid);
    if (!t?.object || t.parent !== canvas?.scene) return;
    canvas.animatePan({ ...t.object.center, scale: d.escala ?? 1.6, duration: 1000 });
  }
}

/** Sequência de teste só neste cliente: entrada, golpes, fase, sangue, cura, abate. */
export function testar() {
  if (!palco) return;
  const v = { pv: 1000, max: 1000, temp: 0 };
  demo = [{ id: "teste", nome: "Vessenhald, o Desfeito", epiteto: "Senhor das Cinzas", fases: lerFases(cfg().fasesPadrao), tema: "sangue", ler: () => ({ ...v }) }];
  redesenhar();
  const passo = (ms, fn) => setTimeout(() => { fn(); palco.atualizar(); }, ms);
  passo(2600, () => { v.pv = 880; });
  passo(2900, () => { v.pv = 830; });
  passo(4400, () => { v.pv = 460; });
  passo(6400, () => { v.temp = 60; });
  passo(7600, () => { v.pv = 620; });
  passo(9200, () => { v.temp = 0; v.pv = 190; });
  passo(11600, () => { v.pv = 0; });
  setTimeout(() => { demo = []; redesenhar(); }, 19000);
}

/* ---------- HUD do token ---------- */

function hudDoToken(hud, html) {
  if (!game.user.isGM) return;
  const el = html instanceof HTMLElement ? html : html?.[0];
  const col = el?.querySelector(".col.right") ?? el?.querySelector(".col.left");
  const doc = hud.document ?? hud.object?.document;
  if (!col || !doc) return;
  const ativo = !!entradaDe(doc);
  const b = document.createElement("button");
  b.type = "button";
  b.className = `control-icon monolith-chefe-hud${ativo ? " active" : ""}`;
  b.dataset.tooltip = C.t("hudDica");
  b.innerHTML = `<i class="fa-solid fa-skull"></i>`;
  b.addEventListener("click", async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const alvos = hud.object?.controlled ? canvas.tokens.controlled.map((t) => t.document) : [doc];
    const marcarTodos = !b.classList.contains("active");
    for (const t of alvos) await (marcarTodos ? marcar(t) : desmarcar(t));
    b.classList.toggle("active", marcarTodos);
  });
  b.addEventListener("contextmenu", async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const { editarChefe } = await import("./apps.mjs");
    editarChefe(C, doc);
  });
  col.append(b);
}

/* ---------- Definição ---------- */

export default {
  id: "chefe",
  nome: "Barra de Chefe",
  descricao: "Barra de vida de chefe no pé da tela, no estilo dos souls e no tom de Monolith: rastro de dano, fases, vinheta de sangue e a faixa de inimigo abatido.",
  original: ["bossbar"],
  padrao: true,

  iniciar(ctx) {
    C = ctx;
    for (const [k, v] of Object.entries(PADROES)) {
      ctx.registrar(k, {
        scope: "world", config: false, default: v,
        type: typeof v === "boolean" ? Boolean : typeof v === "number" ? Number : String,
        onChange: () => { cache = null; redesenhar({ animar: false }); }
      });
    }
    ctx.registrar("exibir", {
      name: "MONOLITH.chefe.exibir", hint: "MONOLITH.chefe.exibirDica",
      scope: "client", config: true, type: Boolean, default: true,
      onChange: () => redesenhar()
    });
    ctx.registrarMenu("janela", {
      name: "MONOLITH.chefe.menu", label: "MONOLITH.chefe.menuRotulo", hint: "MONOLITH.chefe.menuDica",
      icon: "fa-solid fa-skull", restricted: true,
      type: class extends foundry.applications.api.ApplicationV2 {
        render() { import("./apps.mjs").then((m) => m.abrirConfig(C)); return this; }
      }
    });

    ctx.socket.ouvir((d) => aoReceber(d));

    Hooks.on("canvasReady", () => redesenhar());
    Hooks.on("updateScene", (scene, mudou) => {
      if (scene === game.scenes.viewed && mudou.flags?.[ctx.ID] !== undefined) redesenhar();
    });
    const seAtor = (actor) => { if (actor && atoresVistos.has(actor.uuid)) redesenhar(); };
    Hooks.on("updateActor", (actor) => seAtor(actor));
    for (const h of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) Hooks.on(h, (ef) => seAtor(ef.target ?? ef.parent));
    Hooks.on("updateToken", (t) => { if (t.parent === game.scenes.viewed) redesenhar(); });
    Hooks.on("deleteToken", (t) => { if (t.parent === game.scenes.viewed) redesenhar(); });
    Hooks.on("renderTokenHUD", hudDoToken);
    Hooks.on("getSceneControlButtons", (controles) => {
      const tokens = controles.tokens ?? controles.token;
      if (!tokens?.tools) return;
      tokens.tools.monolithChefe = {
        name: "monolithChefe", title: "MONOLITH.chefe.controle", icon: "fa-solid fa-skull",
        order: Object.keys(tokens.tools).length, button: true, visible: game.user.isGM,
        onChange: () => import("./apps.mjs").then((m) => m.abrirChefes(C))
      };
    });

    Hooks.once("ready", () => {
      const api = { marcar, desmarcar, alternar, ocultar, apresentar, focar, testar, chefes: (s) => lista(s ?? game.scenes.viewed), entrada: entradaDe,
        configurar: () => import("./apps.mjs").then((m) => m.abrirConfig(C)), gerenciar: () => import("./apps.mjs").then((m) => m.abrirChefes(C)) };
      const mod = game.modules.get(ctx.ID);
      if (mod) mod.api = { ...(mod.api ?? {}), chefe: api };
      globalThis.MonolithChefe = api;
      palco = new Palco(cfg);
      try { redesenhar(); } catch (err) { console.error(`${ctx.ID} | chefe`, err); }
    });
  },

  configurar(ctx) {
    import("./apps.mjs").then((m) => m.abrirConfig(ctx));
  },

  async migrar(ctx) {
    C ??= ctx;
    // Configurações de mundo do Bossbar.
    const antigas = ctx.configsAntigas("bossbar");
    const mapa = { currentHpPath: "caminhoPV", maxHpPath: "caminhoPVMax", woundsSystem: "feridas" };
    for (const [velha, nova] of Object.entries(mapa)) {
      const v = antigas[velha];
      if (v === undefined || v === null || v === "") continue;
      if (ctx.get(nova) !== v) await ctx.set(nova, v);
    }
    const estilos = Array.isArray(antigas.barStyles) ? antigas.barStyles : [];
    const temaDe = (id) => {
      if (TEMA_DO_ESTILO[id]) return TEMA_DO_ESTILO[id];
      const nome = (estilos.find((s) => s.id === id)?.name ?? "").toLowerCase();
      if (/ice|gelo|frost/.test(nome)) return "gelo";
      if (/grass|poison|peste|ooze/.test(nome)) return "peste";
      if (/oak|gold|ouro/.test(nome)) return "icor";
      return "sangue";
    };

    // Flag da cena: flags.bossbar.actors = [{ uuid (do ator), style, hideName }].
    let n = 0;
    for (const scene of game.scenes) {
      const velhos = ctx.flagsAntigas(scene, "bossbar")?.actors;
      if (!Array.isArray(velhos) || !velhos.length) continue;
      const atual = foundry.utils.deepClone(ctx.getFlag(scene, "chefes") ?? []);
      for (const a of velhos) {
        if (!a?.uuid) continue;
        let uuid = a.uuid;
        // Ator sintético "Scene.X.Token.Y.Actor.Z" vira o token; ator do mundo vira o token dele nesta cena, se houver.
        const m = /^(Scene\.[^.]+\.Token\.[^.]+)\.Actor\./.exec(uuid);
        if (m) uuid = m[1];
        else if (/^Actor\.[^.]+$/.test(uuid)) {
          const t = scene.tokens.find((t) => t.actorLink && t.actorId === uuid.split(".")[1]);
          if (t) uuid = t.uuid;
        }
        if (atual.some((e) => e.uuid === uuid)) continue;
        atual.push(novaEntrada(uuid, { ocultarNome: !!a.hideName, tema: temaDe(a.style) }));
        n++;
      }
      await ctx.setFlag(scene, "chefes", atual);
    }
    if (n) console.log(`${ctx.ID} | chefe: ${n} chefe(s) trazido(s) do Bossbar`);
  }
};
