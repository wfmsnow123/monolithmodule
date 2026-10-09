/**
 * Janelas da Troca: "Dar a..." (escolher quem recebe, quantidade, moedas e recado) e o pedido recebido.
 * Substitui trade-window.js e item-window.js do Let's Trade 5e 0.6.0 (MIT, Charles Miller).
 */
import { S, esc, moedas, ehPilha, ehFisico, donos, donosOnline, montarOferta, enviar, oferta, decidir, podeDecidir, textoResumo } from "./nucleo.mjs";

const { DialogV2 } = foundry.applications.api;
const t = (k, d) => S.ctx.t(k, d);

/* ---------- Quem pode receber ---------- */

const tokenDe = (actor) => (actor?.isToken ? actor.token?.object : actor?.getActiveTokens?.()[0]) ?? null;

function distancia(a, b) {
  if (!a || !b || !canvas?.ready) return null;
  try {
    return canvas.grid.measurePath([a.center, b.center]).distance;
  } catch { return null; }
}

/** Personagens de jogadores (mais perto primeiro, se houver tokens na cena), sem o próprio ator. */
function candidatos(src, para) {
  const base = game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner && !ehPilha(a));
  const lista = new Map(base.map((a) => [a.uuid, a]));
  if (para) lista.set(para.uuid, para);
  lista.delete(src.uuid);
  if (!src.isToken) for (const [k, a] of lista) if (a.id === src.id && !a.isToken) lista.delete(k);
  const meu = tokenDe(src);
  const unidade = canvas?.scene?.grid?.units ?? "";
  return [...lista.values()].map((a) => {
    const d = distancia(meu, tokenDe(a));
    const ds = donos(a);
    return {
      a, d, online: donosOnline(a).length > 0,
      donos: ds.map((u) => u.name).join(", "),
      dist: d === null ? "" : `${Math.round(d * 10) / 10} ${unidade}`.trim()
    };
  }).sort((x, y) => (x.d ?? Infinity) - (y.d ?? Infinity) || x.a.name.localeCompare(y.a.name, game.i18n.lang));
}

/* ---------- Dar a... ---------- */

/**
 * Abre a janela de dar.
 * @param {{ator: Actor, item?: Item, para?: Actor}} opcoes
 */
