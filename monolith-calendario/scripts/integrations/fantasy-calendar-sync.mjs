/**
 * Monolith fork: live date sync with app.fantasy-calendar.com.
 *
 * Fantasy-Calendar has an undocumented public API (https://app.fantasy-calendar.com/api/v1):
 *  - GET  /calendar/{hash}/dynamic_data   current date (public calendars, no login)
 *  - GET  /calendar/{hash}/last_changed   timestamps, used for cheap polling
 *  - Personal access token (Premium) from /profile/api-tokens, sent as a Bearer token
 *  - POST /calendar/{hash}/changeDate {unit: 'days'|'minutes', count} (needs the token)
 *
 * Only the active GM talks to the site. The structure of the calendar (months, moons, seasons,
 * events) still comes from the exported JSON through the Fantasy-Calendar importer.
 * @module Integrations/FantasyCalendarSync
 */

import { CalendarManager } from '../calendar/_module.mjs';
import { MODULE } from '../constants.mjs';
import { log } from '../utils/_module.mjs';

const API = 'https://app.fantasy-calendar.com/api/v1';
/** Calendário de Monolith no Fantasy-Calendar (embutido: módulo de uso pessoal). */
const MONOLITH_HASH = 'eebf9d7a7158b0bc734c8d5420e8e66d';
const S = {
  HASH: 'fcHash',
  PULL: 'fcPull',
  PUSH: 'fcPush',
  CLOCK: 'fcUseClock',
  POLL: 'fcPollSeconds',
  TOKEN: 'fcToken',
  LAST: 'fcLastKnown'
};

let pollTimer = null;
let applyingRemote = false;
let pushTimer = null;
let lastChange = null;

const get = (k) => game.settings.get(MODULE.ID, k);
const set = (k, v) => game.settings.set(MODULE.ID, k, v);
const isLeader = () => game.users.activeGM?.isSelf ?? false;

/** Register settings (call during init). */
export function registerFantasyCalendarSettings() {
  game.settings.register(MODULE.ID, S.HASH, {
    name: 'Fantasy-Calendar: hash do calendário',
    hint: 'O código no fim do link do calendário (app.fantasy-calendar.com/calendars/<hash>). Deixe vazio para desligar a sincronização.',
    scope: 'world', config: false, type: String, default: MONOLITH_HASH, onChange: () => restart()
  });
  game.settings.register(MODULE.ID, S.PULL, {
    name: 'Fantasy-Calendar: puxar a data do site',
    hint: 'Quando a data muda no site, o Foundry acompanha.',
    scope: 'world', config: false, type: Boolean, default: true, onChange: () => restart()
  });
  game.settings.register(MODULE.ID, S.PUSH, {
    name: 'Fantasy-Calendar: enviar avanços do Foundry para o site',
    hint: 'Precisa de um token de acesso pessoal do site (contas Premium), salvo no menu "Token do Fantasy-Calendar".',
    scope: 'world', config: false, type: Boolean, default: true
  });
  game.settings.register(MODULE.ID, S.CLOCK, {
    name: 'Fantasy-Calendar: sincronizar também a hora',
    hint: 'Desligado: só o dia é sincronizado e a hora do Foundry é preservada (use se o relógio do calendário no site está desativado).',
    scope: 'world', config: false, type: Boolean, default: false
  });
  game.settings.register(MODULE.ID, S.POLL, {
    name: 'Fantasy-Calendar: intervalo de verificação (segundos)',
    scope: 'world', config: false, type: Number, default: 60, range: { min: 15, max: 3600, step: 15 }, onChange: () => restart()
  });
  game.settings.register(MODULE.ID, S.TOKEN, { scope: 'client', config: false, type: String, default: '' });
  game.settings.register(MODULE.ID, S.LAST, { scope: 'world', config: false, type: Object, default: {} });
  game.settings.registerMenu(MODULE.ID, 'fcConnection', {
    name: 'Fantasy-Calendar',
    label: 'Conexão com o Fantasy-Calendar',
    hint: 'Hash do calendário, sincronização da data e token de acesso pessoal, tudo numa janela.',
    icon: 'fas fa-link',
    type: FantasyCalendarApp,
    restricted: true
  });
}

