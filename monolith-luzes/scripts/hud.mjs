import { ID, esc, fonteDe, ehObjeto, podeAcender, podeAvulsa, cfg } from "./config.mjs";
import { itensDeLuz, aceso, coberta, restante, tempoTexto, alternar, alternarCobertura, carregadas, temCobertura } from "./luz.mjs";
import { estado, colocadasPerto, pedir, alternarCarregada, cobrirCarregada, guardarCarregada, largarCarregada, largarDoInventario } from "./chao.mjs";

/**
 * Botão de chama no HUD do token. Lista o que o personagem carrega, o que o token leva junto
 * e os objetos de luz no chão a um quadrado. Uma só coisa para acender, sem mais opções: alterna direto.
 * Tochas e lanternas do inventário podem ser largadas no chão, ao lado do token, mesmo por quem não acende.
 */
export function registrarHud() {
  Hooks.on("renderTokenHUD", (hud, html) => {
    if (!cfg("botaoHud")) return;
    const root = html instanceof HTMLElement ? html : html[0];
    const token = hud.document ?? hud.object?.document;
    const actor = token?.actor;
    if (!token?.isOwner) return;
    const acende = podeAcender();
    const linhas = [];
    for (const i of itensDeLuz(actor)) if (acende || ehObjeto(i)) linhas.push(linhaItem(token, i, acende));
    for (const e of carregadas(token)) linhas.push(linhaJunto(token, e, acende));
    for (const t of colocadasPerto(token)) linhas.push(linhaChao(token, t, acende));
    // Luz sem item: para quem não tem tocha nem lanterna (no inventário ou na mão). Magias de luz não a escondem:
    // com mais de uma opção, a lista pergunta o que acender.
    const avulsa = !!token.getFlag(ID, "avulsa");
    const temObjeto = itensDeLuz(actor).some(ehObjeto) || carregadas(token).length > 0;
    if (acende && (avulsa || (podeAvulsa() && !temObjeto))) linhas.push(linhaAvulsa(token, avulsa));
    if (!linhas.length) return;
    const col = root.querySelector(".col.left") ?? root.querySelector(".left");
    if (!col) return;

    const algumAceso = linhas.some((l) => l.aceso);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `control-icon monolith-luz-btn ${algumAceso ? "active" : ""}`;
    const direto = linhas.length === 1 && linhas[0].direto && !linhas[0].extras.length;
    btn.dataset.tooltip = direto ? `${linhas[0].aceso ? "Apagar" : "Acender"} ${linhas[0].nome}` : "Luzes: escolha o que acender";
    btn.innerHTML = `<i class="fas fa-fire${algumAceso ? "" : "-flame-simple"}"></i>`;
    col.append(btn);

    btn.addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (direto) return linhas[0].clique();
      const aberta = root.querySelector(".monolith-luz-paleta");
      if (aberta) return aberta.remove();
      btn.after(paleta(linhas));
    });
    btn.addEventListener("contextmenu", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const acesa = itensDeLuz(actor).find(aceso);
      if (acesa && acende) await alternarCobertura(acesa);
    });
  });
}

/**
 * Uma linha da lista.
 * @typedef {{nome:string, img:string, aceso:boolean, tempo:string, onde?:string, direto?:boolean, clique:Function, extras:Array<[string,string,Function]>}} Linha
 */

function linhaItem(token, i, acende) {
  const f = fonteDe(i);
  const extras = [];
  if (acende && temCobertura(f) && aceso(i)) extras.push([coberta(i) ? "Descobrir" : "Cobrir", coberta(i) ? "fa-eye" : "fa-eye-slash", () => alternarCobertura(i)]);
  if (ehObjeto(i) && cfg("colocarNoMapa")) extras.push(["Largar no chão", "fa-arrow-down", () => largarDoInventario(token, i)]);
  return {
    nome: i.name, img: i.img, aceso: aceso(i), tempo: aceso(i) ? tempoTexto(restante(i)) : "",
    qtd: i.type === "spell" ? 0 : i.system.quantity, direto: acende, clique: () => (acende ? alternar(i) : null), extras
  };
}

function linhaJunto(token, e, acende) {
  const f = fonteDe(e.item);
  const extras = [];
  if (acende && e.aceso && temCobertura(f)) extras.push([e.coberta ? "Descobrir" : "Cobrir", e.coberta ? "fa-eye" : "fa-eye-slash", () => cobrirCarregada(token, e.chave)]);
  if (token.actor) extras.push(["Guardar no inventário", "fa-hand", () => guardarCarregada(token, e.chave)]);
  extras.push(["Largar aqui", "fa-arrow-down", () => largarCarregada(token, e.chave)]);
  return {
    nome: e.item?.name, img: e.item?.img, aceso: !!e.aceso, tempo: e.aceso ? tempoTexto(e.restante) : "", onde: "junto",
    clique: () => (acende ? alternarCarregada(token, e.chave) : null), extras
  };
}

function linhaChao(token, tile, acende) {
  const e = estado(tile);
  const f = fonteDe(e.item);
  const dados = { sceneId: token.parent.id, tileId: tile.id, tokenId: token.id };
  const extras = [];
  if (acende && e.aceso && temCobertura(f)) extras.push([e.coberta ? "Descobrir" : "Cobrir", e.coberta ? "fa-eye" : "fa-eye-slash", () => pedir("cobrir", dados)]);
  extras.push(["Pegar", "fa-hand", () => pedir("pegar", dados)]);
  extras.push(["Carregar junto", "fa-link", () => pedir("carregar", dados)]);
  return {
    nome: e.item?.name, img: e.item?.img, aceso: !!e.aceso, tempo: e.aceso ? tempoTexto(e.restante) : "", onde: "no chão",
    clique: () => (acende ? pedir("alternar", dados) : null), extras
  };
}

function linhaAvulsa(token, ligada) {
  return {
    nome: cfg("avulsaNome") || "Tocha", img: "icons/sundries/lights/torch-brown.webp", aceso: ligada, tempo: "", onde: "sem item", direto: true,
    clique: () => token.update({ [`flags.${ID}.avulsa`]: !ligada }), extras: []
  };
}

function paleta(linhas) {
  const el = document.createElement("div");
  el.className = "monolith-luz-paleta";
  el.innerHTML = linhas.map((l, n) => `<div class="linha ${l.aceso ? "acesa" : ""}" data-n="${n}">
      <img src="${esc(l.img)}" alt=""><span class="nome">${esc(l.nome)}${l.qtd > 1 ? ` <small>×${l.qtd}</small>` : ""}${l.onde ? ` <small class="onde">${l.onde}</small>` : ""}</span>
      ${l.tempo ? `<span class="tempo">${l.tempo}</span>` : ""}
      ${l.extras.map(([rot, ic], k) => `<a class="extra" data-k="${k}" data-tooltip="${esc(rot)}"><i class="fas ${ic}"></i></a>`).join("")}
    </div>`).join("");
  el.addEventListener("click", async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const l = linhas[Number(ev.target.closest(".linha")?.dataset.n)];
    if (!l) return;
    const extra = ev.target.closest(".extra");
    if (extra) await l.extras[Number(extra.dataset.k)]?.[2]();
    else await l.clique();
    el.remove();
  });
  return el;
}
