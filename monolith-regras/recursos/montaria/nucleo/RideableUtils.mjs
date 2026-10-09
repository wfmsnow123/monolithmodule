import { RideableCompUtils, cArmReach, cArmReachold, cTokenAttacher, cTokenFormAttachedTiles, cWallHeight } from "./RideableCompUtils.mjs";
import { GeometricUtils } from "./GeometricUtils.mjs";
import { TileUtils } from "./TileUtils.mjs";
import { RideableFlags } from "./RideableFlags.mjs";
import { cfg, cDelimiter, cPopUpID, Translate, TranslateandReplace, sceneof } from "./base.mjs";

const cPf2eName = "pf2e";
const cRidingString = "Ridden by:";
const cRideableTag = "rideable";
const cQuantity = "quantity";
const cValue = "value";
const cPf2EffectType = "effect";
const cPf2ConditionType = "condition";
const cWeightIgnoreItemTypes = ["effect"];
const cMovementKeys = ["movement", "speed"];

export { cPf2eName, cPopUpID, cDelimiter, cWeightIgnoreItemTypes };

var vlastSearchedItemtype;
var vlastItempath;

class RideableUtils {
  static isPf2e() {
    return game.system.id === cPf2eName;
  }

  static TokensfromIDs (pIDs, pScene = null) {
    if (pScene) {
      return pScene.tokens.filter(vDocument => pIDs.includes(vDocument.id)).concat(pScene.tiles.filter(vDocument => pIDs.includes(vDocument.id)));
    }
    else {
      return canvas.tokens.placeables.filter(vToken => pIDs.includes(vToken.id)).map(vToken => vToken.document).concat(canvas.tiles.placeables.filter(vToken => pIDs.includes(vToken.id)).map(vToken => vToken.document));;
    }
  }

  static IDsfromTokens (pTokens) {
    let vIDs = [];

    let vTokens = pTokens;

    if (!Array.isArray(vTokens)) {
      vTokens = [vTokens];
    }

    for (let i = 0; i < vTokens.length; i++) {
      let vBuffer = null;

      if (vTokens[i]) {
        vIDs[vIDs.length] = vTokens[i].id;
      }
    }

    return vIDs;
  }

  static TokenfromID (pID, pScene = null) {
    if (pScene) {
      let vDocument = pScene.tokens.find(vDocument => vDocument.id === pID);

      if (!vDocument) {
        vDocument = pScene.tiles.find(vDocument => vDocument.id === pID);
      }

      if (vDocument) {
        return vDocument;
      }
      else {
        return null;
      }
    }
    else {
      let vToken = canvas.tokens.placeables.find(vToken => vToken.id === pID);

      if (!vToken) {
        vToken = canvas.tiles.placeables.find(vToken => vToken.id === pID);
      }

      if (vToken) {
        return vToken.document;
      }
      else {
        return null;
      }
    }
  }

  static async SpawnableActors(pIdentifications) {
    let vActors = [];

    for (let i = 0; i < pIdentifications.length; i++) {
      let vBuffer = await game.actors.get(pIdentifications[i]);

      if (!vBuffer) {
        vBuffer = await game.actors.find(vToken => vToken.name == pIdentifications[i]);
      }

      if (!vBuffer) {
        vBuffer = await fromUuid(pIdentifications[i]);
      }

      if (!vBuffer) {
        let vElement;
        let vPacks = game.packs.filter(vPacks => vPacks.documentName == "Actor");

        let vPack = vPacks.find(vPack => vPack.index.get(pIdentifications[i]));

        if (vPack) {
          vElement = vPack.index.get(pIdentifications[i]);
        }
        else {
          vPack = vPacks.find(vPack => vPack.index.find(vData => vData.name == pIdentifications[i]));

          if (vPack) {
            vElement = vPack.index.find(vData => vData.name == pIdentifications[i]);
          }
        }

        if (vElement) {
          vBuffer = await game.actors.filter(vToken => vToken.flags.core).find(vToken => vToken.flags.core.sourceId == "Compendium." + vPack.collection + ".Actor." + vElement._id);

          if (!vBuffer) {
            vBuffer = await game.actors.importFromCompendium(vPack, vElement._id);
          };
        }
      }

      if (vBuffer) {
        vActors[vActors.length] = vBuffer;
      }
    }

    return vActors;
  }

  static async SpawnTokens(pActors, pScene, px, py, pInfos = {}) {
    for (let i = 0; i < pActors.length; i++) {
      if (pActors[i]) {
        let vDocument = await pActors[i].getTokenDocument({x: px, y: py});

        await vDocument.constructor.create(vDocument, {parent: pScene, RideableSpawn: true, RideableInfos: pInfos});
      }
    }
  }

