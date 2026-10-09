import * as FCore from "./base.mjs";

import {RideableCompUtils, cTokenAttacher, cTokenFormAttachedTiles} from "./RideableCompUtils.mjs";
import {RideableFlags} from "./RideableFlags.mjs";

const cGradtoRad = Math.PI/180;

const chexfactor = Math.cos(30 * cGradtoRad);

const cxid = 0;
const cyid = 1;

const cAlphaTreshhold = 5;

const cTokenFormCircle = "TokenFormCircle";
const cTokenFormRectangle = "TokenFormRectangle";
const cTokenFormTransparency = "TokenTransparency";
const cTileFormNone = "TileFormNone";

const cTokenForms = [cTokenFormCircle, cTokenFormRectangle];
const cTileForms = [cTokenFormCircle, cTokenFormRectangle];

export {cTokenForms, cTileForms, cGradtoRad}

class GeometricUtils {
  static Rotated(pPosition, protation) {
    return [Math.cos(cGradtoRad * protation) * pPosition[0] - Math.sin(cGradtoRad * protation) * pPosition[1], Math.sin(cGradtoRad * protation) * pPosition[0] + Math.cos(cGradtoRad * protation) * pPosition[1]];
  }

  static CenterPosition(pToken, pTokenReplacementPosition = {}) {
    if (pTokenReplacementPosition.hasOwnProperty("x") && pTokenReplacementPosition.hasOwnProperty("y")) {
      return [pTokenReplacementPosition.x + GeometricUtils.insceneWidth(pToken)/2, pTokenReplacementPosition.y + GeometricUtils.insceneHeight(pToken)/2];
    }
    else {
      return [pToken.x + GeometricUtils.insceneWidth(pToken)/2, pToken.y + GeometricUtils.insceneHeight(pToken)/2];
    }
  }

  static CenterPositionXY(pToken, pXYReplacement = undefined) {
    if (pToken) {
      if (pXYReplacement) {
        return {x: pXYReplacement.x + GeometricUtils.insceneWidth(pToken)/2, y: pXYReplacement.y + GeometricUtils.insceneHeight(pToken)/2};
      }
      else {
        return {x: pToken.x + GeometricUtils.insceneWidth(pToken)/2, y: pToken.y + GeometricUtils.insceneHeight(pToken)/2};
      }
    }
    else {
      return {};
    }
  }

  static updatedGeometry(pToken, pChange = {}) {
    let vData = {};

    for (let vKey of ["x", "y", "width", "height", "rotation"]) {
      vData[vKey] = pChange[vKey] ?? pToken[vKey];
    }

    let vScale = pToken.documentName == "Token" ? FCore.sceneof(pToken).dimensions.size : 1;

    return {...vData, x : vData.x + vScale * vData.width / 2, y : vData.y + vScale * vData.height / 2, insceneWidth : vScale * vData.width, insceneHeight : vScale * vData.height, 0 : vData.x + vScale * vData.width / 2, 1 : vData.y + vScale * vData.height / 2};
  }

  static changedGeometry(pToken, pChange = {}) {
    let vData = {};

    for (let vKey of ["x", "y", "width", "height", "rotation"]) {
      vData[vKey] = pToken[vKey] + (pChange[vKey] || 0);
    }

    let vScale = pToken.documentName == "Token" ? FCore.sceneof(pToken).dimensions.size : 1;

    return {...vData, x : vData.x + vScale * vData.width / 2, y : vData.y + vScale * vData.height / 2, insceneWidth : vScale * vData.width, insceneHeight : vScale * vData.height, 0 : vData.x + vScale * vData.width / 2, 1 : vData.y + vScale * vData.height / 2};
  }

  static CentertoXY(pPoint, pToken) {
    if (pToken) {
      return {x: pPoint.x - GeometricUtils.insceneWidth(pToken)/2, y: pPoint.y - GeometricUtils.insceneHeight(pToken)/2};
    }
    else {
      return {};
    }
  }

