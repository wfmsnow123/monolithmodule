import { ID, esc, fontes, fontesMagia } from "./config.mjs";
import { configDoTorch, importarTorch } from "./calculo.mjs";

const { DialogV2 } = foundry.applications.api;

/** Valores do Torch guardados no mundo (mesmo com o Torch desligado), já fora do JSON. */
export function lerTorch() {
  const v = {};
  const docs = game.settings.storage.get("world");
  for (const s of docs?.contents ?? []) {
    const chave = s.key ?? s._source?.key;
    if (!chave?.startsWith("torch.")) continue;
    const bruto = s._source?.value ?? s.value;
    let valor = bruto;
    if (typeof bruto === "string") { try { valor = JSON.parse(bruto); } catch { valor = bruto; } }
    v[chave.slice(6)] = valor;
  }
  return v;
}

/** Texto do gameLightSources do Torch: JSON colado ou caminho de arquivo. */
export async function lerFontesTorch(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  if (t.startsWith("{")) return JSON.parse(t);
  if (/\.ya?ml$/i.test(t) || t.startsWith("---")) throw new Error("O arquivo do Torch está em YAML; converta para JSON e cole aqui.");
  const r = await fetch(foundry.utils.getRoute(t));
  if (!r.ok) throw new Error(`Arquivo ${t} não encontrado.`);
  return JSON.parse(await r.text());
}

/** Junta as fontes do Torch nas daqui e salva. */
export async function importarFontesTorch(texto, { avisar = true } = {}) {
  try {
    const dados = await lerFontesTorch(texto);
    if (!dados) return false;
    const r = importarTorch(dados, foundry.utils.deepClone(fontes()));
    await game.settings.set(ID, "fontes", r.fontes);
    if (avisar) ui.notifications.info(`Fontes do Torch: ${r.novas} nova(s), ${r.atualizadas} atualizada(s).`);
    return true;
  } catch (err) {
    console.error(`${ID} |`, err);
    ui.notifications.error(`Não deu para ler as fontes do Torch: ${err.message}`);
    return false;
  }
}

/** Uma vez só, no GM ativo: traz as configurações do Torch e oferece importar as fontes extras. */
export async function migrarTorch() {
  if (game.settings.get(ID, "migracaoTorch")) return;
  const v = lerTorch();
  await game.settings.set(ID, "migracaoTorch", true);
  if (!Object.keys(v).length) return;
  const c = configDoTorch(v);
  for (const k of ["jogadoresAcendem", "jogadorGasta", "mestreGasta", "luzAvulsa", "avulsaNome", "avulsaBrilho", "avulsaPenumbra"]) {
    await game.settings.set(ID, k, c[k]);
  }
  console.log(`${ID} | configurações do Torch trazidas`, c);
  ui.notifications.info("Monolith: Luzes trouxe as configurações do Torch.");
  if (!c.fontesExtras) return;
  const ok = await DialogV2.confirm({
    classes: ["mono"], window: { title: "Fontes do Torch" },
    content: `<p>O Torch tinha fontes de luz extras configuradas:</p><pre style="max-height:160px;overflow:auto;white-space:pre-wrap">${esc(c.fontesExtras.slice(0, 2000))}</pre><p>Trazer para as fontes do Monolith: Luzes?</p>`
  }).catch(() => false);
  if (ok) await importarFontesTorch(c.fontesExtras);
}

/** 0.2.0: mundos que já salvaram fontes ganham o tipo e as magias de luz. */
export async function atualizarFontes() {
  if (game.settings.get(ID, "versaoFontes") >= 2) return;
  const ws = game.settings.storage.get("world");
  const salvas = ws?.getSetting?.(`${ID}.fontes`) ?? ws?.find?.((s) => s.key === `${ID}.fontes`);
  if (salvas) {
    const l = foundry.utils.deepClone(fontes()).map((f) => ({ tipo: "objeto", ...f }));
    for (const m of fontesMagia()) if (!l.some((f) => f.id === m.id)) l.push(m);
    await game.settings.set(ID, "fontes", l);
  }
  await game.settings.set(ID, "versaoFontes", 2);
}