/** Start polling and hooks (call during ready). */
export function initializeFantasyCalendarSync() {
  Hooks.on('updateWorldTime', onWorldTimeChanged);
  restart();
  globalThis.CALENDARIA ??= {};
  globalThis.CALENDARIA.fantasyCalendar = { pull: () => pull(true), push: () => pushNow(), status, open: () => new FantasyCalendarApp().render(true) };
}

function restart() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  if (!game.ready || !isLeader() || !get(S.HASH)) return;
  if (get(S.PULL)) {
    pull(true);
    pollTimer = setInterval(() => poll(), Math.max(15, get(S.POLL)) * 1000);
  }
}

async function request(path, { method = 'GET', body = null, auth = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = get(S.TOKEN);
    if (!token) throw new Error('Sem token do Fantasy-Calendar. Use a janela "Conexão com o Fantasy-Calendar".');
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
  if (!res.ok) throw new Error(`Fantasy-Calendar respondeu ${res.status} em ${path}`);
  return res.json();
}

/** Absolute day number on the Fantasy-Calendar side (equals internal day count when year zero exists). */
function fcToComponents(dd) {
  const calendar = CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  return { year: (dd.year ?? 0) - yearZero, month: dd.timespan ?? 0, dayOfMonth: Math.max(0, (dd.day ?? 1) - 1), hour: dd.hour ?? 0, minute: dd.minute ?? 0, second: 0 };
}

function dayNumber(calendar, worldTime) {
  const spd = (calendar.days?.hoursPerDay ?? 24) * (calendar.days?.minutesPerHour ?? 60) * (calendar.days?.secondsPerMinute ?? 60);
  return Math.floor(worldTime / spd);
}

async function poll() {
  try {
    const hash = get(S.HASH);
    const lc = await request(`/calendar/${hash}/last_changed`);
    const stamp = lc?.last_dynamic_change ?? null;
    if (stamp && stamp !== lastChange) await pull(false, stamp);
  } catch (err) {
    log(2, 'Fantasy-Calendar: falha ao verificar mudanças', err);
  }
}

async function pull(force = false, stamp = null) {
  if (!isLeader()) return;
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return;
  try {
    const hash = get(S.HASH);
    const res = await request(`/calendar/${hash}/dynamic_data`);
    const dd = res?.dynamic_data ?? res;
    if (!dd || dd.year === undefined) return;
    if (stamp) lastChange = stamp;
    else {
      const lc = await request(`/calendar/${hash}/last_changed`).catch(() => null);
      lastChange = lc?.last_dynamic_change ?? lastChange;
    }
    const target = fcToComponents(dd);
    const spd = (calendar.days?.hoursPerDay ?? 24) * (calendar.days?.minutesPerHour ?? 60) * (calendar.days?.secondsPerMinute ?? 60);
    const now = game.time.worldTime;
    let targetTime;
    if (get(S.CLOCK)) targetTime = calendar.componentsToTime(target);
    else {
      const dayStart = calendar.componentsToTime({ ...target, hour: 0, minute: 0, second: 0 });
      const timeOfDay = ((now % spd) + spd) % spd;
      targetTime = dayStart + timeOfDay;
    }
    await set(S.LAST, { day: dayNumber(calendar, targetTime), minuteOfDay: Math.floor((targetTime % spd) / 60) });
    if (!force && Math.abs(targetTime - now) < 60) return;
    if (Math.abs(targetTime - now) < 60) return;
    applyingRemote = true;
    try {
      await game.time.set(targetTime);
      ui.notifications.info(`Fantasy-Calendar: data sincronizada (${dd.day}/${(dd.timespan ?? 0) + 1}/${dd.year}).`);
    } finally {
      setTimeout(() => (applyingRemote = false), 500);
    }
  } catch (err) {
    log(1, 'Fantasy-Calendar: falha ao puxar a data', err);
    if (force) ui.notifications.warn(`Fantasy-Calendar: ${err.message}`);
  }
}

function onWorldTimeChanged() {
  if (applyingRemote || !isLeader() || !get(S.PUSH) || !get(S.HASH) || !get(S.TOKEN)) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow(), 2000);
}

