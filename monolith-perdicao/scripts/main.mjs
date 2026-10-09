import * as P from "./perdicao.mjs";
import { PerdicaoApp } from "./app.mjs";

const { ID, valor, piso, estadoDe, podeVer, MAXIMO } = P;

Hooks.once("init", () => {
  game.settings.register(ID, "jogadoresVeem", {
    name: "Jogadores veem a própria Perdição",
    hint: "Desligado, a Perdição fica só com o Mestre: o contador some da ficha dos jogadores e as rolagens e avisos vão sussurrados.",
    scope: "world", config: true, type: Boolean, default: true, onChange: () => rerenderFichas()
  });
  game.settings.register(ID, "habilidade", {
    name: "Chave da Lucidez",
    hint: "A chave do valor de habilidade de Lucidez no dnd5e (o custom-dnd5e usa a que você cadastrou, ex.: san). Os testes de resistência de Perdição usam essa salvaguarda.",
    scope: "world", config: true, type: String, default: "san"
  });
  game.settings.register(ID, "marcaAutomatica", {
    name: "Criar Marca ao cruzar um limiar",
    hint: "Ao subir por 5, 10 ou 15, cria uma Marca de Loucura (ou de Danação, se Ligado) para o Mestre definir o efeito.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "contadorFicha", {
    name: "Contador na ficha Tidy (Clássica)",
    hint: "Botão da Perdição (olho fechado e o valor) ao lado do nível, junto do das Medidas Desesperadas, no cabeçalho da ficha Tidy 5e Clássica.",
    scope: "client", config: true, type: Boolean, default: true, onChange: () => rerenderFichas()
  });
  game.settings.register(ID, "migrado", { scope: "world", config: false, type: Boolean, default: false });

  P.registrarModificadorEnfase();
  P.registrarEnfase();

  // Fichas que não são Tidy (ou a Tidy nova): botão no cabeçalho.
  Hooks.on("getHeaderControlsActorSheetV2", (app, controls) => {
    const actor = app.document;
    if (actor?.type !== "character" || !podeVer(actor)) return;
    if (app.options?.classes?.includes("tidy5e-sheet")) return;
    controls.push({ icon: "fas fa-eye", label: "Perdição", action: "monolithPerdicao", onClick: () => PerdicaoApp.abrir(actor) });
  });

  Hooks.once("tidy5e-sheet.ready", (api) => registrarTidy(api));
});

Hooks.once("ready", async () => {
  game.modules.get(ID).api = {
    valor, piso, estado: (a) => estadoDe(valor(a)), marcas: P.marcas, ligacao: P.ligacao,
    ajustar: P.ajustar, definir: P.definir, rolarGanho: P.rolarGanho, testar: P.testar, firmarSe: P.firmarSe,
    adicionarMarca: P.adicionarMarca, removerMarca: P.removerMarca, abrir: (a) => PerdicaoApp.abrir(a)
  };
  if (game.users.activeGM?.isSelf) await migrar();
});

Hooks.on("updateActor", (actor, changes) => {
  if (foundry.utils.hasProperty(changes, `flags.${ID}`)) PerdicaoApp.atualizar(actor);
});

/** Traz a Perdição antiga do monolith-regras (flag "perdicao") para este módulo, uma vez. */
async function migrar() {
  if (game.settings.get(ID, "migrado")) return;
  let n = 0;
  for (const a of game.actors.filter((x) => x.type === "character")) {
    const antigo = a.getFlag("monolith-regras", "perdicao");
    if (antigo === undefined) continue;
    const updates = { "flags.monolith-regras.-=perdicao": null };
    if (a.getFlag(ID, "valor") === undefined) updates[`flags.${ID}.valor`] = Number(antigo) || 0;
    await a.update(updates);
    n++;
  }
  await game.settings.set(ID, "migrado", true);
  if (n) ui.notifications.info(`Monolith: Perdição: ${n} personagem(ns) migrado(s) do Regras da Casa.`);
}

function rerenderFichas() {
  for (const app of foundry.applications.instances.values()) {
    if (app.document?.type === "character" && app.rendered) app.render();
  }
}

/* ---------- Ficha Tidy 5e Clássica: botão ao lado do nível (junto do das Medidas) ---------- */

// Ícone eye-closed do Phosphor Icons 2.1 (peso regular, MIT, phosphoricons.com), embutido em SVG.
const OLHO = `<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M228,175a8,8,0,0,1-10.92-3l-19-33.2A123.23,123.23,0,0,1,162,155.46l5.87,35.22a8,8,0,0,1-6.58,9.21A8.4,8.4,0,0,1,160,200a8,8,0,0,1-7.88-6.69l-5.77-34.58a133.06,133.06,0,0,1-36.68,0l-5.77,34.58A8,8,0,0,1,96,200a8.4,8.4,0,0,1-1.32-.11,8,8,0,0,1-6.58-9.21L94,155.46a123.23,123.23,0,0,1-36.06-16.69L39,172A8,8,0,1,1,25.06,164l20-35a153.47,153.47,0,0,1-19.3-20A8,8,0,1,1,38.22,99c16.6,20.54,45.64,45,89.78,45s73.18-24.49,89.78-45A8,8,0,1,1,230.22,109a153.47,153.47,0,0,1-19.3,20l20,35A8,8,0,0,1,228,175Z"/></svg>`;

function registrarTidy(api) {
  const layout = api.constants?.SHEET_LAYOUT_CLASSIC ?? "classic";
  api.registerCharacterContent(new api.models.HtmlContent({
    html: `<div class="monolith-tidy mp-chip" data-monolith-perdicao data-tidy-render-scheme="handlebars"></div>`,
    injectParams: { selector: ".tidy5e-sheet-header h2.level", position: "beforebegin" },
    enabled: (ctx) => game.settings.get(ID, "contadorFicha") && podeVer(ctx.actor ?? ctx.document),
    onRender: ({ app, element }) => {
      const actor = app.document ?? app.actor;
      const el = element.querySelector("[data-monolith-perdicao]");
      if (!el || !actor) return;
      const v = valor(actor);
      const est = estadoDe(v);
      const nivel = v >= 20 ? 4 : v >= 15 ? 3 : v >= 10 ? 2 : v >= 5 ? 1 : 0;
      el.dataset.nivel = nivel;
      el.dataset.tooltip = `<b>Perdição ${v}/${MAXIMO}</b>: ${est.nome}<br>${est.efeito}<br>Piso ${piso(actor)} · ${P.marcas(actor).length} Marca(s)`;
      el.innerHTML = `${OLHO}<b>${v}</b>`;
      el.setAttribute("role", "button");
      el.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); PerdicaoApp.abrir(actor); });
    }
  }), { layout });

  // A Tidy nova (Quadrone): botão no menu do cabeçalho.
  api.registerCharacterHeaderControls?.({
    controls: [{
      icon: "fas fa-eye",
      label: "Perdição",
      ownership: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      visible() { return podeVer(this.document ?? this.actor); },
      async onClickAction() { PerdicaoApp.abrir(this.document ?? this.actor); }
    }]
  });
}
