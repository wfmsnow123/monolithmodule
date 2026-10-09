import { RideableFlags } from "./RideableFlags.mjs";
import { GeometricUtils } from "./GeometricUtils.mjs";
import { RideableUtils } from "./RideableUtils.mjs";
import { cfg, HOOK, souGMAtivo } from "./base.mjs";
import { RideableCompUtils, cRoutingLib } from "./RideableCompUtils.mjs";
import { RideablePopups } from "./RideablePopups.mjs";

const vFollowedList = new Set();

class FollowingManager {
  static FollowingActive() {
    return cfg("EnableFollowing") && (RideableCompUtils.isactiveModule(cRoutingLib) || (cfg("FollowingAlgorithm") == "SimplePathHistory"));
  }

  static async FollowToken(pFollowers, pTarget, pDistance = -1) {
    let vFollowers = pFollowers.filter(vFollower => (vFollower != pTarget));

    for (let i = 0; i < vFollowers.length; i++) {
      if (RideableFlags.isFollowingToken(pTarget, vFollowers[i])) {
        RideablePopups.TextPopUpID(vFollowers[i] ,"TargetisFollowingMe", {pFollowedName : RideableFlags.RideableName(pTarget)}, {type : "error"});
      }
    }
    vFollowers = vFollowers.filter(vFollower => !RideableFlags.isFollowingToken(pTarget, vFollower));

    let vDistance;

    let vDefaultDistance = pDistance;

    for (let i = 0; i < vFollowers.length; i++) {
      if (!vFollowers[i].inCombat || cfg("FollowingCombatBehaviour") == "continue") {
        if (vDefaultDistance >= 0) {
          vDistance = vDefaultDistance;
        }
        else {
          vDistance = GeometricUtils.TokenDistance(vFollowers[i], pTarget);
        }

        await RideableFlags.startFollowing(vFollowers[i], pTarget, vDistance);

        FollowingManager.OnStartFollowing(vFollowers[i], pTarget);
      }
      else {
        RideablePopups.TextPopUpID(vFollowers[i], "CantFollowinCombat", {}, {type : "error"});
      }
    }

    FollowingManager.calculatenewRoute(vFollowers, {StartRoute : true, Target : pTarget, Scene : pTarget.parent});
  }

  static async StopFollowing(pFollowers, pPopup) {
    for (let i = 0; i < pFollowers.length; i++) {
      if (RideableFlags.isFollowing(pFollowers[i])) {
        await RideableFlags.stopFollowing(pFollowers[i]);

        FollowingManager.OnStopFollowing(pFollowers[i], pPopup);
      }
    }
  }

  static async SelectedFollowHovered(pConsiderTargeted = true, pDistance = -1) {
    if (FollowingManager.FollowingActive()) {
      let vFollowers = RideableUtils.selectedTokens();

      let vTarget = RideableUtils.hoveredRideableToken();

      if (!vTarget && pConsiderTargeted) {
        vTarget = RideableUtils.targetedTokens()[0];
      }

      if (vFollowers.length > 0 && vTarget) {
        await FollowingManager.FollowToken(vFollowers, vTarget, pDistance);
      }
    }
  }

  static async SelectedStopFollowing(pPopup = true) {
    if (FollowingManager.FollowingActive()) {
      let vFollowers = RideableUtils.selectedTokens();

      FollowingManager.StopFollowing(vFollowers, pPopup);
    }
  }

  static async SelectedToggleFollwing(pConsiderTargeted = true, pDistance = -1) {
    if (FollowingManager.FollowingActive()) {
      let vTarget = RideableUtils.hoveredRideableToken();

      if (!vTarget && pConsiderTargeted) {
        vTarget = RideableUtils.targetedTokens()[0];
      }

      let vSelected = RideableUtils.selectedTokens();

      let vPreFollowers = [];

      if (vTarget) {
        vPreFollowers = vSelected.filter(vToken => RideableFlags.isFollowingToken(vToken, vTarget));
      }
      else {
        vPreFollowers = vSelected;
      }

      let vPostFollowers = vSelected.filter(vToken => !vPreFollowers.includes(vToken));

      if (vPreFollowers.length && !vPostFollowers.length) {
        FollowingManager.StopFollowing(vPreFollowers);
      }

      if (vTarget && vPostFollowers.length) {
        await FollowingManager.FollowToken(vPostFollowers, vTarget, pDistance);
      }
    }
  }

