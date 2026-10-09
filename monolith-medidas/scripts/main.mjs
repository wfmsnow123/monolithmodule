import { ID, F, registrarConfiguracoes, lista } from "./config.mjs";
import { estado, usarMedida, aoDescansar, registrarStatusQueima, registrarGanchos, queimarAlma, encerrarQueima, confirmar } from "./fio.mjs";
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

/* ---------- Ficha Tidy 5e Clássica: botão ao lado do nível ---------- */

// SVG embutido: não depende da fonte de ícones nem dos estilos de botão da ficha.
// Ícones do Phosphor Icons 2.1 (peso regular, MIT, phosphoricons.com).
const svg = (d, cls = "mm-ico") => `<svg class="${cls}" viewBox="0 0 256 256" aria-hidden="true"><path d="${d}"/></svg>`;
const PH = {
  heartbeat: "M72,144H32a8,8,0,0,1,0-16H67.72l13.62-20.44a8,8,0,0,1,13.32,0l25.34,38,9.34-14A8,8,0,0,1,136,128h24a8,8,0,0,1,0,16H140.28l-13.62,20.44a8,8,0,0,1-13.32,0L88,126.42l-9.34,14A8,8,0,0,1,72,144ZM178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,.75,0,1.5,0,2.25a8,8,0,1,0,16-.5c0-.58,0-1.17,0-1.75A46.06,46.06,0,0,1,78,56c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46c0,53.61-77.76,102.15-96,112.8-10.83-6.31-42.63-26-66.68-52.21a8,8,0,1,0-11.8,10.82c31.17,34,72.93,56.68,74.69,57.63a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40Z",
  flame: "M173.79,51.48a221.25,221.25,0,0,0-41.67-34.34,8,8,0,0,0-8.24,0A221.25,221.25,0,0,0,82.21,51.48C54.59,80.48,40,112.47,40,144a88,88,0,0,0,176,0C216,112.47,201.41,80.48,173.79,51.48ZM96,184c0-27.67,22.53-47.28,32-54.3,9.48,7,32,26.63,32,54.3a32,32,0,0,1-64,0Zm77.27,15.93A47.8,47.8,0,0,0,176,184c0-44-42.09-69.79-43.88-70.86a8,8,0,0,0-8.24,0C122.09,114.21,80,140,80,184a47.8,47.8,0,0,0,2.73,15.93A71.88,71.88,0,0,1,56,144c0-34.41,20.4-63.15,37.52-81.19A216.21,216.21,0,0,1,128,33.54a215.77,215.77,0,0,1,34.48,29.27C193.49,95.5,200,125,200,144A71.88,71.88,0,0,1,173.27,199.93Z",
  skull: "M92,104a28,28,0,1,0,28,28A28,28,0,0,0,92,104Zm0,40a12,12,0,1,1,12-12A12,12,0,0,1,92,144Zm72-40a28,28,0,1,0,28,28A28,28,0,0,0,164,104Zm0,40a12,12,0,1,1,12-12A12,12,0,0,1,164,144ZM128,16C70.65,16,24,60.86,24,116c0,34.1,18.27,66,48,84.28V216a16,16,0,0,0,16,16h80a16,16,0,0,0,16-16V200.28C213.73,182,232,150.1,232,116,232,60.86,185.35,16,128,16Zm44.12,172.69a8,8,0,0,0-4.12,7V216H152V192a8,8,0,0,0-16,0v24H120V192a8,8,0,0,0-16,0v24H88V195.69a8,8,0,0,0-4.12-7C56.81,173.69,40,145.84,40,116c0-46.32,39.48-84,88-84s88,37.68,88,84C216,145.83,199.19,173.69,172.12,188.69Z"
};
const ICONES = { inteiro: svg(PH.heartbeat), partido: svg(PH.heartbeat), queimando: svg(PH.flame), morto: svg(PH.skull) };

