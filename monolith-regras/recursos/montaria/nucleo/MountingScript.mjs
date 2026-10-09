import * as FCore from "./base.mjs";

import { RideableFlags, existe } from "./RideableFlags.mjs";
import { GeometricUtils } from "./GeometricUtils.mjs";
import { RideableUtils, cWeightIgnoreItemTypes } from "./RideableUtils.mjs";
import { cfg, emitir, souGMAtivo, Translate, HOOK, fromHTML as htmlDe } from "./base.mjs";
import { RideablePopups } from "./RideablePopups.mjs";
import { RequestUpdateRidderTokens, UpdateRidderTokens, UnsetRidingHeight, cGrapplePlacements } from "./RidingScript.mjs";
import { TileUtils } from "./TileUtils.mjs";
import { EffectManager } from "./EffectManager.mjs";

const cRideableIcon = "fas fa-horse";
const cWeightIcon = "fa-solid fa-weight-hanging";

const cInitiativeDelta = 0.01;

const cMountItemTypes = ["loot", "equipment"];

class MountingManager {
  static async MountSelected(pTargetHovered = false,  pRidingOptions = {Familiar: false, Grappled: false}) {
    let vTarget = RideableUtils.targetedToken();
    let vSelected = RideableUtils.selectedTokens();

    if (pTargetHovered || !vTarget) {
      vTarget = RideableUtils.hoveredRideableToken();

      if (cfg("allowTileRiding")) {
        if (!vTarget) {
          vTarget = TileUtils.hoveredRideableTile();
        }
      }

      if (!vTarget) {
        vTarget = RideableUtils.targetedToken();
      }
    }

    if (pRidingOptions.Grappled) {
      let vBuffer = vTarget;

      vTarget = vSelected[0];
      vSelected = [vBuffer];

      if (RideableFlags.isGrappledby(vSelected[0], vTarget)) {
        MountingManager.UnMountSelected(pTargetHovered);

        return;
      }
    }

    MountingManager.RequestMount(vSelected, vTarget, pRidingOptions);

    return;
  }

  static async MountSelectedGM(pTarget, pselectedTokens, pRidingOptions) {
    if (game.user.isGM) {
      if (((!pRidingOptions.Familiar) || (cfg("FamiliarRiding"))) && ((!pRidingOptions.Grappled) || (cfg("Grappling")))) {
        if (pTarget) {
          if ((RideableFlags.TokenisRideable(pTarget, true) && RideableUtils.issettingMountableandUn(pTarget, true)) || pRidingOptions.Familiar || pRidingOptions.Grappled) {
            let vSelectedTokens = pselectedTokens;

            if (!Array.isArray(vSelectedTokens)) {
              vSelectedTokens = [vSelectedTokens];
            }

            let vValidTokens = vSelectedTokens.filter(vToken => !RideableFlags.isRider(vToken) && (vToken != pTarget));

            if (vValidTokens.length > RideableFlags.TokenRidingSpaceleft(pTarget, pRidingOptions)) {
              vValidTokens = vValidTokens.slice(0, RideableFlags.TokenRidingSpaceleft(pTarget, pRidingOptions));
              RideablePopups.TextPopUpID(pTarget, "NoPlace", {pRiddenName : RideableFlags.RideableName(pTarget)}, {type : "warn"});
            }

            vValidTokens = vValidTokens.filter(vToken => MountingManager.TokencanMount(vToken, pTarget, pRidingOptions, true));

            if (pRidingOptions.Familiar) {
              vValidTokens = vValidTokens.filter(vToken => RideableUtils.TokenisFamiliarof(vToken, pTarget));
            }

            if (pRidingOptions.Grappled) {
              vValidTokens = vValidTokens.filter(vToken => RideableFlags.canbeGrappled(vToken));
            }

            if (vValidTokens.length) {
              let vpreviousRiders = RideableUtils.TokensfromIDs(RideableFlags.RiderTokenIDs(pTarget), FCore.sceneof(pTarget));

              if (pRidingOptions.Familiar) {
                vpreviousRiders = vpreviousRiders.filter(vToken => RideableFlags.isFamiliarRider(vToken));
              }

              if (pRidingOptions.Grappled) {
                vpreviousRiders = vpreviousRiders.filter(vToken => RideableFlags.isGrappled(vToken));
              }

              await RideableFlags.addRiderTokens(pTarget, vValidTokens, pRidingOptions);

              for (let i = 0; i < vValidTokens.length; i++) {
                await MountingManager.onMount(vValidTokens[i], pTarget, pRidingOptions);
              }

              UpdateRidderTokens(pTarget, vValidTokens.concat(vpreviousRiders));
            }
          }
        }
      }
    }

    return;
  }

  static RequestMount(pselectedTokens, pTarget, pRidingOptions) {
    if (pTarget) {
      pRidingOptions.isGM = game.user.isGM;

      if (game.user.isGM) {
        MountingManager.MountSelectedGM(pTarget, pselectedTokens, pRidingOptions);
      }
      else {
        if (!game.paused) {
          emitir("MountRequest", {pTargetID: pTarget.id, pselectedTokensID: RideableUtils.IDsfromTokens(pselectedTokens), pSceneID : FCore.sceneof(pTarget).id, pRidingOptions : pRidingOptions});
        }
      }
    }
  }

