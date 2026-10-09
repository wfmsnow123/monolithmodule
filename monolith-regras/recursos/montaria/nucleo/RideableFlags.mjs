/**
 * Todas as leituras e escritas das flags da Montaria. As flags ficam em
 * flags["monolith-regras"].montaria.<nome> (antes flags.Rideable.<nome>); os nomes são os do original,
 * então a migração só copia o objeto.
 */
import * as FCore from "./base.mjs";
import { cfg, cDelimiter, Translate, FLAG_ESCOPO, FLAG_PREFIXO, RECURSO } from "./base.mjs";
import { RideableUtils } from "./RideableUtils.mjs";
import { cTokenForms } from "./GeometricUtils.mjs";
import { GeometricUtils } from "./GeometricUtils.mjs";

const cRidingF = "RidingFlag";
const cFamiliarRidingF = "FamiliarRidingFlag";
const cRidersF = "RidersFlag";
const caddRiderHeightF = "addRiderHeightFlag";
const cMaxRiderF = "MaxRiderFlag";
const cissetRideableF = "issetRideableFlag";
const cTokenFormF = "TokenFormFlag";
const cInsideMovementF = "InsideMovementFlag";
const cRelativPositionF = "RelativPositionFlag";
const cRiderPositioningF = "RiderPositioningFlag";
const cSpawnRidersF = "SpawnRidersFlag";
const cGrappledF = "GrappledFlag";
const ccanbeGrappledF = "canbeGrappledFlag";
const cGrapplingEffectsF = "GrapplingEffectsFlag";
const cSizesaveF = "SizesaveFlag";
const cScaleSizesaveF = "ScaleSizesaveFlag";
const cRidersScaleF = "RidersScaleFlag";
const cCustomRidingheightF = "CustomRidingheightFlag";
const cRideableEffectF = "RideableEffectFlag";
const cRideableMountEffectF = "RideableMountEffectFlag";
const cMountingEffectsF = "MountingEffectsFlag";
const cWorldMEffectOverrideF = "WorldMEffectOverrideFlag";
const cTileRideableNameF = "TileRideableNameFlag";
const cMountonEnterF = "MountonEnterFlag";
const cGrapplePlacementF = "GrapplePlacementFlag";
const cSelfApplyEffectsF = "SelfApplyEffectsFlag";
const cAutoMountBlackListF = "AutoMountBlackListFlag";
const cAutoMountWhiteListF = "AutoMountWhiteListFlag";
const cPositionLockF = "PositionLockFlag";
const cCanbePilotedF = "CanbePilotedFlag";
const cCheckPilotedCollisionF = "CheckPilotedCollisionFlag";
const cPilotedbyDefaultF = "PilotedbyDefaultFlag";
const cisPilotingF = "isPilotingFlag";
const cforMountEffectsF = "forMountEffectsFlag";
const cRiderOffsetF = "RiderOffsetFlag";
const cRiderRotOffsetF = "RiderRotOffsetFlag";
const cisMountItemF = "isMountItemFlag";
const cfollowedTokenF = "followedTokenFlag";
const cfollowDistanceF = "followDistanceFlag";
const cplannedRouteF = "plannedRouteFlag";
const cFollowOrderPlayerIDF = "FollowOrderPlayerIDFlag";
const cPathHistoryF = "PathHistoryFlag";
const cUseRidingHeightF = "UseRidingHeightFlag";
const cRegisteredActorEffectsF = "RegisteredActorEffectsFlag";

const cCornermaxRiders = 4;
const cPointEpsilon = 1;
const cPathMaxHistory = 100;

export { cCornermaxRiders };
export { cRidingF, cFamiliarRidingF, cRidersF, caddRiderHeightF, cMaxRiderF, cissetRideableF, cTokenFormF, cInsideMovementF, cRiderPositioningF, cSpawnRidersF, ccanbeGrappledF, cRidersScaleF, cCustomRidingheightF, cMountingEffectsF, cWorldMEffectOverrideF, cTileRideableNameF, cMountonEnterF, cGrapplePlacementF, cSelfApplyEffectsF, cAutoMountBlackListF, cAutoMountWhiteListF, cCanbePilotedF, cCheckPilotedCollisionF, cPilotedbyDefaultF, cforMountEffectsF, cRiderOffsetF, cRiderRotOffsetF, cUseRidingHeightF, cGrapplingEffectsF, cisMountItemF };

/** Objeto de flags do recurso num documento (ou em dados soltos de token). */
function flagsDe(doc) {
  return doc?.flags?.[FLAG_ESCOPO]?.[RECURSO];
}

