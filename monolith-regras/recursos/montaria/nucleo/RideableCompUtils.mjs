import * as FCore from "./base.mjs";
import { cfg, ID, RECURSO, ORIGEM_EFEITO, ESCOPO_ANTIGO, FLAG_ESCOPO, FLAG_PREFIXO } from "./base.mjs";

import { RideableUtils } from "./RideableUtils.mjs";
import { RideableFlags } from "./RideableFlags.mjs";
import { RideablePopups } from "./RideablePopups.mjs";
import { GeometricUtils } from "./GeometricUtils.mjs";

const cDnD5e = "dnd5e";

const cStairways = "stairways";
const cTagger = "tagger";
const cWallHeight = "wall-height";
const cLevelsautocover = "levelsautocover";
const cArmReach = "foundryvtt-arms-reach";
const cArmReachold = "arms-reach";
const cLocknKey = "LocknKey";
const cLibWrapper = "lib-wrapper";
const cDfredCE = "dfreds-convenient-effects";
const cTokenAttacher = "token-attacher";
const cTokenZ = "token-z";
const cRoutingLib = "routinglib";
const cMATT = "monks-active-tiles";
const cCPR = "chris-premades";
const cTerrainMapper = "terrainmapper";
const cTerrainMapperOLD = "fvtt-terrain-mapper";

const cPreviousIDF = "PreviousIDFlag";

const cLockTypeRideable = "LTRideable";

const cRideableTag = "Rideable:";

const cGrabbedEffectName = "Grappled";

const cTokenFormAttachedTiles = "TokenFormAttachedTiles";

export { cDnD5e, cStairways, cTagger, cWallHeight, cArmReach, cArmReachold, cLocknKey, cLockTypeRideable, cLibWrapper, cDfredCE, cTokenAttacher, cTokenZ, cRoutingLib, cMATT, cCPR, cTerrainMapper, cTerrainMapperOLD }
export { cRideableTag, cGrabbedEffectName, cTokenFormAttachedTiles }

class RideableCompUtils {
  static isactiveModule(pModule) {
    return !!game.modules.get(pModule)?.active;
  }

  static ignoreSpawn(pInfo) {
    return (pInfo.isUndo)
  }

  static issettingMountableandUn(pToken, pPopup) {
    let vMountableUn = true;

    if (RideableCompUtils.isactiveModule(cLocknKey) && cfg("LocknKeyintegration")) {
      vMountableUn = !pToken.getFlag(cLocknKey, "LockableFlag") || !pToken.getFlag(cLocknKey, "LockedFlag");

      if (pPopup && !vMountableUn) {
        RideablePopups.TextPopUpID(pToken ,"RiddenisLocked", {pRiddenName : pToken.name});
      }
    }

    return vMountableUn;
  }

  static ARReachDistance() {
    if (RideableCompUtils.isactiveModule(cArmReach)) {
      return game.settings.get(cArmReach, "globalInteractionMeasurement");
    }

    if (RideableCompUtils.isactiveModule(cArmReachold)) {
      return game.settings.get(cArmReachold, "globalInteractionDistance");
    }

    return Infinity;
  }

  static ARWithinMountingDistance(pRider, pRidden) {
    if (RideableCompUtils.isactiveModule(cArmReach)) {
      return game.modules.get(cArmReach).api.isReachable(pRider, pRidden);
    }

    if (RideableCompUtils.isactiveModule(cArmReachold)) {
      return game.modules.get(cArmReachold).api.isReachable(pRider, pRidden);
    }

    return true;
  }

  static UpdatePreviousID(pToken) {
    if (pToken) {
      pToken.setFlag(FLAG_ESCOPO, FLAG_PREFIXO + cPreviousIDF, pToken.id);
    }
  }

  static PreviousID(pToken) {
    return pToken?.flags?.[FLAG_ESCOPO]?.[RECURSO]?.[cPreviousIDF] ?? "";
  }

  static TokenwithpreviousID(pID, pScene) {
    return pScene.tokens.filter(vToken => RideableCompUtils.PreviousID(vToken) == pID)[0];
  }

