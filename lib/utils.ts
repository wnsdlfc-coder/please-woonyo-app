export const REGIONS: Record<string, string[]> = {
  '서울특별시': ['서울','강남','홍대','이태원','종로','한강','성수','마포','잠실','신촌','명동','인사동','북촌','을지로','여의도'],
  '경기도': ['수원','성남','용인','고양','남양주','의정부','파주','김포','안양','부천','구리','시흥','화성','안산','평택','오산','광주','하남','이천','양평','가평','포천','동두천','여주','연천'],
  '인천광역시': ['인천','부평','계양','강화','송도','영종'],
  '부산광역시': ['부산','해운대','광안리','남포동','서면','기장','영도','수영'],
  '대구광역시': ['대구','수성못','동성로','앞산','달성','군위'],
  '광주광역시': ['광주'],
  '대전광역시': ['대전'],
  '울산광역시': ['울산','언양','온산'],
  '세종특별자치시': ['세종'],
  '강원특별자치도': ['강릉','춘천','속초','원주','평창','정선','동해','삼척','태백','양양','홍천','인제','횡성','영월','화천','양구','고성','철원'],
  '충청북도': ['청주','충주','제천','보은','옥천','영동','진천','괴산','음성','단양','증평'],
  '충청남도': ['천안','공주','아산','홍성','보령','서산','논산','당진','예산','태안','청양','부여','서천','계룡'],
  '전북특별자치도': ['전주','군산','익산','남원','정읍','김제','완주','진안','무주','장수','임실','순창','고창','부안'],
  '전라남도': ['여수','순천','목포','광양','나주','담양','곡성','구례','고흥','보성','화순','장흥','강진','해남','영암','무안','함평','영광','장성','완도','진도','신안'],
  '경상북도': ['포항','경주','안동','구미','영주','영천','상주','문경','경산','군위','의성','청송','영양','영덕','청도','고령','성주','칠곡','예천','봉화','울진','울릉'],
  '경상남도': ['창원','진주','통영','사천','김해','밀양','거제','양산','마산','의령','함안','창녕','고성','남해','하동','산청','함양','거창','합천'],
  '제주특별자치도': ['제주시','서귀포','애월','성산','중문','협재','한림','모슬포','표선'],
  '기타': ['기타'],
};

export function heatColor(n: number): string {
  if (!n) return '#E8E8E8';
  if (n <= 2) return '#FFD6E7';
  if (n <= 5) return '#FF8FB1';
  if (n <= 8) return '#FF6B9D';
  if (n <= 10) return '#E8456A';
  return '#C0392B';
}

export function getRegionGroup(region: string): string {
  if (!region) return '기타';
  const base = region.split(' · ')[0].trim();
  if (REGIONS[base]) return base;
  const legacy: Record<string, string> = {
    '수도권': '서울특별시', '경상': '경상북도', '전라': '전라남도',
    '충청': '충청남도', '강원': '강원특별자치도', '제주': '제주특별자치도'
  };
  if (legacy[base]) return legacy[base];
  for (const [g, cities] of Object.entries(REGIONS)) {
    if (cities.includes(base) || cities.includes(region)) return g;
  }
  const stripped = base.replace(/특별자치도$|특별자치시$|광역시$|특별시$|시$|군$|구$/, '');
  if (stripped !== base) {
    if (REGIONS[stripped]) return stripped;
    for (const [g, cities] of Object.entries(REGIONS)) {
      if (cities.includes(stripped)) return g;
    }
  }
  for (const [g, cities] of Object.entries(REGIONS)) {
    if (cities.some(c => base.startsWith(c) || c.startsWith(base))) return g;
  }
  return '기타';
}

export function simplifyRegionName(n: string): string {
  if (!n) return n;
  const special: Record<string, string> = {
    '포항시북구': '포항', '포항시남구': '포항',
    '마산합포구': '마산', '마산회원구': '마산',
    '부산광역시': '부산', '제주특별자치도': '제주',
    '세종특별자치시': '세종', '서울특별시': '서울',
    '인천광역시': '인천', '대구광역시': '대구',
    '광주광역시': '광주', '대전광역시': '대전',
    '울산광역시': '울산',
  };
  if (special[n]) return special[n];
  const districtMatch = n.match(/^(.+?시)[가-힣]+구$/);
  if (districtMatch) return districtMatch[1].replace(/시$/, '');
  return n
    .replace(/특별자치도$|특별자치시$|광역시$|특별시$/, '')
    .replace(/시$|군$|구$/, '');
}

export function getDday(dateStr: string, repeat: boolean): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let target = new Date(dateStr);
  if (repeat) {
    target.setFullYear(today.getFullYear());
    if (target < today) target.setFullYear(today.getFullYear() + 1);
  }
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'D-Day';
  if (diff > 0) return 'D-' + diff;
  return 'D+' + Math.abs(diff);
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요 ☀️';
  if (h < 18) return '즐거운 오후예요 🌤️';
  return '좋은 저녁이에요 🌙';
}

export function formatTime(ts: { toDate?: () => Date; seconds?: number } | null | undefined): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : new Date();
  return (
    d.getFullYear() + '.' +
    String(d.getMonth() + 1).padStart(2, '0') + '.' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0')
  );
}

export const AUTH_ERR: Record<string, string> = {
  'auth/email-already-in-use': '이미 사용 중인 이메일이에요',
  'auth/invalid-email': '이메일 형식이 올바르지 않아요',
  'auth/weak-password': '비밀번호는 6자 이상이어야 해요',
  'auth/user-not-found': '등록되지 않은 이메일이에요',
  'auth/wrong-password': '비밀번호가 틀렸어요',
  'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않아요',
  'auth/too-many-requests': '잠시 후 다시 시도해주세요',
};