/** Lê uma flag; arrays e objetos voltam copiados para ninguém mexer no _source por engano. */
function ler(doc, nome, padrao) {
  const f = flagsDe(doc);
  if (f && Object.hasOwn(f, nome) && f[nome] !== undefined && f[nome] !== null) {
    const v = f[nome];
    return (typeof v === "object") ? foundry.utils.deepClone(v) : v;
  }
  return (typeof padrao === "function") ? padrao() : padrao;
}

async function gravar(doc, nome, valor) {
  if (!doc?.setFlag) return false;
  await doc.setFlag(FLAG_ESCOPO, FLAG_PREFIXO + nome, valor);
  return true;
}

/** Caminho de uma flag para update() ou name= de formulário. */
export const caminhoFlag = (nome) => `flags.${FLAG_ESCOPO}.${RECURSO}.${nome}`;

class RideableFlags {
  /* ---------- leituras básicas ---------- */
  static #Riders(pToken) { const v = ler(pToken, cRidersF, []); return Array.isArray(v) ? v : []; }
  static #MaxRider(pToken) {
    const v = ler(pToken, cMaxRiderF, undefined);
    return (typeof v === "number") ? v : cfg("MaxRiders");
  }
  static #issetRideable(pToken) {
    return ler(pToken, cissetRideableF, () => cfg("defaultRideable") && !(pToken?.documentName == "Tile"));
  }
  static #TokenForm(pToken) {
    return ler(pToken, cTokenFormF, () => pToken?.documentName == "Tile" ? cTokenForms[1] : cTokenForms[0]);
  }
  static #RelativPosition(pToken) { const v = ler(pToken, cRelativPositionF, []); return Array.isArray(v) ? v : []; }
  static #SizeSave(pToken) { const v = ler(pToken, cSizesaveF, []); return Array.isArray(v) ? v : []; }
  static #CustomRidingheight(pToken) {
    const v = ler(pToken, cCustomRidingheightF, -1);
    return (typeof v === "number") ? v : -1;
  }
  static #isPilotingFlag(pToken) { return !!ler(pToken, cisPilotingF, false); }
  static #PositionLock(pToken) { return !!ler(pToken, cPositionLockF, false); }
  static #followedToken(pToken) { return ler(pToken, cfollowedTokenF, "") || ""; }
  static #plannedRoute(pToken) { const v = ler(pToken, cplannedRouteF, []); return Array.isArray(v) ? v : []; }
  static #PathHistory(pToken) { const v = ler(pToken, cPathHistoryF, []); return Array.isArray(v) ? v : []; }
  static #texto(pToken, nome) { const v = ler(pToken, nome, ""); return (typeof v === "string") ? v : ""; }
  static #lista(pToken, nome) { return this.#texto(pToken, nome).split(cDelimiter).map((s) => s.trim()).filter(Boolean); }

  static async #setRidersFlag(pToken, pContent) {
    if (!pToken || !Array.isArray(pContent)) return false;
    return gravar(pToken, cRidersF, [...new Set(pContent.filter((vID) => vID && vID != pToken.id))]);
  }

  /* ---------- montaria ---------- */
  static isRidden(pRiddenToken) { return this.#Riders(pRiddenToken).length > 0; }

  static TokenissetRideable(pToken) { return this.#issetRideable(pToken); }

  static TokenisRideable(pToken) {
    return (RideableFlags.TokenissetRideable(pToken) || RideableUtils.TokenissettingRideable(pToken));
  }

  static isRiddenID(pRiddenTokenID, pScene = null) {
    const vToken = RideableUtils.TokenfromID(pRiddenTokenID, pScene);
    return vToken ? RideableFlags.isRidden(vToken) : false;
  }

  static isRiddenbyID(pRiddenToken, pRiderID) { return this.#Riders(pRiddenToken).includes(pRiderID); }

  static isRiddenby(pRiddenToken, pRider) { return pRider ? this.isRiddenbyID(pRiddenToken, pRider.id) : false; }

  static isRider(pRiderToken) { return !!ler(pRiderToken, cRidingF, false); }

  static isFamiliarRider(pRiderToken) { return this.isRider(pRiderToken) && !!ler(pRiderToken, cFamiliarRidingF, false); }

  static wasFamiliarRider(pRiderToken) { return !!ler(pRiderToken, cFamiliarRidingF, false); }

  static isGrappled(pRiderToken) { return this.isRider(pRiderToken) && !!ler(pRiderToken, cGrappledF, false); }

  static canbeGrappled(pToken) { return ler(pToken, ccanbeGrappledF, true); }

  static isGrappledby(pRiderToken, pRiddenToken) {
    return this.isGrappled(pRiderToken) && this.isRiddenby(pRiddenToken, pRiderToken);
  }

  static wasGrappled(pRiderToken) { return !!ler(pRiderToken, cGrappledF, false); }

  static isRiderID(pRiderTokenID, pScene = null) {
    const vToken = RideableUtils.TokenfromID(pRiderTokenID, pScene);
    return vToken ? this.isRider(vToken) : false;
  }

  static isFamiliarRiderID(pRiderTokenID, pScene = null) {
    const vToken = RideableUtils.TokenfromID(pRiderTokenID, pScene);
    return vToken ? this.isFamiliarRider(vToken) : false;
  }

  static isGrappledID(pRiderTokenID, pScene = null) {
    const vToken = RideableUtils.TokenfromID(pRiderTokenID, pScene);
    return vToken ? this.isGrappled(vToken) : false;
  }

  static RiderTokenIDs(pRiddenToken) { return this.#Riders(pRiddenToken); }

  static RidingLoop(pRider, pRidden, pVisitados = new Set()) {
    if (!pRider || !pRidden) return false;
    if (pRider == pRidden || RideableFlags.isRiddenby(pRider, pRidden)) return true;
    if (pVisitados.has(pRider.id)) return false;
    pVisitados.add(pRider.id);
    return RideableFlags.RiderTokenIDs(pRider).some((vID) =>
      RideableFlags.RidingLoop(RideableUtils.TokenfromID(vID, FCore.sceneof(pRider)), pRidden, pVisitados));
  }

  static RidingConnection(pObjecta, pObjectb, pSimple = false, pVisitados = new Set()) {
    if (!pObjecta || !pObjectb) return false;
    if (RideableFlags.isRiddenby(pObjecta, pObjectb) || RideableFlags.isRiddenby(pObjectb, pObjecta)) return true;
    if (pSimple) return false;
    const chave = pObjecta.id + "|" + pObjectb.id;
    if (pVisitados.has(chave)) return false;
    pVisitados.add(chave);
    for (const vID of RideableFlags.RiderTokenIDs(pObjecta)) {
      if (RideableFlags.RidingConnection(RideableUtils.TokenfromID(vID, FCore.sceneof(pObjecta)), pObjectb, false, pVisitados)) return true;
    }
    for (const vID of RideableFlags.RiderTokenIDs(pObjectb)) {
      if (RideableFlags.RidingConnection(RideableUtils.TokenfromID(vID, FCore.sceneof(pObjectb)), pObjecta, false, pVisitados)) return true;
    }
    return false;
  }

  static RiderTokens(pRiddenToken) {
    return RideableUtils.TokensfromIDs(RideableFlags.RiderTokenIDs(pRiddenToken), FCore.sceneof(pRiddenToken));
  }

  /** Troca um id na lista de cavaleiros de dados ainda não criados (cópias). */
  static replaceRiderTokenID(pRiddenToken, pOriginalID, pReplacementID) {
    const vLista = flagsDe(pRiddenToken)?.[cRidersF];
    const vIndex = vLista?.indexOf(pOriginalID) ?? -1;
    if (vIndex < 0) return false;
    vLista[vIndex] = pReplacementID;
    return true;
  }

  /** Define a lista de cavaleiros em dados soltos (cópias antes de criar). */
  static setRiderIDsData(pData, pIDs) {
    foundry.utils.setProperty(pData, `flags.${FLAG_ESCOPO}.${RECURSO}.${cRidersF}`, pIDs);
  }

  static RiddenToken(pRider) {
    if (!pRider) return undefined;
    const vScene = FCore.sceneof(pRider);
    return vScene?.tokens.find((vToken) => RideableFlags.isRiddenby(vToken, pRider))
      ?? vScene?.tiles.find((vTile) => RideableFlags.isRiddenby(vTile, pRider));
  }

  static RiderLevel(pRider, pVisitados = new Set()) {
    if (!pRider || !RideableFlags.isRider(pRider) || pVisitados.has(pRider.id)) return 0;
    pVisitados.add(pRider.id);
    return RideableFlags.RiderLevel(RideableFlags.RiddenToken(pRider), pVisitados) + 1;
  }

  static MountonEnter(pRidden, pRaw = false) {
    return (pRaw || RideableFlags.TokenisRideable(pRidden)) && !!ler(pRidden, cMountonEnterF, false);
  }

  static GrapplePlacement(pRidden) { return ler(pRidden, cGrapplePlacementF, () => cfg("GrappleplacementDefault")); }

  static async setGrapplePlacement(pRidden, pPlacement) { return gravar(pRidden, cGrapplePlacementF, pPlacement); }

  static AutomountBlackList(pRidden, pRaw = false) {
    return pRaw ? this.#texto(pRidden, cAutoMountBlackListF) : this.#lista(pRidden, cAutoMountBlackListF);
  }

  static AutomountWhiteList(pRidden, pRaw = false) {
    return pRaw ? this.#texto(pRidden, cAutoMountWhiteListF) : this.#lista(pRidden, cAutoMountWhiteListF);
  }

  static #identificacoes(pRider) {
    return [pRider.name, pRider.id, pRider.actorId, pRider._source?.actorId].filter(Boolean);
  }

  static isAutomountBlacklisted(pRidden, pRider) {
    const vIds = RideableFlags.#identificacoes(pRider);
    return RideableFlags.AutomountBlackList(pRidden).some((vElement) => vIds.includes(vElement));
  }

  static isAutomountWhitelisted(pRidden, pRider) {
    const vIds = RideableFlags.#identificacoes(pRider);
    return RideableFlags.AutomountWhiteList(pRidden).some((vElement) => vIds.includes(vElement));
  }

  static useWhitelist(pRidden) { return RideableFlags.AutomountWhiteList(pRidden).length > 0; }

  static isvalidAutomount(pRidden, pRider) {
    if (RideableFlags.isAutomountBlacklisted(pRidden, pRider)) return false;
    if (RideableFlags.useWhitelist(pRidden) && !RideableFlags.isAutomountWhitelisted(pRidden, pRider)) return false;
    return true;
  }

  static async togglePositionLock(pToken) { return gravar(pToken, cPositionLockF, !this.#PositionLock(pToken)); }

  static async resetPositionLock(pToken) { if (this.#PositionLock(pToken)) await gravar(pToken, cPositionLockF, false); }

  static hasPositionLock(pToken) { return this.#PositionLock(pToken); }

  /* ---------- forma e posicionamento ---------- */
  static TokenForm(pToken) { return this.#TokenForm(pToken); }

  static RiderscanMoveWithin(pRidden) { return !!ler(pRidden, cInsideMovementF, false); }

  static RiderPositioning(pToken) { return ler(pToken, cRiderPositioningF, ""); }

  static SpawnRiders(pToken) { return this.#lista(pToken, cSpawnRidersF); }

  static SpawnRidersstring(pToken) { return this.#texto(pToken, cSpawnRidersF); }

  static RideableName(pToken) {
    if (!pToken) return "";
    if (pToken.documentName == "Tile") return ler(pToken, cTileRideableNameF, () => Translate("Titles.Tile"));
    return pToken.name;
  }

  /* ---------- contagem ---------- */
  static RiderCount(pRidden) {
    const vScene = FCore.sceneof(pRidden);
    return this.#Riders(pRidden).filter((vID) => {
      const vToken = RideableUtils.TokenfromID(vID, vScene);
      return RideableFlags.isRider(vToken) && !RideableFlags.isFamiliarRider(vToken);
    }).length;
  }

  static MaxRiders(pRidden) {
    const v = RideableFlags.#MaxRider(pRidden);
    return v >= 0 ? v : Infinity;
  }

  /** Valor cru do limite (-1 = sem limite), para a ficha. */
  static MaxRidersRaw(pRidden) { return RideableFlags.#MaxRider(pRidden); }

  static TokenRidingSpaceleft(pToken, pRidingOptions = {}) {
    if (pRidingOptions.Familiar) return cCornermaxRiders - RideableFlags.RiderFamiliarCount(pToken);
    if (pRidingOptions.Grappled) return Infinity;
    return RideableFlags.MaxRiders(pToken) - RideableFlags.RiderCount(pToken);
  }

  static TokenhasRidingPlace(pToken, pRidingOptions = {}) {
    return RideableFlags.TokenRidingSpaceleft(pToken, pRidingOptions) > 0;
  }

  static RiderFamiliarCount(pRidden) {
    return this.#Riders(pRidden).filter((vID) => RideableFlags.isFamiliarRider(RideableUtils.TokenfromID(vID, FCore.sceneof(pRidden)))).length;
  }

  static RiderGrappledCount(pRidden) {
    return this.#Riders(pRidden).filter((vID) => RideableFlags.isGrappled(RideableUtils.TokenfromID(vID, FCore.sceneof(pRidden)))).length;
  }

  /* ---------- altura ---------- */
  static addRiderHeight(pRider) { return Number(ler(pRider, caddRiderHeightF, 0)) || 0; }

  static async setaddRiderHeight(pToken, pHeight) {
    if (pToken && typeof pHeight === "number" && Number.isFinite(pHeight)) await gravar(pToken, caddRiderHeightF, pHeight);
  }

  static HascustomRidingHeight(pRidden) { return this.#CustomRidingheight(pRidden) >= 0; }

  static customRidingHeight(pRidden) {
    return RideableFlags.HascustomRidingHeight(pRidden) ? this.#CustomRidingheight(pRidden) : undefined;
  }

  static UseRidingHeight(pRidden) { return !!ler(pRidden, cUseRidingHeightF, () => cfg("useRidingHeight")); }

  /* ---------- escrita ---------- */
  static async addRiderTokens(pRiddenToken, pRiderTokens, pRidingOptions = {Familiar: false, Grappled: false}, pforceset = false) {
    if (!pRiddenToken) return;
    const vValidTokens = pRiderTokens.filter((vToken) => vToken && (!this.isRider(vToken) || pforceset) && (vToken != pRiddenToken));
    if (await this.#setRidersFlag(pRiddenToken, this.#Riders(pRiddenToken).concat(RideableUtils.IDsfromTokens(vValidTokens)))) {
      for (const vToken of vValidTokens) {
        // uma escrita por cavaleiro em vez de quatro
        await vToken.update({
          [caminhoFlag(cRidingF)]: true,
          [caminhoFlag(cFamiliarRidingF)]: !!pRidingOptions.Familiar,
          [caminhoFlag(cGrappledF)]: !!pRidingOptions.Grappled,
          [caminhoFlag(cisPilotingF)]: false
        }, {RidingMovement: true});
      }
    }
  }

  static async cleanRiderIDs(pRiddenToken) {
    const vAtual = this.#Riders(pRiddenToken);
    const vLimpo = vAtual.filter((vID) => RideableFlags.isRider(RideableUtils.TokenfromID(vID, FCore.sceneof(pRiddenToken))));
    if (vLimpo.length != vAtual.length) await this.#setRidersFlag(pRiddenToken, vLimpo);
  }

  static async removeRiderTokens(pRiddenToken, pRiderTokens, pRemoveRiddenreference = true) {
    if (!pRiddenToken) return;
    const vValidTokens = pRiderTokens.filter((vToken) => this.isRiddenby(pRiddenToken, vToken));
    if (pRemoveRiddenreference) {
      const vIDs = RideableUtils.IDsfromTokens(vValidTokens);
      await this.#setRidersFlag(pRiddenToken, this.#Riders(pRiddenToken).filter((vID) => !vIDs.includes(vID)));
    }
    for (const vRider of pRiderTokens) {
      if (!existe(vRider)) continue;
      const vUpdate = {
        [caminhoFlag(cRidingF)]: false,
        [caminhoFlag(cisPilotingF)]: false,
        [caminhoFlag(caddRiderHeightF)]: 0
      };
      if (pRemoveRiddenreference) vUpdate[caminhoFlag(cRelativPositionF)] = [];
      await vRider.update(vUpdate, {RidingMovement: true});
    }
  }

  static recheckRiding(pRiderTokens) {
    for (const vRider of pRiderTokens ?? []) {
      const vScene = FCore.sceneof(vRider);
      const vMontado = Boolean(vScene?.tokens.find((t) => this.isRiddenby(t, vRider)) || vScene?.tiles.find((t) => this.isRiddenby(t, vRider)));
      if (vMontado != this.isRider(vRider)) gravar(vRider, cRidingF, vMontado);
    }
  }

  static async recheckRiders(pRiddenToken) {
    const vScene = FCore.sceneof(pRiddenToken);
    await this.#setRidersFlag(pRiddenToken, this.#Riders(pRiddenToken).filter((vID) => vScene?.tokens.get(vID)));
  }

  static async stopRiding(pRidingTokens, pRemoveRiddenreference = true) {
    for (const vRidingToken of pRidingTokens ?? []) {
      if (!vRidingToken) continue;
      const vScene = FCore.sceneof(vRidingToken);
      const vRiddenTokens = (vScene?.tokens.filter((t) => this.isRiddenby(t, vRidingToken)) ?? [])
        .concat(vScene?.tiles.filter((t) => this.isRiddenby(t, vRidingToken)) ?? []);
      if (vRiddenTokens.length) {
        for (const vRidden of vRiddenTokens) await RideableFlags.removeRiderTokens(vRidden, [vRidingToken], pRemoveRiddenreference);
      }
      else if (existe(vRidingToken)) {
        const vUpdate = {[caminhoFlag(cRidingF)]: false};
        if (pRemoveRiddenreference) vUpdate[caminhoFlag(cRelativPositionF)] = [];
        await vRidingToken.update(vUpdate, {RidingMovement: true});
      }
    }
  }

  static async removeallRiding(pRiddenToken) {
    if (pRiddenToken) {
      await RideableFlags.removeRiderTokens(pRiddenToken, RideableFlags.RiderTokens(pRiddenToken));
      await this.#setRidersFlag(pRiddenToken, []);
    }
    return this.isRidden(pRiddenToken);
  }

  /** Tira um id da lista de cavaleiros sem tocar no cavaleiro (usado quando ele foi apagado). */
  static async forgetRiderID(pRiddenToken, pRiderID) {
    const vAtual = this.#Riders(pRiddenToken);
    if (vAtual.includes(pRiderID)) await this.#setRidersFlag(pRiddenToken, vAtual.filter((vID) => vID != pRiderID));
  }

  /* ---------- tamanho e escala ---------- */
  static async savecurrentSize(pToken) {
    await gravar(pToken, cSizesaveF, [pToken.width, pToken.height]);
    if (RideableUtils.isPf2e()) await pToken.update({flags: {pf2e: {linkToActorSize: false}}}, {RidingMovement: true});
  }

  static async resetSize(pToken) {
    const vsavedSize = this.#SizeSave(pToken);
    if (vsavedSize.length == 2 && existe(pToken)) {
      if (pToken.width != vsavedSize[0] || pToken.height != vsavedSize[1]) {
        // no v13 tamanho também é movimento: resize() mantém o centro
        await pToken.resize({width: vsavedSize[0], height: vsavedSize[1]}, {RidingMovement: true});
      }
      await gravar(pToken, cSizesaveF, []);
      if (RideableUtils.isPf2e()) await pToken.update({flags: {pf2e: {linkToActorSize: true}}});
    }
  }

  static async savecurrentScale(pToken) {
    if (ler(pToken, cScaleSizesaveF, undefined) !== undefined) return;
    await gravar(pToken, cScaleSizesaveF, Math.max(Math.abs(pToken.texture.scaleX), Math.abs(pToken.texture.scaleY)));
  }

  static async resetScale(pToken) {
    const vsavedScale = ler(pToken, cScaleSizesaveF, undefined);
    if (vsavedScale === undefined || !existe(pToken)) return;
    // mantém o espelhamento (sinal) da textura
    const sx = Math.sign(pToken.texture.scaleX) || 1;
    const sy = Math.sign(pToken.texture.scaleY) || 1;
    await pToken.update({
      texture: {scaleX: sx * vsavedScale, scaleY: sy * vsavedScale},
      [`flags.${FLAG_ESCOPO}.${RECURSO}.-=${cScaleSizesaveF}`]: null
    }, {RidingMovement: true});
  }

  static async ApplyRidersScale(pRidden, pRiders, pWithGlobalScale = true) {
    let vScale = RideableFlags.RidersScale(pRidden);
    if (pWithGlobalScale) vScale = vScale * cfg("RiderScaleFactor");
    if (Number(vScale) > 0 && vScale != 1) {
      for (const vRider of pRiders) {
        // já escalado (montou de novo sem desmontar): não encolhe outra vez
        if (ler(vRider, cScaleSizesaveF, undefined) !== undefined) continue;
        await RideableFlags.savecurrentScale(vRider);
        await vRider.update({texture: {scaleX: vRider.texture.scaleX * vScale, scaleY: vRider.texture.scaleY * vScale}}, {RidingMovement: true});
      }
    }
  }

  static RidersScale(pObject) { return Number(ler(pObject, cRidersScaleF, 1)) || 1; }

  static RidersOffset(pObject, pSceneScales = false) {
    const cScale = FCore.sceneof(pObject)?.dimensions?.size ?? 1;
    const vRaw = ler(pObject, cRiderOffsetF, [0, 0]);
    const offset = [Number(vRaw?.[0]) || 0, Number(vRaw?.[1]) || 0];
    return pSceneScales ? offset.map((v) => v * cScale) : offset;
  }

  static RidersRotOffsetRaw(pObject) { return Number(ler(pObject, cRiderRotOffsetF, 0)) || 0; }

  static RidersRotOffset(pObject) {
    return cfg("RiderRotation") ? RideableFlags.RidersRotOffsetRaw(pObject) : 0;
  }

  /* ---------- posição relativa ---------- */
  static HasrelativPosition(pToken) { return this.#RelativPosition(pToken).length >= 2; }

  static RelativPosition(pToken) {
    const v = this.#RelativPosition(pToken);
    if (v.length >= 2) return [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
    return [0, 0, 0];
  }

  static async setRelativPosition(pToken, pPosition) {
    if (pToken && pPosition?.length >= 2) await gravar(pToken, cRelativPositionF, pPosition);
  }

  /* ---------- pilotar ---------- */
  static canbePiloted(pToken) { return !!ler(pToken, cCanbePilotedF, false); }

  static CheckPilotedCollision(pToken) { return !!ler(pToken, cCheckPilotedCollisionF, () => pToken?.documentName == "Tile"); }

  static PilotedbyDefault(pToken) { return !!ler(pToken, cPilotedbyDefaultF, false); }

  static canPilotRidden(pToken) {
    return !(RideableFlags.isGrappled(pToken) || RideableFlags.isFamiliarRider(pToken)) && RideableFlags.isRider(pToken) && RideableFlags.canbePiloted(RideableFlags.RiddenToken(pToken));
  }

  static async setPiloting(pToken, pPiloting) {
    if (!pPiloting || RideableFlags.canPilotRidden(pToken)) {
      await gravar(pToken, cisPilotingF, !!pPiloting);
      return true;
    }
    return false;
  }

  static isPiloting(pToken) {
    return this.#isPilotingFlag(pToken) && RideableFlags.canbePiloted(RideableFlags.RiddenToken(pToken));
  }

  static async TogglePiloting(pToken) { return RideableFlags.setPiloting(pToken, !this.#isPilotingFlag(pToken)); }

  static isPilotedby(pRidden, pPilot) {
    return (this.#isPilotingFlag(pPilot) || RideableFlags.PilotedbyDefault(pRidden)) && RideableFlags.canbePiloted(pRidden) && RideableFlags.isRiddenby(pRidden, pPilot);
  }

  /* ---------- efeitos ---------- */
  static MountingEffects(pToken, pRaw = false) {
    return pRaw ? this.#texto(pToken, cMountingEffectsF) : this.#lista(pToken, cMountingEffectsF);
  }

  static forMountEffects(pRider, pRaw = false) {
    const v = ler(pRider, cforMountEffectsF, "");
    if (pRaw) return Array.isArray(v) ? v.join(cDelimiter) : (v || "");
    if (Array.isArray(v)) return v;
    if (typeof v == "string") return v.split(cDelimiter).map((s) => s.trim()).filter(Boolean);
    return [];
  }

  static OverrideWorldMEffects(pToken) { return !!ler(pToken, cWorldMEffectOverrideF, false); }

  static GrapplingEffects(pToken, pRaw = false) {
    return pRaw ? this.#texto(pToken, cGrapplingEffectsF) : this.#lista(pToken, cGrapplingEffectsF);
  }

  static async MarkasRideableEffect(pEffect, pforMountEffect = false) {
    if (pEffect) await gravar(pEffect, pforMountEffect ? cRideableMountEffectF : cRideableEffectF, true);
  }

  static isRideableEffect(pEffect, pforMountEffect = false) {
    const vNome = pforMountEffect ? cRideableMountEffectF : cRideableEffectF;
    return !!(ler(pEffect, vNome, false) || pEffect?.flags?.Rideable?.[vNome]);
  }

  static SelfApplyCustomEffects(pObject) { return !!ler(pObject, cSelfApplyEffectsF, false); }

  static IsActorEffect(pActor, pEffect) {
    if (!pActor || !pEffect) return undefined;
    const vEffects = ler(pActor, cRegisteredActorEffectsF, {}) ?? {};
    for (const vtype of Object.keys(vEffects)) {
      const vLista = String(vEffects[vtype] ?? "").split(cDelimiter).map((s) => s.trim());
      if (vLista.includes(pEffect.name) || vLista.includes(pEffect.id)) return vtype;
    }
    return undefined;
  }

  /* ---------- itens ---------- */
  static markasMountItem(pItem) {
    pItem.flags = foundry.utils.mergeObject(pItem.flags ?? {}, {[FLAG_ESCOPO]: {[RECURSO]: {[cisMountItemF]: true}}});
  }

  static IsMountItem(pItem) { return !!ler(pItem, cisMountItemF, false); }

  /* ---------- seguir ---------- */
  static isFollowing(pFollower) { return this.#followedToken(pFollower).length > 0; }

  static isFollowingToken(pFollower, pToken) {
    if (typeof pToken == "string") return this.#followedToken(pFollower) == pToken;
    if (pToken && typeof pToken == "object") return this.#followedToken(pFollower) == pToken.id;
    return false;
  }

  static isFollowed(pToken) { return pToken?.parent?.tokens.find((vToken) => RideableFlags.isFollowingToken(vToken, pToken)); }

  static isFollowedID(pID, pScene) { return pScene?.tokens.find((vToken) => RideableFlags.isFollowingToken(vToken, pID)); }

  static isFollowingSameToken(pFollowerA, pFollowerB) {
    return this.#followedToken(pFollowerA) == this.#followedToken(pFollowerB);
  }

  static followedID(pFollower) { return this.#followedToken(pFollower); }

  static followedToken(pFollower) { return pFollower?.parent?.tokens.get(this.#followedToken(pFollower)); }

  static followingTokens(pToken) {
    return pToken?.parent?.tokens.filter((vToken) => RideableFlags.isFollowingToken(vToken, pToken)) ?? [];
  }

  static IDfollowingTokens(pID, pScene) {
    return pScene?.tokens.filter((vToken) => RideableFlags.isFollowingToken(vToken, pID)) ?? [];
  }

  static FollowDistance(pFollower) { return Number(ler(pFollower, cfollowDistanceF, 0)) || 0; }

  static async UpdateFollowDistance(pFollower, pDistance) { await gravar(pFollower, cfollowDistanceF, pDistance); }

  static async startFollowing(pFollower, pToken, pDistance) {
    await pFollower.update({
      [caminhoFlag(cfollowedTokenF)]: pToken.id,
      [caminhoFlag(cfollowDistanceF)]: pDistance,
      [caminhoFlag(cFollowOrderPlayerIDF)]: game.userId
    });
  }

  static async updateFollowedID(pFollower, pNewID) { await gravar(pFollower, cfollowedTokenF, pNewID); }

  static FollowOrderPlayerID(pFollower) { return ler(pFollower, cFollowOrderPlayerIDF, ""); }

  static isFollowOrderSource(pFollower) { return game.userId == ler(pFollower, cFollowOrderPlayerIDF, ""); }

  static async stopFollowing(pFollower) { await gravar(pFollower, cfollowedTokenF, ""); }

  static async setplannedRoute(pToken, pRoute) { await gravar(pToken, cplannedRouteF, pRoute); }

  static hasPlannedRoute(pToken) { return this.#plannedRoute(pToken).length > 0; }

  static nextRoutePoint(pToken) { return this.#plannedRoute(pToken)[0] ?? {}; }

  static isnextRoutePoint(pToken, pPoint) {
    const vNextPoint = RideableFlags.nextRoutePoint(pToken);
    if (vNextPoint && ("x" in vNextPoint)) {
      return (Math.abs(vNextPoint.x - pPoint.x) < cPointEpsilon && Math.abs(vNextPoint.y - pPoint.y) < cPointEpsilon);
    }
    return false;
  }

  static async shiftRoute(pToken) {
    // cópia: mexer no array do _source deixaria o setFlag sem diferença e nada seria salvo
    await gravar(pToken, cplannedRouteF, this.#plannedRoute(pToken).slice(1));
  }

  static async AddtoPathHistory(pToken, pPoint = undefined) {
    let vPoint = pPoint;
    if (!vPoint) {
      vPoint = {...GeometricUtils.CenterPositionXY(pToken)};
      vPoint.elevation = pToken.elevation;
    }
    if (!vPoint) return false;
    const vHistory = this.#PathHistory(pToken);
    vHistory.push({x: vPoint.x, y: vPoint.y, ...(Number.isFinite(vPoint.elevation) ? {elevation: vPoint.elevation} : {})});
    while (vHistory.length > cPathMaxHistory) vHistory.shift();
    await gravar(pToken, cPathHistoryF, vHistory);
    return true;
  }

  static GetPathHistory(pToken) { return this.#PathHistory(pToken); }

  static async ResetPathHistory(pToken) { await gravar(pToken, cPathHistoryF, []); }
}

/** O documento ainda está na cena? (tokens apagados não podem mais ser atualizados) */
function existe(pDoc) {
  if (!pDoc) return false;
  const vScene = FCore.sceneof(pDoc);
  const vColecao = pDoc.documentName == "Tile" ? "tiles" : "tokens";
  return !!vScene?.[vColecao]?.get(pDoc.id);
}

export function isRider(pToken) { return RideableFlags.isRider(pToken); }

export { RideableFlags, existe };
