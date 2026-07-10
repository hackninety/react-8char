// 神煞含义小词典：给导出盘面中实际出现的神煞附一行「吉凶 + 主事」。
//
// 动机：神煞导出仅有名字，冷门者（德秀、天厨、元辰…）AI 凭记忆易编义——
// 附上一行经典义即消除此幻觉源。仅输出盘中出现者，token 成本以 KB 计。
// 义项取《三命通会》《协纪辨方书》通说，从简。

export const SHENSHA_MEANINGS: Record<string, string> = {
  // 吉神
  天乙贵人: '第一吉神，遇难呈祥、常得贵人扶助',
  天德贵人: '福德阴庇，化凶聚吉，心地仁厚',
  月德贵人: '与天德同类，主逢凶化吉、行事得天时',
  文昌贵人: '聪明好学，利学业、文书、考试',
  太极贵人: '悟性高，利哲理玄学钻研，晚景有成',
  国印贵人: '掌印信权柄，为人诚信，利公职',
  福星贵人: '一生福禄无缺，遇事有解，性乐天',
  天厨贵人: '食禄丰足，利餐饮养生之福',
  德秀贵人: '内秀温和，化戾气为祥和',
  禄神: '日主之禄，主俸禄身价、自食其力而丰足',
  金舆: '富贵之车，主婚姻得助、亲属荫益、出行体面',
  将星: '组织统御之才，居众人之上，掌权柄',
  华盖: '孤高之星——艺术、宗教、玄学之缘，聪慧而喜独处',
  驿马: '主走动变迁——远行、调动、外出发展；逢冲则动愈速',
  天赦: '逢凶化吉、有过得赦之吉日',
  // 情缘类
  桃花: '人缘魅力、异性缘旺；逢冲刑或落浴地则易生情扰',
  咸池: '即桃花，主情欲魅力',
  红鸾: '婚恋喜庆之星，主姻缘将至',
  天喜: '与红鸾相对，主嫁娶、添丁等喜事',
  红艳煞: '多情风流之艳缘，须防婚外情扰',
  // 凶煞
  羊刃: '旺极之刃，性刚烈冲动；有杀驾驭为大权，无制则伤身破财',
  飞刃: '羊刃对冲之位，主突发冲击，力轻于羊刃',
  劫煞: '主破耗被劫——财物易失、易遭小人暗算',
  灾煞: '病灾意外之煞，防血光、水火之伤',
  亡神: '主心神耗散、官非口舌；亦主城府谋略',
  空亡: '该柱所主之事易落空虚耗；逢冲、合可解（填实反论）',
  孤辰: '性情孤介，六亲缘淡（古以男命尤忌）',
  寡宿: '性情孤僻，婚姻迟滞（古以女命尤忌）',
  血刃: '血光之灾，利刃、手术之伤，宜防意外',
  元辰: '耗散颠倒之煞，做事易反复、耗损暗生',
  勾绞煞: '口舌纠纷、无端牵连之煞',
  丧门: '孝服哀事之煞，逢之忌探病送葬',
  吊客: '与丧门同类，主吊唁哀戚之事',
  披麻: '孝服之煞，主亲属哀事',
  白虎: '血光凶伤之煞，主意外凶灾',
  天罗: '困顿束缚之网（戌亥，古以男忌），主是非缠身',
  地网: '与天罗相对（辰巳，古以女忌），主进退维谷',
  童子煞: '民俗谓仙缘之体、体弱婚迟；今宜理性看待，不足为惧',
  阴差阳错: '婚姻易生波折寡合，重在沟通经营',
  十恶大败: '禄入空亡，古主财帛耗散；今作理财谨慎之提示',
  四废: '日主生于休囚绝地，做事易有始无终',
  孤鸾: '婚缘偏晚、聚少离多之古义，现代宜宽解',
};

// ─── 神煞数据形状（引擎统一输出 {nian,yue,ri,shi,current:{daYun,liuNian,…}}）───
// 位置键 → 中文标签的唯一权威映射；markdown-export / ShenShaList / mcp/format 共同消费，
// 原先三处平行硬编码（技术债），下沉于此防漂移。

export const SHENSHA_POS_CN: Record<string, string> = {
  nian: '年柱', yue: '月柱', ri: '日柱', shi: '时柱',
  daYun: '当前大运', liuNian: '当前流年', liuYue: '当前流月', liuRi: '当前流日',
};

/** 本命四柱位置键（有序） */
export const SHENSHA_PILLAR_KEYS = ['nian', 'yue', 'ri', 'shi'] as const;
/** 当前运岁位置键（有序） */
export const SHENSHA_CURRENT_KEYS = ['daYun', 'liuNian', 'liuYue', 'liuRi'] as const;

// ─── 凶煞名单（数据驱动；原 ShenShaList XIONG_SHA 正则硬编码）───
// 含引擎可能的两种写法「阴差阳错/阴阳差错」；名单外未知神煞按吉神显示（宁缺勿错标）。
const XIONG_SHA_NAMES = [
  '羊刃', '飞刃', '劫煞', '灾煞', '亡神', '空亡', '孤辰', '寡宿', '血刃', '元辰',
  '勾绞', '丧门', '吊客', '披麻', '白虎', '天罗', '地网', '童子', '红艳',
  '阴差阳错', '阴阳差错', '十恶大败', '四废', '孤鸾',
];

/** 是否凶煞（名字可带「(日)」等基准后缀） */
export function isXiongSha(name: string): boolean {
  const base = name.replace(/\([^)]*\)/g, '').trim();
  return XIONG_SHA_NAMES.some((x) => base.includes(x));
}

/** 从导出神煞结构（{nian,yue,ri,shi,current} 或任意嵌套）收集全部神煞名 */
export function collectShenShaNames(sh: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (!v) return;
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(sh);
  return out;
}

/** 名字可能带「(日)」等基准后缀，剥后缀查表；仅返回词典命中的（未知名不编义） */
export function lookupShenShaMeanings(names: Iterable<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of names) {
    const base = raw.replace(/\([^)]*\)/g, '').trim();
    if (!base || out[base]) continue;
    const meaning =
      SHENSHA_MEANINGS[base] ??
      Object.entries(SHENSHA_MEANINGS).find(([k]) => base.startsWith(k))?.[1];
    if (meaning) out[base] = meaning;
  }
  return out;
}
