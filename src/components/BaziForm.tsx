import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MapPin, Calendar, Search, Moon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { TIAN_GAN, DI_ZHI, lunarToSolar, reverseLookupBazi } from '@/lib/bazi';
import type { ReverseLookupResult } from '@/lib/bazi';
import { PROVINCES, findLongitude } from '@/lib/cities';

type InputMode = 'solar' | 'lunar' | 'bazi';

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
  const currentYear = new Date().getFullYear();
  const [mode, setMode] = useState<InputMode>('solar');

  // 公历 / 农历 共用
  const [year, setYear] = useState(1990);
  const [month, setMonth] = useState(5);
  const [day, setDay] = useState(15);
  const [hour, setHour] = useState(14);
  const [minute, setMinute] = useState(30);
  const [isLeapMonth, setIsLeapMonth] = useState(false);

  // 共用
  const [gender, setGender] = useState<0 | 1>(1);
  const [sect, setSect] = useState<1 | 2>(2);
  const [useTrueSolar, setUseTrueSolar] = useState(true);
  const [province, setProvince] = useState('北京');
  const [cityName, setCityName] = useState('北京');
  const [district, setDistrict] = useState(PROVINCES[0].cities[0].districts[0].name);

  // 八字反查 — 8 个独立天干地支
  const [yearGan, setYearGan] = useState('');
  const [yearZhi, setYearZhi] = useState('');
  const [monthGan, setMonthGan] = useState('');
  const [monthZhi, setMonthZhi] = useState('');
  const [dayGan, setDayGan] = useState('');
  const [dayZhi, setDayZhi] = useState('');
  const [timeGan, setTimeGan] = useState('');
  const [timeZhi, setTimeZhi] = useState('');
  const [lookupResults, setLookupResults] = useState<ReverseLookupResult[]>([]);
  const [lookupError, setLookupError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let solarYear = year, solarMonth = month, solarDay = day, solarHour = hour, solarMinute = minute;
    if (mode === 'lunar') {
      try {
        const solar = lunarToSolar(year, month, day, hour, minute, isLeapMonth);
        solarYear = solar.year;
        solarMonth = solar.month;
        solarDay = solar.day;
        solarHour = solar.hour;
        solarMinute = solar.minute;
      } catch (err: any) {
        setLookupError(`农历转换失败：${err?.message || '日期无效'}`);
        return;
      }
    }
    const lng = useTrueSolar ? findLongitude(province, cityName, district) : undefined;
    onSubmit({
      year: solarYear, month: solarMonth, day: solarDay,
      hour: solarHour, minute: solarMinute,
      gender, sect,
      city: useTrueSolar ? (district === '市区' ? cityName : `${cityName} ${district}`) : undefined,
      longitude: lng,
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
      const results = reverseLookupBazi(yearGZ, monthGZ, dayGZ, timeGZ);
      if (results.length === 0) {
        setLookupError('近60年内未找到匹配的日期，请检查四柱是否正确');
      } else {
        setLookupResults(results);
      }
    } catch (err: any) {
      setLookupError(`反查失败：${err?.message || '未知错误'}`);
    }
  };

  const handleSelectLookupResult = (r: ReverseLookupResult) => {
    const lng = useTrueSolar ? findLongitude(province, cityName, district) : undefined;
    onSubmit({
      year: r.year, month: r.month, day: r.day,
      hour: r.hour, minute: r.minute,
      gender, sect,
      city: useTrueSolar ? (district === '市区' ? cityName : `${cityName} ${district}`) : undefined,
      longitude: lng,
    });
  };

  const renderDateInputs = () => (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="year" className="text-xs">{mode === 'lunar' ? '农历年' : '年'}</Label>
        <Input id="year" type="number" min={1900} max={currentYear} value={year}
          onChange={(e) => setYear(Number(e.target.value))} className="border-gold/20 focus:border-gold/50" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="month" className="text-xs">{mode === 'lunar' ? '农历月' : '月'}</Label>
        <Input id="month" type="number" min={1} max={12} value={month}
          onChange={(e) => setMonth(Number(e.target.value))} className="border-gold/20 focus:border-gold/50" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="day" className="text-xs">{mode === 'lunar' ? '农历日' : '日'}</Label>
        <Input id="day" type="number" min={1} max={31} value={day}
          onChange={(e) => setDay(Number(e.target.value))} className="border-gold/20 focus:border-gold/50" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hour" className="text-xs">时</Label>
        <Input id="hour" type="number" min={0} max={23} value={hour}
          onChange={(e) => setHour(Number(e.target.value))} className="border-gold/20 focus:border-gold/50" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="minute" className="text-xs">分</Label>
        <Input id="minute" type="number" min={0} max={59} value={minute}
          onChange={(e) => setMinute(Number(e.target.value))} className="border-gold/20 focus:border-gold/50" />
      </div>
    </div>
  );

  const renderLeapMonthToggle = () => (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={isLeapMonth} onChange={(e) => setIsLeapMonth(e.target.checked)}
        className="w-4 h-4 rounded border-gold/30 text-crimson accent-[var(--color-crimson)]" />
      <span className="text-xs text-muted-foreground">闰月</span>
    </label>
  );

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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">性别</Label>
          <Select value={String(gender)} onValueChange={(v) => setGender(Number(v) as 0 | 1)}>
            <SelectTrigger className="border-gold/20">
              <SelectValue>{gender === 1 ? '男（乾造）' : '女（坤造）'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">男（乾造）</SelectItem>
              <SelectItem value="0">女（坤造）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">分派</Label>
          <Select value={String(sect)} onValueChange={(v) => setSect(Number(v) as 1 | 2)}>
            <SelectTrigger className="border-gold/20">
              <SelectValue>{sect === 2 ? '传统派' : '正统派'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">传统派</SelectItem>
              <SelectItem value="1">正统派</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {mode !== 'bazi' && (
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={useTrueSolar} onChange={(e) => setUseTrueSolar(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gold/30 accent-[var(--color-crimson)]" />
              <MapPin className="w-3 h-3" />
              真太阳时校正
            </label>
          </Label>
          {useTrueSolar && (
            <div className="grid grid-cols-3 gap-1 pt-0.5">
              <Select value={province} onValueChange={(v) => v && handleProvinceChange(v)}>
                <SelectTrigger className="border-gold/20 h-8 text-xs">
                  <SelectValue>{province}</SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {PROVINCES.map(p => (
                    <SelectItem key={p.name} value={p.name} className="text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={cityName} onValueChange={(v) => v && handleCityNameChange(v)}>
                <SelectTrigger className="border-gold/20 h-8 text-xs">
                  <SelectValue>{cityName}</SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {cityList.map(ct => (
                    <SelectItem key={ct.name} value={ct.name} className="text-xs">{ct.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={district} onValueChange={(v) => v && setDistrict(v)}>
                <SelectTrigger className="border-gold/20 h-8 text-xs">
                  <SelectValue>{district}</SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {districtList.map(d => (
                    <SelectItem key={d.name} value={d.name} className="text-xs">{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
      <Card className="border-gold/30 glow-gold overflow-hidden">
        <CardHeader className="pillar-card-bg border-b border-gold/20">
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-crimson dark:text-gold">
            <Sparkles className="w-5 h-5" />
            八字排盘
          </CardTitle>
          <p className="text-sm text-muted-foreground">输入出生信息，一键生成完整八字命盘</p>
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
                {mode === 'lunar' && (
                  <div className="flex items-center gap-4">
                    {renderLeapMonthToggle()}
                    <span className="text-xs text-muted-foreground">如当月有闰月，请勾选此项</span>
                  </div>
                )}
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