  static CenterRoutetoXY(pRoute, pToken) {
    let vWidthhalf = GeometricUtils.insceneWidth(pToken)/2;
    let vHeighthalf = GeometricUtils.insceneHeight(pToken)/2;

    return pRoute.map(vPoint => ({x: vPoint.x - vWidthhalf, y: vPoint.y - vHeighthalf, ...(Number.isFinite(vPoint.elevation) ? {elevation : vPoint.elevation} : {})}));
  }

  static NewCenterPosition(pDocument, pChanges) {
    let vPosition = [GeometricUtils.insceneWidth(pDocument)/2, GeometricUtils.insceneHeight(pDocument)/2];

    if (pChanges.hasOwnProperty("x")) {
      vPosition[0] = vPosition[0] + pChanges.x;
    }
    else {
      vPosition[0] = vPosition[0] + pDocument.x;
    }

    if (pChanges.hasOwnProperty("y")) {
      vPosition[1] = vPosition[1] + pChanges.y;
    }
    else {
      vPosition[1] = vPosition[1] + pDocument.y;
    }

    return vPosition;
  }

  static Difference(pPositionA, pPositionB) {
    return [pPositionA[0] - pPositionB[0], pPositionA[1] - pPositionB[1]];
  }

  static Summ(pPositionA, pPositionB) {
    return [pPositionA[0] + pPositionB[0], pPositionA[1] + pPositionB[1]];
  }

  static TokenDifference(pTokenA, pTokenB, pTokenAReplacementPosition = {}) {
    return GeometricUtils.Difference(GeometricUtils.CenterPosition(pTokenA, pTokenAReplacementPosition), GeometricUtils.CenterPosition(pTokenB));
  }

  static value(pVector) {
    return Math.sqrt(pVector[0] ** 2 + pVector[1] ** 2);
  }

  static scale(pNumberArray, pfactor) {
    return pNumberArray.map(pValue => pValue*pfactor);
  }

  static scalexy(pNumberArray, pfactorarray) {
    return [pNumberArray[0] * pfactorarray[0], pNumberArray[1] * pfactorarray[1]];
  }

  static scaleto(pVector, pfactor) {
    let vValue = GeometricUtils.value(pVector);

    if (vValue == 0) {
      return pVector;
    }
    else {
      return GeometricUtils.scale(pVector, pfactor/GeometricUtils.value(pVector));
    }
  }

  static scaletoxy(pVector, pfactorarray) {
    return GeometricUtils.scalexy(GeometricUtils.norm(GeometricUtils.scalexy(pVector, pfactorarray.map(vvalue => 1/vvalue))),pfactorarray);
  }

  static norm(pVector) {
    return GeometricUtils.scaleto(pVector, 1);
  }

  static Direction(pPositionA, pPositionB) {
    let vDifference = GeometricUtils.Difference(pPositionA, pPositionB);

    return GeometricUtils.scale(vDifference, 1/GeometricUtils.value(vDifference));
  }

  static Distance(pPositionA, pPositionB) {
    return GeometricUtils.value(GeometricUtils.Difference(pPositionA, pPositionB));
  }

  static DistanceXY(pPositionA, pPositionB) {
    if (!pPositionA || !pPositionB) {
      return;
    }

    return ((pPositionA.x - pPositionB.x)**2 + (pPositionA.y - pPositionB.y)**2)**0.5;
  }

  static scaledDistance(pPositionA, pPositionB, pfactorarray, protation = 0) {
    if (!protation) {
      return GeometricUtils.value(GeometricUtils.scalexy(GeometricUtils.Difference(pPositionA, pPositionB), pfactorarray));
    }
    else {
      return GeometricUtils.value(GeometricUtils.scalexy(GeometricUtils.Rotated(GeometricUtils.Difference(pPositionA, pPositionB), protation), pfactorarray));
    }
  }

