'use strict';

/* ============ Basics ============ */
const KEY = 'gymsite.v1';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const LOCALE = 'en-GB';

const $ = (sel) => document.querySelector(sel);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekStart = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
const nice = (s) => parse(s).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const short = (s) => parse(s).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
const norm = (s) => s.trim().toLowerCase();
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayIso = () => iso(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function ex(name, sets, reps, kg = '') { return { name, sets, reps, kg }; }

// My own plan (see the doc "Mijn gymschema"). Bump SCHEDULE_VERSION when this default plan changes.
const SCHEDULE_VERSION = 2;
function mySchedule() {
  const incline = () => ex('Incline chest press (Smith)', 2, '8', '25 per side');
  const flys = () => ex('Machine flys', 2, '8', '113');
  const laterals = () => ex('Lateral raises', 2, '7', '6.8');
  const overhead = () => ex('Overhead triceps extension (1 arm)', 2, '8', '13');
  const pullups = () => ex('Pull-ups', 3, '6', 'bodyweight');
  const tbar = () => ex('T-bar rows', 3, '8', '30');
  const inclineCurls = () => ex('Incline curls', 2, '6', '14');
  const situps = () => ex('Incline sit-ups', 2, 'to failure', '20');
  return {
    1: { name: 'Push', exercises: [incline(), ex('Machine chest press', 2, '8', '67'), flys(), laterals(), overhead(), ex('Triceps pushdown', 2, '8-10', '29'), ex('Incline leg raises', 2, 'to failure', 'bodyweight')] },
    2: { name: 'Rest', exercises: [] },
    3: { name: 'Pull', exercises: [pullups(), tbar(), ex('Rear delt', 2, '8', '6.8'), inclineCurls(), ex('Preacher curls', 2, '8-10', '41'), ex('Forearm curls', 2, '8', ''), situps()] },
    4: { name: 'Rest', exercises: [] },
    5: { name: 'Upper', exercises: [incline(), flys(), pullups(), tbar(), laterals(), inclineCurls(), overhead(), situps()] },
    6: { name: 'Rest', exercises: [] },
    0: { name: 'Rest', exercises: [] },
  };
}

function defaultState() {
  return {
    version: 1,
    scheduleVersion: SCHEDULE_VERSION,
    createdAt: todayIso(),
    schedule: mySchedule(),
    sessions: [],  // { id, date, dayName, template, entries: [{ exercise, target, sets: [{ kg, reps }] }], note }
    checkins: [],  // ['YYYY-MM-DD'] visits without details
    exNotes: {},   // { 'machine flys': 'seat 4' } – note per exercise
    rest: {},      // { 'machine flys': 90 } – rest seconds per exercise
    settings: { sound: true, vibrate: true },
  };
}

// Old exercise names -> new ones, in the plan and saved workouts (keeps charts continuous).
const RENAMES = {
  'single hand overhead': 'Overhead triceps extension (1 arm)',
  'flys': 'Machine flys',
};
// Dutch -> English for text that was stored before the app was translated.
const DAY_NAMES = { 'rust': 'Rest', 'training': 'Workout' };
const PHRASES = [[/tot falen/gi, 'to failure'], [/per kant/gi, 'per side'], [/lichaamsgewicht/gi, 'bodyweight'], [/nog onbekend/gi, '']];
const translate = (s) => PHRASES.reduce((acc, [re, to]) => acc.replace(re, to), String(s ?? '')).trim();

function migrate(s) {
  const fixName = (name) => RENAMES[norm(name || '')] || name;
  const fixDay = (name) => DAY_NAMES[norm(name || '')] || name;
  Object.values(s.schedule).forEach((d) => {
    d.name = fixDay(d.name);
    d.exercises.forEach((e) => {
      e.name = fixName(e.name);
      e.reps = translate(e.reps);
      e.kg = translate(e.kg).replace(/^(\d+),(\d+)/, '$1.$2');
    });
  });
  s.sessions.forEach((ses) => {
    ses.dayName = fixDay(ses.dayName);
    ses.entries.forEach((e) => { e.exercise = fixName(e.exercise); e.target = translate(e.target); });
  });
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.schedule && Array.isArray(s.sessions)) {
        const merged = { ...defaultState(), ...s };
        // Replace the old example plan with my own plan; workouts and check-ins stay.
        if ((s.scheduleVersion || 1) < SCHEDULE_VERSION) { merged.schedule = mySchedule(); merged.scheduleVersion = SCHEDULE_VERSION; }
        migrate(merged);
        return merged;
      }
    }
  } catch (e) { /* no storage available */ }
  return defaultState();
}

let state = load();
try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* no storage available */ }

function save() {
  state.sessions.sort((a, b) => a.date.localeCompare(b.date));
  state.checkins = [...new Set(state.checkins)].sort();
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch (e) { toast('Could not save in this browser'); return false; }
}

function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

const isPlanned = (dow) => (state.schedule[dow]?.exercises || []).length > 0;
const visitSet = () => new Set([...state.sessions.map((s) => s.date), ...state.checkins]);
const startDate = () => {
  const all = [state.createdAt, ...state.sessions.map((s) => s.date), ...state.checkins].filter(Boolean).sort();
  return all[0] || todayIso();
};

/* ============ Tabs ============ */
const renderers = {};
function showTab(name) {
  document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((s) => s.classList.toggle('active', s.id === `tab-${name}`));
  renderers[name]?.();
  window.scrollTo(0, 0);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) showTab(b.dataset.tab);
});

/* ============ Today ============ */
let draft = null;

const DRAFT_KEY = 'gymsite.draft';

