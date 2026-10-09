/**
 * Configurações do recurso Percepção.
 * Todas ficam com config: false; a janela própria (janela.mjs) mostra cada uma na sua aba.
 * Os padrões são os valores que a mesa usava no Perceptive (vendor/settings.json).
 */
import { cModuleName, cS, Translate, PerceptiveUtils } from "./src/utils/PerceptiveUtils.mjs";
import { PerceptiveSystemUtils } from "./src/utils/PerceptiveSystemUtils.mjs";
import { PerceptiveCompUtils, cArmReach, cArmReachold, cDfredCE, cCPR, cVision5e, cStealthy, cMATT } from "./src/compatibility/PerceptiveCompUtils.mjs";
import { SelectedPeekhoveredDoor } from "./src/PeekingScript.mjs";
import { MoveHoveredDoor } from "./src/DoorMovingScript.mjs";
import { resetStealthDataSelected } from "./src/SpottingScript.mjs";

const g = (k) => game.settings.get(cModuleName, cS + k);
const ativo = (m) => PerceptiveCompUtils.isactiveModule(m);
const pf2eRegras = () => g("UsePf2eRules");

/** Abas da janela, na ordem em que aparecem. */
export const ABAS = [
	{ id: "geral", icone: "fa-solid fa-gear" },
	{ id: "espiar", icone: "fa-solid fa-eye" },
	{ id: "portas", icone: "fa-solid fa-door-open" },
	{ id: "deteccao", icone: "fa-solid fa-user-ninja" },
	{ id: "canais", icone: "fa-solid fa-tower-broadcast" },
	{ id: "interface", icone: "fa-solid fa-display" }
];

/** Opções de escolha: [valor, sufixo da tradução em Settings.<chave>.options]. */
const op = (...valores) => valores.map((v) => (Array.isArray(v) ? v : [v, v]));

/**
 * Esquema de todas as configurações.
 * aba/secao: onde aparece. mostrar(): se aparece (as mesmas condições do original). recarregar: pede recarga ao mudar.
 */