  static TokenDistance(pTokenA, pTokenB, pTokenAReplacementPosition = {}) {
    if ((pTokenA) && (pTokenB)) {
      let vTokenAPosition = {...pTokenA, ...pTokenAReplacementPosition};
      return Math.sqrt( ((vTokenAPosition.x+GeometricUtils.insceneWidth(pTokenA)/2)-(pTokenB.x+GeometricUtils.insceneWidth(pTokenB)/2))**2 + ((vTokenAPosition.y+GeometricUtils.insceneHeight(pTokenA)/2)-(pTokenB.y+GeometricUtils.insceneHeight(pTokenB)/2))**2)/(canvas.scene.dimensions.size)*(canvas.scene.dimensions.distance);
    }

    return 0;
  }

  static TokenDistanceto(pToken, pPosition, pTokenReplacementPosition = {}) {
    if (pToken) {
      if (pTokenReplacementPosition.hasOwnProperty("x") && pTokenReplacementPosition.hasOwnProperty("y")) {
        return Math.sqrt( ((pTokenReplacementPosition.x+GeometricUtils.insceneWidth(pToken)/2)-pPosition[0])**2 + ((pTokenReplacementPosition.y+GeometricUtils.insceneHeight(pToken)/2)-pPosition[1])**2)/(canvas.scene.dimensions.size)*(canvas.scene.dimensions.distance);
      }
      else {
        return Math.sqrt( ((pToken.x+GeometricUtils.insceneWidth(pToken)/2)-pPosition[0])**2 + ((pToken.y+GeometricUtils.insceneHeight(pToken)/2)-pPosition[1])**2)/(canvas.scene.dimensions.size)*(canvas.scene.dimensions.distance);
      }
    }

    return 0;
  }

  static TokenBorderDistance(pTokenA, pTokenB) {
    if ((pTokenA) && (pTokenB)) {
      let vDistance = GeometricUtils.TokenDistance(pTokenA, pTokenB) - (Math.max((GeometricUtils.insceneWidth(pTokenA)+GeometricUtils.insceneWidth(pTokenB)), (GeometricUtils.insceneHeight(pTokenA)+GeometricUtils.insceneHeight(pTokenB)))/2)/(canvas.scene.dimensions.size)*(canvas.scene.dimensions.distance);

      if (vDistance < 0) {
        return 0;
      }
      else {
        return vDistance;
      }
    }

    return 0;
  }

  static insceneWidth(pToken) {
    if (pToken.hasOwnProperty("insceneWidth")) {
      return pToken.insceneWidth;
    }

    if (pToken.documentName == "Tile") {
      return pToken.width;
    }

    if (pToken.object) {
      return pToken.object.w;
    }
    else {
      return pToken.width * FCore.sceneof(pToken).dimensions.size;
    }
  }

  static insceneHeight(pToken) {
    if (pToken.hasOwnProperty("insceneHeight")) {
      return pToken.insceneHeight;
    }

    if (pToken.documentName == "Tile") {
      return pToken.height;
    }

    if (pToken.object) {
      return pToken.object.h;
    }
    else {
      return pToken.height * FCore.sceneof(pToken).dimensions.size;
    }
  }

  static insceneSize(pToken) {
    return FCore.sceneof(pToken).dimensions.size;
  }

  static fourspread(pPoint) {
    return [
      {x : pPoint.x + pPoint.insceneWidth/4, y : pPoint.y + pPoint.insceneHeight/4},
      {x : pPoint.x + pPoint.insceneWidth/4, y : pPoint.y - pPoint.insceneHeight/4},
      {x : pPoint.x - pPoint.insceneWidth/4, y : pPoint.y - pPoint.insceneHeight/4},
      {x : pPoint.x - pPoint.insceneWidth/4, y : pPoint.y + pPoint.insceneHeight/4}
    ]
  }

  static insceneWH(pToken) {
    return {height : GeometricUtils.insceneHeight(pToken), width : GeometricUtils.insceneWidth(pToken)};
  }

  static xyandsize(pToken) {
    return {...GeometricUtils.insceneWH(pToken), ...GeometricUtils.CenterPositionXY(pToken)}
  }

