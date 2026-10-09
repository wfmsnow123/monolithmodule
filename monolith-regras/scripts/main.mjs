import { ID } from "./util.mjs";
import { configurarExaustao, registrarExaustao, configurarTidyExaustao, migrarExaustao, NIVEIS } from "./exaustao.mjs";
import { registrarModificadorEnfase, registrarEnfaseNasRolagens, armarEnfase, rolarEnfaseSolta } from "./enfase.mjs";
import { HUD, registrarBotoesDoChat, concederInspiracao, concederHeroica } from "./apps.mjs";
import { registrarConfigSobrecarga, registrarGanchosSobrecarga, aplicarLimitesSobrecarga, avisarCargaVariante } from "./sobrecarga.mjs";

Hooks.once("init", () => {
  game.settings.register(ID, "mostrarHud", {
    name: "Mostrar o painel de Inspiração", hint: "Painel flutuante com Inspiração, Inspiração Heróica e Exaustão de cada personagem.",
    scope: "client", config: true, type: Boolean, default: true, onChange: () => HUD.montar()
  });
  game.settings.register(ID, "hudJogadores", {
    name: "Personagens no painel dos jogadores", hint: "O Mestre sempre vê todos. 'Só os próprios' mostra ao jogador apenas os personagens dos quais ele é dono ou que estão atribuídos a ele.",
    scope: "world", config: true, type: String, default: "proprios",
    choices: { proprios: "Só os próprios", todos: "Todos os personagens de jogadores" },
    onChange: () => HUD.render()
  });
  game.settings.register(ID, "posicaoHud", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(ID, "hudRecolhido", { scope: "client", config: false, type: Boolean, default: false });

  registrarConfigSobrecarga();
  registrarGanchosSobrecarga();
  configurarExaustao();
  registrarExaustao();
  registrarModificadorEnfase();
  registrarEnfaseNasRolagens();
  registrarBotoesDoChat();

  // O custom-dnd5e pode reconstruir as condições no "ready"; garante os 10 níveis.
  Hooks.on("customDnd5e.setConditionTypesConfig", (cfg) => {
    if (cfg?.exhaustion) { cfg.exhaustion.levels = NIVEIS; cfg.exhaustion.img = `modules/${ID}/icons/exhaustion.svg`; }
  });

  // Ficha Tidy 5e: exaustão de 10 níveis na ficha Clássica.
  // As Medidas Desesperadas (coração no retrato) ficam no monolith-medidas.
  Hooks.once("tidy5e-sheet.ready", (api) => configurarTidyExaustao(api));
});

Hooks.once("setup", () => {
  aplicarLimitesSobrecarga();
});

Hooks.once("ready", async () => {
  game.modules.get(ID).api = { armarEnfase, rolarEnfaseSolta, concederInspiracao, concederHeroica };
  HUD.montar();
  await migrarExaustao();
  avisarConflitos();
  avisarCargaVariante();
});

Hooks.on("updateActor", (actor) => { if (actor.type === "character") HUD.render(); });
Hooks.on("updateUser", () => HUD.render());

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
