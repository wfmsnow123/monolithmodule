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
    hint: "Mostra a Perdição ao lado do nível, no cabeçalho da ficha Tidy 5e Clássica.",
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

/* ---------- Ficha Tidy 5e Clássica: contador ao lado do nível ---------- */

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
      el.innerHTML = `<i class="fas fa-eye"></i><span class="rot">Perdição</span><b>${v}</b><span class="barra"><span style="width:${(v / MAXIMO) * 100}%"></span></span>`;
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