  static sortbymaxdim(pTokens) {
    let vsortedTokens = pTokens.sort(function(vTokena,vTokenb){return Math.max(vTokena.height, vTokena.width)-Math.max(vTokenb.height, vTokenb.width)});

    let vsortedmaxdim = vsortedTokens.map(vToken => Math.max(vToken.height, vToken.width));

    return [vsortedTokens, vsortedmaxdim];
  }

  static closestBorderposition(pToken, pTokenForm, pRider, pRiderReplacementPosition = {}) {
    let vDirection;

    vDirection = GeometricUtils.Rotated(GeometricUtils.TokenDifference(pRider, pToken, pRiderReplacementPosition), -pToken.rotation);

    switch (pTokenForm) {
      case cTokenFormCircle:
        if (Math.max(GeometricUtils.insceneWidth(pToken) == GeometricUtils.insceneHeight(pToken))) {
          return (GeometricUtils.scaleto(vDirection, Math.max(GeometricUtils.insceneWidth(pToken))/2));
        }
        else {
          return GeometricUtils.scaletoxy(vDirection, [GeometricUtils.insceneWidth(pToken)/2, GeometricUtils.insceneHeight(pToken)/2]);
        }

        break;

      case cTokenFormRectangle:
        let vTarget = [0, 0];

        let vxBorder = (Math.abs(vDirection[0]) / GeometricUtils.insceneWidth(pToken) > Math.abs(vDirection[1]) / GeometricUtils.insceneHeight(pToken));

        if (vxBorder) {
          vTarget[0] = Math.sign(vDirection[0]) * GeometricUtils.insceneWidth(pToken)/2;

          vTarget[1] = vDirection[1]/vDirection[0] * vTarget[0];
        }
        else {
          if (vDirection[1] != 0) {
            vTarget[1] = Math.sign(vDirection[1]) * GeometricUtils.insceneHeight(pToken)/2;

            vTarget[0] = vDirection[0]/vDirection[1] * vTarget[1];
          }
        }

        return vTarget;

        break;

      case cTokenFormTransparency:

        let vStartingPosition = GeometricUtils.closestBorderposition(pToken, cTokenFormRectangle, pRider, pRiderReplacementPosition);

        if (!pToken.object.texture) {
          return vStartingPosition;
        }

        let vLength = GeometricUtils.value(vStartingPosition) * pToken.texture.scaleX;

        let vPixels = GeometricUtils.Pixelsof(pToken);

        for (let i = Math.round(vLength); i > -vLength; i--) {
          let vPartLength = GeometricUtils.scale(vStartingPosition, i/vLength);

          if (GeometricUtils.AlphaValue(vPartLength, vPixels, pToken, pToken.texture) > cAlphaTreshhold) {
            return vPartLength;
          }
        }

        return [0,0];
      case cTokenFormAttachedTiles:
        let vTiles = RideableCompUtils.TAAttachedTiles(pToken).filter(vTile => RideableFlags.TokenForm(vTile) != cTileFormNone);
        let vTileBorderPositions = vTiles.map(vTile => GeometricUtils.closestBorderposition(vTile, RideableFlags.TokenForm(vTile), pRider, pRiderReplacementPosition))

        if (vTiles.length > 0) {
          let vMinDistance = Infinity;
          let vMinDistancePosition = vTileBorderPositions[0];
          let vMinDistanceTile = vTiles[0];

          let vCurrentDistance;

          for (let i = 0; i < vTiles.length; i++) {
            vCurrentDistance = GeometricUtils.TokenDistanceto(pRider, GeometricUtils.Summ(GeometricUtils.CenterPosition(vTiles[i]), GeometricUtils.Rotated(vTileBorderPositions[i], vTiles[i].rotation)), pRiderReplacementPosition);

            if (vCurrentDistance < vMinDistance) {
              vMinDistance = vCurrentDistance;

              vMinDistancePosition = vTileBorderPositions[i];
              vMinDistanceTile = vTiles[i];
            }
          }

          if (vMinDistance < Infinity) {
            return GeometricUtils.Summ(vMinDistancePosition, GeometricUtils.Rotated(GeometricUtils.TokenDifference(vMinDistanceTile, pToken), -pToken.rotation));
          }
        }

        return [0,0];
      case cTileFormNone:
      default:
        return [0,0];
    }
  }