  static ignoreSpawn(pInfo) {
    return RideableCompUtils.ignoreSpawn(pInfo);
  }

  static selectedTokens() {
    return canvas.tokens.controlled.map(pToken => pToken.document);
  }

  static targetedToken() {
    if (game.user.targets.ids.length) {
      return canvas.tokens.get(game.user.targets.ids[0])?.document ?? null;
    }
    else {
      return null;
    }
  }

  static targetedTokens() {
    if (game.user.targets.ids.length) {
      return canvas.tokens.placeables.filter(velement => game.user.targets.ids.includes(velement.id)).map(vToken => vToken.document);
    }
    else {
      return [];
    }
  }

  static hoveredToken() {
    if (canvas.tokens.hover) {
      return canvas.tokens.hover.document;
    }
    else {
      return null;
    }
  }

  static hoveredRideableToken() {
    let vHovered = RideableUtils.hoveredToken();

    if (!vHovered) {
      vHovered = TileUtils.hoveredProxyToken();
    }

    return vHovered;
  }

  static getRiderMovementsetting() {
    switch (cfg("RiderMovement")) {
      case "RiderMovement-worlddefault":
        return cfg("RiderMovementworlddefault");
        break;
      default:
        return cfg("RiderMovement");
    }
  }

  static TokenissettingRideable(pToken, pPopup = false) {
    if (pToken) {
      if (cfg("RideableTag")) {
        switch (game.system.id) {
          case cPf2eName:
            if (pToken?.actor?.system.traits) {
              return Boolean(pToken.actor.system.traits.value.find(vElement => vElement.includes(cRideableTag)));
            }

            break;
          default:
            return false;
        }
      }
    }

    return false;
  }

  static issettingMountableandUn(pToken, pPopup = false) {
    return RideableCompUtils.issettingMountableandUn(pToken, pPopup);
  }

  static TokencanRide(pToken) {
    return true;
  }

  static TokenisFamiliarof(pFamiliar, pMaster) {
    if ((pFamiliar) && (pMaster)) {
      if (pFamiliar.isOwner && pMaster.isOwner) {
        return true;
      }
    }

    return false;
  }

  static areEnemies(pTokenA, pTokenB) {
    if ((pTokenA) && (pTokenB)) {
      return ((pTokenA.disposition * pTokenB.disposition) < 0)
    }

    return false;
  }

  static Ridingheight(pRidden) {
    if (RideableCompUtils.isactiveModule(cWallHeight) && pRidden && cfg("useRiddenTokenHeight") && (pRidden.documentName == "Token")) {
      return RideableCompUtils.guessWHTokenHeight(pRidden)
    }
    else {
      return cfg("RidingHeight");
    }
  }

  static MountingDistance() {
    if ((RideableCompUtils.isactiveModule(cArmReach) || RideableCompUtils.isactiveModule(cArmReachold)) && cfg("UseArmReachDistance")) {
      return RideableCompUtils.ARReachDistance();
    }

    if (cfg("MountingDistance") >= 0) {
      return cfg("MountingDistance");
    }
    else {
      return Infinity;
    }
  }

  static WithinMountingDistance(pRider, pRidden, pCustomDistance = null) {
    if (RideableCompUtils.isactiveModule(cTokenAttacher) && (RideableFlags.TokenForm(pRidden) == cTokenFormAttachedTiles)) {
      return Boolean(RideableCompUtils.TAAttachedTiles(pRidden).find(vTile => RideableUtils.WithinMountingDistance(pRider, vTile, pCustomDistance)));
    }

    let vCheckDistance = pCustomDistance;

    if (vCheckDistance == null) {
      if ((RideableCompUtils.isactiveModule(cArmReach) || RideableCompUtils.isactiveModule(cArmReachold)) && cfg("UseArmReachDistance")) {
        return RideableCompUtils.ARWithinMountingDistance(pRider, pRidden);
      }

      vCheckDistance = RideableUtils.MountingDistance();
    }

    if (cfg("BorderDistance")) {
      return GeometricUtils.TokenBorderDistance(pRidden, pRider) <= vCheckDistance;
    }
    else {
      return GeometricUtils.TokenDistance(pRidden, pRider) <= vCheckDistance;
    }
  }

  static UserofCharacterID(pID) {
    return game.users.filter(vuser => vuser.character).filter(vuser => vuser.character.id == pID);
  }

