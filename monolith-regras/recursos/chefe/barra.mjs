/**
 * Barra de Chefe: o palco na tela (DOM puro, sem dependências do Foundry).
 * Cada chefe entra como { id, nome, epiteto, fases:[%], tema, ocultarPV, ocultarNome, apagado, ler() => {pv, max, temp} }.
 * O palco compara a leitura nova com a anterior e decide rastro, número de dano, tremor, fase e abate.
 */

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const reduzido = () => !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const MOLDE = `
  <div class="mcb-cabeca">
    <div class="mcb-ident"><div class="mcb-nome"></div><div class="mcb-epiteto"></div></div>
    <div class="mcb-fase"><span></span></div>
    <div class="mcb-numeros"></div>
  </div>
  <div class="mcb-linha">
    <div class="mcb-barra">
      <div class="mcb-rastro"></div>
      <div class="mcb-vida"></div>
      <div class="mcb-flash"></div>
      <div class="mcb-temp"></div>
      <div class="mcb-marcas"></div>
      <div class="mcb-moldura"></div>
      <span class="mcb-ponta mcb-ponta-e"></span><span class="mcb-ponta mcb-ponta-d"></span>
    </div>
    <div class="mcb-dano"></div>
  </div>`;

/** Reinicia uma animação CSS trocando a classe. */
function reanimar(el, classe) {
  el.classList.remove(classe);
  void el.offsetWidth;
  el.classList.add(classe);
}

export class Palco {
  /**
   * @param {() => object} config  devolve a configuração atual (veja PADROES em index.mjs)
   * @param {HTMLElement} [alvo]   onde montar (padrão: document.body)
   */
  constructor(config, alvo) {
    this.config = config;
    this.alvo = alvo;
    this.barras = new Map();
  }

  get cfg() { return this.config(); }

