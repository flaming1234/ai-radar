// X 账号池 v3 — 基于 Latent.Space AINews 近 3 个月（2026-02-26 至 2026-05-23, 61 篇日报）真实出现频率统计
// 数据来源：docs/latent-space-ainews-x-handles-2026-02-26-to-2026-05-23.md
//
// 分级规则：
//   S 级（46 个，>=10 篇）— 必扫，高信号
//   A 级（91 个，4-9 篇）— 稳定补充，每日扫
//   B 级（216 个，2-3 篇）— 长尾观察池，目前不参与每日抓取，留作事件触发或后续扩容

export const X_S_TIER = [
  '@kimmonismus', '@scaling01', '@omarsar0', '@LangChain', '@Teknium',
  '@arena', '@ArtificialAnlys', '@cursor_ai', '@OpenAIDevs', '@OpenAI',
  '@vllm_project', '@Yuchenj_UW', '@dair_ai', '@theo', '@TheTuringPost',
  '@AnthropicAI', '@gdb', '@sama', '@teortaxesTex', '@_philschmid',
  '@Vtrivedy10', '@ClementDelangue', '@Google', '@hwchase17', '@reach_vb',
  '@swyx', '@eliebakouch', '@NousResearch', '@perplexity_ai', '@ZhihuFrontier',
  '@AravSrinivas', '@claudeai', '@ollama', '@sydneyrunkle', '@Alibaba_Qwen',
  '@GoogleDeepMind', '@simonw', '@UnslothAI', '@cognition', '@EpochAIResearch',
  '@jerryjliu0', '@karpathy', '@llama_index', '@mervenoyann', '@osanseviero',
  '@victormustar',
];

export const X_A_TIER = [
  '@alexalbert__', '@code', '@iScienceLuvr', '@jeremyphoward', '@lateinteraction',
  '@rasbt', '@sundarpichai', '@baseten', '@cwolferesearch', '@demishassabis',
  '@ggerganov', '@giffmana', '@GoogleResearch', '@nrehiew_', '@SakanaAILabs',
  '@TheRundownAI', '@togethercompute', '@_catwu', '@ClaudeDevs', '@dbreunig',
  '@googlegemma', '@HuggingPapers', '@Kimi_Moonshot', '@LiorOnAI', '@OfficialLoganK',
  '@Zai_org', '@cline', '@DbrxMosaicAI', '@dejavucoder', '@dl_weekly',
  '@fchollet', '@GeminiApp', '@GoogleAIStudio', '@matvelloso', '@OpenRouter',
  '@pierceboggan', '@polynoamial', '@RisingSayak', '@SemiAnalysis_', '@ZyphraAI',
  '@_akhaliq', '@_arohan_', '@adcock_brett', '@allen_ai', '@AndrewCurran_',
  '@arankomatsuzaki', '@ben_burtenshaw', '@cohere', '@github', '@gneubig',
  '@GoodfireAI', '@hardmaru', '@masondrxy', '@natolambert', '@NVIDIAAI',
  '@petergostev', '@rosinality', '@skypilot_org', '@tri_dao', '@trq212',
  '@weaviate_io', '@willdepue', '@zachtratar', '@_lewtun', '@AndrewYNg',
  '@awnihannun', '@bcherny', '@cloneofsimo', '@code_star', '@danielhanchen',
  '@denisyarats', '@DrJimFan', '@elonmusk', '@emollick', '@gabriberton',
  '@HamelHusain', '@Hangsiin', '@htihle', '@JeffDean', '@LambdaAPI',
  '@maharshii', '@MiniMax_AI', '@NielsRogge', '@OfirPress', '@pratyushmaini',
  '@QuixiAI', '@sainingxie', '@stochasticchasm', '@thsottiaux', '@torchcompiled',
  '@windsurf',
];