  static RequestMountbyID(pselectedTokens, pTarget, pRidingOptions, pSceneID = null) {
    MountingManager.RequestMount(RideableUtils.TokensfromIDs(pselectedTokens, pSceneID), RideableUtils.TokenfromID(pTarget, pSceneID), pRidingOptions);
  }

  static MountRequest(pTargetID, pselectedTokensID, pSceneID, pRidingOptions) {
    if (souGMAtivo()) {
      let vScene = game.scenes.get(pSceneID);

      MountingManager.MountSelectedGM(RideableUtils.TokenfromID(pTargetID, vScene), RideableUtils.TokensfromIDs(pselectedTokensID, vScene), pRidingOptions);
    }

    return;
  }

  static async UnMountSelectedGM(pselectedTokens, pfromRidden = false, pRemoveRiddenreference = true) {
    if (pselectedTokens) {
      let vRiderTokens = pselectedTokens.filter(vToken => RideableFlags.isRider(vToken) && (!RideableFlags.isGrappled(vToken) || pfromRidden));
      vRiderTokens = vRiderTokens.filter(vRider => RideableUtils.issettingMountableandUn(RideableFlags.RiddenToken(vRider), true));

      let vRiddenTokens = [];

      for (let i = 0; i < vRiderTokens.length; i++) {
        vRiddenTokens[i] = RideableFlags.RiddenToken(vRiderTokens[i]);
      }

      await UnsetRidingHeight(vRiderTokens, vRiddenTokens);

      await RideableFlags.stopRiding(vRiderTokens, pRemoveRiddenreference);

      for (let i = 0; i < vRiderTokens.length; i++) {
        await MountingManager.onUnMount(vRiderTokens[i], vRiddenTokens[i], {Familiar: RideableFlags.wasFamiliarRider(vRiderTokens[i]), Grappled: RideableFlags.wasGrappled(vRiderTokens[i])});
      }
    }
  }

  static UnMountSelected() {
    if (RideableUtils.selectedTokens().length > 0) {
      let vUnMountTokens = RideableUtils.selectedTokens();
      let vTarget = RideableUtils.targetedToken();
      let vfromRidden = false;

      if (!vTarget) {
        vTarget = RideableUtils.hoveredRideableToken();
      }

      if (vTarget) {
        if (RideableFlags.isRiddenby(RideableUtils.selectedTokens()[0], vTarget)) {
          vUnMountTokens = [vTarget];
          vfromRidden = true;
        }
      }

      MountingManager.RequestUnmount(vUnMountTokens, vfromRidden);
    }
  }

  static RequestUnmount(pTokens, pfromRidden = false) {
    if (game.user.isGM) {
      MountingManager.UnMountSelectedGM(pTokens, pfromRidden);
    }
    else {
      if (!game.paused && pTokens.length) {
        let vUnMountTokensIDs = RideableUtils.IDsfromTokens(pTokens);

        emitir("UnMountRequest", {pselectedTokenIDs: vUnMountTokensIDs, pSceneID : FCore.sceneof(pTokens[0]).id, pfromRidden: pfromRidden});
      }
    }
  }

  static RequestUnmountbyID(pTokens, pfromRidden = false, pSceneID = null) {
    MountingManager.RequestUnmount(RideableUtils.TokensfromIDs(pTokens, pSceneID), pfromRidden);
  }

  static UnMountRequest( pselectedTokenIDs, pSceneID, pfromRidden) {
    if (souGMAtivo()) {
      let vScene = game.scenes.get(pSceneID);
      MountingManager.UnMountSelectedGM(RideableUtils.TokensfromIDs(pselectedTokenIDs, vScene), pfromRidden);
    }
  }

  static UnMountRiders(pRiddenToken, pRiders) {
    if ((pRiddenToken) && (pRiders)) {
      MountingManager.UnMountSelectedGM(pRiders.filter(vToken => RideableFlags.isRiddenby(pRiddenToken, vToken)));
    }
  }

  static UnMountallRiders(pRiddenToken) {
    if (pRiddenToken) {
      MountingManager.UnMountRiders(pRiddenToken, RideableUtils.TokensfromIDs(RideableFlags.RiderTokenIDs(pRiddenToken), FCore.sceneof(pRiddenToken)));
    }
  }

  static UnMountallRidersbyID(pRiddenToken, pSceneID = null) {
    MountingManager.UnMountallRiders(RideableUtils.TokenfromID(pRiddenToken, pSceneID));
  }