  static async calculatenewRoute(pFollowers, pInfos = {StartRoute : true, Distance : undefined, Target : undefined, Scene : undefined, RidingMovement : false}) {
    if (pFollowers.length > 0) {
      let vScene = pInfos.Scene;

      let vSceneDistanceFactor;

      let vTarget = pInfos.Target;

      if (vScene) {
        vSceneDistanceFactor = (vScene.dimensions.size)/(vScene.dimensions.distance);
      }

      let vRouteData = [];

      for (let i = 0; i < pFollowers.length; i++) {
        let vDistance = pInfos.Distance;

        if (!pInfos.Scene) {
          vScene = pFollowers[i].parent;

          vSceneDistanceFactor = (vScene.dimensions.size)/(vScene.dimensions.distance);
        }

        if (!pInfos.Target) {
          vTarget = vScene.tokens.get(RideableFlags.followedID(pFollowers[i]));
        }

        if (vDistance == undefined) {
          vDistance = RideableFlags.FollowDistance(pFollowers[i]);
        }

        let vRoute;

        switch(cfg("FollowingAlgorithm")) {
          case "SimplePathHistory":
            vRoute = await FollowingManager.SimplePathHistoryRoute(pFollowers[i], vTarget, vDistance * vSceneDistanceFactor, pInfos);
            break;
          case cRoutingLib:
            vRoute = await RideableCompUtils.RLRoute(pFollowers[i], vTarget, pInfos.changes, vDistance * vSceneDistanceFactor);
            break;
        }

        vRoute.forEach(vPoint => vPoint.RidingMovement = pInfos.RidingMovement);

        vRouteData.push({token : pFollowers[i], route : vRoute});
      }

      const vDestackedRoutes = await FollowingManager.PlanDestackRoutes(vRouteData.filter((d) => d.route.length));
      for (const vData of vDestackedRoutes) {
        // o primeiro ponto é a posição atual do seguidor
        const vCaminho = vData.route.slice(1).map((p) => ({x: Math.round(p.x), y: Math.round(p.y), ...(Number.isFinite(p.elevation) ? {elevation: p.elevation} : {})}));
        if (vCaminho.length) vData.token.move(vCaminho, {RideableFollowingMovement : true, RidingMovement : pInfos.RidingMovement});
      }
    }
  }

  static async gotonextPointonRoute(pToken) {
    if (RideableFlags.hasPlannedRoute(pToken)) {
      await RideableFlags.shiftRoute(pToken);

      let vPoint = RideableFlags.nextRoutePoint(pToken);

      if (vPoint && Object.keys(vPoint).length) {
        await pToken.move({x: vPoint.x, y: vPoint.y, ...(Number.isFinite(vPoint.elevation) ? {elevation: vPoint.elevation} : {})}, {RideableFollowingMovement : true, RidingMovement : vPoint.RidingMovement});
      }
      else {
        if (cfg("PreventFollowerStacking")) {
          FollowingManager.PlanDestack(pToken);
        }
      }
    }
  }

  static async PlanDestack(pToken) {
    let vColliders = canvas.tokens.placeables.map(vToken => vToken.document).filter(vToken => RideableFlags.isFollowingSameToken(vToken, pToken) && vToken != pToken);

    vColliders = vColliders.filter(vToken => !RideableFlags.RidingConnection(vToken, pToken));

    vColliders.push(canvas.tokens.placeables.find(vToken => RideableFlags.isFollowingToken(pToken, vToken.document))?.document);

    vColliders.push(canvas.tokens.placeables.find(vToken => RideableFlags.isGrappledby(pToken, vToken.document))?.document);

    let vCollided = vColliders.find(vToken => GeometricUtils.DistanceXY(vToken?.object?.center, pToken.object?.center) < Math.min(vToken?.object.w + pToken.object.w, vToken?.object.h + pToken.object.h)/2);

    if (vCollided) {
      let vCorrectionLength = Math.min(vCollided.object.w + pToken.object.w, vCollided.object.h + pToken.object.h)/8;

      let vCorrectionVector;

      if (pToken.object.center.x != vCollided.object.center.x || pToken.object.center.y != vCollided.object.center.y) {
        vCorrectionVector = [pToken.object.center.x - vCollided.object.center.x, pToken.object.center.y - vCollided.object.center.y];
      }
      else {
        if (pToken.id > vCollided.id) {
          let vXDir = Math.random()-0.5;
          let vYDir = Math.random()-0.5;

          vCorrectionVector = [vXDir, vYDir];
        }
      }
      if (vCorrectionVector) {
        let vMinScale = 0;

        if (canvas.grid.type > 0) {
          vMinScale = canvas.grid.size;
        }

        vCorrectionVector = GeometricUtils.scaleto(vCorrectionVector, Math.max(vCorrectionLength, vMinScale));

        vCorrectionVector = GeometricUtils.GridSnapxy({x : pToken.x + vCorrectionVector[0], y : pToken.y + vCorrectionVector[1]});

        vCorrectionVector.RidingMovement = RideableFlags.isGrappled(pToken);

        if (!CONFIG.Canvas.polygonBackends["move"].testCollision(pToken.object.center, {x : vCorrectionVector.x + pToken.object.w/2, y : vCorrectionVector.y + pToken.object.h/2}, {type : "move", mode: "any"})) {
          await RideableFlags.setplannedRoute(pToken, [{pToken}, vCorrectionVector]);

          FollowingManager.gotonextPointonRoute(pToken);
        }
      }
    }
  }

