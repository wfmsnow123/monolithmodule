/** Utilitários do recurso Lembretes (derivado do Advantage Reminder for dnd5e, MIT). */

export const ANTIGO = "adv-reminder";
/** Chave das opções do diálogo de rolagem onde guardamos mensagens e fontes. */
export const OPCAO = "monolith-lembretes";
/** Prefixos das chaves de efeito: o novo (do recurso) e o antigo (do adv-reminder, ainda aceito). */
export const PREFIXO = "flags.monolith-regras.lembretes.";
export const PREFIXO_ANTIGO = `flags.${ANTIGO}.`;

/** Estado das configurações de cliente, lido no setup e atualizado no onChange. */
export const estado = { mostrarFontes: true, monolith: true };

/** Expande "message.all" para as duas chaves de efeito aceitas. */
export const chaves = (...sufixos) => sufixos.flatMap((s) => [PREFIXO + s, PREFIXO_ANTIGO + s]);

/** Primeiro alvo do usuário. */
export const alvo = () => [...(game.user?.targets ?? [])][0]?.actor;

/**
 * Função preguiçosa que mede a distância até o alvo (em unidades da cena), contando todos os quadrados
 * ocupados pelos dois tokens e a diferença de elevação. Infinity se não der para medir.
 */
export function distanciaAteAlvo(speaker) {
  return () => {
    try {
      const origem = game.scenes.get(speaker?.scene)?.tokens.get(speaker?.token);
      const destino = game.user.targets.first()?.document;
      if (!origem || !destino || !canvas?.ready || canvas.scene?.id !== origem.parent?.id) return Infinity;
      const passo = canvas.scene.grid.distance;
      let horizontal = Infinity;
      for (const a of espacos(origem)) for (const b of espacos(destino)) {
        const d = canvas.grid.measurePath([a, b]).distance;
        horizontal = Math.min(horizontal, Math.round(d / passo) * passo);
      }
      const vertical = Math.abs((origem.elevation ?? 0) - (destino.elevation ?? 0));
      return Math.max(horizontal, vertical);
    } catch (err) {
      console.warn("monolith-regras | lembretes: não consegui medir a distância", err);
      return Infinity;
    }
  };
}

function espacos({ width, height, x, y }) {
  if (width <= 1 && height <= 1) return [{ x, y }];
  const g = canvas.grid.size;
  const out = [];
  for (let w = 0; w < width; w++) for (let h = 0; h < height; h++) out.push({ x: x + w * g, y: y + h * g });
  return out;
}

/** Mudanças de efeitos ativos aplicáveis ao ator, filtradas e ordenadas (copiado de Actor#applyActiveEffects). */
export function mudancasAplicaveis(actor, filtro = () => true) {
  const out = [];
  if (!actor?.allApplicableEffects) return out;
  for (const effect of actor.allApplicableEffects()) {
    if (!effect.active) continue;
    for (const change of effect.changes ?? []) {
      if (!filtro(change)) continue;
      const c = foundry.utils.deepClone(change);
      c.effect = effect;
      c.priority = c.priority ?? c.mode * 10;
      out.push(c);
    }
  }
  return out.sort((a, b) => a.priority - b.priority);
}

/** Lê uma configuração de outro módulo sem estourar se ele não estiver registrado. */
export function configDe(modulo, chave, padrao) {
  try { return game.settings.get(modulo, chave) ?? padrao; } catch { return padrao; }
}

export const escapar = (s) => foundry.utils.escapeHTML(String(s ?? ""));
