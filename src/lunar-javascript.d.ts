// Minimal ambient typings for lunar-javascript (no official types shipped).
// Only the surface used by src/lib/wuyunliuqi.ts is declared.
declare module 'lunar-javascript' {
  interface LunarSolar {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    toYmd(): string;
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
}
