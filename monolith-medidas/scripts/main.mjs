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

// SVG embutido: não depende da fonte de ícones nem dos estilos de botão da ficha.
// Ícones do Phosphor Icons 2.1 (peso regular, MIT, phosphoricons.com).
const svg = (d, cls = "mm-ico") => `<svg class="${cls}" viewBox="0 0 256 256" aria-hidden="true"><path d="${d}"/></svg>`;
const PH = {
  heartbeat: "M72,144H32a8,8,0,0,1,0-16H67.72l13.62-20.44a8,8,0,0,1,13.32,0l25.34,38,9.34-14A8,8,0,0,1,136,128h24a8,8,0,0,1,0,16H140.28l-13.62,20.44a8,8,0,0,1-13.32,0L88,126.42l-9.34,14A8,8,0,0,1,72,144ZM178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,.75,0,1.5,0,2.25a8,8,0,1,0,16-.5c0-.58,0-1.17,0-1.75A46.06,46.06,0,0,1,78,56c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46c0,53.61-77.76,102.15-96,112.8-10.83-6.31-42.63-26-66.68-52.21a8,8,0,1,0-11.8,10.82c31.17,34,72.93,56.68,74.69,57.63a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40Z",
  flame: "M173.79,51.48a221.25,221.25,0,0,0-41.67-34.34,8,8,0,0,0-8.24,0A221.25,221.25,0,0,0,82.21,51.48C54.59,80.48,40,112.47,40,144a88,88,0,0,0,176,0C216,112.47,201.41,80.48,173.79,51.48ZM96,184c0-27.67,22.53-47.28,32-54.3,9.48,7,32,26.63,32,54.3a32,32,0,0,1-64,0Zm77.27,15.93A47.8,47.8,0,0,0,176,184c0-44-42.09-69.79-43.88-70.86a8,8,0,0,0-8.24,0C122.09,114.21,80,140,80,184a47.8,47.8,0,0,0,2.73,15.93A71.88,71.88,0,0,1,56,144c0-34.41,20.4-63.15,37.52-81.19A216.21,216.21,0,0,1,128,33.54a215.77,215.77,0,0,1,34.48,29.27C193.49,95.5,200,125,200,144A71.88,71.88,0,0,1,173.27,199.93Z",
  skull: "M92,104a28,28,0,1,0,28,28A28,28,0,0,0,92,104Zm0,40a12,12,0,1,1,12-12A12,12,0,0,1,92,144Zm72-40a28,28,0,1,0,28,28A28,28,0,0,0,164,104Zm0,40a12,12,0,1,1,12-12A12,12,0,0,1,164,144ZM128,16C70.65,16,24,60.86,24,116c0,34.1,18.27,66,48,84.28V216a16,16,0,0,0,16,16h80a16,16,0,0,0,16-16V200.28C213.73,182,232,150.1,232,116,232,60.86,185.35,16,128,16Zm44.12,172.69a8,8,0,0,0-4.12,7V216H152V192a8,8,0,0,0-16,0v24H120V192a8,8,0,0,0-16,0v24H88V195.69a8,8,0,0,0-4.12-7C56.81,173.69,40,145.84,40,116c0-46.32,39.48-84,88-84s88,37.68,88,84C216,145.83,199.19,173.69,172.12,188.69Z",
  circleDashed: "M96.26,37.05A8,8,0,0,1,102,27.29a104.11,104.11,0,0,1,52,0,8,8,0,0,1-2,15.75,8.15,8.15,0,0,1-2-.26,88.09,88.09,0,0,0-44,0A8,8,0,0,1,96.26,37.05ZM53.79,55.14a104.05,104.05,0,0,0-26,45,8,8,0,0,0,15.42,4.27,88,88,0,0,1,22-38.09A8,8,0,0,0,53.79,55.14ZM43.21,151.55a8,8,0,1,0-15.42,4.28,104.12,104.12,0,0,0,26,45,8,8,0,0,0,11.41-11.22A88.14,88.14,0,0,1,43.21,151.55ZM150,213.22a88,88,0,0,1-44,0,8,8,0,1,0-4,15.49,104.11,104.11,0,0,0,52,0,8,8,0,0,0-4-15.49ZM222.65,146a8,8,0,0,0-9.85,5.58,87.91,87.91,0,0,1-22,38.08,8,8,0,1,0,11.42,11.21,104,104,0,0,0,26-45A8,8,0,0,0,222.65,146Zm-9.86-41.54a8,8,0,0,0,15.42-4.28,104,104,0,0,0-26-45,8,8,0,1,0-11.41,11.22A88,88,0,0,1,212.79,104.45Z",
  chartPolar: "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm87.63,96H191.48A64.1,64.1,0,0,0,136,64.52V40.37A88.13,88.13,0,0,1,215.63,120ZM120,120H80.68A48.09,48.09,0,0,1,120,80.68Zm0,16v39.32A48.09,48.09,0,0,1,80.68,136Zm16,0h39.32A48.09,48.09,0,0,1,136,175.32Zm0-16V80.68A48.09,48.09,0,0,1,175.32,120ZM120,40.37V64.52A64.1,64.1,0,0,0,64.52,120H40.37A88.13,88.13,0,0,1,120,40.37ZM40.37,136H64.52A64.1,64.1,0,0,0,120,191.48v24.15A88.13,88.13,0,0,1,40.37,136ZM136,215.63V191.48A64.1,64.1,0,0,0,191.48,136h24.15A88.13,88.13,0,0,1,136,215.63Z"
};
const ICONES = { inteiro: svg(PH.heartbeat), partido: svg(PH.heartbeat), queimando: svg(PH.flame), morto: svg(PH.skull) };
// Bolinhas do Fio: vazia (tracejada) ou preenchida (marcada no Fio ou falha de morte), esta em fundo vermelho.
const PIP_VAZIA = svg(PH.circleDashed, "mm-pip");
const PIP_CHEIA = svg(PH.chartPolar, "mm-pip");

function registrarTidy(api) {
  const layout = api.constants?.SHEET_LAYOUT_CLASSIC ?? "classic";
  api.registerCharacterContent(new api.models.HtmlContent({
    html: `<a class="monolith-tidy mm-coracao" role="button" tabindex="0" data-monolith-coracao data-tidy-render-scheme="handlebars"></a>`,
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
      const pips = [0, 1, 2].map((i) => i < Math.max(e.marcadas, e.falhas) ? `<span class="cheia">${PIP_CHEIA}</span>` : `<span>${PIP_VAZIA}</span>`).join("");
      el.innerHTML = `${ICONES[e.morto ? "morto" : e.queimando ? "queimando" : e.sangrando || e.morrendo ? "partido" : "inteiro"]}<span class="pips">${pips}</span>`;
      el.dataset.tooltip = `<b>Medidas Desesperadas</b><br>${{ morto: "Morto", queimando: "Queimando a Alma", morrendo: "Morrendo", sangrando: "Sangrando: Medidas abertas", inteiro: "Fechadas até Sangrar" }[situacao]}<br>O Fio: ${e.marcadas} marcada(s), ${e.livres} livre(s)`;
      el.setAttribute("aria-label", "Medidas Desesperadas");
      const abrir = (ev) => { ev.preventDefault(); ev.stopPropagation(); MedidasApp.abrir(actor); };
      el.addEventListener("click", abrir);
      el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") abrir(ev); });
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
