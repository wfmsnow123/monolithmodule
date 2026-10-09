import { ID } from "./util.mjs";
import { registrarRecursos, recursosProntos, prepararRecursos, recursos, ligado } from "./recursos.mjs";
import "./autocompletar/index.mjs";
import "./escopo/index.mjs";
import "./visao-mestre/index.mjs";
import "./rolagens/index.mjs";

Hooks.once("init", () => {
  game.modules.get(ID).api = { recursos, ligado };
  registrarRecursos();
});

Hooks.once("ready", () => {
  recursosProntos();
  prepararRecursos();
});
