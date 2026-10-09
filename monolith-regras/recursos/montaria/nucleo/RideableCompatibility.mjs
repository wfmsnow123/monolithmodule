import { RideableUtils } from "./RideableUtils.mjs";
import { cfg, emitir, souGMAtivo, Translate, TranslateandReplace, HOOK, ID } from "./base.mjs";
import { RideableFlags } from "./RideableFlags.mjs";
import { isRider } from "./RideableFlags.mjs";
import { UpdateRidderTokens } from "./RidingScript.mjs";
import { RideablePopups } from "./RideablePopups.mjs";
import { Mount, UnMount, ToggleMount, UnMountallRiders, MountbyID, UnMountbyID, UnMountallRidersbyID } from "./MountingScript.mjs";

import { RideableCompUtils, cLockTypeRideable, cRideableTag } from "./RideableCompUtils.mjs";
import { cDnD5e, cStairways, cTagger, cWallHeight, cLocknKey, cMATT } from "./RideableCompUtils.mjs";

class RideableCompatibility {
  static async onTileTrigger(pTile, pTrigger, pInfos, pUserID, pData) {
    if (pInfos.action == "teleport" && pInfos.data.location.sceneId) {
    }
  }

  static async onpreTileTrigger(pTile, pTrigger, pInfos, pUserID, pData) {
    if (pInfos.action == "teleport" && pInfos.data.location.sceneId) {
      let vRiders = pData.tokens.filter(vToken => RideableFlags.isRider(vToken));

      let vValidCopy = pTrigger.filter(vToken => !vRiders.includes(vToken));
      for (let i = 0; i < vValidCopy.length; i++) {
        pTrigger[i] = vValidCopy[i];
      }

      while(pTrigger.length > vValidCopy.length) {
        pTrigger.pop();
      }
    }
  }

  static onSWTeleport(pData) {
    if (game.user.isGM) {
      RideableCompatibility.RequestRideableTeleport(pData.selectedTokenIds, pData.sourceSceneId, pData.targetSceneId, pData.targetData, game.user.id);
    }
    else {
      emitir("RequestRideableTeleport", {pTokenIDs : pData.selectedTokenIds, pSourceSceneID : pData.sourceSceneId, pTargetSceneID : pData.targetSceneId, pTarget : {x : pData.targetData.x, y : pData.targetData.y}, pUserID : pData.userId});
    }
  }

  static RequestRideableTeleport(pTokenIDs, pSourceSceneID, pTargetSceneID, pTarget, pUserID) {
    if (souGMAtivo()) {
      if ((pSourceSceneID != pTargetSceneID) && pSourceSceneID && pTargetSceneID) {
        let vSourceScene = game.scenes.get(pSourceSceneID);
        let vTargetScene = game.scenes.get(pTargetSceneID);

        RideableCompatibility.OrganiseTeleport(pTokenIDs, vSourceScene, vTargetScene, pTarget, game.users.get(pUserID));
      }
    }
  }

