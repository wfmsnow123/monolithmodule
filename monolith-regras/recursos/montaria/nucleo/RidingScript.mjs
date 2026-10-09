/**
 * Cavalgar: onde os cavaleiros ficam sobre a montaria e como andam junto com ela.
 *
 * No Foundry v13 todo movimento de token é um "movimento" com waypoints (régua, arrasto, teclado).
 * A montaria anda pelo hook moveToken e os cavaleiros recebem o mesmo caminho deslocado,
 * na mesma ação e velocidade, numa única atualização cada (posição, altura, rotação e ordem juntas).
 * O movimento independente de um cavaleiro é decidido no preMoveToken, antes de acontecer.
 */
import * as FCore from "./base.mjs";
import { cfg, emitir, souGMAtivo, HOOK } from "./base.mjs";
import { RideableFlags, cCornermaxRiders, existe } from "./RideableFlags.mjs";
import { RideableUtils } from "./RideableUtils.mjs";
import { RideablePopups } from "./RideablePopups.mjs";
import { GeometricUtils, cGradtoRad } from "./GeometricUtils.mjs";
import { updatePathHistory, calculatenewRoute } from "./FollowingScript.mjs";
import { RideableCompUtils, cTerrainMapper, cTerrainMapperOLD } from "./RideableCompUtils.mjs";

const cRowplacement = "RowPlacement";
const cColumnplacement = "ColumnPlacement";
const cCircleplacement = "CirclePlacement";
const cBlockplacement = "BlockPlacement";
const cClusterplacement = "ClusterPlacement";
const cRowplacementTop = "RowPlacementTop";
const cRowplacementBottom = "RowPlacementBottom";
const cCornerPlacement = "CornerPlacement";
const cCornerPlacementinner = "CornerPlacementinner";
const cMountPosition = "MountPosition";

const cupkeys = new Set(["KeyW", "ArrowUp", "Numpad7", "Numpad8", "Numpad9"]);
const cdownkeys = new Set(["KeyS", "ArrowDown", "Numpad1", "Numpad2", "Numpad3"]);
const cleftkeys = new Set(["KeyA", "ArrowLeft", "Numpad1", "Numpad4", "Numpad7"]);
const crightkeys = new Set(["KeyD", "ArrowRight", "Numpad3", "Numpad6", "Numpad9"]);

const cRowBelow = "RowBelow";
const cRowAbove = "RowAbove";
const cRowMiddle = "RowMiddle";
const cClosestInside = "ClosestInside";
const cFollowing = "Following";

const cPlacementPatterns = [cRowplacement, cCircleplacement, cBlockplacement, cClusterplacement, cRowplacementTop, cRowplacementBottom, cCornerPlacement, cCornerPlacementinner, cMountPosition];

const cGrapplePlacements = [cRowBelow, cRowAbove, cRowMiddle, cClosestInside, cFollowing];

export { cRowplacement, cPlacementPatterns, cGrapplePlacements };

const cSizeFactor = 2/3;

/** Opções de movimento dos cavaleiros: atravessam paredes e tokens, sem custo, sem régua nem giro automático. */
const cRestricaoCavaleiro = { ignoreWalls: true, ignoreCost: true, ignoreTokens: true };

/** Move um token por waypoints junto com outras mudanças (rotação, ordem) numa só atualização. */
export async function moverToken(pToken, pWaypoints, pDados = {}, pOpcoes = {}) {
  if (!existe(pToken)) return false;
  const { method = "api", constrainOptions = cRestricaoCavaleiro, autoRotate = false, showRuler = false, ...vResto } = pOpcoes;
  const vWaypoints = (Array.isArray(pWaypoints) ? pWaypoints : [pWaypoints]).filter(Boolean);
  if (!vWaypoints.length) {
    if (Object.keys(pDados).length) await pToken.update(pDados, vResto);
    return true;
  }
  if (pToken.documentName !== "Token") return pToken.update({...pDados, ...vWaypoints.at(-1)}, vResto);
  return pToken.update(pDados, {...vResto, movement: {[pToken.id]: {waypoints: vWaypoints, method, constrainOptions, autoRotate, showRuler}}});
}

/** Waypoint limpo (só as chaves que o v13 aceita). */
function waypoint(p, extra = {}) {
  const w = {x: Math.round(p.x), y: Math.round(p.y)};
  if (Number.isFinite(p.elevation)) w.elevation = p.elevation;
  if (p.action) w.action = p.action;
  return {...w, snapped: false, explicit: false, checkpoint: true, ...extra};
}

class Ridingmanager {
  /* ---------- quem faz o trabalho ---------- */

  /** Este cliente deve mover os cavaleiros desta montaria? O autor do movimento, se puder mexer em todos; senão o GM ativo. */
  static responsavel(pRiders, pUser) {
    const vAutorPode = pUser?.active && pRiders.every((r) => r.testUserPermission?.(pUser, "OWNER"));
    if (pUser?.isSelf && vAutorPode) return true;
    return souGMAtivo() && !vAutorPode;
  }

  /* ---------- montaria andou ---------- */

  /** moveToken: a montaria se moveu (régua, arrasto, teclado ou API). */
  static OnRiddenMoved(pToken, pMovement, pOperation, pUser) {
    if (!RideableFlags.isRidden(pToken)) return;
    const vRiders = RideableFlags.RiderTokens(pToken);
    if (!vRiders.length || !Ridingmanager.responsavel(vRiders, pUser)) return;
    Ridingmanager.planRiderTokens(pToken, {}, vRiders, pOperation.animate !== false, {
      origin: pMovement.origin,
      waypoints: pMovement.passed.waypoints,
      method: pMovement.method,
      movementSpeed: pOperation.animation?.movementSpeed
    });
  }

  /** updateToken/updateTile: mudanças que não são movimento (rotação, ordem) e tiles. */
  static OnTokenupdate(pToken, pChanges, pInfos, pUserID, pisTile = false) {
    if (!RideableFlags.isRidden(pToken)) return;
    // tokens: posição e tamanho chegam pelo moveToken
    if (!pisTile && pInfos._movement?.[pToken.id]) return;
    const vMudou = (pisTile && ["x", "y", "elevation", "width", "height"].some((k) => k in pChanges))
      || ("rotation" in pChanges && cfg("RiderRotation"))
      || ("sort" in pChanges);
    if (!vMudou) return;
    const vRiders = RideableFlags.RiderTokens(pToken);
    if (!vRiders.length || !Ridingmanager.responsavel(vRiders, game.users.get(pUserID))) return;
    Ridingmanager.planRiderTokens(pToken, {}, vRiders, !pisTile && pInfos.animate !== false);
  }