  static async ToggleMountselected(pTargetHovered = false,  pRidingOptions = {Familiar: false, Grappled: false}) {
    let vTargets = RideableUtils.targetedTokens();
    let vSelected = RideableUtils.selectedTokens();
    let vfromRidden = false;

    if (pTargetHovered || !vTargets.length) {
      vTargets = vTargets.concat([RideableUtils.hoveredRideableToken()]);

      if (cfg("allowTileRiding")) {
        if (!vTargets.length) {
          vTargets = vTargets.concat([TileUtils.hoveredRideableTile()]);
        }
      }
    }

    if (pRidingOptions.Grappled) {
      let vBuffer = vTargets;

      vTargets = vSelected;
      vSelected = vBuffer;
    }

    MountingManager.RequestToggleMount(vSelected, vTargets[0], pRidingOptions, vfromRidden);

    return;
  }

  static RequestToggleMount(pselectedTokens, pTarget, pRidingOptions = {Familiar: false, Grappled: false}, vfromRidden = false) {
    let vselectedTokens = pselectedTokens.filter(vToken => vToken);

    let vCurrentRiders = vselectedTokens.filter(vRider => (pTarget && (RideableFlags.isRiddenby(pTarget, vRider) || (pRidingOptions.Grappled && RideableFlags.isGrappledby(vRider, pTarget)))) || (!pTarget && (RideableFlags.isRider(vRider))));

    let vCurrentNotRiders = vselectedTokens.filter(vToken => !RideableFlags.isRider(vToken));

    if (vCurrentRiders.length) {
      MountingManager.RequestUnmount(vCurrentRiders, vfromRidden = (vfromRidden || pRidingOptions.Grappled));
    }
    else {
      if (vCurrentNotRiders.length && pTarget) {
        MountingManager.RequestMount(vCurrentNotRiders, pTarget, pRidingOptions);
      }
    }
  }

  static async ToggleGrapplePlacement(pTokens) {
    for (let i = 0; i < pTokens.length; i++) {
      if (pTokens[i].isOwner) {
        let vCurrent = RideableFlags.GrapplePlacement(pTokens[i]);

        let vCurrentIndex = cGrapplePlacements.indexOf(vCurrent);

        let vTargetIndex = (vCurrentIndex + 1) % (cGrapplePlacements.length - 2);

        await RideableFlags.setGrapplePlacement(pTokens[i], cGrapplePlacements[vTargetIndex]);

        RequestUpdateRidderTokens(pTokens[i]);
      }
    }
  }

  static ToggleGrapplePlacementSelected() {
    MountingManager.ToggleGrapplePlacement(RideableUtils.selectedTokens());
  }

  static async TogglePiloting(pTokens) {
    for (let i = 0; i < pTokens.length; i++) {
      if (pTokens[i].isOwner) {
        if (await RideableFlags.TogglePiloting(pTokens[i])) {
          if (RideableFlags.isPiloting(pTokens[i])) {
            MountingManager.onstartPiloting(pTokens[i], RideableFlags.RiddenToken(pTokens[i]), {});
          }
          else {
            MountingManager.onstopPiloting(pTokens[i], RideableFlags.RiddenToken(pTokens[i]), {});
          }
        }
        else {
          let vRidden = RideableFlags.RiddenToken(pTokens[i]);
          if (vRidden) {
            RideablePopups.TextPopUpID(pTokens[i] ,"cantPilot", {pRiddenName : RideableFlags.RideableName(vRidden)}, {type : "error"});
          }
        }
      }
    }
  }

  static TogglePilotingSelected() {
    MountingManager.TogglePiloting(RideableUtils.selectedTokens());
  }

  /** Botão de montar no HUD do token (v13: html é HTMLElement, colunas div.col.left/right). */
  static addMountingButton(pHUD, pHTML) {
    const vMount = pHUD.document ?? pHUD.object?.document;
    if (!vMount || !RideableFlags.TokenisRideable(vMount)) return;
    let vButtonPosition = cfg("MountButtonPosition");
    if (vButtonPosition == "default") vButtonPosition = cfg("MountButtonDefaultPosition");
    if (!["left", "right"].includes(vButtonPosition)) return;
    const vColuna = pHTML.querySelector(`.col.${vButtonPosition}`);
    if (!vColuna || vColuna.querySelector(".montaria-hud")) return;

    const vMontado = RideableUtils.selectedTokens().some((t) => RideableFlags.isRiddenby(vMount, t));
    const vButton = htmlDe(`<button type="button" class="control-icon montaria-hud ${vMontado ? "active" : ""}" data-tooltip="${Translate(vMontado ? "Titles.Desmontar" : "Titles.Montar")}">
      <i class="${cRideableIcon}"></i></button>`);
    vButton.addEventListener("click", (pEvent) => {
      pEvent.preventDefault();
      pEvent.stopPropagation();
      let vRiders = RideableUtils.selectedTokens();
      // só a montaria selecionada: monta o personagem do jogador
      if (vRiders.length == 1 && vRiders[0] == vMount && game.user.character) {
        vRiders = vRiders.concat(canvas.tokens.placeables.filter((t) => t.actor == game.user.character).map((t) => t.document));
      }
      MountingManager.RequestToggleMount(vRiders, vMount);
    });
    vColuna.append(vButton);
  }

