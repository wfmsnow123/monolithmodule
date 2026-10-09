import { ID } from "./config.mjs";
import { STATUS_QUEIMA } from "./fio.mjs";

/* Anel de brasa em volta do token enquanto queima a alma: um halo que pulsa e dois arcos
   tracejados girando em sentidos opostos, no espírito do marcador de turno do combate. */

const aneis = new WeakMap();
const COR = { brasa: 0xff6a1a, sangue: 0xc41d27, miolo: 0xffd27a };

function desenhar(token) {
  const raio = Math.max(token.w, token.h) / 2 + Math.max(4, token.w * 0.06);
  const c = new PIXI.Container();
  c.eventMode = "none";

  const halo = c.addChild(new PIXI.Graphics());
  halo.lineStyle({ width: raio * 0.16, color: COR.sangue, alpha: 0.35 }).drawCircle(0, 0, raio);
  halo.lineStyle({ width: raio * 0.07, color: COR.brasa, alpha: 0.55 }).drawCircle(0, 0, raio);
  if (PIXI.BlurFilter) halo.filters = [new PIXI.BlurFilter(Math.max(2, raio * 0.06))];

  const arco = (r, n, largura, cor, alpha) => {
    const g = new PIXI.Graphics();
    const passo = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const a0 = i * passo;
      g.lineStyle({ width: largura, color: cor, alpha, cap: PIXI.LINE_CAP.ROUND });
      g.moveTo(Math.cos(a0) * r, Math.sin(a0) * r).arc(0, 0, r, a0, a0 + passo * 0.55);
    }
    return c.addChild(g);
  };
  const fora = arco(raio, 6, Math.max(2, raio * 0.06), COR.brasa, 0.95);
  const dentro = arco(raio * 0.92, 9, Math.max(1.5, raio * 0.035), COR.miolo, 0.8);

  let t = 0;
  const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const passo = (dt) => {
    if (reduzir) return;
    t += dt / 60;
    fora.rotation += 0.012 * dt;
    dentro.rotation -= 0.02 * dt;
    halo.alpha = 0.7 + Math.sin(t * 3) * 0.3;
    halo.scale.set(1 + Math.sin(t * 3) * 0.025);
  };
  canvas.app.ticker.add(passo);
  return { c, passo };
}

function remover(token) {
  const a = aneis.get(token);
  if (!a) return;
  canvas.app?.ticker.remove(a.passo);
  if (!a.c.destroyed) a.c.destroy({ children: true });
  aneis.delete(token);
}

function atualizar(token) {
  const ativo = game.settings.get(ID, "anelQueima") && !!token.actor?.statuses?.has(STATUS_QUEIMA);
  const atual = aneis.get(token);
  if (!ativo) return remover(token);
  if (atual && atual.w === token.w && !atual.c.destroyed) {
    atual.c.position.set(token.w / 2, token.h / 2);
    return;
  }
  remover(token);
  const novo = desenhar(token);
  novo.w = token.w;
  novo.c.position.set(token.w / 2, token.h / 2);
  token.addChildAt(novo.c, 0);
  aneis.set(token, novo);
}

export function registrarAnel() {
  game.settings.register(ID, "anelQueima", {
    name: "Anel de brasa no token",
    hint: "Enquanto o personagem queima a alma, um anel de brasa gira em volta do token.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => canvas.tokens?.placeables.forEach(atualizar)
  });
  Hooks.on("drawToken", (token) => atualizar(token));
  Hooks.on("refreshToken", (token) => atualizar(token));
  Hooks.on("destroyToken", (token) => remover(token));
  Hooks.on("canvasTearDown", () => canvas.tokens?.placeables.forEach(remover));
  const reler = (eff) => {
    const actor = eff.parent;
    if (!(actor instanceof Actor)) return;
    for (const t of actor.getActiveTokens()) atualizar(t);
  };
  Hooks.on("createActiveEffect", reler);
  Hooks.on("deleteActiveEffect", reler);
}
