/**
 * Monolith: Resting Rules. Lógica pura da pilha de comida e da fome (sem Foundry), testável no Node.
 */

export const HORA = 3600;
export const DIA = 86400;

export const PALAVRAS_COMIDA = "ração, rações, ration, rations, comida, food, provisão, provisões, pão, pães, bread, carne, meat, charque, queijo, cheese, fruta, biscoito, peixe";
export const PALAVRAS_BEBIDA = "água, water, odre, waterskin, cantil, vinho, wine, cerveja, ale, hidromel, mead, bebida";

/** Minúsculas e sem acento, para comparar nomes. */
export function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function listaDePalavras(texto) {
  return String(texto ?? "").split(/[,;\n]/).map(normalizar).filter(Boolean);
}

function contemPalavra(nome, palavra) {
  // Palavra inteira (com plural simples), para "ale" não pegar "Alecrim" nem "Halen".
  const re = new RegExp(`(^|[^a-z0-9])${palavra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(s|es)?([^a-z0-9]|$)`);
  return re.test(nome);
}

/**
 * "comida", "bebida" ou null. Bebida ganha de comida ("Odre de vinho" é bebida);
 * consumível do tipo food sem palavra de bebida conta como comida.
 */
export function categorizar({ nome, subtipo } = {}, palavras = {}) {
  const n = normalizar(nome);
  const bebida = listaDePalavras(palavras.bebida ?? PALAVRAS_BEBIDA);
  const comida = listaDePalavras(palavras.comida ?? PALAVRAS_COMIDA);
  if (bebida.some((p) => contemPalavra(n, p))) return "bebida";
  if (comida.some((p) => contemPalavra(n, p))) return "comida";
  if (subtipo === "food") return "comida";
  return null;
}

/** Quanto a pilha tem e quanto precisa de cada categoria. */
export function contarPilha(pilha) {
  const n = pilha?.comensais?.length ?? 0;
  const soma = (cat) => (pilha?.contribs ?? []).filter((c) => c.categoria === cat).reduce((s, c) => s + (Number(c.quantidade) || 0), 0);
  return {
    comida: { tem: soma("comida"), precisa: n * (Number(pilha?.racoes) || 0) },
    bebida: { tem: soma("bebida"), precisa: n * (Number(pilha?.agua) || 0) }
  };
}

/**
 * Reparte a pilha entre quem come. Quem contribuiu com a categoria come primeiro, e come primeiro
 * do que trouxe; ninguém come pela metade. Devolve quem recebeu cada categoria, quanto saiu de cada
 * contribuição e as sobras.
 */
export function repartir(pilha) {
  const comensais = pilha?.comensais ?? [];
  const resto = new Map((pilha?.contribs ?? []).map((c) => [c.id, Number(c.quantidade) || 0]));
  const usado = {};
  const recebeu = { comida: [], bebida: [] };
  const porPessoa = { comida: Number(pilha?.racoes) || 0, bebida: Number(pilha?.agua) || 0 };

  for (const cat of ["comida", "bebida"]) {
    const k = porPessoa[cat];
    const doTipo = (pilha?.contribs ?? []).filter((c) => c.categoria === cat);
    if (k <= 0) { recebeu[cat] = [...comensais]; continue; }
    const contribuiu = new Set(doTipo.map((c) => c.actorId));
    const fila = [...comensais.filter((a) => contribuiu.has(a)), ...comensais.filter((a) => !contribuiu.has(a))];
    for (const a of fila) {
      const disponivel = doTipo.reduce((s, c) => s + resto.get(c.id), 0);
      if (disponivel < k) continue;
      let falta = k;
      const ordem = [...doTipo.filter((c) => c.actorId === a), ...doTipo.filter((c) => c.actorId !== a)];
      for (const c of ordem) {
        if (!falta) break;
        const tira = Math.min(falta, resto.get(c.id));
        if (!tira) continue;
        resto.set(c.id, resto.get(c.id) - tira);
        usado[c.id] = (usado[c.id] ?? 0) + tira;
        falta -= tira;
      }
      recebeu[cat].push(a);
    }
  }

  const alimentados = comensais.filter((a) => recebeu.comida.includes(a) && recebeu.bebida.includes(a));
  const faltou = comensais.filter((a) => !alimentados.includes(a)).map((a) => ({
    actorId: a, comida: !recebeu.comida.includes(a), bebida: !recebeu.bebida.includes(a)
  }));
  const sobras = (pilha?.contribs ?? []).map((c) => ({ ...c, quantidade: resto.get(c.id) })).filter((c) => c.quantidade > 0);
  return { recebeu, alimentados, faltou, usado, sobras };
}

/**
 * Nível de fome: 0 alimentado, 1 começando a ficar com fome, 2 com fome, 3 faminto.
 * Só avisa quando o nível sobe; num salto grande de tempo, avisa só o nível alcançado.
 */
export function avaliarFome(decorrido, intervaloHoras, nivelAnterior = 0) {
  const intervalo = Math.max(1, Number(intervaloHoras) || 8) * HORA;
  const nivel = decorrido > 0 ? Math.min(3, Math.floor(decorrido / intervalo)) : 0;
  return { nivel, avisar: nivel > nivelAnterior ? nivel : null };
}

export const TEXTO_FOME = {
  1: "está começando a ficar com fome",
  2: "está com fome",
  3: "está faminto"
};

/**
 * Inanição (opcional): um personagem aguenta 3 + mod. de Constituição dias (mínimo 1) sem comer;
 * cada dia além disso dá 1 de Exaustão. Devolve os dias inteiros sem comer e quantos são novos para punir.
 */
export function inanicao(decorrido, modCon, diasPunidos = 0) {
  const dias = decorrido > 0 ? Math.floor(decorrido / DIA) : 0;
  const tolerancia = Math.max(1, 3 + (Number(modCon) || 0));
  const novos = Math.max(0, dias - Math.max(diasPunidos, tolerancia));
  return { dias, tolerancia, novos };
}