  static async TogglePositionLock(pTokens, pshowMessage = true) {
    let vTokens = pTokens.filter(vToken => vToken.isOwner);

    for (let i = 0; i < vTokens.length; i++) {
      if ((await RideableFlags.togglePositionLock(vTokens[i])) && pshowMessage) {
        if (RideableFlags.hasPositionLock(vTokens[i])) {
          RideablePopups.TextPopUpID(pTokens[i], "PositionLocked", {}, {type : "info"});
        }
        else {
          RideablePopups.TextPopUpID(pTokens[i], "PositionUnlocked",  {}, {type : "info"});
        }
      }
    }
  }

  static onIndependentRiderMovement(pToken, pChanges) {
    if (RideableFlags.isRider(pToken)) {
      if (RideableUtils.getRiderMovementsetting() == "RiderMovement-dismount") {
        if (pChanges.hasOwnProperty("x") || pChanges.hasOwnProperty("y") || pChanges.hasOwnProperty("elevation")) {
          MountingManager.RequestUnmount([pToken]);
        }
      }
    }
  }

  static async onMount(pRider, pRidden, pRidingOptions) {
    if (pRider) {
      if (pRidden) {
        if (pRidingOptions.Familiar) {
          RideablePopups.TextPopUpID(pRider ,"MountingFamiliar", {pRiddenName : RideableFlags.RideableName(pRidden)}, {type : "success"});
        }
        else {
          if (pRidingOptions.Grappled) {
            RideablePopups.TextPopUpID(pRider ,"Grappling", {pRiddenName : RideableFlags.RideableName(pRidden)}, {type : "success"});
          }
          else {
            RideablePopups.TextPopUpID(pRider ,"Mounting", {pRiddenName : RideableFlags.RideableName(pRidden)}, {type : "success"});
          }
        }
      }

      if (cfg("FitRidersize")) {
        await RideableFlags.savecurrentSize(pRider);
      }

      RideableFlags.ApplyRidersScale(pRidden, [pRider]);
    }

    let vRidingOptions = {...pRidingOptions};

    if (cfg("SpeedAdjustment") == "all") {
      pRidingOptions.RiderModifiers = RideableUtils.MovementEffectOverrides(pRidden);
    }

    EffectManager.onRiderMount(pRider, pRidden, pRidingOptions);

    MountingManager.ProxySelect(pRider);

    MountingManager.updateMountItem(pRidden);

    Hooks.callAll(HOOK + "." + "Mount", pRider, pRidden, pRidingOptions);
  }

  static async onUnMount(pRider, pRidden, pRidingOptions) {
    if (pRider) {
      if (pRidden) {
        if (pRidingOptions.Familiar) {
          RideablePopups.TextPopUpID(pRider ,"UnMountingFamiliar", {pRiddenName : RideableFlags.RideableName(pRidden)}, {type : "success"});
        }
        else {
          if (pRidingOptions.Grappled) {
            RideablePopups.TextPopUpID(pRider ,"UnGrappling", {pRiddenName : RideableFlags.RideableName(pRidden)}, {type : "success"});
          }
          else {
            RideablePopups.TextPopUpID(pRider ,"UnMounting", {pRiddenName : RideableFlags.RideableName(pRidden)}, {type : "success"});
          }
        }
      }

      if (cfg("FitRidersize")) {
        await RideableFlags.resetSize(pRider);
      }

      RideableFlags.resetScale(pRider);

      RideableFlags.resetPositionLock(pRider);
    }

    EffectManager.onRiderUnMount(pRider, pRidden, pRidingOptions);

    if (existe(pRidden)) MountingManager.updateMountItem(pRidden);

    Hooks.callAll(HOOK + "." + "UnMount", pRider, pRidden, pRidingOptions);
  }

  static async onstartPiloting(pRider, pRidden, pRidingOptions) {
    if (pRider) {
      if (pRidden) {
        RideablePopups.TextPopUpID(pRider ,"startPiloting", {pRiddenName : RideableFlags.RideableName(pRidden)}, {type : "success"});
      }
    }

    Hooks.callAll(HOOK + "." + "startPiloting", pRider, pRidden, pRidingOptions);
  }

  static async onstopPiloting(pRider, pRidden, pRidingOptions) {
    if (pRider) {
      if (pRidden) {
        RideablePopups.TextPopUpID(pRider ,"stopPiloting", {pRiddenName : RideableFlags.RideableName(pRidden)}, {type : "success"});
      }
    }

    Hooks.callAll(HOOK + "." + "stopPiloting", pRider, pRidden, pRidingOptions);
  }