  static async OrganiseTeleport(pTokenIDs, pSourceScene, pTargetScene, pTarget, pUser, pDeleteOld = true, pTeleportMount = true, pupdatePrevID = true) {
    if (game.user.isGM) {
      if (pSourceScene != pTargetScene) {
        if (pSourceScene && pTargetScene) {
          for (let i = 0; i < pTokenIDs.length; i++) {
            let vToken = RideableCompUtils.TokenwithpreviousID(pTokenIDs[i], pTargetScene);

            if (vToken) {
              if (pTeleportMount && RideableFlags.isRider(vToken)) {
                let vRiddenToken = pSourceScene.tokens.find(vpreviousToken => RideableFlags.isRiddenbyID(vpreviousToken, RideableCompUtils.PreviousID(vToken)));

                if (vRiddenToken && (vRiddenToken.actor.ownership[pUser.id] >= 3 || vRiddenToken.actor.ownership.default >= 3)) {
                  await RideableCompatibility.TeleportleftTokens([vRiddenToken.id], pSourceScene, pTargetScene, pTarget, pUser, pDeleteOld, pTeleportMount, pupdatePrevID);
                }
              }

              if (RideableFlags.isRidden(vToken) || RideableFlags.isFollowedID(pTokenIDs[i], pSourceScene)) {
                await RideableCompatibility.TeleportleftTokens(RideableFlags.RiderTokenIDs(vToken), pSourceScene, pTargetScene, pTarget, pUser, pDeleteOld, pTeleportMount, pupdatePrevID);

                await RideableCompUtils.UpdateRiderIDs(vToken);

                let vRiderTokenList = RideableUtils.TokensfromIDs(RideableFlags.RiderTokenIDs(vToken), vToken.scene);

                UpdateRidderTokens(vToken, vRiderTokenList, false, false);

                let vOldFollowers = RideableFlags.IDfollowingTokens(pTokenIDs[i], pSourceScene).map(vToken => vToken.id);
                let vNewFollowers = await RideableCompatibility.TeleportleftTokens(vOldFollowers, pSourceScene, pTargetScene, pTarget, pUser, pDeleteOld, pTeleportMount, pupdatePrevID);

                let vRelevantPlayers = [];
                vNewFollowers.forEach(vFollower => {
                  RideableFlags.updateFollowedID(vFollower, vToken.id);
                  vRelevantPlayers.push(RideableFlags.FollowOrderPlayerID(vFollower));
                });

                if (vRelevantPlayers.includes(game.user.id)) {
                  Hooks.call(HOOK + ".replaceFollowerListIDs", [pTokenIDs[i]], [vToken.id]);
                };
                emitir("RequestreplaceFollowerListIDs", {pPlayers : vRelevantPlayers, pOldIDs : [pTokenIDs[i]], pNewIDs : [vToken.id]});

                if (pupdatePrevID) RideableCompUtils.UpdatePreviousID(vToken);
              }
            }
          }
        }
      }
    }
  }

  static async TeleportleftTokens(pTokenIDs, pSourceScene, pTargetScene, pTarget, pUser, pDeleteOld = true, pTeleportMount = true, pupdatePrevID = true) {
    let vCreatedTokens = [];

    if (pSourceScene && pTargetScene) {
      let vValidTokenIDs = await pTokenIDs.filter(vID => pSourceScene.tokens.get(vID));

      if (vValidTokenIDs.length) {
        let vselectedTokensData = foundry.utils.duplicate(pSourceScene.tokens.filter((vToken) => vValidTokenIDs.includes(vToken.id)))

        for (let vToken of vselectedTokensData) {
          vToken.x = Math.round(pTarget.x - vToken.width * pTargetScene.grid.size / 2);
          vToken.y = Math.round(pTarget.y - vToken.height * pTargetScene.grid.size / 2);
        }

        if (pDeleteOld) await pSourceScene.deleteEmbeddedDocuments("Token", vValidTokenIDs, { isUndo: true, RideableSpawn: true});

        vCreatedTokens = await pTargetScene.createEmbeddedDocuments("Token", vselectedTokensData, { isUndo: true, RideableSpawn: true});

        for (let i = 0; i < vselectedTokensData.length; i++) {
          let vUsers = RideableUtils.UserofCharacterID(vselectedTokensData[i].actorId);

          for (let j = 0; j < vUsers.length; j++) {
            emitir("switchScene", {pUserID : vUsers[j].id, pSceneID : pTargetScene.id, px : pTarget.x, py : pTarget.y});
          }
        }

        emitir("RequestRideableTeleport", {pTokenIDs : vValidTokenIDs, pSourceSceneID : pSourceScene.id, pTargetSceneID : pTargetScene.id, pTarget : {x : pTarget.x, y : pTarget.y}, pUserID : pUser.id});
      }
    }

    await RideableCompatibility.OrganiseTeleport(pTokenIDs, pSourceScene, pTargetScene, pTarget, pUser, pDeleteOld, pTeleportMount, pupdatePrevID);

    return vCreatedTokens;
  }

  static onWHTokenupdate(pToken, pchanges, pInfos) {
    if (souGMAtivo()) {
      if (RideableFlags.isRidden(pToken)) {
        if (pchanges.flags && pchanges.flags[cWallHeight]) {
          let vRiderTokenList = RideableUtils.TokensfromIDs(RideableFlags.RiderTokenIDs(pToken), pToken.scene);

          UpdateRidderTokens(pToken, vRiderTokenList, false, pInfos.animate);
        }
      }
    }
  }

