import { Ganchos as Hooks } from "../ganchos.mjs";
import * as FCore from "../CoreVersionComp.mjs";
import {cModuleName, Translate, TranslateandReplace} from "../utils/PerceptiveUtils.mjs";
import {cRecurso, cS, cHook, cTabID, cFlagPath, cOriginal, pFlags, flagUpdate, maximo, refreshVision, emitirSocket, envolver, canvasClass, contexto} from "../utils/PerceptiveUtils.mjs";
import {PerceptiveFlags, cDoorMovementF, cDoorHingePositionF, cDoorSwingSpeedF, cDoorSlideSpeedF, cDoorSwingRangeF} from "../helpers/PerceptiveFlags.mjs";
import {cDoorMoveTypes, ccanbeLockpeekedF, cPeekingDCF, cLockPeekSizeF, cLockPeekPositionF, cHingePositions, cSwingSpeedRange, cPreventNormalOpenF, cSlideSpeedRange, ccanbeSpottedF, cPPDCF, cAPDCF, cPPPLF, cAPPLF, cresetSpottedbyMoveF, cStealthEffectsF, cOverrideWorldSEffectsF, cSceneBrightEndF, cSceneDimEndF, cPerceptiveStealthingF, cLockPPDCF, cotherSkillADCsF, cTilePerceptiveNameF, cSpottingRangeF, cSpottingMessageF, cRevealwhenSpottedF} from "../helpers/PerceptiveFlags.mjs";
import { VisionChannelsWindow } from "../helpers/VisionChannelsHelper.mjs";
import {WallTabInserter} from "../helpers/WallTabInserter.mjs";
import {PerceptiveUtils} from "../utils/PerceptiveUtils.mjs";
import {VisionUtils} from "../utils/VisionUtils.mjs";
import { PerceptiveCompUtils, cDfredCE, cRideable} from "../compatibility/PerceptiveCompUtils.mjs";
import {PerceptiveSystemUtils, cPf2eAPDCautomationTypes } from "../utils/PerceptiveSystemUtils.mjs";

const cPerceptiveIcon = "fa-regular fa-eye";

class PerceptiveSheetSettings {
	//DECLARATIONS	
	static WallSheetSettings(pApp, pHTML, pData) {} //add settinsg to wall sheet
	
	static async TokenSheetSettings(pApp, pHTML, pData) {} //add settinsg to token sheet
	
	static async TileSheetSettings(pApp, pHTML, pData) {} //add settinsg to tile sheet
	
	static SceneSheetSettings(pApp, pHTML, pData) {} //add settinsg to scene sheet 
	
	//dialogs
	static OpenotherSkillDCs(pApp) {} //opens a popup to enter other Skill DCs for object of pApp
	
	//standard settings
	static AddSpottableSettings(pApp, pHTML, pData, pto) {} //adds the Spottable settings to pApp
	
	static AddVCSettings(pApp, pHTML, pData, pto) {} //adds the VC settings to pApp
	
	//support
	static AddHTMLOption(pHTML, pInfos, pto) {} //adds a new HTML option to pto in pHTML
	
	static createHTMLOption(pInfos, pto, pwithformgroup = false, pAsDOM = true) {} //creates new html "code"
	
	static FixSheetWindow(pHTML, pIndentifier) {} //fixes the formating of pHTML sheet window
	
	//IMPLEMENTATIONS
	
	static WallSheetSettings(pApp, pHTML, pData) {
		if (!pHTML.querySelector(`a[data-tab="${cTabID}"]`)) {
			if (!PerceptiveFlags.isPerceptiveWall(pApp.document)) {
				//create Tabs if necessary
				WallTabInserter.InsertWallTabs(pApp, pHTML, pData);
				
				/*
				//setup
				let vprevElement = pHTML.querySelector(`fieldset.door-options`);
				if (!vprevElement.length) {
					//if door options was not found, try other search
					vprevElement = pHTML.querySelector(`select[name="ds"]`).closest(".form-group");
				}
				
				
				let vNewSection = `	<fieldset class="${cTabID}-options">
										<legend><i class="${cPerceptiveIcon}"></i> ${Translate("Titles.perceptive")}</legend>
									</fieldset>`;
									
				vprevElement.after(vNewSection);
				*/
				
				let vTabbar = pHTML.querySelector(`nav.sheet-tabs`);
				let vprevTab = pHTML.querySelector(`div[data-tab="basic"]`); //places rideable tab after last core tab "basic"
				
				let vTabButtonHTML = 	fromHTML(`
								<a class="item ${pApp.tabGroups?.sheet == cTabID ? 'active' : ''}" data-tab="${cTabID}" ${game.release.generation <= 12 ? '' : 'data-group="sheet"'}>
									<i class="${cPerceptiveIcon}"></i>
									${Translate("Titles.perceptive")}
								</a>
								`); //tab button HTML
				let vTabContentHTML = fromHTML(`<div class="tab ${pApp.tabGroups?.sheet == cTabID ? 'active' : ''} scrollable" ${game.release.generation <= 12 ? '' : 'data-group="sheet"'} data-tab="${cTabID}"></div>`); //tab content sheet HTML
				
				vTabbar.append(vTabButtonHTML);
				vprevTab.after(vTabContentHTML);	
				
				/*
				let vCollapse = `<details>
							<summary>${Translate("Titles."+"test")}</summary>
							<div content=${"test"}>
							</div>
						</details>`;
						
				pHTML.querySelector(`div[data-tab="${cTabID}"]`).append(vCollapse);
				*/
						
				
				
				//wall can be lockpeeked
				PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ ccanbeLockpeekedF +".name"), 
															vhint : Translate("SheetSettings."+ ccanbeLockpeekedF +".descrp"), 
															vtype : "checkbox", 
															vvalue : PerceptiveFlags.canbeLockpeeked(pApp.document), 
															vflagname : ccanbeLockpeekedF
															}, `div[data-tab="${cTabID}"]`);
															
