import { ID, esc, fonteDe } from "./config.mjs";
import { itensDeLuz, aceso, coberta, restante, tempoTexto, alternar, alternarCobertura } from "./luz.mjs";

/** Botão de chama no HUD do token: uma fonte, alterna direto; várias, abre a lista. */
export function registrarHud() {
  Hooks.on("renderTokenHUD", (hud, html) => {
    if (!game.settings.get(ID, "botaoHud")) return;
    const root = html instanceof HTMLElement ? html : html[0];
    const actor = hud.object?.actor ?? hud.document?.actor;
    if (!actor?.isOwner) return;
    const itens = itensDeLuz(actor);
    if (!itens.length) return;
    const algumAceso = itens.some(aceso);
    const col = root.querySelector(".col.left") ?? root.querySelector(".left");
    if (!col) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `control-icon monolith-luz-btn ${algumAceso ? "active" : ""}`;
    btn.dataset.tooltip = itens.length === 1 ? `${aceso(itens[0]) ? "Apagar" : "Acender"} ${itens[0].name}` : "Luzes";
    btn.innerHTML = `<i class="fas fa-fire${algumAceso ? "" : "-flame-simple"}"></i>`;
    col.append(btn);

    btn.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (itens.length === 1) return alternar(itens[0]);
      const aberta = root.querySelector(".monolith-luz-paleta");
      if (aberta) return aberta.remove();
      btn.after(paleta(itens));
    });
    btn.addEventListener("contextmenu", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const acesa = itens.find(aceso);
      if (acesa) await alternarCobertura(acesa);
    });
  });
}

function paleta(itens) {
  const el = document.createElement("div");
  el.className = "monolith-luz-paleta";
  el.innerHTML = itens.map((i) => {
    const f = fonteDe(i);
    const t = aceso(i) ? tempoTexto(restante(i)) : "";
    const podeCobrir = f.cobertaBrilho || f.cobertaPenumbra;
    return `<div class="linha ${aceso(i) ? "acesa" : ""}" data-id="${i.id}">
      <img src="${i.img}" alt=""><span class="nome">${esc(i.name)}${i.system.quantity > 1 ? ` <small>×${i.system.quantity}</small>` : ""}</span>
      ${t ? `<span class="tempo">${t}</span>` : ""}
      ${podeCobrir && aceso(i) ? `<a class="cobrir" data-tooltip="${coberta(i) ? "Descobrir" : "Cobrir"}"><i class="fas fa-${coberta(i) ? "eye" : "eye-slash"}"></i></a>` : ""}
    </div>`;
  }).join("");
  el.addEventListener("click", async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const linha = ev.target.closest(".linha");
    const item = itens.find((i) => i.id === linha?.dataset.id);
    if (!item) return;
    if (ev.target.closest(".cobrir")) await alternarCobertura(item);
    else await alternar(item);
  });
  return el;
}