function fromTemplate(date, dow) {
  const t = state.schedule[dow];
  return {
    id: null, date, dayName: t.name, template: dow, note: '',
    entries: t.exercises.map((e) => ({
      exercise: e.name,
      target: `${e.sets} × ${e.reps}`,
      startKg: e.kg || '',
      sets: Array.from({ length: Math.max(1, Number(e.sets) || 1) }, () => ({ kg: '', reps: '', done: false })),
    })),
  };
}

// The workout you're filling in is kept on the phone after every tap,
// so closing the app halfway through your training loses nothing.
function persistDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* no storage */ }
}
function storedDraft(date) {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    return d && d.date === date && Array.isArray(d.entries) ? d : null;
  } catch (e) { return null; }
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* no storage */ } }

function loadDraft(date, templateDow) {
  const existing = state.sessions.find((s) => s.date === date);
  const pending = storedDraft(date);
  if (pending && templateDow === undefined) {
    draft = pending; // unfinished workout for this day
  } else if (existing && templateDow === undefined) {
    draft = JSON.parse(JSON.stringify(existing));
    draft.template = draft.template ?? parse(date).getDay();
    draft.entries.forEach((en) => en.sets.forEach((s) => { s.done = true; }));
  } else {
    draft = fromTemplate(date, templateDow ?? parse(date).getDay());
    if (existing) draft.id = existing.id; // picked another workout for a day that was already saved
    if (templateDow !== undefined) persistDraft();
  }
  renderToday();
}

// "2 × 8-10" -> top of the rep range (10). "to failure" / "max" -> null (no target).
function repTarget(en) {
  const r = String(en.target || '').split('×')[1] || '';
  const nums = r.match(/\d+/g);
  return nums ? { low: Number(nums[0]), high: Number(nums.at(-1)) } : null;
}

// Best performance for an exercise before a date (plus sets already ticked off today).
function bestBefore(name, date, extraSets = []) {
  const best = { has: false, kg: 0, e1: 0, repsAt: {} };
  const add = (s) => {
    const kg = Number(s.kg) || 0, reps = Number(s.reps) || 0;
    if (!reps) return;
    best.has = true;
    best.kg = Math.max(best.kg, kg);
    best.e1 = Math.max(best.e1, kg * (1 + reps / 30));
    best.repsAt[kg] = Math.max(best.repsAt[kg] || 0, reps);
  };
  state.sessions.forEach((s) => {
    if (s.date >= date) return;
    s.entries.filter((e) => norm(e.exercise) === norm(name)).forEach((e) => e.sets.forEach(add));
  });
  extraSets.forEach(add);
  return best;
}

// Progressive overload: hit the top of your rep range on every set at your top weight
// last time -> suggest a small step up today.
function progressionFor(en) {
  const range = repTarget(en);
  const prev = lastFor(en.exercise, draft.date);
  if (!range || !prev || !prev.sets.length) return null;
  const top = Math.max(...prev.sets.map((s) => s.kg));
  if (!(top > 0)) return null;
  const topSets = prev.sets.filter((s) => s.kg === top);
  if (!topSets.every((s) => s.reps >= range.high)) return null;
  const perSide = /per side/i.test(en.startKg || '');
  const step = perSide ? 1.25 : top < 15 ? 1 : 2.5;
  return { kg: Math.round((top + step) * 100) / 100, from: top, reps: range.high, low: range.low, perSide };
}

function lastFor(name, beforeDate) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const s = state.sessions[i];
    if (s.date >= beforeDate) continue;
    const e = s.entries.find((x) => norm(x.exercise) === norm(name));
    if (e) return { date: s.date, sets: e.sets };
  }
  return null;
}

const fmtSets = (sets) => sets.map((s) => `${s.kg ?? 0}×${s.reps ?? 0}`).join(', ');
const withKg = (txt) => String(txt).replace(/^([\d.,]+)/, '$1 kg');

