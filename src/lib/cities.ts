export interface CityInfo {
  name: string;
  province: string;
  longitude: number;
}

export interface ProvinceGroup {
  province: string;
  cities: CityInfo[];
}

const raw: CityInfo[] = [
  // 直辖市
  { name: '北京', province: '北京', longitude: 116.40 },
  { name: '天津', province: '天津', longitude: 117.20 },
  { name: '上海', province: '上海', longitude: 121.47 },
  { name: '重庆', province: '重庆', longitude: 106.55 },
  // 黑龙江
  { name: '哈尔滨', province: '黑龙江', longitude: 126.63 },
  { name: '齐齐哈尔', province: '黑龙江', longitude: 123.97 },
  { name: '大庆', province: '黑龙江', longitude: 125.10 },
  // 吉林
  { name: '长春', province: '吉林', longitude: 125.32 },
  { name: '吉林市', province: '吉林', longitude: 126.55 },
  // 辽宁
  { name: '沈阳', province: '辽宁', longitude: 123.43 },
  { name: '大连', province: '辽宁', longitude: 121.62 },
  { name: '鞍山', province: '辽宁', longitude: 122.99 },
  // 内蒙古
  { name: '呼和浩特', province: '内蒙古', longitude: 111.75 },
  { name: '包头', province: '内蒙古', longitude: 109.84 },
  // 河北
  { name: '石家庄', province: '河北', longitude: 114.48 },
  { name: '唐山', province: '河北', longitude: 118.18 },
  { name: '保定', province: '河北', longitude: 115.46 },
  // 山西
  { name: '太原', province: '山西', longitude: 112.53 },
  { name: '大同', province: '山西', longitude: 113.30 },
  // 山东
  { name: '济南', province: '山东', longitude: 117.00 },
  { name: '青岛', province: '山东', longitude: 120.38 },
  { name: '烟台', province: '山东', longitude: 121.39 },
  { name: '潍坊', province: '山东', longitude: 119.16 },
  // 河南
  { name: '郑州', province: '河南', longitude: 113.62 },
  { name: '洛阳', province: '河南', longitude: 112.45 },
  { name: '开封', province: '河南', longitude: 114.35 },
  // 陕西
  { name: '西安', province: '陕西', longitude: 108.95 },
  { name: '咸阳', province: '陕西', longitude: 108.71 },
  { name: '宝鸡', province: '陕西', longitude: 107.14 },
  // 甘肃
  { name: '兰州', province: '甘肃', longitude: 103.73 },
  { name: '天水', province: '甘肃', longitude: 105.72 },
  // 宁夏
  { name: '银川', province: '宁夏', longitude: 106.27 },
  // 青海
  { name: '西宁', province: '青海', longitude: 101.78 },
  // 新疆
  { name: '乌鲁木齐', province: '新疆', longitude: 87.68 },
  { name: '喀什', province: '新疆', longitude: 75.99 },
  // 西藏
  { name: '拉萨', province: '西藏', longitude: 91.11 },
  // 四川
  { name: '成都', province: '四川', longitude: 104.06 },
  { name: '绵阳', province: '四川', longitude: 104.73 },
  { name: '宜宾', province: '四川', longitude: 104.63 },
  // 贵州
  { name: '贵阳', province: '贵州', longitude: 106.71 },
  { name: '遵义', province: '贵州', longitude: 106.93 },
  // 云南
  { name: '昆明', province: '云南', longitude: 102.73 },
  { name: '大理', province: '云南', longitude: 100.23 },
  // 广西
  { name: '南宁', province: '广西', longitude: 108.33 },
  { name: '桂林', province: '广西', longitude: 110.29 },
  { name: '柳州', province: '广西', longitude: 109.41 },
  // 广东
  { name: '广州', province: '广东', longitude: 113.23 },
  { name: '深圳', province: '广东', longitude: 114.07 },
  { name: '东莞', province: '广东', longitude: 113.75 },
  { name: '佛山', province: '广东', longitude: 113.12 },
  { name: '珠海', province: '广东', longitude: 113.58 },
  // 海南
  { name: '海口', province: '海南', longitude: 110.35 },
  { name: '三亚', province: '海南', longitude: 109.51 },
  // 湖北
  { name: '武汉', province: '湖北', longitude: 114.31 },
  { name: '宜昌', province: '湖北', longitude: 111.29 },
  { name: '襄阳', province: '湖北', longitude: 112.14 },
  // 湖南
  { name: '长沙', province: '湖南', longitude: 112.97 },
  { name: '株洲', province: '湖南', longitude: 113.13 },
  { name: '衡阳', province: '湖南', longitude: 112.57 },
  // 江苏
  { name: '南京', province: '江苏', longitude: 118.78 },
  { name: '苏州', province: '江苏', longitude: 120.62 },
  { name: '无锡', province: '江苏', longitude: 120.30 },
  { name: '常州', province: '江苏', longitude: 119.97 },
  // 安徽
  { name: '合肥', province: '安徽', longitude: 117.28 },
  { name: '芜湖', province: '安徽', longitude: 118.38 },
  // 浙江
  { name: '杭州', province: '浙江', longitude: 120.15 },
  { name: '宁波', province: '浙江', longitude: 121.55 },
  { name: '温州', province: '浙江', longitude: 120.67 },
  { name: '金华', province: '浙江', longitude: 119.65 },
  // 福建
  { name: '福州', province: '福建', longitude: 119.30 },
  { name: '厦门', province: '福建', longitude: 118.10 },
  { name: '泉州', province: '福建', longitude: 118.59 },
  // 江西
  { name: '南昌', province: '江西', longitude: 115.89 },
  { name: '九江', province: '江西', longitude: 115.99 },
  // 台湾
  { name: '台北', province: '台湾', longitude: 121.57 },
  { name: '高雄', province: '台湾', longitude: 120.31 },
  // 香港 / 澳门
  { name: '香港', province: '香港', longitude: 114.17 },
  { name: '澳门', province: '澳门', longitude: 113.55 },
];

export const CITY_LIST: CityInfo[] = raw;

export const PROVINCE_GROUPS: ProvinceGroup[] = (() => {
  const map = new Map<string, CityInfo[]>();
  for (const c of raw) {
    if (!map.has(c.province)) map.set(c.province, []);
    map.get(c.province)!.push(c);
  }
  return Array.from(map.entries()).map(([province, cities]) => ({ province, cities }));
})();

export function getCityByName(name: string): CityInfo | undefined {
  return raw.find(c => c.name === name);
}
