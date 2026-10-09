/** Sanidade do dnd5e vira Lucidez: nome e sigla do sétimo atributo (a Tidy mostra a sigla, "Luc"). */
const NOME = "Lucidez";
const SIGLA = "luc";

function aplicar(abilities) {
  const san = abilities?.san;
  if (!san) return;
  san.label = NOME;
  san.abbreviation = SIGLA;
}

export function registrarLucidez() {
  aplicar(CONFIG.DND5E?.abilities);
  // O custom-dnd5e reconstrói os atributos a partir das próprias configurações.
  Hooks.on("customDnd5e.setAbilitiesConfig", (cfg) => aplicar(cfg));
  // O dnd5e pré-localiza no i18nInit; reforça depois de tudo carregado.
  Hooks.once("setup", () => aplicar(CONFIG.DND5E?.abilities));
  Hooks.once("ready", () => aplicar(CONFIG.DND5E?.abilities));
}
