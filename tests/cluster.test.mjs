// 話者分けの「似た声をまとめる」部分のテスト。index.html の CLUSTER-BEGIN〜END を取り出して動かす
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = html.split('/*CLUSTER-BEGIN*/')[1].split('/*CLUSTER-END*/')[0];
const { clusterVecs, assignSpeakers, localSpk } = new Function(src + 'return { clusterVecs, assignSpeakers, localSpk };')();

// 乱数の種を固定して、話者ごとの「声の特徴」の中心のまわりにばらつかせる
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
const D = 256, centers = [0, 1, 2, 3, 4].map(() => Array.from({ length: D }, rnd));
const voice = (k, noise = 0.6) => Float32Array.from(centers[k], c => c + rnd() * noise);

let ok = 0;
function t(name, fn) { fn(); ok++; console.log('ok', name); }

t('4人の声を、録音全体で同じ人にまとめられる（3人の上限がない）', () => {
  const truth = [0, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 0, 0, 0, 2];
  const lab = clusterVecs(truth.map(k => voice(k)), 4, 0.3);
  const map = new Map(); truth.forEach((k, i) => { if (!map.has(k)) map.set(k, lab[i]); assert.equal(lab[i], map.get(k)); });
  assert.equal(new Set(lab).size, 4);
});
t('参加者の人数より多くは分けない', () => {
  const lab = clusterVecs([0, 1, 2, 3, 4, 0, 1].map(k => voice(k)), 3, 0.99);
  assert.ok(new Set(lab).size <= 3);
});
t('人数の上限より実際に話した人が少なければ、少ないまま', () => {
  const lab = clusterVecs([0, 1, 0, 1, 0, 1].map(k => voice(k)), 5, 0.3);
  assert.equal(new Set(lab).size, 2);
});
t('話した順に 0,1,2… と番号が付く', () => {
  assert.deepEqual(clusterVecs([2, 0, 2, 1].map(k => voice(k)), 3, 0.3), [0, 1, 0, 2]);
});
t('特徴が取れない短い声は、時間が近いまとまりと同じ人', () => {
  const units = [{ t: 0, vec: voice(0) }, { t: 10, vec: voice(1) }, { t: 11, vec: null }, { t: 20, vec: voice(0) }];
  assert.deepEqual(assignSpeakers(units, 2, 0.3), [0, 1, 1, 0]);
});
t('特徴が一つも取れなくても止まらない', () => {
  assert.deepEqual(assignSpeakers([{ t: 0, vec: null }], 2, 0.3), [0]);
  assert.deepEqual(clusterVecs([], 2, 0.3), []);
});
t('区切り用AIの番号 → 10秒の中の話者', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(localSpk), [0, 1, 2, 3, 1, 1, 2]);
});
t('500個のまとまり（約30分ぶん）でも数秒で終わる', () => {
  const t0 = Date.now(); clusterVecs(Array.from({ length: 500 }, (_, i) => voice(i % 4)), 4, 0.3);
  assert.ok(Date.now() - t0 < 5000, (Date.now() - t0) + 'ms');
});
console.log(ok + ' tests passed');