  static async PlanDestackRoutes(pRoutes) {
    let vRoutesData = pRoutes.map((pRouteData) => {return {...pRouteData, tokenSize : GeometricUtils.insceneWH(pRouteData.token)}});

    for (let vTestData of vRoutesData) {
      let vColliders = vRoutesData.filter(vData => vData != vTestData);

      let vCollided = vColliders.find(vData => GeometricUtils.DistanceXY(vData.route.at(-1), vTestData.route.at(-1)) < Math.min(vData.tokenSize.width + vTestData.tokenSize.width, vData.tokenSize.height + vTestData.tokenSize.height)/2);

      if (vCollided) {
        let vCorrectionLength = Math.min(vCollided.tokenSize.width + vTestData.tokenSize.width, vCollided.tokenSize.height + vTestData.tokenSize.height)/8;

        let vCorrectionVector;

        const cTestDataPosition = vTestData.route.at(-1);
        const cColidedPosition = vCollided.route.at(-1);

        if (cTestDataPosition.x != cColidedPosition.x || cTestDataPosition.y != cColidedPosition.y) {
          vCorrectionVector = [cTestDataPosition.x - cColidedPosition.x, cTestDataPosition.y - cColidedPosition.y];
        }
        else {
          if (vTestData.token.id > vCollided.token.id) {
            let vXDir = Math.random()-0.5;
            let vYDir = Math.random()-0.5;

            vCorrectionVector = [vXDir, vYDir];
          }
        }
        if (vCorrectionVector) {
          let vMinScale = 0;

          if (canvas.grid.type > 0) {
            vMinScale = canvas.grid.size;
          }

          vCorrectionVector = GeometricUtils.scaleto(vCorrectionVector, Math.max(vCorrectionLength, vMinScale));

          let vCorrectedPosition = GeometricUtils.GridSnapxy({x : cTestDataPosition.x + vCorrectionVector[0], y : cTestDataPosition.y + vCorrectionVector[1]});

          if (!CONFIG.Canvas.polygonBackends["move"].testCollision(cTestDataPosition, {x : vCorrectedPosition.x + vTestData.tokenSize.width/2, y : vCorrectedPosition.y + vTestData.tokenSize.height/2}, {type : "move", mode: "any"})) {
            vTestData.route.push({...cTestDataPosition, ...vCorrectedPosition});
          }
        }
      }
    }

    return vRoutesData;
  }

  static updateFollowedList(pAddTokens) {
  }

  static replaceFollowerListIDs(pOldIDs, pNewIDs) {
    pOldIDs.forEach(vID => vFollowedList.delete(vID));

    pNewIDs.forEach(vID => vFollowedList.add(vID));
  }

  /** Guarda o caminho do seguido; com waypoints do v13, cada curva entra no histórico. */
  static async updatePathHistory(pToken, pchanges, pWaypoints = undefined) {
    if (cfg("FollowingAlgorithm") != "SimplePathHistory") return;
    if (!(souGMAtivo() || (!game.users.activeGM && pToken.isOwner))) return;
    if (!RideableFlags.isFollowed(pToken)) return;
    if (pWaypoints?.length) {
      for (const w of pWaypoints.filter((w) => !w.intermediate)) {
        await RideableFlags.AddtoPathHistory(pToken, {...GeometricUtils.CenterPositionXY(pToken, w), elevation: w.elevation});
      }
      return;
    }
    await pToken.object?.movementAnimationPromise;
    await RideableFlags.AddtoPathHistory(pToken, {...GeometricUtils.updatedGeometry(pToken, pchanges), elevation: pchanges.elevation ?? pToken.elevation});
  }

