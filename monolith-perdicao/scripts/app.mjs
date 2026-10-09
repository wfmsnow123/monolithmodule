import {
  ID, MAXIMO, LIMIARES, ESTADOS, TIPOS, HORRORES, valor, marcas, ligacao, piso, estadoDe, podeVer, esc,
  ajustarRetratos, ajustar, rolarGanho, salvarMarcas, adicionarMarca, removerMarca, definirLigacao, testar, firmarSe
} from "./perdicao.mjs";

const { ApplicationV2, DialogV2 } = foundry.applications.api;

/** Janela de Perdição de um personagem. */
export class PerdicaoApp extends ApplicationV2 {
  static instancias = new Map();

  static abrir(actor) {
    if (!actor) return;
    if (!podeVer(actor)) return ui.notifications.warn("A Perdição deste personagem fica com o Mestre.");
    let app = this.instancias.get(actor.id);
    if (!app) { app = new this(actor); this.instancias.set(actor.id, app); }
    app.render({ force: true });
    return app;
  }

  static atualizar(actor) {
    const app = this.instancias.get(actor?.id);
    if (app?.rendered) app.render();
  }

  constructor(actor, options = {}) {
    super({ ...options, id: `monolith-perdicao-${actor.id}` });
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    classes: ["mono", "monolith-perdicao"],
    window: { title: "Perdição", icon: "fas fa-eye", resizable: true },
    position: { width: 500, height: Math.min(720, window.innerHeight - 120) },
    actions: {
      ajustar: PerdicaoApp.#ajustar,
      horror: PerdicaoApp.#horror,
      teste: PerdicaoApp.#teste,
      firmar: PerdicaoApp.#firmar,
      recuperar: PerdicaoApp.#recuperar,
      novaMarca: PerdicaoApp.#novaMarca,
      editarMarca: PerdicaoApp.#editarMarca,
      removerMarca: PerdicaoApp.#removerMarca,
      ligacao: PerdicaoApp.#ligacao
    }
  };

  get title() { return `Perdição: ${this.actor.name}`; }