async function pushNow() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar || !isLeader() || !get(S.TOKEN)) return;
  const spd = (calendar.days?.hoursPerDay ?? 24) * (calendar.days?.minutesPerHour ?? 60) * (calendar.days?.secondsPerMinute ?? 60);
  const now = game.time.worldTime;
  const last = get(S.LAST) ?? {};
  if (!Number.isFinite(last.day)) return pull(true);
  const hash = get(S.HASH);
  try {
    const deltaDays = dayNumber(calendar, now) - last.day;
    if (deltaDays) await request(`/calendar/${hash}/changeDate`, { method: 'POST', auth: true, body: { unit: 'days', count: deltaDays } });
    let minuteOfDay = last.minuteOfDay ?? 0;
    if (get(S.CLOCK)) {
      const nowMinute = Math.floor((((now % spd) + spd) % spd) / 60);
      const deltaMinutes = nowMinute - minuteOfDay;
      if (deltaMinutes) await request(`/calendar/${hash}/changeDate`, { method: 'POST', auth: true, body: { unit: 'minutes', count: deltaMinutes } });
      minuteOfDay = nowMinute;
    }
    await set(S.LAST, { day: dayNumber(calendar, now), minuteOfDay });
    const lc = await request(`/calendar/${hash}/last_changed`).catch(() => null);
    lastChange = lc?.last_dynamic_change ?? lastChange;
  } catch (err) {
    log(1, 'Fantasy-Calendar: falha ao enviar a data', err);
    ui.notifications.warn(`Fantasy-Calendar: ${err.message}`);
  }
}

function status() {
  return { hash: get(S.HASH), pull: get(S.PULL), push: get(S.PUSH), clock: get(S.CLOCK), hasToken: !!get(S.TOKEN), lastKnown: get(S.LAST), lastChange, polling: !!pollTimer };
}

/**
 * Monolith fork: one window with everything needed to connect to Fantasy-Calendar.
 * Opened from the Calendaria settings panel (Home tab), from Configure Settings and from the console API.
 * Writing to Fantasy-Calendar requires a Sanctum personal access token, created at
 * app.fantasy-calendar.com/profile/api-tokens (Premium accounts). The legacy api_token returned by
 * /user/login is rejected by the protected routes, so no password is ever asked for.
 */