  /* ---------- cavaleiro tentou andar sozinho ---------- */

  /** preMoveToken: devolve false para impedir o movimento do cavaleiro. */
  static OnRiderPreMove(pToken, pMovement, pOperation) {
    if (pOperation.RidingMovement) return true;
    if (!RideableFlags.isRider(pToken)) return true;
    const vRidden = RideableFlags.RiddenToken(pToken);
    if (!vRidden) return true;

    const vOrigem = pMovement.origin;
    const vDestino = pMovement.destination;
    const vMoveu = (vDestino.x != vOrigem.x) || (vDestino.y != vOrigem.y);
    const vSubiu = vDestino.elevation != vOrigem.elevation;
    if (!vMoveu && !vSubiu) return true;

    const vCaminho = [...pMovement.passed.waypoints, ...pMovement.pending.waypoints].filter((w) => !w.intermediate);
    const vDelta = {x: vDestino.x - vOrigem.x, y: vDestino.y - vOrigem.y, elevation: vDestino.elevation - vOrigem.elevation};
    if (pMovement.method === "keyboard") Object.assign(vDelta, Ridingmanager.keydownMoveReplacement());
    const vMov = {origem: vOrigem, caminho: vCaminho, delta: vDelta, method: pMovement.method, autoRotate: pMovement.autoRotate, showRuler: pMovement.showRuler};

    // piloto: o pedido de mover a montaria vai para o GM
    if (RideableFlags.isPilotedby(vRidden, pToken)) {
      Ridingmanager.RequestMoveRidden(vRidden, vDelta, {MovedbyPilot: true, PilotID: pToken.id, caminho: Ridingmanager.#caminhoRelativo(vMov)});
      return false;
    }

    // andar livre dentro da montaria
    if (RideableFlags.RiderscanMoveWithin(vRidden) && !RideableFlags.isFamiliarRider(pToken) && !RideableFlags.isGrappled(pToken)) {
      if (RideableFlags.hasPositionLock(pToken)) return false;
      const vNovoCentro = GeometricUtils.NewCenterPosition(pToken, vDestino);
      if (GeometricUtils.withinBoundaries(vRidden, RideableFlags.TokenForm(vRidden), vNovoCentro)) {
        if (vMoveu) {
          RideableFlags.setRelativPosition(pToken, [...GeometricUtils.Rotated(GeometricUtils.Difference(vNovoCentro, GeometricUtils.CenterPosition(vRidden)), -vRidden.rotation), pToken.rotation - vRidden.rotation]);
        }
        if (vSubiu) RideableFlags.setaddRiderHeight(pToken, RideableFlags.addRiderHeight(pToken) + vDelta.elevation);
        return true;
      }
    }

    if (RideableFlags.isGrappled(pToken)) {
      RideablePopups.TextPopUpID(pToken, "PreventedGrappledMove", {pRiddenName: RideableFlags.RideableName(vRidden)}, {type: "warn"});
      return false;
    }

    return Ridingmanager.OnIndependentRidermovement(pToken, vMov, vRidden, vMoveu, vSubiu);
  }

  /** Waypoints do cavaleiro convertidos em caminho relativo (para aplicar à montaria). */
  static #caminhoRelativo(pMov) {
    return pMov.caminho.map((w) => ({dx: w.x - pMov.origem.x, dy: w.y - pMov.origem.y, dz: (w.elevation ?? pMov.origem.elevation) - pMov.origem.elevation, action: w.action}));
  }

  static OnIndependentRidermovement(pToken, pMov, pRidden, pMoveu, pSubiu) {
    const vModo = RideableUtils.getRiderMovementsetting();

    // GM mudando só a altura do cavaleiro: guarda como altura extra
    if (game.user.isGM && !pMoveu && pSubiu && vModo !== "RiderMovement-moveridden") {
      RideableFlags.setaddRiderHeight(pToken, RideableFlags.addRiderHeight(pToken) + pMov.delta.elevation);
      return true;
    }

    let vPermitir = true;

    // montaria e cavaleiro arrastados juntos: a montaria já leva o cavaleiro
    if (pRidden.object?.controlled && (vModo !== "RiderMovement-dismount")) return false;

    if (vModo === "RiderMovement-disallow") {
      vPermitir = false;
      if (RideableFlags.RiderscanMoveWithin(pRidden)) {
        // vai para a borda mais próxima dentro da montaria
        const vAlvo = {x: pMov.origem.x + pMov.delta.x, y: pMov.origem.y + pMov.delta.y, rotation: pToken.rotation};
        let vTargetPosition = GeometricUtils.closestBorderposition(pRidden, RideableFlags.TokenForm(pRidden), pToken, vAlvo);
        vTargetPosition = [...GeometricUtils.GridSnap(vTargetPosition, FCore.sceneof(pRidden).grid, [(pRidden.width + pToken.width) % 2, (pRidden.height + pToken.height) % 2]), pToken.rotation - pRidden.rotation];
        RideableFlags.setRelativPosition(pToken, vTargetPosition).then(() => Ridingmanager.RequestUpdateRidderTokens(pRidden, [pToken]));
      }
      else {
        RideablePopups.TextPopUpID(pToken, "PreventedRiderMove", {pRiddenName: RideableFlags.RideableName(pRidden)}, {type: "warn"});
      }
    }

    if (vModo === "RiderMovement-moveridden") {
      vPermitir = false;
      if (pRidden.isOwner) Ridingmanager.#moverMontaria(pRidden, Ridingmanager.#caminhoRelativo(pMov), pMov);
    }

    Hooks.callAll(HOOK + ".IndependentRiderMovement", pToken, {x: pMov.origem.x + pMov.delta.x, y: pMov.origem.y + pMov.delta.y, elevation: pMov.origem.elevation + pMov.delta.elevation}, vPermitir);
    return vPermitir;
  }

  /** Move a montaria pelo mesmo caminho que o cavaleiro tentou fazer. */
  static #moverMontaria(pRidden, pCaminho, pOpcoes = {}) {
    const vGrid = FCore.sceneof(pRidden).grid;
    const vWaypoints = pCaminho.map((p) => {
      let [x, y] = [pRidden.x + p.dx, pRidden.y + p.dy];
      if (vGrid.type == 1) [x, y] = [Math.round(x / vGrid.size) * vGrid.size, Math.round(y / vGrid.size) * vGrid.size];
      return waypoint({x, y, elevation: pRidden.elevation + (p.dz || 0), action: p.action}, {snapped: vGrid.type == 1});
    });
    if (!vWaypoints.length) return;
    if (pRidden.documentName !== "Token") {
      pRidden.update({x: vWaypoints.at(-1).x, y: vWaypoints.at(-1).y}, {RidingMovement: true});
      return;
    }
    // a montaria respeita paredes normalmente (o v13 limita o caminho sozinho)
    pRidden.move(vWaypoints, {
      method: ["dragging", "keyboard", "api"].includes(pOpcoes.method) ? pOpcoes.method : "api",
      autoRotate: pOpcoes.autoRotate ?? false,
      showRuler: pOpcoes.showRuler ?? false,
      constrainOptions: pOpcoes.constrainOptions ?? {}
    });
  }

