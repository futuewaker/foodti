/**
 * FoodTI 匹配算法
 * ----------------------------------------------------------------------------
 * 把用户的 16 个回答映射到 16 个食物之一,内部走 MBTI 4 维度,但对前端隐藏。
 *
 * 设计要点:
 *
 *   1. 唯一性保证 — 题库 schema 强制约束:
 *        - 4 维度(EI / SN / TF / JP),每维 4 题
 *        - 每维 4 题的权重组合固定为 (2, 1, 1, 1)
 *        - 每题二选一,选项为该维度的两端字母之一
 *      数学上每维总分差 ∈ {±1, ±3, ±5},零分不可达 ⇒ 字母必然唯一确定。
 *
 *   2. MBTI 吻合 — foods.json 16 条记录的 mbti 字段覆盖 16 个排列(无重无缺),
 *      classifier 用 4 字母拼出的字符串严格 lookup,得到唯一 food。
 *
 *   3. 置信度 — 不参与分类,仅作为前端「备选食物提示」开关:
 *        - confidence === 0.2 时(±1 分),前端可在结果页底部追加
 *          「也有点像 [alternates[0]]」的软提示
 *        - 不在算法层做任何二级类型混合,保持 1:1 强映射
 *
 *   4. 确定性 — 同一份答案永远得到同一个食物,无随机数、无时间依赖。
 *
 *   5. 隐藏 MBTI — classify() 返回值里的 mbti 字段供前端调试,但渲染层
 *      只读 food_id → 查 foods.json → 渲染 name_zh / monologue / ...,
 *      mbti 字符串永远不进 DOM。
 * ----------------------------------------------------------------------------
 */

const POLES = {
  EI: ['E', 'I'],
  SN: ['S', 'N'],
  TF: ['T', 'F'],
  JP: ['J', 'P'],
};

const DIMS = ['EI', 'SN', 'TF', 'JP'];

/**
 * 主分类函数
 *
 * @param {Array} answers — 用户作答数组,每项形如:
 *   {
 *     id: 1,            // 题目 id
 *     dim: 'EI',        // 题目维度
 *     weight: 2,        // 1 或 2
 *     letter: 'E'       // 用户选中那一项的字母,∈ {E,I,S,N,T,F,J,P}
 *   }
 *
 * @param {Array} foods — foods.json 加载后的数组
 *
 * @returns {{
 *   mbti: string,             // 4 字母 MBTI 字符串(前端不要渲染)
 *   food_id: string,          // foods.json 中匹配到的 food.id
 *   confidences: {
 *     EI: number,             // ∈ {0.2, 0.6, 1.0}
 *     SN: number,
 *     TF: number,
 *     JP: number,
 *   }
 * }}
 *
 * @throws Error — 当 answers 不满足 schema 约束(数量、维度、权重)时抛出
 */
export function classify(answers, foods) {
  validateAnswers(answers);

  const score = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
  for (const a of answers) {
    score[a.letter] += a.weight;
  }

  const letters = DIMS.map((dim) => {
    const [p, q] = POLES[dim];
    return score[p] > score[q] ? p : q;
  });
  const mbti = letters.join('');

  const confidences = {};
  for (const dim of DIMS) {
    const [p, q] = POLES[dim];
    confidences[dim] = Math.abs(score[p] - score[q]) / 5;
  }

  const food = foods.find((f) => f.mbti === mbti);
  if (!food) {
    throw new Error(`FoodTI: foods.json missing entry for MBTI=${mbti}`);
  }

  return { mbti, food_id: food.id, confidences };
}

/**
 * 校验 answers 满足题库 schema 的强约束。
 * 在前端正常流程下不可能不满足,这里是兜底防御。
 */
function validateAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== 16) {
    throw new Error(`FoodTI: expected 16 answers, got ${answers?.length}`);
  }

  const perDimWeights = { EI: [], SN: [], TF: [], JP: [] };
  for (const a of answers) {
    if (!POLES[a.dim]) throw new Error(`FoodTI: bad dim ${a.dim}`);
    if (a.weight !== 1 && a.weight !== 2) {
      throw new Error(`FoodTI: weight must be 1 or 2, got ${a.weight}`);
    }
    if (!POLES[a.dim].includes(a.letter)) {
      throw new Error(`FoodTI: letter ${a.letter} not in dim ${a.dim}`);
    }
    perDimWeights[a.dim].push(a.weight);
  }

  for (const dim of DIMS) {
    const ws = perDimWeights[dim].slice().sort((x, y) => x - y);
    if (ws.length !== 4 || ws[0] !== 1 || ws[1] !== 1 || ws[2] !== 1 || ws[3] !== 2) {
      throw new Error(
        `FoodTI: dim ${dim} weights must be [1,1,1,2], got [${ws.join(',')}]`
      );
    }
  }
}

/**
 * 给前端用的辅助:把 classify 结果 + foods.json 渲染为「展示对象」,
 * 自动剥离 mbti 字段、自动按低置信度补 alternates 提示。
 *
 * @returns {{
 *   food: object,                      // foods.json 中的完整 food 对象
 *   alternate_hint: string | null,    // 如有低置信维度,返回一条软提示文案;否则 null
 *   confidences: object,
 * }}
 */
export function toViewModel(result, foods) {
  const food = foods.find((f) => f.id === result.food_id);
  if (!food) throw new Error(`FoodTI: food not found ${result.food_id}`);

  const lowDims = Object.entries(result.confidences)
    .filter(([, v]) => v <= 0.2)
    .map(([d]) => d);

  let alternate_hint = null;
  if (lowDims.length > 0 && food.alternates && food.alternates.length > 0) {
    alternate_hint = `这次的判定有些模糊,你也有点像「${food.alternates[0]}」`;
  }

  return {
    food,
    alternate_hint,
    confidences: result.confidences,
  };
}

export const __internals = { POLES, DIMS, validateAnswers };
