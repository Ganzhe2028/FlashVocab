export const MEMORY_ICONS = ["notes", "plan", "light", "person", "clock", "door", "plant", "coins", "shield", "cloud", "eye", "hand"];

const scenes = {
  vacant: ["door", "空房间", "notes", "等待入住", "仍然空着"],
  proximity: ["person", "你站在这里", "door", "门口", "近在旁边"],
  devise: ["notes", "散乱想法", "plan", "执行步骤", "事先安排"],
  mundane: ["notes", "洗碗清单", "clock", "每天重复", "平凡日常"],
  translucent: ["light", "光线", "door", "磨砂玻璃", "透光却模糊"],
  probe: ["eye", "表面线索", "light", "深处真相", "深入探查"],
  revive: ["plant", "枯萎植物", "plant", "重新发芽", "再次活过来"],
  inhabit: ["person", "住户", "door", "房屋", "长期住在"],
  credibility: ["notes", "说过的话", "shield", "证据支持", "让人相信"],
  lucid: ["cloud", "混乱思绪", "light", "思路清楚", "点亮思路"],
  fatigue: ["person", "持续用力", "clock", "精疲力尽", "很久之后"],
  impulse: ["person", "突然想要", "hand", "立刻伸手", "还没想好"],
  recede: ["eye", "眼前事物", "cloud", "渐渐远去", "向后退去"],
  distorted: ["notes", "原本轮廓", "cloud", "扭曲失真", "变了形状"],
  deception: ["hand", "伸手设圈", "coins", "骗走钱财", "隐瞒真相"],
  prosperous: ["plant", "持续成长", "coins", "生意兴旺", "发展顺利"],
  elusive: ["eye", "努力寻找", "cloud", "转眼消失", "难以抓住"],
  bloated: ["notes", "多余内容", "cloud", "膨胀过大", "越塞越大"],
  contempt: ["person", "居高临下", "hand", "看轻别人", "轻蔑不屑"],
  centennial: ["clock", "一百年", "plan", "纪念庆典", "百年一次"],
  atrocity: ["hand", "凶残行为", "person", "受害者", "极端残忍"],
  phantoms: ["cloud", "影影绰绰", "eye", "似有似无", "虚幻身影"],
  negligence: ["person", "没有照看", "plant", "植物枯萎", "疏忽责任"],
  complicity: ["person", "明知有错", "hand", "暗中帮忙", "卷入同谋"],
};

export const getMemorySketch = (entry) => {
  const supplied = normalizeMemorySketch(entry.memorySketch);
  if (supplied) return supplied;
  const scene = scenes[String(entry.term).toLowerCase()];
  return scene ? { left: { icon: scene[0], label: scene[1] }, right: { icon: scene[2], label: scene[3] }, link: scene[4] } : null;
};

export const normalizeMemorySketch = (value) => {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return null; }
  }
  const validNode = (node) => node && MEMORY_ICONS.includes(node.icon) && typeof node.label === "string" && node.label.trim().length > 0 && node.label.trim().length <= 10;
  if (!validNode(value?.left) || !validNode(value?.right) || typeof value.link !== "string" || !value.link.trim() || value.link.trim().length > 10) return null;
  return {
    left: { icon: value.left.icon, label: value.left.label.trim() },
    right: { icon: value.right.icon, label: value.right.label.trim() },
    link: value.link.trim(),
  };
};