  static onTGGTokenpreupdate(pToken, pchanges, pInfos) {
    if (cfg("TaggerMountingIntegration")) {
      if (game.user.isGM && RideableFlags.TokenisRideable(pToken)) {
        if (pchanges.flags && pchanges.flags.hasOwnProperty(cTagger)) {
          let vOriginalToken = RideableUtils.TokenfromID(pToken.id);

          let vCurrentTags = pchanges.flags[cTagger].tags;
          let vOriginalTags = [];

          let vAddedIDs = [];
          let vRemovedIDs = [];

          if (vOriginalToken.flags && vOriginalToken.flags.hasOwnProperty(cTagger)) {
            vOriginalTags = vOriginalToken.flags[cTagger].tags;
          }

          if (vCurrentTags && vOriginalTags) {
            vAddedIDs = vCurrentTags.filter(vTag => !vOriginalTags.includes(vTag)).filter(vTag => vTag.startsWith(cRideableTag)).map(vTag => vTag.substr(cRideableTag.length));

            vRemovedIDs = vOriginalTags.filter(vTag => !vCurrentTags.includes(vTag)).filter(vTag => vTag.startsWith(cRideableTag)).map(vTag => vTag.substr(cRideableTag.length));

            MountbyID(vAddedIDs, vOriginalToken.id);

            UnMountbyID(vRemovedIDs);
          }
        }
      }
    }
  }
}

function RequestRideableTeleport({ pTokenIDs, pSourceSceneID, pTargetSceneID, pTarget, pUserID} = {}) { return RideableCompatibility.RequestRideableTeleport(pTokenIDs, pSourceSceneID, pTargetSceneID, pTarget, pUserID); }

export { RequestRideableTeleport };

/** Ganchos de outros módulos. O dnd5e 5.2 já tem os hooks de bloqueio: montaria e cavaleiro não se bloqueiam. */
export function ligarCompat() {
  if (game.system.id == cDnD5e) {
    const vSoltar = (vGridSpace, vToken, vOptions, vFound) => {
      for (const vtoTest of [...vFound]) {
        if (RideableFlags.RidingConnection(vToken.document, vtoTest.document)) vFound.delete(vtoTest);
      }
    };
    Hooks.on("dnd5e.determineOccupiedGridSpaceBlocking", vSoltar);
    Hooks.on("dnd5e.determineOccupiedGridSpaceDifficult", vSoltar);
  }

  if (RideableCompUtils.isactiveModule(cStairways)) {
    Hooks.on("StairwayTeleport", (...args) => RideableCompatibility.onSWTeleport(...args));
  }

  if (RideableCompUtils.isactiveModule(cStairways) || RideableCompUtils.isactiveModule(cMATT)) {
    // depois de um teleporte o token ainda é achado pelo id antigo
    Hooks.on(HOOK + ".Mount", (pRider, pRidden) => {
      RideableCompUtils.UpdatePreviousID(pRider);
      RideableCompUtils.UpdatePreviousID(pRidden);
    });
    Hooks.on(HOOK + ".StartFollowing", (pToken, pFollowed) => {
      RideableCompUtils.UpdatePreviousID(pToken);
      RideableCompUtils.UpdatePreviousID(pFollowed);
    });
    Hooks.on(HOOK + ".Teleport", (...args) => RideableCompatibility.RequestRideableTeleport(...args));
  }

  if (RideableCompUtils.isactiveModule(cWallHeight)) {
    Hooks.on("updateToken", (...args) => RideableCompatibility.onWHTokenupdate(...args));
  }

  if (RideableCompUtils.isactiveModule(cLocknKey)) {
    Hooks.on(cLocknKey + ".Locktype", (pDocument, pLocktype) => { if ((pDocument.documentName == "Token") && RideableFlags.TokenissetRideable(pDocument) && cfg("LocknKeyintegration")) pLocktype.type = cLockTypeRideable; });
    Hooks.on(cLocknKey + ".isTokenLocktype", (pLocktype, vLockInfo) => { if ((pLocktype == cLockTypeRideable) && cfg("LocknKeyintegration")) vLockInfo.isTokenLocktype = true; });
  }

  if (RideableCompUtils.isactiveModule(cTagger)) {
    Hooks.on("preUpdateToken", (...args) => RideableCompatibility.onTGGTokenpreupdate(...args));
    Hooks.on("preUpdateTile", (...args) => RideableCompatibility.onTGGTokenpreupdate(...args));
  }

  Hooks.once("setupTileActions", (pMATT) => registrarAcoesMATT(pMATT));
}