  static async UpdateRiderIDs(pRidden, vCleanIDs = true) {
    let vPreviousRiderIDs = RideableFlags.RiderTokenIDs(pRidden);

    let vNewRiders = await game.scenes.find(vscene => vscene.tokens.get(pRidden.id)).tokens.filter(vToken => vPreviousRiderIDs.includes(RideableCompUtils.PreviousID(vToken)));

    if (vCleanIDs) await RideableFlags.cleanRiderIDs(pRidden);

    for (let i = 0; i < vNewRiders.length; i++) {
      await RideableFlags.addRiderTokens(pRidden, [vNewRiders[i]], {Familiar: RideableFlags.wasFamiliarRider(vNewRiders[i]), Grappled: RideableFlags.wasGrappled(vNewRiders[i])}, true);

      RideableCompUtils.UpdatePreviousID(vNewRiders[i]);
    }
  }

  static guessWHTokenHeight(pToken, pWithElevation = false) {
    if (RideableCompUtils.isactiveModule(cWallHeight)) {
      if (pToken) {
        let vHeightdiff;
        let vdivider = 1;

        if (RideableCompUtils.isactiveModule(cLevelsautocover)) {
          if (pToken.flags[cLevelsautocover]) {
            if (pToken.flags[cLevelsautocover].ducking) {
              vdivider = 3;
            }
          }
        }

        if (pToken.flags[cWallHeight] && pToken.flags[cWallHeight].tokenHeight) {
          vHeightdiff = pToken.flags[cWallHeight].tokenHeight;
        }
        else {
          // as chaves do wall-height mudam entre versões: sem a configuração, usa o tamanho do token
          let vAuto = true;
          let vPadrao;
          try { vAuto = game.settings.get(cWallHeight, "autoLOSHeight"); } catch {}
          try { vPadrao = game.settings.get(cWallHeight, "defaultLosHeight"); } catch {}
          if (vAuto || !Number.isFinite(Number(vPadrao))) {
            vHeightdiff = (FCore.sceneof(pToken)?.dimensions.distance ?? 5) * Math.max(pToken.width, pToken.height) * ((Math.abs(pToken.texture.scaleX) + Math.abs(pToken.texture.scaleY)) / 2);
          }
          else {
            vHeightdiff = Number(vPadrao);
          }
        }

        if (pWithElevation) {
          let vElevation = pToken.elevation;

          if (!isFinite(vElevation)) {
            vElevation = 0;
          }

          return vElevation + vHeightdiff / vdivider;
        }
        else {
          return vHeightdiff / vdivider;
        }
      }
    }
    return 0;
  }

  static hasactiveEffectModule() {
    return (RideableCompUtils.isactiveModule(cDfredCE) && cfg("DFredsEffectsIntegration")) || (RideableCompUtils.isactiveModule(cCPR) && cfg("CPREffectsIntegration"))
  }

  static async addIDNameEffects(pNameIDs, pToken, pInfos = {forMountEffect : false, grappleEffect : false}) {
    if (RideableCompUtils.isactiveModule(cDfredCE) && cfg("DFredsEffectsIntegration")) {
      await RideableCompUtils.AddDfredEffect(await RideableCompUtils.FilterDFEffects(pNameIDs), pToken, pInfos);
    }

    if (RideableCompUtils.isactiveModule(cCPR) && cfg("CPREffectsIntegration")) {
      await RideableCompUtils.AddCPREffects(RideableCompUtils.FilterCPREffects(pNameIDs), pToken, pInfos);
    }
  }

  static async RemoveRideableEffects(pToken, pInfos = {forMountEffect : false, grappleEffect : false}) {
    let vEffectIDs = pToken.actor.effects.filter(vEffect => RideableCompUtils.isRideableEffect(vEffect, pInfos)).map(vEffect => vEffect.id);

    await pToken.actor.deleteEmbeddedDocuments("ActiveEffect", vEffectIDs);
  }

