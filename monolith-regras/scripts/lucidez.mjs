/** Sanidade do dnd5e vira Lucidez: nome e sigla do sétimo atributo (a Tidy mostra a sigla, "Luc"). */
const NOME = "Lucidez";
const SIGLA = "luc";

function aplicar(abilities) {
  const san = abilities?.san;
  if (!san) return;
  san.label = NOME;
  san.abbreviation = SIGLA;
}

/** Perícias de Lucidez (capítulo 6): nenhuma classe nem antecedente as concede de partida. */
const PERICIAS = {
  ocu: { label: "Ocultismo", fullKey: "ocultismo", icon: "icons/sundries/books/book-eye-purple.webp" },
  amp: { label: "Amparo", fullKey: "amparo", icon: "icons/magic/life/heart-hand-gold-green.webp" }
};

function pericias(skills) {
  if (!skills) return;
  const atributo = CONFIG.DND5E?.abilities?.san ? "san" : "wis";
  for (const [chave, p] of Object.entries(PERICIAS)) {
    skills[chave] = { ...(skills[chave] ?? {}), ...p, ability: skills[chave]?.ability ?? atributo, reference: skills[chave]?.reference ?? "" };
  }
}

export function registrarLucidez() {
  aplicar(CONFIG.DND5E?.abilities);
  pericias(CONFIG.DND5E?.skills);
  // O custom-dnd5e remonta a lista de perícias a partir das próprias configurações.
  Hooks.on("customDnd5e.setSkillsConfig", (cfg) => pericias(cfg));
  // O custom-dnd5e reconstrói os atributos a partir das próprias configurações.
  Hooks.on("customDnd5e.setAbilitiesConfig", (cfg) => aplicar(cfg));
  // O dnd5e pré-localiza no i18nInit; reforça depois de tudo carregado.
  Hooks.once("setup", () => aplicar(CONFIG.DND5E?.abilities));
  Hooks.once("ready", () => aplicar(CONFIG.DND5E?.abilities));
}
