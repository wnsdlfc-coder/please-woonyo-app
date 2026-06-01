@AGENTS.md

# please-woonyo-app

커플 데이트 앱 프로토타입. 데이트 신청 → 수락 → 일기 기록 → 지역/지도 시각화 흐름이 핵심.

## 기술 스택

- **Next.js 16.2.6** (주의: 표준 Next.js와 다른 breaking changes 버전 — 코드 작성 전 AGENTS.md 필독)
- **React 19**, **TypeScript**
- **TailwindCSS 4**
- **Firebase**: Auth + Firestore (실시간 onSnapshot 기반)
- **배포**: Vercel (please-woonyo.vercel.app)

## 프로젝트 구조

```
app/page.tsx           # 루트 — 모든 상태 관리, Firebase 구독
components/
  AuthScreen.tsx       # 로그인
  CoupleSetup.tsx      # 커플 방 생성/입장
  AppBar.tsx           # 상단 바
  BottomNav.tsx        # 하단 탭 네비게이션
  Toast.tsx            # 토스트 알림
  Modal.tsx            # 확인 모달
  pages/
    Home.tsx           # 홈 (데이트 요청 현황)
    Apply.tsx          # 데이트 신청
    CalendarPage.tsx   # 캘린더 (기념일, 일정)
    MapPage.tsx        # 지도/지역 뷰 (다녀온 곳, 가고 싶은 곳)
    MyPage.tsx         # 마이페이지 (일기, 쪽지, 장소 등)
lib/
  firebase.ts          # Firebase 설정
  mapData.ts           # 지역 데이터
  utils.ts             # 유틸
```

## Firestore 컬렉션

| 컬렉션 | 설명 | 주요 필드 |
|--------|------|-----------|
| `requests` | 데이트 신청 | fromUser, toUser, date, time, theme, region, status, checklist, coupleCode |
| `diaries` | 데이트 일기 | reqId, date, title, content, star, tags, author, comments, coupleCode |
| `places` | 장소 기록 | name, region, category(visited/wanna), memo, coupleCode |
| `notes` | 커플 쪽지 | fromUser, toUser, text, read, coupleCode |
| `anniversaries` | 기념일 | name, date, emoji, repeat, coupleCode |
| `schedules` | 일정 | title, date, description, createdBy, roomId |
| `bucketlist` | 가고싶은 지역 | region, regionName, memo, roomId |
| `users` | 유저 프로필 | uid, nickname, coupleCode, kicked |
| `rooms` | 커플 방 | members[] |

## 핵심 흐름

1. **인증**: Firebase Auth → 닉네임 설정 → 커플 코드로 방 입장
2. **데이트 신청**: Apply 페이지에서 상대방에게 신청 (날짜/시간/테마/지역)
3. **수락/거절**: Home에서 상대방 신청 확인 후 처리
4. **일기 작성**: 수락된 데이트 완료 후 일기 작성 (별점, 태그 포함)
5. **지도 기록**: MapPage에서 다녀온 곳 / 가고 싶은 곳 관리
6. **강퇴 시스템**: kicked 필드로 방에서 내보내기 가능

## 개발 명령어

```bash
npm run dev    # 개발 서버 (localhost:3000)
npm run build  # 빌드
npm run lint   # 린트
```

## 주의사항

- 모든 데이터는 `coupleCode`(또는 `roomId`)로 필터링됨 — 쿼리 시 반드시 포함
- `status` 값: `'수락'` 또는 `'accepted'` 둘 다 사용 중 (혼재 상태)
- bucketlist는 중복 제거 로직이 Firestore 단에서 처리됨
- `.env.local`에 Firebase 설정값 있음 (커밋 금지)
