import { Ganchos as Hooks } from "../ganchos.mjs";
import { PerceptiveUtils, cModuleName } from "../utils/PerceptiveUtils.mjs";
import {cRecurso, cS, cHook, cTabID, cFlagPath, cOriginal, pFlags, flagUpdate, maximo, refreshVision, emitirSocket, envolver, canvasClass, contexto} from "../utils/PerceptiveUtils.mjs";
import { PerceptiveFlags } from "./PerceptiveFlags.mjs";
import { PerceptiveCompUtils, cDfredCE, cVision5e } from "../compatibility/PerceptiveCompUtils.mjs";

const cStealthEffectName = "Invisible"; //standard effect
const cDnD5eInvisibility = "dnd5einvisible00";
const cadvancedStealthEffectName = "Inaudible"; //necessry for some vision modules

const cUndetectedPf2eEffectID = "Compendium.pf2e.conditionitems.Item.VRSef5y1LmL2Hkjf"; //normal stealth effects of Pf2e system
const cHiddenPf2eEffectID = "Compendium.pf2e.conditionitems.Item.iU0fEDdBp3rXpTMC"//hide effect of Pf2e system

class EffectManager {
	
	//DECLARATIONS
	static async applyStealthEffects(pHider, pInfos = {}) {} //gives the rider all pEffects
	
	static async applyEffects(pToken, pNames, pInfos = {}) {} //applies effects in pNames to pToken
	
	static async removeStealthEffects(pHider, pApplyReset = false) {} //remove all effects flaged as perceptive effect
	
	static hasPerceptiveEffect(pToken) {}//returns if pToken has an perceptive marked effect
	
	static onPerceptiveEffectdeletion(pEffect, pInfos, pUserID, pActor) {} //called when an effect marked as perceptive effect is deleted
	
	//IMPLEMENTATION
	static async applyStealthEffects(pHider, pInfos = {}) {
		//Ridden Mounting Effects
		let vEffectNames = [];
		
		if (PerceptiveUtils.isPf2e() || PerceptiveCompUtils.hasactiveEffectModule()) {	
			await EffectManager.removeStealthEffects(pHider, true);
		
			vEffectNames = PerceptiveFlags.StealthEffects(pHider);
			
			if (!PerceptiveFlags.OverrideWorldSEffects(pHider)) {
				//World Mounting effects
				vEffectNames = vEffectNames.concat(PerceptiveUtils.CustomWorldStealthEffects());
				
				//Standard mounting effect
				if (game.settings.get(cModuleName, cS + "applySystemStealthEffect")) {
					if (PerceptiveUtils.isPf2e()) {
						if (pInfos.hasOwnProperty("Type")) {
							switch (pInfos.Type) {
								case "hide" : 
									vEffectNames.push(cHiddenPf2eEffectID);
									break;
								case "sneak" :
									vEffectNames.push(cUndetectedPf2eEffectID);
									break;
									
							}
						}
						else {
							vEffectNames.push(cUndetectedPf2eEffectID);
						}
					}
					
					if (PerceptiveCompUtils.hasactiveEffectModule()) {
						vEffectNames.push(cDnD5eInvisibility);
						
						if (PerceptiveCompUtils.isactiveModule(cVision5e) && game.settings.get(cModuleName, cS + "Vision5eIntegration")) {
							vEffectNames.push(cadvancedStealthEffectName);
						}
					}
				}
			}
			
			await EffectManager.applyEffects(pHider, vEffectNames, {pInfos, isStealthEffect : true});
		}
		
		if (game.settings.get(cModuleName, cS + "usePerceptiveStealthEffect")) {
			await PerceptiveFlags.setPerceptiveStealthing(pHider, true);
		}
	}
	
	static async applyEffects(pToken, pNames, pInfos = {}) {
		if (PerceptiveUtils.isPf2e()) {
			let vEffectDocuments = await PerceptiveUtils.ApplicableEffects(pNames);
			
			let vEffects = await pToken.actor.createEmbeddedDocuments("Item", vEffectDocuments);
			
			if (pInfos.isStealthEffect) {
				for (let i = 0; i < vEffects.length; i++) {
					await PerceptiveFlags.MarkasPerceptiveEffect(vEffects[i], pInfos);
				}
			}
		}
		
		if (PerceptiveCompUtils.hasactiveEffectModule()) {
			PerceptiveCompUtils.addIDNameEffects(pNames, pToken, pInfos.isStealthEffect);
		}
	}
	
	static async removeStealthEffects(pHider, pApplyReset = false) {
		if (PerceptiveUtils.isPf2e()) {
			await pHider.actor.deleteEmbeddedDocuments("Item", pHider.actor.itemTypes.effect.concat(pHider.actor.itemTypes.condition).filter(vElement => PerceptiveFlags.isPerceptiveEffect(vElement)).map(vElement => vElement.id));
		}
		
		if (PerceptiveCompUtils.hasactiveEffectModule()) {
			await PerceptiveCompUtils.RemovePerceptiveEffects(pHider);
		}
		
		if (!pApplyReset && pHider) {
			await PerceptiveFlags.setPerceptiveStealthing(pHider, false);
		}
	}
	
	static hasPerceptiveEffect(pToken) {
		if (PerceptiveUtils.isPf2e()) {
			return pToken.actor.itemTypes.effect.concat(pToken.actor.itemTypes.condition).find(vElement => PerceptiveFlags.isPerceptiveEffect(vElement))
		}
		else {
			return pToken.actor.effects.find(vEffect => PerceptiveCompUtils.isPercpetiveEffect(vEffect));
		}
	}
	
	static onPerceptiveEffectdeletion(pEffect, pInfos, pUserID, pActor) {
		if (game.user.isGM) {
			if (!pInfos[cModuleName + "delete"] && game.settings.get(cModuleName, cS + "syncEffectswithPerceptiveStealth")) {
				let vActiveScenes = game.scenes.filter(vScene => vScene.active);
				
				for (let i = 0; i < vActiveScenes.length; i++) {
					let vrelevantTokens = vActiveScenes[i].tokens.filter(vToken => vToken.actorId == pActor.id);
					
					for (let j = 0; j < vrelevantTokens.length; j++) {	
						PerceptiveFlags.setPerceptiveStealthing(vrelevantTokens[j], false);
					}
				}			
			}
		}
	}
}

Hooks.on("deleteActiveEffect", (pEffect, pInfos, pUserID) => {if (PerceptiveCompUtils.isPercpetiveEffect(pEffect)) {Hooks.call(cHook + ".PerceptiveEffectdeletion", pEffect, pInfos, pUserID, pEffect.parent)}});

Hooks.on("deleteItem", (pEffect, pInfos, pUserID) => {if (PerceptiveUtils.isPf2e() && PerceptiveFlags.isPerceptiveEffect(pEffect)) {Hooks.call(cHook + ".PerceptiveEffectdeletion", pEffect, pInfos, pUserID, pEffect.parent)}});

Hooks.on(cHook + ".PerceptiveEffectdeletion", (pEffect, pInfos, pUserID, pActor) => EffectManager.onPerceptiveEffectdeletion(pEffect, pInfos, pUserID, pActor));

export { EffectManager }