import { ID, RAIZ_ITENS, RAIZ_JORNAL, esc } from "./util.mjs";
import { importar, carregarDados } from "./importar.mjs";

/* Janela de importação: o que entra no mundo, quantos itens por pasta, e o botão. */
class ImportarApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "monolith-itens-importar",
    classes: ["mono", "monolith-itens"],
    tag: "form",
    window: { title: "Monolith: Itens & Miscelânea", icon: "fas fa-basket-shopping", resizable: true },
    position: { width: 560, height: "auto" },
    form: { handler: ImportarApp.#enviar, closeOnSubmit: true }
  };

  static PARTS = { corpo: { template: `modules/${ID}/templates/importar.hbs` } };

  async _prepareContext() {
    const { itens, cardapios } = await carregarDados();
    const porPasta = new Map();
    for (const i of itens) porPasta.set(i.pasta, (porPasta.get(i.pasta) ?? 0) + 1);
    const ja = new Set(game.items.filter((d) => d.getFlag(ID, "id")).map((d) => d.getFlag(ID, "id")));
    return {
      raizItens: RAIZ_ITENS, raizJornal: RAIZ_JORNAL,
      totalItens: itens.length, totalCardapios: cardapios.length,
      jaImportados: itens.filter((i) => ja.has(i.id)).length,
      pastas: [...porPasta].map(([nome, n]) => ({ nome: esc(nome), n }))
    };
  }

  static async #enviar(event, form, formData) {
    const d = formData.object;
    await importar({ itens: !!d.itens, cardapios: !!d.cardapios });
  }
}

Hooks.once("init", () => {
  game.settings.register(ID, "importado", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.registerMenu(ID, "importar", {
    name: "Itens e cardápios de Monolith",
    label: "Importar para o mundo",
    hint: "Cria as pastas em Itens e no Jornal com os itens e cardápios do módulo. Pode rodar de novo: atualiza o que já existe, sem duplicar.",
    icon: "fas fa-basket-shopping",
    type: ImportarApp,
    restricted: true
  });
});

Hooks.once("ready", () => {
  game.modules.get(ID).api = { importar, abrir: () => new ImportarApp().render({ force: true }) };
  // Primeira vez com o Mestre: oferece a importação.
  if (game.users.activeGM?.isSelf && !game.settings.get(ID, "importado")) new ImportarApp().render({ force: true });
});
