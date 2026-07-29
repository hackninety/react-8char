// Minimal ambient typings for lunar-javascript (no official types shipped).
// Only the surface used by src/lib/wuyunliuqi.ts and engine/mystilight/ext/utils.ts
// (LunarYear 闰月查询) is declared.
declare module 'lunar-javascript' {
  interface LunarSolar {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getHour(): number;
    getMinute(): number;
    getSecond(): number;
    toYmd(): string;
    toYmdHms(): string;
  }
  interface LunarObj {
    getJieQiTable(): Record<string, LunarSolar>;
    getYearInGanZhi(): string;
  }
  interface SolarObj {
    getLunar(): LunarObj;
  }
  export const Solar: {
    fromYmd(year: number, month: number, day: number): SolarObj;
  };
  export const Lunar: unknown;
  interface LunarYearObj {
    /** 该农历年的闰月月序（1~12；无闰月返回 0） */
    getLeapMonth(): number;
  }
  export const LunarYear: {
    fromYear(year: number): LunarYearObj;
  };
}