  static async onpasteToken(pOriginal, pCopyData) {
    if (game.user.isGM) {
      if (pOriginal.length > 0) {
        let vSourceScene = FCore.sceneof(pOriginal[0].document);

        let vRiddenTokens = pCopyData.filter(vData => RideableFlags.isRidden(vData));

        let vBlacklist = [];

        let vRiderIDs = [];

        for (let i = 0; i < vRiddenTokens.length; i++) {
          vRiderIDs = vRiderIDs.concat(RideableFlags.RiderTokenIDs(vRiddenTokens[i]));
        }

        let j = 0;

        let visRider;
        let visRidden;

        while (j < pCopyData.length) {
          visRider = vRiderIDs.includes(pOriginal[j].id)
          visRidden = vRiddenTokens.includes(pCopyData[j])

          if (visRidden || visRider) {
            if (visRidden && visRider) {
              vBlacklist.push(pCopyData[j]);
            }

            pCopyData.splice(j, 1);
            pOriginal.splice(j, 1);
          }
          else {
            j = j + 1;
          }
        }

        vRiddenTokens = vRiddenTokens.filter(vToken => !vBlacklist.includes(vToken));

        MountingManager.createCopywithRiders(vRiddenTokens, vSourceScene);
      }
    }
  }

  static onTokenControl(pToken, pControlled, pOptions) {
    let vToken = pToken.document;

    if (pControlled) {
      MountingManager.ProxySelect(vToken, pOptions);
    }
  }

  static onRideableEffectDeletion(pEffect, pUser, pInfos) {
    if (pInfos.GrappleEffect) {
      if (cfg("StopGrappleonEffectRemoval")) {
        let vGrappled = canvas.tokens.placeables.filter(vToken => vToken.actor == pEffect.parent);

        vGrappled = vGrappled.map(vToken => vToken.document);

        vGrappled = vGrappled.filter(vToken => RideableFlags.isGrappled(vToken));

        MountingManager.RequestUnmount(vGrappled, true);
      }
    }
  }

  static async createCopywithRiders(pData, pSourceScene) {
    let vCreations = [];

    for (let i = 0; i < pData.length; i++) {
      let vRiderIDs = RideableFlags.RiderTokenIDs(pData[i]);

      let vRiderTokens = RideableUtils.TokensfromIDs(vRiderIDs, pSourceScene);

      let vRidden;

      vRiderTokens = foundry.utils.duplicate(vRiderTokens);

      for (let j = 0; j < vRiderTokens.length; j++) {
        vRiderTokens[j].x = pData[i].x;
        vRiderTokens[j].y = pData[i].y;
      }

      let vRiderReplacement = await MountingManager.createCopywithRiders(vRiderTokens, pSourceScene);

      RideableFlags.setRiderIDsData(pData[i], vRiderReplacement.map(vToken => vToken.id));

      vRidden = await canvas.scene.createEmbeddedDocuments("Token", [pData[i]], { RideableSpawn: true});

      UpdateRidderTokens(vRidden[0]);

      vCreations = vCreations.concat(vRidden);
    }

    return vCreations;
  }

  /** preMoveToken: entrar numa montaria marcada "montar ao entrar". */
  static CheckEntering(pToken, pMovement, pOperation) {
    if (pOperation.RidingMovement || !cfg("allowMountingonEntering") || RideableFlags.isRider(pToken)) return true;
    const vDestino = pMovement.destination;
    if (vDestino.x == pMovement.origin.x && vDestino.y == pMovement.origin.y) return true;

    const vNewPosition = GeometricUtils.updatedGeometry(pToken, {x: vDestino.x, y: vDestino.y});
    let vMoEobjects = canvas.tokens.placeables.map((t) => t.document).filter((t) => RideableFlags.MountonEnter(t));
    if (cfg("allowTileRiding")) vMoEobjects = vMoEobjects.concat(canvas.tiles.placeables.map((t) => t.document).filter((t) => RideableFlags.MountonEnter(t)));
    vMoEobjects = vMoEobjects.filter((t) => t != pToken)
      .filter((t) => GeometricUtils.withinBoundaries(t, RideableFlags.TokenForm(t), vNewPosition))
      .filter((t) => RideableFlags.isvalidAutomount(t, pToken));
    if (!vMoEobjects.length) return true;

    const vMount = vMoEobjects.sort((a, b) => a.elevation - b.elevation)[0];
    MountingManager.RequestMount([pToken], vMount, {MountbyEnter: true});
    // se não dá para andar dentro, quem posiciona é a montaria
    return RideableFlags.RiderscanMoveWithin(vMount);
  }

