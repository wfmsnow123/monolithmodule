import { Ganchos as Hooks } from "../ganchos.mjs";
import {PerceptiveUtils, cModuleName, Translate, TranslateandReplace} from "../utils/PerceptiveUtils.mjs";
import {cRecurso, cS, cHook, cTabID, cFlagPath, cOriginal, pFlags, flagUpdate, maximo, refreshVision, emitirSocket, envolver, canvasClass, contexto} from "../utils/PerceptiveUtils.mjs";
import {PerceptiveSystemUtils} from "../utils/PerceptiveSystemUtils.mjs";

class PerceptiveRollHandler {
	//DECLARATIONS
	static async onChatMessage(pMessage, pInfos, pSenderID) {} //called when a chatmessage is created
	
	//IMPLEMENTATIONS
	static async onChatMessage(pMessage, pInfos, pSenderID) {
		if (game.userId == pSenderID) {
			let vActorID = "";
			
			let pRollInfos = {};

			if (pMessage.actor) {
				vActorID = pMessage.actor.id;
			}
			else {
				if (pMessage.speaker) {
					vActorID = pMessage.speaker.actor;
				}
			}
			
			let vKeyboard = game.keyboard;
			

			if ((!vKeyboard.downKeys.has(game.keybindings.get(cModuleName, cS + "IgnoreRoll")[0]?.key)) ^ (game.settings.get(cModuleName, cS + "InvertIgnoreRollKey") || game.settings.get(cModuleName, cS + "ForceInvertIgnoreRollKey"))) {
				if ((game.settings.get(cModuleName, cS + "MacroSeekBehaviour") == "never") || ((game.settings.get(cModuleName, cS + "MacroSeekBehaviour") == "incombatonly") && (!pMessage.actor?.inCombat))) {
					if (PerceptiveSystemUtils.isSystemPerceptionRoll(pMessage, pRollInfos)) {
						Hooks.call(cHook + ".PerceptionRoll", vActorID, pMessage.rolls[0], pSenderID);
					}
					else {
						if (PerceptiveSystemUtils.canAutodetectSkillRolls() && pRollInfos.skill?.length > 0) {
							Hooks.call(cHook + ".PerceptionRoll", vActorID, pMessage.rolls[0], pSenderID, pRollInfos.skill);
						}
					}
				}

				if (!game.settings.get(cModuleName, cS + "UsePf2eRules")) {
					if (PerceptiveSystemUtils.isSystemStealthRoll(pMessage)) {
						Hooks.call(cHook + ".StealthRoll", vActorID, pMessage.rolls[0], pSenderID);
					}
				}
				else {
					let vPf2eRollType = PerceptiveSystemUtils.Pf2eRollType(pMessage);
					if (["sneak", "hide"].includes(vPf2eRollType)) {
						Hooks.call(cHook + ".StealthRollPf2e", vActorID, pMessage.rolls[0], vPf2eRollType, pSenderID);
					}
				}
			}
		}
	}
}

Hooks.once("ready", function() {
	if (game.settings.get(cModuleName, cS + "ActivateSpotting")) {
		Hooks.on("createChatMessage", (pMessage, pInfos, pSenderID) => {PerceptiveRollHandler.onChatMessage(pMessage, pInfos, pSenderID)});
	}
});

