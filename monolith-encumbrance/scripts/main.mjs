import { ID, registrarConfiguracoes, definirRecalculo } from "./regras.mjs";
import { atualizarAtor, registrarDesvantagemDeAtaque, faixaAtual, pesoCarregado, limite } from "./carga.mjs";
import { EditorFaixas } from "./editor.mjs";

const pendentes = new Map();

/** Só um cliente aplica: o GM ativo, ou quem fez a mudança se não houver GM online. */
function souResponsavel(userId) {
  const gm = game.users.activeGM;
  return gm ? gm.isSelf : userId === game.user.id;
}

function agendar(actor, userId) {
  if (!actor || !souResponsavel(userId)) return;
  clearTimeout(pendentes.get(actor.id));
  pendentes.set(actor.id, setTimeout(() => {
    pendentes.delete(actor.id);
    atualizarAtor(actor).catch((err) => console.error(`${ID} |`, err));
  }, 150));
}

function recalcularTodos() {
  if (!game.users.activeGM?.isSelf) return;
  for (const a of game.actors) if (["character", "npc"].includes(a.type)) agendar(a, game.user.id);
}

Hooks.once("init", () => {
  registrarConfiguracoes(EditorFaixas);
  definirRecalculo(recalcularTodos);
  registrarDesvantagemDeAtaque();
});

Hooks.once("ready", async () => {
  game.modules.get(ID).api = { faixaAtual, pesoCarregado, limite, atualizarAtor, recalcularTodos, abrirEditor: () => new EditorFaixas().render(true) };
  if (game.user.isGM && game.settings.get("dnd5e", "encumbrance") !== "none") {
    const ok = await foundry.applications.api.DialogV2.confirm({ classes: ["mono"], window: { title: "Monolith: Encumbrance" },
      content: "<p>A regra de carga do dnd5e está ligada. Ela aplica sua própria redução de deslocamento, que somaria com as faixas deste módulo.</p><p>Mudar a regra de carga do dnd5e para <b>Nenhuma</b>? O peso continua sendo calculado normalmente.</p>"
    }).catch(() => false);
    if (ok) await game.settings.set("dnd5e", "encumbrance", "none");
  }
  recalcularTodos();
});

Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (foundry.utils.hasProperty(changes, "system.abilities.str") || foundry.utils.hasProperty(changes, "system.currency") || foundry.utils.hasProperty(changes, "system.traits.size") || foundry.utils.hasProperty(changes, "flags.dnd5e.powerfulBuild")) agendar(actor, userId);
});
for (const h of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(h, (item, a, b, c) => {
    const userId = typeof c === "string" ? c : typeof b === "string" ? b : null;
    if (item.parent instanceof Actor) agendar(item.parent, userId);
  });
}
// Efeitos de outras fontes que mudam a Força ou o tamanho.
for (const h of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(h, (effect, a, b, c) => {
    if (effect.getFlag(ID, "faixa") !== undefined) return;
    const userId = typeof c === "string" ? c : typeof b === "string" ? b : null;
    if (effect.parent instanceof Actor) agendar(effect.parent, userId);
  });
}