  static OnCombatantUpdate(pCombatant) {
    let vToken = pCombatant?.token;

    if (["stop", "stop-includefollowed"].includes(cfg("FollowingCombatBehaviour"))) {
      if (vToken?.inCombat) {
        if (vToken.isOwner && RideableFlags.isFollowing(vToken) && RideableFlags.isFollowOrderSource(vToken)) {
          FollowingManager.StopFollowing([vToken]);
        }

        if (cfg("FollowingCombatBehaviour") == "stop-includefollowed") {
          let vFollowers = RideableFlags.followingTokens(vToken).filter(vToken => vToken.isOwner && RideableFlags.isFollowOrderSource(vToken));

          FollowingManager.StopFollowing(vFollowers);
        }
      }
    }
  }

  static async SimplePathHistoryRoute(pFollower, pTarget, pDistance, pInfos = {}) {
    const cFollowerCenter = pFollower?.object?.center || GeometricUtils.CenterPositionXY(pFollower);
    if (cFollowerCenter) {
      let vPathHistory = RideableFlags.GetPathHistory(pTarget);

      if (pInfos.changes) {
        vPathHistory.push({...vPathHistory[vPathHistory.length-1], ...GeometricUtils.updatedGeometry(pTarget, pInfos.changes)});
      }

      let vRoute = [];

      let vLOSPointfound = false;

      let i = vPathHistory.length-1;

      while (!vLOSPointfound && i > 0) {
        vRoute.unshift(vPathHistory[i]);

        if (!CONFIG.Canvas.polygonBackends["move"].testCollision(cFollowerCenter, vPathHistory[i], {type : "move", mode: "any"})) {
          vLOSPointfound = true;
        }
        else {
          i = i - 1;
        }
      }

      vRoute.unshift({...cFollowerCenter, elevation : pFollower.elevation});

      if (vLOSPointfound) {
        vRoute = GeometricUtils.CenterRoutetoXY(vRoute, pFollower);

        vRoute = GeometricUtils.CutRoute(vRoute, pDistance, pFollower.parent.grid);

        return vRoute;
      }
    }

    return [];
  }

  static FollowedTokenList() {
    let vTokens = canvas.tokens.placeables.map(vToken => vToken.document).filter(vToken => vToken.isOwner && RideableFlags.isFollowing(vToken) && RideableFlags.isFollowOrderSource(vToken));

    let vFollowedIDs = vTokens.map(vToken => RideableFlags.followedID(vToken));

    let vNewSet = new Set();

    vFollowedIDs.forEach(vID => vNewSet.add(vID));

    return vNewSet;
  }

  /** moveToken do v13: o destino vira as "mudanças" do original e os waypoints alimentam o histórico. */
  static OnTokenMoved(pToken, pMovement, pOperation, pUser) {
    const d = pMovement.destination;
    return FollowingManager.OnTokenupdate(pToken, {x: d.x, y: d.y, elevation: d.elevation}, pOperation, pUser?.id, pMovement.passed.waypoints);
  }

  static async OnTokenupdate(pToken, pchanges, pInfos, pID, pWaypoints = undefined) {
    if (pchanges.hasOwnProperty("x") || pchanges.hasOwnProperty("y") || pchanges.hasOwnProperty("elevation")) {
      if (pToken.object?.visible || !cfg("OnlyfollowViewed")) {
        if (cfg("FollowingCompatibilityMode")) {
          await FollowingManager.updatePathHistory(pToken, pchanges, pWaypoints);
        }
        else {
          FollowingManager.updatePathHistory(pToken, pchanges, pWaypoints);
        }

        if (!(pToken.inCombat && ["stop-includefollowed", "resumeafter-includefollowed"].includes(cfg("FollowingCombatBehaviour")))) {
          let vFollowers = RideableFlags.followingTokens(pToken).filter(vToken => vToken.isOwner && RideableFlags.isFollowOrderSource(vToken));

          if (["stop", "stop-includefollowed", "resumeafter", "resumeafter-includefollowed"].includes(cfg("FollowingCombatBehaviour"))) {
            let vnonCombatants = vFollowers.filter(vFollower => !vFollower.inCombat);

            vFollowers = vnonCombatants;
          }

          if (vFollowers.length > 0) {
            FollowingManager.calculatenewRoute(vFollowers, {StartRoute : true, Target : pToken, changes : pchanges, Scene : pToken.parent});
          }
        }
      }
    }

    if (pToken.isOwner) {
      if (pchanges.hasOwnProperty("x") || pchanges.hasOwnProperty("y")) {
        if (RideableFlags.isFollowing(pToken) && !pInfos.RideableFollowingMovement && !pInfos.RidingMovement && RideableFlags.isFollowOrderSource(pToken)) {
          switch (cfg("OnFollowerMovement")) {
            case "updatedistance":
              RideableFlags.UpdateFollowDistance(pToken, GeometricUtils.TokenDistance(pToken, RideableFlags.followedToken(pToken), pchanges));
              break;
            case "stopfollowing":
            default:
              RideableFlags.stopFollowing(pToken);

              FollowingManager.OnStopFollowing(pToken);
              break;
          }
        }
      }
    }
  }