  static withinBoundaries(pToken, pTokenForm, pPosition) {
    return GeometricUtils.withinBoundariesupdated(pToken, {}, pTokenForm, pPosition);
  }

  static withinBoundariesupdated(pToken, pChanges, pTokenForm, pPosition) {
    let vDifference;

    let vTokenGeometry = GeometricUtils.updatedGeometry(pToken, pChanges);

    switch (pTokenForm) {
      case cTokenFormCircle:
        if (Math.max(vTokenGeometry.insceneWidth == vTokenGeometry.insceneHeight)) {
          return (GeometricUtils.Distance(vTokenGeometry, pPosition) <= Math.max(vTokenGeometry.insceneWidth)/2);
        }
        else {
          return (GeometricUtils.scaledDistance(vTokenGeometry, pPosition, [1/vTokenGeometry.insceneWidth, 1/vTokenGeometry.insceneHeight], -vTokenGeometry.rotation) <= 1/2);
        }

        break;

      case cTokenFormRectangle:
        vDifference = GeometricUtils.Difference(vTokenGeometry, pPosition);

        vDifference = GeometricUtils.Rotated(vDifference, -vTokenGeometry.rotation);

        return ((Math.abs(vDifference[0]) <= vTokenGeometry.insceneWidth/2) && (Math.abs(vDifference[1]) <= vTokenGeometry.insceneHeight/2));

        break;

      case cTokenFormTransparency:
        vDifference = GeometricUtils.Difference(vTokenGeometry, pPosition);

        vDifference = GeometricUtils.Rotated(vDifference, -vTokenGeometry.rotation);

        vDifference[1] = -vDifference[1];

        if (!pToken.object.texture) {
          GeometricUtils.withinBoundariesupdated(pToken, pChanges, cTokenFormRectangle, pPosition);
        }

        let vpixels = GeometricUtils.Pixelsof(pToken);

        return GeometricUtils.AlphaValue(vDifference, vpixels, pToken, pToken.texture) > cAlphaTreshhold;
      case cTokenFormAttachedTiles:
        return RideableCompUtils.TAAttachedTiles(pToken).find(vTile => GeometricUtils.withinBoundaries(vTile, RideableFlags.TokenForm(vTile), pPosition));
      case cTileFormNone:
      default:
        return false;
    }
  }

  static GridSnap(ppositon, pGrid, podd = [0,0]) {
    let vsnapposition = [0,0];

    switch (pGrid.type) {
      case 0:

        return ppositon;
        break;

      case 1:

        let voffset = 0;

        for (let dim = cxid; dim <= cyid; dim++) {
          if (podd && podd[dim]) {
            voffset = pGrid.size/2;
          }

          vsnapposition[dim] = Math.sign(ppositon[dim]) * (Math.round((Math.abs(ppositon[dim])-voffset-1)/pGrid.size) * pGrid.size + voffset);
        }

        return vsnapposition;
        break;

      default:
        return ppositon;
    }
  }

  static GridSnapxy(pposition, pGrid = undefined) {
    let vsnapposition = pposition;

    let vGrid = pGrid;

    if (!vGrid) {
      vGrid = canvas.grid;
    }

    switch (vGrid.type) {
      case 0:

        return vsnapposition;
        break;

      case 1:

        vsnapposition.x = Math.round(vsnapposition.x/vGrid.size)*vGrid.size;
        vsnapposition.y = Math.round(vsnapposition.y/vGrid.size)*vGrid.size;

        return vsnapposition;
        break;

      case 2:

      default:
        return vsnapposition;
    }
  }

