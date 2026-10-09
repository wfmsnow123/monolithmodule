import { Ganchos as Hooks } from "../ganchos.mjs";
import { DoorMoveRequest } from "../DoorMovingScript.mjs";
import { PeekDoorRequest } from "../PeekingScript.mjs";
import { SpotObjectsRequest, resetStealthRequest, toggleDoorStateRequest, PlayerMakeTempVisible } from "../SpottingScript.mjs";
import { PopUpRequest } from "../helpers/PerceptivePopups.mjs";
import { PlaySoundRequest } from "../helpers/PerceptiveSound.mjs";

//execute functions with pData depending on pFunction
function organiseSocketEvents({pFunction, pData} = {}) {
	switch(pFunction) {
		case "DoorMoveRequest":
			DoorMoveRequest(pData);
			break;
		case "PeekDoorRequest":
			PeekDoorRequest(pData);
			break;
		case "SpotObjectsRequest":
			SpotObjectsRequest(pData);
			break;
		case "resetStealthRequest":
			resetStealthRequest(pData);
			break;
		case "toggleDoorStateRequest":
			toggleDoorStateRequest(pData);
			break;
		case "PlayerMakeTempVisible":
			PlayerMakeTempVisible(pData);
			break;
		case "PopUpRequest":
			PopUpRequest(pData);
			break;
		case "PlaySoundRequest":
			PlaySoundRequest(pData);
			break;			
	}
}

import { contexto } from "../utils/PerceptiveUtils.mjs";

Hooks.once("ready", () => { contexto()?.socket.ouvir((pMessage) => organiseSocketEvents(pMessage)); });