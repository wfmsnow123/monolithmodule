/** Janela de configuração do recurso Ordenar inventário. */
import { CATEGORIAS, ordemCompleta } from "./ordem.mjs";

const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

export async function configurar(ctx, { reordenar } = {}) {
  const ordem = ordemCompleta(ctx.get("ordem"));
  const opcao = (cat, lado) => cat.escolhas.map((v) =>
    `<option value="${v}" ${ordem[cat.id][lado] === v ? "selected" : ""}>${esc(ctx.t(`escolha.${v}`))}</option>`).join("");
  const grupos = ["inventario", "caracteristicas", "magias"].map((g) => {
    const linhas = CATEGORIAS.filter((c) => c.grupo === g).map((c) => `
      <div class="mi-linha ${c.pai ? "" : "base"}">
        <span class="mi-nome">${esc(ctx.t(`categoria.${c.id}`))}</span>
        <select name="${c.id}.p" aria-label="${esc(ctx.t("primaria"))}">${opcao(c, "p")}</select>
        <select name="${c.id}.s" aria-label="${esc(ctx.t("secundaria"))}">${opcao(c, "s")}</select>
      </div>`).join("");
    return `<fieldset><legend>${esc(ctx.t(`grupo.${g}`))}</legend>
      <div class="mi-linha cab"><span></span><span>${esc(ctx.t("primaria"))}</span><span>${esc(ctx.t("secundaria"))}</span></div>${linhas}</fieldset>`;
  }).join("");

  const r = await foundry.applications.api.DialogV2.prompt({
    classes: ["mono", "monolith-inventario-config"],
    window: { title: ctx.t("tituloConfig"), icon: "fas fa-arrow-down-a-z" },
    position: { width: 560 },
    content: `<div class="mi-config">
      <p class="hint">${esc(ctx.t("explicacao"))}</p>
      ${grupos}
      <label class="mi-check"><input type="checkbox" name="todos"> ${esc(ctx.t("reordenarTodos"))}</label>
    </div>`,
    ok: {
      label: ctx.t("salvar"), icon: "fas fa-save",
      callback: (ev, btn) => {
        const f = btn.form.elements;
        const nova = {};
        for (const c of CATEGORIAS) nova[c.id] = { p: f[`${c.id}.p`].value, s: f[`${c.id}.s`].value };
        return { nova, todos: f.todos.checked };
      }
    }
  }).catch(() => null);
  if (!r) return;
  await ctx.set("ordem", ordemCompleta(r.nova));
  reordenar?.({ todosDosJogadores: r.todos });
  ui.notifications.info(ctx.t("salvo"));
}