function renderToday() {
  $('#today-date').value = draft.date;
  const d = parse(draft.date);
  $('#today-weekday').textContent = draft.date === todayIso() ? `Today · ${DAYS[d.getDay()]}` : nice(draft.date);
  const tplName = state.schedule[draft.template]?.name || draft.dayName || 'Workout';
  $('#today-title').textContent = draft.entries.length ? tplName : 'Rest Day';

  const sel = $('#today-template');
  sel.innerHTML = ORDER.map((x) => `<option value="${x}">${DAYS[x]} – ${esc(state.schedule[x].name)}</option>`).join('');
  sel.value = String(draft.template);

  const saved = state.sessions.some((s) => s.date === draft.date);
  const checked = state.checkins.includes(draft.date);
  $('#today-status').textContent = saved ? '✓ Already saved – you can still edit it' : checked ? '✓ Checked in (no details)' : '';
  $('#today-note').value = draft.note || '';

  const names = new Set();
  Object.values(state.schedule).forEach((day) => day.exercises.forEach((e) => names.add(e.name)));
  state.sessions.forEach((s) => s.entries.forEach((e) => names.add(e.exercise)));
  $('#ex-names').innerHTML = [...names].sort().map((n) => `<option value="${esc(n)}">`).join('');

  const list = $('#today-list');
  if (!draft.entries.length) {
    list.innerHTML = `<div class="card rest-day"><div class="display">Recover</div>
      <p class="muted">Your plan says rest today. Going to the gym anyway? Pick a workout above or add an exercise.</p></div>`;
    return;
  }
  list.innerHTML = draft.entries.map((en, i) => {
    const prev = lastFor(en.exercise, draft.date);
    const startNum = num(en.startKg || '');
    const up = progressionFor(en);
    const range = repTarget(en);
    const doneCount = en.sets.filter((s) => s.done).length;
    const rows = en.sets.map((s, j) => {
      const p = prev?.sets[j] || prev?.sets[prev.sets.length - 1];
      // Hint (grey text) = what to lift: progression advice > last time > plan weight.
      const kgHint = up ? `${up.kg} kg` : p ? `${p.kg} kg` : startNum !== null ? withKg(en.startKg) : 'kg';
      const repsHint = up ? `${up.low} reps` : p ? `${p.reps} reps` : range ? `${range.low} reps` : 'reps';
      return `<div class="set-row ${s.done ? 'is-done' : ''}">
        <span class="set-nr">SET ${j + 1}${s.pr ? `<span class="pr-badge" title="${esc(s.pr)}">PR</span>` : ''}</span>
        <input type="text" inputmode="decimal" data-i="${i}" data-s="${j}" data-f="kg" value="${esc(s.kg)}" placeholder="${esc(kgHint)}" aria-label="Set ${j + 1} weight">
        <input type="text" inputmode="numeric" data-i="${i}" data-s="${j}" data-f="reps" value="${esc(s.reps)}" placeholder="${esc(repsHint)}" aria-label="Set ${j + 1} reps">
        <button class="check ${s.done ? 'on' : ''}" data-act="done" data-i="${i}" data-s="${j}" aria-label="Set ${j + 1} done" aria-pressed="${!!s.done}">
          <svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg>
        </button>
      </div>`;
    }).join('');
    const startTxt = en.startKg ? (startNum !== null ? withKg(en.startKg) : en.startKg) : '';
    const prevTxt = prev
      ? `Last time (${short(prev.date)}): ${esc(fmtSets(prev.sets))}`
      : startTxt ? `Weight from your plan: ${esc(startTxt)}` : 'No previous data yet – this is your starting point';
    const note = state.exNotes[norm(en.exercise)] || '';
    return `<div class="card ex-card ${doneCount === en.sets.length ? 'all-done' : ''}">
      <div class="ex-head"><span class="ex-name">${esc(en.exercise)}</span>${en.target ? `<span class="target">${esc(en.target)}</span>` : ''}</div>
      <div class="prev">${prevTxt}</div>
      ${up ? `<div class="advice"><b>↑ Go heavier: ${up.kg} kg${up.perSide ? ' per side' : ''}</b><span>You did ${up.reps} reps on every set at ${up.from} kg last time.</span></div>` : ''}
      <input class="ex-note" data-note="${i}" value="${esc(note)}" placeholder="✎ Note: seat height, grip, cable position…" aria-label="Note for ${esc(en.exercise)}">
      <div class="sets">
        <div class="set-row set-head"><span></span><span>Weight (kg)</span><span>Reps</span><span class="done-count">${doneCount}/${en.sets.length}</span></div>
        ${rows}
      </div>
      <div class="ex-tools">
        <button class="pill" data-act="addset" data-i="${i}">+ Set</button>
        <button class="pill" data-act="delset" data-i="${i}">− Set</button>
        ${prev ? `<button class="pill" data-act="copyprev" data-i="${i}">↺ Same as last</button>` : ''}
        <button class="icon" data-act="delex" data-i="${i}" title="Remove exercise">✕ Remove</button>
      </div>
    </div>`;
  }).join('');
}

let noteTimer = null;
$('#today-list').addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.f) { draft.entries[t.dataset.i].sets[t.dataset.s][t.dataset.f] = t.value; persistDraft(); }
  if (t.dataset.note !== undefined) {
    // exercise notes are kept per exercise, for every future workout
    state.exNotes[norm(draft.entries[t.dataset.note].exercise)] = t.value.trim();
    clearTimeout(noteTimer); noteTimer = setTimeout(save, 400);
  }
});
$('#today-list').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const en = draft.entries[b.dataset.i];
  if (b.dataset.act === 'done') return toggleSet(b, en, Number(b.dataset.s));
  if (b.dataset.act === 'addset') en.sets.push({ kg: en.sets.at(-1)?.kg || '', reps: '', done: false });
  if (b.dataset.act === 'delset' && en.sets.length > 1) en.sets.pop();
  if (b.dataset.act === 'delex') draft.entries.splice(b.dataset.i, 1);
  if (b.dataset.act === 'copyprev') {
    const prev = lastFor(en.exercise, draft.date);
    en.sets = prev.sets.map((s) => ({ kg: String(s.kg ?? ''), reps: String(s.reps ?? ''), done: false }));
  }
  persistDraft();
  renderToday();
});
$('#today-note').addEventListener('input', (e) => { draft.note = e.target.value; persistDraft(); });

// Tick a set off. Empty fields take the grey hint, so one tap = "did what was suggested".
function toggleSet(btn, en, j) {
  unlockAudio();
  const s = en.sets[j];
  if (s.done) { s.done = false; delete s.pr; persistDraft(); renderToday(); return; }
  const row = btn.closest('.set-row');
  const kgIn = row.querySelector('[data-f="kg"]'), repsIn = row.querySelector('[data-f="reps"]');
  if (s.kg === '' || s.kg == null) { const h = num(kgIn.placeholder); s.kg = h !== null ? String(h) : ''; }
  if (s.reps === '' || s.reps == null) { const h = num(repsIn.placeholder); s.reps = h !== null ? String(h) : ''; }
  if (num(s.reps) === null) { toast('Fill in your reps first'); repsIn.focus(); return; }
  s.done = true;

  // Personal record? Compare with all earlier workouts + the sets already done today.
  const earlier = en.sets.slice(0, j).filter((x) => x.done).map((x) => ({ kg: num(x.kg) || 0, reps: num(x.reps) || 0 }));
  const best = bestBefore(en.exercise, draft.date, earlier);
  const kg = num(s.kg) || 0, reps = num(s.reps) || 0, e1 = kg * (1 + reps / 30);
  delete s.pr;
  if (best.has) {
    if (kg > best.kg) s.pr = `Weight PR · ${kg} kg`;
    else if (best.repsAt[kg] !== undefined && reps > best.repsAt[kg]) s.pr = `Rep PR · ${reps} reps at ${kg} kg`;
    else if (e1 > best.e1 + 0.01) s.pr = `Est. 1RM PR · ${Math.round(e1 * 10) / 10} kg`;
  }
  persistDraft();
  renderToday();
  if (s.pr) celebrate(`🏆 New PR! ${en.exercise} – ${s.pr}`);
  // rest after every set except the very last one of the workout
  const last = draft.entries.every((x) => x.sets.every((y) => y.done));
  if (last) { stopRest(); toast('All sets done – tap Save workout'); } else startRest(en.exercise);
}