export const CONFIGS = [
	// Geral
	{ chave: "SplitInteractionDistances", aba: "geral", tipo: Boolean, padrao: false, recarregar: true },
	{ chave: "InteractionDistance", aba: "geral", tipo: Number, padrao: 10, mostrar: () => !g("SplitInteractionDistances") },
	{ chave: "UseArmsreachDistance", aba: "geral", tipo: Boolean, padrao: false, mostrar: () => ativo(cArmReach) || ativo(cArmReachold) },
	{ chave: "DFredsEffectsIntegration", aba: "geral", tipo: Boolean, padrao: false, recarregar: true, mostrar: () => ativo(cDfredCE) },
	{ chave: "CPREffectsIntegration", aba: "geral", tipo: Boolean, padrao: false, recarregar: true, mostrar: () => ativo(cCPR) },
	{ chave: "Vision5eIntegration", aba: "geral", tipo: Boolean, padrao: false, mostrar: () => ativo(cVision5e) },
	{ chave: "StealthyIntegration", aba: "geral", tipo: Boolean, padrao: false, mostrar: () => ativo(cStealthy) },
	{ chave: "UsePf2eRules", aba: "geral", tipo: Boolean, padrao: false, recarregar: true, mostrar: () => PerceptiveUtils.isPf2e() },
	{ chave: "showPerceptiveWalls", aba: "geral", secao: "depuracao", tipo: Boolean, padrao: false },
	{ chave: "recreatePerceptiveWalls", aba: "geral", secao: "depuracao", tipo: Boolean, padrao: false },

	// Espiar pela fechadura
	{ chave: "Peekablebydefault", aba: "espiar", tipo: Boolean, padrao: false },
	{ chave: "LockpeekstandardSize", aba: "espiar", tipo: Number, padrao: 0.05, faixa: { min: 0, max: 1, step: 0.01 } },
	{ chave: "LockpeekstandardPosition", aba: "espiar", tipo: Number, padrao: 0.5, faixa: { min: 0, max: 1, step: 0.01 } },
	{ chave: "StopPeekonMove", aba: "espiar", tipo: Boolean, padrao: false },
	{ chave: "PeekingDistance", aba: "espiar", tipo: Number, padrao: 10, mostrar: () => g("SplitInteractionDistances") },
	{ chave: "GMConfirmPeeking", aba: "espiar", tipo: Boolean, padrao: false },
	{ chave: "PeekingFormula", aba: "espiar", tipo: String, padrao: "", mostrar: () => !pf2eRegras() },
	{ chave: "PeekingDefaultDC", aba: "espiar", tipo: Number, padrao: 0 },

	// Portas
	{ chave: "DoorstandardMove", aba: "portas", tipo: String, padrao: "none", opcoes: op("none", "swing", "slide") },
	{ chave: "PreventNormalOpenbydefault", aba: "portas", tipo: Boolean, padrao: false },
	{ chave: "DoorstandardHinge", aba: "portas", tipo: Number, padrao: 0, opcoes: op(0, 1, 2) },
	{ chave: "DoorstandardSwingSpeed", aba: "portas", tipo: Number, padrao: 5 },
	{ chave: "DoorStandardSwingRange", aba: "portas", tipo: String, padrao: "" },
	{ chave: "DoorstandardSlideSpeed", aba: "portas", tipo: Number, padrao: 0.05, passo: 0.01 },
	{ chave: "MovingDistance", aba: "portas", tipo: Number, padrao: 10, mostrar: () => g("SplitInteractionDistances") },

	// Furtividade e detecção
	{ chave: "ActivateSpotting", aba: "deteccao", tipo: Boolean, padrao: false, recarregar: true },
	{ chave: "SimulatePlayerVision", aba: "deteccao", secao: "GMuiandcontrol", tipo: Boolean, padrao: false },
	{ chave: "GMSpotconfirmDialogbehaviour", aba: "deteccao", secao: "GMuiandcontrol", tipo: String, padrao: "off", opcoes: op("off", "playersonly", "always") },
	{ chave: "ShowfailuresinGMconfirm", aba: "deteccao", secao: "GMuiandcontrol", tipo: Boolean, padrao: false },
	{ chave: "MacroSeekBehaviour", aba: "deteccao", secao: "GMuiandcontrol", tipo: String, padrao: "never", opcoes: op("never", "incombatonly", "always"), mostrar: () => PerceptiveUtils.isPf2e() },
	{ chave: "ForceInvertIgnoreRollKey", aba: "deteccao", secao: "GMuiandcontrol", tipo: Boolean, padrao: false },
	{ chave: "GMReciveInformationWhisper", aba: "deteccao", secao: "GMuiandcontrol", tipo: Boolean, padrao: true },
	{ chave: "AutomateTokenSpottable", aba: "deteccao", secao: "RulesAutomation", tipo: Boolean, padrao: false },
	{ chave: "AutoRerollPPDConMove", aba: "deteccao", secao: "RulesAutomation", tipo: Boolean, padrao: true, mostrar: () => pf2eRegras() },
	{ chave: "CritMethod", aba: "deteccao", secao: "RulesAutomation", tipo: String, padrao: "CritMethod-natCrit", opcoes: op(["CritMethod-noCrit", "noCrit"], ["CritMethod-natCrit", "natCrit"], ["CritMethod-natCritpm10", "natCritpm10"]), mostrar: () => !pf2eRegras() },
	{ chave: "resetSpottedbyMovedefault", aba: "deteccao", secao: "RulesAutomation", tipo: Boolean, padrao: false },
	{ chave: "MakeSpottedTokensVisible", aba: "deteccao", secao: "RulesAutomation", tipo: String, padrao: "never", opcoes: op("never", "always", "incombatonly", "outcombatonly") },
	{ chave: "RevealAllies", aba: "deteccao", secao: "RulesAutomation", tipo: String, padrao: "never", opcoes: op("never", "always", "incombatonly", "outcombatonly") },
	{ chave: "LingeringAP", aba: "deteccao", secao: "RulesAutomation", tipo: String, padrao: "off", opcoes: op("off", "always", "outofcombatonly") },
	{ chave: "LingeringAPRadius", aba: "deteccao", secao: "RulesAutomation", tipo: Number, padrao: -1 },
	{ chave: "LingeringAPDuration", aba: "deteccao", secao: "RulesAutomation", tipo: Number, padrao: -1 },
	{ chave: "RevealSpottedDooronClick", aba: "deteccao", secao: "RulesAutomation", tipo: Boolean, padrao: false },
	{ chave: "disableSpottableMATTTiles", aba: "deteccao", secao: "RulesAutomation", tipo: Boolean, padrao: false, mostrar: () => ativo(cMATT) },
	{ chave: "PassivePerceptionFormula", aba: "deteccao", secao: "RollFormulas", tipo: String, padrao: "@actor.system.skills.prc.passive", mostrar: () => !PerceptiveUtils.isPf2e() },
	{ chave: "PassivePerceptionProficiencyPath", aba: "deteccao", secao: "RollFormulas", tipo: String, padrao: "system.skills.prc.proficient", mostrar: () => PerceptiveSystemUtils.hasProficiencyLevels() },
	{ chave: "ActivePerceptionProficiencyPath", aba: "deteccao", secao: "RollFormulas", tipo: String, padrao: "system.skills.prc.proficient", mostrar: () => PerceptiveSystemUtils.hasProficiencyLevels() },
	{ chave: "PerceptionKeyWord", aba: "deteccao", secao: "RollFormulas", tipo: String, padrao: "Perception", mostrar: () => !PerceptiveSystemUtils.canAutodetectSkillRolls() },
	{ chave: "StealthKeyWord", aba: "deteccao", secao: "RollFormulas", tipo: String, padrao: "Stealth", mostrar: () => !PerceptiveSystemUtils.canAutodetectSkillRolls() },
	{ chave: "AutoStealthDCbehaviour", aba: "deteccao", secao: "RollFormulas", tipo: String, padrao: "both", opcoes: op("off", "both", "activeonly"), mostrar: () => !pf2eRegras() },
	{ chave: "applySystemStealthEffect", aba: "deteccao", secao: "Effects", tipo: Boolean, padrao: false, mostrar: () => (PerceptiveUtils.isPf2e() || PerceptiveCompUtils.hasactiveEffectModule()) && !pf2eRegras() },
	{ chave: "usePerceptiveStealthEffect", aba: "deteccao", secao: "Effects", tipo: Boolean, padrao: false, mostrar: () => !PerceptiveUtils.isPf2e() },
	{ chave: "PerceptiveStealthFriendliesvisible", aba: "deteccao", secao: "Effects", tipo: Boolean, padrao: false, mostrar: () => !PerceptiveUtils.isPf2e() },
	{ chave: "syncEffectswithPerceptiveStealth", aba: "deteccao", secao: "Effects", tipo: Boolean, padrao: false, mostrar: () => PerceptiveCompUtils.hasactiveEffectModule() },
	{ chave: "customStealthEffects", aba: "deteccao", secao: "Effects", tipo: String, padrao: "", mostrar: () => PerceptiveUtils.isPf2e() || PerceptiveCompUtils.hasactiveEffectModule() },
	{ chave: "customPerceptionEffect", aba: "deteccao", secao: "Effects", tipo: String, padrao: "", mostrar: () => PerceptiveUtils.isPf2e() || PerceptiveCompUtils.hasactiveEffectModule() },
	{ chave: "SpottingRange", aba: "deteccao", secao: "SightRange", tipo: Number, padrao: -1 },
	{ chave: "SpottingConeRange", aba: "deteccao", secao: "SightRange", tipo: Number, padrao: 0 },
	{ chave: "ApplyRange", aba: "deteccao", secao: "SightRange", tipo: String, padrao: "never", opcoes: op("never", "always", "activeonly", "passiveonly", "incombatonly", "outcombatonly") },
	{ chave: "UseBordertoBorderRange", aba: "deteccao", secao: "SightRange", tipo: Boolean, padrao: false },
	{ chave: "StandardVisionDirection", aba: "deteccao", secao: "SightRange", tipo: Number, padrao: 0, opcoes: op([0, "bottom"], [90, "left"], [180, "top"], [270, "right"]) },
	{ chave: "RangePDCModifier", aba: "deteccao", secao: "SightRange", tipo: String, padrao: "0/0" },
	{ chave: "Range3DCalculation", aba: "deteccao", secao: "SightRange", tipo: Boolean, padrao: false },
	{
		chave: "IlluminationPDCModifier", aba: "deteccao", secao: "Illumination", tipo: Array, padrao: [0, 0, 0], lista: "numero",
		onChange: async (pValues) => {
			if (!game.user.isGM) return;
			if (pValues.length == 1) await game.settings.set(cModuleName, cS + "IlluminationPDCModifier", String(pValues[0]).split(",").map((v) => Number(v)));
			await game.settings.set(cModuleName, cS + "useSpottingLightLevels", Boolean(g("IlluminationPDCModifier").find((v) => Number(v) != 0 && !isNaN(Number(v)))));
		}
	},
	{ chave: "UseIlluminationPDCModifierforAP", aba: "deteccao", secao: "Illumination", tipo: Boolean, padrao: true },
	{
		chave: "IlluminationAPDCBehaviour", aba: "deteccao", secao: "Illumination", tipo: Array, padrao: ["=", "="], lista: "texto", mostrar: () => !pf2eRegras(),
		onChange: async (pValues) => {
			if (!game.user.isGM) return;
			if (pValues.length == 1) await game.settings.set(cModuleName, cS + "IlluminationAPDCBehaviour", String(pValues[0]).split(","));
			await game.settings.set(cModuleName, cS + "useLightAdvantageSystem", Boolean(g("IlluminationAPDCBehaviour").find((v) => PerceptiveUtils.Rollbehaviour(v) != 0 && !isNaN(PerceptiveUtils.Rollbehaviour(v)))));
		}
	},
	{ chave: "Light3Dcalc", aba: "deteccao", secao: "Illumination", tipo: Boolean, padrao: false },
	{ chave: "SpottedSound", aba: "deteccao", secao: "SoundnImages", tipo: String, padrao: "", arquivo: "audio" },
	{ chave: "SpottedSoundVolume", aba: "deteccao", secao: "SoundnImages", tipo: Number, padrao: 1, faixa: { min: 0, max: 2, step: 0.05 } },
	{ chave: "SpotterImagePing", aba: "deteccao", secao: "SoundnImages", tipo: String, padrao: "", arquivo: "imagevideo" },
	{ chave: "SpotterImagePingDuration", aba: "deteccao", secao: "SoundnImages", tipo: Number, padrao: 1, faixa: { min: 0, max: 10, step: 0.1 } },

	// Canais de visão
	{ chave: "ActivateVCs", aba: "canais", tipo: Boolean, padrao: false, recarregar: true },
	{ chave: "SimulateVCPlayerVision", aba: "canais", tipo: Boolean, padrao: false },
	{ chave: "VCRange3DCalc", aba: "canais", tipo: Boolean, padrao: false },
	{ chave: "vRequiredOrBehaviour", aba: "canais", tipo: Boolean, padrao: false },
	{ chave: "ShowVCIDs", aba: "canais", tipo: Boolean, padrao: false },

	// Interface (de cada jogador)
	{ chave: "followTokens", aba: "interface", escopo: "client", tipo: Boolean, padrao: false },
	{ chave: "followonControl", aba: "interface", escopo: "client", tipo: Boolean, padrao: true },
	{ chave: "MessagePopUps", aba: "interface", escopo: "client", tipo: Boolean, padrao: false },
	{ chave: "moveDoorControls", aba: "interface", escopo: "client", tipo: Boolean, padrao: false },
	{ chave: "SpeedDoorMovefactor", aba: "interface", escopo: "client", tipo: Number, padrao: 3 },
	{ chave: "InvertIgnoreRollKey", aba: "interface", escopo: "client", tipo: Boolean, padrao: false, mostrar: () => !g("ForceInvertIgnoreRollKey") },
	{ chave: "IlluminationIconPosition", aba: "interface", escopo: "client", tipo: String, padrao: "none", opcoes: op("none", "left", "right") },
	{ chave: "LingeringAPIconPosition", aba: "interface", escopo: "client", tipo: String, padrao: "none", opcoes: op("none", "left", "right") },
	{ chave: "PDCInputPosition", aba: "interface", escopo: "client", tipo: String, padrao: "none", opcoes: op("none", "left", "right") },
	{ chave: "SpottingPingDuration", aba: "interface", escopo: "client", tipo: Number, padrao: 0, faixa: { min: 0, max: 10, step: 0.1 } },
	{ chave: "WhisperPerceptionResult", aba: "interface", escopo: "client", tipo: Boolean, padrao: false },
	{ chave: "WhisperLingeringAPremoval", aba: "interface", escopo: "client", tipo: Boolean, padrao: false },
	{ chave: "SpottedTokenTransparency", aba: "interface", escopo: "client", tipo: Number, padrao: 0.5, faixa: { min: 0, max: 1, step: 0.05 } },

	// Internas (sem campo na janela)
	{ chave: "lastVersion", tipo: String, padrao: "0.0.0" },
	{ chave: "useSpottingLightLevels", tipo: Boolean, padrao: false },
	{ chave: "useLightAdvantageSystem", tipo: Boolean, padrao: false },
	{ chave: "VisionChannels", tipo: Object, padrao: {} }
];