  async _renderHTML() {
    const a = this.actor;
    const gm = game.user.isGM;
    const v = valor(a);
    const chao = piso(a);
    const est = estadoDe(v);
    const lig = ligacao(a);

    const celulas = Array.from({ length: MAXIMO }, (_, i) => {
      const n = i + 1;
      const cls = [n <= v ? "cheia" : "", n <= chao ? "piso" : "", [...LIMIARES, MAXIMO].includes(n) ? "limiar" : ""].join(" ");
      return `<span class="cel ${cls}" data-tooltip="${n}${n <= chao ? " (piso)" : ""}"></span>`;
    }).join("");

    const estados = ESTADOS.map((e) => `<li class="${e === est ? "atual" : ""}"><b>${e.min === 20 ? "20" : `${e.min}–${e.min + 4}`}</b> <span>${e.nome}</span><em>${e.efeito}</em></li>`).join("");

    const listaMarcas = marcas(a).map((m) => `<li class="marca ${m.tipo}">
        <div class="cab"><span class="tipo">${TIPOS[m.tipo] ?? m.tipo}${m.limiar ? ` · limiar ${m.limiar}` : ""}</span><b>${esc(m.nome)}</b>
          ${gm ? `<span class="ctl"><a data-action="editarMarca" data-id="${m.id}" data-tooltip="Editar"><i class="fas fa-pen"></i></a>
          <a data-action="removerMarca" data-id="${m.id}" data-tooltip="Remover"><i class="fas fa-trash"></i></a></span>` : ""}</div>
        ${m.persistente ? `<p><span class="rot">Persistente</span> ${esc(m.persistente)}</p>` : ""}
        ${m.agudo ? `<p><span class="rot">Agudo</span> ${esc(m.agudo)}</p>` : ""}
        ${!m.persistente && !m.agudo ? `<p class="hint">Efeito ainda não definido pelo Mestre.</p>` : ""}
      </li>`).join("");

    const horrores = Object.entries(HORRORES).map(([k, h]) =>
      `<button type="button" data-action="horror" data-h="${k}">${h.nome} <small>+${h.ganho}</small></button>`).join("");

    return `<div class="mp-body">
      <header class="mp-topo">
        <div class="retrato"><img src="${a.img}" alt=""></div>
        <div class="id"><h2>${esc(a.name)}</h2>
          <div class="numero"><b>${v}</b><span>/ ${MAXIMO}</span><span class="estado">${est.nome}</span></div>
          <p class="hint">Piso ${chao} · ${marcas(a).length} Marca(s)${lig?.nome ? ` · Ligado a <b>${esc(lig.nome)}</b>` : ""}</p>
        </div>
      </header>

      <section><div class="trilha">${celulas}</div>
        <div class="regua"><span>0</span><span>5</span><span>10</span><span>15</span><span>20</span></div></section>

      <section><h3>Testes</h3><div class="botoes">
        <button type="button" data-action="teste"><i class="fas fa-dice-d20"></i> Teste de Perdição</button>
        <button type="button" data-action="firmar"><i class="fas fa-shield-halved"></i> Firmar-se (CD ${10 + marcas(a).length})</button>
      </div>${v >= 10 ? `<p class="hint">Esgarçado: os testes de resistência de Perdição são rolados com Ênfase.</p>` : ""}</section>

      <section><h3>Marcas</h3>${listaMarcas ? `<ul class="marcas">${listaMarcas}</ul>` : `<p class="hint">Nenhuma Marca.</p>`}
        ${gm ? `<div class="botoes"><button type="button" data-action="novaMarca"><i class="fas fa-plus"></i> Nova Marca</button>
        <button type="button" data-action="ligacao"><i class="fas fa-link"></i> ${lig?.nome ? "Ligação" : "Ligar a um corruptor"}</button></div>` : ""}</section>

      ${gm ? `<section class="mestre"><h3>Mestre</h3>
        <div class="botoes passo">
          <button type="button" data-action="ajustar" data-d="-1">−1</button>
          <button type="button" data-action="ajustar" data-d="1">+1</button>
          ${horrores}
        </div>
        <div class="botoes">
          <button type="button" data-action="recuperar" data-f="1d4" data-m="Ato de Heroísmo">Heroísmo −1d4</button>
          <button type="button" data-action="recuperar" data-f="2d4" data-m="Ato de Heroísmo com preço pessoal">Com preço −2d4</button>
          <button type="button" data-action="recuperar" data-f="1d4+1" data-m="refúgio">Refúgio −1d4+1</button>
        </div></section>` : ""}

      <section><h3>A Trilha</h3><ul class="estados">${estados}</ul></section>
    </div>`;
  }

  _replaceHTML(result, content) {
    const scroll = content.scrollTop;
    content.innerHTML = result;
    content.scrollTop = scroll;
    ajustarRetratos(content);
  }

  _onClose(options) {
    super._onClose(options);
    PerdicaoApp.instancias.delete(this.actor.id);
  }

  static async #ajustar(ev, el) { await ajustar(this.actor, Number(el.dataset.d), { motivo: "ajuste do Mestre" }); }