export async function abrirDar({ ator: src, item = null, para = null } = {}) {
  if (!src?.isOwner) return;
  if (item && !ehFisico(item)) return;
  const cands = candidatos(src, para);
  if (!cands.length) return ui.notifications.warn(t("ninguem"));
  const total = item ? Number(item.system.quantity ?? 1) || 1 : 0;
  const recipiente = item?.type === "container" && (item.system.contents?.size ?? 0) > 0;
  const coins = moedas().map((m) => ({ ...m, tem: Math.max(0, Number(src.system.currency?.[m.k]) || 0) })).filter((m) => m.tem > 0);
  const escolhido = para?.uuid ?? (cands.length === 1 ? cands[0].a.uuid : null);

  const htmlItem = item ? `<section class="mt-oque">
    <img src="${esc(item.img)}" alt="">
    <div class="mt-oque-txt"><b>${esc(item.name)}</b>
      ${recipiente ? `<small>${esc(t("vaiComConteudo", { n: item.system.allContainedItems?.size ?? item.system.contents.size }))}</small>` : `<small>${esc(t("voceTem", { n: total }))}</small>`}
    </div>
    ${total > 1 && !recipiente ? `<div class="mt-passo">
      <button type="button" data-passo="-1" aria-label="${esc(t("menos"))}"><i class="fas fa-minus"></i></button>
      <input type="number" name="quantidade" value="1" min="1" max="${total}" step="1">
      <button type="button" data-passo="1" aria-label="${esc(t("mais"))}"><i class="fas fa-plus"></i></button>
      <button type="button" data-passo="tudo" class="mt-tudo">${esc(t("tudo"))}</button>
    </div>` : `<input type="hidden" name="quantidade" value="${total}">`}
  </section>` : "";

  const htmlMoedas = coins.length ? `<div class="mt-moedas">${coins.map((m) => `
      <label class="mt-moeda" data-tooltip="${esc(m.nome)}">
        ${m.icone ? `<img src="${esc(m.icone)}" alt="">` : `<i class="fas fa-coins"></i>`}
        <span class="mt-moeda-nome">${esc(m.abrev || m.nome)}</span>
        <input type="number" name="moeda.${m.k}" value="" placeholder="0" min="0" max="${m.tem}" step="1">
        <small>/ ${m.tem}</small>
      </label>`).join("")}</div>` : `<p class="hint">${esc(t("semMoedas"))}</p>`;

  const blocoMoedas = item
    ? (coins.length ? `<details class="mt-junto"><summary>${esc(t("juntarMoedas"))}</summary>${htmlMoedas}</details>` : "")
    : `<section><h3>${esc(t("moedas"))}</h3>${htmlMoedas}</section>`;

  const lista = cands.map((c) => `
    <li><label class="mt-cand ${c.a.uuid === escolhido ? "on" : ""}">
      <input type="radio" name="para" value="${esc(c.a.uuid)}" ${c.a.uuid === escolhido ? "checked" : ""}>
      <img src="${esc(c.a.img)}" alt="">
      <span class="mt-cand-txt"><b>${esc(c.a.name)}</b><small>${esc(c.donos || t("semDono"))}</small></span>
      ${c.dist ? `<span class="mt-dist">${esc(c.dist)}</span>` : ""}
      <span class="mt-online ${c.online ? "on" : ""}" data-tooltip="${esc(c.online ? t("online") : t("offline"))}"></span>
    </label></li>`).join("");

  const direto = game.user.isGM ? `<label class="mt-check"><input type="checkbox" name="direto" ${S.ctx.get("mestreDireto") ? "checked" : ""}> ${esc(t("direto"))}</label>` : "";

  const r = await DialogV2.wait({
    classes: ["mono", "monolith-troca"],
    window: { title: item ? t("tituloDarItem", { item: item.name }) : t("tituloDarMoedas"), icon: "fas fa-hand-holding" },
    position: { width: 440 },
    content: `<div class="mt-form">
      <div class="mt-de"><img src="${esc(src.img)}" alt=""><span>${esc(t("de"))} <b>${esc(src.name)}</b></span></div>
      ${htmlItem}${blocoMoedas}
      <section><h3>${esc(t("paraQuem"))}</h3><ul class="mt-lista">${lista}</ul></section>
      <label class="mt-recado">${esc(t("recado"))}<input type="text" name="nota" maxlength="300" placeholder="${esc(t("recadoDica"))}"></label>
      ${direto}
    </div>`,
    buttons: [
      {
        action: "dar", label: t("dar"), icon: "fas fa-hand-holding", default: true,
        callback: (ev, btn) => {
          const f = btn.form;
          const m = {};
          for (const el of f.querySelectorAll("[name^='moeda.']")) m[el.name.slice(6)] = Math.min(Number(el.max) || 0, Math.max(0, Math.floor(Number(el.value) || 0)));
          return {
            para: f.querySelector("[name=para]:checked")?.value ?? null,
            quantidade: Math.min(total, Math.max(1, Math.floor(Number(f.elements.quantidade?.value) || 1))),
            moedas: m, nota: f.elements.nota?.value ?? "", direto: !!f.elements.direto?.checked
          };
        }
      },
      { action: "cancelar", label: t("cancelar"), icon: "fas fa-xmark" }
    ],
    render: (ev, dialog) => {
      const el = dialog?.element ?? dialog;
      const botao = el.querySelector("button[data-action=dar]");
      const q = el.querySelector("[name=quantidade][type=number]");
      const conferir = () => {
        const temPara = !!el.querySelector("[name=para]:checked");
        const temMoeda = [...el.querySelectorAll("[name^='moeda.']")].some((i) => Number(i.value) > 0);
        if (botao) botao.disabled = !temPara || (!item && !temMoeda);
      };
      el.querySelectorAll("[data-passo]").forEach((b) => b.addEventListener("click", () => {
        if (!q) return;
        const v = b.dataset.passo === "tudo" ? total : (Number(q.value) || 1) + Number(b.dataset.passo);
        q.value = Math.min(total, Math.max(1, v));
      }));
      q?.addEventListener("change", () => { q.value = Math.min(total, Math.max(1, Math.floor(Number(q.value) || 1))); });
      el.querySelectorAll("[name^='moeda.']").forEach((i) => i.addEventListener("input", () => {
        if (Number(i.value) > Number(i.max)) i.value = i.max;
        if (Number(i.value) < 0) i.value = 0;
        conferir();
      }));
      el.querySelectorAll("[name=para]").forEach((r) => r.addEventListener("change", () => {
        el.querySelectorAll(".mt-cand").forEach((l) => l.classList.toggle("on", l.contains(r) && r.checked));
        conferir();
      }));
      conferir();
    },
    rejectClose: false
  }).catch(() => null);

  if (!r || r === "cancelar" || typeof r !== "object" || !r.para) return;
  const dst = fromUuidSync(r.para);
  if (!dst) return;
  const o = montarOferta({ src, dst, item, quantidade: r.quantidade, moedas: r.moedas, nota: r.nota });
  if (!o.item && !Object.keys(o.moedas).length) return ui.notifications.warn(t("erro.vazio"));
  if (game.user.isGM) await S.ctx.set("mestreDireto", r.direto);
  return enviar(o, { direto: r.direto });
}