// B 级保留池：不参与每日抓取，作为事件触发或后续扩容备选
export const X_B_TIER = [
  '@_albertgu', '@0xSero', '@AIatMeta', '@aidan_mclau', '@aidangomez',
  '@AISecurityInst', '@ajambrosino', '@akseljoonas', '@andersonbcdefg', '@ariG23498',
  '@arjunkocher', '@AstasiaMyers', '@AymericRoucher', '@basetenco', '@benhylak',
  '@bnjmn_marie', '@BraceSproul', '@caspar_br', '@Cloudflare', '@CShorten30',
  '@deepseek_ai', '@fal', '@fidjissimo', '@figma', '@GergelyOrosz',
  '@goodside', '@GoogleAI', '@googledevs', '@ID_AA_Carmack', '@jakebroekhuizen',
  '@jaseweston', '@jonasgeiping', '@joshwoodward', '@julien_c', '@kellerjordan0',
  '@LangChain_JS', '@LangChain_OSS', '@levie', '@lvwerra', '@METR_Evals',
  '@MParakhin', '@mustafasuleyman', '@NandoDF', '@nathanhabib1011', '@nickaturley',
  '@nickbaumann_', '@nickfrosst', '@ostrisai', '@percyliang', '@PrimeIntellect',
  '@Prince_Canuma', '@random_walker', '@RedHat_AI', '@RekaAILabs', '@runwayml',
  '@RyanPGreenblatt', '@Sentdex', '@Shahules786', '@skirano', '@snsf',
  '@StasBekman', '@thdxr', '@TheAITimeline', '@threepointone', '@tszzl',
  '@turbopuffer', '@victorialslocum', '@wandb', '@willccbb', '@witcheer',
  '@wtgowers', '@XiaomiMiMo',
  '@__tinygrad__', '@_Evan_Boyle', '@_NathanCalvin', '@adaption_ai', '@adithya_s_k',
  '@adrgrondin', '@AiBattle_', '@aiDotEngineer', '@altryne', '@AmandaAskell',
  '@amir', '@andonlabs', '@andrewbenson', '@anemll', '@anissagardizy8',
  '@ankush_gola11', '@antoine_chaffin', '@arimorcos', '@art_zucker', '@aryaman2020',
  '@AskPerplexity', '@AssemblyAI', '@aye_aye_kaplan', '@basecampbernie', '@bilawalsidhu',
  '@BoWang87', '@bromann', '@btaylor', '@business', '@cartesia',
  '@charles_irl', '@che_shr_cat', '@cheatyyyy', '@cHHillee', '@claude_code',
  '@cmpatino_', '@coreyching', '@cryps1s', '@cryptopunk7213', '@crystalsssup',
  '@ctnzr', '@Dan_Jeffries1', '@danshipper', '@deanwball', '@deredleritt3r',
  '@dexhorthy', '@dkundel', '@dzhng', '@felixrieseberg', '@finbarrtimbers',
  '@garrytan', '@googleaidevs', '@Grad62304977', '@hxiao', '@IcarusHermes',
  '@idavidrein', '@j_dekoninck', '@jackclarkSF', '@JamesZmSun', '@jaminball',
  '@JayAlammar', '@jeffboudier', '@jefrankle', '@jennyzhangzt', '@Jianlin_S',
  '@johnschulman2', '@jpschroeder', '@jukan05', '@karrisaarinen', '@kevinweil',
  '@kipperrii', '@KLieret', '@koraykv', '@KSimback', '@kylebrussell',
  '@KyleHessling1', '@leloykun', '@LightOnIO', '@lmstudio', '@logangraham',
  '@LoubnaBenAllal1', '@markchen90', '@matei_zaharia', '@mathemagic1an', '@MatthewBerman',
  '@maximelabonne', '@MayankMish98', '@michpokrass', '@MillieMarconnni', '@MistralAI',
  '@mntruell', '@morqon', '@mweinbach', '@negligible_cap', '@nesquena',
  '@NoahZiems', '@noahzweben', '@nottombrown', '@nvidia', '@NVIDIA_AI_PC',
  '@onusoz', '@OpenAINewsroom', '@outsource_', '@palashshah', '@patrickc',
  '@paul_cal', '@poolsideai', '@QuentinAnthon15', '@realDanFu', '@robotsdigest',
  '@RoundtableSpace', '@rronak_', '@russelljkaplan', '@sammcallister', '@sarahookr',
  '@saranormous', '@ScaleAILabs', '@shannholmberg', '@signulll', '@sjgadler',
  '@skalskip92', '@steph_palazzolo', '@SteveSchoettler', '@tadasayy', '@TencentHunyuan',
  '@testingcatalog', '@ThePrimeagen', '@TheZachMueller', '@thomasfbloom', '@TrentonBricken',
  '@tuhinone', '@ValsAI', '@VictorTaelin', '@voooooogel', '@walden_yan',
  '@Wauplin', '@whoiskatrin', '@wightmanr', '@winglian', '@xenovacom',
  '@Yampeleg', '@yoonholeee', '@zeffmax', '@Zeneca',
];

// 不区分大小写规范化 — 修复 @Replit 与 @replit 类不一致
const ALL = [...X_S_TIER, ...X_A_TIER, ...X_B_TIER];
const CANONICAL = new Map();
for (const h of ALL) CANONICAL.set(h.toLowerCase(), h);

export function canonicalHandle(h) {
  const norm = normalizeHandle(h);
  return CANONICAL.get(norm.toLowerCase()) || norm;
}

export function tierOf(handle) {
  const h = canonicalHandle(handle);
  if (X_S_TIER.includes(h)) return 'S';
  if (X_A_TIER.includes(h)) return 'A';
  if (X_B_TIER.includes(h)) return 'B';
  return null;
}

export function normalizeHandle(h) {
  if (!h) return '';
  const s = String(h).trim();
  return s.startsWith('@') ? s : ('@' + s.replace(/^@/, ''));
}

// 抓取批次：S 拆 2 批 / A 拆 3 批 / B 拆 7 批，全套参与
// 总计 12 个 :online 调用，每次 refresh 成本约 $0.50
export function getFetchBatches() {
  const chunks = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };
  const sParts = chunks(X_S_TIER, Math.ceil(X_S_TIER.length / 2));   // 46 → 2×23
  const aParts = chunks(X_A_TIER, Math.ceil(X_A_TIER.length / 3));   // 91 → 31/31/29
  const bParts = chunks(X_B_TIER, Math.ceil(X_B_TIER.length / 7));   // 216 → 7×31
  const batches = [];
  sParts.forEach((accounts, i) => {
    batches.push({ tier: 'S', label: `S-${i + 1}（高频核心）`, accounts });
  });
  aParts.forEach((accounts, i) => {
    batches.push({ tier: 'A', label: `A-${i + 1}（稳定补充）`, accounts });
  });
  bParts.forEach((accounts, i) => {
    batches.push({ tier: 'B', label: `B-${i + 1}（长尾观察）`, accounts });
  });
  return batches;
}
