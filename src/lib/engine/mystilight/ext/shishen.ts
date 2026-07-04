// 十神推算（移植自原 fork 的 src/v2/shishen.mjs）
import { GAN_WX_IDX, GAN_YY } from './constants';

/**
 * 根据日干和其他干计算十神关系
 * @param dayGan 日主天干
 * @param otherGan 另一天干
 * @returns 十神名称（无法识别时返回空串）
 */
export function getShiShen(dayGan: string, otherGan: string): string {
  if (!dayGan || !otherGan) return '';
  const dayWx = GAN_WX_IDX[dayGan];
  const otherWx = GAN_WX_IDX[otherGan];
  const sameYY = GAN_YY[dayGan] === GAN_YY[otherGan];

  if (dayWx === undefined || otherWx === undefined) return '';

  if (dayWx === otherWx) return sameYY ? '比肩' : '劫财';

  // 生我 (印)
  if ((dayWx + 4) % 5 === otherWx) return sameYY ? '偏印' : '正印';
  // 我生 (食伤)
  if ((dayWx + 1) % 5 === otherWx) return sameYY ? '食神' : '伤官';
  // 我克 (财)
  if ((dayWx + 2) % 5 === otherWx) return sameYY ? '偏财' : '正财';
  // 克我 (官杀)
  if ((dayWx + 3) % 5 === otherWx) return sameYY ? '七杀' : '正官';

  return '';
}
