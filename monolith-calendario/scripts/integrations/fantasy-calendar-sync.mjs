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
    scope: 'world', config: true, type: String, default: '', onChange: () => restart()
  });
  game.settings.register(MODULE.ID, S.PULL, {
    name: 'Fantasy-Calendar: puxar a data do site',
    hint: 'Quando a data muda no site, o Foundry acompanha.',
    scope: 'world', config: true, type: Boolean, default: true, onChange: () => restart()
  });
  game.settings.register(MODULE.ID, S.PUSH, {
    name: 'Fantasy-Calendar: enviar avanços do Foundry para o site',
    hint: 'Precisa de um token de acesso pessoal do site (contas Premium), salvo no menu "Token do Fantasy-Calendar".',
    scope: 'world', config: true, type: Boolean, default: false
  });
  game.settings.register(MODULE.ID, S.CLOCK, {
    name: 'Fantasy-Calendar: sincronizar também a hora',
    hint: 'Desligado: só o dia é sincronizado e a hora do Foundry é preservada (use se o relógio do calendário no site está desativado).',
    scope: 'world', config: true, type: Boolean, default: false
  });
  game.settings.register(MODULE.ID, S.POLL, {
    name: 'Fantasy-Calendar: intervalo de verificação (segundos)',
    scope: 'world', config: true, type: Number, default: 60, range: { min: 15, max: 3600, step: 15 }, onChange: () => restart()
  });
  game.settings.register(MODULE.ID, S.TOKEN, { scope: 'client', config: false, type: String, default: '' });
  game.settings.register(MODULE.ID, S.LAST, { scope: 'world', config: false, type: Object, default: {} });
  game.settings.registerMenu(MODULE.ID, 'fcLogin', {
    name: 'Fantasy-Calendar: conta',
    label: 'Token do Fantasy-Calendar',
    hint: 'Token de acesso pessoal (app.fantasy-calendar.com/profile/api-tokens, contas Premium) para enviar avanços de data. Fica só neste navegador.',
    icon: 'fas fa-key',
    type: FantasyCalendarLoginMenu,
    restricted: true
  });
}

/** Start polling and hooks (call during ready). */
export function initializeFantasyCalendarSync() {
  Hooks.on('updateWorldTime', onWorldTimeChanged);
  restart();
  globalThis.CALENDARIA ??= {};
  globalThis.CALENDARIA.fantasyCalendar = { pull: () => pull(true), push: () => pushNow(), status };
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
    if (!token) throw new Error('Sem token do Fantasy-Calendar. Use "Token do Fantasy-Calendar" nas configurações.');
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
  if (applyingRemote || !isLeader() || !get(S.PUSH) || !get(S.HASH)) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow(), 2000);
}

async function pushNow() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar || !isLeader()) return;
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
 * Settings menu to paste a Fantasy-Calendar personal access token.
 * Writing to Fantasy-Calendar requires a Sanctum personal access token, created at
 * app.fantasy-calendar.com/profile/api-tokens (Premium accounts only). The legacy api_token returned by
 * /user/login is rejected by the protected routes, so no password is ever asked for.
 */
class FantasyCalendarLoginMenu extends foundry.applications.api.ApplicationV2 {
  async render() {
    const has = !!get(S.TOKEN);
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'Token do Fantasy-Calendar', icon: 'fas fa-key' },
      content: `<p>Para enviar avanços de data ao site, crie um token em <b>app.fantasy-calendar.com/profile/api-tokens</b> (recurso de contas Premium) e cole abaixo. O token fica salvo só neste navegador.</p>
        <div class="form-group"><label>Token</label><input type="password" name="token" placeholder="${has ? 'já existe um token salvo' : 'cole o token aqui'}" autocomplete="off"></div>
        <p class="hint">Deixe vazio e confirme para apagar o token salvo.</p>`,
      ok: { label: 'Salvar', callback: (ev, btn) => btn.form.elements.token.value.trim() }
    }).catch(() => null);
    if (result === null) return this;
    await set(S.TOKEN, result);
    if (!result) {
      ui.notifications.info('Fantasy-Calendar: token apagado.');
      return this;
    }
    try {
      // changeDate with count 0 needs a valid token for this calendar and changes nothing
      // (/user rejects personal access tokens, so it cannot be used to validate).
      const hash = get(S.HASH);
      if (!hash) throw new Error('preencha antes o hash do calendário');
      const res = await request(`/calendar/${hash}/changeDate`, { method: 'POST', auth: true, body: { unit: 'days', count: 0 } });
      ui.notifications.info(`Fantasy-Calendar: token válido. Data no site: ${res?.date_string ?? '?'}.`);
    } catch (err) {
      ui.notifications.warn(`Fantasy-Calendar: o site recusou o token (${err.message}).`);
    }
    return this;
  }
}