function celebrate(msg) {
  toast(msg, 3500);
  if (state.settings.vibrate && navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 120]);
}

/* ============ Rest timer ============
   Starts when you tick a set off. Uses an end time (not a counter), so it stays
   correct when your screen was off. Rest length is remembered per exercise. */
const TIMER_KEY = 'gymsite.timer';
const COMPOUND = /press|row|pull-?up|chin|squat|deadlift|dip|lunge|bench/i;
const restFor = (name) => state.rest[norm(name)] ?? (COMPOUND.test(name) ? 120 : 90);
const fmtClock = (sec) => `${Math.floor(sec / 60)}:${pad(Math.floor(sec % 60))}`;
let timer = null, timerIv = null;

let audioCtx = null;
function unlockAudio() { // browsers only allow sound after a tap, so we prepare it on the first tick
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* no audio */ }
}
function beep() {
  if (!state.settings.sound || !audioCtx) return;
  const t = audioCtx.currentTime;
  [0, 0.22, 0.44].forEach((d, k) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = k === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
    o.connect(g).connect(audioCtx.destination);
    o.start(t + d); o.stop(t + d + 0.2);
  });
}

function startRest(exName, total = restFor(exName), end = Date.now() + total * 1000) {
  timer = { ex: exName, total, end, alerted: end <= Date.now() };
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(timer)); } catch (e) { /* no storage */ }
  $('#rest-timer').hidden = false;
  clearInterval(timerIv);
  timerIv = setInterval(tickRest, 250);
  tickRest();
}
function stopRest() {
  timer = null; clearInterval(timerIv);
  $('#rest-timer').hidden = true;
  try { localStorage.removeItem(TIMER_KEY); } catch (e) { /* no storage */ }
}
function tickRest() {
  if (!timer) return;
  const left = (timer.end - Date.now()) / 1000;
  const el = $('#rest-timer');
  el.classList.toggle('over', left <= 0);
  $('#rt-time').textContent = left > 0 ? fmtClock(Math.ceil(left)) : `+${fmtClock(-left)}`;
  $('#rt-label').textContent = left > 0 ? `Rest · ${timer.ex}` : 'Next set!';
  const frac = Math.max(0, Math.min(1, left / timer.total));
  $('#rt-prog').style.strokeDashoffset = String(119.4 * (1 - frac));
  if (left <= 0 && !timer.alerted) {
    timer.alerted = true;
    if (state.settings.vibrate && navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    beep();
  }
  if (left < -300) stopRest(); // forgotten timer: hide after 5 minutes over
}
$('#rest-timer').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rt]');
  if (!b || !timer) return;
  if (b.dataset.rt === 'skip') return stopRest();
  const d = Number(b.dataset.rt);
  timer.end += d * 1000;
  timer.total = Math.max(15, timer.total + d);
  if (timer.end > Date.now()) timer.alerted = false;
  state.rest[norm(timer.ex)] = Math.max(15, restFor(timer.ex) + d); // remember for this exercise
  save();
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(timer)); } catch (err) { /* no storage */ }
  toast(`Rest for ${timer.ex}: ${fmtClock(state.rest[norm(timer.ex)])}`);
  tickRest();
});
// A timer that was running when the app closed picks up where it was.
try {
  const t = JSON.parse(localStorage.getItem(TIMER_KEY) || 'null');
  if (t && t.end > Date.now() - 300000) startRest(t.ex, t.total, t.end);
} catch (e) { /* ignore */ }
$('#today-date').addEventListener('change', (e) => { if (e.target.value) loadDraft(e.target.value); });
$('#today-template').addEventListener('change', (e) => loadDraft(draft.date, Number(e.target.value)));

function addExercise() {
  const name = $('#add-ex-name').value.trim();
  if (!name) return;
  draft.entries.push({ exercise: name, target: '', sets: [{ kg: '', reps: '' }, { kg: '', reps: '' }, { kg: '', reps: '' }] });
  $('#add-ex-name').value = '';
  renderToday();
}
$('#add-ex-btn').addEventListener('click', addExercise);
$('#add-ex-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') addExercise(); });

$('#save-session').addEventListener('click', () => {
  const entries = draft.entries.map((en) => ({
    exercise: en.exercise,
    target: en.target,
    sets: en.sets
      .map((s) => ({ kg: num(s.kg), reps: num(s.reps) }))
      .filter((s) => s.reps !== null && s.reps > 0) // a set only counts once it has reps
      .map((s) => ({ kg: s.kg ?? 0, reps: s.reps })),
  })).filter((en) => en.sets.length);

  if (!entries.length) { toast('Fill in at least one set, or check in'); return; }
  const session = { id: draft.id || uid(), date: draft.date, dayName: state.schedule[draft.template]?.name || draft.dayName, template: draft.template, entries, note: draft.note || '' };
  state.sessions = state.sessions.filter((s) => s.date !== draft.date);
  state.sessions.push(session);
  state.checkins = state.checkins.filter((d) => d !== draft.date);
  const bumped = bumpPlanWeights(entries);
  if (save()) {
    clearDraft();
    stopRest();
    toast(!bumped.length ? 'Workout saved'
      : bumped.length <= 2 ? `Saved · new plan weight: ${bumped.join(', ')}`
      : `Saved · ${bumped.length} plan weights went up`);
    loadDraft(draft.date);
  }
});