function registrarTidy(api) {
  const layout = api.constants?.SHEET_LAYOUT_CLASSIC ?? "classic";
  // Botão ao lado do nível (dividindo o espaço com a Perdição): ícone e o Fio marcado.
  // Fechado (acima de metade da vida) fica apagado e só o Mestre abre.
  api.registerCharacterContent(new api.models.HtmlContent({
    html: `<a class="monolith-tidy mm-chip" role="button" tabindex="0" data-monolith-medidas data-tidy-render-scheme="handlebars"></a>`,
    injectParams: { selector: ".tidy5e-sheet-header h2.level", position: "beforebegin" },
    enabled: (ctx) => game.settings.get(ID, "coracaoFicha") && !!(ctx.actor ?? ctx.document)?.isOwner,
    onRender: ({ app, element }) => {
      const actor = app.document ?? app.actor;
      const el = element.querySelector("[data-monolith-medidas]");
      if (!el || !actor) return;
      const e = estado(actor);
      const situacao = e.morto ? "morto" : e.queimando ? "queimando" : e.morrendo ? "morrendo" : e.abertas ? "sangrando" : "fechada";
      el.dataset.estado = situacao;
      const marcadas = Math.max(e.marcadas, e.falhas);
      el.innerHTML = `${ICONES[e.morto ? "morto" : e.queimando ? "queimando" : "inteiro"]}<b>${marcadas}</b><small>/3</small>`;
      el.dataset.tooltip = `<b>Medidas Desesperadas</b><br>${{ morto: "Morto", queimando: "Queimando a Alma", morrendo: "Morrendo", sangrando: "Abertas", fechada: "Fechadas até Sangrar (metade da vida)" }[situacao]}<br>O Fio: ${e.marcadas} marcada(s), ${e.livres} livre(s)`;
      el.setAttribute("aria-label", "Medidas Desesperadas");
      el.setAttribute("aria-disabled", String(situacao === "fechada" && !game.user.isGM));
      const abrir = (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (situacao === "fechada" && !game.user.isGM) return ui.notifications.info("As Medidas Desesperadas abrem quando o personagem chega à metade da vida.");
        MedidasApp.abrir(actor);
      };
      el.addEventListener("click", abrir);
      el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") abrir(ev); });
    }
  }), { layout });

  // Queimar a Alma: chama ao lado das Medidas. Morrendo, queima; morto sem ter recusado, Recusar a Morte;
  // queimando, abre as Medidas (dano, crítico, encerrar). Fora disso, apagado.
  api.registerCharacterContent(new api.models.HtmlContent({
    html: `<a class="monolith-tidy mm-chip mm-queima" role="button" tabindex="0" data-monolith-queima data-tidy-render-scheme="handlebars"></a>`,
    injectParams: { selector: ".tidy5e-sheet-header h2.level", position: "beforebegin" },
    enabled: (ctx) => game.settings.get(ID, "coracaoFicha") && !!(ctx.actor ?? ctx.document)?.isOwner,
    onRender: ({ app, element }) => {
      const actor = app.document ?? app.actor;
      const el = element.querySelector("[data-monolith-queima]");
      if (!el || !actor) return;
      const e = estado(actor);
      const modo = e.queimando ? "queimando" : e.morrendo ? "queimar" : e.morto && !e.recusou ? "recusar" : "indisponivel";
      el.dataset.estado = modo;
      el.innerHTML = ICONES.queimando;
      el.dataset.tooltip = {
        queimar: "<b>Queimar a Alma</b><br>Ganhar 1d4 de Perdição e levantar com 0 PV.",
        recusar: "<b>Recusar a Morte</b> (uma única vez)<br>Voltar queimando com 2 falhas no Fio e 1d8 de Perdição.",
        queimando: "<b>Queimando a Alma</b><br>Clique para registrar dano ou encerrar a Queima.",
        indisponivel: "<b>Queimar a Alma</b><br>Só a 0 PV (Morrendo)."
      }[modo];
      el.setAttribute("aria-label", modo === "recusar" ? "Recusar a Morte" : "Queimar a Alma");
      el.setAttribute("aria-disabled", String(modo === "indisponivel"));
      const agir = async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (modo === "indisponivel") return ui.notifications.info("A Queima de Alma começa quando o personagem cai a 0 PV.");
        if (modo === "queimando") return MedidasApp.abrir(actor);
        if (modo === "queimar" && await confirmar("Queimar a Alma", "Ganhar 1d4 de Perdição e se levantar com 0 PV?")) return queimarAlma(actor);
        if (modo === "recusar" && await confirmar("Recusar a Morte", "Uma única vez: voltar queimando com 2 falhas no Fio e 1d8 de Perdição?")) return queimarAlma(actor, { recusa: true });
      };
      el.addEventListener("click", agir);
      el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") agir(ev); });
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
