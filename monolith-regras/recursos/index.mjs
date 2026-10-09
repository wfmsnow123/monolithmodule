/** Lista dos recursos incorporados ao Regras da Casa. */
import { definirRecurso } from "../scripts/recursos.mjs";
import lembretes from "./lembretes/index.mjs";
import percepcao from "./percepcao/index.mjs";
import visao from "./visao/index.mjs";
import montaria from "./montaria/index.mjs";
import chefe from "./chefe/index.mjs";
import inventario from "./inventario/index.mjs";
import troca from "./troca/index.mjs";
import retratos from "./retratos/index.mjs";

for (const def of [lembretes, percepcao, visao, montaria, chefe, inventario, troca, retratos]) definirRecurso(def);
