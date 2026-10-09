/**
 * Base do recurso Montaria: contexto do recurso, configurações, tradução, socket e utilidades
 * que no Rideable original ficavam espalhadas (cModuleName, Translate, CoreVersionComp).
 */

export const ID = "monolith-regras";
export const RECURSO = "montaria";
/** Escopo das flags: flags["monolith-regras"].montaria.<chave>. */
export const FLAG_ESCOPO = ID;
export const FLAG_PREFIXO = `${RECURSO}.`;
/** Escopo antigo, ainda lido em efeitos aplicados antes da migração. */
export const ESCOPO_ANTIGO = "Rideable";
/** Prefixo dos hooks próprios (antes "Rideable."). */
export const HOOK = "montaria";
/** Origem gravada nos efeitos aplicados pelo recurso. */
export const ORIGEM_EFEITO = `${ID}.${RECURSO}`;

export const cPopUpID = "Popup";
export const cDelimiter = ";";

let ctx = null;
export function definirContexto(c) { ctx = c; }
export const contexto = () => ctx;

/** game.settings.get do recurso. */
export function cfg(chave) {
  try { return game.settings.get(ID, `${RECURSO}.${chave}`); } catch { return undefined; }
}

/** Tradução em MONOLITH.montaria.<chave>. */
export function Translate(chave, comPrefixo = true) {
  return game.i18n.localize(comPrefixo ? `MONOLITH.${RECURSO}.${chave}` : chave);
}

export function TranslateandReplace(chave, palavras = {}) {
  let texto = Translate(chave);
  for (const p of Object.keys(palavras)) texto = texto.replace("{" + p + "}", palavras[p]);
  return texto;
}

/** Mensagem pelo canal compartilhado do módulo; o ouvinte é registrado em socket.mjs. */
export function emitir(pFunction, pData) {
  ctx?.socket.emitir({ pFunction, pData });
}

/** Só um GM responde a pedidos e hooks (o original rodava em todos os GMs e duplicava). */
export const souGMAtivo = () => !!game.users.activeGM?.isSelf;

export function sceneof(pToken) {
  if (!pToken) return undefined;
  if (pToken.parent?.documentName === "Scene") return pToken.parent;
  if (pToken.scene) return pToken.scene;
  const colecao = pToken.documentName === "Tile" ? "tiles" : "tokens";
  if (canvas.scene?.[colecao]?.get(pToken.id)) return canvas.scene;
  return game.scenes.find((s) => s[colecao].get(pToken.id));
}

export function moduloAtivo(id) {
  return !!game.modules.get(id)?.active;
}

export function fromHTML(html) {
  const div = document.createElement("div");
  div.innerHTML = html.trim();
  return div.firstElementChild;
}
