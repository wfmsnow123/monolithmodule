import { Ganchos as Hooks } from "../ganchos.mjs";
import {cModuleName} from "../utils/PerceptiveUtils.mjs";
import {cRecurso, cS, cHook, cTabID, cFlagPath, cOriginal, pFlags, flagUpdate, maximo, refreshVision, emitirSocket, envolver, canvasClass, contexto} from "../utils/PerceptiveUtils.mjs";
import {PeekingIgnoreWall} from "../PeekingScript.mjs";
import {isSpottedby as isSpottedbyRAW} from "../SpottingScript.mjs";
import {PerceptiveFlags} from "../helpers/PerceptiveFlags.mjs";
import {VisionUtils} from "../utils/VisionUtils.mjs";
import {VisionChannelsUtils} from "../helpers/VisionChannelsHelper.mjs";
import {CanVCSeeObject} from "../VisionChannelsScript.mjs";
import {PatchSupport} from "../helpers/BasicPatches.mjs";
import {EffectManager} from "../helpers/EffectManager.mjs";

function objectDocument(pObject) { //for support
	let vObject = pObject;
	
	if (vObject.document) {
		vObject = vObject.document;
	}
	
	return vObject;
}

//returns if wall of pWallDoc should be ignored by Token of pTokenDoc
export function IgnoreWall(pWallDoc, pTokenDoc, pType = "sight") {	let vResult = PatchSupport.WallInclusion(pWallDoc.object, {}, {config : {type : pType, source : {object : pTokenDoc.object}}});
																	if (vResult == undefined) {
																		return false;
																	}
																	return !vResult}

export function IncludeWall(pWall, pBounds, pChek) {let vResult = PatchSupport.WallInclusion(pWall, pBounds, pChek);
													if (vResult == undefined) {
														return true;
													}
													return vResult};

//returns if pObject can be spotted by pSpotter (pCheckFOV if spotter LOS should be included in the calculations) 
export function isSpottedby(pObject, pSpotter, pChecks = {LOS : false, Range : true, Effects : true, Hidden : true, canbeSpotted : true}) {	
	return isSpottedbyRAW(objectDocument(pObject), objectDocument(pSpotter), pChecks);
}

//returns current Light level of pToken
async function LightLevel(pToken) {
	let vToken = objectDocument(pToken);
	
	if (vToken.isOwner) {
		await PerceptiveFlags.CheckLightLevel(vToken);
	}
	
	return PerceptiveFlags.LightLevel(vToken);
}


//returns current Light level modifier of pToken seen with pVisionLevel
async function LightLevelPDCModifier(pToken, pVisionLevel = 0) {	
	let vToken = objectDocument(pToken);
	
	if (vToken.isOwner) {
		await PerceptiveFlags.CheckLightLevel(vToken);
	}

	return PerceptiveFlags.getLightLevelModifier(objectDocument(vToken), pVisionLevel);
}

//returns the Lighting level at position pPosition ({x:x, y:y}), uses canvas scene if no scene is specified
function LightingLevel(pPoint, pScene = null) {
	return VisionUtils.LightingLevel(pPoint, pScene);
}

//toggles perceptive stealthing on pToken
function togglePerceptiveStealthing(pToken) {
	PerceptiveFlags.togglePerceptiveStealthing(objectDocument(pToken));
}

//sets perceptive stealthing on pToken
function setPerceptiveStealthing(pToken, pStealthing) {
	PerceptiveFlags.setPerceptiveStealthing(objectDocument(pToken), pStealthing);
}

//sets perceptive stealthing on pToken
function isPerceptiveStealthing(pToken) {
	return PerceptiveFlags.isPerceptiveStealthing(objectDocument(pToken));
}

//
function SpottablesinRange(pSpotters, pRanges = {Range : Infinity, ConeRange : 0, ConeRotation : 0}, pCategory = {Walls : true, Tokens : true}, filterSpotted = false) {
	let vScene = pSpotters[0]?.parent;
	
	let vSpottables = [];
	
	if (vScene) {
		if (pCategory.Walls) {
			vSpottables = vSpottables.concat(vScene.walls.filter(vWall => vWall.door && PerceptiveFlags.canbeSpotted(vWall)));
		}
		
		if (pCategory.Tokens) {
			vSpottables = vSpottables.concat(vScene.tokens.filter(vToken => PerceptiveFlags.canbeSpotted(vToken)));
		}
		
		if (filterSpotted) {
			vSpottables = vSpottables.filter(vObject => !PerceptiveFlags.isSpottedbyone(vObject, pSpotters));
		}
		
		let vSceneFactor = (vScene.dimensions.size)/(vScene.dimensions.distance);
		vSpottables = vSpottables.filter(vSpottable => VisionUtils.inVisionRange(pSpotters, vSpottable.object.center, pRanges.Range*vSceneFactor, pRanges.ConeRange*vSceneFactor, pRanges.ConeRotation, undefined));
	}
	
	return vSpottables;
}

//API: game.modules.get("monolith-regras").api.percepcao (no "ready", porque o main.mjs do Regras troca o api inteiro no "ready")
export const API = {};

Hooks.once("ready", () => {
	let vModule = game.modules.get(cModuleName);
	vModule.api ??= {};
	vModule.api[cRecurso] = API;
});

Hooks.once("init", () => {
	Object.assign(API, {
		PerceptiveFlags,
		VisionChannelsUtils,
		CanVCSeeObject,
		IncludeWall,
		IgnoreWall,
		isSpottedby,
		LightLevel,
		LightLevelPDCModifier,
		LightingLevel,
		togglePerceptiveStealthing,
		setPerceptiveStealthing,
		isPerceptiveStealthing,
		SpottablesinRange,
		EffectManager
	});
});