				//lock peeking dc
				PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cPeekingDCF +".name"), 
															vhint : Translate("SheetSettings."+ cPeekingDCF +".descrp"), 
															vtype : "number", 
															vvalue : PerceptiveFlags.PeekingDC(pApp.document, true), 
															vflagname : cPeekingDCF
															}, `div[data-tab="${cTabID}"]`);
															
				//lock peeking size
				PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cLockPeekSizeF +".name"), 
															vhint : Translate("SheetSettings."+ cLockPeekSizeF +".descrp"), 
															vtype : "range", 
															vrange : [0,1],
															vvalue : PerceptiveFlags.LockPeekingSize(pApp.document), 
															vstep : 0.01,
															vflagname : cLockPeekSizeF
															}, `div[data-tab="${cTabID}"]`);
															
				//lock peeking position
				PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cLockPeekPositionF +".name"), 
															vhint : Translate("SheetSettings."+ cLockPeekPositionF +".descrp"), 
															vtype : "range", 
															vrange : [0,1],
															vvalue : PerceptiveFlags.LockPeekingPosition(pApp.document), 
															vstep : 0.01,
															vflagname : cLockPeekPositionF
															}, `div[data-tab="${cTabID}"]`);
				
				//wall movement type
				PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cDoorMovementF +".name"), 
															vhint : Translate("SheetSettings."+ cDoorMovementF +".descrp"), 
															vtype : "select", 
															voptions : cDoorMoveTypes,
															vvalue : PerceptiveFlags.DoorMovementType(pApp.document), 
															vflagname : cDoorMovementF
															}, `div[data-tab="${cTabID}"]`);
															
				//prevent normal open if applicable
				PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cPreventNormalOpenF +".name"), 
															vhint : Translate("SheetSettings."+ cPreventNormalOpenF +".descrp"), 
															vtype : "checkbox", 
															vvalue : PerceptiveFlags.PreventNormalOpen(pApp.document, true), 
															vflagname : cPreventNormalOpenF
															}, `div[data-tab="${cTabID}"]`);

				//wall hinge position
				PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cDoorHingePositionF +".name"), 
															vhint : Translate("SheetSettings."+ cDoorHingePositionF +".descrp"), 
															vtype : "select", 
															voptions : cHingePositions,
															vvalue : PerceptiveFlags.DoorHingePosition(pApp.document), 
															vflagname : cDoorHingePositionF
															}, `div[data-tab="${cTabID}"]`);
													
				//wall swing speed
				PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cDoorSwingSpeedF +".name"), 
															vhint : Translate("SheetSettings."+ cDoorSwingSpeedF +".descrp"), 
															vtype : "number", 
															//vrange : cSwingSpeedRange,
															vvalue : PerceptiveFlags.getDoorSwingSpeed(pApp.document), 
															vflagname : cDoorSwingSpeedF
															}, `div[data-tab="${cTabID}"]`);
															
				//wall swing range
				PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cDoorSwingRangeF +".name"), 
															vhint : Translate("SheetSettings."+ cDoorSwingRangeF +".descrp"), 
															vtype : "numberinterval", 
															//vrange : cSwingSpeedRange,
															vvalue : PerceptiveFlags.getDoorSwingRange(pApp.document), 
															vflagname : [cDoorSwingRangeF, cDoorSwingRangeF],
															}, `div[data-tab="${cTabID}"]`);
															
				//wall slide speed
				PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cDoorSlideSpeedF +".name"), 
															vhint : Translate("SheetSettings."+ cDoorSlideSpeedF +".descrp"), 
															vtype : "number", 
															//vrange : cSlideSpeedRange,
															vvalue : PerceptiveFlags.getDoorSlideSpeed(pApp.document), 
															vstep : 0.01,
															vflagname : cDoorSlideSpeedF
															}, `div[data-tab="${cTabID}"]`);
								
				if (game.settings.get(cModuleName, cS + "ActivateSpotting")) {			
					PerceptiveSheetSettings.AddSpottableSettings(pApp, pHTML, pData, `div[data-tab="${cTabID}"]`);
					
					//infos 
					pHTML.querySelector(`div[data-tab="${cTabID}"]`).append(fromHTML(`<p>${Translate("Titles.SpottingInfos.Title")}</p>`));
					
					pHTML.querySelector(`div[data-tab="${cTabID}"]`).append(fromHTML(`<p class="hint">${TranslateandReplace("Titles.SpottingInfos.Spottedby", {pNames : PerceptiveFlags.SpottedbyNames(pApp.document)})}</p>`));
					
					Hooks.call(cHook + ".WallSpottingSettings", pApp, pHTML, pData);
				}
				
				if (game.settings.get(cModuleName, cS + "ActivateVCs")) {
					PerceptiveSheetSettings.AddVCSettings(pApp, pHTML, pData, `div[data-tab="${cTabID}"]`);
				}
			}
		}
	}
	
	static async TokenSheetSettings(pApp, pHTML, pData) {
		if (!pHTML.querySelector(`a[data-tab="${cTabID}"]`)) {
			if (!pApp.document) {
				if (pApp.actor) {
					pApp.document = pApp.actor.prototypeToken;
				}
			}
			
			if (game.user.isGM) {
				if (game.settings.get(cModuleName, cS + "ActivateSpotting") || game.settings.get(cModuleName, cS + "ActivateVCs")) {
					//add new tab
					let vTabbar = pHTML.querySelector(`nav.sheet-tabs`);
					let vprevTab = pHTML.querySelector(`div[data-tab="resources"]`); //places perceptive tab after last core tab "details"
					
					let vTabButtonHTML = 	fromHTML(`
									<a class="item ${pApp.tabGroups?.sheet == cTabID ? 'active' : ''}" data-action="tab" ${game.release.generation <= 12 ? 'data-group="main"' : 'data-group="sheet"'} data-tab="${cTabID}">
										<i class="fas ${cPerceptiveIcon}"></i>
										${Translate("Titles.perceptive")}
									</a>
									`); //tab button HTML
					let vTabContentHTML = fromHTML(`<div class="tab ${pApp.tabGroups?.sheet == cTabID ? 'active' : ''} scrollable" ${game.release.generation <= 12 ? 'data-group="main"' : 'data-group="sheet"'} data-tab="${cTabID}"></div>`); //tab content sheet HTML
					
					vTabbar.append(vTabButtonHTML);
					vprevTab.after(vTabContentHTML);	
				}
				
				if (game.settings.get(cModuleName, cS + "ActivateSpotting")) {
					
					if (game.settings.get(cModuleName, cS + "usePerceptiveStealthEffect") || PerceptiveFlags.isPerceptiveStealthing(pApp.document)) {
						//if this token is perceptive stealthing
						PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cPerceptiveStealthingF +".name"), 
															vhint : Translate("SheetSettings."+ cPerceptiveStealthingF +".descrp"), 
															vtype : "checkbox", 
															vvalue : PerceptiveFlags.isPerceptiveStealthing(pApp.document), 
															vflagname : cPerceptiveStealthingF
															}, `div[data-tab="${cTabID}"]`);
					}
														
					//standard settings
					PerceptiveSheetSettings.AddSpottableSettings(pApp, pHTML, pData, `div[data-tab="${cTabID}"]`);
					
					if (game.settings.get(cModuleName, cS + "UsePf2eRules") && game.settings.get(cModuleName, cS + "AutoRerollPPDConMove")) {
						//lock APDC against move refreshes
						PerceptiveSheetSettings.AddHTMLOption(pHTML, {	vlabel : Translate("SheetSettings."+ cLockPPDCF +".name"), 
																		vhint : Translate("SheetSettings."+ cLockPPDCF +".descrp"), 
																		vtype : "checkbox", 
																		vvalue : PerceptiveFlags.PPDCLocked(pApp.document), 
																		vflagname : cLockPPDCF
																		}, `div[data-tab="${cTabID}"]`);	
					}
					
					//reset spotted by on move
					PerceptiveSheetSettings.AddHTMLOption(pHTML, {	vlabel : Translate("SheetSettings."+ cresetSpottedbyMoveF +".name"), 
																	vhint : Translate("SheetSettings."+ cresetSpottedbyMoveF +".descrp"), 
																	vtype : "checkbox", 
																	vvalue : PerceptiveFlags.resetSpottedbyMove(pApp.document), 
																	vflagname : cresetSpottedbyMoveF
																	}, `div[data-tab="${cTabID}"]`);
									
					if (PerceptiveUtils.isPf2e() || game.settings.get(cModuleName, cS + "DFredsEffectsIntegration")) {
						//stealth effects
						PerceptiveSheetSettings.AddHTMLOption(pHTML, {	vlabel : Translate("SheetSettings."+ cStealthEffectsF +".name"), 
																		vhint : Translate("SheetSettings."+ cStealthEffectsF +".descrp"), 
																		vtype : "text", 
																		vwide : true,
																		vvalue : PerceptiveFlags.StealthEffects(pApp.document, true), 
																		vflagname : cStealthEffectsF
																		}, `div[data-tab="${cTabID}"]`);			

						//stealth effects override
						PerceptiveSheetSettings.AddHTMLOption(pHTML, {	vlabel : Translate("SheetSettings."+ cOverrideWorldSEffectsF +".name"), 
																		vhint : Translate("SheetSettings."+ cOverrideWorldSEffectsF +".descrp"), 
																		vtype : "checkbox", 
																		vwide : true,
																		vvalue : PerceptiveFlags.OverrideWorldSEffects(pApp.document), 
																		vflagname : cOverrideWorldSEffectsF
																		}, `div[data-tab="${cTabID}"]`);
					}
									
					//infos 
					pHTML.querySelector(`div[data-tab="${cTabID}"]`).append(fromHTML(`<p>${Translate("Titles.SpottingInfos.Title")}</p>`));
					
					pHTML.querySelector(`div[data-tab="${cTabID}"]`).append(fromHTML(`<p class="hint">${TranslateandReplace("Titles.SpottingInfos.PP", {pValue :  await VisionUtils.PassivPerception(pApp.document)})}</p>`));
					
					pHTML.querySelector(`div[data-tab="${cTabID}"]`).append(fromHTML(`<p class="hint">${TranslateandReplace("Titles.SpottingInfos.Spottedby", {pNames : PerceptiveFlags.SpottedbyNames(pApp.document)})}</p>`));
					
					pHTML.querySelector(`div[data-tab="${cTabID}"]`).append(fromHTML(`<p class="hint">${TranslateandReplace("Titles.SpottingInfos.LightModifier", {pValue :  PerceptiveFlags.getLightLevelModifier(pApp.document)})}</p>`));
					
					if (!game.settings.get(cModuleName, cS + "UsePf2eRules")) {
						pHTML.querySelector(`div[data-tab="${cTabID}"]`).append(fromHTML(`<p class="hint">${TranslateandReplace("Titles.SpottingInfos.LightRollBehaviour", {pBehaviour :  PerceptiveFlags.getAPRollBehaviour(pApp.document)})}</p>`));
					}
					
					pHTML.querySelector(`div[data-tab="${cTabID}"]`).append(fromHTML(`<p class="hint">${TranslateandReplace("Titles.SpottingInfos.VisionLevel.name", {pLevel : Translate("Titles.SpottingInfos.VisionLevel.value" + VisionUtils.VisionLevel(pApp.document))})}</p>`));
				
					Hooks.call(cHook + ".TokenSpottingSettings", pApp, pHTML, pData);
				}

				if (game.settings.get(cModuleName, cS + "ActivateVCs")) {
					PerceptiveSheetSettings.AddVCSettings(pApp, pHTML, pData, `div[data-tab="${cTabID}"]`);
				}			
			}
			
			PerceptiveSheetSettings.FixSheetWindow(pApp.element, `nav.sheet-tabs`);
		}
	}
	
	static async TileSheetSettings(pApp, pHTML, pData) {
		if (game.user.isGM) {
			if (!pHTML.querySelector(`a[data-tab="${cTabID}"]`)) {
				const cCreateTab = !pHTML.querySelector(`div[data-tab="${cTabID}"]`);
				
				if (game.settings.get(cModuleName, cS + "ActivateSpotting") || game.settings.get(cModuleName, cS + "ActivateVCs")) {
					//add new tab
					let vTabbar = pHTML.querySelector(`nav.sheet-tabs`);
					let vprevTab = pHTML.querySelector(`div[data-tab="overhead"]`);//pHTML.querySelector(`div[data-tab="animation"]`); //places perceptive tab after last core tab "details"
					
					let vTabButtonHTML = 	fromHTML(`
									<a class="item ${pApp.tabGroups?.sheet == cTabID ? 'active' : ''}" data-action="tab" ${game.release.generation <= 12 ? 'data-group="main"' : 'data-group="sheet"'} data-tab="${cTabID}">
										<i class="fas ${cPerceptiveIcon}"></i>
										${Translate("Titles.perceptive")}
									</a>
									`); //tab button HTML
					let vTabContentHTML = fromHTML(`<div class="tab ${pApp.tabGroups?.sheet == cTabID ? 'active' : ''} scrollable" ${game.release.generation <= 12 ? '' : 'data-group="sheet"'} data-tab="${cTabID}"></div>`); //tab content sheet HTML
					
					vTabbar.append(vTabButtonHTML);
					if (cCreateTab) vprevTab.after(vTabContentHTML);
				}
				
				if (cCreateTab) {
					if (game.settings.get(cModuleName, cS + "ActivateSpotting")) {							
						//Tile name for perceptive purposes (possible rideable synch)
						PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cTilePerceptiveNameF +".name"), 
																		vhint : Translate("SheetSettings."+ cTilePerceptiveNameF +".descrp"), 
																		vtype : "text", 
																		vwide : true,
																		vvalue : PerceptiveFlags.PerceptiveName(pApp.document),
																		vflagname : cTilePerceptiveNameF
																		}, `div[data-tab="${cTabID}"]`);	
																	
						//standard settings
						PerceptiveSheetSettings.AddSpottableSettings(pApp, pHTML, pData, `div[data-tab="${cTabID}"]`);	
						
						//infos 
						pHTML.querySelector(`div[data-tab="${cTabID}"]`).append(fromHTML(`<p>${Translate("Titles.SpottingInfos.Title")}</p>`));
						
						pHTML.querySelector(`div[data-tab="${cTabID}"]`).append(fromHTML(`<p class="hint">${TranslateandReplace("Titles.SpottingInfos.Spottedby", {pNames : PerceptiveFlags.SpottedbyNames(pApp.document)})}</p>`));
						
						Hooks.call(cHook + ".TileSpottingSettings", pApp, pHTML, pData);
					}
					
					if (game.settings.get(cModuleName, cS + "ActivateVCs")) {
						PerceptiveSheetSettings.AddVCSettings(pApp, pHTML, pData, `div[data-tab="${cTabID}"]`);
					}
				}
			}
		}
		
		
		PerceptiveSheetSettings.FixSheetWindow(pApp.element, `nav.sheet-tabs`);
	}
	
	static SceneSheetSettings(pApp, pHTML, pData) {
			//create title (under which all settings are placed)
			let vTittleHTML = fromHTML(`<fieldset data-group="${cTabID}" name="BrightDimEnd"><legend><p><i class="fas ${cPerceptiveIcon}"></i>  ${Translate("Titles.perceptive")}</p> </legend></fieldset>`);
			
			if (pHTML.querySelector('input[name="darkness"]')) {
				pHTML.querySelector('input[name="darkness"]').closest(".form-group").after(vTittleHTML);
			} 
			else {
				pHTML.querySelector('input[name="environment.darknessLock"]').closest(".form-group").after(vTittleHTML);
			}
			
			//scene bright end
			PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cSceneBrightEndF +".name"), 
														vhint : Translate("SheetSettings."+ cSceneBrightEndF +".descrp"), 
														vtype : "range", 
														vrange : [0, 1],
														vstep : 0.01,
														vvalue : PerceptiveFlags.SceneBrightEnd(pApp.document), 
														vflagname : cSceneBrightEndF
														}, `fieldset[data-group="${cTabID}"]`);
														
			//scene dim end
			PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cSceneDimEndF +".name"), 
														vhint : Translate("SheetSettings."+ cSceneDimEndF +".descrp"), 
														vtype : "range", 
														vrange : [0, 1],
														vstep : 0.01,
														vvalue : PerceptiveFlags.SceneDimEnd(pApp.document), 
														vflagname : cSceneDimEndF
														}, `fieldset[data-group="${cTabID}"]`);
	}
	
	//dialogs
	static OpenotherSkillDCs(pApp) {
		let vSkillsObject = CONFIG[game.system.id.toUpperCase()]?.skills || game.model?.Actor?.character?.skills;
		
		if (vSkillsObject) {
			let vSkills = Object.keys(vSkillsObject);
			
			let vContent = `<p> ${Translate("SheetSettings."+ cotherSkillADCsF +".name")} </p>`;
			
			for (let vSkill of vSkills) {
				vContent = vContent + PerceptiveSheetSettings.createHTMLOption({	vlabel : TranslateandReplace("SheetSettings."+ cotherSkillADCsF +".entry", {pSkill : vSkill}), 
																					//vhint : Translate("SheetSettings."+ vsubFlagname +".descrp"), 
																					vtype : "text", 
																					vvalue : PerceptiveFlags.getotherSkillADC(pApp.object || pApp.document, vSkill, true),
																					vflagname : cotherSkillADCsF + "." + vSkill,
																					vID : vSkill
																					}, true, false);
			}

			//v13: DialogV2 no lugar do Dialog v1
			foundry.applications.api.DialogV2.wait({
				classes : ["mono"],
				window : {title : Translate("SheetSettings."+ cotherSkillADCsF + ".Title"), icon : "fa-regular fa-eye"},
				position : {width : 420},
				content : `<div class="percepcao-pericias">${vContent}</div>`,
				rejectClose : false,
				buttons : [{
					action : "confirmButton",
					label : Translate("SheetSettings."+ cotherSkillADCsF + ".confirmButtonname"),
					icon : `fas ${cPerceptiveIcon}`,
					default : true,
					callback : (pEvent, pButton, pDialog) => {
						let vRoot = pButton?.form ?? pDialog?.element;
						let vInputs = {};
						for (let vSkill of vSkills) {
							vInputs[vSkill] = vRoot?.querySelector(`input[id="${vSkill}"]`)?.value;
						}
						PerceptiveFlags.setotherSkillADCs(pApp.object || pApp.document, vInputs);
					}
				}]
			});
		}
	}
	
	//standard settings
	static AddSpottableSettings(pApp, pHTML, pData, pto) {
		//can be spotted
		PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ ccanbeSpottedF +".name"), 
													vhint : Translate("SheetSettings."+ ccanbeSpottedF +".descrp"), 
													vtype : "checkbox", 
													vvalue : PerceptiveFlags.canbeSpotted(pApp.document), 
													vflagname : ccanbeSpottedF
													}, pto);
													
		//reveal when spotted
		PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cRevealwhenSpottedF +".name"), 
													vhint : Translate("SheetSettings."+ cRevealwhenSpottedF +".descrp"), 
													vtype : "checkbox", 
													vvalue : PerceptiveFlags.RevealwhenSpotted(pApp.document), 
													vflagname : cRevealwhenSpottedF
													}, pto);
													
		//passive perception dc
		PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cPPDCF +".name"), 
													vhint : Translate("SheetSettings."+ cPPDCF +".descrp"), 
													vtype : "number", 
													vvalue : PerceptiveFlags.getPPDC(pApp.document, true), 
													vflagname : cPPDCF
													}, pto);
													
		//required proficiency for passive perception
		if (PerceptiveSystemUtils.hasProficiencyLevels()) {
			PerceptiveSheetSettings.AddHTMLOption(pHTML, {	vlabel : Translate("SheetSettings."+ cPPPLF +".name"), 
														vhint : Translate("SheetSettings."+ cPPPLF +".descrp." + game.system.id), 
														vtype : "number",
														vstep : 0.5,												
														vvalue : PerceptiveFlags.getPPPL(pApp.document), 
														vflagname : cPPPLF
														}, `div[data-tab="${cTabID}"]`);	
		}
					
		//active perception dc
		PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cAPDCF +".name"), 
													vhint : Translate("SheetSettings."+ cAPDCF +".descrp"), 
													vtype : "number", 
													vlocked : game.settings.get(cModuleName, cS + "UsePf2eRules") && cPf2eAPDCautomationTypes.includes(pApp.document.actor?.type),
													vvalue : PerceptiveFlags.getAPDC(pApp.document, true), 
													vflagname : cAPDCF
													}, pto);
						
		//required proficiency for active perception
		if (PerceptiveSystemUtils.hasProficiencyLevels()) {
			PerceptiveSheetSettings.AddHTMLOption(pHTML, {	vlabel : Translate("SheetSettings."+ cAPPLF +".name"), 
														vhint : Translate("SheetSettings."+ cAPPLF +".descrp." + game.system.id), 
														vtype : "number",
														vstep : 0.5,	
														vvalue : PerceptiveFlags.getAPPL(pApp.document), 
														vflagname : cAPPLF
														}, `div[data-tab="${cTabID}"]`);	
		}
													
		//custom spotting range 
		PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cSpottingRangeF +".name"), 
													vhint : Translate("SheetSettings."+ cSpottingRangeF +".descrp"), 
													vtype : "number", 
													vvalue : PerceptiveFlags.SpottingRange(pApp.document), 
													vflagname : cSpottingRangeF
													}, pto);
													
		if (PerceptiveSystemUtils.canAutodetectSkillRolls()) {
			//other skill dcs menu button
			let vSkillsButton = fromHTML(`<button id = "${cTabID}.otherSkillDCs"> ${Translate("SheetSettings." + cotherSkillADCsF + ".openButtonname")} </button>`);
			pHTML.querySelector(pto).append(vSkillsButton);
			vSkillsButton.onclick = function() {PerceptiveSheetSettings.OpenotherSkillDCs(pApp)};
		}
		
		let vResetButton = fromHTML(`<button id = "${cTabID}.ResetSpottedby"> ${Translate("Titles.ResetSpottedby")} </button>`);
		pHTML.querySelector(pto).append(vResetButton);
		vResetButton.onclick = function() {PerceptiveFlags.clearSpottedby(pApp.document);};	

		//spotting message 
		PerceptiveSheetSettings.AddHTMLOption(pHTML, {vlabel : Translate("SheetSettings."+ cSpottingMessageF +".name"), 
													vhint : Translate("SheetSettings."+ cSpottingMessageF +".descrp"), 
													vtype : "text", 
													vwide : true,
													vvalue : PerceptiveFlags.SpottingMessage(pApp.document), 
													vflagname : cSpottingMessageF
													}, pto);
									
	}
	
	static AddVCSettings(pApp, pHTML, pData, pto) {
			let vVCMenuButton = fromHTML(`<button name = "${cTabID}.openVCMenu"> ${Translate("Titles.OpenVCMenu")} </button>`);
			pHTML.querySelector(pto).append(vVCMenuButton);
			vVCMenuButton.onclick = function() {new VisionChannelsWindow(pApp.document).render(true);};		
	}
	
	//support
	static AddHTMLOption(pHTML, pInfos, pto) {
		pHTML.querySelector(pto/*`div[data-tab="${cTabID}"]`*/).append(PerceptiveSheetSettings.createHTMLOption(pInfos))
	}
	
	static createHTMLOption(pInfos, pwithformgroup = false, pAsDOM = true) {
		let vlabel = "Name";	
		if (pInfos.hasOwnProperty("vlabel")) {
			vlabel = pInfos.vlabel;
		}
		
		let vID = "Name";	
		if (pInfos.hasOwnProperty("vID")) {
			vID = pInfos.vID;
		}
		
		let vtype = "text";	
		if (pInfos.hasOwnProperty("vtype")) {
			vtype = pInfos.vtype;
		}
		
		let vvalue = "";	
		if (pInfos.hasOwnProperty("vvalue")) {
			vvalue = pInfos.vvalue;
		}
		
		let vstep = 1;	
		if (pInfos.hasOwnProperty("vstep")) {
			vstep = pInfos.vstep;
		}
		
		let vflagname = "";	
		if (pInfos.hasOwnProperty("vflagname")) {
			vflagname = pInfos.vflagname;
		}
		
		let vhint = "";	
		if (pInfos.hasOwnProperty("vhint")) {
			vhint = pInfos.vhint;
		}
		
		let vunits = "";	
		if (pInfos.hasOwnProperty("vunits")) {
			vunits = pInfos.vunits;
		} 
		
		let voptions = [];
		if (pInfos.hasOwnProperty("voptions")) {
			voptions = pInfos.voptions;
		} 
		
		let voptionsName = vflagname;
		if (pInfos.hasOwnProperty("voptionsName")) {
			voptionsName = pInfos.voptionsName;
		} 
		
		let vrange = [0, 0];
		if (pInfos.hasOwnProperty("vrange")) {
			vrange = pInfos.vrange;
		} 
		
		let vlockedstate = "";
		if (pInfos.hasOwnProperty("vlocked") && pInfos.vlocked) {
			vlockedstate = "disabled";
		}
		
		let vnewHTML = ``;
		
		if (pwithformgroup) {
			vnewHTML = vnewHTML + `<div class="form-group">`;
		}
		
		if (!(pInfos.hasOwnProperty("vwide") && pInfos.vwide)) {
			vnewHTML = `
				<div class="form-group slim">
					<label>${vlabel}</label>
				<div class="form-fields">
			`;
		}
		else {//for wide imputs
			vnewHTML = `
				<div class="form-group">
					<label>${vlabel}</label>
				<div class="form-fields">
			`;
		}
		
		let vfullflagname;
		
		if (pInfos.hasOwnProperty("vfullflagname")) {
			vfullflagname = pInfos.vfullflagname;
		}
		else {
			vfullflagname = cModuleName + "." + cRecurso + "." + vflagname;
		}
		
		let vNumberSeperator;
		
		switch (vtype){
			case "numberpart":
				vNumberSeperator = "/";
				break;
			case "numberinterval":
				vNumberSeperator = "-";
				break;
		}
				
		switch (vtype){
			case "number":
				vnewHTML = vnewHTML + `<input type=${vtype} name="flags.${vfullflagname}" id=${vID} value="${vvalue}" step="${vstep}" ${vlockedstate}>`;
				break;
			case "text":
				vnewHTML = vnewHTML + `<input type=${vtype} name="flags.${vfullflagname}" id=${vID} value="${vvalue}" ${vlockedstate}>`;
				break;
				
			case "checkbox":
				if (vvalue) {
					vnewHTML = vnewHTML + `<input type=${vtype} name="flags.${vfullflagname}" id=${vID} checked ${vlockedstate}>`;
				}
				else {
					vnewHTML = vnewHTML + `<input type=${vtype} name="flags.${vfullflagname}" id=${vID} ${vlockedstate}>`;
				}
				break;
				
			case "select":
				vnewHTML = vnewHTML + `<select name="flags.${vfullflagname}" ${vlockedstate}>`;
				
				for (let i = 0; i < voptions.length; i++) {
					if (voptions[i] == vvalue) {
						vnewHTML = vnewHTML + `<option value="${voptions[i]}" selected>${Translate("SheetSettings." + voptionsName+ ".options." + voptions[i])}</option>`;
					}
					else {
						vnewHTML = vnewHTML + `<option value="${voptions[i]}">${Translate("SheetSettings." + voptionsName+ ".options." + voptions[i])}</option>`;
					}
				}
				
				vnewHTML = vnewHTML + `</select>`;
				break;
			case "range":
				if (game.release.generation <= 12) {
					vnewHTML = vnewHTML + 	`<input type=${vtype} name="flags.${vfullflagname}" id=${vID} value="${vvalue}" min="${vrange[0]}" max="${vrange[1]}" step="${vstep}" ${vlockedstate}>
											<span class="${vtype}-value">${vvalue}</span>`;
				}
				else {
					vnewHTML = vnewHTML + 	`<range-picker name="flags.${vfullflagname}" id="flags.${vfullflagname}" value="${vvalue}" min="${vrange[0]}" max="${vrange[1]}" step="${vstep}">
												<input type="range" min="${vrange[0]}" max="${vrange[1]}" step="${vstep}">
												<input type="number" min="${vrange[0]}" max="${vrange[1]}" step="${vstep}">
											</range-picker>`
				}
				break;
			case "numberpart":
			case "numberinterval":
				vnewHTML = vnewHTML + `<input type=number name="${cFlagPath}.${vflagname[0]}" id=${vID} value="${vvalue[0]}" ${vlockedstate}><label>${vNumberSeperator}</label><input type=number name="${cFlagPath}.${vflagname[1]}" id=${vID} value="${vvalue[1]}" ${vlockedstate}>`;
				break;
			case "numberxy":
				vnewHTML = vnewHTML + `<label>x:</label><input type=number name="${cFlagPath}.${vflagname[0]}" id=${vID} value="${vvalue[0]}" ${vlockedstate}><label>y:</label><input type=number name="${cFlagPath}.${vflagname[1]}" id=${vID} value="${vvalue[1]}" ${vlockedstate}>`;
				break;
		}
			
		vnewHTML = vnewHTML + `</div>`;
		
		if (vhint != "") {
			vnewHTML = vnewHTML + `<p class="hint">${vhint}</p>`;
		}
		
		vnewHTML = vnewHTML + `</div>`;
		
		//pHTML.querySelector('[name="RideableTitle"]').after(vnewHTML);
		//pHTML.querySelector(pto/*`div[data-tab="${cTabID}"]`*/).append(vnewHTML);
		return pAsDOM ? fromHTML(vnewHTML) : vnewHTML;
	}
	
	static FixSheetWindow(pHTML, pIndentifier) {
		if (!pHTML.nodeType) pHTML = pHTML[0];
		
		if (!pHTML?.querySelector?.(pIndentifier)) return;
		let vNeededWidth = 0;

		Array.from(pHTML.querySelector(pIndentifier).children).forEach(vElement => vNeededWidth = vNeededWidth + vElement.offsetWidth);
		
		if (game.release.generation > 12) {
			pHTML.querySelector(pIndentifier).style.overflowX = "auto";
			pHTML.querySelector(pIndentifier).style.overflowY = "hidden";
		}
		
		if (vNeededWidth > pHTML.offsetWidth) {
			pHTML.style.width = vNeededWidth + "px";
		}		
	}
}

