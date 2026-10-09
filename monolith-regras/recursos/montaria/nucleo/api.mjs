/**
 * Funções para macros. Ficam em game.montaria e também em game.Rideable, para as macros
 * antigas do mundo (compêndio do Rideable) continuarem funcionando com o original desligado.
 */
import { MountSelected, MountSelectedFamiliar, UnMountSelected, GrappleTargeted, ToggleMountselected } from "./MountingScript.mjs";
import { Mount, UnMount, ToggleMount, UnMountallRiders, MountbyID, UnMountbyID, UnMountallRidersbyID, TogglePilotingSelected, TogglePositionLock, TogglePositionLockSelected } from "./MountingScript.mjs";
import { SelectedFollowHovered, SelectedFollowHoveredatDistance, SelectedStopFollowing, SelectedToggleFollwing, SelectedToggleFollwingatDistance, FollowbyID, StopFollowbyID } from "./FollowingScript.mjs";
import { RideableFlags } from "./RideableFlags.mjs";
import { GeometricUtils } from "./GeometricUtils.mjs";
import { ID } from "./base.mjs";

export function ligarApi() {
  const macros = {
    MountSelected, MountSelectedFamiliar, UnMountSelected, GrappleTargeted,
    Mount, UnMount, ToggleMount, UnMountallRiders, MountbyID, UnMountbyID, UnMountallRidersbyID,
    ToggleMountselected, TogglePilotingSelected,
    SelectedFollowHovered, SelectedFollowHoveredatDistance, SelectedStopFollowing, SelectedToggleFollwing, SelectedToggleFollwingatDistance,
    FollowbyID, StopFollowbyID, TogglePositionLock, TogglePositionLockSelected
  };
  game.montaria = macros;
  if (!game.Rideable) game.Rideable = macros;

  // API do APIHandler original, agora em game.modules.get("monolith-regras").api.montaria
  const mod = game.modules.get(ID);
  if (mod) {
    mod.api ??= {};
    mod.api.montaria = {
      ...macros,
      RideableFlags,
      Geometrics: { withinBoundaries: (pObject, pForm, pPosition) => GeometricUtils.withinBoundaries(pObject, pForm, pPosition) },
      RidingConnection: (a, b, pSimple = false) => (a?.document && b?.document) ? RideableFlags.RidingConnection(a.document, b.document, pSimple) : false,
      isRider: (pToken) => RideableFlags.isRider(pToken)
    };
  }
}