  #montar() {
    if (this.raiz?.isConnected) return;
    const alvo = this.alvo ?? document.body;
    this.vinheta = Object.assign(document.createElement("div"), { className: "mcb-sangue" });
    this.raiz = Object.assign(document.createElement("div"), { className: "mcb-palco" });
    this.faixa = Object.assign(document.createElement("div"), { className: "mcb-abate" });
    this.faixa.setAttribute("aria-live", "polite");
    alvo.append(this.vinheta, this.raiz, this.faixa);
  }

  #layout() {
    const c = this.cfg;
    const s = this.raiz.style;
    s.setProperty("--mcb-largura", `${Math.min(95, Math.max(20, Number(c.largura) || 56))}vw`);
    s.setProperty("--mcb-altura", `${Math.min(30, Math.max(4, Number(c.altura) || 10))}px`);
    s.setProperty("--mcb-base", `${Math.max(0, Number(c.base) || 0)}px`);
    this.raiz.classList.toggle("mcb-sem-rastro", !c.rastro);
  }

  /** Recebe a lista atual de chefes visíveis: cria, atualiza e remove barras. */
  sincronizar(lista, { animar = true } = {}) {
    this.#montar();
    this.#layout();
    const ids = new Set(lista.map((c) => c.id));
    for (const id of [...this.barras.keys()]) if (!ids.has(id)) this.#remover(id);
    lista.forEach((def, i) => {
      let b = this.barras.get(def.id);
      if (!b) b = this.#criar(def, animar);
      b.def = def;
      b.el.style.order = i;
      this.#pintar(b);
      this.#ler(b);
    });
    this.raiz.classList.toggle("mcb-varios", this.barras.size > 1);
    this.#vinheta();
  }

  /** Relê o PV de todas as barras (sem mexer no resto). */
  atualizar() {
    for (const b of this.barras.values()) this.#ler(b);
    this.#vinheta();
  }

  /** Repete a entrada (todas as barras, ou só uma). */
  revelar(id) {
    for (const b of this.barras.values()) if (!id || b.id === id) this.#entrada(b);
  }

  destruir() {
    for (const id of [...this.barras.keys()]) this.#remover(id, true);
    this.vinheta?.remove(); this.raiz?.remove(); this.faixa?.remove();
    this.raiz = null;
  }

  /* ---------- Barras ---------- */

  #criar(def, animar) {
    const el = document.createElement("section");
    el.className = "mcb-chefe";
    el.dataset.id = def.id;
    el.innerHTML = MOLDE;
    const q = (s) => el.querySelector(s);
    const b = {
      id: def.id, def, el,
      r: { nome: q(".mcb-nome"), epiteto: q(".mcb-epiteto"), fase: q(".mcb-fase"), faseTxt: q(".mcb-fase span"),
        numeros: q(".mcb-numeros"), barra: q(".mcb-barra"), marcas: q(".mcb-marcas"), dano: q(".mcb-dano") },
      pv: 0, max: 1, temp: 0, pct: 0, rastro: 0, fase: 0, abatido: false, acumulado: 0, pronto: false, entrando: false, t: {}
    };
    this.barras.set(def.id, b);
    this.raiz.append(el);
    if (animar && this.cfg.entrada) this.#entrada(b);
    return b;
  }

  #remover(id, ja = false) {
    const b = this.barras.get(id);
    if (!b) return;
    this.barras.delete(id);
    for (const t of Object.values(b.t)) clearTimeout(t);
    if (ja || reduzido()) return b.el.remove();
    b.el.classList.add("mcb-saindo");
    setTimeout(() => b.el.remove(), 700);
  }

  #entrada(b) {
    const c = this.cfg;
    b.entrando = true;
    clearTimeout(b.t.entrada);
    clearTimeout(b.t.enchendo);
    b.el.classList.remove("mcb-enchendo");
    this.#larguras(b, 0, 0, 0, true);
    reanimar(b.el, "mcb-entrada");
    this.#tocar(c.somEntrada);
    b.t.entrada = setTimeout(() => {
      b.entrando = false;
      b.el.classList.add("mcb-enchendo");
      b.rastro = b.pct;
      this.#larguras(b, b.pct, b.pct, b.tempPct ?? 0);
      b.t.enchendo = setTimeout(() => b.el.classList.remove("mcb-enchendo", "mcb-entrada"), 1700);
    }, reduzido() ? 30 : 650);
  }

  /** Partes que não dependem do PV: nome, epíteto, tema, marcas de fase. */
  #pintar(b) {
    const d = b.def;
    b.r.nome.textContent = d.nome ?? "";
    b.r.epiteto.textContent = d.epiteto ?? "";
    b.el.classList.toggle("mcb-sem-epiteto", !d.epiteto);
    b.el.classList.toggle("mcb-sem-nome", !!d.ocultarNome);
    b.el.classList.toggle("mcb-apagado", !!d.apagado);
    for (const cl of [...b.el.classList]) if (cl.startsWith("tema-")) b.el.classList.remove(cl);
    b.el.classList.add(`tema-${d.tema || "sangue"}`);
    const fases = this.cfg.fases ? (d.fases ?? []) : [];
    const chave = fases.join(",");
    if (b.r.marcas.dataset.fases !== chave) {
      b.r.marcas.dataset.fases = chave;
      b.r.marcas.innerHTML = fases.map((f) => `<i data-f="${f}" style="left:${f}%"></i>`).join("");
    }
  }

  #larguras(b, vida, rastro, temp, instantaneo = false) {
    const s = b.el.style;
    if (instantaneo) b.el.classList.add("mcb-instante");
    s.setProperty("--mcb-vida", `${vida}%`);
    s.setProperty("--mcb-rastro", `${rastro}%`);
    s.setProperty("--mcb-temp", `${temp}%`);
    if (instantaneo) { void b.el.offsetWidth; b.el.classList.remove("mcb-instante"); }
  }

  #faseDe(b, pct) {
    if (!this.cfg.fases) return 0;
    return (b.def.fases ?? []).filter((f) => pct <= f).length;
  }

  #marcasPassadas(b) {
    for (const i of b.r.marcas.children) i.classList.toggle("passou", b.pct <= Number(i.dataset.f));
  }

  #ler(b) {
    let v;
    try { v = b.def.ler?.(); } catch { v = null; }
    if (!v) return;
    const c = this.cfg;
    const max = Math.max(1, Number(v.max) || 0);
    const pv = Math.min(max, Math.max(0, Number(v.pv) || 0));
    const temp = Math.max(0, Number(v.temp) || 0);
    const pct = (pv / max) * 100;
    const tempPct = Math.min(100, (temp / max) * 100);

    const mostrarNum = c.numeros && !b.def.ocultarPV;
    b.r.numeros.textContent = mostrarNum ? `${pv}${temp ? ` +${temp}` : ""} / ${max}` : "";

    const antes = { pv: b.pv, temp: b.temp, pct: b.pct, fase: b.fase };
    Object.assign(b, { pv, max, temp, pct, tempPct });

    // Primeira leitura (ou durante a entrada): só registra, sem efeitos.
    if (!b.pronto || b.entrando) {
      b.fase = this.#faseDe(b, pct);
      b.abatido = pv <= 0;
      b.el.classList.toggle("mcb-abatido", b.abatido && c.ocultarAbatido);
      b.el.classList.toggle("mcb-zero", b.abatido);
      if (!b.entrando) { b.rastro = pct; this.#larguras(b, pct, pct, tempPct, true); }
      b.pronto = true;
      this.#marcasPassadas(b);
      return;
    }

    const delta = (pv + temp) - (antes.pv + antes.temp);
    if (delta === 0 && pct === antes.pct) { b.el.style.setProperty("--mcb-temp", `${tempPct}%`); return; }

    if (pct < antes.pct || delta < 0) this.#dano(b, antes, -Math.min(0, delta));
    else if (pct > antes.pct) this.#cura(b, antes);
    b.el.style.setProperty("--mcb-temp", `${tempPct}%`);
    this.#marcasPassadas(b);

    // Fases: só anuncia ao descer.
    const fase = this.#faseDe(b, pct);
    if (fase > antes.fase && pv > 0) this.#anunciarFase(b, fase);
    b.fase = fase;

    // Abate e retorno.
    if (pv <= 0 && !b.abatido) this.#abater(b);
    else if (pv > 0 && b.abatido) {
      b.abatido = false;
      clearTimeout(b.t.abate);
      b.el.classList.remove("mcb-abatido", "mcb-zero");
    }
    this.#vinheta();
  }

  #dano(b, antes, perdido) {
    const c = this.cfg;
    b.el.style.setProperty("--mcb-vida", `${b.pct}%`);
    // O rastro fica onde estava (ou mais alto, se já havia um rastro esperando) e escoa depois.
    b.rastro = Math.max(b.rastro, antes.pct);
    clearTimeout(b.t.rastro);
    if (c.rastro) {
      b.el.style.setProperty("--mcb-rastro", `${b.rastro}%`);
      b.t.rastro = setTimeout(() => {
        b.rastro = b.pct;
        b.el.style.setProperty("--mcb-rastro", `${b.pct}%`);
      }, Number(c.atrasoRastro ?? 800));
    } else {
      b.rastro = b.pct;
      b.el.style.setProperty("--mcb-rastro", `${b.pct}%`);
    }

    if (perdido > 0 && c.dano && !b.def.ocultarPV) {
      b.acumulado += perdido;
      b.r.dano.textContent = b.acumulado;
      reanimar(b.r.dano, "vivo");
      clearTimeout(b.t.dano);
      b.t.dano = setTimeout(() => {
        b.r.dano.classList.remove("vivo");
        b.acumulado = 0;
      }, Math.max(0.5, Number(c.janelaDano) || 3) * 1000);
    }

    if (c.tremor && !reduzido() && perdido >= (b.max * (Number(c.limiarTremor) || 15)) / 100) {
      reanimar(b.el, "mcb-tremor");
    }
  }

  #cura(b, antes) {
    b.el.style.setProperty("--mcb-flash-de", `${antes.pct}%`);
    b.el.style.setProperty("--mcb-flash-ate", `${b.pct}%`);
    reanimar(b.el, "mcb-curando");
    b.el.style.setProperty("--mcb-vida", `${b.pct}%`);
    clearTimeout(b.t.rastro);
    if (b.rastro > b.pct) {
      b.t.rastro = setTimeout(() => { b.rastro = b.pct; b.el.style.setProperty("--mcb-rastro", `${b.pct}%`); }, 300);
    } else {
      // O rastro anda junto, escondido sob a vida.
      b.t.rastro = setTimeout(() => {
        b.rastro = b.pct;
        this.#larguras(b, b.pct, b.pct, b.tempPct, true);
      }, 650);
    }
  }

  #anunciarFase(b, fase) {
    b.r.faseTxt.textContent = `Fase ${ROMANOS[fase] ?? fase + 1}`;
    reanimar(b.el, "mcb-nova-fase");
    clearTimeout(b.t.fase);
    b.t.fase = setTimeout(() => b.el.classList.remove("mcb-nova-fase"), 3200);
    this.#tocar(this.cfg.somFase);
  }

  #abater(b) {
    const c = this.cfg;
    b.abatido = true;
    b.el.classList.add("mcb-zero");
    clearTimeout(b.t.abate);
    if (c.ocultarAbatido) b.t.abate = setTimeout(() => b.el.classList.add("mcb-abatido"), 2600);
    if (!c.abate) return;
    const vivos = [...this.barras.values()].some((o) => o !== b && !o.abatido && !o.def.apagado);
    if (c.abateNoFim && vivos) return;
    this.anunciar(c.textoAbate || "Inimigo Abatido");
    this.#tocar(c.somAbate);
  }

  /** Faixa central dourada, ao modo de "inimigo abatido". */
  anunciar(texto) {
    this.#montar();
    const t = String(texto);
    this.faixa.innerHTML = `<div class="mcb-abate-texto"><span></span><span class="mcb-eco" aria-hidden="true"></span></div>`;
    for (const s of this.faixa.querySelectorAll("span")) s.textContent = t;
    reanimar(this.faixa, "vivo");
    clearTimeout(this.tFaixa);
    this.tFaixa = setTimeout(() => this.faixa.classList.remove("vivo"), 6000);
  }

  #vinheta() {
    const c = this.cfg;
    if (!this.vinheta) return;
    const limiar = Number(c.limiarSangue) || 25;
    const ativo = c.sangue && [...this.barras.values()].some((b) => b.pronto && !b.abatido && !b.def.apagado && b.pct <= limiar);
    this.vinheta.classList.toggle("ativa", ativo);
  }

  #tocar(src) {
    if (src) try { this.cfg.tocar?.(src); } catch (err) { console.warn("monolith-regras | chefe: som", err); }
  }
}
