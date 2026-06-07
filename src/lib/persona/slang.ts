/**
 * =============================================================================
 * Nexus Hub — 国际高中生 黑话字典 & 痛点词库
 * =============================================================================
 *
 * 持续更新日期: 2026-06-07
 * 使用方法: 在 Newton / Flora 的 System Prompt 中注入相关模块
 *
 * 设计原则:
 *   - 黑话必须真实、准确、不过时
 *   - 按场景分类，方便按需注入
 *   - 每季度从 n8n 抓取小红书/知乎热帖来更新
 */

// ── Type ──────────────────────────────────────────────────

export interface SlangEntry {
  term: string
  pinyin?: string
  meaning: string
  usage: string
  tone: 'positive' | 'negative' | 'neutral' | 'humorous'
}

export interface PainPoint {
  topic: string
  description: string
  typicalEmotion: string
  targetGrade: string
}

// ═══════════════════════════════════════════════════════════
//  卷一：学术黑话 (Academic Slang)
// ═══════════════════════════════════════════════════════════

export const ACADEMIC_SLANG: SlangEntry[] = [
  {
    term: '裱花',
    meaning: '标化成绩（托福/雅思/SAT/ACT 统称），"裱"谐音"标"',
    usage: '"裱花还没出分，不敢申ED"',
    tone: 'neutral',
  },
  {
    term: '杀托 / 屠鸭',
    meaning: '考托福（杀托）/ 考雅思（屠鸭）',
    usage: '"暑假不回国了，留在村里杀托"',
    tone: 'humorous',
  },
  {
    term: '裱花刺客',
    meaning: '标化考试突然变难或压分的情况',
    usage: '"这次SAT真是裱花刺客，curve离谱"',
    tone: 'negative',
  },
  {
    term: '脆录 / 脆拒',
    meaning: '申请季被秒录取 / 秒拒绝',
    usage: '"ED被梦校脆录了！"',
    tone: 'positive',
  },
  {
    term: '全聚德',
    meaning: '全拒得（所有申请都被拒了），谐音北京烤鸭店名',
    usage: '"RD轮全聚德，只能Gap了"',
    tone: 'negative',
  },
  {
    term: '刮彩票',
    meaning: '申请录取率极低的学校，像是买彩票碰运气',
    usage: '"反正RD多申几所，就当刮彩票"',
    tone: 'humorous',
  },
  {
    term: '翠菊',
    meaning: '脆拒（谐音"翠菊"），被秒拒',
    usage: '"斯坦福直接把我翠菊了"',
    tone: 'negative',
  },
  {
    term: 'Waitlist地狱',
    meaning: '被多所学校放入候补名单，煎熬等待',
    usage: '"五个WL，人在Waitlist地狱"',
    tone: 'negative',
  },
  {
    term: '裱花卷王',
    meaning: '标化成绩卷到极高（比如SAT 1580+还在刷）',
    usage: '"现在SAT 1550都成裱花卷王的入门线了"',
    tone: 'humorous',
  },
  {
    term: '保底 / 匹配 / 冲刺',
    meaning: '申请策略三档：Safety / Match / Reach',
    usage: '"保底UIUC匹配UCLA冲刺Stanford"',
    tone: 'neutral',
  },
  {
    term: 'Gap Year',
    meaning: '间隔年，通常指被全拒或主动休学一年',
    usage: '"全聚德之后决定Gap一年重新申"',
    tone: 'neutral',
  },
  {
    term: '裱花自由',
    meaning: '标化成绩已经达到目标，不再需要刷分',
    usage: '"托福110+SAT1550，我终于裱花自由了"',
    tone: 'positive',
  },
]

// ═══════════════════════════════════════════════════════════
//  卷二：竞赛/学术暗语 (Competition Lingo)
// ═══════════════════════════════════════════════════════════

export const COMPETITION_SLANG: SlangEntry[] = [
  {
    term: '冲金',
    meaning: '在竞赛中冲刺金牌/金奖',
    usage: '"BPhO这轮目标是冲金"',
    tone: 'positive',
  },
  {
    term: '刷真题',
    meaning: '大量做历年真题来备考',
    usage: '"考前一个月就是每天刷真题"',
    tone: 'neutral',
  },
  {
    term: '爆零',
    meaning: '竞赛得分极低甚至 0 分',
    usage: '"AMC12直接爆零，太打击人了"',
    tone: 'negative',
  },
  {
    term: '玄学curve',
    meaning: '竞赛评分曲线难以预测，靠运气',
    usage: '"今年BPhO的玄学curve，62分就能金奖"',
    tone: 'humorous',
  },
  {
    term: '知识点漏洞',
    meaning: '知识体系中的薄弱环节',
    usage: '"刷题才发现热力学一堆知识点漏洞"',
    tone: 'neutral',
  },
  {
    term: 'AIME cutoff',
    meaning: 'AMC 晋级 AIME 的分数线',
    usage: '"今年AMC12的AIME cutoff可能回到100+"',
    tone: 'neutral',
  },
]

// ═══════════════════════════════════════════════════════════
//  卷三：留学圈日常 (Daily Life)
// ═══════════════════════════════════════════════════════════

