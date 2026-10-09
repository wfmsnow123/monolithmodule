/** Mensagens entre clientes (antes no canal module.Rideable; agora no canal compartilhado do Regras da Casa). */
import { MountRequest, UnMountRequest } from "./MountingScript.mjs";
import { MoveRiddenRequest, SyncSortRequest, UpdateRidderTokensRequest } from "./RidingScript.mjs";
import { PopUpRequest } from "./RideablePopups.mjs";
import { RequestRideableTeleport } from "./RideableCompatibility.mjs";
import { switchScene } from "./RideableUtils.mjs";
import { RequestreplaceFollowerListIDs } from "./FollowingScript.mjs";

function organiseSocketEvents({pFunction, pData} = {}, pUserID) {
  switch (pFunction) {
    case "MountRequest":
      // quem pede não decide se é GM: vem do remetente
      if (pData?.pRidingOptions) pData.pRidingOptions.isGM = !!game.users.get(pUserID)?.isGM;
      MountRequest(pData);
      break;
    case "UnMountRequest":
      UnMountRequest(pData);
      break;
    case "PopUpRequest":
      PopUpRequest(pData);
      break;
    case "RequestRideableTeleport":
      RequestRideableTeleport(pData);
      break;
    case "switchScene":
      switchScene(pData);
      break;
    case "MoveRiddenRequest":
      MoveRiddenRequest(pData);
      break;
    case "SyncSortRequest":
      SyncSortRequest(pData);
      break;
    case "RequestreplaceFollowerListIDs":
      RequestreplaceFollowerListIDs(pData);
      break;
    case "UpdateRidderTokensRequest":
      UpdateRidderTokensRequest(pData);
      break;
  }
}

export function ligarSocket(ctx) {
  ctx.socket.ouvir((dados, userId) => organiseSocketEvents(dados, userId));
}