export const configsDoMundo = () => CONFIGS.filter((c) => (c.escopo ?? "world") === "world");
export const configsDoCliente = () => CONFIGS.filter((c) => c.escopo === "client");

/** Registra configurações e atalhos. Chamado no "init". */
export function registrarConfiguracoes(ctx) {
	for (const c of CONFIGS) {
		const dados = {
			name: c.aba ? Translate(`Settings.${c.chave}.name`) : c.chave,
			scope: c.escopo ?? "world",
			config: false,
			type: c.tipo,
			default: foundry.utils.deepClone(c.padrao)
		};
		if (c.onChange) dados.onChange = c.onChange;
		if (c.recarregar) dados.requiresReload = true;
		ctx.registrar(c.chave, dados);
	}
	registrarAtalhos();
}

function registrarAtalhos() {
	const kb = (k, d) => game.keybindings.register(cModuleName, cS + k, {
		name: Translate(`Keys.${k}.name`), restricted: false, precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL, ...d
	});
	kb("PeekLock", { editable: [{ key: "KeyO" }], onDown: () => { SelectedPeekhoveredDoor(); } });
	kb("MoveDoorLeft", { onDown: () => { MoveHoveredDoor(1); } });
	kb("MoveDoorRight", { onDown: () => { MoveHoveredDoor(-1); } });
	kb("ToggleTokenFollowing", { onDown: () => { game.settings.set(cModuleName, cS + "followTokens", !g("followTokens")); } });
	kb("IgnoreRoll", { hint: Translate("Keys.IgnoreRoll.descrp"), editable: [{ key: "AltLeft" }] });
	kb("resetStealthSelected", { hint: Translate("Keys.resetStealthSelected.descrp"), onDown: () => { resetStealthDataSelected(); } });
	kb("MousePeekLock", { hint: Translate("Keys.MousePeekLock.descrp"), editable: [{ key: "ControlLeft" }] });
	kb("MouseMoveDoor", { hint: Translate("Keys.MouseMoveDoor.descrp") });
	kb("MouseMoveDoorFast", { hint: Translate("Keys.MouseMoveDoorFast.descrp"), editable: [{ key: "AltLeft" }] });
	kb("EditHoveredDoor", { hint: Translate("Keys.EditHoveredDoor.descrp"), restricted: true, onDown: () => { canvas.walls.hover?.document.sheet.render(true); } });
}

