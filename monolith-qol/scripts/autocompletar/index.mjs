/**
 * Autocompletar propriedades: lista navegável de caminhos (system.abilities.str.mod, @prof...)
 * em campos de chave e fórmula. Baseado no Autocomplete Inline Properties (MIT).
 */
import { ID } from "../util.mjs";
import { definirRecurso } from "../recursos.mjs";
import { DATA_MODE, DATA_GETTERS, PACKAGE_CONFIG, montarConfig, registrarCampos, refreshPackageConfig, ouvirCliqueFora, tirarBotao } from "./campos.mjs";

definirRecurso({
  id: "autocompletar",
  icone: "fas fa-at",
  original: "autocomplete-inline-properties",
  opcoes: [
    { chave: "botao", tipo: Boolean, padrao: true },
    { chave: "tecla", tipo: Boolean, padrao: true },
    { chave: "efeitos", tipo: Boolean, padrao: true },
    { chave: "dnd5e", tipo: Boolean, padrao: true }
  ],
  migracao: { showButton: "botao" },

  iniciar() {
    montarConfig();
    ouvirCliqueFora();
  },

  pronto() {
    const api = game.modules.get(ID).api;
    api.autocompletar = { CONST: { DATA_MODE, DATA_GETTERS }, PACKAGE_CONFIG, refreshPackageConfig };
    // Os mesmos ganchos do original: módulos que acrescentam campos ao AIP continuam funcionando.
    Hooks.callAll("aipSetup", PACKAGE_CONFIG);
    registrarCampos();
    Hooks.callAll("aipReady");
  },

  aoAlternar(v) {
    if (!v) tirarBotao();
  }
});
