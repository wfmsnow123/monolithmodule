/**
 * Escopo das configurações: marca cada configuração da janela Configurar Definições com o escopo
 * (mundo, cliente ou usuário). Baseado no DF Settings Clarity (BSD-3-Clause).
 *
 * O original troca o nome de toda configuração no registro (prefixo 👤/🌎, via libWrapper) e desenha
 * uma dica própria. Aqui nada é renomeado: um ícone com a dica do core entra no rótulo só na hora
 * de desenhar a janela, e a V13 ganha o terceiro escopo, "user".
 */
import { t } from "../util.mjs";
import { definirRecurso, ligado, opcao } from "../recursos.mjs";

const ICONES = {
  world: "fa-earth-americas",
  client: "fa-display",
  user: "fa-user",
  menuMestre: "fa-earth-americas",
  menuAberto: "fa-user-group",
  recarregar: "fa-rotate-right"
};

function marca(tipo) {
  const el = document.createElement("span");
  el.className = `mqol-escopo mqol-escopo--${tipo}`;
  el.dataset.tooltip = t(`escopo.dicas.${tipo}`);
  el.dataset.tooltipDirection = "UP";
  el.setAttribute("aria-label", t(`escopo.dicas.${tipo}`));
  el.innerHTML = `<i class="fa-solid ${ICONES[tipo]}" inert></i>`;
  return el;
}

function marcar(app, html) {
  if (!ligado("escopo")) return;
  if (!game.user.can("SETTINGS_MODIFY") && !opcao("escopo", "jogadores")) return;
  const raiz = html instanceof HTMLElement ? html : app.element;

  for (const grupo of raiz.querySelectorAll("[data-category] .form-group")) {
    const rotulo = grupo.querySelector(":scope > label, :scope > span.label");
    if (!rotulo || rotulo.querySelector(".mqol-escopo")) continue;
    const tipos = [];

    const botao = grupo.querySelector('button[data-action="openSubmenu"][data-key]');
    if (botao) {
      if (!opcao("escopo", "menus")) continue;
      const menu = game.settings.menus.get(botao.dataset.key);
      if (!menu) continue;
      tipos.push(menu.restricted ? "menuMestre" : "menuAberto");
    } else {
      const config = [...grupo.querySelectorAll("[name]")].map((el) => game.settings.settings.get(el.getAttribute("name"))).find(Boolean);
      if (!config) continue;
      tipos.push(["world", "client", "user"].includes(config.scope) ? config.scope : "client");
      if (config.requiresReload && opcao("escopo", "recarregar")) tipos.push("recarregar");
    }

    const caixa = document.createElement("span");
    caixa.className = "mqol-escopos";
    caixa.append(...tipos.map(marca));
    rotulo.prepend(caixa);
  }
}

definirRecurso({
  id: "escopo",
  icone: "fas fa-earth-americas",
  original: "df-settings-clarity",
  opcoes: [
    { chave: "menus", tipo: Boolean, padrao: true },
    { chave: "recarregar", tipo: Boolean, padrao: true },
    { chave: "jogadores", tipo: Boolean, padrao: false }
  ],

  iniciar() {
    Hooks.on("renderSettingsConfig", marcar);
  }
});