  static ProxySelect(pToken, pOptions) {
    if (canvas.tokens.controlled.length >= 1 && !pOptions?.PreventRideableSelect) {
      if (cfg("RiderProxySelect") != "never") {
        switch (cfg("RiderProxySelect")) {
          case "familiar":
          case "always":
            if (RideableFlags.isRider(pToken)) {
              if (!RideableFlags.isGrappled(pToken)) {
                if (cfg("RiderProxySelect") == "always" || RideableFlags.isFamiliarRider(pToken)) {
                  let vRidden = RideableFlags.RiddenToken(pToken)?.object;

                  let vToken = pToken?.object;

                  if (vRidden && vToken && vRidden.isOwner) {
                    vToken.release();

                    vRidden.control({});
                  }
                }
              }
            }
            break;
          case "allRiders":
            if (RideableFlags.isRidden(pToken)) {
              let vRiders = RideableFlags.RiderTokens(pToken);

              for (let vRider of vRiders) {
                vRider.object.control({releaseOthers : false});
              }
            }
            break;
          case "ctrl":
            if (game.keyboard.downKeys.has("ControlLeft") || game.keyboard.downKeys.has("ControlRight")) {
              let vNewTargets = [];

              if (RideableFlags.isRider(pToken)) {
                vNewTargets = [RideableFlags.RiddenToken(pToken)];
              }
              else {
              }
              vNewTargets = vNewTargets.filter(vTarget => vTarget);

              if (vNewTargets.length) {
                let vToken = pToken?.object;

                if (vToken) {
                  vToken.release();
                }

                for (let vTarget of vNewTargets) {
                  vTarget.object.control({PreventRideableSelect : true, releaseOthers : false});
                }
              }
            }
            break;
        }
      }
    }
  }

  static ProxyTarget(pOptions = {}) {
    let vLayer = canvas.activeLayer;

    if (vLayer instanceof foundry.canvas.layers.TokenLayer) {
      let vHovered = vLayer.hover;

      if (vHovered && !vHovered.document.isSecret) {
        let vProxySelected = false;

        if (RideableFlags.isRider(vHovered.document)) {
          let vRidden = RideableFlags.RiddenToken(vHovered.document);

          if (vRidden && vRidden.object) {
            vRidden.object.setTarget(!vRidden.object.isTargeted, {releaseOthers: !pOptions.isShift});

            vProxySelected = true;
          }
        }

        if (!vProxySelected) {
          vHovered.setTarget(!vHovered.isTargeted, {releaseOthers: !pOptions.isShift});
        }
      }
    }
  }

  static async createMountItem(pRidden, pOptions = {}) {
    let vMountItem = [];

    let vType = cMountItemTypes.find(vType => Item.TYPES.includes(vType));

    if (vType) {
      if (pRidden?.actor) {
        let vItemData = {
          name : Translate("Items.MountItem.name"),
          type : vType,
          img : "icons/containers/misc/wheelbarrow-white.webp"
        }

        RideableFlags.markasMountItem(vItemData);

        vMountItem = await pRidden.actor.createEmbeddedDocuments("Item", [vItemData]);
      }
    }

    return vMountItem[0];
  }

  static async deleteMountItem(pRidden) {
    if (pRidden.actor) {
      let vMountItems = pRidden.actor.items.filter(vItem => RideableFlags.IsMountItem(vItem));

      if (vMountItems.length) {
        await pRidden.actor.deleteEmbeddedDocuments("Item", vMountItems.map(vItem => vItem.id));
      }
    }
  }

  static async getMountItem(pRidden, pCreate = true) {
    let vItems = pRidden?.actor?.items;

    let vMountItem = undefined;

    if (vItems) {
      vMountItem = vItems.find(vItem => RideableFlags.IsMountItem(vItem));
    }

    if (!vMountItem && pCreate) {
      vMountItem = await MountingManager.createMountItem(pRidden);
    }

    return vMountItem;
  }

  static async updateMountItem(pRidden) {
    if (game.user.isGM && cfg("MountingWeight") != "off") {
      let vMountItem = await MountingManager.getMountItem(pRidden, true);

      if (vMountItem) {
        let vRiders = RideableFlags.RiderTokens(pRidden);

        if (cfg("MountingWeight") == "mountsonly") {
          vRiders = vRiders.filter(vToken => !RideableFlags.isFamiliarRider(vToken));
        }

        if (vRiders.length) {
          let vWeights = [];

          for (let vRider of vRiders) {
            vWeights.push(await RideableUtils.totalWeight(vRider));
          }

          let vtotalWeight = 0;

          vWeights.forEach(vWeight => vtotalWeight = vtotalWeight + vWeight);

          let vDescription = "<p>" + Translate("Items.MountItem.descrp") + "</p>";

          vDescription = vDescription + "<ul>";

          for (let i = 0; i < vRiders.length; i++) {
            vDescription = vDescription + `
              <li>
                <p>@UUID[${vRiders[i].actor.uuid}]{${vRiders[i].actor.name}} <i class="${cWeightIcon}"></i>${vWeights[i]}</p>
              </li>
            `;
          }

          vDescription = vDescription + "</ul>";

          const vSistema = {weight : {value : vtotalWeight}, description : {value : vDescription}};
          if (RideableUtils.isPf2e()) vSistema.bulk = {value : vtotalWeight};
          await vMountItem.update({system : vSistema});
        }
        else {
          MountingManager.deleteMountItem(pRidden);
        }
      }
    }
  }

  static onItemUpdate(pItem) {
    if (!cWeightIgnoreItemTypes.includes(pItem.type)) {
      let vActor = pItem.actor;

      if (vActor && souGMAtivo()) {
        let vToken = vActor.token;

        if (!vToken) {
          vToken = canvas.tokens.placeables.find(vToken => vToken.actor == vActor);
        }

        if (vToken) {
          let vRidden = RideableFlags.RiddenToken(vToken);

          if (vRidden) {
            MountingManager.updateMountItem(vRidden);
          }
        }
      }
    }
  }

