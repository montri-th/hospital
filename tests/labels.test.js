import test from 'node:test';
import assert from 'node:assert/strict';
import {rankLabelCandidates, shortName, labelParts, centreCandidates, placeLabels, LABEL_MIN_ZOOM, LABEL_MAX} from '../js/labels.js';
import {importanceScores} from '../js/model.js';

// Carried over from CityMETER · Hotel 0.2.0 (owner 2026-11-01, point 5): names near the middle of the view, most
// important first, short (icons before words), never covering the chrome or each other.
test('labels: importance first, then nearness to the centre; stable', () => {
  const c = [{row: {id: 'b', importance: 0.5}, d: 0.1}, {row: {id: 'a', importance: 0.9}, d: 0.9}, {row: {id: 'c', importance: 0.5}, d: 0.05}];
  assert.deepEqual(rankLabelCandidates(c).map(x => x.row.id), ['a', 'c', 'b']);
  assert.ok(LABEL_MIN_ZOOM >= 12 && LABEL_MAX.phone < LABEL_MAX.desktop);
});

test('importance: a hospital with beds and published accreditation reads before a clinic of the same place; unknown beds are never guessed', () => {
  const rows = [
    {id: 'clinic', beds: 0, jci: []},
    {id: 'rpst', beds: null, jci: []},
    {id: 'community', beds: 30, jci: []},
    {id: 'regional', beds: 600, ha: {id: 'ha_advanced'}, jci: []},
  ];
  const s = importanceScores(rows);
  assert.ok(s[3] > s[2] && s[2] > s[0] && s[0] >= s[1]);
  assert.equal(s[1], 0, 'unknown beds: no share, no step');
});

test('short names: the everyday abbreviations of the type words; the place stays (a hospital is often named by it)', () => {
  assert.equal(shortName({name: 'โรงพยาบาลมหาราชนครเชียงใหม่'}), 'รพ.มหาราชนครเชียงใหม่');
  assert.equal(shortName({name: 'โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านหนองบัว'}), 'รพ.สต.บ้านหนองบัว');
  assert.equal(shortName({name: 'ศูนย์บริการสาธารณสุข 9 ประชาธิปไตย'}), 'ศบส.9 ประชาธิปไตย');
  assert.equal(shortName({name: 'ศูนย์สุขภาพชุมชนเมือง'}), 'ศสม.เมือง');
  assert.equal(shortName({name: 'คลินิกเวชกรรมสุขใจ'}), 'คลินิกเวชกรรมสุขใจ', 'other names read as written');
  assert.equal(shortName({name: 'โรงพยาบาล'}), 'โรงพยาบาล', 'never shorter than 3 characters: the full name stays');
});

test('label text: one short name and the reported beds (none when 0 or unknown)', () => {
  assert.deepEqual(labelParts({name: 'โรงพยาบาลศิริราช', beds: 2219}), {name: 'รพ.ศิริราช', beds: 2219});
  assert.deepEqual(labelParts({name: 'โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านนา', beds: 0}), {name: 'รพ.สต.บ้านนา', beds: null});
  assert.deepEqual(labelParts({name: 'คลินิกหมอใจดี', beds: null}), {name: 'คลินิกหมอใจดี', beds: null});
});

test('candidates come from the central ellipse only; placement avoids blockers and other labels and respects the cap', () => {
  const rows = Array.from({length: 30}, (_, i) => ({id: `h${i}`, longitude: i, latitude: 0, importance: 1 - i / 30}));
  const box = {left: 0, right: 1000, top: 0, bottom: 600};
  const project = ([x]) => ({x: 100 + x * 30, y: 300});
  const cands = centreCandidates(rows, project, box, {skip: 'h3'});
  assert.ok(cands.every(c => Math.abs(c.x - 500) <= 360) && !cands.some(c => c.row.id === 'h3'));
  const blockers = [{left: 380, right: 520, top: 0, bottom: 600}];
  const placed = placeLabels(rankLabelCandidates(cands), () => ({w: 80, h: 20}), () => 5, box, {max: 4, blockers});
  assert.ok(placed.length <= 4);
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  for (const p of placed) assert.ok(!blockers.some(b => overlaps(p.box, b)), 'never on the chrome');
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) assert.ok(!overlaps(placed[i].box, placed[j].box), 'never on another label');
});

test('the real register: Siriraj labels as รพ.ศิริราช with its beds', async () => {
  const {load} = await import('./helpers.js');
  const {data} = load();
  const siriraj = data.rows.filter(r => /^โรงพยาบาลศิริราช$/.test(r.name));
  assert.ok(siriraj.length >= 1);
  for (const r of siriraj) assert.equal(labelParts(r).name, 'รพ.ศิริราช');
});