  static Pixelsof(pObject) {
    let vsprite = new PIXI.Sprite(pObject.object.texture);
    let vtexture = PIXI.RenderTexture.create({width: vsprite.width, height: vsprite.height});

    canvas.app.renderer.render(vsprite, { renderTexture: vtexture });

    vsprite.destroy(false);

    let vpixels = canvas.app.renderer.extract.pixels(vtexture);

    vtexture.destroy(true);

    return vpixels;
  }

  static AlphaValue(pPosition, pPixelArray, pObject, pModifiers = undefined) {
    let vAlpha = 0;

    let vPosition = [pPosition[0], pPosition[1]];

    if (pModifiers) {
      if (pModifiers.scaleX) {
        vPosition[0] = vPosition[0]/pModifiers.scaleX;
      }

      if (pModifiers.scaleY) {
        vPosition[1] = vPosition[1]/pModifiers.scaleY;
      }
    }

    let vTexturex = Math.round((GeometricUtils.insceneWidth(pObject)/2 - vPosition[0]) / GeometricUtils.insceneWidth(pObject) * pObject.object.texture.width);

    let vTexturey = Math.round((1 - (GeometricUtils.insceneHeight(pObject)/2 - vPosition[1]) / GeometricUtils.insceneHeight(pObject)) * pObject.object.texture.height);

    if ((vTexturex >= 0 && vTexturex < pObject.object.texture.width) && (vTexturey >= 0 && vTexturey < pObject.object.texture.height)) {
      vAlpha = pPixelArray[(vTexturey * pObject.object.texture.width + vTexturex)*4 + 3];

      if (vAlpha == undefined) {
        vAlpha = 0;
      }
    }

    return vAlpha;
  }

  static CutRoute(pRoute, pbeforeEnd = 0, pGrid = undefined) {
    if (pbeforeEnd == 0) {
      return pRoute;
    }
    else {
      let vDistances = [0];

      let vCompleteLength = 0;

      let vPartLength;

      for (let i = 1; i < pRoute.length; i++) {
        vPartLength = GeometricUtils.DistanceXY(pRoute[i], pRoute[i-1]);

        vDistances.push(vPartLength);

        vCompleteLength = vCompleteLength + vPartLength;
      }

      let vResultRoute = [pRoute[0]];

      let vTargetLength = vCompleteLength - pbeforeEnd;

      if (vTargetLength > 0) {
        for (let i = 1; i < vDistances.length; i++) {
          if (vTargetLength > 0) {
            if (vDistances[i] < vTargetLength) {
              vResultRoute.push({x : pRoute[i].x, y : pRoute[i].y, ...(Number.isFinite(pRoute[i].elevation) ? {elevation : Math.round(pRoute[i].elevation)} : {})});

              vTargetLength = vTargetLength - vDistances[i];
            }
            else {
              let vNewPoint = {x : Math.round(pRoute[i-1].x + (pRoute[i].x - pRoute[i-1].x) * (vTargetLength/vDistances[i])),
                      y : Math.round(pRoute[i-1].y + (pRoute[i].y - pRoute[i-1].y) * (vTargetLength/vDistances[i]))};

              if (pGrid) {
                vNewPoint = GeometricUtils.GridSnapxy(vNewPoint, pGrid);
              }

              vNewPoint.elevation = Math.round(pRoute[i-1].elevation + (pRoute[i].elevation - pRoute[i-1].elevation) * (vTargetLength/vDistances[i]));

              if (!Number.isFinite(vNewPoint.elevation)) {
                delete vNewPoint.elevation;
              }


              vResultRoute.push(vNewPoint);

              vTargetLength = 0;
            }
          }
        }
      }

      return vResultRoute;
    }
  }
}

let formasProntas = false;
/** Formas extras (transparência e Token Attacher), no "ready". */
export function prepararFormas() {
  if (formasProntas) return;
  formasProntas = true;
  cTokenForms.push(cTokenFormTransparency);
  cTileForms.push(cTokenFormTransparency);
  if (RideableCompUtils.isactiveModule(cTokenAttacher)) {
    cTokenForms.push(cTokenFormAttachedTiles);
    cTileForms.push(cTileFormNone);
  }
}

export { GeometricUtils }