  static async onCombatantUpdate(pCombatant, pChanges) {
    if (!souGMAtivo()) return;
    if (pChanges && !("initiative" in pChanges)) return;
    let vToken = pCombatant.token;
    let fSetInitiative = async (pToken, pInitiative) => {
      let vTokenCombatant = pToken.combatant;

      if (!vTokenCombatant) {
        await pToken.toggleCombatant();
        vTokenCombatant = pToken.combatant;
      }

      if (vTokenCombatant) {
        await vTokenCombatant.update({initiative : pInitiative});
      }
    }

    if (vToken && pCombatant.initiative != null) {
      if (cfg("InitiativeLink") != "off") {
        let vRidden = RideableFlags.RiddenToken(vToken);

        if (!RideableFlags.isFamiliarRider(vToken) && vRidden && vRidden.isOwner) {
          let vRidersofRidden = RideableFlags.RiderTokens(vRidden);

          if (vRidersofRidden[0] == vToken) {
            await fSetInitiative(vRidden, pCombatant.initiative - cInitiativeDelta);
          }
        }

        if (cfg("InitiativeLink") == "all") {
          let vFamiliars = RideableFlags.RiderTokens(vToken).filter(vRider => RideableFlags.isFamiliarRider(vRider));

          for (let vFamiliar of vFamiliars) {
            await fSetInitiative(vFamiliar, pCombatant.initiative - cInitiativeDelta);
          }
        }
      }
    }
  }

  static TokencanMount(pRider, pRidden, pRidingOptions) {
    if (!RideableFlags.RidingLoop(pRider, pRidden) && !RideableUtils.isConnected(pRider, pRidden)) {
      if (RideableFlags.TokenhasRidingPlace(pRidden, pRidingOptions)) {
        if (!cfg("PreventEnemyRiding") || !RideableUtils.areEnemies(pRider, pRidden) || pRidingOptions.isGM || pRidingOptions.Grappled) {
          if (pRidingOptions.MountbyEnter || RideableUtils.WithinMountingDistance(pRider, pRidden)) {
            return true;
          }
          else {
            RideablePopups.TextPopUpID(pRider ,"Toofaraway", {pRiddenName : RideableFlags.RideableName(pRidden)}, {type : "warn"});
            return false;
          }
        }
        else {
          RideablePopups.TextPopUpID(pRider ,"EnemyRiding", {pRiddenName : RideableFlags.RideableName(pRidden)}, {type : "error"});
        }
      }
      else {
        RideablePopups.TextPopUpID(pRider, "NoPlace", {pRiddenName : RideableFlags.RideableName(pRidden)}, {type : "warn"});
      }
    }
    else {
    }
    return false;
  }

  static async onTokenCreation(pTokenDocument, pInfos, pID) {
    if (!souGMAtivo() || RideableUtils.ignoreSpawn(pInfos)) return;
    if (pInfos.RideableSpawn) {
      const vMontarEm = pInfos.RideableInfos?.MountonSpawn;
      if (vMontarEm) MountingManager.MountRequest(vMontarEm, [pTokenDocument.id], FCore.sceneof(pTokenDocument)?.id, {});
      return;
    }
    const vSpawnRiders = RideableFlags.SpawnRiders(pTokenDocument);
    if (vSpawnRiders.length) {
      const vActors = await RideableUtils.SpawnableActors(vSpawnRiders);
      if (vActors.length) RideableUtils.SpawnTokens(vActors, FCore.sceneof(pTokenDocument), pTokenDocument.x, pTokenDocument.y, {MountonSpawn: pTokenDocument.id});
    }
  }

  /**
   * Token apagado. O original tentava atualizar o token que já não existe e parava no meio,
   * deixando o id preso na lista da montaria. Aqui cada caso é tratado à parte.
   */
  static async onTokenDeletion(pToken) {
    if (!souGMAtivo() || !pToken) return;
    const vScene = pToken.parent;

    // a montaria sumiu: os cavaleiros que ficaram descem e voltam ao normal
    if (RideableFlags.isRidden(pToken)) {
      const vRiders = RideableFlags.RiderTokenIDs(pToken).map((vID) => vScene?.tokens.get(vID)).filter(Boolean);
      if (vRiders.length) {
        await UnsetRidingHeight(vRiders, vRiders.map(() => pToken));
        await RideableFlags.stopRiding(vRiders, true);
        for (const vRider of vRiders) {
          await MountingManager.onUnMount(vRider, pToken, {Familiar: RideableFlags.wasFamiliarRider(vRider), Grappled: RideableFlags.wasGrappled(vRider)});
        }
      }
      if (pToken.actorLink) await MountingManager.deleteMountItem(pToken);
    }

    // o cavaleiro sumiu: sai da lista da montaria
    if (RideableFlags.isRider(pToken)) {
      const vRidden = RideableFlags.RiddenToken(pToken);
      if (vRidden) {
        await RideableFlags.forgetRiderID(vRidden, pToken.id);
        EffectManager.onRiderUnMount(pToken, vRidden, {Familiar: RideableFlags.wasFamiliarRider(pToken), Grappled: RideableFlags.wasGrappled(pToken)});
        MountingManager.updateMountItem(vRidden);
      }
    }
  }
}

