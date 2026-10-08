import { ID } from "./util.mjs";
import { configurarExaustao, registrarExaustao, configurarTidyExaustao, migrarExaustao, NIVEIS } from "./exaustao.mjs";
import { registrarModificadorEnfase, registrarEnfaseNasRolagens } from "./enfase.mjs";
import { registrarStatusQueima, registrarGanchosMedidas } from "./medidas.mjs";
import { MedidasApp, HUD, registrarBotoesDoChat } from "./apps.mjs";
import { registrarConfigSobrecarga, registrarGanchosSobrecarga, aplicarLimitesSobrecarga, avisarCargaVariante } from "./sobrecarga.mjs";

Hooks.once("init", () => {
  game.settings.register(ID, "mostrarHud", {
    name: "Mostrar o painel de Inspiração", hint: "Painel flutuante com Inspiração, Inspiração Heróica e Exaustão de cada personagem.",
    scope: "client", config: true, type: Boolean, default: true, onChange: () => HUD.montar()
  });
  game.settings.register(ID, "perdicaoVisivel", {
    name: "Jogadores veem a própria Perdição", hint: "Se desligado, só o Mestre vê a Perdição no painel de Medidas Desesperadas.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "posicaoHud", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(ID, "hudRecolhido", { scope: "client", config: false, type: Boolean, default: false });

  registrarConfigSobrecarga();
  registrarGanchosSobrecarga();
  configurarExaustao();
  registrarExaustao();
  registrarModificadorEnfase();
  registrarEnfaseNasRolagens();
  registrarStatusQueima();
  registrarGanchosMedidas();
  registrarBotoesDoChat();

  // O custom-dnd5e pode reconstruir as condições no "ready"; garante os 10 níveis.
  Hooks.on("customDnd5e.setConditionTypesConfig", (cfg) => {
    if (cfg?.exhaustion) { cfg.exhaustion.levels = NIVEIS; cfg.exhaustion.img = `modules/${ID}/icons/exhaustion.svg`; }
  });

  // Botões de cabeçalho: fichas do dnd5e e outras fichas AppV2 que não sejam Tidy.
  Hooks.on("getHeaderControlsActorSheetV2", (app, controls) => {
    if (app.options?.classes?.includes("tidy5e-sheet")) return;
    const actor = app.document;
    if (actor?.type !== "character") return;
    controls.push({ icon: "fas fa-heart-crack", label: "Medidas Desesperadas", action: "monolithMedidas", onClick: () => MedidasApp.abrir(actor) });
  });

  // Ficha Tidy 5e: botão no cabeçalho e exaustão de 10 níveis na ficha Clássica.
  Hooks.once("tidy5e-sheet.ready", (api) => {
    api.registerCharacterHeaderControls({
      controls: [{
        icon: "fas fa-heart-crack",
        label: "Medidas Desesperadas",
        position: "header",
        ownership: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
        async onClickAction() { MedidasApp.abrir(this.document ?? this.actor); }
      }]
    });
    configurarTidyExaustao(api);
  });
});

Hooks.once("setup", () => {
  aplicarLimitesSobrecarga();
});

Hooks.once("ready", async () => {
  HUD.montar();
  await migrarExaustao();
  avisarConflitos();
  avisarCargaVariante();
});

Hooks.on("updateActor", (actor) => {
  if (actor.type !== "character") return;
  HUD.render();
  MedidasApp.atualizar(actor);
});
Hooks.on("createActiveEffect", (eff) => { if (eff.parent instanceof Actor) MedidasApp.atualizar(eff.parent); });
Hooks.on("deleteActiveEffect", (eff) => { if (eff.parent instanceof Actor) MedidasApp.atualizar(eff.parent); });
Hooks.on("updateUser", () => HUD.render());

// Fim de descanso (Monolith: Resting Rules): o Fio perde falhas marcadas e as Medidas armadas expiram.
Hooks.on("monolithResting.restCompleted", async (actor, tipo, { sonoInteiro } = {}) => {
  if (!actor.isOwner || tipo === "folego") return;
  const marcadas = actor.getFlag(ID, "marcadas") ?? 0;
  const apagar = tipo === "completo" ? marcadas : sonoInteiro ? 2 : 1;
  await actor.update({ [`flags.${ID}.marcadas`]: Math.max(0, marcadas - apagar), [`flags.${ID}.armadas`]: [] });
});

async function avisarConflitos() {
  if (!game.user.isGM) return;
  const rr = game.modules.get("rest-recovery");
  if (rr?.active && game.settings.get("rest-recovery", "one-dnd-exhaustion")) {
    const ok = await foundry.applications.api.DialogV2.confirm({ classes: ["mono"], window: { title: "Monolith: Exaustão" },
      content: `<p>A opção <b>exaustão do One D&D</b> do Rest Recovery está ligada. Ela cria um segundo efeito de -1 por nível, que somaria com a Exaustão de Monolith, e apaga os efeitos de nível (desvantagem, deslocamento, PV).</p>
        <p>Desligar agora? O mundo precisa ser recarregado depois.</p>`
    }).catch(() => false);
    if (ok) {
      await game.settings.set("rest-recovery", "one-dnd-exhaustion", false);
      ui.notifications.info("Exaustão do One D&D desligada. Recarregue o mundo (F5) para aplicar.");
    }
  }
  if (game.settings.get("dnd5e", "rulesVersion") !== "legacy") {
    ui.notifications.warn("Monolith: os efeitos de nível da Exaustão dependem das regras legadas (2014) do dnd5e.");
  }
}