  /** Rotação do cavaleiro (não é movimento no v13): preUpdateToken. */
  static OnTokenpreupdate(pToken, pChanges, pInfos) {
    if (pInfos.RidingMovement || !("rotation" in pChanges) || !cfg("RiderRotation")) return;
    if (!RideableFlags.isRider(pToken) || pChanges.rotation == pToken.rotation) return;
    if (pInfos._movement?.[pToken.id]) return;
    const vRidden = RideableFlags.RiddenToken(pToken);
    if (!vRidden) return;
    if (RideableFlags.RiderscanMoveWithin(vRidden) && !RideableFlags.isFamiliarRider(pToken) && !RideableFlags.isGrappled(pToken)) {
      const vRel = RideableFlags.RelativPosition(pToken);
      RideableFlags.setRelativPosition(pToken, [vRel[0], vRel[1], pChanges.rotation - vRidden.rotation]);
      return;
    }
    const vGirarMontaria = RideableFlags.isPilotedby(vRidden, pToken) || (RideableUtils.getRiderMovementsetting() === "RiderMovement-moveridden");
    if (vGirarMontaria && vRidden.isOwner) vRidden.update({rotation: vRidden.rotation + (pChanges.rotation - pToken.rotation)});
    delete pChanges.rotation;
  }

  /* ---------- planejar ---------- */

  static RequestUpdateRidderTokens(pRiddenToken, pRiderTokenList = [], pAnimations = true) {
    if (!pRiddenToken) return;
    if (game.user.isGM) {
      Ridingmanager.UpdateRidderTokens(pRiddenToken, pRiderTokenList, pAnimations);
    }
    else if (!game.paused) {
      emitir("UpdateRidderTokensRequest", {pRiddenID: pRiddenToken.id, pRidersListIDs: RideableUtils.IDsfromTokens(pRiderTokenList), pSceneID: FCore.sceneof(pRiddenToken).id, pAnimations});
    }
  }

  static UpdateRidderTokensRequest(pRiddenID, pRidersListIDs, pSceneID, pAnimations) {
    if (!souGMAtivo()) return;
    const vScene = game.scenes.get(pSceneID);
    Ridingmanager.UpdateRidderTokens(RideableUtils.TokenfromID(pRiddenID, vScene), RideableUtils.TokensfromIDs(pRidersListIDs ?? [], vScene), pAnimations);
  }

  static UpdateRidderTokens(pRiddenToken, pRiderTokenList = [], pAnimations = true) {
    if (!pRiddenToken) return;
    if (pRiderTokenList.length > 0) return Ridingmanager.planRiderTokens(pRiddenToken, {}, pRiderTokenList, pAnimations);
    return Ridingmanager.planRiderTokens(pRiddenToken, {}, RideableFlags.RiderTokens(pRiddenToken), false);
  }

  /**
   * Calcula onde cada cavaleiro deve ficar e aplica.
   * pMovimento (opcional): {origin, waypoints, method, movementSpeed} do movimento da montaria.
   */
  static async planRiderTokens(pRiddenToken, pChanges, pRiderTokenList, pAnimations = true, pMovimento = undefined) {
    const vPlano = new Map();
    const vChanges = {...pChanges};
    Object.defineProperty(vChanges, "_plano", {value: vPlano, enumerable: false});

    let vRiderTokenList = pRiderTokenList.filter((r) => existe(r));
    let vRiderFamiliarList = [];
    let vGrappledList = [];

    if (cfg("Grappling")) {
      vGrappledList = vRiderTokenList.filter((vToken) => RideableFlags.isGrappled(vToken));
      vRiderTokenList = vRiderTokenList.filter((vToken) => !vGrappledList.includes(vToken));
    }

    Ridingmanager.placeRiderHeight(pRiddenToken, vRiderTokenList, false, vPlano);
    Ridingmanager.placeRiderHeight(pRiddenToken, vGrappledList, true, vPlano);

    if (cfg("FamiliarRiding")) {
      vRiderFamiliarList = vRiderTokenList.filter((vToken) => RideableFlags.isFamiliarRider(vToken));
      vRiderTokenList = vRiderTokenList.filter((vToken) => !vRiderFamiliarList.includes(vToken));
    }

    if (cfg("FitRidersize")) await Ridingmanager.fitRiders(pRiddenToken, vChanges, vRiderTokenList, cfg("FitRiderSizeFactor"));

    if (RideableFlags.RiderscanMoveWithin(pRiddenToken)) Ridingmanager.planRelativRiderTokens(pRiddenToken, vChanges, vRiderTokenList);
    else Ridingmanager.planPatternRidersTokens(pRiddenToken, vChanges, vRiderTokenList);

    Ridingmanager.placeRiderTokenscorner(pRiddenToken, vChanges, vRiderFamiliarList);

    let vSeguidores = [];
    switch (RideableFlags.GrapplePlacement(pRiddenToken)) {
      case cRowAbove:
        Ridingmanager.placeRidersTokensRow(pRiddenToken, vChanges, vGrappledList, [], vGrappledList.map((vToken) => (-GeometricUtils.insceneHeight(vToken) - GeometricUtils.insceneHeight(pRiddenToken)) / 2));
        break;
      case cRowMiddle:
        Ridingmanager.placeRidersTokensRow(pRiddenToken, vChanges, vGrappledList, [], vGrappledList.map(() => 0));
        break;
      case cClosestInside:
        Ridingmanager.planRelativRiderTokens(pRiddenToken, vChanges, vGrappledList);
        break;
      case cFollowing:
        vSeguidores = vGrappledList;
        break;
      default:
        Ridingmanager.placeRidersTokensRow(pRiddenToken, vChanges, vGrappledList, [], vGrappledList.map((vToken) => (GeometricUtils.insceneHeight(vToken) + GeometricUtils.insceneHeight(pRiddenToken)) / 2));
    }

    await Ridingmanager.#executarPlano(pRiddenToken, vPlano, pAnimations, pMovimento);

    if (vSeguidores.length) {
      await updatePathHistory(pRiddenToken, {});
      calculatenewRoute(vSeguidores, {StartRoute: true, Distance: Math.max(pRiddenToken.width, pRiddenToken.height) * pRiddenToken.parent.dimensions.distance, Target: pRiddenToken, Scene: pRiddenToken.parent, RidingMovement: true});
    }
  }