/* ---------- Pedido recebido ---------- */

const abertos = new Set();

/** Janela com o pedido, para quem recebe (o cartão do chat tem os mesmos botões). */
export async function abrirPedido(msg) {
  const o = oferta(msg);
  if (!o || o.estado !== "pendente" || !podeDecidir(o) || abertos.has(msg.id)) return;
  abertos.add(msg.id);
  try {
    const r = await DialogV2.wait({
      classes: ["mono", "monolith-troca", "mt-pedido"],
      window: { title: t("tituloPedido"), icon: "fas fa-hand-holding" },
      position: { width: 400 },
      content: `<div class="mt-form">
        <p class="mt-frase">${esc(t("frasePedido", { de: o.de.nome, para: o.para.nome }))}</p>
        <div class="mt-presente"><span>${esc(textoResumo(o))}</span></div>
        ${o.item ? `<div class="mt-oque"><img src="${esc(o.item.img)}" alt=""><div class="mt-oque-txt"><b>${esc(o.item.nome)}</b>${o.item.quantidade > 1 ? `<small>× ${o.item.quantidade}</small>` : ""}</div></div>` : ""}
        ${o.nota ? `<blockquote class="mt-nota">${esc(o.nota)}</blockquote>` : ""}
      </div>`,
      buttons: [
        { action: "aceitar", label: t("aceitar"), icon: "fas fa-check", default: true },
        { action: "recusar", label: t("recusar"), icon: "fas fa-xmark" },
        { action: "depois", label: t("depois"), icon: "fas fa-clock" }
      ],
      render: (ev, dialog) => { const el = dialog?.element ?? dialog; if (el?.dataset) el.dataset.mtMsg = msg.id; },
      rejectClose: false
    }).catch(() => null);
    if (r === "aceitar" || r === "recusar") await decidir(game.messages.get(msg.id) ?? msg, r);
  } finally {
    abertos.delete(msg.id);
  }
}

/** Fecha a janela de pedido se a oferta foi resolvida por outra pessoa. */
export function fecharPedidoResolvido(msg) {
  const o = oferta(msg);
  if (!o || o.estado === "pendente") return;
  for (const app of foundry.applications.instances.values()) {
    if (app.options?.classes?.includes("mt-pedido") && app.element?.dataset?.mtMsg === msg.id) app.close();
  }
}
