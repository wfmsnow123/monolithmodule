import { ID, registrarConfiguracoes, fontes, fonteDe, ehMagia, podeAcender, cfg } from "./config.mjs";
import { aceso, alternar, alternarCobertura, acender, apagar, sincronizarToken, sincronizarTokens, queimar, itensDeLuz, luzDoAtor, luzDoToken } from "./luz.mjs";
import { registrarHud } from "./hud.mjs";
import { EditorFontes } from "./editor.mjs";
import { registrarChao, registrarSocket, registrarSoltar, queimarNoChao, pedir, estado } from "./chao.mjs";
import { migrarTorch, atualizarFontes, importarFontesTorch } from "./migracao.mjs";

const pendentes = new Map();

/** Só um cliente mexe nos tokens: o GM ativo, ou quem fez a mudança se não houver GM. */
function vez(userId) {
  const gm = game.users.activeGM;
  return gm ? gm.isSelf : userId === game.user.id;
}

function adiar(chave, fn) {
  clearTimeout(pendentes.get(chave));
  pendentes.set(chave, setTimeout(() => {
    pendentes.delete(chave);
    fn().catch((err) => console.error(`${ID} |`, err));
  }, 120));
}

function agendar(actor, userId) {
  if (actor && vez(userId)) adiar(actor.uuid, () => sincronizarTokens(actor));
}

function agendarToken(token, userId) {
  if (token && vez(userId)) adiar(token.uuid, () => sincronizarToken(token));
}

function todos() {
  for (const s of game.scenes) for (const t of s.tokens) agendarToken(t, game.user.id);
}

Hooks.once("init", () => {
  registrarConfiguracoes(EditorFontes, () => todos());
  registrarHud();
  registrarChao();

  // Usar a tocha/lanterna pela ficha acende ou apaga (ataques continuam ataques). Magia: lançar acende.
  Hooks.on("dnd5e.preUseActivity", (activity) => {
    const item = activity?.item;
    if (!cfg("usarAcende") || !fonteDe(item) || ehMagia(item) || activity.type === "attack" || !podeAcender()) return;
    alternar(item);
    return false;
  });
  Hooks.on("dnd5e.postUseActivity", (activity) => {
    const item = activity?.item;
    if (!cfg("usarAcende") || !ehMagia(item) || !fonteDe(item) || aceso(item) || !podeAcender()) return;
    acender(item);
  });
  Hooks.on("dnd5e.preDisplayCard", (item) => {
    if (!cfg("usarAcende") || !fonteDe(item) || ehMagia(item) || !item.actor || !podeAcender()) return;
    alternar(item);
    return false;
  });

  // Menu de contexto do item (ficha do dnd5e e Tidy).
  Hooks.on("dnd5e.getItemContextOptions", (item, options) => {
    if (!fonteDe(item) || !item.isOwner || !item.actor || !podeAcender()) return;
    options.unshift({
      name: aceso(item) ? "Apagar" : "Acender",
      icon: `<i class="fas fa-fire${aceso(item) ? "-flame-simple" : ""}"></i>`,
      callback: () => alternar(item)
    });
  });

  // Ficha do item: acender/apagar e escolher a fonte de luz à mão.
  Hooks.on("getHeaderControlsDocumentSheetV2", (app, controls) => {
    const item = app.document;
    if (!(item instanceof Item) || !item.isOwner || !(ehMagia(item) || "quantity" in (item.system ?? {}))) return;
    if (fonteDe(item) && item.actor && podeAcender()) controls.push({ icon: "fas fa-fire", label: aceso(item) ? "Apagar" : "Acender", action: "monolithLuz", onClick: () => alternar(item) });
    if (game.user.isGM) controls.push({ icon: "fas fa-lightbulb", label: "Fonte de luz...", action: "monolithLuzFonte", onClick: () => escolherFonte(item) });
  });
});

Hooks.once("ready", async () => {
  game.modules.get(ID).api = {
    acender, apagar, alternar, alternarCobertura, aceso, fonteDe, fontes, itensDeLuz, luzDoAtor, luzDoToken,
    sincronizar: sincronizarTokens, importarTorch: importarFontesTorch, pedir, estado
  };
  registrarSocket();
  registrarSoltar();
  if (game.users.activeGM?.isSelf) {
    try { await atualizarFontes(); await migrarTorch(); } catch (err) { console.error(`${ID} | migração`, err); }
  }
  if (game.user.isGM && game.modules.get("torch")?.active) avisarTorch();
  todos();
});

// Mudou a luz de um item, ou ele entrou/saiu do inventário (soltar no chão, trocar, vender).
Hooks.on("updateItem", (item, changes, options, userId) => {
  if (!item.parent || !(item.parent instanceof Actor)) return;
  // Desequipou uma chama acesa com "só equipado": apaga.
  if (cfg("exigirEquipado") && foundry.utils.getProperty(changes, "system.equipped") === false && aceso(item) && game.users.activeGM?.isSelf) apagar(item);
  if (foundry.utils.hasProperty(changes, `flags.${ID}`) || "name" in changes || foundry.utils.hasProperty(changes, "system.quantity") || foundry.utils.hasProperty(changes, "system.equipped")) agendar(item.parent, userId);
});
Hooks.on("createItem", (item, options, userId) => { if (item.parent instanceof Actor && fonteDe(item)) agendar(item.parent, userId); });
Hooks.on("deleteItem", (item, options, userId) => { if (item.parent instanceof Actor && aceso(item)) agendar(item.parent, userId); });
// Token novo (entrar na cena, pilha no chão com uma tocha acesa).
Hooks.on("createToken", (token, options, userId) => agendarToken(token, userId));
// Objetos levados junto e luz avulsa mudam a luz do token.
Hooks.on("updateToken", (token, changes, options, userId) => {
  const f = changes.flags?.[ID];
  if (f && ("carregadas" in f || "avulsa" in f || "-=avulsa" in f)) agendarToken(token, userId);
});

// O tempo passa: a chama queima.
Hooks.on("updateWorldTime", (worldTime, delta) => {
  if (!game.users.activeGM?.isSelf) return;
  (async () => { await queimar(delta); await queimarNoChao(delta); })().catch((err) => console.error(`${ID} |`, err));
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
    content: "<p>O módulo <b>Torch</b> está ativo. Os dois mexem na luz do token e brigam entre si.</p><p>As configurações dele já foram trazidas para cá. Desativar o Torch agora? O mundo recarrega.</p>"
  }).catch(() => false);
  if (!ok) return;
  const cfgMod = foundry.utils.deepClone(game.settings.get("core", "moduleConfiguration"));
  cfgMod.torch = false;
  await game.settings.set("core", "moduleConfiguration", cfgMod);
  foundry.utils.debouncedReload();
}