// Lifted heavier than the weight in your plan? Then the plan moves up with you.
// Text weights like "bodyweight" stay as they are; "25 per side" keeps its "per side".
function bumpPlanWeights(entries) {
  const bumped = [];
  entries.forEach((en) => {
    const top = Math.max(...en.sets.map((s) => s.kg));
    if (!(top > 0)) return;
    Object.values(state.schedule).forEach((day) => day.exercises.forEach((e) => {
      if (norm(e.name) !== norm(en.exercise)) return;
      const txt = String(e.kg || '').trim();
      const cur = num(txt);
      if (cur === null && txt) return;
      if (cur === null || top > cur) {
        e.kg = `${top}${txt.replace(/^[\d.,]+/, '')}`;
        if (!bumped.includes(e.name)) bumped.push(e.name);
      }
    }));
  });
  return bumped;
}

$('#checkin-only').addEventListener('click', () => {
  state.checkins.push(draft.date);
  if (save()) { toast('Checked in'); renderToday(); }
});

renderers.today = () => loadDraft(draft?.date || todayIso());

/* ============ Plan ============ */
renderers.plan = function renderPlan() {
  $('#plan-list').innerHTML = ORDER.map((d) => {
    const day = state.schedule[d];
    const train = day.exercises.length > 0;
    return `<div class="card">
      <div class="day-title"><strong>${DAYS[d]}</strong><span class="badge ${train ? 'train' : ''}">${train ? day.exercises.length + ' exercises' : 'rest day'}</span></div>
      <input class="day-name" data-day="${d}" data-f="dayname" value="${esc(day.name)}" placeholder="Workout name" aria-label="${DAYS[d]} workout name">
      ${train ? '<div class="sch-head"><span>Exercise</span><span>Sets</span><span>Reps</span><span>Weight</span><span></span></div>' : ''}
      ${day.exercises.map((e, i) => `<div class="sch-row">
        <input data-day="${d}" data-i="${i}" data-f="name" value="${esc(e.name)}" title="${esc(e.name)}" aria-label="Exercise">
        <input data-day="${d}" data-i="${i}" data-f="sets" value="${esc(e.sets)}" inputmode="numeric" aria-label="Sets" title="Sets">
        <input data-day="${d}" data-i="${i}" data-f="reps" value="${esc(e.reps)}" placeholder="reps" title="Reps: ${esc(e.reps)}" aria-label="Reps">
        <input data-day="${d}" data-i="${i}" data-f="kg" value="${esc(e.kg || '')}" placeholder="weight (kg)" title="Weight: ${esc(e.kg || '')}" aria-label="Weight">
        <button class="icon" data-act="del" data-day="${d}" data-i="${i}" title="Delete">✕</button>
      </div>`).join('')}
      <div class="plan-actions">
        <button class="pill" data-act="add" data-day="${d}">+ Exercise</button>
        ${train ? `<button class="pill" data-act="rest" data-day="${d}">Make rest day</button>` : ''}
      </div>
    </div>`;
  }).join('');
};

$('#plan-list').addEventListener('input', (e) => {
  const t = e.target; const day = state.schedule[t.dataset.day];
  if (!day) return;
  if (t.dataset.f === 'dayname') day.name = t.value;
  else if (t.dataset.f === 'sets') day.exercises[t.dataset.i].sets = Math.max(1, parseInt(t.value, 10) || 1);
  else if (t.dataset.f) day.exercises[t.dataset.i][t.dataset.f] = t.value;
  save();
});
$('#plan-list').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const day = state.schedule[b.dataset.day];
  if (b.dataset.act === 'add') { day.exercises.push(ex('', 3, '8-12')); if (day.name === 'Rest') day.name = 'Workout'; }
  if (b.dataset.act === 'del') day.exercises.splice(b.dataset.i, 1);
  if (b.dataset.act === 'rest' && confirm(`Make ${DAYS[b.dataset.day]} a rest day? Its exercises will be removed.`)) { day.exercises = []; day.name = 'Rest'; }
  save();
  renderers.plan();
  if (b.dataset.act === 'add') { const rows = document.querySelectorAll(`.sch-row input[data-day="${b.dataset.day}"][data-f="name"]`); rows[rows.length - 1]?.focus(); }
});

/* ============ Attendance ============ */
function weekStats(ws, visits, start, today) {
  let planned = 0, done = 0;
  for (let k = 0; k < 7; k++) {
    const d = addDays(ws, k); const s = iso(d);
    if (s < start) continue;
    if (isPlanned(d.getDay())) planned++;
    if (visits.has(s) && s <= today) done++;
  }
  return { planned, done };
}

