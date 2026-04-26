/**
 * FoodTI 自检脚本
 * ---------------------------------------------------------------------------
 * 运行:cd /Users/leo/Desktop/FoodTI && node scripts/test-classifier.js
 *
 * 三件事必须全过:
 *   ① 16 格可达性 — 每个 MBTI 都能由某组合法答案得到对应食物
 *   ② 零平局验证 — 暴力枚举所有 2^16 = 65536 种二选一组合,
 *                   classify 永远返回长度为 4 的 mbti、confidences 永不含 0
 *   ③ 数据完整性 — questions.json 满足 schema 强约束、
 *                   foods.json 16 条记录的 mbti 字段恰好覆盖 16 个排列
 * ---------------------------------------------------------------------------
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { classify, __internals } from '../lib/classifier.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const questions = JSON.parse(readFileSync(resolve(ROOT, 'data/questions.json'), 'utf8'));
const foods = JSON.parse(readFileSync(resolve(ROOT, 'data/foods.json'), 'utf8'));

let pass = 0;
let fail = 0;
const failures = [];

function expect(name, cond, detail = '') {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

// ---------------------------------------------------------------------------
// 0. Schema 自检 — questions.json
// ---------------------------------------------------------------------------
expect('questions.json 共 16 题', questions.length === 16, `actual=${questions.length}`);

const dimCount = { EI: 0, SN: 0, TF: 0, JP: 0 };
const dimWeights = { EI: [], SN: [], TF: [], JP: [] };
const dimTrumps = { EI: 0, SN: 0, TF: 0, JP: 0 };

for (const q of questions) {
  expect(`Q${q.id} dim 合法`, ['EI', 'SN', 'TF', 'JP'].includes(q.dim), `dim=${q.dim}`);
  expect(`Q${q.id} weight ∈ {1,2}`, q.weight === 1 || q.weight === 2, `w=${q.weight}`);
  expect(`Q${q.id} trump 一致`, q.trump === (q.weight === 2), `trump=${q.trump} w=${q.weight}`);
  expect(`Q${q.id} 选项 2 个`, q.options.length === 2, `len=${q.options.length}`);

  const [a, b] = q.options;
  const expected = __internals.POLES[q.dim];
  expect(
    `Q${q.id} 两选项字母正交`,
    expected && expected.includes(a.letter) && expected.includes(b.letter) && a.letter !== b.letter,
    `letters=${a.letter}/${b.letter} expected=${expected?.join('/')}`
  );

  dimCount[q.dim]++;
  dimWeights[q.dim].push(q.weight);
  if (q.trump) dimTrumps[q.dim]++;
}

for (const d of ['EI', 'SN', 'TF', 'JP']) {
  expect(`${d} 维度 4 题`, dimCount[d] === 4, `count=${dimCount[d]}`);
  expect(`${d} 维度恰好 1 道 trump`, dimTrumps[d] === 1, `trumps=${dimTrumps[d]}`);
  const sorted = dimWeights[d].slice().sort();
  const ok = sorted.length === 4 && sorted[0] === 1 && sorted[1] === 1 && sorted[2] === 1 && sorted[3] === 2;
  expect(`${d} 维度权重组合 = [1,1,1,2]`, ok, `actual=[${sorted.join(',')}]`);
}

// ---------------------------------------------------------------------------
// 1. Schema 自检 — foods.json
// ---------------------------------------------------------------------------
expect('foods.json 共 16 条', foods.length === 16, `actual=${foods.length}`);

const allMbti = [
  'ENFP', 'ENTP', 'ESFP', 'ESTP',
  'ENFJ', 'ENTJ', 'ESFJ', 'ESTJ',
  'INFP', 'INTP', 'ISFP', 'ISTP',
  'INFJ', 'INTJ', 'ISFJ', 'ISTJ',
];

const foodMbti = new Set(foods.map((f) => f.mbti));
expect('foods.json 包含 16 个不重复 mbti', foodMbti.size === 16, `unique=${foodMbti.size}`);
for (const m of allMbti) {
  expect(`foods.json 含 ${m}`, foodMbti.has(m));
}

const ids = new Set(foods.map((f) => f.id));
expect('foods.json id 全部唯一', ids.size === 16, `unique=${ids.size}`);

const requiredFields = [
  'id', 'mbti', 'name_zh', 'name_en', 'title', 'subtitle', 'image',
  'tagline', 'flavor_keywords', 'alternates', 'taste_signature',
  'monologue', 'quick_review', 'interpretation',
  'bright_side', 'shadow_side', 'best_pair', 'watch_pair', 'scene',
];
for (const f of foods) {
  for (const field of requiredFields) {
    expect(`food[${f.id}] 含 ${field}`, f[field] !== undefined && f[field] !== null);
  }
  expect(`food[${f.id}].alternates ≥ 1`, Array.isArray(f.alternates) && f.alternates.length >= 1);
  expect(`food[${f.id}].flavor_keywords ≥ 1`, Array.isArray(f.flavor_keywords) && f.flavor_keywords.length >= 1);
}

// ---------------------------------------------------------------------------
// 2. 16 格可达性 — 构造每个 MBTI 的「全选该字母」答案,验证返回正确食物
// ---------------------------------------------------------------------------
function buildAnswersForMbti(mbti) {
  // mbti 形如 'ENFP'
  const dimLetterMap = { EI: mbti[0], SN: mbti[1], TF: mbti[2], JP: mbti[3] };
  return questions.map((q) => ({
    id: q.id,
    dim: q.dim,
    weight: q.weight,
    letter: dimLetterMap[q.dim],
  }));
}

for (const m of allMbti) {
  const answers = buildAnswersForMbti(m);
  const result = classify(answers, foods);
  const expectedFood = foods.find((f) => f.mbti === m);
  expect(
    `${m} → ${expectedFood.name_zh}(${expectedFood.id})`,
    result.mbti === m && result.food_id === expectedFood.id,
    `got mbti=${result.mbti} food=${result.food_id}`
  );
}

// ---------------------------------------------------------------------------
// 3. 零平局验证 — 暴力 65536 答案组合
// ---------------------------------------------------------------------------
const total = 1 << 16; // 65536
let tieCount = 0;
let badMbtiCount = 0;
let badFoodCount = 0;

const dimsByQ = questions.map((q) => q.dim);
const polesByQ = questions.map((q) => __internals.POLES[q.dim]);
const weightsByQ = questions.map((q) => q.weight);
const idsByQ = questions.map((q) => q.id);

for (let mask = 0; mask < total; mask++) {
  const answers = new Array(16);
  for (let i = 0; i < 16; i++) {
    const pickIdx = (mask >> i) & 1; // 0 → poles[0], 1 → poles[1]
    answers[i] = {
      id: idsByQ[i],
      dim: dimsByQ[i],
      weight: weightsByQ[i],
      letter: polesByQ[i][pickIdx],
    };
  }
  let r;
  try {
    r = classify(answers, foods);
  } catch (e) {
    badMbtiCount++;
    continue;
  }
  if (r.mbti.length !== 4) badMbtiCount++;
  if (!foodMbti.has(r.mbti)) badFoodCount++;
  for (const v of Object.values(r.confidences)) {
    if (v === 0) {
      tieCount++;
      break;
    }
  }
}

expect(`65536 种作答组合零平局`, tieCount === 0, `ties=${tieCount}`);
expect(`65536 种作答组合 mbti 长度均为 4`, badMbtiCount === 0, `bad=${badMbtiCount}`);
expect(`65536 种作答组合食物均可命中`, badFoodCount === 0, `bad=${badFoodCount}`);

// ---------------------------------------------------------------------------
// 4. 演示样本 — 全选 A(选项数组下标 0)
// ---------------------------------------------------------------------------
const allFirstAnswers = questions.map((q) => ({
  id: q.id,
  dim: q.dim,
  weight: q.weight,
  letter: q.options[0].letter,
}));
const sample = classify(allFirstAnswers, foods);
const sampleFood = foods.find((f) => f.id === sample.food_id);

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------
console.log('\nFoodTI 自检报告');
console.log('============================================================');
console.log(`通过 ${pass} / 失败 ${fail}`);
if (failures.length) {
  console.log('\n失败明细:');
  for (const f of failures) console.log(f);
}

console.log('\n演示样本(全部选 A):');
console.log(`  内部 MBTI:${sample.mbti}`);
console.log(`  匹配食物:${sampleFood.name_zh}(${sample.food_id})`);
console.log(`  置信度:  ${JSON.stringify(sample.confidences)}`);
console.log('============================================================');

if (fail > 0) {
  process.exit(1);
}
console.log('\n✓ 16/16 MBTI types reachable');
console.log('✓ 0 ties across 65536 answer permutations');
console.log('✓ foods.json covers all 16 MBTI cells exactly once');
console.log('✓ questions.json schema valid');
