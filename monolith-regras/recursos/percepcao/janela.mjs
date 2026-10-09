/** Janela única de configuração do recurso Percepção, com as regras agrupadas em abas. */
import { cModuleName, cS } from "./src/utils/PerceptiveUtils.mjs";
import { VisionChannelsWindow } from "./src/helpers/VisionChannelsHelper.mjs";
import { PerceptiveSound } from "./src/helpers/PerceptiveSound.mjs";
import { ABAS, CONFIGS, configsDoMundo } from "./configuracoes.mjs";

const { ApplicationV2, DialogV2 } = foundry.applications.api;

const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

export class ConfigPercepcao extends ApplicationV2 {
	constructor(ctx, options = {}) {
		super(options);
		this.ctx = ctx;
		this.aba = game.user.isGM ? "geral" : "interface";
	}

	static DEFAULT_OPTIONS = {
		id: "monolith-regras-percepcao",
		classes: ["mono", "monolith-percepcao"],
		tag: "form",
		window: { title: "Percepção: configuração", icon: "fa-solid fa-eye", resizable: true },
		position: { width: 680, height: Math.min(760, window.innerHeight - 80) },
		form: { handler: ConfigPercepcao.#salvar, closeOnSubmit: false },
		actions: {
			aba: ConfigPercepcao.#trocarAba,
			restaurar: ConfigPercepcao.#restaurar,
			canais: ConfigPercepcao.#abrirCanais,
			testarSom: ConfigPercepcao.#testarSom
		}
	};

	/** Abas que este usuário vê: o Mestre vê todas, o jogador só as preferências dele. */
	get abas() {
		return ABAS.filter((a) => game.user.isGM || a.id === "interface");
	}

	t(k, dados) { return this.ctx.t(k, dados); }

	visivel(c) {
		try { return c.mostrar ? Boolean(c.mostrar()) : true; } catch { return true; }
	}

	campo(c) {
		const nome = c.chave;
		const valor = this.ctx.get(nome);
		const rotulo = esc(this.ctx.t(`Settings.${nome}.name`));
		const dica = this.ctx.t(`Settings.${nome}.descrp`);
		const recarga = c.recarregar ? `<span class="pc-selo" title="${esc(this.t("Config.recarregaDica"))}"><i class="fa-solid fa-rotate"></i> ${esc(this.t("Config.recarrega"))}</span>` : "";
		const rodape = `${dica && !dica.startsWith("MONOLITH.") ? `<p class="hint">${dica}</p>` : ""}`;

		if (c.tipo === Boolean) {
			return `<label class="pc-linha">
				<input type="checkbox" name="${nome}" ${valor ? "checked" : ""}>
				<span class="pc-texto"><b>${rotulo}</b>${recarga}${rodape}</span>
			</label>`;
		}

		let entrada;
		if (c.opcoes) {
			const opts = c.opcoes.map(([v, suf]) => `<option value="${esc(v)}" ${String(v) === String(valor) ? "selected" : ""}>${esc(this.ctx.t(`Settings.${nome}.options.${suf}`))}</option>`).join("");
			entrada = `<select name="${nome}">${opts}</select>`;
		}
		else if (c.faixa) {
			const { min, max, step } = c.faixa;
			entrada = `<range-picker name="${nome}" value="${esc(valor)}" min="${min}" max="${max}" step="${step}"></range-picker>`;
		}
		else if (c.arquivo) {
			entrada = `<file-picker name="${nome}" type="${c.arquivo}" value="${esc(valor)}"></file-picker>`;
			if (c.arquivo === "audio") entrada += `<button type="button" class="pc-mini" data-action="testarSom" title="${esc(this.t("Config.testarSom"))}"><i class="fa-solid fa-play"></i></button>`;
		}
		else if (c.tipo === Array) {
			entrada = `<input type="text" name="${nome}" value="${esc((valor ?? []).join(","))}" spellcheck="false">`;
		}
		else if (c.tipo === Number) {
			entrada = `<input type="number" name="${nome}" value="${esc(valor)}" step="${c.passo ?? "any"}">`;
		}
		else {
			entrada = `<input type="text" name="${nome}" value="${esc(valor)}" spellcheck="false">`;
		}
		return `<div class="pc-campo">
			<div class="pc-rotulo">${rotulo}${recarga}</div>
			<div class="pc-entrada">${entrada}</div>
			${rodape}
		</div>`;
	}

	corpoDaAba(aba) {
		const lista = CONFIGS.filter((c) => c.aba === aba && this.visivel(c));
		const semSecao = lista.filter((c) => !c.secao);
		const secoes = [...new Set(lista.filter((c) => c.secao).map((c) => c.secao))];
		let html = `<p class="pc-intro">${this.t(`Config.abas.${aba}.intro`)}</p>`;
		html += semSecao.map((c) => this.campo(c)).join("");
		if (aba === "canais") {
			html += `<button type="button" class="pc-acao" data-action="canais"><i class="fa-solid fa-tower-broadcast"></i> ${esc(this.ctx.t("Titles.OpenVCMenu"))}</button>`;
		}
		for (const s of secoes) {
			const titulo = s === "depuracao" ? this.t("Config.depuracao") : this.ctx.t(`Titles.${s}`);
			html += `<section><h3>${esc(titulo)}</h3>${lista.filter((c) => c.secao === s).map((c) => this.campo(c)).join("")}</section>`;
		}
		if (aba === "deteccao" && !this.ctx.get("ActivateSpotting")) {
			html = `<p class="pc-aviso"><i class="fa-solid fa-circle-info"></i> ${this.t("Config.deteccaoDesligada")}</p>` + html;
		}
		if (aba === "canais" && !this.ctx.get("ActivateVCs")) {
			html = `<p class="pc-aviso"><i class="fa-solid fa-circle-info"></i> ${this.t("Config.canaisDesligados")}</p>` + html;
		}
		return html;
	}

	async _renderHTML() {
		if (!this.abas.some((a) => a.id === this.aba)) this.aba = this.abas[0].id;
		const nav = this.abas.map((a) => `<a class="pc-aba ${a.id === this.aba ? "active" : ""}" data-action="aba" data-aba="${a.id}">
			<i class="${a.icone}"></i> ${esc(this.t(`Config.abas.${a.id}.nome`))}</a>`).join("");
		const paineis = this.abas.map((a) => `<div class="pc-painel ${a.id === this.aba ? "active" : ""}" data-aba="${a.id}">${this.corpoDaAba(a.id)}</div>`).join("");
		const restaurar = game.user.isGM
			? `<button type="button" data-action="restaurar"><i class="fa-solid fa-rotate-left"></i> ${esc(this.t("Config.restaurar"))}</button>`
			: "";
		return `<div class="pc-corpo">
			<nav class="pc-abas">${nav}</nav>
			<div class="pc-paineis">${paineis}</div>
			<footer>${restaurar}<span class="pc-espaco"></span><button type="submit"><i class="fa-solid fa-save"></i> ${esc(this.t("Config.salvar"))}</button></footer>
		</div>`;
	}

	_replaceHTML(result, content) { content.innerHTML = result; }

	static #trocarAba(ev, el) {
		this.aba = el.dataset.aba;
		for (const n of this.element.querySelectorAll(".pc-aba")) n.classList.toggle("active", n.dataset.aba === this.aba);
		for (const n of this.element.querySelectorAll(".pc-painel")) n.classList.toggle("active", n.dataset.aba === this.aba);
	}