  static async #horror(ev, el) {
    const h = HORRORES[el.dataset.h];
    await rolarGanho(this.actor, h.ganho, `horror ${h.nome.toLowerCase()}`);
  }

  static async #recuperar(ev, el) {
    const roll = await new Roll(el.dataset.f).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor: `Recuperação de Perdição: ${el.dataset.m}` });
    await ajustar(this.actor, -roll.total, { motivo: el.dataset.m });
  }

  static async #teste() {
    const opts = Object.entries(HORRORES).map(([k, h]) => `<option value="${k}">${h.nome} (+${h.ganho})</option>`).join("");
    const r = await DialogV2.prompt({
      classes: ["mono"], window: { title: "Teste de resistência de Perdição" },
      content: `<div class="form-group"><label>CD</label><input type="number" name="cd" value="12" min="1" autofocus></div>
        <div class="form-group"><label>Horror</label><select name="h">${opts}</select></div>
        <div class="form-group"><label>Fonte</label><input type="text" name="f" placeholder="Ex.: o Sem Face da capela"></div>
        <p class="hint">Falha: ganha a Perdição do horror. 1 natural: dobra e Loucura Transitória. 20 natural: −1 e imune à fonte.</p>`,
      ok: { label: "Rolar", callback: (e, b) => ({ cd: Number(b.form.elements.cd.value) || 12, horror: b.form.elements.h.value, fonte: b.form.elements.f.value.trim() }) }
    }).catch(() => null);
    if (r) await testar(this.actor, r);
  }

  static async #firmar() { await firmarSe(this.actor); }

  static async #novaMarca() {
    const dados = await editorMarca({ tipo: ligacao(this.actor)?.nome ? "danacao" : "loucura" }, "Nova Marca");
    if (dados) await adicionarMarca(this.actor, dados);
  }

  static async #editarMarca(ev, el) {
    const lista = [...marcas(this.actor)];
    const i = lista.findIndex((m) => m.id === el.dataset.id);
    if (i < 0) return;
    const dados = await editorMarca(lista[i], "Editar Marca");
    if (!dados) return;
    lista[i] = { ...lista[i], ...dados, definida: true };
    await salvarMarcas(this.actor, lista);
  }

  static async #removerMarca(ev, el) {
    const ok = await DialogV2.confirm({ classes: ["mono"], window: { title: "Remover Marca" }, content: "<p>Remover esta Marca? O piso de Perdição desce 5.</p>" }).catch(() => false);
    if (ok) await removerMarca(this.actor, el.dataset.id);
  }

  static async #ligacao() {
    const l = ligacao(this.actor) ?? {};
    const r = await DialogV2.wait({
      classes: ["mono"], window: { title: "Ligação a um corruptor" },
      content: `<div class="form-group"><label>Corruptor</label><input type="text" name="nome" value="${esc(l.nome)}" placeholder="Ex.: O Códice da Derrota"></div>
        <div class="form-group"><label>Força dominante</label><input type="text" name="forca" value="${esc(l.forca)}" placeholder="Raiva, Luxúria, Medo..."></div>
        <div class="form-group"><label>Desejo</label><input type="text" name="desejo" value="${esc(l.desejo)}"></div>
        <p class="hint">Ligado, toda Marca de limiar vira Danação dessa força.</p>`,
      buttons: [
        { action: "salvar", label: "Salvar", default: true, callback: (e, b) => ({ nome: b.form.elements.nome.value.trim(), forca: b.form.elements.forca.value.trim(), desejo: b.form.elements.desejo.value.trim() }) },
        { action: "romper", label: "Romper a Ligação", callback: () => ({ nome: "" }) }
      ]
    }).catch(() => null);
    if (r && typeof r === "object") await definirLigacao(this.actor, r);
  }
}

async function editorMarca(m, titulo) {
  const op = Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${m.tipo === k ? "selected" : ""}>${t}</option>`).join("");
  return DialogV2.prompt({
    classes: ["mono"], window: { title: titulo }, position: { width: 460 },
    content: `<div class="form-group"><label>Tipo</label><select name="tipo">${op}</select></div>
      <div class="form-group"><label>Nome</label><input type="text" name="nome" value="${esc(m.nome)}" placeholder="Ex.: Medo do escuro"></div>
      <div class="form-group stacked"><label>Efeito persistente</label><textarea name="persistente" rows="2">${esc(m.persistente)}</textarea></div>
      <div class="form-group stacked"><label>Efeito agudo</label><textarea name="agudo" rows="2">${esc(m.agudo)}</textarea></div>`,
    ok: { label: "Salvar", callback: (e, b) => {
      const f = b.form.elements;
      return { tipo: f.tipo.value, nome: f.nome.value.trim() || TIPOS[f.tipo.value], persistente: f.persistente.value.trim(), agudo: f.agudo.value.trim() };
    } }
  }).catch(() => null);
}
