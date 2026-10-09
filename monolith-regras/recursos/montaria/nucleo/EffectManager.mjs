import * as FCore from "./base.mjs";

import { RideableUtils } from "./RideableUtils.mjs";
import { cfg, HOOK, ORIGEM_EFEITO, ESCOPO_ANTIGO } from "./base.mjs";
import { RideableFlags, existe } from "./RideableFlags.mjs";
import { RideableCompUtils, cDfredCE, cGrabbedEffectName } from "./RideableCompUtils.mjs";

const cMountedPf2eEffectID = "Compendium.pf2e.other-effects.Item.9c93NfZpENofiGUp";
const cGrappledPf2eEffectID = "Compendium.pf2e.conditionitems.Item.kWc1fhmv9LBiTuei";

class EffectManager {
  static async applyMountingEffects(pRider, pRidden, pRidingOptions) {
    let vRiderEffectNames = [];

    if (!pRider?.actor) return;
    if (pRidingOptions.MountingEffectsAdditional) {
      vRiderEffectNames.push(...[pRidingOptions.MountingEffectsAdditional].flat());
    }

    if (RideableUtils.isPf2e() || RideableCompUtils.hasactiveEffectModule()) {
      await EffectManager.removeRideableEffects(pRider, {grappleEffect : pRidingOptions.Grappled});

      if (pRidingOptions.MountingEffectsOverride) {
        if (pRidingOptions.MountingEffectsOverride instanceof Array) {
          vRiderEffectNames = pRidingOptions.MountingEffectsOverride;
        }
      }
      else {
        if (!pRidingOptions.Familiar) {
          if (!pRidingOptions.Grappled) {
            vRiderEffectNames = RideableFlags.MountingEffects(pRidden);

            if (!RideableFlags.OverrideWorldMEffects(pRidden)) {
              vRiderEffectNames.push(...RideableUtils.CustomWorldRidingEffects());

              if (RideableUtils.isPf2e() && cfg("RidingSystemEffects")) {
                vRiderEffectNames.push(cMountedPf2eEffectID);
              }
            }

            if (RideableFlags.SelfApplyCustomEffects(pRider)) {
              vRiderEffectNames.push(...RideableFlags.MountingEffects(pRider));
            }
          }
          else {
            if (!RideableFlags.OverrideWorldMEffects(pRidden)) {
              if (cfg("GrapplingSystemEffects")) {
                if (RideableUtils.isPf2e()) {
                  vRiderEffectNames.push(cGrappledPf2eEffectID);
                }

                if (RideableCompUtils.hasactiveEffectModule()) {
                  vRiderEffectNames.push(cGrabbedEffectName);
                }
              }

              vRiderEffectNames.push(...RideableUtils.CustomWorldGrapplingEffects());
            }

            vRiderEffectNames.push(...RideableFlags.GrapplingEffects(pRidden));
          }
        }
      }

      await EffectManager.applyRideableEffects(pRider, vRiderEffectNames, {grappleEffect : pRidingOptions.Grappled});
    }
  }

  static async RecheckforMountEffects(pRidden, pRidingOptions) {
    let vMountEffectNames = [];

    if (pRidden?.actor && (pRidden.documentName == "Token") && (RideableUtils.isPf2e() || RideableCompUtils.hasactiveEffectModule())) {
      await EffectManager.removeRideableEffects(pRidden, {forMountEffect : true});

      let vRiders = RideableFlags.RiderTokens(pRidden).filter(vRider => !(RideableFlags.isGrappled(vRider)));

      for (let i = 0; i < vRiders.length; i++) {
        vMountEffectNames.push(...RideableFlags.forMountEffects(vRiders[i]));
      }

      await EffectManager.applyRideableEffects(pRidden, vMountEffectNames, {forMountEffect : true});
    }
  }

  static async applyRideableEffects(pTarget, pEffectNames, pInfos) {
    pEffectNames = (pEffectNames ?? []).filter(Boolean);
    if (pTarget?.actor && pEffectNames.length > 0) {
      let vEffectDocuments;

      if (RideableUtils.isPf2e()) {
        vEffectDocuments = await RideableUtils.ApplicableEffects(pEffectNames);

        let vEffects = await pTarget.actor.createEmbeddedDocuments("Item", vEffectDocuments);

        for (let i = 0; i < vEffects.length; i++) {
          await RideableFlags.MarkasRideableEffect(vEffects[i], pInfos.forMountEffect);
        }
      }

      if (RideableCompUtils.hasactiveEffectModule()) {
        await RideableCompUtils.addIDNameEffects(pEffectNames, pTarget, pInfos);
      }
    }
  }