	static #abrirCanais() {
		new VisionChannelsWindow().render(true);
	}

	static #testarSom() {
		const som = this.element.querySelector('[name="SpottedSound"]')?.value;
		const volume = Number(this.element.querySelector('[name="SpottedSoundVolume"]')?.value);
		if (som) PerceptiveSound.PlaySound(som, null, { pTest: true, pVolume: isNaN(volume) ? 1 : volume });
	}

	/** Lê o valor de um campo conforme o tipo da configuração. */
	static ler(c, el) {
		if (c.tipo === Boolean) return Boolean(el.checked);
		if (c.tipo === Array) {
			const partes = String(el.value ?? "").split(",").map((v) => v.trim()).filter((v) => v.length);
			return c.lista === "numero" ? partes.map((v) => Number(v)) : partes;
		}
		if (c.tipo === Number) {
			const n = Number(el.value);
			return isNaN(n) ? c.padrao : n;
		}
		return String(el.value ?? "");
	}

	static async #salvar(ev, form) {
		let recarregar = false;
		for (const c of CONFIGS) {
			if (!c.aba) continue;
			const el = this.element.querySelector(`[name="${c.chave}"]`);
			if (!el) continue;
			if ((c.escopo ?? "world") === "world" && !game.user.isGM) continue;
			const novo = ConfigPercepcao.ler(c, el);
			const atual = this.ctx.get(c.chave);
			if (foundry.utils.objectsEqual({ v: novo }, { v: atual })) continue;
			await this.ctx.set(c.chave, novo);
			if (c.recarregar) recarregar = true;
		}
		ui.notifications.info(this.t("Config.salvo"));
		if (recarregar) {
			await this.close();
			const SettingsConfig = foundry.applications.settings?.SettingsConfig;
			if (SettingsConfig?.reloadConfirm) await SettingsConfig.reloadConfirm({ world: true });
			else foundry.utils.debouncedReload();
		}
		else this.render();
	}

	static async #restaurar() {
		const ok = await DialogV2.confirm({
			classes: ["mono"],
			window: { title: this.t("Config.restaurar") },
			content: `<p>${this.t("Config.restaurarPergunta")}</p>`,
			rejectClose: false
		});
		if (!ok) return;
		let recarregar = false;
		for (const c of configsDoMundo()) {
			if (["VisionChannels", "lastVersion"].includes(c.chave)) continue;
			if (foundry.utils.objectsEqual({ v: this.ctx.get(c.chave) }, { v: c.padrao })) continue;
			await this.ctx.set(c.chave, foundry.utils.deepClone(c.padrao));
			if (c.recarregar) recarregar = true;
		}
		ui.notifications.info(this.t("Config.restaurado"));
		if (recarregar) {
			await this.close();
			const SettingsConfig = foundry.applications.settings?.SettingsConfig;
			if (SettingsConfig?.reloadConfirm) await SettingsConfig.reloadConfirm({ world: true });
			else foundry.utils.debouncedReload();
		}
		else this.render();
	}
}

/** Menu nas configurações do módulo: abre a mesma janela. */
export function classeDoMenu(ctx) {
	return class MenuPercepcao extends ConfigPercepcao {
		constructor(options = {}) { super(ctx, options); }
	};
}

export const chaveDoMundo = (k) => `${cModuleName}.${cS}${k}`;