  static isConnected(pToken, pObject) {
    if (RideableCompUtils.isactiveModule(cTokenAttacher)) {
      return RideableCompUtils.isTAAttachedto(pToken, pObject);
    }

    return false;
  }

  static canbeMoved(pObject) {
    if (RideableCompUtils.isactiveModule(cTokenAttacher)) {
      return !RideableCompUtils.isTAAttached(pObject);
    }

    return true;
  }

  static async totalWeight(pToken) {
    let vWeight = 0;

    let vQuantityThreshold;
    let vActor = pToken?.actor;

    if (vActor) {
      for (let vItem of vActor.items) {
        vQuantityThreshold = 0;
        let vItemWeight = vItem.system.weight?.value;

        if (vItemWeight == undefined) {
          vItemWeight = vItem.system.bulk?.value;
        }

        if (vItemWeight) {
          if (vItem.system.bulk?.per > 0) {
            vItemWeight = vItemWeight/vItem.system.bulk.per;
            vQuantityThreshold = vItem.system.bulk.per;
          }

          if (vItemWeight == "L") {
            vItemWeight = 0.1;
          }

          if (vItem.system.equipped?.carryType == "worn" && vItem.type == "armor" && vItem.system.equipped?.inSlot == true) {
            vItemWeight = vItemWeight > 0.1 ? vItemWeight + 1 : 1;
          }

          if (!isNaN(vItemWeight)) {
            let vQuantity = await RideableUtils.getItemquantity(vItem);

            let vAdd = Number(vItemWeight) * vQuantity;

            vAdd = Math.floor(vAdd*10)/10;

            if (vQuantity < vQuantityThreshold) vAdd = 0;
            if (vItem.isInContainer) vAdd = 0;

            vWeight = vWeight + vAdd;
          }
        }

        if (vItem.system?.properties?.has("weightlessContents")) {
          // no dnd5e o peso do conteúdo é assíncrono
          const vConteudo = Number(await vItem.system?.contentsWeight);
          if (!isNaN(vConteudo)) vWeight = vWeight - vConteudo;
        }
      }

      if (game.system.id == "pf2e") {
        let vCreatureSizeWeight = 0;

        switch (vActor.system.traits.size.value) {
          case "tiny":
            vCreatureSizeWeight = 1;
            break;
          case "sm":
            vCreatureSizeWeight = 3;
            break;
          case "med":
            vCreatureSizeWeight = 6;
            break;
          case "lg":
            vCreatureSizeWeight = 12;
            break;
          case "huge":
            vCreatureSizeWeight = 24;
            break;
          case "grg":
            vCreatureSizeWeight = 48;
            break;
        }

        vWeight = vWeight + vCreatureSizeWeight;
      }
      else {
        let vRawWeight = vActor.system?.details?.weight;

        if (vRawWeight?.value) {
          vRawWeight = vRawWeight.value;
        }

        if (!vRawWeight) {
          vRawWeight = vActor.system?.details?.weight?.value;
        }

        if (vRawWeight) {
          if (!isNaN(vRawWeight)) {
            vWeight = vWeight + Number(vRawWeight);
          }
          else {
            const vNumbers = String(vRawWeight).match(/\d+(?:[.,]\d+)?/);
            if (vNumbers) vWeight = vWeight + Number(vNumbers[0].replace(",", "."));
          }
        }
      }
    }

    vWeight = Math.round(vWeight*10)/10;

    return vWeight;
  }

  static ItemQuantityPath(pItem, pItemtype = "", pSearchDepth = 10) {
    // caminho até a quantidade dentro de system (no dnd5e é só "quantity")
    if (!pItem || typeof pItem !== "object" || pSearchDepth <= 0) return [];
    if (pItemtype && pItemtype === vlastSearchedItemtype) return [...vlastItempath];
    let vPath = [];
    if (cQuantity in pItem) {
      vPath = [cQuantity];
      if (pItem[cQuantity] && typeof pItem[cQuantity] === "object" && cValue in pItem[cQuantity]) vPath.push(cValue);
    }
    else {
      for (const vKey of Object.keys(pItem)) {
        const vSub = RideableUtils.ItemQuantityPath(pItem[vKey], "", pSearchDepth - 1);
        if (vSub.length) { vPath = [vKey, ...vSub]; break; }
      }
    }
    if (vPath.length && pItemtype) {
      vlastSearchedItemtype = pItemtype;
      vlastItempath = vPath;
    }
    return vPath;
  }

