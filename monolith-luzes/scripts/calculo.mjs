/* Contas puras, sem nada do Foundry (dá para testar no Node). */

export const normal = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
export const lista = (s) => String(s ?? "").split(",").map(normal).filter(Boolean);

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Tamanho do nome que bate com o item (0 = não bate).
 * Objetos: o nome do item contém o nome ("Tocha (5)" conta como tocha).
 * Magias: palavra inteira ("Luz" não pega "Luz do Dia" se houver fonte mais específica, e "Light" não pega "Lightning Bolt").
 */
export function bateNome(nomeItem, nomes, palavraInteira = false) {
  const nome = normal(nomeItem);
  let melhor = 0;
  for (const n of lista(nomes)) {
    const ok = nome === n || (palavraInteira ? new RegExp(`(^|[^a-z0-9])${escRe(n)}([^a-z0-9]|$)`).test(nome) : nome.includes(n));
    if (ok && n.length > melhor) melhor = n.length;
  }
  return melhor;
}

export function tempoTexto(seg) {
  if (!seg || seg <= 0) return "";
  const m = Math.ceil(seg / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`;
}

/**
 * Passa `delta` segundos numa chama acesa.
 * @returns {{antes:number, depois:number, acabou:boolean, fraca:boolean}} fraca = cruzou os 10 minutos agora.
 */
export function passarTempo(restante, duracaoMin, delta) {
  const antes = restante > 0 ? restante : (Number(duracaoMin) || 0) * 60;
  const depois = antes - Math.max(0, delta);
  return { antes, depois: Math.max(0, depois), acabou: depois <= 0, fraca: antes > 600 && depois <= 600 && depois > 0 };
}

/** Distância entre as bordas de dois retângulos {x, y, w, h}, em pixels. Diagonal conta como reta (um quadrado = 5 pés). */
export function distanciaBordas(a, b) {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.max(dx, dy);
}

/** O objeto está a até `quadrados` quadrados da borda do token? (1 px de folga para bordas exatas.) */
export function aoAlcance(token, objeto, tamanhoQuadrado, quadrados = 1) {
  return distanciaBordas(token, objeto) <= tamanhoQuadrado * quadrados + 1;
}

export function pontoNoRetangulo(p, r, folga = 0) {
  return p.x >= r.x - folga && p.x <= r.x + r.w + folga && p.y >= r.y - folga && p.y <= r.y + r.h + folga;
}

/* ---------- Torch ---------- */

const num = (v, d) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);
const bool = (v, d) => (typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : d);

/** Valores do Torch (já lidos do JSON) para as configurações daqui. Sem valor = padrão do Torch. */
export function configDoTorch(v = {}) {
  const ignorar = bool(v.ignoreEquipment, false);
  const mestreGasta = bool(v.gmUsesInventory, false);
  const nome = String(v.fallbackSourceName ?? "torch").trim();
  return {
    jogadoresAcendem: bool(v.playerTorches, true),
    jogadorGasta: bool(v.playerUsesInventory, true),
    mestreGasta,
    // "Ignore equipment" do Torch = oferecer luz sem ter o item, para todo mundo.
    luzAvulsa: ignorar ? "todos" : mestreGasta ? "nunca" : "mestre",
    avulsaNome: !nome || normal(nome) === "torch" ? "Tocha" : nome,
    avulsaBrilho: num(v.fallbackBrightRadius, 20),
    avulsaPenumbra: num(v.fallbackDimRadius, 40),
    fontesExtras: typeof v.gameLightSources === "string" ? v.gameLightSources.trim() : ""
  };
}

const slug = (s) => normal(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "fonte";

/**
 * Converte o JSON de fontes do Torch (gameLightSources) em fontes daqui e junta com `atuais`.
 * Uma fonte do Torch cujo nome já está numa fonte daqui só atualiza o alcance, a cor e o ângulo.
 * @returns {{fontes: object[], novas: number, atualizadas: number}}
 */
export function importarTorch(dados, atuais = [], sistema = "dnd5e") {
  const fontes = atuais.map((f) => ({ ...f }));
  let novas = 0, atualizadas = 0;
  if (!dados || typeof dados !== "object") return { fontes, novas, atualizadas };
  const blocos = dados[sistema] ? [dados[sistema]] : Object.values(dados).filter((b) => b && typeof b === "object" && b.sources);
  for (const bloco of blocos) {
    const apelidos = {};
    for (const [apelido, alvo] of Object.entries(bloco.aliases ?? {})) (apelidos[alvo] ??= []).push(apelido);
    for (const [chave, s] of Object.entries(bloco.sources ?? {})) {
      const nome = s?.name || chave;
      const luzes = Array.isArray(s?.light) ? s.light : s?.light ? [s.light] : [];
      const acesa = luzes[0] ?? {};
      const fraca = (s?.states ?? 2) >= 3 ? luzes[1] : null;
      const magia = /spell|cantrip/i.test(String(s?.type ?? ""));
      const luz = {
        brilho: num(acesa.bright, 0), penumbra: num(acesa.dim, 0), angulo: num(acesa.angle, 360) || 360,
        ...(acesa.color ? { cor: String(acesa.color) } : {}),
        ...(acesa.alpha !== undefined ? { alfa: num(acesa.alpha, 0.4) } : {}),
        ...(acesa.animation?.type !== undefined ? { animacao: acesa.animation.type ?? "" } : {}),
        ...(fraca ? { cobertaBrilho: num(fraca.bright, 0), cobertaPenumbra: num(fraca.dim, 0) } : {})
      };
      const alvo = normal(nome);
      const existente = fontes.find((f) => lista(f.nomes).includes(alvo) || normal(f.nome) === alvo);
      if (existente) { Object.assign(existente, luz); atualizadas++; continue; }
      fontes.push({
        id: `torch-${slug(nome)}`, nome, nomes: [nome, ...(apelidos[nome] ?? [])].join(", "),
        tipo: magia ? "magia" : "objeto",
        cor: "#ff9b4a", alfa: 0.4, animacao: magia ? "" : "torch",
        duracao: s?.consumable ? 60 : 0, consumo: s?.consumable ? "item" : "nada", combustivel: "",
        cobertaBrilho: 0, cobertaPenumbra: 0,
        ...luz
      });
      novas++;
    }
  }
  return { fontes, novas, atualizadas };
}
