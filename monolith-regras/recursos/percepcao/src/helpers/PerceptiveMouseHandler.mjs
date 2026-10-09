import { Ganchos as Hooks } from "../ganchos.mjs";
import * as FCore from "../CoreVersionComp.mjs";
import { PerceptiveUtils, cModuleName } from "../utils/PerceptiveUtils.mjs";
import {cRecurso, cS, cHook, cTabID, cFlagPath, cOriginal, pFlags, flagUpdate, maximo, refreshVision, emitirSocket, envolver, canvasClass, contexto} from "../utils/PerceptiveUtils.mjs";
import { PerceptiveCompUtils, cLibWrapper } from "../compatibility/PerceptiveCompUtils.mjs";

const cDoorScrollsTurnoff = {
	shiftKey : false,
	ctrlKey : false,
	altKey : false,
	default : true
} //keys at which canvas scrolling is turned off when a door control is hovered

const cDoorRClickTurnoff = {
	shiftKey : false,
	ctrlKey : true,
	altKey : false
} //keys at which canvas scrolling is turned off when a door control is hovered

//takes care of additional mouse handling
class PerceptiveMouseHandler {
	//DECLARATIONS
	//registers
	static RegisterControls() {} //call all register functions
	
	//doors
	static RegisterDoorLeftClick() {} //register Door leftclick
	
	static async RegisterDoorRightClick() {} //register Door reicht click
	
	static RegisterDoorWheel() {} //register Door Mousewheel
	
	//canvas
	static RegisterCanvasWheel() {} //register Door Mousewheel
	
	//ons
	static onDoorLeftClick(pDoorEvent, pWall) {} //called if Door is left clicked
	
	static async onDoorRightClick(pDoorEvent, pWall) {} //called if Door is left clicked
	
	static onDoorWheel(pDoorEvent, pWall) {} //called if Door is wheeled
	
	static onCanvasWheel(pEvent) {} //returns of event should be passed along
	
	//support
	static allowCanvasZoom(pEvent) {} //returns if the canvas should currently be zoomed
	
	//IMPLEMENTATIONS
	//registers
	static RegisterControls() {
		PerceptiveMouseHandler.RegisterDoorLeftClick();
		
		PerceptiveMouseHandler.RegisterDoorRightClick();
		
		PerceptiveMouseHandler.RegisterDoorWheel();
		
		PerceptiveMouseHandler.RegisterCanvasWheel();
	}
	
	//doors
	static RegisterDoorLeftClick() {
		const DoorControl = canvasClass("DoorControl"); //v13: foundry.canvas.containers.DoorControl
		//register onDoorLeftClick (if possible with lib-wrapper)
		/*
		if (PerceptiveCompUtils.isactiveModule(cLibWrapper)) {
			envolver("DoorControl.prototype.onclick", function(vWrapped, ...args) {LnKMouseHandler.onDoorLeftClick(...args, this.wall); return vWrapped(...args)}, "WRAPPER");
		}
		else {
		*/
		if (FCore.Fversion() > 10) {
			const vOldDoorCall = DoorControl.prototype.onclick;
			
			DoorControl.prototype.onclick = async function (pEvent) {
				if (await PerceptiveMouseHandler.onDoorLeftClick(pEvent, this.wall)) {
					if (vOldDoorCall) {
						let vDoorCallBuffer = vOldDoorCall.bind(this);
						vDoorCallBuffer(pEvent);
					}
				}
			}		

			const vOldDoorCallMD = DoorControl.prototype.onmousedown;
			
			DoorControl.prototype.onmousedown = async function (pEvent) {
				if (await PerceptiveMouseHandler.onDoorLeftClick(pEvent, this.wall)) {
					if (vOldDoorCallMD) {
						let vDoorCallBuffer = vOldDoorCallMD.bind(this);
						vDoorCallBuffer(pEvent);
					}
				}
			}				
		}
		else {
			if (PerceptiveCompUtils.isactiveModule(cLibWrapper)) {
				envolver("DoorControl.prototype._onMouseDown", async function(vWrapped, ...args) {if (await PerceptiveMouseHandler.onDoorLeftClick(...args, this.wall)){ return vWrapped(...args)}}, "MIXED");
			}
			else {
				const vOldDoorCall = DoorControl.prototype._onMouseDown;
				
				DoorControl.prototype._onMouseDown = async function (pEvent) {
					if (await PerceptiveMouseHandler.onDoorLeftClick(pEvent, this.wall)) {
					
						if (vOldDoorCall) {
							let vDoorCallBuffer = vOldDoorCall.bind(this);
							vDoorCallBuffer(pEvent);
						}
					}
				}
			}
		}
		//}		
	}
	
