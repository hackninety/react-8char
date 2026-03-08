const p = require('mystilight-8char');
const paipan = p.default || p;

console.log('fromBaZi exists?', typeof p.fromBaZi);
if (p.fromBaZi) {
  const dates = p.fromBaZi('庚午', '辛巳', '庚辰', '癸未', 2, 1990);
  console.log('fromBaZi test:', dates);
}

console.log('Lunar exists?', typeof p.Lunar);
if (p.Lunar) {
  console.log(Object.keys(p.Lunar));
  // test lunar to solar
  try {
     const lunar = p.Lunar.fromYmd(1990, 4, 21); // lunar 1990-04-21
     console.log('Lunar to solar:', lunar.getSolar().toYmd());
  } catch (e) {
     console.log('Lunar error:', e);
  }
}