  static async setItemquantity(pItem, pset, pCharacter = undefined) {
    if (pItem) {
      if (pset <= 0 && pCharacter) {
        pCharacter.actor.deleteEmbeddedDocuments("Item", [pItem.id]);

        return true;
      }

      let vPath = (await RideableUtils.ItemQuantityPath(pItem.system, pItem.type));
      let vUpdate = {};

      vUpdate[vPath.join(".")] = pset;

      pItem.update({system : vUpdate});

      return true;
    }

    return false;
  }

  static async getItemquantity(pItem, pPath = []) {
    if (pItem) {
      let vBuffer = pItem.system;
      let vPath = pPath;

      if (vPath.length <= 0) {
        vPath = await RideableUtils.ItemQuantityPath(pItem.system, pItem.type);
      }

      if (vPath.length > 0) {
        for(let i = 0; i < vPath.length; i++) {
          if (vBuffer) {
            vBuffer = vBuffer[vPath[i]]
          }
        }

        if (!isNaN(vBuffer)) {
          return Number(vBuffer);
        }
        else {
          return 0;
        }
      }

      return 0;
    }
    else {
      return 0;
    }
  }

  static MovementEffectOverrides(pToken) {
    let vActor = pToken?.actor;

    let vModfiers = [];

    if (vActor) {
      let vAttributes = vActor.system.attributes;

      let vMovementKey = Object.keys(vAttributes).find(vKey => cMovementKeys.includes(vKey));

      if (vMovementKey) {
        for (let vKey of Object.keys(vAttributes[vMovementKey])) {
          // só deslocamentos numéricos (no dnd5e há também unidades, hover e conjuntos)
          if (typeof vAttributes[vMovementKey][vKey] !== "number") continue;
          vModfiers.push(
            {
              key : "system.attributes." + vMovementKey + "." + vKey,
              mode : 5,
              priority : null,
              value : vAttributes[vMovementKey][vKey]
            }
          );
        }
      }
    }

    return vModfiers;
  }

  static CompleteProperties(pProperties, pSource1, pSource2) {
    let vResult = {};

    for (let i = 0; i < pProperties.length; i++) {
      if (pSource1.hasOwnProperty(pProperties[i])) {
        vResult[pProperties[i]] = pSource1[pProperties[i]];
      }
      else {
        if (pSource2.hasOwnProperty(pProperties[i])) {
          vResult[pProperties[i]] = pSource2[pProperties[i]];
        }
      }
    }

    return vResult;
  }

  static Ridingstring(pToken) {
    if (pToken) {
      return cRidingString + " " + pToken.name;
    }
    else {
      return cRidingString;
    }
  }

  static async ApplicableEffects(pIdentifications) {
    let vEffects = [];

    for (let i = 0; i < pIdentifications.length; i++) {
      let vBuffer = await game.items.get(pIdentifications[i]);

      if (!vBuffer) {
        vBuffer = await game.items.find(vEffect => vEffect.name == pIdentifications[i]);
      }

      if (!vBuffer) {
        vBuffer = await fromUuid(pIdentifications[i]);
      }

      if (!vBuffer) {
        let vElement;
        let vPacks = game.packs.filter(vPacks => vPacks.documentName == "Item");

        let vPack = vPacks.find(vPack => vPack.index.get(pIdentifications[i]));

        if (vPack) {
          vElement = vPack.index.get(pIdentifications[i]);
        }
        else {
          vPack = vPacks.find(vPack => vPack.index.find(vData => vData.name == pIdentifications[i]));

          if (vPack) {
            vElement = vPack.index.find(vData => vData.name == pIdentifications[i]);
          }
        }

        if (vElement) {
          vBuffer = vElement;
        }
      }

      if (vBuffer && [cPf2ConditionType, cPf2EffectType].includes(vBuffer.type)) {
        if (typeof vBuffer == "object") {
          vEffects[vEffects.length] = foundry.utils.duplicate(vBuffer);
        }
        else {
          vEffects[vEffects.length] = vBuffer.toObject();
        }
      }
    }

    return vEffects;
  }

  static CustomWorldRidingEffects() {
    return cfg("CustomRidingEffects").split(cDelimiter);
  }

  static CustomWorldGrapplingEffects() {
    return cfg("CustomGrapplingEffects").split(cDelimiter);
  }
}

async function switchScene( {pUserID, pSceneID, px, py} = {}) {
  if ((game.user.id == pUserID) && (canvas.scene.id != pSceneID)) {
    await game.scenes.get(pSceneID).view();
    canvas.pan({ x: px, y: py });
  }
}

export { RideableUtils, Translate, TranslateandReplace, switchScene };
