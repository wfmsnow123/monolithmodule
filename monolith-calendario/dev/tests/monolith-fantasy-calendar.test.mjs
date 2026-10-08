/**
 * Monolith fork: the imported Fantasy-Calendar calendar must match app.fantasy-calendar.com exactly.
 * Expected values in fixtures/monolith-fc-expected.json were computed with Fantasy-Calendar's own formulas
 * (epoch, week_day, custom moon cycles, periodic seasons) from the real "Monolith" export.
 */
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, describe, expect, it } from 'vitest';
import CalendariaCalendar from '../../scripts/data/calendaria-calendar.mjs';
import FantasyCalendarImporter from '../../scripts/importers/fantasy-calendar-importer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fc = JSON.parse(readFileSync(resolve(here, 'fixtures/monolith-fc.json'), 'utf-8'));
const expected = JSON.parse(readFileSync(resolve(here, 'fixtures/monolith-fc-expected.json'), 'utf-8'));

let def;
let cal;

beforeAll(async () => {
  const importer = new FantasyCalendarImporter();
  def = await importer.transform(fc);
  cal = Object.create(CalendariaCalendar.prototype);
  Object.assign(cal, def);
  cal.leapYearConfig ??= null;
});

const internal = (c) => ({ year: c.year - def.years.yearZero, month: c.month, dayOfMonth: c.day - 1, hour: 12, minute: 0, second: 0 });

describe('Monolith Fantasy-Calendar import', () => {
  it('keeps the Fantasy-Calendar year (year zero exists)', () => {
    expect(def.years.yearZero).toBe(0);
    expect(def.years.firstWeekday).toBe(0);
  });

  it('imports both custom-cycle moons in sequence mode', () => {
    const [telunia, pilas] = def.moons;
    expect(telunia.phaseMode).toBe('sequence');
    expect(telunia.phaseSequence).toHaveLength(24);
    expect(pilas.phaseSequence).toHaveLength(20);
    expect(telunia.cycleLength).toBe(24);
    expect(pilas.cycleLength).toBe(20);
  });

  it('imports periodic seasons with the Fantasy-Calendar offset', () => {
    expect(def.seasons.type).toBe('periodic');
    expect(def.seasons.offset).toBe(15);
    expect(def.seasons.values.map((s) => s.duration)).toEqual([120, 120, 120, 120]);
  });

  for (const c of expected) {
    describe(`${c.day}/${c.month + 1}/${c.year} (epoch ${c.epoch})`, () => {
      it('absolute day equals the Fantasy-Calendar epoch', () => {
        expect(cal._componentsToDays(internal(c))).toBe(c.epoch);
      });
      it(`weekday is ${c.weekdayName}`, () => {
        expect(cal._computeDayOfWeek(internal(c))).toBe(c.weekday);
      });
      it('moon phases match', () => {
        expect(cal.getMoonPhase(0, internal(c)).step).toBe(c.telunia);
        expect(cal.getMoonPhase(1, internal(c)).step).toBe(c.pilas);
      });
      it('season matches', () => {
        const info = cal.getPeriodicSeasonInfo(internal(c));
        expect(info.index).toBe(c.season);
        expect(info.dayInSeason).toBe(c.seasonDay);
      });
    });
  }

  it('worldTime round-trips through the calendar for the current FC date', () => {
    const comp = { year: 1978, month: 8, dayOfMonth: 9, hour: 6, minute: 30, second: 0 };
    const t = cal.componentsToTime(comp);
    const back = cal.timeToComponents(t);
    expect([back.year, back.month, back.dayOfMonth, back.hour, back.minute]).toEqual([1978, 8, 9, 6, 30]);
    expect(back.season).toBe(3);
  });

  it('moon position is step / granularity (full moon = 0.5)', () => {
    const p = CalendariaCalendar.resolveSequenceMoonPhase({ phaseSequence: [0, 6, 12, 18], phaseGranularity: 24 }, def.moons[0].phases, 2);
    expect(p.position).toBe(0.5);
  });
});

/* ---------- Events: condition trees evaluated by the real engine ---------- */
import { vi } from 'vitest';
import CalendarManagerMock from '../__mocks__/calendar-manager.mjs';
import { evaluateEntry } from '../../scripts/notes/condition-engine.mjs';

vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager };
});

describe('Monolith Fantasy-Calendar events', () => {
  let notes;
  const byName = (n) => notes.find((x) => x.name.includes(n));
  const on = (note, year, month, dayOfMonth) => {
    CalendarManagerMock.getActiveCalendar.mockReturnValue(cal);
    return evaluateEntry(note.conditionTree, { year, month, dayOfMonth }, { startDate: note.startDate });
  };

  beforeAll(async () => {
    const importer = new FantasyCalendarImporter();
    await importer.transform(fc);
    notes = await importer.extractNotes(fc);
  });

  it('imports all 87 events', () => expect(notes).toHaveLength(87));

  it('annual event lands on its FC month (0-based timespan 7 = Tollen) and day', () => {
    const n = byName('Vigília de Athelstan');
    expect(n.conditionTree).toBeTruthy();
    expect(on(n, 1978, 7, 14)).toBe(true);
    expect(on(n, 1979, 7, 14)).toBe(true);
    expect(on(n, 1978, 6, 14)).toBe(false);
    expect(on(n, 1978, 7, 13)).toBe(false);
  });

  it('"Year is or later than 125" (FC Year operator 2) holds from year 125 on', () => {
    const n = byName('Marcha de Andamundo');
    expect(on(n, 1978, 1, 4)).toBe(true);
    expect(on(n, 125, 1, 4)).toBe(true);
    expect(on(n, 124, 1, 4)).toBe(false);
    expect(on(n, 1978, 1, 5)).toBe(false);
  });

  it('absolute modulo matches FC "every nth year" semantics', async () => {
    const { evaluateCondition } = await import('../../scripts/notes/condition-engine.mjs');
    CalendarManagerMock.getActiveCalendar.mockReturnValue(cal);
    const c = { field: 'year', op: '%', value: 125, offset: 0, absolute: true };
    expect(evaluateCondition(c, { year: 2000, month: 0, dayOfMonth: 0 }, { startDate: { year: 1978, month: 0, dayOfMonth: 0 } })).toBe(true);
    expect(evaluateCondition(c, { year: 1978, month: 0, dayOfMonth: 0 }, { startDate: { year: 1978, month: 0, dayOfMonth: 0 } })).toBe(false);
  });

  it('"Dualidade dos céus" needs both moons full (epoch 712332)', () => {
    const n = byName('Dualidade');
    expect(on(n, 1978, 8, 12)).toBe(true);
    expect(on(n, 1978, 8, 13)).toBe(false);
    expect(on(n, 1978, 8, 0)).toBe(false);
  });

  it('season events fire on the first day of the periodic season (epoch 712335)', () => {
    const n = byName('Primavera');
    expect(on(n, 1978, 8, 15)).toBe(true);
    expect(on(n, 1978, 8, 16)).toBe(false);
    expect(on(n, 1978, 8, 14)).toBe(false);
  });

  it('one-time dated event keeps its exact date', () => {
    const n = byName('Primeira Casca');
    expect(n.startDate).toEqual({ year: 1978, month: 9, dayOfMonth: 4 });
    expect(n.repeat).toBe('never');
  });
});