export function ligarMontar() {
  Hooks.on("createToken", (...args) => MountingManager.onTokenCreation(...args));
  Hooks.on("deleteToken", (...args) => MountingManager.onTokenDeletion(...args));
  Hooks.on("preMoveToken", (...args) => MountingManager.CheckEntering(...args));
  Hooks.on("renderTokenHUD", (...args) => MountingManager.addMountingButton(...args));
  Hooks.on(HOOK + ".IndependentRiderMovement", (pToken, pChanges, pPermitido) => { if (pPermitido) MountingManager.onIndependentRiderMovement(pToken, pChanges); });
  Hooks.on(HOOK + ".RideableEffectDeletion", (pEffect, pUser, pInfos) => MountingManager.onRideableEffectDeletion(pEffect, pUser, pInfos));
  Hooks.on("pasteToken", (...args) => MountingManager.onpasteToken(...args));
  Hooks.on("controlToken", (...args) => MountingManager.onTokenControl(...args));
  Hooks.on("createItem", (pItem) => MountingManager.onItemUpdate(pItem));
  Hooks.on("updateItem", (pItem) => MountingManager.onItemUpdate(pItem));
  Hooks.on("deleteItem", (pItem) => MountingManager.onItemUpdate(pItem));
  Hooks.on("createCombatant", (pCombatant) => MountingManager.onCombatantUpdate(pCombatant));
  Hooks.on("updateCombatant", (pCombatant, pChanges) => MountingManager.onCombatantUpdate(pCombatant, pChanges));
}

function MountSelected(pTargetHovered = false) { return MountingManager.MountSelected(pTargetHovered); }

function MountSelectedFamiliar(pTargetHovered = false) { return MountingManager.MountSelected(pTargetHovered, {Familiar: true}); }

function ToggleMountselected(pTargetHovered = false) {return MountingManager.ToggleMountselected(pTargetHovered); }

function GrappleTargeted(pTargetHovered = false, pOptions = {}) { return MountingManager.ToggleMountselected(pTargetHovered, {...pOptions, Grappled: true})};

function UnMountSelected() { return MountingManager.UnMountSelected(); }

function Mount(pselectedTokens, pTarget, pRidingOptions = {}) { return MountingManager.RequestMount(pselectedTokens, pTarget, pRidingOptions)};

function UnMount(pTokens) { return MountingManager.RequestUnmount(pTokens)};

function ToggleMount(pRiders, pTarget, pRidingOptions = {}) {return MountingManager.RequestToggleMount(pRiders, pTarget, pRidingOptions);};

function UnMountallRiders(pRidden) { return MountingManager.UnMountallRiders(pRidden)};

function MountbyID(pselectedTokens, pTarget, pRidingOptions = {}, pSceneID = null) { return MountingManager.RequestMountbyID(pselectedTokens, pTarget, pRidingOptions, pSceneID)};

function UnMountbyID(pTokens, pSceneID = null) { return MountingManager.RequestUnmountbyID(pTokens, pSceneID)};

function UnMountallRidersbyID(pRidden, pSceneID = null) { return MountingManager.UnMountallRidersbyID(pRidden, pSceneID)};

function ToggleGrapplePlacementSelected() {return MountingManager.ToggleGrapplePlacementSelected()}

function TogglePilotingSelected() {return MountingManager.TogglePilotingSelected()}

function TogglePositionLock(pTokens, pshowMessage = true) {return MountingManager.TogglePositionLock(pTokens, pshowMessage)}

function TogglePositionLockSelected(pshowMessage = true) {return MountingManager.TogglePositionLock(RideableUtils.selectedTokens(), pshowMessage)}

function ProxyTarget(pOptions = {}) {return MountingManager.ProxyTarget(pOptions)}

function UnMountRequest({ pselectedTokenIDs, pSceneID, pfromRidden } = {}) {return MountingManager.UnMountRequest(pselectedTokenIDs, pSceneID, pfromRidden); }

function MountRequest({ pTargetID, pselectedTokensID, pSceneID, pRidingOptions} = {}) { return MountingManager.MountRequest(pTargetID, pselectedTokensID, pSceneID, pRidingOptions); }

export { MountSelected, MountSelectedFamiliar, GrappleTargeted, MountRequest, UnMountSelected, UnMountRequest, ToggleMountselected, ToggleGrapplePlacementSelected, TogglePilotingSelected, TogglePositionLock, TogglePositionLockSelected};

export { Mount, UnMount, ToggleMount, UnMountallRiders, MountbyID, UnMountbyID, UnMountallRidersbyID, ProxyTarget };