/** No "ready": regras do Pf2e, formato antigo da iluminação e preferências de cliente do Perceptive. */
export async function prepararConfiguracoes(ctx) {
	if (game.user.isGM && game.users.activeGM?.isSelf) {
		if (g("UsePf2eRules")) {
			await ctx.set("applySystemStealthEffect", true);
			await ctx.set("IlluminationAPDCBehaviour", ["=", "="]);
			await ctx.set("CritMethod", "CritMethod-natCritpm10");
		}
		// Formato antigo [Penumbra, Plena] vira [Escuridão, Penumbra, Plena] (o original avisava todo mundo e falhava para jogadores)
		const v = g("IlluminationPDCModifier");
		if (Array.isArray(v) && v.length == 2 && !isNaN(v[0]) && !isNaN(v[1])) await ctx.set("IlluminationPDCModifier", [0, Number(v[0]), Number(v[1])]);
	}
	migrarPreferenciasDoCliente(ctx);
}

/** Cada navegador traz as próprias preferências do Perceptive, uma vez. */
function migrarPreferenciasDoCliente(ctx) {
	const marca = `${cModuleName}.${cS}preferenciasMigradas`;
	try {
		if (localStorage.getItem(marca)) return;
		for (const c of configsDoCliente()) {
			const bruto = localStorage.getItem(`perceptive.${c.chave}`);
			if (bruto === null || localStorage.getItem(`${cModuleName}.${cS}${c.chave}`) !== null) continue;
			let valor;
			try { valor = JSON.parse(bruto); } catch { valor = bruto; }
			ctx.set(c.chave, valor);
		}
		localStorage.setItem(marca, "1");
	} catch (err) {
		console.warn(`${cModuleName} | percepcao: preferências do Perceptive não migradas`, err);
	}
}