renderers.attendance = function renderAttendance() {
  const visits = visitSet();
  const today = todayIso();
  const now = new Date();
  const start = startDate();

  const ws = weekStart(now);
  const thisWeek = weekStats(ws, visits, start, today);

  const monthPrefix = today.slice(0, 7);
  const monthVisits = [...visits].filter((d) => d.startsWith(monthPrefix)).length;

  // plan adherence over the last 4 weeks (only planned days that are over, or today if already trained)
  let planned = 0, hit = 0;
  for (let k = 27; k >= 0; k--) {
    const d = addDays(now, -k); const s = iso(d);
    if (s < start || !isPlanned(d.getDay())) continue;
    if (s === today && !visits.has(s)) continue;
    planned++; if (visits.has(s)) hit++;
  }
  const pct = planned ? Math.round((hit / planned) * 100) : null;

  // weeks in a row the plan was completed
  let streak = 0;
  for (let w = 0; w < 200; w++) {
    const wsx = addDays(ws, -7 * w);
    if (iso(addDays(wsx, 6)) < start) break;
    const st = weekStats(wsx, visits, start, today);
    if (st.planned === 0) continue;
    if (st.done >= st.planned) streak++;
    else if (w === 0) continue; // current week is still in progress
    else break;
  }

  $('#stats').innerHTML = `
    <div class="stat"><div class="val">${thisWeek.done}/${thisWeek.planned}</div><div class="lbl">Workouts this week</div></div>
    <div class="stat"><div class="val">${monthVisits}</div><div class="lbl">Visits this month</div></div>
    <div class="stat"><div class="val">${pct === null ? '–' : pct + '%'}</div><div class="lbl">Plan followed (4 wks)</div></div>
    <div class="stat"><div class="val">${streak}</div><div class="lbl">Week streak</div></div>
    <div class="stat"><div class="val">${visits.size}</div><div class="lbl">Total visits</div></div>`;

  const first = addDays(ws, -15 * 7);
  let cells = '';
  for (let k = 0; k < 16 * 7; k++) {
    const d = addDays(first, k); const s = iso(d);
    let cls, label;
    if (visits.has(s)) { cls = 'done'; label = 'trained'; }
    else if (s > today) { cls = 'future'; label = 'upcoming'; }
    else if (s < start) { cls = 'before'; label = 'before you started'; }
    else if (isPlanned(d.getDay())) { cls = s === today ? 'future' : 'missed'; label = s === today ? 'planned today' : 'planned, missed'; }
    else { cls = 'rest'; label = 'rest day'; }
    cells += `<i class="cell ${cls} ${s === today ? 'today' : ''}" title="${nice(s)} – ${label}"></i>`;
  }
  $('#heatmap').innerHTML = cells;

  if (!$('#checkin-date').value) $('#checkin-date').value = today;
  const recent = [...state.checkins].sort().reverse().slice(0, 10);
  $('#checkin-list').innerHTML = recent.length
    ? recent.map((d) => `<li><span>${nice(d)}</span><button class="icon" data-del="${d}" title="Delete">✕</button></li>`).join('')
    : '<li class="muted">No manual check-ins yet.</li>';
};

$('#checkin-btn').addEventListener('click', () => {
  const d = $('#checkin-date').value;
  if (!d) return;
  if (d > todayIso()) { toast("You can't check in for the future"); return; }
  state.checkins.push(d);
  if (save()) { toast('Checked in'); renderers.attendance(); }
});
$('#checkin-list').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-del]');
  if (!b) return;
  state.checkins = state.checkins.filter((d) => d !== b.dataset.del);
  save(); renderers.attendance();
});

/* ============ Progress ============ */
const charts = {};
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function makeChart(id, config) {
  charts[id]?.destroy();
  if (typeof Chart === 'undefined') {
    $(`#${id}`).parentElement.innerHTML = '<p class="muted">Charts could not load (no internet?). Your data is safe.</p>';
    return;
  }
  Chart.defaults.color = 'rgba(255,255,255,.78)';
  Chart.defaults.borderColor = 'rgba(255,255,255,.14)';
  Chart.defaults.font.family = 'Lexend, system-ui, sans-serif';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: 'rgba(18,18,20,.92)', borderColor: 'rgba(255,255,255,.15)', borderWidth: 1, cornerRadius: 14, padding: 10, displayColors: false,
    titleFont: { family: 'Lexend', weight: '500' }, bodyFont: { family: 'Lexend' },
  });
  charts[id] = new Chart($(`#${id}`), config);
}

// Chrome gradient (like the 3D metal) for the highlighted bar; scriptable so it follows the chart's size.
const chromeFill = (c) => {
  const { ctx, chartArea } = c.chart;
  if (!chartArea) return '#e9ecef';
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.35, '#cfd4da'); g.addColorStop(.55, '#6b7178'); g.addColorStop(.75, '#b9bfc6'); g.addColorStop(1, '#ffb46e');
  return g;
};
const barFill = (count) => (c) => (c.dataIndex === count - 1 ? chromeFill(c) : 'rgba(255,255,255,.16)');
// Soft white glow under a line, so the line chart has depth.
const areaFill = (c) => {
  const { ctx, chartArea } = c.chart;
  if (!chartArea) return 'transparent';
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  return g;
};

// Shows the value of the last bar in a small dark pill above it (like the glass design).
const lastBarLabel = {
  id: 'lastBarLabel',
  afterDatasetsDraw(chart, args, opts) {
    const meta = chart.getDatasetMeta(0);
    const bar = meta?.data?.at(-1);
    if (!bar || !opts?.text) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = '500 12px Lexend, system-ui';
    const w = ctx.measureText(opts.text).width + 20, h = 24;
    const x = Math.min(Math.max(bar.x - w / 2, 4), chart.width - w - 4), y = bar.y - h - 8;
    ctx.fillStyle = '#f4f1ec';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
    ctx.fillStyle = '#0b0b0c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(opts.text, x + w / 2, y + h / 2);
    ctx.restore();
  },
};

function seriesFor(name) {
  return state.sessions.flatMap((s) => {
    const e = s.entries.find((x) => norm(x.exercise) === norm(name));
    if (!e || !e.sets.length) return [];
    const top = Math.max(...e.sets.map((x) => x.kg));
    const e1rm = Math.max(...e.sets.map((x) => (x.reps > 0 ? x.kg * (1 + x.reps / 30) : 0)));
    const volume = e.sets.reduce((a, x) => a + x.kg * x.reps, 0);
    return [{ date: s.date, top, e1rm: Math.round(e1rm * 10) / 10, volume }];
  });
}

