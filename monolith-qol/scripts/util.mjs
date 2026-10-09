export const ID = "monolith-qol";

export const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/** Localização: chaves em MONOLITH_QOL.<caminho> (lang/pt-BR.json). */
export function t(chave, dados) {
  const k = `MONOLITH_QOL.${chave}`;
  return dados ? game.i18n.format(k, dados) : game.i18n.localize(k);
}

/* ---------- Configurações deixadas pelos módulos originais ---------- */

/**
 * Valor guardado por um módulo que não está mais registrado: no mundo (Setting sem usuário)
 * ou, para configuração de cliente, no localStorage deste navegador.
 */
export function configAntiga(modulo, chave) {
  const k = `${modulo}.${chave}`;
  const doc = game.settings.storage.get("world")?.find((s) => s.key === k && !s.user);
  const bruto = doc ? (doc._source?.value ?? doc.value) : globalThis.localStorage?.getItem(k);
  if (bruto === undefined || bruto === null) return undefined;
  if (typeof bruto !== "string") return bruto;
  try { return JSON.parse(bruto); } catch { return bruto; }
}
