import { Ganchos as Hooks } from "../ganchos.mjs";
//Some basic patches to inject code into vision functions (if available via lib wrapper
import {cModuleName} from "../utils/PerceptiveUtils.mjs";
import {cRecurso, cS, cHook, cTabID, cFlagPath, cOriginal, pFlags, flagUpdate, maximo, refreshVision, emitirSocket, envolver, canvasClass, contexto} from "../utils/PerceptiveUtils.mjs";
import {PerceptiveCompUtils, cLibWrapper } from "../compatibility/PerceptiveCompUtils.mjs";

var vDCVisionFunctions = [];
var vTokenVisionFunctions = [];
var vTileVisionFunctions = [];
var vWallInclusionFunctions = [];

class PatchSupport {
	//DECLARATIONS
	static CheckTilesVisibility(pToken) {} //tests the visibility of all tile on canvas

	static WallInclusion(pWall, pBounds, pCheck) {} //returns if pWall should be included in pCheck
	
	//IMPLEMENTATIONS
	static CheckTilesVisibility(pToken) {
		let vTiles = canvas.tiles.placeables;
		
		let vBuffer;
		
		for (let i = 0; i < vTiles.length; i++) {
			for (let j = 0; j < vTileVisionFunctions.length; j++) {
				vBuffer = vTileVisionFunctions[j](vTiles[i]);
				
				if (vBuffer != undefined) {
					vTiles[i].visible = vBuffer;
					break;
				}
				
				//vTiles[i].visible = VisionUtils.simpletestVisibility(vTiles[i].center);
			}
		}
	}
	
	static WallInclusion(pWall, pBounds, pCheck) {
		let vBuffer;
		
		for (let i = 0; i < vWallInclusionFunctions.length; i++) {
			vBuffer = vWallInclusionFunctions[i](pWall, pBounds, pCheck);
			
			if (vBuffer != undefined) {
				return vBuffer;
			}
		}
	}
}

Hooks.once("ready", function() {
	//v13: caminhos novos das classes do canvas; envolver usa o libWrapper quando ativo
	envolver("foundry.canvas.placeables.Tile.prototype.isVisible", function(pWrapped, ...args) {
		let vBuffer;
		for (let i = 0; i < vTileVisionFunctions.length; i++) {
			vBuffer = vTileVisionFunctions[i](this);
			if (vBuffer != undefined) {
				return vBuffer;
			}
		}
		return pWrapped(...args);
	}, "MIXED");
	
	envolver("foundry.canvas.containers.DoorControl.prototype.isVisible", function(pWrapped, ...args) {
		let vBuffer;
		for (let i = 0; i < vDCVisionFunctions.length; i++) {
			vBuffer = vDCVisionFunctions[i](this);
			if (vBuffer != undefined) {
				return vBuffer;
			}
		}
		return pWrapped(...args);
	}, "MIXED");
	
	envolver("CONFIG.Token.objectClass.prototype.isVisible", function(pWrapped, ...args) {
		let vBuffer;
		for (let i = 0; i < vTokenVisionFunctions.length; i++) {
			vBuffer = vTokenVisionFunctions[i](this);
			if (vBuffer != undefined) {
				return vBuffer;
			}
		}
		return pWrapped(...args);
	}, "MIXED");
	
	envolver("foundry.canvas.geometry.ClockwiseSweepPolygon.prototype._testEdgeInclusion", function(pWrapped, pEdge, pEdgeType, pBounds) {
		if (pEdge.object) {
			let vBuffer = PatchSupport.WallInclusion(pEdge.object, pBounds, this);
			if (vBuffer != undefined) {
				return vBuffer;
			}
		}
		return pWrapped(pEdge, pEdgeType, pBounds);
	}, "MIXED");
});

export {vDCVisionFunctions, vTokenVisionFunctions, vTileVisionFunctions, vWallInclusionFunctions, PatchSupport}