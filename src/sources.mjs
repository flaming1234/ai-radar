// 主题枚举 + 推断 — SPRD §13.2
// v2: 一期只用 X 数据源，原 RSS SOURCES 已移除

export const TOPICS = [
  { id: 'models', label: '模型' },
  { id: 'agents', label: 'Agent' },
  { id: 'coding', label: 'AI Coding' },
  { id: 'infra', label: '基础设施' },
  { id: 'research', label: '研究' },
  { id: 'products', label: '产品' },
  { id: 'evals', label: 'Evals' },
  { id: 'open_source', label: '开源' },
  { id: 'business', label: '商业' },
];

const TOPIC_KEYWORDS = {
  agents: ['agent', 'agentic', 'autonomous', 'mcp', '智能体', '代理', 'harness', 'workflow'],
  coding: ['copilot', 'cursor', 'codex', 'coding', 'developer', '编程', '代码', 'ide', 'windsurf'],
  infra: ['gpu', 'inference', 'serving', 'cluster', 'vllm', 'runtime', 'kubernetes', '推理', '部署', '算力', 'cuda', 'tpu', 'h100', 'b200'],
  research: ['paper', 'arxiv', 'study', '论文', '研究', 'distillation', 'rlhf', 'sft'],
  evals: ['benchmark', 'eval', 'leaderboard', 'mmlu', 'gpqa', '评测', '榜单', 'arena'],
  open_source: ['open-source', 'open source', '开源', 'huggingface', 'hugging face', 'llama-'],
  business: ['raise', 'funding', 'ipo', 'acquire', 'revenue', '融资', '收购', '估值', '上市', 'startup', 'valuation'],
  products: ['launch', 'release', 'app', 'feature', 'product', '发布', '上线', '产品'],
  models: ['gpt', 'claude', 'gemini', 'llama', 'qwen', 'deepseek', 'mistral', 'model', '模型'],
};

const VALID_TOPICS = new Set(TOPICS.map((t) => t.id));

export function inferTopic(text) {
  if (!text) return 'models';
  const lower = text.toLowerCase();
  for (const [topic, kws] of Object.entries(TOPIC_KEYWORDS)) {
    if (kws.some((k) => lower.includes(k))) return topic;
  }
  return 'models';
}

export function isValidTopic(t) {
  return VALID_TOPICS.has(t);
}