  /** Aplica o plano: uma atualização por cavaleiro, seguindo o caminho da montaria quando houver. */
  static async #executarPlano(pRidden, pPlano, pAnimations, pMovimento) {
    const vTeleporte = cfg("TeleportRiders");
    const vFinal = {x: pRidden.x, y: pRidden.y, elevation: pRidden.elevation};
    const vSobeJunto = pMovimento ? (vFinal.elevation - pMovimento.origin.elevation) : 0;
    const vPromessas = [];

    for (const {doc: vRider, x, y, elevation, rotation} of pPlano.values()) {
      if (!existe(vRider)) continue;
      const vDados = {};
      if (rotation !== undefined && rotation != vRider.rotation) vDados.rotation = rotation;
      // por cima da montaria quando estão na mesma altura
      if (pRidden.documentName == "Token" && vRider.sort <= pRidden.sort) vDados.sort = pRidden.sort + 1;

      // altura: a planejada (altura de montaria) ou acompanha o quanto a montaria subiu/desceu
      let vAltura = elevation;
      if (vAltura === undefined && vSobeJunto) vAltura = vRider.elevation + vSobeJunto;
      if (vAltura === undefined || !Number.isFinite(vAltura)) vAltura = vRider.elevation;

      const vX = x ?? vRider.x;
      const vY = y ?? vRider.y;
      const vMudouPosicao = (Math.round(vX) != vRider.x) || (Math.round(vY) != vRider.y) || (vAltura != vRider.elevation);

      let vAnimar = pAnimations;
      if (vTeleporte == "all" || (vTeleporte == "familiaronly" && RideableFlags.isFamiliarRider(vRider))) vAnimar = false;

      const vOpcoes = {RidingMovement: true};
      if (!vAnimar) vOpcoes.animate = false;
      else if (pMovimento?.movementSpeed !== undefined) vOpcoes.animation = {movementSpeed: pMovimento.movementSpeed};

      if (!vMudouPosicao) {
        if (Object.keys(vDados).length) vPromessas.push(vRider.update(vDados, vOpcoes));
        continue;
      }

      let vWaypoints;
      if (pMovimento?.waypoints?.length && vAnimar) {
        // mesmo caminho da montaria, deslocado para o lugar do cavaleiro
        const dx = vX - vFinal.x;
        const dy = vY - vFinal.y;
        const dz = vAltura - vFinal.elevation;
        const vPassos = pMovimento.waypoints.filter((w) => !w.intermediate);
        vWaypoints = vPassos.map((w) => waypoint({x: w.x + dx, y: w.y + dy, elevation: (w.elevation ?? vFinal.elevation) + dz, action: w.action}));
        if (vWaypoints.length) vWaypoints[vWaypoints.length - 1] = waypoint({x: vX, y: vY, elevation: vAltura, action: vPassos.at(-1)?.action});
      }
      if (!vWaypoints?.length) {
        vWaypoints = [waypoint({x: vX, y: vY, elevation: vAltura, action: vAnimar ? undefined : "displace"})];
      }

      if (RideableCompUtils.isactiveModule(cTerrainMapper) || RideableCompUtils.isactiveModule(cTerrainMapperOLD)) {
        vPromessas.push(vRider.update({...vDados, x: Math.round(vX), y: Math.round(vY), elevation: vAltura}, vOpcoes));
      }
      else {
        vPromessas.push(moverToken(vRider, vWaypoints, vDados, vOpcoes));
      }
    }
    await Promise.allSettled(vPromessas);
  }

  /** Altura de cada cavaleiro (vai para o plano; não grava ainda). */
  static placeRiderHeight(pRiddenToken, pRiderTokenList, pPlaceSameheight = false, pPlano = undefined) {
    for (const vRider of pRiderTokenList) {
      if (!RideableFlags.UseRidingHeight(pRiddenToken)) continue;
      let vTargetz = pRiddenToken.elevation;
      if (!isFinite(vTargetz)) vTargetz = 0;
      if (!pPlaceSameheight) {
        const vRidingHeight = RideableFlags.HascustomRidingHeight(pRiddenToken) ? RideableFlags.customRidingHeight(pRiddenToken) : RideableUtils.Ridingheight(pRiddenToken);
        vTargetz = vTargetz + Number(vRidingHeight || 0) + RideableFlags.addRiderHeight(vRider);
      }
      if (pPlano) Ridingmanager.#noPlano(pPlano, vRider).elevation = vTargetz;
      else if (vRider.elevation != vTargetz) moverToken(vRider, [waypoint({x: vRider.x, y: vRider.y, elevation: vTargetz})], {}, {RidingMovement: true});
    }
  }

  static #noPlano(pPlano, pRider) {
    if (!pPlano.has(pRider.id)) pPlano.set(pRider.id, {doc: pRider});
    return pPlano.get(pRider.id);
  }

  static async fitRiders(pRiddenToken, pChanges, pRiderTokenList, pSizeFactor = cSizeFactor) {
    const vGeometry = GeometricUtils.updatedGeometry(pRiddenToken, pChanges);
    if (pRiddenToken.documentName != "Token") return;
    for (const vRider of pRiderTokenList) {
      if ((vRider.width >= vGeometry.width) && (vRider.height >= vGeometry.height)) {
        const vUpdate = {width: pSizeFactor * vGeometry.width, height: pSizeFactor * vGeometry.height};
        if (RideableUtils.isPf2e()) await vRider.update({flags: {pf2e: {linkToActorSize: false}}}, {RidingMovement: true});
        // tamanho é movimento no v13; o plano reposiciona logo depois
        await moverToken(vRider, [waypoint({x: vRider.x, y: vRider.y}, vUpdate)], {}, {RidingMovement: true, animate: false});
      }
    }
  }

  static planRelativRiderTokens(pRiddenToken, pChanges, pRiderTokenList) {
    const vRiddenForm = RideableFlags.TokenForm(pRiddenToken);
    const vRiddenGeometry = GeometricUtils.updatedGeometry(pRiddenToken, pChanges);

    for (const vRider of pRiderTokenList) {
      let vTargetPosition = RideableFlags.RelativPosition(vRider);

      if (!RideableFlags.HasrelativPosition(vRider)) {
        if (!GeometricUtils.withinBoundariesupdated(pRiddenToken, pChanges, vRiddenForm, GeometricUtils.CenterPosition(vRider))) {
          vTargetPosition = GeometricUtils.closestBorderposition(pRiddenToken, vRiddenForm, vRider);
        }
        else {
          const vRiderCenter = GeometricUtils.CenterPositionXY(vRider);
          vTargetPosition = GeometricUtils.Rotated([vRiderCenter.x - vRiddenGeometry.x, vRiderCenter.y - vRiddenGeometry.y], -pRiddenToken.rotation);
        }
        vTargetPosition = [...GeometricUtils.GridSnap(vTargetPosition, FCore.sceneof(pRiddenToken).grid, [(vRiddenGeometry.width + vRider.width) % 2, (vRiddenGeometry.height + vRider.height) % 2]), vRider.rotation - vRiddenGeometry.rotation];
        RideableFlags.setRelativPosition(vRider, vTargetPosition);
      }

      Ridingmanager.placeTokenrotated(pRiddenToken, pChanges, vRider, vTargetPosition[0], vTargetPosition[1], vTargetPosition[2]);
    }
  }

  static planPatternRidersTokens(pRiddenToken, pChanges, pRiderTokenList) {
    let vRiddenGeometry = GeometricUtils.updatedGeometry(pRiddenToken, pChanges);

    if (pRiderTokenList.length) {
      let vAngleSteps;

      let vBasicOffset = RideableFlags.RidersOffset(pRiddenToken, true);

      let vRotOffset = 0;

      switch (RideableFlags.RiderPositioning(pRiddenToken)) {
        case cCircleplacement:
          vAngleSteps = 360/pRiderTokenList.length;

          let vMaxHeight = 0;
          let vMaxWidth = 0;

          vRotOffset = RideableFlags.RidersRotOffset(pRiddenToken);

          for (let i = 0; i < pRiderTokenList.length; i++) {
            vMaxHeight = Math.max(vMaxHeight, GeometricUtils.insceneHeight(pRiderTokenList[i]));
            vMaxWidth = Math.max(vMaxWidth, GeometricUtils.insceneWidth(pRiderTokenList[i]));
          }

          vMaxHeight = (vRiddenGeometry.insceneHeight - vMaxHeight)/2;
          vMaxWidth = (vRiddenGeometry.insceneWidth - vMaxWidth)/2;

          for (let i = 0; i < pRiderTokenList.length; i++) {
            Ridingmanager.placeTokenrotated(pRiddenToken, pChanges, pRiderTokenList[i], vMaxWidth * Math.sin(vAngleSteps*cGradtoRad*i) + vBasicOffset[0], -vMaxHeight * Math.cos(vAngleSteps*cGradtoRad*i) + vBasicOffset[1], vRotOffset);
          }

          break;
        case cBlockplacement:
          const cSizeFactor = FCore.sceneof(pRiddenToken).dimensions.size/2;

          let vxsize;
          let vysize;

          vRotOffset = RideableFlags.RidersRotOffset(pRiddenToken);

          switch (pRiddenToken.documentName) {
            case "Token":
              vxsize = Math.round(vRiddenGeometry.width * 2);
              vysize = Math.round(vRiddenGeometry.height * 2);
              break;
            case "Tile":
              vxsize = Math.round(vRiddenGeometry.width / cSizeFactor);
              vysize = Math.round(vRiddenGeometry.height / cSizeFactor);
              break;
          }

          let vplanningMatrix = [];

          for (let x = 0; x < vxsize; x++) {
            vplanningMatrix[x] = [];
            for (let y = 0; y < vysize; y++) {
              vplanningMatrix[x][y] = true;
            }
          }

          function useSpace(vpositionx, vpositiony, vwidth, vheight) {
            for (let x = vpositionx; x < Math.min(vxsize, vpositionx + vwidth); x++) {
              for (let y = vpositiony; y < Math.min(vysize, vpositiony + vheight); y++) {
                vplanningMatrix[x][y] = false;
              }
            }
          }

          function searchfreeSpace(vwidth, vheight) {
            let vx = 0;
            let vy = 0;
            while (vy <= vysize-vheight) {
              vx = 0;
              while (vx <= vxsize-vwidth) {
                let vfoundbuffer = true;

                let vrelativey = 0;
                while (vfoundbuffer && vrelativey < vheight) {
                  let vrelativex = 0;
                  while (vfoundbuffer && vrelativex < vwidth) {
                    vfoundbuffer = vfoundbuffer && vplanningMatrix[vx + vrelativex][vy + vrelativey];

                    vrelativex = vrelativex + 1;
                  }
                  vrelativey = vrelativey + 1;
                }

                if (vfoundbuffer) {
                  return [vx, vy];
                }

                vx = vx + 1;
              }
              vy = vy + 1;
            }

            vx = 0;
            vy = 0;
            while (vy < vysize) {
              vx = 0;
              while (vx < vxsize) {
                if (vplanningMatrix[vx][vy]) {
                  return [vx, vy];
                };

                vx = vx + 1;
              }
              vy = vy + 1;
            }
          }

          let vsortedRiders = pRiderTokenList.sort((a,b) => {return (a.height * a.width) - (b.height * b.width)}).reverse();

          const cxOffset = -vRiddenGeometry.insceneWidth/2;
          const cyOffset = -vRiddenGeometry.insceneHeight/2;

          for (const vrider of vsortedRiders) {
            let vtargetposition = searchfreeSpace(vrider.width * 2, vrider.height * 2);

            if (!vtargetposition) {
              vtargetposition = [0,0];
            }

            useSpace(vtargetposition[0], vtargetposition[1], vrider.width * 2, vrider.height * 2);

            let vTargetx = cxOffset + (vtargetposition[0] + vrider.width) * cSizeFactor;
            let vTargety = cyOffset + (vtargetposition[1] + vrider.height) * cSizeFactor;

            Ridingmanager.placeTokenrotated(pRiddenToken, pChanges, vrider, vTargetx  + vBasicOffset[0], vTargety + vBasicOffset[1], vRotOffset);
          }

          break;
        case cClusterplacement:
            let vSizeFactor = GeometricUtils.insceneSize(pRiddenToken);

            vRotOffset = RideableFlags.RidersRotOffset(pRiddenToken);

            let vsortedTokens;
            let vsortedSizes;
            let vPlacementInterval = [0,0];
            vAngleSteps = 0;
            let vBaseRadius = 0;
            let vMaxSize;
            let vSizesumm;

            [vsortedTokens, vsortedSizes] = GeometricUtils.sortbymaxdim(pRiderTokenList);

            vsortedTokens.reverse();
            vsortedSizes.reverse();

            vMaxSize = vsortedSizes[0];

            while (vPlacementInterval[1] < vsortedTokens.length) {
              for (let i = vPlacementInterval[0]; i <= vPlacementInterval[1]; i++) {
                Ridingmanager.placeTokenrotated(pRiddenToken, pChanges, pRiderTokenList[i], vBaseRadius * vSizeFactor * Math.sin(vAngleSteps*cGradtoRad*i) + vBasicOffset[0], -vBaseRadius * vSizeFactor * Math.cos(vAngleSteps*cGradtoRad*i) + vBasicOffset[1], vRotOffset);
              }

              vBaseRadius = vBaseRadius + vMaxSize/2;

              vPlacementInterval[0] = vPlacementInterval[1] + 1;
              vPlacementInterval[1] = vPlacementInterval[0];

              vMaxSize = vsortedSizes[vPlacementInterval[0]];
              vSizesumm = vsortedSizes[vPlacementInterval[0]];

              while (((vPlacementInterval[1]+1) < vsortedTokens.length) && ((2*vBaseRadius + Math.max(vsortedSizes[vPlacementInterval[1]+1], vMaxSize))*Math.PI > (vSizesumm + vsortedSizes[vPlacementInterval[1]+1]))) {
                vPlacementInterval[1] = vPlacementInterval[1] + 1;

                vMaxSize = Math.max(vMaxSize, vsortedSizes[vPlacementInterval[1]]);
                vSizesumm = vSizesumm + vsortedSizes[vPlacementInterval[1]];
              }

              vAngleSteps = 360/(vPlacementInterval[1] - vPlacementInterval[0] + 1);

              vBaseRadius = vBaseRadius + vMaxSize/2;
            }

          break;
        case cRowplacementTop:
          Ridingmanager.placeRidersTokensRow(pRiddenToken, pChanges, pRiderTokenList, [vBasicOffset[0]], pRiderTokenList.map(vToken => (GeometricUtils.insceneHeight(vToken)-GeometricUtils.insceneHeight(pRiddenToken))/2 + vBasicOffset[1]));
          break;
        case cRowplacementBottom:
          Ridingmanager.placeRidersTokensRow(pRiddenToken, pChanges, pRiderTokenList, [vBasicOffset[0]], pRiderTokenList.map(vToken => (-GeometricUtils.insceneHeight(vToken)+GeometricUtils.insceneHeight(pRiddenToken))/2 + vBasicOffset[1]));
          break;
        case cCornerPlacement:
        case cCornerPlacementinner:
          if (pRiderTokenList.length <= 4) {
            Ridingmanager.placeRiderTokenscorner(pRiddenToken, pChanges, pRiderTokenList, RideableFlags.RiderPositioning(pRiddenToken) == cCornerPlacementinner, [vBasicOffset[0]], [vBasicOffset[1]]);
          }
          else {
            Ridingmanager.placeRidersTokensRow(pRiddenToken, pChanges, pRiderTokenList, [vBasicOffset[0]], [vBasicOffset[1]]);
          }
          break;
        case cMountPosition:
          Ridingmanager.planRelativRiderTokens(pRiddenToken, pChanges, pRiderTokenList);
          break;
        case cRowplacement:
        default:
          Ridingmanager.placeRidersTokensRow(pRiddenToken, pChanges, pRiderTokenList, [vBasicOffset[0]], [vBasicOffset[1]]);
      }
    }
  }

  static placeRidersTokensRow(pRiddenToken, pChanges, pRiderTokenList, pxoffset = [], pyoffset = []) {
    let vRiddenGeometry = GeometricUtils.updatedGeometry(pRiddenToken, pChanges);

    if (pRiderTokenList.length) {
      let vbunchedRiders = true;
      let vxoffset = 0;
      let vxdelta = 0;

      let vRiderWidthSumm = 0;
      for (let i = 0; i < pRiderTokenList.length; i++) {
        vRiderWidthSumm = vRiderWidthSumm + GeometricUtils.insceneWidth(pRiderTokenList[i]);
      }

      if (vRiderWidthSumm > vRiddenGeometry.insceneWidth) {
        vxoffset = -vRiddenGeometry.insceneWidth/2 + GeometricUtils.insceneWidth(pRiderTokenList[0])/2;
        if (pRiderTokenList.length > 1) {
          vxdelta = (vRiddenGeometry.insceneWidth - (GeometricUtils.insceneWidth(pRiderTokenList[pRiderTokenList.length - 1]) + GeometricUtils.insceneWidth(pRiderTokenList[0]))/2)/(pRiderTokenList.length-1);
        }
      }
      else {
        vbunchedRiders = false;

        vxoffset = -vRiderWidthSumm/2 + GeometricUtils.insceneWidth(pRiderTokenList[0])/2;
      }

      for (let i = 0; i < pRiderTokenList.length; i++) {
        let vTargetx = 0;
        let vTargety = 0;

        if (vbunchedRiders) {
          vTargetx = vxoffset + i*vxdelta;
        }
        else {
          if (i > 0) {
            vTargetx = vxoffset + (GeometricUtils.insceneWidth(pRiderTokenList[i-1])+GeometricUtils.insceneWidth(pRiderTokenList[i]))/2;
            vxoffset = vTargetx;
          }
          else {
            vTargetx = vxoffset;
          }
        }

        if (pxoffset.length) {
          vTargetx = vTargetx + pxoffset[i%pxoffset.length];
        }

        if (pyoffset.length) {
          vTargety = vTargety + pyoffset[i%pyoffset.length];
        }

        let vRotOffset = RideableFlags.RidersRotOffset(pRiddenToken);

        Ridingmanager.placeTokenrotated(pRiddenToken, pChanges, pRiderTokenList[i], vTargetx, vTargety, vRotOffset);
      }
    }
  }

  static placeRiderTokenscorner(pRiddenToken, pChanges, pRiderTokenList, pInner = false, pxoffset = [], pyoffset = []) {
    let vRiddenGeometry = GeometricUtils.updatedGeometry(pRiddenToken, pChanges);

    if (pRiderTokenList.length) {
      for (let i = 0; i < Math.min(Math.max(pRiderTokenList.length, cCornermaxRiders-1), pRiderTokenList.length); i++) {
        let vTargetx = 0;
        let vTargety = 0;

        let vXoffset = 0;
        let vYoffset = 0;

        if (pInner) {
          vXoffset = GeometricUtils.insceneWidth(pRiderTokenList[i])/2;
          vYoffset = GeometricUtils.insceneHeight(pRiderTokenList[i])/2;
        }

        switch ((i + Number(cfg("FamiliarRidingFirstCorner")))%cCornermaxRiders) {
          case 0: //tl
            vTargetx = -vRiddenGeometry.insceneWidth/2 + vXoffset;
            vTargety = -vRiddenGeometry.insceneHeight/2 + vYoffset;
            break;

          case 1: //tr
            vTargetx = vRiddenGeometry.insceneWidth/2 - vXoffset;
            vTargety = -vRiddenGeometry.insceneHeight/2 + vYoffset;
            break;

          case 2: //bl
            vTargetx = -vRiddenGeometry.insceneWidth/2 + vXoffset;
            vTargety = vRiddenGeometry.insceneHeight/2 - vYoffset;
            break;

          case 3: //br
            vTargetx = vRiddenGeometry.insceneWidth/2 - vXoffset;
            vTargety = vRiddenGeometry.insceneHeight/2 - vYoffset;
            break;
        }

        if (pxoffset.length) {
          vTargetx = vTargetx + pxoffset[i%pxoffset.length];
        }

        if (pyoffset.length) {
          vTargety = vTargety + pyoffset[i%pyoffset.length];
        }

        let vRotOffset = RideableFlags.RidersRotOffset(pRiddenToken);

        Ridingmanager.placeTokenrotated(pRiddenToken, pChanges, pRiderTokenList[i], vTargetx, vTargety, vRotOffset);
      }
    }
  }


  /** Posição (relativa ao centro da montaria, já girada) de um cavaleiro; vai para o plano. */
  static placeTokenrotated(pRiddenToken, pChanges, pRider, pTargetx, pTargety, pRelativerotation = 0) {
    const vRiddenGeometry = GeometricUtils.updatedGeometry(pRiddenToken, pChanges);
    const vPlano = pChanges._plano ? Ridingmanager.#noPlano(pChanges._plano, pRider) : {doc: pRider};
    let vTargetx = pTargetx;
    let vTargety = pTargety;

    if (cfg("RiderRotation")) {
      [vTargetx, vTargety] = GeometricUtils.Rotated([pTargetx, pTargety], vRiddenGeometry.rotation);
      vPlano.rotation = (vRiddenGeometry.rotation + (pRelativerotation || 0)) % 360;
    }

    vTargetx = vRiddenGeometry.x - GeometricUtils.insceneWidth(pRider) / 2 + vTargetx;
    vTargety = vRiddenGeometry.y - GeometricUtils.insceneHeight(pRider) / 2 + vTargety;

    if (cfg("CheckRiderCollision")) {
      // não deixa o cavaleiro do outro lado de uma parede em relação ao centro da montaria
      const vRiderCenter = {x: vTargetx + GeometricUtils.insceneWidth(pRider) / 2, y: vTargety + GeometricUtils.insceneHeight(pRider) / 2};
      const vCollision = CONFIG.Canvas.polygonBackends.move.testCollision({x: vRiddenGeometry.x, y: vRiddenGeometry.y, elevation: pRiddenToken.elevation ?? 0}, {...vRiderCenter, elevation: pRiddenToken.elevation ?? 0}, {type: "move", mode: "closest"});
      if (vCollision) {
        // recua um pouco da parede, na direção do centro da montaria
        const vDir = GeometricUtils.scaleto([vRiddenGeometry.x - vCollision.x, vRiddenGeometry.y - vCollision.y], 2);
        vTargetx = vCollision.x + vDir[0] - GeometricUtils.insceneWidth(pRider) / 2;
        vTargety = vCollision.y + vDir[1] - GeometricUtils.insceneHeight(pRider) / 2;
      }
    }

    vPlano.x = vTargetx;
    vPlano.y = vTargety;
    if (!pChanges._plano) Ridingmanager.#executarPlano(pRiddenToken, new Map([[pRider.id, vPlano]]), true);
  }

  /** Ao desmontar: volta à altura da montaria (ou tira a altura de montaria). */
  static async UnsetRidingHeight(pRiderTokens, pRiddenTokens) {
    for (let i = 0; i < pRiderTokens.length; i++) {
      const vRider = pRiderTokens[i];
      const vRidden = pRiddenTokens[i];
      if (!existe(vRider)) continue;
      if (vRidden && !RideableFlags.UseRidingHeight(vRidden)) continue;
      let vTargetz;
      if (vRidden) {
        vTargetz = vRidden.elevation;
        if (!isFinite(vTargetz)) vTargetz = 0;
      }
      else {
        vTargetz = vRider.elevation - RideableUtils.Ridingheight();
      }
      if (vTargetz != vRider.elevation) {
        await moverToken(vRider, [waypoint({x: vRider.x, y: vRider.y, elevation: vTargetz})], {}, {RidingMovement: true});
      }
    }
  }

  /* ---------- pilotar ---------- */

  static MoveRiddenGM(pRidden, pRelativChanges, pInfos) {
    if (!pRidden || !pInfos?.MovedbyPilot) return;
    const vScene = FCore.sceneof(pRidden);
    const vPilot = vScene.tokens.get(pInfos.PilotID);

    if (!RideableUtils.canbeMoved(pRidden)) {
      RideablePopups.TextPopUpID(vPilot, "cantbeMoved", {pRiddenName: RideableFlags.RideableName(pRidden)}, {type: "error"});
      return;
    }
    if (!vPilot || !RideableFlags.isPilotedby(pRidden, vPilot)) {
      RideablePopups.TextPopUpID(vPilot, "cantPilot", {pRiddenName: RideableFlags.RideableName(pRidden)}, {type: "error"});
      return;
    }

    const vCaminho = pInfos.caminho?.length ? pInfos.caminho : [{dx: pRelativChanges.x || 0, dy: pRelativChanges.y || 0, dz: pRelativChanges.elevation || 0}];
    // com colisão: paredes limitam a montaria; sem colisão: atravessa
    const vRestricao = RideableFlags.CheckPilotedCollision(pRidden) ? {} : {ignoreWalls: true, ignoreTokens: true};
    if (pRidden.documentName === "Token") {
      Ridingmanager.#moverMontaria(pRidden, vCaminho, {constrainOptions: vRestricao});
    }
    else {
      // tiles não têm movimento do v13: testa as paredes à mão como o original
      const vFinal = vCaminho.at(-1);
      const vChanges = {x: vFinal.dx, y: vFinal.dy};
      if (RideableFlags.CheckPilotedCollision(pRidden)) {
        const vCurrentPoints = GeometricUtils.fourspread(GeometricUtils.changedGeometry(pRidden));
        const vTargetPoints = GeometricUtils.fourspread(GeometricUtils.changedGeometry(pRidden, vChanges));
        for (let i = 0; i < 4; i++) {
          if (CONFIG.Canvas.polygonBackends.move.testCollision(vCurrentPoints[i], vTargetPoints[(i + 2) % 4], {type: "move", mode: "any"})) return;
          if (CONFIG.Canvas.polygonBackends.move.testCollision(vTargetPoints[i], vTargetPoints[(i + 1) % 4], {type: "move", mode: "any"})) return;
        }
      }
      pRidden.update({x: pRidden.x + vFinal.dx, y: pRidden.y + vFinal.dy, elevation: pRidden.elevation + (vFinal.dz || 0)}, {RidingMovement: true});
    }
  }

  static RequestMoveRidden(pRidden, pRelativChanges, pInfos) {
    if (!pRidden) return;
    if (game.user.isGM) Ridingmanager.MoveRiddenGM(pRidden, pRelativChanges, pInfos);
    else if (!game.paused) emitir("MoveRiddenRequest", {pRiddenID: pRidden.id, pSceneID: FCore.sceneof(pRidden).id, pRelativChanges, pInfos});
  }

  static MoveRiddenRequest(pRiddenID, pSceneID, pRelativChanges, pInfos) {
    if (!souGMAtivo()) return;
    Ridingmanager.MoveRiddenGM(RideableUtils.TokenfromID(pRiddenID, game.scenes.get(pSceneID)), pRelativChanges, pInfos);
  }

  /* ---------- apoio ---------- */

  static MovementDelta(pToken, pchanges) {
    return {
      x: (pchanges.x != undefined) ? pchanges.x - pToken.x : 0,
      y: (pchanges.y != undefined) ? pchanges.y - pToken.y : 0,
      rotation: (pchanges.rotation != undefined) ? pchanges.rotation - pToken.rotation : 0,
      elevation: (pchanges.elevation != undefined) ? pchanges.elevation - pToken.elevation : 0
    };
  }

  /** No teclado, um cavaleiro fora do grid andaria "meio quadrado": usa um quadrado inteiro. */
  static keydownMoveReplacement() {
    if (canvas.grid.type != 1) return {};
    const csize = canvas.grid.size;
    const vReplacement = {x: 0, y: 0};
    const vTeclas = game.keyboard.downKeys;
    const vTem = (pSet) => [...pSet].some((k) => vTeclas.has(k));
    if (vTem(cupkeys)) vReplacement.y -= csize;
    if (vTem(cdownkeys)) vReplacement.y += csize;
    if (vTem(cleftkeys)) vReplacement.x -= csize;
    if (vTem(crightkeys)) vReplacement.x += csize;
    if (!vReplacement.x && !vReplacement.y) return {};
    return vReplacement;
  }
}

