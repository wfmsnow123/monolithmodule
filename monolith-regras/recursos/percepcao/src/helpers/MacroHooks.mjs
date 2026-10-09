import { Ganchos as Hooks } from "../ganchos.mjs";
import { CheckAPerception, SpotObjectsinVision, RemoveLingeringAP} from "../SpottingScript.mjs";
import { PerceptiveSystemUtils } from "../utils/PerceptiveSystemUtils.mjs";

//functions for macros
Hooks.on("init",async function () {
	let Perception = await PerceptiveSystemUtils.SystemPerceptionMacros(CheckAPerception);
	
	//mesmo nome do original, para macros antigas continuarem funcionando
	game.Perceptive = {
		Perception,
		SpotObjectsinVision,
		RemoveLingeringAP
	};
	game.Percepcao = game.Perceptive;
});