  static isRideableEffect(pEffect, pInfos = {forMountEffect : false, grappleEffect : false}) {
    let vPostFix = "";

    if (pInfos.forMountEffect) {
      vPostFix = ".forMount";
    }

    if (pInfos.grappleEffect) {
      vPostFix = ".grapple";
    }

    // efeitos aplicados antes da migração ainda têm a origem "Rideable"
    return pEffect.origin == ORIGEM_EFEITO + vPostFix || pEffect.origin == ESCOPO_ANTIGO + vPostFix;
  }

  static async AddDfredEffect(pEffects, pToken, pInfos = {forMountEffect : false, grappleEffect : false}) {
    let vPostFix = "";

    if (pInfos.forMountEffect) {
      vPostFix = ".forMount";
    }

    if (pInfos.grappleEffect) {
      vPostFix = ".grapple";
    }

    for (let i = 0; i < pEffects.length; i++) {
      await game.dfreds.effectInterface.addEffect({
        effectData: {...pEffects[i].toObject(),
               origin : ORIGEM_EFEITO + vPostFix},
        uuid : pToken.actor.uuid
      });
    }
  }

  static async RemoveRideableDfredEffect(pEffects, pToken, pInfos = {forMountEffect : false, grappleEffect : false}) {
    let vPostFix = "";

    if (pInfos.forMountEffect) {
      vPostFix = ".forMount";
    }

    if (pInfos.grappleEffect) {
      vPostFix = ".grapple";
    }

    for (let i = 0; i < pEffects.length; i++) {
      let vName = pEffects[i].name;

      if (!vName) {
        vName = pEffects[i].label;
      }

      await game.dfreds.effectInterface.removeEffect({
        effectName: vName,
        uuid : pToken.actor.uuid,
        origin : ORIGEM_EFEITO + vPostFix
      });
    }
  }

  static async FilterDFEffects(pNameIDs) {
    let vNameIDs = [];

    let vBuffer;

    for (let i = 0; i < pNameIDs.length; i++) {
      if (pNameIDs[i]) {
        vBuffer = await game.dfreds.effectInterface.findEffect({effectName : pNameIDs[i]});

        if (!vBuffer) {
          vBuffer = await game.dfreds.effectInterface.findEffect({effectId : pNameIDs[i]});
        }

        // nomes traduzidos: "Grappled" vira "ce-grappled" pelo id
        if (!vBuffer) {
          vBuffer = await game.dfreds.effectInterface.findEffect({effectId : "ce-" + String(pNameIDs[i]).toLowerCase().replace(/\s+/g, "-")});
        }

        if (!vBuffer) {
          vBuffer = await fromUuid(pNameIDs[i]);
        }

        if (vBuffer) {
          vNameIDs.push(vBuffer);
        }
      }
    }

    return vNameIDs;
  }

  static async AddCPREffects(pEffects, pToken, pInfos = {forMountEffect : false, grappleEffect : false}) {
    let vPostFix = "";

    if (pInfos.forMountEffect) {
      vPostFix = ".forMount";
    }

    if (pInfos.grappleEffect) {
      vPostFix = ".grapple";
    }

    await pToken.actor.createEmbeddedDocuments("ActiveEffect", pEffects, {keepId: true});

    for (let vEffect of pEffects) {
      let vAppliedEffect = pToken.actor.effects.find(vAE => vAE._source?._id == vEffect.id);

      if (vAppliedEffect) {
        await vAppliedEffect.update({origin : ORIGEM_EFEITO + vPostFix});
      }
    }
  }

  static async RemoveRideableCPREffects(pToken, pInfos = {forMountEffect : false, grappleEffect : false}) {
    let vPostFix = "";

    if (pInfos.forMountEffect) {
      vPostFix = ".forMount";
    }

    if (pInfos.grappleEffect) {
      vPostFix = ".grapple";
    }

    let vEffectIDs = pToken.actor.effects.filter(vEffect => RideableCompUtils.isRideableEffect(vEffect, pInfos)).map(vEffect => vEffect.id);

    await pToken.actor.deleteEmbeddedDocuments("ActiveEffect", vEffectIDs);
  }

