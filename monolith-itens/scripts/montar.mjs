/**
 * Monta os dados de item do dnd5e (5.x) a partir da ficha curta usada em data/itens.json.
 *
 * Ficha: { id, nome, pasta, tipo, img, preco, peso, quantidade, porcoes, descricao, armadura }
 *  - tipo: "comida" | "bebida" | "ingrediente" | "roupa" | "armadura" | "objeto"
 *  - preco: texto "3 pc", "2 pp", "1 po" (pc, pp, pe, po, pl = cobre, prata, electrum, ouro, platina do dnd5e)
 *  - armadura: { tipo: "light"|"medium"|"heavy"|"clothing", ca, dex, forca, furtividade, base }
 */
import { ID } from "./util.mjs";

const MOEDAS = { pc: "cp", pp: "sp", pe: "ep", po: "gp", pl: "pp" };

export function preco(texto) {
  const m = String(texto ?? "").trim().match(/^([\d.,]+)\s*(pc|pp|pe|po|pl)$/i);
  if (!m) return { value: 0, denomination: "gp" };
  return { value: Number(m[1].replace(",", ".")), denomination: MOEDAS[m[2].toLowerCase()] };
}

const fonte = () => ({ custom: "Monolith", book: "Monolith", page: "", license: "", rules: "2014" });

/** Atividade de usar (comer ou beber): gasta um uso do item. */
function atividadeDeConsumo(nome) {
  return {
    dnd5eactivity000: {
      _id: "dnd5eactivity000", type: "utility", name: nome,
      activation: { type: "action", value: 1, condition: "", override: false },
      consumption: { targets: [{ type: "itemUses", target: "", value: "1", scaling: { mode: "", formula: "" } }], scaling: { allowed: false, max: "" }, spellSlot: true },
      description: { chatFlavor: "" },
      duration: { concentration: false, value: "", units: "", special: "", override: false },
      effects: [], range: { units: "self", special: "", override: false },
      target: { template: { count: "", contiguous: false, type: "", size: "", width: "", height: "", units: "" }, affects: { count: "", type: "", choice: false, special: "" }, prompt: true, override: false },
      roll: { formula: "", name: "", prompt: false, visible: false }, uses: { spent: 0, recovery: [] }, sort: 0
    }
  };
}

export function montarItem(f) {
  const base = {
    name: f.nome,
    img: f.img || "icons/svg/item-bag.svg",
    flags: { [ID]: { id: f.id, versao: 1 } },
    system: {
      description: { value: f.descricao ?? "", chat: "" },
      source: fonte(),
      quantity: f.quantidade ?? 1,
      weight: { value: f.peso ?? 0, units: "lb" },
      price: preco(f.preco),
      identifier: f.id,
      rarity: "", identified: true
    }
  };

  if (f.tipo === "comida" || f.tipo === "bebida") {
    const porcoes = f.porcoes ?? 1;
    // A Fogueira do Monolith: Resting conta pela marca, sem depender do nome.
    base.flags["monolith-resting"] = { categoria: f.tipo };
    return foundry.utils.mergeObject(base, {
      type: "consumable",
      system: {
        type: { value: "food", subtype: "" },
        uses: { max: String(porcoes), recovery: [], autoDestroy: true, spent: 0 },
        activities: atividadeDeConsumo(f.tipo === "bebida" ? "Beber" : "Comer"),
        properties: []
      }
    });
  }

  if (f.tipo === "roupa" || f.tipo === "armadura") {
    const a = f.armadura ?? {};
    const tipo = a.tipo ?? (f.tipo === "roupa" ? "clothing" : "light");
    return foundry.utils.mergeObject(base, {
      type: "equipment",
      system: {
        type: { value: tipo, baseItem: a.base ?? "" },
        armor: { value: a.ca ?? null, dex: a.dex ?? null, magicalBonus: null },
        strength: a.forca ?? null,
        properties: a.furtividade ? ["stealthDisadvantage"] : [],
        // Roupa com CA conta como armadura leve; todo mundo sabe vestir camisa, então é proficiente sempre.
        equipped: false, proficient: a.proficiente ? 1 : null,
        hp: { value: 0, max: 0, dt: null, conditions: "" },
        speed: { value: null, conditions: "" }
      }
    });
  }

  if (f.tipo === "ingrediente") {
    return foundry.utils.mergeObject(base, { type: "loot", system: { type: { value: "material", subtype: "" }, properties: [] } });
  }

  return foundry.utils.mergeObject(base, { type: "loot", system: { type: { value: "gear", subtype: "" }, properties: [] } });
}

/** Página de jornal de um cardápio (tema Pergaminho do Monolith: Journals). */
export function montarCardapio(c) {
  const secoes = (c.secoes ?? []).map((s) => `<h2>${s.titulo}</h2><ul class="mi-cardapio">${s.itens.map((i) =>
    `<li><span class="mi-prato">${i.nome}${i.nota ? ` <em>${i.nota}</em>` : ""}</span><span class="mi-preco">${i.preco}</span></li>`).join("")}</ul>`).join("");
  const html = `<div class="mj mj-pergaminho mi-cardapio-pagina"><h1>${c.nome}</h1>${c.subtitulo ? `<p class="mi-subtitulo">${c.subtitulo}</p>` : ""}${secoes}${c.rodape ? `<p class="mi-rodape">${c.rodape}</p>` : ""}</div>`;
  return {
    name: c.nome,
    flags: { [ID]: { id: c.id, versao: 1 } },
    pages: [{ name: c.nome, type: "text", text: { content: html, format: 1 }, flags: { [ID]: { id: c.id } } }]
  };
}
