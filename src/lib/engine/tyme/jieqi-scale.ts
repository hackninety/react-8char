// tyme4ts 节气表平移（供 ../jieqi-scale.ts withSolarTermShift 的 install 参数使用）。
// 上游节气儒略日为北京时：临时包裹 SolarTerm.getJulianDay 与 SolarTime.getTerm，单次排盘后恢复。
import { JulianDay, SolarTerm, SolarTime } from 'tyme4ts';

interface TermPrototype { getJulianDay(this: SolarTerm): JulianDay }
interface TimePrototype { getTerm(this: SolarTime): SolarTerm }

/** 把 tyme4ts 节气表平移 shiftMinutes 分钟，返回恢复函数 */
export function shiftTymeSolarTerms(shiftMinutes: number): () => void {
  const termProto = SolarTerm.prototype as unknown as TermPrototype;
  const timeProto = SolarTime.prototype as unknown as TimePrototype;
  const julianDay = termProto.getJulianDay;
  const getTerm = timeProto.getTerm;
  const shiftDays = shiftMinutes / 1440;
  termProto.getJulianDay = function shifted() {
    return JulianDay.fromJulianDay(julianDay.call(this).getDay() + shiftDays);
  };
  // 上游先按日取节气：此步在北京时尺度上做，再在平移尺度上比较时刻
  timeProto.getTerm = function shiftedTerm() {
    let term = this.next(-shiftMinutes * 60).getSolarDay().getTerm();
    if (this.isBefore(term.getJulianDay().getSolarTime())) term = term.next(-1);
    return term;
  };
  return () => {
    termProto.getJulianDay = julianDay;
    timeProto.getTerm = getTerm;
  };
}