function fromHTML(pHTML) {
	let vDIV = document.createElement('div');
	
	vDIV.innerHTML = pHTML;
	
	return vDIV.querySelector("*");
}

Hooks.once("ready", () => {
	if (game.user.isGM) {
		if (game.release.generation <= 12) {
			Hooks.on("renderWallConfig", (vApp, vHTML, vData) => PerceptiveSheetSettings.WallSheetSettings(vApp, vHTML[0], vData)); //for walls

			Hooks.on("renderTokenConfig", (vApp, vHTML, vData) => PerceptiveSheetSettings.TokenSheetSettings(vApp, vHTML[0], vData)); //for tokens
			
			Hooks.on("renderTileConfig", (vApp, vHTML, vData) => PerceptiveSheetSettings.TileSheetSettings(vApp, vHTML[0], vData)); //for tokens
			
			Hooks.on("renderSceneConfig", (pApp, pHTML, pData) => PerceptiveSheetSettings.SceneSheetSettings(pApp, pHTML[0], pData)); //for scenes
		}
		else {
			Hooks.on("renderWallConfig", (vApp, vHTML, vData) => PerceptiveSheetSettings.WallSheetSettings(vApp, vHTML, vData)); //for walls

			Hooks.on("renderTokenConfig", (vApp, vHTML, vData) => PerceptiveSheetSettings.TokenSheetSettings(vApp, vHTML, vData)); //for tokens
			
			Hooks.on("renderPrototypeTokenConfig", (vApp, vHTML, vData) => PerceptiveSheetSettings.TokenSheetSettings(vApp, vHTML, vData)); //for tokens
			
			Hooks.on("renderTileConfig", (vApp, vHTML, vData) => PerceptiveSheetSettings.TileSheetSettings(vApp, vHTML, vData)); //for tokens
			
			Hooks.on("renderSceneConfig", (pApp, pHTML, pData) => PerceptiveSheetSettings.SceneSheetSettings(pApp, pHTML, pData)); //for scenes
		}
	}
});

export {PerceptiveSheetSettings}