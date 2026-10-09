import { ID, F, registrarConfiguracoes, lista } from "./config.mjs";
import { estado, usarMedida, aoDescansar, registrarStatusQueima, registrarGanchos, queimarAlma, encerrarQueima } from "./fio.mjs";
import { MedidasApp } from "./app.mjs";
import { EditorMedidas } from "./editor.mjs";

Hooks.once("init", () => {
  registrarConfiguracoes(EditorMedidas, () => { MedidasApp.atualizarTodos(); rerenderFichas(); });
  registrarStatusQueima();
  registrarGanchos();

  // Fichas que não são Tidy: botão no cabeçalho.
  Hooks.on("getHeaderControlsActorSheetV2", (app, controls) => {
    if (app.options?.classes?.includes("tidy5e-sheet")) return;
    const actor = app.document;
    if (actor?.type !== "character" || !actor.isOwner) return;
    controls.push({ icon: "fas fa-heart-crack", label: "Medidas Desesperadas", action: "monolithMedidas", onClick: () => MedidasApp.abrir(actor) });
  });

  Hooks.once("tidy5e-sheet.ready", (api) => registrarTidy(api));
});

Hooks.once("ready", async () => {
  game.modules.get(ID).api = {
    abrir: (actor) => MedidasApp.abrir(actor),
    abrirEditor: () => new EditorMedidas().render(true),
    estado, usar: usarMedida, lista, queimarAlma, encerrarQueima
  };
  if (game.users.activeGM?.isSelf) await migrar();
});

Hooks.on("updateActor", (actor) => { if (actor.type === "character") MedidasApp.atualizar(actor); });
for (const h of ["createActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(h, (eff) => { if (eff.parent instanceof Actor) MedidasApp.atualizar(eff.parent); });
}

// Fim de descanso (Monolith: Resting Rules): o Fio perde falhas marcadas e as Medidas armadas expiram.
Hooks.on("monolithResting.restCompleted", async (actor, tipo, opcoes = {}) => {
  if (actor.isOwner && actor.type === "character") await aoDescansar(actor, tipo, opcoes);
});

/** Traz o Fio, as Medidas armadas e a Queima do monolith-regras (até a 0.5) para este módulo, uma vez. */
async function migrar() {
  if (game.settings.get(ID, "migrado")) return;
  const chaves = [F.marcadas, F.armadas, F.queimando, F.recusou, F.ultimaMedida];
  let n = 0;
  for (const a of game.actors.filter((x) => x.type === "character")) {
    const antigo = a.flags["monolith-regras"] ?? {};
    const updates = {};
    for (const k of chaves) {
      if (antigo[k] === undefined) continue;
      if (a.getFlag(ID, k) === undefined) updates[`flags.${ID}.${k}`] = antigo[k];
      updates[`flags.monolith-regras.-=${k}`] = null;
    }
    if (!Object.keys(updates).length) continue;
    await a.update(updates);
    n++;
  }
  await game.settings.set(ID, "migrado", true);
  if (n) ui.notifications.info(`Monolith: Medidas Desesperadas: ${n} personagem(ns) migrado(s) do Regras da Casa.`);
}

function rerenderFichas() {
  for (const app of foundry.applications.instances.values()) {
    if (app.document?.type === "character" && app.rendered && app.options?.classes?.includes("tidy5e-sheet")) app.render();
  }
}

/* ---------- Ficha Tidy 5e Clássica: coração em cima do retrato ---------- */

function registrarTidy(api) {
  const layout = api.constants?.SHEET_LAYOUT_CLASSIC ?? "classic";
  api.registerCharacterContent(new api.models.HtmlContent({
    html: `<button type="button" class="monolith-tidy mm-coracao" data-monolith-coracao data-tidy-render-scheme="handlebars"></button>`,
    injectParams: { selector: ".tidy5e-sheet-header .actor-profile-wrap .profile", position: "beforeend" },
    enabled: (ctx) => game.settings.get(ID, "coracaoFicha") && !!(ctx.actor ?? ctx.document)?.isOwner,
    onRender: ({ app, element }) => {
      const actor = app.document ?? app.actor;
      const el = element.querySelector("[data-monolith-coracao]");
      if (!el || !actor) return;
      const e = estado(actor);
      const situacao = e.morto ? "morto" : e.queimando ? "queimando" : e.morrendo ? "morrendo" : e.sangrando ? "sangrando" : "inteiro";
      el.dataset.estado = situacao;
      el.parentElement?.classList.add("mm-tem-coracao");
      const pips = [0, 1, 2].map((i) => `<span class="${i < e.marcadas ? "marcada" : i < e.falhas ? "comum" : ""}"></span>`).join("");
      const icone = e.morto ? "fa-skull" : e.queimando ? "fa-fire" : e.sangrando || e.morrendo ? "fa-heart-crack" : "fa-heart";
      el.innerHTML = `<i class="fas ${icone}"></i><span class="pips">${pips}</span>`;
      el.dataset.tooltip = `<b>Medidas Desesperadas</b><br>${{ morto: "Morto", queimando: "Queimando a Alma", morrendo: "Morrendo", sangrando: "Sangrando: Medidas abertas", inteiro: "Fechadas até Sangrar" }[situacao]}<br>O Fio: ${e.marcadas} marcada(s), ${e.livres} livre(s)`;
      el.setAttribute("aria-label", "Medidas Desesperadas");
      el.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); MedidasApp.abrir(actor); });
    }
  }), { layout });

  // Tidy nova (Quadrone) e qualquer layout: entrada no menu do cabeçalho.
  api.registerCharacterHeaderControls({
    controls: [{
      icon: "fas fa-heart-crack",
      label: "Medidas Desesperadas",
      ownership: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      async onClickAction() { MedidasApp.abrir(this.document ?? this.actor); }
    }]
  });
}
