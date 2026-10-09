import { ID, registrarConfiguracoes, fontes, fonteDe } from "./config.mjs";
import { aceso, alternar, alternarCobertura, acender, apagar, sincronizarTokens, queimar, itensDeLuz, luzDoAtor } from "./luz.mjs";
import { registrarHud } from "./hud.mjs";
import { EditorFontes } from "./editor.mjs";

const pendentes = new Map();

/** Só um cliente mexe nos tokens: o GM ativo, ou quem fez a mudança se não houver GM. */
function agendar(actor, userId) {
  if (!actor) return;
  const gm = game.users.activeGM;
  if (gm ? !gm.isSelf : userId !== game.user.id) return;
  const chave = actor.uuid;
  clearTimeout(pendentes.get(chave));
  pendentes.set(chave, setTimeout(() => {
    pendentes.delete(chave);
    sincronizarTokens(actor).catch((err) => console.error(`${ID} |`, err));
  }, 120));
}

function todos() {
  for (const a of game.actors) agendar(a, game.user.id);
  for (const s of game.scenes) for (const t of s.tokens) if (!t.actorLink && t.actor) agendar(t.actor, game.user.id);
}

Hooks.once("init", () => {
  registrarConfiguracoes(EditorFontes, () => todos());
  registrarHud();

  // Usar a tocha/lanterna pela ficha acende ou apaga (ataques continuam ataques).
  Hooks.on("dnd5e.preUseActivity", (activity) => {
    const item = activity?.item;
    if (!game.settings.get(ID, "usarAcende") || !fonteDe(item) || activity.type === "attack") return;
    alternar(item);
    return false;
  });
  Hooks.on("dnd5e.preDisplayCard", (item) => {
    if (!game.settings.get(ID, "usarAcende") || !fonteDe(item) || !item.actor) return;
    alternar(item);
    return false;
  });

  // Menu de contexto do item (ficha do dnd5e e Tidy).
  Hooks.on("dnd5e.getItemContextOptions", (item, options) => {
    if (!fonteDe(item) || !item.isOwner || !item.actor) return;
    options.unshift({
      name: aceso(item) ? "Apagar" : "Acender",
      icon: `<i class="fas fa-fire${aceso(item) ? "-flame-simple" : ""}"></i>`,
      callback: () => alternar(item)
    });
  });

  // Ficha do item: acender/apagar e escolher a fonte de luz à mão.
  Hooks.on("getHeaderControlsDocumentSheetV2", (app, controls) => {
    const item = app.document;
    if (!(item instanceof Item) || !item.isOwner || !("quantity" in (item.system ?? {}))) return;
    if (fonteDe(item) && item.actor) controls.push({ icon: "fas fa-fire", label: aceso(item) ? "Apagar" : "Acender", action: "monolithLuz", onClick: () => alternar(item) });
    if (game.user.isGM) controls.push({ icon: "fas fa-lightbulb", label: "Fonte de luz...", action: "monolithLuzFonte", onClick: () => escolherFonte(item) });
  });
});

Hooks.once("ready", async () => {
  game.modules.get(ID).api = { acender, apagar, alternar, alternarCobertura, aceso, fonteDe, fontes, itensDeLuz, luzDoAtor, sincronizar: sincronizarTokens };
  if (game.user.isGM && game.modules.get("torch")?.active) avisarTorch();
  todos();
});

// Mudou a luz de um item, ou ele entrou/saiu do inventário (soltar no chão, trocar, vender).
Hooks.on("updateItem", (item, changes, options, userId) => {
  if (!item.parent || !(item.parent instanceof Actor)) return;
  if (foundry.utils.hasProperty(changes, `flags.${ID}`) || "name" in changes || foundry.utils.hasProperty(changes, "system.quantity")) agendar(item.parent, userId);
});
Hooks.on("createItem", (item, options, userId) => { if (item.parent instanceof Actor && fonteDe(item)) agendar(item.parent, userId); });
Hooks.on("deleteItem", (item, options, userId) => { if (item.parent instanceof Actor && aceso(item)) agendar(item.parent, userId); });
// Token novo (entrar na cena, pilha no chão com uma tocha acesa).
Hooks.on("createToken", (token, options, userId) => { if (token.actor) agendar(token.actor, userId); });

// O tempo passa: a chama queima.
Hooks.on("updateWorldTime", (worldTime, delta) => {
  if (!game.users.activeGM?.isSelf) return;
  queimar(delta).catch((err) => console.error(`${ID} |`, err));
});

async function escolherFonte(item) {
  const atual = item.getFlag(ID, "fonte") ?? "";
  const op = [`<option value="">Automática (pelo nome)${fonteDe(item) && !atual ? `: ${fonteDe(item).nome}` : ""}</option>`, `<option value="nenhuma" ${atual === "nenhuma" ? "selected" : ""}>Não é fonte de luz</option>`,
    ...fontes().map((f) => `<option value="${f.id}" ${atual === f.id ? "selected" : ""}>${f.nome}</option>`)].join("");
  const v = await foundry.applications.api.DialogV2.prompt({
    classes: ["mono"], window: { title: `Fonte de luz: ${item.name}` },
    content: `<div class="form-group"><label>Fonte</label><select name="f">${op}</select></div>`,
    ok: { label: "Salvar", callback: (e, b) => b.form.elements.f.value }
  }).catch(() => null);
  if (v === null) return;
  if (v) await item.setFlag(ID, "fonte", v);
  else await item.unsetFlag(ID, "fonte");
}

async function avisarTorch() {
  const ok = await foundry.applications.api.DialogV2.confirm({
    classes: ["mono"], window: { title: "Monolith: Luzes" },
    content: "<p>O módulo <b>Torch</b> está ativo. Os dois mexem na luz do token e brigam entre si.</p><p>Desativar o Torch agora? O mundo recarrega.</p>"
  }).catch(() => false);
  if (!ok) return;
  const cfg = foundry.utils.deepClone(game.settings.get("core", "moduleConfiguration"));
  cfg.torch = false;
  await game.settings.set("core", "moduleConfiguration", cfg);
  foundry.utils.debouncedReload();
}
