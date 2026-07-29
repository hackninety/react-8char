import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MapPin, Calendar, Search, Moon } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BaziInput } from '@/lib/bazi';
import { TIAN_GAN, DI_ZHI, lunarToSolar, getLunarLeapMonth, reverseLookupBazi } from '@/lib/bazi';
import type { ReverseLookupResult } from '@/lib/bazi';
import { PROVINCES, findLongitude, findLatitude } from '@/lib/cities';
import { listEngines, DEFAULT_ENGINE } from '@/lib/engine';
import type { EngineId } from '@/lib/engine';
import { loadForm, saveForm } from '@/lib/storage';

type InputMode = 'solar' | 'lunar' | 'bazi';

// 农历月中文名（闰月提示用；11/12 月俗称冬月/腊月）
const CN_LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'] as const;
const cnLunarMonth = (m: number) => CN_LUNAR_MONTHS[m - 1] ?? String(m);

/** 闰月自动判断结果：仅 ask（所填月恰为该年闰月）需要用户二选一，其余情形一律按非闰月排 */
type LeapState =
  | { kind: 'pending' }              // 年份未填好，无从判断
  | { kind: 'none' }                 // 该年无闰月
  | { kind: 'other'; leapMonth: number } // 该年有闰月但与所填月无关
  | { kind: 'ask'; leapMonth: number };  // 所填月恰为该年闰月，需用户确认生于本月还是闰月

interface BaziFormProps {
  onSubmit: (input: BaziInput) => void;
  loading: boolean;
}

const MODE_LABELS: Record<InputMode, { label: string; icon: React.ReactNode }> = {
  solar: { label: '公历', icon: <Calendar className="w-3.5 h-3.5" /> },
  lunar: { label: '农历', icon: <Moon className="w-3.5 h-3.5" /> },
  bazi: { label: '八字反查', icon: <Search className="w-3.5 h-3.5" /> },
};