/** Ações do Monk's Active Tiles. Enquanto o Rideable estiver instalado (mesmo desligado), usa o nome dele para os tiles já configurados continuarem funcionando. */
function registrarAcoesMATT(pMATT) {
  const cModuleName = game.modules.get("Rideable") ? "Rideable" : ID;
  if (RideableCompUtils.isactiveModule(cMATT)) {
    if (pMATT) {
      pMATT.registerTileGroup(cModuleName, Translate("Titles.Rideable"));

      pMATT.registerTileAction(cModuleName, 'mount-this-tile', {
        name: Translate(cMATT + ".actions." + "mount-this-tile" + ".name"),
        requiresGM: true,
        ctrls: [
          {
            id: "entity",
            name: "MonksActiveTiles.ctrl.select-entity",
            type: "select",
            subtype: "entity",
            options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
            defvalue : "previous",
            restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
          }
        ],
        group: cModuleName,
        fn: async (args = {}) => {
          let vtoMountTokens = await pMATT.getEntities(args);

          let vTile = args.tile;

          if (vTile && vtoMountTokens.length > 0) {
            Mount(vtoMountTokens, vTile);
          }
        },
        content: async (trigger, action) => {
          let entityName = await pMATT.entityName(action.data?.entity || trigger.ctrls.find(c => c.id == "entity")?.defvalue);

          return TranslateandReplace(cMATT + ".actions." + "mount-this-tile" + ".descrp", {pname : Translate(trigger.name, false), pEntities : entityName})
        }
      });

      pMATT.registerTileAction(cModuleName, 'mount-target', {
        name: Translate(cMATT + ".actions." + "mount-target" + ".name"),
        requiresGM: true,
        ctrls: [
          {
            id: "entity",
            name: "MonksActiveTiles.ctrl.select-entity",
            type: "select",
            subtype: "entity",
            options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
            defvalue : "previous",
            restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
          },
          {
            id: "target",
            name: Translate(cMATT + ".actions." + "mount-target" + ".settings." + "target" + ".name"),
            type: "select",
            subtype: "entity",
            options: { show: ['token', 'tile', 'within', 'players', 'previous', 'tagger'] },
            required: true,
            restrict: (entity) => { return ((entity instanceof foundry.canvas.placeables.Token) || (entity instanceof foundry.canvas.placeables.Tile)); }
          }
        ],
        group: cModuleName,
        fn: async (args = {}) => {
          const { action } = args;

          let vtoMountTokens = await pMATT.getEntities(args);

          let vMount = (await pMATT.getEntities(args, "tokens", action.data?.target));

          if (vMount.length) {
            vMount = vMount[0];
          }

          if (vMount && vtoMountTokens.length > 0) {
            Mount(vtoMountTokens, vMount);
          }
        },
        content: async (trigger, action) => {
          let entityName = await pMATT.entityName(action.data?.entity || trigger.ctrls.find(c => c.id == "entity")?.defvalue);
          let vMountName = await pMATT.entityName(action.data?.target || trigger.ctrls.find(c => c.id == "entity")?.defvalue);

          return TranslateandReplace(cMATT + ".actions." + "mount-target" + ".descrp", {pname : Translate(trigger.name, false), pEntities : entityName, pMount : vMountName})
        }
      });

      pMATT.registerTileAction(cModuleName, 'unmount', {
        name: Translate(cMATT + ".actions." + "unmount" + ".name"),
        requiresGM: true,
        ctrls: [
          {
            id: "entity",
            name: "MonksActiveTiles.ctrl.select-entity",
            type: "select",
            subtype: "entity",
            options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
            defvalue : "previous",
            restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
          }
        ],
        group: cModuleName,
        fn: async (args = {}) => {
          const { action } = args;

          let vtoUnMountTokens = await pMATT.getEntities(args);

          if (vtoUnMountTokens.length > 0) {
            UnMount(vtoUnMountTokens);
          }
        },
        content: async (trigger, action) => {
          let entityName = await pMATT.entityName(action.data?.entity || trigger.ctrls.find(c => c.id == "entity")?.defvalue);
          return TranslateandReplace(cMATT + ".actions." + "unmount" + ".descrp", {pname : Translate(trigger.name, false), pEntities : entityName})
        }
      });

      pMATT.registerTileAction(cModuleName, 'unmount-riders', {
        name: Translate(cMATT + ".actions." + "unmount-riders" + ".name"),
        requiresGM: true,
        ctrls: [
          {
            id: "entity",
            name: "MonksActiveTiles.ctrl.select-entity",
            type: "select",
            subtype: "entity",
            options: { show: ['token', 'tile', 'within', 'players', 'previous', 'tagger'] },
            defvalue : "previous",
            restrict: (entity) => { return ((entity instanceof foundry.canvas.placeables.Token) || (entity instanceof foundry.canvas.placeables.Tile)); }
          }
        ],
        group: cModuleName,
        fn: async (args = {}) => {
          const { action } = args;

          let vRiddenTokens = await pMATT.getEntities(args);

          for (let i = 0; i < vRiddenTokens.length; i++) {
            UnMountallRiders(vRiddenTokens[i]);
          }
        },
        content: async (trigger, action) => {
          let entityName = await pMATT.entityName(action.data?.entity || trigger.ctrls.find(c => c.id == "entity")?.defvalue);
          return TranslateandReplace(cMATT + ".actions." + "unmount-riders" + ".descrp", {pname : Translate(trigger.name, false), pEntities : entityName})
        }
      });

      pMATT.registerTileAction(cModuleName, 'toggle-mount-target', {
        name: Translate(cMATT + ".actions." + "toggle-mount-target" + ".name"),
        requiresGM: true,
        ctrls: [
          {
            id: "entity",
            name: "MonksActiveTiles.ctrl.select-entity",
            type: "select",
            subtype: "entity",
            options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
            defvalue : "previous",
            restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
          },
          {
            id: "target",
            name: Translate(cMATT + ".actions." + "mount-target" + ".settings." + "target" + ".name"),
            type: "select",
            subtype: "entity",
            options: { show: ['token', 'tile', 'within', 'players', 'previous', 'tagger'] },
            required: true,
            restrict: (entity) => { return ((entity instanceof foundry.canvas.placeables.Token) || (entity instanceof foundry.canvas.placeables.Tile)); }
          }
        ],
        group: cModuleName,
        fn: async (args = {}) => {
          const { action } = args;

          let vtoChangeTokens = await pMATT.getEntities(args);

          let vMount = (await pMATT.getEntities(args, "tokens", action.data?.target));

          if (vMount.length) {
            vMount = vMount[0];
          }

          if (vMount && vtoChangeTokens.length > 0) {
            ToggleMount(vtoChangeTokens, vMount);
          }
        },
        content: async (trigger, action) => {
          let entityName = await pMATT.entityName(action.data?.entity || trigger.ctrls.find(c => c.id == "entity")?.defvalue);
          let vMountName  = await pMATT.entityName(action.data?.target);

          return TranslateandReplace(cMATT + ".actions." + "toggle-mount-target" + ".descrp", {pname : Translate(trigger.name, false), pEntities : entityName, pMount : vMountName})
        }
      });

      pMATT.registerTileAction(cModuleName, 'riders-of', {
        name: Translate(cMATT + ".filters." + "riders-of" + ".name"),
        ctrls: [
          {
            id: "entity",
            name: "MonksActiveTiles.ctrl.select-entity",
            type: "select",
            subtype: "entity",
            options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
            defvalue : "previous",
            restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
          },
          {
            id: "mount",
            name: Translate(cMATT + ".filters." + "riders-of" + ".settings." + "mount" + ".name"),
            type: "select",
            subtype: "entity",
            options: { show: ['tile', 'token', 'within', 'players', 'previous', 'tagger'] },
            required: true,
            restrict: (entity) => { return ((entity instanceof foundry.canvas.placeables.Token) || (entity instanceof foundry.canvas.placeables.Tile)) }
          },
          {
            id: "filterCondition",
            name: Translate(cMATT + ".filters." + "riders-of" + ".settings." + "filterCondition" + ".name"),
            list: "filterCondition",
            type: "list",
            defvalue: 'rider'
          },
          {
            id: "continue",
            name: "Continue if",
            list: "continue",
            type: "list",
            defvalue: 'always'
          }
        ],
        values: {
          "filterCondition": {
            "rider": Translate(cMATT + ".filters." + "riders-of" + ".settings." + "filterCondition" + ".options." + "rider"),
            "notrider": Translate(cMATT + ".filters." + "riders-of" + ".settings." + "filterCondition" + ".options." + "notrider"),
          },
          'continue': {
            "always": "Always",
            "any": "Any Matches",
            "all": "All Matches",
          }
        },
        fn: async (args = {}) => {
          const { action } = args;

          const entities = await pMATT.getEntities(args);

          let vMount = await pMATT.getEntities(args, "tokens", action.data?.mount);

          if (vMount.length) {
            vMount = vMount[0];
          }

          let vEntityCount = entities.length;

          let vFiltered;

          if (vMount) {
            switch(action.data?.filterCondition) {
              case "rider":
                vFiltered = entities.filter(vObject => game.modules.get("Rideable").api.RideableFlags.isRiddenby(vMount, vObject));
                break;
              case "notrider":
                vFiltered = entities.filter(vObject => !game.modules.get("Rideable").api.RideableFlags.isRiddenby(vMount, vObject));
                break;
            }
          }
          else {
            vFiltered = [];
          }

          const vContinue = (action.data?.continue === 'always'
            || (action.data?.continue === 'any' && vFiltered.length > 0)
            || (action.data?.continue === 'all' && vFiltered.length == vEntityCount && vFiltered.length > 0));

          return { continue: vContinue, tokens: vFiltered };
        },
        content: async (trigger, action) => {
          let entityName = await pMATT.entityName(action.data?.entity || trigger.ctrls.find(c => c.id == "entity")?.defvalue);
          let vMountName  = await pMATT.entityName(action.data?.target);

          let vCondition = Translate(cMATT + ".filters." + "riders-of" + ".settings." + "filterCondition" + ".options." + action.data.filterCondition);

          return TranslateandReplace(cMATT + ".filters." + "riders-of" + ".descrp", {pname : Translate(cMATT + ".filters.name"), pEntities : entityName, pMount : vMountName, pCondition : vCondition});
        }
      });

      pMATT.registerTileAction(cModuleName, 'is-rider', {
        name: Translate(cMATT + ".filters." + "is-rider" + ".name"),
        ctrls: [
          {
            id: "entity",
            name: "MonksActiveTiles.ctrl.select-entity",
            type: "select",
            subtype: "entity",
            options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
            defvalue : "previous",
            restrict: (entity) => {return (entity instanceof foundry.canvas.placeables.Token); }
          },
          {
            id: "filterCondition",
            name: Translate(cMATT + ".filters." + "is-rider" + ".settings." + "filterCondition" + ".name"),
            list: "filterCondition",
            type: "list",
            defvalue: 'rider'
          },
          {
            id: "continue",
            name: "Continue if",
            list: "continue",
            type: "list",
            defvalue: 'always'
          }
        ],
        values: {
          "filterCondition": {
            "rider": Translate(cMATT + ".filters." + "is-rider" + ".settings." + "filterCondition" + ".options." + "rider"),
            "notrider": Translate(cMATT + ".filters." + "is-rider" + ".settings." + "filterCondition" + ".options." + "notrider"),
          },
          'continue': {
            "always": "Always",
            "any": "Any Matches",
            "all": "All Matches",
          }
        },
        fn: async (args = {}) => {
          const { action } = args;

          const entities = await pMATT.getEntities(args);

          let vEntityCount = entities.length;

          let vFiltered;

          switch(action.data?.filterCondition) {
            case "rider":
              vFiltered = entities.filter(vObject => game.modules.get("Rideable").api.RideableFlags.isRider(vObject));
              break;
            case "notrider":
              vFiltered = entities.filter(vObject => !game.modules.get("Rideable").api.RideableFlags.isRider(vObject));
              break;
          }

          const vContinue = (action.data?.continue === 'always'
            || (action.data?.continue === 'any' && vFiltered.length > 0)
            || (action.data?.continue === 'all' && vFiltered.length == vEntityCount && vFiltered.length > 0));

          return { continue: vContinue, tokens: vFiltered };
        },
        content: async (trigger, action) => {
          let entityName = await pMATT.entityName(action.data?.entity || trigger.ctrls.find(c => c.id == "entity")?.defvalue);

          let vCondition = Translate(cMATT + ".filters." + "is-rider" + ".settings." + "filterCondition" + ".options." + action.data.filterCondition);

          return TranslateandReplace(cMATT + ".filters." + "is-rider" + ".descrp", {pname : Translate(cMATT + ".filters.name"), pEntities : entityName, pCondition : vCondition});
        }
      });

      pMATT.registerTileAction(cModuleName, 'is-ridden', {
        name: Translate(cMATT + ".filters." + "is-ridden" + ".name"),
        ctrls: [
          {
            id: "entity",
            name: "MonksActiveTiles.ctrl.select-entity",
            type: "select",
            subtype: "entity",
            options: { show: ['tile', 'token', 'within', 'players', 'previous', 'tagger'] },
            defvalue : "previous",
            restrict: (entity) => { return ((entity instanceof foundry.canvas.placeables.Token) || (entity instanceof foundry.canvas.placeables.Tile)); }
          },
          {
            id: "filterCondition",
            name: Translate(cMATT + ".filters." + "is-ridden" + ".settings." + "filterCondition" + ".name"),
            list: "filterCondition",
            type: "list",
            defvalue: 'ridden'
          },
          {
            id: "continue",
            name: "Continue if",
            list: "continue",
            type: "list",
            defvalue: 'always'
          }
        ],
        values: {
          "filterCondition": {
            "ridden": Translate(cMATT + ".filters." + "is-ridden" + ".settings." + "filterCondition" + ".options." + "ridden"),
            "notridden": Translate(cMATT + ".filters." + "is-ridden" + ".settings." + "filterCondition" + ".options." + "notridden"),
          },
          'continue': {
            "always": "Always",
            "any": "Any Matches",
            "all": "All Matches",
          }
        },
        fn: async (args = {}) => {
          const { action } = args;

          const entities = await pMATT.getEntities(args);

          let vEntityCount = entities.length;

          let vFiltered;

          switch(action.data?.filterCondition) {
            case "ridden":
              vFiltered = entities.filter(vObject => game.modules.get("Rideable").api.RideableFlags.isRidden(vObject));
              break;
            case "notridden":
              vFiltered = entities.filter(vObject => !game.modules.get("Rideable").api.RideableFlags.isRidden(vObject));
              break;
          }

          const vContinue = (action.data?.continue === 'always'
            || (action.data?.continue === 'any' && vFiltered.length > 0)
            || (action.data?.continue === 'all' && vFiltered.length == vEntityCount && vFiltered.length > 0));

          return { continue: vContinue, tokens: vFiltered };
        },
        content: async (trigger, action) => {
          let entityName = await pMATT.entityName(action.data?.entity || trigger.ctrls.find(c => c.id == "entity")?.defvalue);

          let vCondition = Translate(cMATT + ".filters." + "is-ridden" + ".settings." + "filterCondition" + ".options." + action.data.filterCondition);

          return TranslateandReplace(cMATT + ".filters." + "is-ridden" + ".descrp", {pname : Translate(cMATT + ".filters.name"), pEntities : entityName, pCondition : vCondition});
        }
      });
    }
  }
}