function RequestUpdateRidderTokens(pRiddenToken, pRiderTokenList = [], pAnimations = true) {
  Ridingmanager.RequestUpdateRidderTokens(pRiddenToken, pRiderTokenList, pAnimations);
}

function UpdateRidderTokensRequest({pRiddenID, pRidersListIDs, pSceneID, pAnimations} = {}) {
  Ridingmanager.UpdateRidderTokensRequest(pRiddenID, pRidersListIDs, pSceneID, pAnimations);
}

function UpdateRidderTokens(pRiddenToken, vRiderTokenList, pAnimations = true) {
  return Ridingmanager.UpdateRidderTokens(pRiddenToken, vRiderTokenList, pAnimations);
}

async function UnsetRidingHeight(pRiderTokens, pRiddenTokens) {
  await Ridingmanager.UnsetRidingHeight(pRiderTokens, pRiddenTokens);
}

function MoveRiddenRequest({pRiddenID, pSceneID, pRelativChanges, pInfos} = {}) {
  Ridingmanager.MoveRiddenRequest(pRiddenID, pSceneID, pRelativChanges, pInfos);
}

/** Pedido antigo de sincronizar a ordem (o original mudava sort só na memória); hoje a ordem é gravada. */
function SyncSortRequest() {}

export { RequestUpdateRidderTokens, UpdateRidderTokensRequest, UpdateRidderTokens, UnsetRidingHeight, MoveRiddenRequest, SyncSortRequest };

export function ligarCavalgar() {
  Hooks.on("moveToken", (...args) => Ridingmanager.OnRiddenMoved(...args));
  Hooks.on("updateToken", (...args) => Ridingmanager.OnTokenupdate(...args));
  Hooks.on("updateTile", (pTile, pChanges, pInfos, pUserID) => Ridingmanager.OnTokenupdate(pTile, pChanges, pInfos, pUserID, true));
  Hooks.on("preMoveToken", (...args) => Ridingmanager.OnRiderPreMove(...args));
  Hooks.on("preUpdateToken", (...args) => Ridingmanager.OnTokenpreupdate(...args));
}