export class FantasyCalendarApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'monolith-fantasy-calendar',
    classes: ['mono', 'monolith-fc'],
    tag: 'form',
    window: { title: 'Fantasy-Calendar', icon: 'fas fa-link', resizable: true },
    position: { width: 520, height: 'auto' },
    form: { handler: FantasyCalendarApp.#onSubmit, closeOnSubmit: false, submitOnChange: false },
    actions: { test: FantasyCalendarApp.#onTest, pullNow: FantasyCalendarApp.#onPull, clearToken: FantasyCalendarApp.#onClearToken }
  };

  #siteDate = null;

  async _prepareContext() {
    const hash = get(S.HASH);
    if (hash && this.#siteDate === null) {
      try {
        const res = await request(`/calendar/${hash}/dynamic_data`);
        const dd = res?.dynamic_data ?? res;
        this.#siteDate = dd ? `${dd.day}/${(dd.timespan ?? 0) + 1}/${dd.year}` : '?';
      } catch (err) {
        this.#siteDate = `erro: ${err.message}`;
      }
    }
    return { hash, pull: get(S.PULL), push: get(S.PUSH), clock: get(S.CLOCK), poll: get(S.POLL), hasToken: !!get(S.TOKEN), siteDate: this.#siteDate };
  }

  async _renderHTML(ctx) {
    const esc = (v) => foundry.utils.escapeHTML(String(v ?? ''));
    const chk = (v) => (v ? 'checked' : '');
    return `<div class="mono-root" style="background:transparent">
      <div class="mono-notice mono-notice--info" style="margin-bottom:var(--space-3)">
        <p class="mono-notice__title">Monolith no Fantasy-Calendar</p>
        <p class="mono-notice__body">Data no site agora: <b>${esc(ctx.siteDate ?? '...')}</b>. O Foundry acompanha o site${ctx.hasToken ? ' e envia os avanços de tempo de volta' : '; para enviar os avanços de volta, cole o token abaixo'}.</p>
      </div>
      <h3 class="mono-heading">Sincronização</h3>
      <label class="mono-field"><span class="mono-field__label">Puxar a data do site</span><input class="mono-toggle" type="checkbox" role="switch" name="pull" ${chk(ctx.pull)}><p class="mono-field__hint">Verifica o site a cada ${esc(ctx.poll)} segundos.</p></label>
      <label class="mono-field"><span class="mono-field__label">Enviar avanços para o site</span><input class="mono-toggle" type="checkbox" role="switch" name="push" ${chk(ctx.push)}><p class="mono-field__hint">Só funciona com o token salvo neste navegador.</p></label>
      <label class="mono-field"><span class="mono-field__label">Sincronizar também a hora</span><input class="mono-check" type="checkbox" name="clock" ${chk(ctx.clock)}><p class="mono-field__hint">Desligado: só o dia muda, a hora do Foundry fica.</p></label>
      <label class="mono-field"><span class="mono-field__label">Token de acesso pessoal</span><input class="mono-input" type="password" name="token" autocomplete="off" placeholder="${ctx.hasToken ? 'salvo neste navegador' : 'cole o token aqui'}"><p class="mono-field__hint">Fica só neste navegador. Vazio mantém o atual.</p></label>
      <input type="hidden" name="hash" value="${esc(ctx.hash)}"><input type="hidden" name="poll" value="${esc(ctx.poll)}">
      <footer class="mono-window__footer" style="margin:var(--space-4) calc(-1 * var(--space-4)) calc(-1 * var(--space-4))">
        ${ctx.hasToken ? '<button type="button" class="mono-btn mono-btn--ghost" data-action="clearToken">Apagar token</button>' : ''}
        <button type="button" class="mono-btn" data-action="pullNow">Puxar agora</button>
        <button type="button" class="mono-btn mono-btn--secondary" data-action="test">Testar</button>
        <button type="submit" class="mono-btn mono-btn--primary">Salvar</button>
      </footer>
    </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  static async #onSubmit(event, form, formData) {
    const d = formData.object;
    if (!game.user.isGM) return ui.notifications.warn('Só o Mestre configura a conexão.');
    await set(S.HASH, String(d.hash ?? '').trim());
    await set(S.PULL, !!d.pull);
    await set(S.CLOCK, !!d.clock);
    await set(S.PUSH, !!d.push);
    await set(S.POLL, Math.max(15, Number(d.poll) || 60));
    if (String(d.token ?? '').trim()) await set(S.TOKEN, String(d.token).trim());
    this.#siteDate = null;
    ui.notifications.info('Fantasy-Calendar: conexão salva.');
    restart();
    this.render();
  }

  static async #onTest() {
    const hash = get(S.HASH);
    if (!hash) return ui.notifications.warn('Preencha e salve o hash do calendário primeiro.');
    try {
      const res = await request(`/calendar/${hash}/dynamic_data`);
      const dd = res?.dynamic_data ?? res;
      ui.notifications.info(`Fantasy-Calendar: leitura ok (${dd.day}/${(dd.timespan ?? 0) + 1}/${dd.year}).`);
    } catch (err) {
      return ui.notifications.error(`Fantasy-Calendar: não consegui ler o calendário (${err.message}).`);
    }
    if (!get(S.TOKEN)) return ui.notifications.info('Fantasy-Calendar: sem token, só a leitura está ativa.');
    try {
      const res = await request(`/calendar/${hash}/changeDate`, { method: 'POST', auth: true, body: { unit: 'days', count: 0 } });
      ui.notifications.info(`Fantasy-Calendar: token válido, envio liberado (${res?.date_string ?? 'ok'}).`);
    } catch (err) {
      ui.notifications.warn(`Fantasy-Calendar: o site recusou o token (${err.message}).`);
    }
  }

  static async #onPull() {
    await pull(true);
    this.#siteDate = null;
    this.render();
  }

  static async #onClearToken() {
    await set(S.TOKEN, '');
    ui.notifications.info('Fantasy-Calendar: token apagado deste navegador.');
    this.render();
  }
}