  static async removeRideableEffects(pRider, pInfos = {}) {
    if (!pRider?.actor) return;
    if (RideableUtils.isPf2e()) {
      await pRider.actor.deleteEmbeddedDocuments("Item", pRider.actor.itemTypes.effect.concat(pRider.actor.itemTypes.condition).filter(vElement => RideableFlags.isRideableEffect(vElement, pInfos.forMountEffect)).map(vElement => vElement.id));
    }

    if (RideableCompUtils.hasactiveEffectModule()) {
      await RideableCompUtils.RemoveRideableEffects(pRider, pInfos);
    }
  }

  static async applyModifierstoMountEffect(pToken, pModifiers) {
    if (!pToken?.actor) return;
    if (RideableUtils.isPf2e()) {
      let vEffect = pToken.actor.itemTypes.effect.concat(pToken.actor.itemTypes.condition).find(vElement => RideableFlags.isRideableEffect(vElement));
      if (vEffect) {
        let vRulesUpdates = [...vEffect.rules];

        for (let vModifier of pModifiers) {
          vRulesUpdates.push({
            ...vModifier,
            key : "ActiveEffectLike",
            path : vModifier.key,
            mode : vModifier.mode == 5 ? "override" : ""
          })
        }

        vEffect.update({system : {rules : vRulesUpdates}});
      }
    }
    else {
      let vEffect = pToken.actor.effects.find(vEffect => RideableCompUtils.isRideableEffect(vEffect));

      if (vEffect) {
        let vChangeUpdates = [...vEffect.changes];

        for (let vModifier of pModifiers) {
          vChangeUpdates.push(vModifier)
        }

        vEffect.update({changes : vChangeUpdates});
      }
    }
  }

  static async onRiderMount(pRider, pRidden, pRidingOptions = {}) {
    if (RideableUtils.isPf2e() || RideableCompUtils.hasactiveEffectModule()) {
      await EffectManager.applyMountingEffects(pRider, pRidden, pRidingOptions);

      await EffectManager.RecheckforMountEffects(pRidden, pRidingOptions);

      if (pRidingOptions.RiderModifiers?.length) {
        EffectManager.applyModifierstoMountEffect(pRider, pRidingOptions.RiderModifiers);
      }
    }
  }

  static onRiderUnMount(pRider, pRidden, pRidingOptions) {
    if (RideableUtils.isPf2e() || RideableCompUtils.hasactiveEffectModule()) {
      if (existe(pRider) || pRider?.actorLink) EffectManager.removeRideableEffects(pRider, {grappleEffect : pRidingOptions.Grappled});

      if (existe(pRidden)) EffectManager.RecheckforMountEffects(pRidden, pRidingOptions);
    }
  }

  static onRideableEffectDeletion(pEffect, pActor, pInfos, pUserID){
    let vRidingEffect = false;
    let vGrappleEffect = false;
    let vforMountEffect = false;

    if ((pEffect.flags?.core?.sourceId == cGrappledPf2eEffectID) || (pEffect.name == cGrabbedEffectName)) {
      vGrappleEffect = true;
    }

    if (pEffect.origin?.includes("grapple")) {
      vGrappleEffect = true;
    }

    switch (RideableFlags.IsActorEffect(pActor, pEffect)) {
      case "riding":
        vRidingEffect = true;
        break;
      case "grapple":
        vGrappleEffect = true;
        break;
      case "forMount":
        vforMountEffect = true;
        break;
    }

    Hooks.call(HOOK + ".RideableEffectDeletion", pEffect, game.users.get(pUserID), {RidingEffect : vRidingEffect, GrappleEffect : vGrappleEffect, forMountEffect : vforMountEffect});
  }
}

/** Avisa quando um efeito aplicado pela Montaria é removido (para soltar o agarrado, se configurado). */
export function ligarEfeitos() {
  Hooks.on("preDeleteActiveEffect", (pEffect, pInfos, pUserID) => {
    const vOrigem = String(pEffect.origin ?? "");
    if (vOrigem.startsWith(ORIGEM_EFEITO) || vOrigem.startsWith(ESCOPO_ANTIGO) || RideableFlags.IsActorEffect(pEffect.parent, pEffect)) {
      EffectManager.onRideableEffectDeletion(pEffect, pEffect.parent, pInfos, pUserID);
    }
  });
}

export { EffectManager }
