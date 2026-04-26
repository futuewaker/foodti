/**
 * FoodTI · 32-人格模拟测试(对抗式准确率回归)
 * ----------------------------------------------------------------------------
 * 跑法:cd /Users/leo/Desktop/FoodTI && node scripts/test-personas.mjs
 *
 * 思路:
 *   - 16 个 MBTI × 2 个不同背景 personas = 32 名虚拟用户
 *   - 真诚用户模型:trump (w=2) 99% 对齐自己 MBTI 字母,regular (w=1) 95%
 *   - 模拟答题 → 跑 classifier → 看返回的 MBTI 是否吻合 persona 自报 MBTI
 *
 * 准确性判定:
 *   - EXACT          : 4 字母全对                                → "用户感觉准"
 *   - BORDERLINE-OK  : 1 字母偏 + 那一维度 confidence ≤ 0.2     → "用户也感觉准"(alt-hint 提示)
 *   - INACCURATE-CONFIDENT : 1 字母偏 + 高置信度                 → "用户感觉不准"
 *   - INACCURATE-MULTI     : 2+ 字母偏                          → "用户感觉不准"
 *
 * 通过条件:EXACT + BORDERLINE-OK ≥ 28/32
 *
 * 历史结果:
 *   2026-04-26 v4 题库 + (2,1,1,1) 算法 → 32/32 PASS
 *
 * 这个脚本作为永久回归测试存在。题库或算法改动后,跑一遍验证还能 28+/32。
 * ----------------------------------------------------------------------------
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '../lib/classifier.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const questions = JSON.parse(readFileSync(resolve(ROOT, 'data/questions.json'), 'utf8'));
const foods     = JSON.parse(readFileSync(resolve(ROOT, 'data/foods.json'),     'utf8'));

const PERSONAS = [
  { name: '林星辰', mbti: 'ENFP', seed: 1001, bio: '大三传媒 · 小红书穿搭博主' },
  { name: '苏小满', mbti: 'ENFP', seed: 1002, bio: '大一心理 · 即兴喜剧社' },
  { name: '陆知夏', mbti: 'ENTP', seed: 2001, bio: '大二计算机 · 辩论队' },
  { name: '何予安', mbti: 'ENTP', seed: 2002, bio: '大四市场营销 · 创业大赛' },
  { name: '周阿沅', mbti: 'ESFP', seed: 3001, bio: '大二舞蹈 · 街舞社' },
  { name: '黎一一', mbti: 'ESFP', seed: 3002, bio: '大一新闻 · B 站 Vlog' },
  { name: '高赤朱', mbti: 'ESTP', seed: 4001, bio: '大三体育 · 女篮' },
  { name: '骆星禾', mbti: 'ESTP', seed: 4002, bio: '大四酒店管理 · 极限挑战' },
  { name: '温绾绾', mbti: 'ENFJ', seed: 5001, bio: '大三教心 · 志愿者会长' },
  { name: '宋之卿', mbti: 'ENFJ', seed: 5002, bio: '大二英语 · 模联秘书长' },
  { name: '齐书燃', mbti: 'ENTJ', seed: 6001, bio: '大四金融 · 投资协会主席' },
  { name: '陶以衡', mbti: 'ENTJ', seed: 6002, bio: '大三法学 · 辩论队长' },
  { name: '叶奶团', mbti: 'ESFJ', seed: 7001, bio: '大二护理 · 班委' },
  { name: '严宛宛', mbti: 'ESFJ', seed: 7002, bio: '大三汉语言 · 学生会副主席' },
  { name: '万斯予', mbti: 'ESTJ', seed: 8001, bio: '大四工管 · 学生会主席' },
  { name: '岑朔',   mbti: 'ESTJ', seed: 8002, bio: '大二会计 · 社团财务' },
  { name: '柳青柠', mbti: 'INFP', seed: 9001, bio: '大三汉语言 · 豆瓣电影党' },
  { name: '殷无漾', mbti: 'INFP', seed: 9002, bio: '大一心理 · 独立音乐人' },
  { name: '应南叙', mbti: 'INTP', seed: 10001, bio: '大三数学 · 维基百科党' },
  { name: '颜泠',   mbti: 'INTP', seed: 10002, bio: '大二物理 · 科研助理' },
  { name: '俞拾寒', mbti: 'ISFP', seed: 11001, bio: '大二视觉传达 · 胶片摄影' },
  { name: '苗忱忱', mbti: 'ISFP', seed: 11002, bio: '大三动画 · 手账博主' },
  { name: '夏砚白', mbti: 'ISTP', seed: 12001, bio: '大四机械 · 女子赛车社' },
  { name: '谢竹',   mbti: 'ISTP', seed: 12002, bio: '大三建筑 · 木工坊' },
  { name: '宋知意', mbti: 'INFJ', seed: 13001, bio: '大四社会学 · 独立写作' },
  { name: '艾岑漫', mbti: 'INFJ', seed: 13002, bio: '大三哲学 · 豆瓣长评博主' },
  { name: '伍执砚', mbti: 'INTJ', seed: 14001, bio: '大四 CS · LeetCode 周赛' },
  { name: '卢辰汐', mbti: 'INTJ', seed: 14002, bio: '大三经济 · 行研实习生' },
  { name: '童鹿鸣', mbti: 'ISFJ', seed: 15001, bio: '大二学前 · 儿童剧志愿者' },
  { name: '苏稚衿', mbti: 'ISFJ', seed: 15002, bio: '大四护理 · 养老志愿者' },
  { name: '宁砚池', mbti: 'ISTJ', seed: 16001, bio: '大三会计 · 注会备考' },
  { name: '霍以宁', mbti: 'ISTJ', seed: 16002, bio: '大四临床医学' },
];

// Mulberry32 deterministic RNG
function mkRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 真诚用户模型:trump (w=2) 99%,regular (w=1) 95%
function simulateAnswers(persona) {
  const rng = mkRng(persona.seed);
  const dimLetterMap = {
    EI: persona.mbti[0], SN: persona.mbti[1],
    TF: persona.mbti[2], JP: persona.mbti[3],
  };
  return questions.map((q) => {
    const targetLetter = dimLetterMap[q.dim];
    const otherLetter = q.options.find((o) => o.letter !== targetLetter)?.letter;
    const alignProb = q.weight === 2 ? 0.99 : 0.95;
    const align = rng() < alignProb;
    const wantedLetter = align ? targetLetter : (otherLetter ?? targetLetter);
    const matching = q.options.filter((o) => o.letter === wantedLetter);
    const pick = matching.length > 0
      ? matching[Math.floor(rng() * matching.length)]
      : q.options[0];
    return { id: q.id, dim: q.dim, weight: q.weight, letter: pick.letter };
  });
}

const DIMS = ['EI', 'SN', 'TF', 'JP'];

const results = PERSONAS.map((p) => {
  const answers = simulateAnswers(p);
  const r = classify(answers, foods);
  const exact = r.mbti === p.mbti;
  const lettersDiff = [...r.mbti].filter((c, i) => c !== p.mbti[i]).length;
  const flippedDim = DIMS.find((_d, i) => r.mbti[i] !== p.mbti[i]) || null;

  let verdict;
  if (exact) verdict = 'EXACT';
  else if (lettersDiff === 1 && r.confidences[flippedDim] <= 0.2) verdict = 'BORDERLINE-OK';
  else if (lettersDiff === 1) verdict = 'INACCURATE-CONFIDENT';
  else verdict = 'INACCURATE-MULTI';

  return { ...p, got: r.mbti, lettersDiff, flippedDim,
    flippedConf: flippedDim ? r.confidences[flippedDim] : null,
    food: r.food_id, verdict };
});

const counts = { EXACT: 0, 'BORDERLINE-OK': 0, 'INACCURATE-CONFIDENT': 0, 'INACCURATE-MULTI': 0 };
for (const r of results) counts[r.verdict]++;
const accurate = counts.EXACT + counts['BORDERLINE-OK'];
const PASS_THRESHOLD = 28;
const pass = accurate >= PASS_THRESHOLD;

console.log('\nFoodTI · 32-人格对抗式准确率测试');
console.log('============================================================');
for (const r of results) {
  const tag = r.verdict === 'EXACT' ? '✓' :
              r.verdict === 'BORDERLINE-OK' ? '~' : '✗';
  const detail = r.lettersDiff === 0
    ? `→ ${r.food}`
    : `→ got ${r.got} (${r.flippedDim} flip, conf ${r.flippedConf})`;
  console.log(`  ${tag} ${r.name.padEnd(4, ' ')} (${r.bio.padEnd(20, ' ')}) ${r.mbti} ${detail}`);
}
console.log('============================================================');
console.log(`EXACT          : ${counts.EXACT} / 32`);
console.log(`BORDERLINE-OK  : ${counts['BORDERLINE-OK']} / 32`);
console.log(`INACCURATE     : ${counts['INACCURATE-CONFIDENT'] + counts['INACCURATE-MULTI']} / 32`);
console.log(`accurate total : ${accurate} / 32   (threshold ${PASS_THRESHOLD})`);
console.log(`VERDICT        : ${pass ? '✓ PASS' : '✗ FAIL'}`);

if (!pass) process.exit(1);
