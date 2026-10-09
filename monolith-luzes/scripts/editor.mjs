import { ID, esc, fontesPadrao, animacoes, novaFonte, TIPOS } from "./config.mjs";
import { lerTorch, importarFontesTorch } from "./migracao.mjs";

const { ApplicationV2, DialogV2 } = foundry.applications.api;

const CAMPOS_NUM = ["brilho", "penumbra", "angulo", "alfa", "duracao", "cobertaBrilho", "cobertaPenumbra"];
const CAMPOS_TXT = ["nome", "nomes", "tipo", "cor", "animacao", "consumo", "combustivel"];

/** Janela para editar as fontes de luz. */
export class EditorFontes extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "monolith-luzes-editor",
    classes: ["mono", "monolith-luzes-editor"],
    tag: "form",
    window: { title: "Fontes de luz", icon: "fas fa-fire", resizable: true },
    position: { width: 720, height: Math.min(780, window.innerHeight - 100) },
    form: { handler: EditorFontes.#salvar, closeOnSubmit: false },
    actions: { adicionar: EditorFontes.#adicionar, remover: EditorFontes.#remover, padrao: EditorFontes.#padrao, torch: EditorFontes.#torch }
  };

  #rascunho = null;
  get lista() {
    this.#rascunho ??= foundry.utils.deepClone(game.settings.get(ID, "fontes"));
    return this.#rascunho;
  }

  async _renderHTML() {
    const anim = animacoes();
    const cards = this.lista.map((f, i) => {
      const op = (v, l, atual) => `<option value="${v}" ${atual === v ? "selected" : ""}>${l}</option>`;
      const n = (campo, rotulo, step = "1") => `<label>${rotulo} <input type="number" step="${step}" name="f${i}.${campo}" value="${esc(f[campo])}"></label>`;
      return `<fieldset class="ml-fonte">
        <div class="ml-linha">
          <label class="largo">Nome <input type="text" name="f${i}.nome" value="${esc(f.nome)}"></label>
          <label>Cor <input type="color" name="f${i}.cor" value="${esc(f.cor || "#ff9b4a")}"></label>
          <label>Animação <select name="f${i}.animacao">${Object.entries(anim).map(([v, l]) => op(v, l, f.animacao ?? "")).join("")}</select></label>
        </div>
        <div class="ml-linha"><label class="largo">Conta para <select name="f${i}.tipo">${Object.entries(TIPOS).map(([v, l]) => op(v, l, f.tipo || "objeto")).join("")}</select></label></div>
        <label class="bloco">Itens que contam (nomes separados por vírgula; acentos e maiúsculas tanto faz) <input type="text" name="f${i}.nomes" value="${esc(f.nomes)}"></label>
        <div class="ml-linha">${n("brilho", "Luz plena (pés)")}${n("penumbra", "Penumbra (pés)")}${n("angulo", "Ângulo")}${n("alfa", "Força da cor", "0.05")}</div>
        <div class="ml-linha">
          ${n("duracao", "Queima (min)")}
          <label>Ao acabar <select name="f${i}.consumo">${op("item", "Gasta o item", f.consumo)}${op("combustivel", "Gasta combustível", f.consumo)}${op("nada", "Nada", f.consumo)}</select></label>
          <label class="largo">Combustível <input type="text" name="f${i}.combustivel" value="${esc(f.combustivel)}" placeholder="oil, óleo"></label>
        </div>
        <div class="ml-linha">${n("cobertaBrilho", "Coberta: plena")}${n("cobertaPenumbra", "Coberta: penumbra")}
          <button type="button" data-action="remover" data-index="${i}"><i class="fas fa-trash"></i> Remover</button></div>
      </fieldset>`;
    }).join("");
    return `<div class="ml-editor">
      <p class="hint">Um item é fonte de luz quando o nome dele contém um dos nomes da lista (o nome mais específico vence); magias precisam bater a palavra inteira e não gastam nada. Na ficha do item dá para escolher a fonte à mão. Distâncias em pés; cenas em metros convertem sozinhas. Queima 0 = não se apaga.</p>
      ${cards}
      <footer class="rodape">
        <button type="button" data-action="adicionar"><i class="fas fa-plus"></i> Nova fonte</button>
        <button type="button" data-action="torch"><i class="fas fa-file-import"></i> Importar do Torch</button>
        <button type="button" data-action="padrao"><i class="fas fa-rotate-left"></i> Restaurar padrão</button>
        <button type="submit"><i class="fas fa-save"></i> Salvar</button>
      </footer>
    </div>`;
  }

  _replaceHTML(result, content) {
    const s = content.scrollTop;
    content.innerHTML = result;
    content.scrollTop = s;
  }

  #ler() {
    const el = this.element?.elements;
    if (!el) return;
    this.lista.forEach((f, i) => {
      if (!el[`f${i}.nome`]) return;
      for (const c of CAMPOS_TXT) f[c] = el[`f${i}.${c}`].value.trim();
      for (const c of CAMPOS_NUM) f[c] = Number(el[`f${i}.${c}`].value) || 0;
      if (!f.angulo) f.angulo = 360;
      f.id ||= foundry.utils.randomID();
    });
  }

  static async #salvar() {
    this.#ler();
    await game.settings.set(ID, "fontes", this.lista);
    ui.notifications.info("Fontes de luz salvas.");
    this.render();
  }

  static #adicionar() {
    this.#ler();
    this.lista.push(novaFonte());
    this.render();
  }

  static #remover(ev, el) {
    this.#ler();
    this.lista.splice(Number(el.dataset.index), 1);
    this.render();
  }

  static async #padrao() {
    const ok = await DialogV2.confirm({ classes: ["mono"], window: { title: "Restaurar" }, content: "<p>Voltar às fontes padrão (tocha, vela, lamparina, lanternas e magias de luz)?</p>" }).catch(() => false);
    if (!ok) return;
    this.#rascunho = fontesPadrao();
    this.render();
  }

  /** Cola o JSON de fontes do Torch (gameLightSources); já vem preenchido com o que o Torch tinha. */
  static async #torch() {
    this.#ler();
    const atual = typeof lerTorch().gameLightSources === "string" ? lerTorch().gameLightSources : "";
    const texto = await DialogV2.prompt({
      classes: ["mono"], window: { title: "Importar fontes do Torch" }, position: { width: 560 },
      content: `<p class="hint">JSON no formato do Torch (<code>{"dnd5e": {"sources": {...}}}</code>) ou caminho de um arquivo .json. Fontes com o mesmo nome de uma daqui só atualizam alcance, cor e ângulo.</p>
        <textarea name="json" rows="12" style="width:100%;font-family:monospace">${esc(atual)}</textarea>`,
      ok: { label: "Importar", callback: (e, b) => b.form.elements.json.value }
    }).catch(() => null);
    if (!texto?.trim()) return;
    // Salva o rascunho antes, para a importação juntar com o que está na tela.
    await game.settings.set(ID, "fontes", this.lista);
    if (await importarFontesTorch(texto)) {
      this.#rascunho = null;
      this.render();
    }
  }
}