  static OnTokenrefresh(pToken, pInfos) {
    let vToken = pToken.document;

    if (vToken.isOwner && RideableFlags.isFollowOrderSource(vToken)) {
      if (RideableFlags.hasPlannedRoute(vToken)) {
        if (vToken.object) {
          if (RideableFlags.isnextRoutePoint(vToken, vToken.object.position)) {
            FollowingManager.gotonextPointonRoute(vToken);
          }
        }
      }
    }
  }

  static OnCanvasReady(pCanvas) {
  }

  static OnStartFollowing(pToken, pFollowed, pPopup = true) {
    if (pPopup) {
      RideablePopups.TextPopUpID(pToken ,"StartFollowing", {pFollowedName : RideableFlags.RideableName(pFollowed)}, {type : "success"});
    }

    Hooks.callAll(HOOK + ".StartFollowing", pToken, pFollowed);
  }

  static OnStopFollowing(pToken, pPopup = true) {
    if (pPopup) {
      RideablePopups.TextPopUpID(pToken ,"StopFollowing", {}, {type : "success"});
    }

    Hooks.callAll(HOOK + ".StopFollowing", pToken);
  }
}

export function ligarSeguir() {
  if (!FollowingManager.FollowingActive()) return;
  Hooks.on("moveToken", (...args) => FollowingManager.OnTokenMoved(...args));
  Hooks.on("refreshToken", (...args) => FollowingManager.OnTokenrefresh(...args));
  Hooks.on(HOOK + ".replaceFollowerListIDs", (pOldIDs, pNewIDs) => FollowingManager.replaceFollowerListIDs(pOldIDs, pNewIDs));
  Hooks.on("createCombatant", (pCombatant) => FollowingManager.OnCombatantUpdate(pCombatant));
  Hooks.on("deleteCombatant", (pCombatant) => FollowingManager.OnCombatantUpdate(pCombatant));
}

export function SelectedFollowHovered(pConsiderTargeted = true) {return FollowingManager.SelectedFollowHovered(pConsiderTargeted)};

export function SelectedFollowHoveredatDistance(pDistance) {return FollowingManager.SelectedFollowHovered(true, pDistance)}

export function SelectedStopFollowing() {return FollowingManager.SelectedStopFollowing()};

export function SelectedToggleFollwing() {return FollowingManager.SelectedToggleFollwing(true)};

export function SelectedToggleFollwingatDistance(pDistance) {return FollowingManager.SelectedToggleFollwing(true, pDistance)};

export function FollowbyID(pFollowerIDs, pTargetID, pSceneID = null, pDistance = -1) {FollowingManager.FollowToken(RideableUtils.TokensfromIDs(pFollowerIDs, game.scenes.get(pSceneID)), RideableUtils.TokenfromID(pTargetID, game.scenes.get(pSceneID)), pDistance)};

export function StopFollowbyID(pFollowerIDs, pSceneID = null) {FollowingManager.StopFollowing(RideableUtils.TokensfromIDs(pFollowerIDs, game.scenes.get(pSceneID)))};

export function calculatenewRoute(pFollowers, pInfos = {StartRoute : true, Distance : undefined, Target : undefined, Scene : undefined, RidingMovement : false}) {FollowingManager.calculatenewRoute(pFollowers, pInfos)};

export function updateFollowedList() {FollowingManager.updateFollowedList()};

export async function updatePathHistory(pToken, pChanges = undefined) {await FollowingManager.updatePathHistory(pToken, pChanges)};

export function RequestreplaceFollowerListIDs ({pPlayers, pOldIDs, pNewIDs} = {}) {if (pPlayers?.includes(game.user.id)) {FollowingManager.replaceFollowerListIDs(pOldIDs, pNewIDs)}}
