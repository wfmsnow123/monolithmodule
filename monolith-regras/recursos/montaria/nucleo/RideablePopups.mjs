import { RideableUtils } from "./RideableUtils.mjs";
import { cfg, cPopUpID, Translate, emitir } from "./base.mjs";
import { GeometricUtils } from "./GeometricUtils.mjs";

class RideablePopups {
  static TextPopUp(pToken, pText, pWords = {}, pOptions = {type : "info"}) {
    if (!pToken) return;
    let vText = pText;

    for (let vWord of Object.keys(pWords)) {
      vText = vText.replace("{" + vWord + "}", pWords[vWord]);
    }

    if (cfg("UINotifications")) {
      switch(pOptions.type) {
        case "error":
          ui.notifications.error(vText, {console : false});
          break;
        case "warn":
          ui.notifications.warn(vText, {console : false});
          break;
        case "success":
          if (ui.notifications.success) ui.notifications.success(vText, {console : false})
          else ui.notifications.info(vText, {console : false});
          break;
        case "info":
        default:
          ui.notifications.info(vText, {console : false});
          break;
      }
    }

    emitir("PopUpRequest", {pTokenID: pToken.id, pText : vText});

    RideablePopups.PopUpRequest(pToken.id, vText);
  }

  static TextPopUpID(pToken, pID, pWords = {}, pOptions = {type : "info"}) {
    RideablePopups.TextPopUp(pToken, Translate(cPopUpID+"."+pID), pWords, pOptions)
  }

  static PopUpRequest(pTokenID, pText) {
    if (cfg("MessagePopUps")) {
      let vToken = RideableUtils.TokenfromID(pTokenID);
      let vPosition;

      if (vToken) {
        vPosition = GeometricUtils.CenterPosition(vToken);
        if (vToken.isOwner || !cfg("OnlyownedMessagePopUps")) {
          canvas.interface.createScrollingText({x: vPosition[0], y: vPosition[1]}, pText, {text: pText, anchor: CONST.TEXT_ANCHOR_POINTS.TOP, fill: "#FFFFFF", stroke: "#000000"});
        }
      }
    }
  }
}

function PopUpRequest({ pTokenID, pText } = {}) { return RideablePopups.PopUpRequest(pTokenID, pText); }

export { RideablePopups, PopUpRequest }