  static FilterCPREffects(pNameIDs) {
    let vEffects = game.items.find(i => i.flags[cCPR]?.effectInterface).collections.effects;

    if (!vEffects) {
      return [];
    }

    return vEffects.filter(vEffect => pNameIDs.find(vNameID => vEffect.name == vNameID || vEffect.id == vNameID || vEffect.uuid == vNameID));
  }

  static isTAAttachedto(pToken, pObject) {
    if (!pToken || !pObject) {
      return false;
    }

    if (pToken == pObject) {
      return true;
    }

    let vAttached = false;

    if (pObject.flags.hasOwnProperty(cTokenAttacher)) {
      vAttached = (pObject.flags[cTokenAttacher].parent == pToken.id) || RideableFlags.RidingConnection(pToken, pObject);

      if (!vAttached) {
        vAttached = RideableCompUtils.isTAAttachedto(pToken, RideableUtils.TokenfromID(pObject.flags[cTokenAttacher].parent, FCore.sceneof(pObject)));
      }
    }

    return vAttached;
  }

  static TAAttachedTiles(pToken) {
    let vTiles = FCore.sceneof(pToken)?.tiles.filter(vTile => vTile.flags[cTokenAttacher]?.parent == pToken.id);

    if (vTiles && vTiles.length) {
      return vTiles;
    }
    else {
      return []
    }
  }

  static TAparentToken(pObject) {
    if (pObject) {
      return FCore.sceneof(pObject)?.tokens.get(pObject.flags[cTokenAttacher]?.parent);
    }

    return;
  }

  static isTAAttached(pObject) {
    return Boolean(pObject.flags[cTokenAttacher]?.parent);
  }

  static hasTAAttachedTiles(pToken) {
    return Boolean(FCore.sceneof(pToken)?.tiles.find(vTile => vTile.flags[cTokenAttacher]?.parent == pToken.id));
  }

  static async RLRoute(pToken, pTarget, pTargetCoordinates = {}, pbeforeEnd = 0) {
    let vStart = {};

    let vTarget = {};
    let vTargetCoordinates = {...{x : pTarget.x, y : pTarget.y}, ...pTargetCoordinates};

    let vRoute = [];

    let vGridSize = pToken.parent.grid.size;

    switch (pToken.parent.grid.type) {
      case 1:

        vStart.x = Math.round((pToken.x)/vGridSize);
        vStart.y = Math.round((pToken.y)/vGridSize);

        vTarget.x = Math.round((vTargetCoordinates.x)/vGridSize);
        vTarget.y = Math.round((vTargetCoordinates.y)/vGridSize);
        break;
      case 0:

        vStart = GeometricUtils.CenterPositionXY(pToken);

        if (pTarget.documentName == "Token") {
          vTarget = GeometricUtils.CenterPositionXY(pTarget, vTargetCoordinates);
        }
        else {
          vTarget = vTargetCoordinates;
        }
        break;
      default:
        break;
    }

    vRoute = (await routinglib.calculatePath(vStart, vTarget, {token : pToken.object}))?.path;

    if (vRoute) {
      switch (pToken.parent.grid.type) {
        case 1:

          vRoute = vRoute.map(vPoint => ({x : vPoint.x * vGridSize, y : vPoint.y * vGridSize}));
          break;
        case 0:

          vRoute = GeometricUtils.CenterRoutetoXY(vRoute, pToken);
          break;
        default:
          break;
      }

      vRoute = vRoute.filter(vPoint => vPoint);
    }
    else {
      vRoute = [];
    }

    if (pTarget.elevation != pToken.elevation) {
      vRoute.forEach((vPoint, i) => vPoint.elevation = pToken.elevation + (pTarget.elevation - pToken.elevation)/vRoute.length * (i+1));
    }

    vRoute = GeometricUtils.CutRoute(vRoute, pbeforeEnd, pToken.parent.grid);

    return vRoute;
  }
}

export { RideableCompUtils };