export default function BaziForm({ onSubmit, loading }: BaziFormProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  // 上次表单快照（刷新回填；清空浏览器缓存才回默认）——惰性读取一次
  const [saved] = useState(loadForm);
  const [mode, setMode] = useState<InputMode>((saved?.mode as InputMode) ?? 'solar');

  // 公历 / 农历 共用（string 类型以支持清空）— 默认浏览器当前时间
  const [yearStr, setYearStr] = useState(saved?.yearStr ?? String(now.getFullYear()));
  const [monthStr, setMonthStr] = useState(saved?.monthStr ?? String(now.getMonth() + 1));
  const [dayStr, setDayStr] = useState(saved?.dayStr ?? String(now.getDate()));
  const [hourStr, setHourStr] = useState(saved?.hourStr ?? String(now.getHours()));
  const [minuteStr, setMinuteStr] = useState(saved?.minuteStr ?? String(now.getMinutes()));
  const [isLeapMonth, setIsLeapMonth] = useState(saved?.isLeapMonth ?? false);

  // 共用
  const [gender, setGender] = useState<0 | 1>(saved?.gender ?? 1);
  const [sect, setSect] = useState<1 | 2>(saved?.sect ?? 1);
  const [engineId, setEngineId] = useState<EngineId>((saved?.engine as EngineId) ?? DEFAULT_ENGINE);
  const [compareOn, setCompareOn] = useState(saved?.compareOn ?? false);
  const [useTrueSolar, setUseTrueSolar] = useState(saved?.useTrueSolar ?? true);
  // 出生地定位：城市下拉（国内）/ 手动经度（国外自由填写）
  const [locMode, setLocMode] = useState<'city' | 'manual'>((saved?.locMode as 'city' | 'manual') ?? 'city');
  const [manualPlace, setManualPlace] = useState(saved?.manualPlace ?? '');
  const [manualLng, setManualLng] = useState(saved?.manualLng ?? '');
  const [manualLat, setManualLat] = useState(saved?.manualLat ?? ''); // 出生地纬度（北纬正、南纬负），用于地利寒热
  const [manualTz, setManualTz] = useState(saved?.manualTz ?? '8'); // 出生地时区 UTC 偏移（小时）
  const [province, setProvince] = useState(saved?.province ?? '北京');
  const [cityName, setCityName] = useState(saved?.cityName ?? '北京');
  const [district, setDistrict] = useState(saved?.district ?? PROVINCES[0].cities[0].districts[0].name);
  const [livingPlace, setLivingPlace] = useState(saved?.livingPlace ?? '');
  const [userNote, setUserNote] = useState(saved?.userNote ?? '');

  // 八字反查 — 8 个独立天干地支
  const [yearGan, setYearGan] = useState(saved?.yearGan ?? '');
  const [yearZhi, setYearZhi] = useState(saved?.yearZhi ?? '');
  const [monthGan, setMonthGan] = useState(saved?.monthGan ?? '');
  const [monthZhi, setMonthZhi] = useState(saved?.monthZhi ?? '');
  const [dayGan, setDayGan] = useState(saved?.dayGan ?? '');
  const [dayZhi, setDayZhi] = useState(saved?.dayZhi ?? '');
  const [timeGan, setTimeGan] = useState(saved?.timeGan ?? '');
  const [timeZhi, setTimeZhi] = useState(saved?.timeZhi ?? '');
  const [lookupResults, setLookupResults] = useState<ReverseLookupResult[]>([]);
  const [lookupError, setLookupError] = useState('');

  // 闰月自动判断：按所填农历年查该年闰月，仅当所填月恰为闰月时才让用户二选一
  const leapState: LeapState = useMemo(() => {
    if (mode !== 'lunar') return { kind: 'pending' };
    const y = Number(yearStr);
    if (!Number.isInteger(y) || y < 1900 || y > currentYear) return { kind: 'pending' };
    let leapMonth = 0;
    try {
      leapMonth = getLunarLeapMonth(y);
    } catch {
      return { kind: 'pending' };
    }
    if (leapMonth <= 0) return { kind: 'none' };
    return Number(monthStr) === leapMonth ? { kind: 'ask', leapMonth } : { kind: 'other', leapMonth };
  }, [mode, yearStr, monthStr, currentYear]);

  // 表单任一字段变化即持久化（瞬时态 lookupResults/lookupError 不存）
  useEffect(() => {
    saveForm({
      mode, yearStr, monthStr, dayStr, hourStr, minuteStr, isLeapMonth,
      gender, sect, engine: engineId, compareOn, useTrueSolar,
      locMode, manualPlace, manualLng, manualLat, manualTz,
      province, cityName, district, livingPlace, userNote,
      yearGan, yearZhi, monthGan, monthZhi, dayGan, dayZhi, timeGan, timeZhi,
    });
  });

  // 解析出生地定位为 { city, longitude, utcOffset }；校验失败返回 null（已置错误提示）
  const resolveLocation = (): Pick<BaziInput, 'city' | 'longitude' | 'latitude' | 'utcOffset'> | null => {
    if (!useTrueSolar) return {};
    if (locMode === 'manual') {
      const lng = parseFloat(manualLng);
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        setLookupError('请输入有效经度（-180 ~ 180，东经为正、西经为负，如 139.8035575）');
        return null;
      }
      const tz = manualTz.trim() === '' ? 8 : parseFloat(manualTz);
      if (!Number.isFinite(tz) || tz < -12 || tz > 14) {
        setLookupError('请输入有效时区 UTC 偏移（-12 ~ 14，如东京 9、纽约 -5）');
        return null;
      }
      let lat: number | undefined;
      if (manualLat.trim() !== '') {
        lat = parseFloat(manualLat);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
          setLookupError('请输入有效纬度（-90 ~ 90，北纬正、南纬负，如东京 35.68）');
          return null;
        }
      }
      return {
        city: manualPlace.trim() || `经度${lng}°`,
        longitude: lng,
        latitude: lat,
        utcOffset: tz,
      };
    }
    return {
      city: district === '市区' ? cityName : `${cityName} ${district}`,
      longitude: findLongitude(province, cityName, district),
      latitude: findLatitude(province),
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');

    const fields = [
      { label: '年', raw: yearStr },
      { label: '月', raw: monthStr },
      { label: '日', raw: dayStr },
      { label: '时', raw: hourStr },
      { label: '分', raw: minuteStr },
    ];
    for (const f of fields) {
      if (f.raw.trim() === '' || isNaN(Number(f.raw))) {
        setLookupError(`请填写完整的出生时间（${f.label}不能为空且须为数字）`);
        return;
      }
    }

    let solarYear = Number(yearStr);
    let solarMonth = Number(monthStr);
    let solarDay = Number(dayStr);
    let solarHour = Number(hourStr);
    let solarMinute = Number(minuteStr);

    if (solarYear < 1900 || solarYear > currentYear) {
      setLookupError(`年份须在 1900 ~ ${currentYear} 之间`);
      return;
    }
    if (solarMonth < 1 || solarMonth > 12) { setLookupError('月份须在 1 ~ 12 之间'); return; }
    if (solarDay < 1 || solarDay > 31) { setLookupError('日期须在 1 ~ 31 之间'); return; }
    if (solarHour < 0 || solarHour > 23) { setLookupError('小时须在 0 ~ 23 之间'); return; }
    if (solarMinute < 0 || solarMinute > 59) { setLookupError('分钟须在 0 ~ 59 之间'); return; }

    if (mode === 'lunar') {
      try {
        // 闰月已自动判断：只有所填月恰为该年闰月且用户勾选时才按闰月排（杜绝误勾历史存档值）
        const effectiveLeap = leapState.kind === 'ask' && isLeapMonth;
        const solar = lunarToSolar(solarYear, solarMonth, solarDay, solarHour, solarMinute, effectiveLeap);
        solarYear = solar.year;
        solarMonth = solar.month;
        solarDay = solar.day;
        solarHour = solar.hour;
        solarMinute = solar.minute;
      } catch (err) {
        setLookupError(`农历转换失败：${err instanceof Error ? err.message : '日期无效'}`);
        return;
      }
    }
    const loc = resolveLocation();
    if (!loc) return;
    onSubmit({
      year: solarYear, month: solarMonth, day: solarDay,
      hour: solarHour, minute: solarMinute,
      gender, sect,
      engine: engineId,
      compare: compareOn,
      ...loc,
      livingPlace: livingPlace.trim() || undefined,
      userNote: userNote.trim() || undefined,
    });
  };

  const handleBaziLookup = () => {
    setLookupError('');
    setLookupResults([]);
    if (!yearGan || !yearZhi || !monthGan || !monthZhi || !dayGan || !dayZhi || !timeGan || !timeZhi) {
      setLookupError('请完整选择四柱的天干和地支');
      return;
    }
    const yearGZ = yearGan + yearZhi;
    const monthGZ = monthGan + monthZhi;
    const dayGZ = dayGan + dayZhi;
    const timeGZ = timeGan + timeZhi;
    try {
      // 反查口径跟随表单当前分派选择（早晚子时日柱归属影响反查结果）
      const results = reverseLookupBazi(yearGZ, monthGZ, dayGZ, timeGZ, { sect });
      if (results.length === 0) {
        setLookupError('近60年内未找到匹配的日期，请检查四柱是否正确');
      } else {
        setLookupResults(results);
      }
    } catch (err) {
      setLookupError(`反查失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleSelectLookupResult = (r: ReverseLookupResult) => {
    const loc = resolveLocation();
    if (!loc) return;
    onSubmit({
      year: r.year, month: r.month, day: r.day,
      hour: r.hour, minute: r.minute,
      gender, sect,
      engine: engineId,
      compare: compareOn,
      ...loc,
      livingPlace: livingPlace.trim() || undefined,
      userNote: userNote.trim() || undefined,
    });
  };

  const renderDateInputs = () => (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="year" className="text-xs">{mode === 'lunar' ? '农历年' : '年'}</Label>
        <Input id="year" type="text" inputMode="numeric" placeholder="1990" value={yearStr}
          onChange={(e) => setYearStr(e.target.value)} className="border-gold/20 focus:border-gold/50" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="month" className="text-xs">{mode === 'lunar' ? '农历月' : '月'}</Label>
        <Input id="month" type="text" inputMode="numeric" placeholder="5" value={monthStr}
          onChange={(e) => setMonthStr(e.target.value)} className="border-gold/20 focus:border-gold/50" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="day" className="text-xs">{mode === 'lunar' ? '农历日' : '日'}</Label>
        <Input id="day" type="text" inputMode="numeric" placeholder="15" value={dayStr}
          onChange={(e) => setDayStr(e.target.value)} className="border-gold/20 focus:border-gold/50" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hour" className="text-xs">时</Label>
        <Input id="hour" type="text" inputMode="numeric" placeholder="14" value={hourStr}
          onChange={(e) => setHourStr(e.target.value)} className="border-gold/20 focus:border-gold/50" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="minute" className="text-xs">分</Label>
        <Input id="minute" type="text" inputMode="numeric" placeholder="30" value={minuteStr}
          onChange={(e) => setMinuteStr(e.target.value)} className="border-gold/20 focus:border-gold/50" />
      </div>
    </div>
  );

  // 闰月行：展示自动判断结果；仅在真正歧义时（所填月恰为该年闰月）出现勾选框
  const renderLeapMonthRow = () => {
    if (leapState.kind === 'ask') {
      const m = cnLunarMonth(leapState.leapMonth);
      return (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isLeapMonth} onChange={(e) => setIsLeapMonth(e.target.checked)}
              className="w-4 h-4 rounded border-gold/30 text-crimson accent-[var(--color-crimson)]" />
            <span className="text-xs font-medium text-crimson dark:text-gold">生于闰{m}月</span>
          </label>
          <span className="text-xs text-muted-foreground">
            {yearStr} 年有闰{m}月：生于普通{m}月不勾选，生于闰{m}月请勾选
          </span>
        </div>
      );
    }
    const note =
      leapState.kind === 'none' ? `已自动判断：${yearStr} 年无闰月`
      : leapState.kind === 'other' ? `已自动判断：${yearStr} 年只有闰${cnLunarMonth(leapState.leapMonth)}月，与所填月份无关`
      : '闰月无需手选，将按农历年月自动判断';
    return <span className="text-xs text-muted-foreground">{note}</span>;
  };

  // 单个天干或地支选择器
  const renderGanOrZhiSelect = (
    label: string, value: string, onChange: (v: string) => void,
    options: readonly string[],
  ) => (
    <div className="space-y-1">
      <Label className="text-xs text-foreground font-medium text-left">{label}</Label>
      <Select value={value || '_empty_'} onValueChange={(v) => onChange(!v || v === '_empty_' ? '' : v)}>
        <SelectTrigger className="border-gold/20 h-9 text-sm">
          <SelectValue>{value || '-'}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          <SelectItem value="_empty_">-</SelectItem>
          {options.map(g => (
            <SelectItem key={g} value={g}>{g}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const currentProvince = PROVINCES.find(p => p.name === province);
  const cityList = currentProvince?.cities ?? [];
  const currentCity = cityList.find(ct => ct.name === cityName);
  const districtList = currentCity?.districts ?? [];

  const handleProvinceChange = (v: string) => {
    setProvince(v);
    const p = PROVINCES.find(p => p.name === v);
    const firstCity = p?.cities[0];
    setCityName(firstCity?.name ?? '');
    setDistrict(firstCity?.districts[0]?.name ?? '');
  };

  const handleCityNameChange = (v: string) => {
    setCityName(v);
    const ct = currentProvince?.cities.find(ct => ct.name === v);
    setDistrict(ct?.districts[0]?.name ?? '');
  };

  const renderCommonSelects = () => (
    <div className="flex flex-wrap gap-3">
      <div className="space-y-1 w-[calc(16.667%-8px)] min-w-[100px]">
        <Label className="text-xs">性别</Label>
        <Select value={String(gender)} onValueChange={(v) => setGender(Number(v) as 0 | 1)}>
          <SelectTrigger className="border-gold/20 h-8 text-xs w-full min-w-0">
            <SelectValue>{gender === 1 ? '男（乾造）' : '女（坤造）'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">男（乾造）</SelectItem>
            <SelectItem value="0">女（坤造）</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 w-[calc(16.667%-8px)] min-w-[100px]">
        <Label className="text-xs">分派</Label>
        <Select value={String(sect)} onValueChange={(v) => setSect(Number(v) as 1 | 2)}>
          <SelectTrigger className="border-gold/20 h-8 text-xs w-full min-w-0">
            <SelectValue>{sect === 2 ? '传统派' : '正统派'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">传统派</SelectItem>
            <SelectItem value="1">正统派</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* SelectTrigger 基类为 w-fit：不加 w-full 时超长引擎名会溢出本容器、被右侧对拍框覆盖（移动端尤甚） */}
      <div className="space-y-1 w-[calc(20%-8px)] min-w-[185px]">
        <Label className="text-xs">排盘引擎</Label>
        <Select value={engineId} onValueChange={(v) => v && setEngineId(v as EngineId)}>
          <SelectTrigger className="border-gold/20 h-8 text-xs engine-select w-full min-w-0">
            <SelectValue>{listEngines().find(e => e.id === engineId)?.name ?? engineId}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {listEngines().map(e => (
              <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 min-w-[110px]">
        <Label className="text-xs opacity-0 select-none">对拍</Label>
        <label className="flex items-center gap-1.5 h-8 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={compareOn} onChange={(e) => setCompareOn(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gold/30 accent-[var(--color-crimson)]" />
          <span className="text-muted-foreground">双引擎对拍校验</span>
        </label>
      </div>
      <div className="space-y-1 w-[calc(33.333%-8px)] min-w-[200px] flex-1">
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
            <input type="checkbox" checked={useTrueSolar} onChange={(e) => setUseTrueSolar(e.target.checked)}
              className="w-3 h-3 rounded border-gold/30 accent-[var(--color-crimson)]" />
            <MapPin className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">真太阳时（出生地）</span>
          </label>
          {useTrueSolar && (
            <div className="flex rounded-md overflow-hidden border border-gold/20 shrink-0">
              {([['city', '城市'], ['manual', '手动经度']] as const).map(([m, lbl]) => (
                <button key={m} type="button" onClick={() => setLocMode(m)}
                  className={`px-2 py-0.5 text-[10px] transition-colors cursor-pointer ${
                    locMode === m ? 'bg-crimson text-white dark:bg-gold dark:text-black' : 'text-muted-foreground hover:bg-muted/40'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
          )}
        </div>
        {!useTrueSolar ? (
          <div className="h-8 flex items-center text-xs text-muted-foreground/50 border border-dashed border-gold/10 rounded-md px-2">
            不校正（北京时间）
          </div>
        ) : locMode === 'city' ? (
          <div className="flex gap-1">
            <Select value={province} onValueChange={(v) => v && handleProvinceChange(v)}>
              <SelectTrigger className="border-gold/20 h-8 text-xs flex-1 min-w-0">
                <SelectValue>{province}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {PROVINCES.map(p => (
                  <SelectItem key={p.name} value={p.name} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={cityName} onValueChange={(v) => v && handleCityNameChange(v)}>
              <SelectTrigger className="border-gold/20 h-8 text-xs flex-1 min-w-0">
                <SelectValue>{cityName}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {cityList.map(ct => (
                  <SelectItem key={ct.name} value={ct.name} className="text-xs">{ct.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={district} onValueChange={(v) => v && setDistrict(v)}>
              <SelectTrigger className="border-gold/20 h-8 text-xs flex-1 min-w-0">
                <SelectValue>{district}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {districtList.map(d => (
                  <SelectItem key={d.name} value={d.name} className="text-xs">{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1">
            <Input type="text" placeholder="出生地名（选填，如 东京）" value={manualPlace}
              onChange={(e) => setManualPlace(e.target.value)}
              className="border-gold/20 h-8 text-xs focus:border-gold/50" />
            <div className="flex gap-1">
              <Input type="text" inputMode="decimal" placeholder="经度 139.80" value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className="border-gold/20 h-8 text-xs focus:border-gold/50 flex-1 min-w-0" />
              <Input type="text" inputMode="decimal" title="出生地纬度（北纬正、南纬负），用于地利寒热判断，选填"
                placeholder="纬度 35.68" value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="border-gold/20 h-8 text-xs focus:border-gold/50 flex-1 min-w-0" />
              <Input type="text" inputMode="decimal" title="出生地时区 UTC 偏移（小时），如东京 9、纽约 -5"
                placeholder="UTC" value={manualTz}
                onChange={(e) => setManualTz(e.target.value)}
                className="border-gold/20 h-8 text-xs focus:border-gold/50 w-14 shrink-0" />
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-tight">
              东经正/西经负、北纬正/南纬负；末位填时区(默认8=北京)。纬度用于地利寒热(选填)。国外出生请填当地时刻+当地时区。
            </p>
          </div>
        )}
      </div>
      <div className="space-y-1 w-[calc(33.333%-8px)] min-w-[200px] flex-1">
        <Label className="text-xs">常居住地（影响 AI 对八字的分析）</Label>
        <Input type="text" placeholder="如：上海" value={livingPlace}
          onChange={(e) => setLivingPlace(e.target.value)}
          className="border-gold/20 h-8 text-xs focus:border-gold/50" />
      </div>
      <div className="w-full space-y-1">
        <Label className="text-xs">备注</Label>
        <Input type="text" placeholder="有什么需要告诉 AI 的都可以写在这里" value={userNote}
          onChange={(e) => setUserNote(e.target.value)}
          className="border-gold/20 h-8 text-xs focus:border-gold/50" />
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
      <Card className="border-gold/30 glow-gold overflow-hidden">
        <CardHeader style={{ display: 'flex' }} className="pillar-card-bg border-b border-gold/20 min-h-[52px] items-center justify-center py-3">
          <p className="text-sm text-muted-foreground text-center w-full">输入出生信息，一键生成完整八字命盘（网站不保存用户任何信息，隐私绝对安全）</p>
        </CardHeader>
        <CardContent className="pt-6">
          {/* 模式切换 */}
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg mb-5">
            {(Object.keys(MODE_LABELS) as InputMode[]).map((m) => (
              <button key={m} type="button"
                onClick={() => { setMode(m); setLookupResults([]); setLookupError(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  mode === m
                    ? 'bg-background shadow-sm text-crimson dark:text-gold border border-gold/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {MODE_LABELS[m].icon}
                {MODE_LABELS[m].label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* 公历 / 农历 模式 */}
            {(mode === 'solar' || mode === 'lunar') && (
              <motion.form key={mode}
                initial={{ opacity: 0, x: mode === 'lunar' ? 20 : -20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'lunar' ? -20 : 20 }} transition={{ duration: 0.25 }}
                onSubmit={handleSubmit} className="space-y-5"
              >
                {renderDateInputs()}
                {mode === 'lunar' && renderLeapMonthRow()}
                {renderCommonSelects()}
                {lookupError && <p className="text-xs text-destructive">{lookupError}</p>}
                <Button type="submit" disabled={loading}
                  className="w-full h-12 text-base font-bold crimson-gradient text-white hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-red-900/20 dark:shadow-red-900/40">
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" />一键排盘</>
                  )}
                </Button>
              </motion.form>
            )}

            {/* 八字反查模式 */}
            {mode === 'bazi' && (
              <motion.div key="bazi" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-5">

                {/* 8 个独立天干/地支选择 */}
                <div className="grid grid-cols-4 gap-x-3 gap-y-2">
                  <div className="text-xs font-medium text-left">年柱</div>
                  <div className="text-xs font-medium text-left">月柱</div>
                  <div className="text-xs font-medium text-left">日柱</div>
                  <div className="text-xs font-medium text-left">时柱</div>
                  {renderGanOrZhiSelect('天干', yearGan, setYearGan, TIAN_GAN)}
                  {renderGanOrZhiSelect('天干', monthGan, setMonthGan, TIAN_GAN)}
                  {renderGanOrZhiSelect('天干', dayGan, setDayGan, TIAN_GAN)}
                  {renderGanOrZhiSelect('天干', timeGan, setTimeGan, TIAN_GAN)}
                  {renderGanOrZhiSelect('地支', yearZhi, setYearZhi, DI_ZHI)}
                  {renderGanOrZhiSelect('地支', monthZhi, setMonthZhi, DI_ZHI)}
                  {renderGanOrZhiSelect('地支', dayZhi, setDayZhi, DI_ZHI)}
                  {renderGanOrZhiSelect('地支', timeZhi, setTimeZhi, DI_ZHI)}
                </div>

                {renderCommonSelects()}
                {lookupError && <p className="text-xs text-destructive">{lookupError}</p>}

                <Button type="button" disabled={loading} onClick={handleBaziLookup}
                  className="w-full h-12 text-base font-bold crimson-gradient text-white hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-red-900/20 dark:shadow-red-900/40">
                  <Search className="w-5 h-5 mr-2" />反查匹配日期
                </Button>

                <AnimatePresence>
                  {lookupResults.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                      <p className="text-xs text-muted-foreground">找到 {lookupResults.length} 个匹配结果，点击选择：</p>
                      {lookupResults.map((r, idx) => (
                        <motion.button key={idx} type="button"
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          onClick={() => handleSelectLookupResult(r)} disabled={loading}
                          className="w-full flex items-center justify-between p-3 rounded-lg border border-gold/20 bg-card hover:bg-accent/50 hover:border-gold/40 transition-all cursor-pointer text-left">
                          <div className="space-y-0.5">
                            <div className="text-sm font-medium">公历：{r.solar}</div>
                            {r.lunar && <div className="text-xs text-muted-foreground">农历：{r.lunar}</div>}
                          </div>
                          <Badge variant="outline" className="border-gold/30 text-gold shrink-0 ml-2">选择排盘</Badge>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