	static async RegisterDoorRightClick() {
		const DoorControl = canvasClass("DoorControl"); //v13: foundry.canvas.containers.DoorControl
		//register onDoorRightClick (if possible with lib-wrapper)
		if (PerceptiveCompUtils.isactiveModule(cLibWrapper)) {
			envolver("foundry.canvas.containers.DoorControl.prototype._onRightDown", async function(vWrapped, ...args) {if (await PerceptiveMouseHandler.onDoorRightClick(...args, this.wall)) {return vWrapped(...args)}}, "MIXED");
		}
		else {
			const vOldDoorCall = DoorControl.prototype._onRightDown;
			
			DoorControl.prototype._onRightDown = async function (pEvent) {
				if (await PerceptiveMouseHandler.onDoorRightClick(pEvent, this.wall)) {
				
					let vDoorCallBuffer = vOldDoorCall.bind(this);
					vDoorCallBuffer(pEvent);
				}
			}
		}		
	} 
	
	static RegisterDoorWheel() {
		const DoorControl = canvasClass("DoorControl"); //v13: foundry.canvas.containers.DoorControl
		if (PerceptiveCompUtils.isactiveModule(cLibWrapper) && false /*strange bug, turn off for now*/) {
			envolver("DoorControl.prototype.onwheel", function(vWrapped, ...args) {PerceptiveMouseHandler.onDoorWheel(...args, this.wall); return vWrapped(...args)}, "WRAPPER");
		}
		else {
			const vOldDoorCall = DoorControl.prototype.onwheel;
			
			DoorControl.prototype.onwheel = function (pEvent) {
				PerceptiveMouseHandler.onDoorWheel(pEvent, this.wall);
				
				if (vOldDoorCall) {
					let vDoorCallBuffer = vOldDoorCall.bind(this);
					vDoorCallBuffer(pEvent);
				}
			}
		}
	}
	
	//canvas
	static RegisterCanvasWheel() {
		//v13: o zoom passa por Canvas#_onMouseWheel; envolve o protótipo (o canvas ainda não existe no init)
		if (foundry.canvas?.Canvas?.prototype?._onMouseWheel) {
			envolver("foundry.canvas.Canvas.prototype._onMouseWheel", function(vWrapped, ...args) {if (PerceptiveMouseHandler.onCanvasWheel(...args)) {return vWrapped(...args)}}, "MIXED");
		}
		else {
			Hooks.once("canvasInit", () => {
				if (canvas?._onMouseWheel) envolver("canvas._onMouseWheel", function(vWrapped, ...args) {if (PerceptiveMouseHandler.onCanvasWheel(...args)) {return vWrapped(...args)}}, "MIXED");
			});
		}
	}
	
	//ons	
	static async onDoorLeftClick(pDoorEvent, pWall) {
		let vOldCall = await Hooks.call(cHook + "." + "DoorLClick", pWall.document, FCore.keysofevent(pDoorEvent));
		
		return vOldCall;
	} 
	
	static async onDoorRightClick(pDoorEvent, pWall) {
		let vOldCall = await Hooks.call(cHook + "." + "DoorRClick", pWall.document, FCore.keysofevent(pDoorEvent)); //return false to stop normal behaviour
		
		return vOldCall;
		
		/*
		if ((pDoorEvent.shiftKey && cDoorRClickTurnoff.shiftKey) || (pDoorEvent.ctrlKey && cDoorRClickTurnoff.ctrlKey) || (pDoorEvent.altKey && cDoorRClickTurnoff.altKey)) {
			return false;
		}
		else {
			return true;
		}
		*/
	}
	
	static onDoorWheel(pDoorEvent, pWall) {
		Hooks.callAll(cHook + "." + "DoorWheel", pWall.document, FCore.keysofevent(pDoorEvent), {x : pDoorEvent.deltaX, y : pDoorEvent.deltaY});
	} 
	
	static onCanvasWheel(pEvent) {
		if (PerceptiveMouseHandler.allowCanvasZoom(pEvent)) {
			return true;
		}
	}
	
	//support
	static allowCanvasZoom(pEvent) {
		if (PerceptiveUtils.hoveredWall()) {
			return false;//!((pEvent.shiftKey && cDoorScrollsTurnoff.shiftKey) || (pEvent.ctrlKey && cDoorScrollsTurnoff.ctrlKey) || (pEvent.altKey && cDoorScrollsTurnoff.altKey) || cDoorScrollsTurnoff.default); 
		}
		
		return true;
	} //returns if the canvas should currently be zoomed
}

//Hooks
Hooks.on("init", function() {
	PerceptiveMouseHandler.RegisterControls();
});

//

export function allowCanvasZoom(pEvent) {return PerceptiveMouseHandler.allowCanvasZoom(pEvent)}