export const LIFESTYLE_SLANG: SlangEntry[] = [
  {
    term: '赶due',
    meaning: '赶作业截止日期',
    usage: '"凌晨三点还在赶due，咖啡续命"',
    tone: 'negative',
  },
  {
    term: '肝',
    meaning: '拼命做某事（来自"肝"游戏用语）',
    usage: '"这周末要肝完3000字的EE初稿"',
    tone: 'humorous',
  },
  {
    term: 'EMO',
    meaning: '情绪低落、伤感（来自emotional缩写）',
    usage: '"看着空空的邮箱，每天都很EMO"',
    tone: 'negative',
  },
  {
    term: '摆烂',
    meaning: '破罐子破摔，放弃努力',
    usage: '"申请季被拒麻了，想直接摆烂"',
    tone: 'negative',
  },
  {
    term: '内耗',
    meaning: '过度自我消耗、纠结、焦虑',
    usage: '"选校这件事已经让我内耗一个月了"',
    tone: 'negative',
  },
  {
    term: '避雷',
    meaning: '提醒别人避开不好的选择',
    usage: '"帮大家避雷几个水竞赛"',
    tone: 'neutral',
  },
  {
    term: '安利',
    meaning: '强烈推荐',
    usage: '"安利一个超好用的AP备考网站"',
    tone: 'positive',
  },
  {
    term: '同辈压力',
    meaning: 'Peer pressure，看到同龄人比自己优秀而产生焦虑',
    usage: '"朋友圈全是脆录，同辈压力拉满了"',
    tone: 'negative',
  },
]

// ═══════════════════════════════════════════════════════════
//  卷四：痛点词库 (Pain Points)
// ═══════════════════════════════════════════════════════════

export const PAIN_POINTS: PainPoint[] = [
  {
    topic: '选课焦虑',
    description: '不知道该选 A-Level、AP 还是 IB，担心选错影响申请',
    typicalEmotion: '迷茫、FOMO',
    targetGrade: 'G9-G10',
  },
  {
    topic: '裱花内卷',
    description: '标化成绩水涨船高，1550+ 成为标配，刷分无止境',
    typicalEmotion: '焦虑、疲惫',
    targetGrade: 'G10-G11',
  },
  {
    topic: '活动同质化',
    description: '感觉自己的课外活动千篇一律，缺乏亮点',
    typicalEmotion: '挫败、无力',
    targetGrade: 'G10-G11',
  },
  {
    topic: '文书恐惧症',
    description: '面对 Personal Statement 无从下手，写不出"独特的故事"',
    typicalEmotion: '焦虑、自我怀疑',
    targetGrade: 'G11-G12',
  },
  {
    topic: 'ED/EA 选择困难',
    description: '在梦校和现实之间纠结，怕ED选错浪费机会',
    typicalEmotion: '纠结、紧张',
    targetGrade: 'G12',
  },
  {
    topic: '申请结果焦虑',
    description: '等待结果期间的折磨，每天刷邮箱几百次',
    typicalEmotion: '焦虑、失眠',
    targetGrade: 'G12',
  },
  {
    topic: '家长压力',
    description: '父母对排名和专业的执念与自己的兴趣冲突',
    typicalEmotion: '压抑、委屈',
    targetGrade: 'G10-G12',
  },
  {
    topic: '竞赛性价比',
    description: '不知道哪些竞赛真正值得投入时间，怕打水漂',
    typicalEmotion: '困惑、选择困难',
    targetGrade: 'G9-G11',
  },
]

// ═══════════════════════════════════════════════════════════
//  工具函数：构建 Prompt 注入片段
// ═══════════════════════════════════════════════════════════

function formatSlangForPrompt(list: SlangEntry[]): string {
  return list
    .map((s) => `- **${s.term}**: ${s.meaning}（例："${s.usage}"）`)
    .join('\n')
}

function formatPainPointsForPrompt(list: PainPoint[]): string {
  return list
    .map(
      (p) =>
        `- **${p.topic}** [${p.targetGrade}] ${p.description} → 学生感受: ${p.typicalEmotion}`
    )
    .join('\n')
}

/**
 * 生成完整的 Newton 黑话注入片段，可直接拼接到 System Prompt 末尾。
 */
export function buildSlangInjection(): string {
  return `
## 国际高中生黑话词典（请在写作中自然使用）

### 学术圈高频词
${formatSlangForPrompt(ACADEMIC_SLANG)}

### 竞赛圈用语
${formatSlangForPrompt(COMPETITION_SLANG)}

### 日常情绪表达
${formatSlangForPrompt(LIFESTYLE_SLANG)}

## 当前学生核心痛点（文章选题参考）

${formatPainPointsForPrompt(PAIN_POINTS)}

## 黑话使用原则
- 每篇文章自然使用 2-4 个黑话词汇，不要堆砌
- 首次出现时可以括号解释（但不要每次解释，显得刻意）
- 结合具体场景使用，让读者觉得"这学长真懂我们"
- 负面词汇（如"摆烂""内耗"）用于共情，但要给出正向引导`
}
