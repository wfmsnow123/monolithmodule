/**
 * Configurações do recurso Visão (no original: vision-5e.defaultHearingRange e vision-5e.spectatorMode).
 * Ficam em monolith-regras.visao.*; a tela de ajuste é a janela de configurar() do recurso.
 */

/** @type {string | number} */
export let defaultHearingRange;

/** @type {boolean} */
export let spectatorMode;

/** Fórmula padrão de audição: igual ao valor atual do mundo. */
export const AUDICAO_PADRAO = "15 + 2.5 * (@skills.prc.passive - 10)";

/** Converte a fórmula guardada no alcance usado pelos atores (número fixo ou fórmula por ator). */
export function interpretarAudicao(formula) {
    if (foundry.dice.Roll.validate(formula)) {
        try {
            return foundry.dice.Roll.safeEval(formula);
        } catch (_error) {
            return formula;
        }
    }

    return Number(formula) || 0;
}

/** Registra as configurações. Chamado de dentro do "init", antes do resto do recurso. */
export function registrarConfiguracoes(ctx) {
    // FormulaField do dnd5e, como no original; cai para String se o sistema não expuser o campo.
    const FormulaField = globalThis.dnd5e?.dataModels?.fields?.FormulaField;
    const tipoAudicao = FormulaField
        ? new FormulaField({ required: true, deterministic: true, initial: AUDICAO_PADRAO, placeholder: "0" })
        : String;

    ctx.registrar("defaultHearingRange", {
        name: "MONOLITH.visao.SETTINGS.defaultHearingRange.label",
        hint: "MONOLITH.visao.SETTINGS.defaultHearingRange.hint",
        scope: "world",
        config: false,
        requiresReload: true,
        type: tipoAudicao,
        default: AUDICAO_PADRAO,
    });

    defaultHearingRange = interpretarAudicao(ctx.get("defaultHearingRange"));

    ctx.registrar("spectatorMode", {
        name: "MONOLITH.visao.SETTINGS.spectatorMode.label",
        hint: "MONOLITH.visao.SETTINGS.spectatorMode.hint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        onChange: (value) => {
            spectatorMode = value;

            if (!canvas.ready) {
                return;
            }

            for (const token of canvas.tokens.placeables) {
                if (!token.vision === token._isVisionSource()) {
                    token.initializeVisionSource();
                }
            }
        },
    });

    spectatorMode = ctx.get("spectatorMode");
}