const view = { mode: 'workout', workout: null, exercise: null };
const fmtKg = (n) => `${Math.round(n * 10) / 10} kg`;
const fmtVol = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k kg` : `${Math.round(n)} kg`);

function workoutNames() {
  const fromPlan = ORDER.map((d) => state.schedule[d]).filter((d) => d.exercises.length).map((d) => d.name);
  const fromLog = state.sessions.map((s) => s.dayName).filter(Boolean);
  return [...new Map([...fromPlan, ...fromLog].map((n) => [norm(n), n])).values()];
}
function exerciseNames() {
  return [...new Map(state.sessions.flatMap((s) => s.entries.map((e) => [norm(e.exercise), e.exercise]))).values()].sort();
}
const chipsHtml = (items, active, attr) => items.map((n) => `<button class="chip ${norm(n) === norm(active || '') ? 'active' : ''}" ${attr}="${esc(n)}">${esc(n)}</button>`).join('');

renderers.progress = function renderProgress() {
  document.querySelectorAll('#progress-mode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === view.mode));
  $('#mode-workout').hidden = view.mode !== 'workout';
  $('#mode-exercise').hidden = view.mode !== 'exercise';
  if (view.mode === 'workout') drawWorkout(); else drawExercise();
  drawVisitsChart();
};

$('#progress-mode').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode]');
  if (b) { view.mode = b.dataset.mode; renderers.progress(); }
});
$('#workout-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-workout]');
  if (b) { view.workout = b.dataset.workout; drawWorkout(); }
});
$('#exercise-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-exercise]');
  if (b) { view.exercise = b.dataset.exercise; drawExercise(); }
});
$('#workout-exercises').addEventListener('click', (e) => {
  const b = e.target.closest('[data-exercise]');
  if (b) { view.exercise = b.dataset.exercise; view.mode = 'exercise'; renderers.progress(); window.scrollTo(0, 0); }
});

function drawWorkout() {
  const names = workoutNames();
  if (!names.some((n) => norm(n) === norm(view.workout || ''))) {
    // default: the workout you did most recently
    view.workout = state.sessions.at(-1)?.dayName || names[0] || null;
  }
  $('#workout-chips').innerHTML = chipsHtml(names, view.workout, 'data-workout');

  const sessions = state.sessions.filter((s) => norm(s.dayName || '') === norm(view.workout || ''));
  const vols = sessions.map((s) => s.entries.reduce((a, e) => a + e.sets.reduce((b, x) => b + x.kg * x.reps, 0), 0));
  const box = $('#workout-summary');
  if (!sessions.length) {
    box.innerHTML = `<div class="stat" style="grid-column:1/-1"><div class="lbl">No ${esc(view.workout || '')} workouts saved yet. Log one on the Today tab and your chart starts here.</div></div>`;
    charts['chart-workout']?.destroy();
    $('#workout-exercises').innerHTML = '<p class="muted small">Your exercises show up here after your first workout.</p>';
    return;
  }
  const best = Math.max(...vols);
  const diff = vols.at(-1) - vols[0];
  box.innerHTML = `
    <div class="stat"><div class="val">${sessions.length}</div><div class="lbl">Sessions</div></div>
    <div class="stat"><div class="val">${fmtVol(vols.at(-1))}</div><div class="lbl">Last session</div></div>
    <div class="stat"><div class="val">${fmtVol(best)}</div><div class="lbl">Best session</div></div>
    <div class="stat"><div class="val ${diff > 0 ? 'up' : ''}">${diff > 0 ? '+' : ''}${fmtVol(diff)}</div><div class="lbl">Since first</div></div>`;

  makeChart('chart-workout', {
    type: 'bar',
    data: {
      labels: sessions.map((s) => short(s.date)),
      datasets: [{
        label: 'Volume (kg)', data: vols, borderRadius: 999, borderSkipped: false, maxBarThickness: 26,
        backgroundColor: barFill(vols.length),
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, layout: { padding: { top: 34 } },
      plugins: { legend: { display: false }, lastBarLabel: { text: fmtVol(vols.at(-1)) } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { drawTicks: false }, ticks: { callback: (v) => fmtVol(v) } } },
    },
    plugins: [lastBarLabel],
  });

  // per exercise: first vs latest top set in this workout
  const exNames = [...new Map(sessions.flatMap((s) => s.entries.map((e) => [norm(e.exercise), e.exercise]))).values()];
  $('#workout-exercises').innerHTML = exNames.map((n) => {
    const pts = sessions.flatMap((s) => {
      const e = s.entries.find((x) => norm(x.exercise) === norm(n));
      return e && e.sets.length ? [{ date: s.date, top: Math.max(...e.sets.map((x) => x.kg)), reps: e.sets.find((x) => x.kg === Math.max(...e.sets.map((y) => y.kg))).reps }] : [];
    });
    const first = pts[0], last = pts.at(-1);
    const d = Math.round((last.top - first.top) * 10) / 10;
    return `<button class="ex-item" data-exercise="${esc(n)}">
      <span class="nm">${esc(n)}</span>
      <span class="sub">Last: ${fmtKg(last.top)} × ${last.reps} · ${pts.length} session${pts.length === 1 ? '' : 's'}</span>
      <span class="delta ${d > 0 ? 'pos' : ''}">${d > 0 ? '+' : ''}${fmtKg(d)}</span>
    </button>`;
  }).join('');
}

function drawExercise() {
  const names = exerciseNames();
  if (!names.some((n) => norm(n) === norm(view.exercise || ''))) {
    view.exercise = state.sessions.at(-1)?.entries[0]?.exercise || names[0] || null; // first exercise of your last workout
  }
  $('#exercise-chips').innerHTML = names.length ? chipsHtml(names, view.exercise, 'data-exercise') : '';
  $('#exercise-title').textContent = view.exercise || 'Exercise';
  const data = view.exercise ? seriesFor(view.exercise) : [];
  const box = $('#progress-summary');
  if (!data.length) {
    box.innerHTML = '<div class="stat" style="grid-column:1/-1"><div class="lbl">Save a few workouts and your progress shows up here.</div></div>';
    charts['chart-ex']?.destroy();
    return;
  }
  const first = data[0], last = data.at(-1);
  const pr = data.reduce((a, b) => (b.top > a.top ? b : a));
  const diff = Math.round((last.top - first.top) * 10) / 10;
  box.innerHTML = `
    <div class="stat"><div class="val">${first.top} kg</div><div class="lbl">Start · ${short(first.date)}</div></div>
    <div class="stat"><div class="val">${last.top} kg</div><div class="lbl">Latest · ${short(last.date)}</div></div>
    <div class="stat"><div class="val ${diff > 0 ? 'up' : ''}">${diff > 0 ? '+' : ''}${diff} kg</div><div class="lbl">Progress</div></div>
    <div class="stat"><div class="val">${pr.top} kg</div><div class="lbl">Personal record</div></div>`;

  makeChart('chart-ex', {
    type: 'line',
    data: {
      labels: data.map((d) => short(d.date)),
      datasets: [
        { label: 'Top set (kg)', data: data.map((d) => d.top), borderColor: '#ffffff', backgroundColor: areaFill, pointBackgroundColor: '#ffffff', fill: 'origin', borderWidth: 3, pointRadius: 4, tension: .35 },
        { label: 'Est. 1RM (kg)', data: data.map((d) => d.e1rm), borderColor: cssVar('--ember'), backgroundColor: cssVar('--ember'), borderDash: [5, 4], borderWidth: 2, pointRadius: 3, tension: .35 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: { callbacks: { afterBody: (items) => `Volume: ${data[items[0].dataIndex].volume} kg` } } },
      scales: { x: { grid: { display: false } }, y: { title: { display: true, text: 'kg' } } },
    },
  });
}

function drawVisitsChart() {
  const visits = visitSet();
  const start = startDate();
  const ws = weekStart(new Date());
  const labels = [], done = [], planned = [];
  for (let w = 11; w >= 0; w--) {
    const wsx = addDays(ws, -7 * w);
    const st = weekStats(wsx, visits, start, todayIso());
    let count = 0;
    for (let k = 0; k < 7; k++) if (visits.has(iso(addDays(wsx, k)))) count++;
    labels.push(short(iso(wsx)));
    done.push(count);
    planned.push(st.planned);
  }
  makeChart('chart-visits', {
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Visits', data: done, backgroundColor: barFill(done.length), borderRadius: 999, borderSkipped: false, maxBarThickness: 18 },
        { type: 'line', label: 'Planned', data: planned, borderColor: cssVar('--ember'), borderDash: [4, 4], pointRadius: 0, stepped: 'middle' },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });
}

/* ============ History ============ */
renderers.history = function renderHistory() {
  const items = [...state.sessions].reverse();
  $('#history-list').innerHTML = items.length ? items.map((s) => `
    <div class="card hist">
      <div class="hist-head">
        <div><strong>${nice(s.date)}</strong><div class="muted small">${esc(s.dayName || '')}</div></div>
        <div class="hist-btns">
          <button class="pill" data-edit="${s.date}">Edit</button>
          <button class="icon" data-del="${s.id}" title="Delete">✕</button>
        </div>
      </div>
      <ul>${s.entries.map((e) => `<li><b>${esc(e.exercise)}</b>: ${esc(fmtSets(e.sets))}</li>`).join('')}</ul>
      ${s.note ? `<p class="muted small">Note: ${esc(s.note)}</p>` : ''}
    </div>`).join('') : '<div class="card muted">No workouts saved yet. Go to “Today” to log your first one.</div>';
};
$('#history-list').addEventListener('click', (e) => {
  const ed = e.target.closest('button[data-edit]');
  const del = e.target.closest('button[data-del]');
  if (ed) { draft = { date: ed.dataset.edit }; showTab('today'); }
  if (del && confirm('Delete this workout?')) {
    state.sessions = state.sessions.filter((s) => s.id !== del.dataset.del);
    save(); renderers.history();
  }
});

/* ============ Settings ============ */
$('#export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gym-backup-${todayIso()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.schedule || !Array.isArray(data.sessions)) throw new Error('invalid');
    if (!confirm(`Restore this backup? It replaces your current data (${data.sessions.length} workouts in the backup).`)) return;
    state = { ...defaultState(), ...data };
    migrate(state);
    save(); toast('Backup restored'); draft = null; showTab('today');
  } catch { toast('This file is not a valid backup'); }
  e.target.value = '';
});
$('#reset-btn').addEventListener('click', () => {
  if (!confirm('Are you sure? All workouts, check-ins and your plan will be erased.')) return;
  if (!confirm('Really sure? This cannot be undone (unless you have a backup).')) return;
  state = defaultState(); save(); clearDraft(); stopRest(); draft = null; toast('Everything erased'); showTab('today');
});

renderers.settings = () => {
  $('#set-sound').checked = !!state.settings.sound;
  $('#set-vibrate').checked = !!state.settings.vibrate;
};
$('#set-sound').addEventListener('change', (e) => { state.settings.sound = e.target.checked; save(); if (e.target.checked) { unlockAudio(); beep(); } });
$('#set-vibrate').addEventListener('change', (e) => { state.settings.vibrate = e.target.checked; save(); if (e.target.checked && navigator.vibrate) navigator.vibrate(200); });

/* ============ Offline / installable app ============ */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* works fine without it */ });
}

/* ============ Start ============ */
showTab('today');
