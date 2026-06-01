import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, deleteDoc, arrayRemove } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBamsaFwG14Va2PAAUDuZw1qZpF7YzB68U',
  authDomain: 'please-woonyo.firebaseapp.com',
  projectId: 'please-woonyo',
  storageBucket: 'please-woonyo.firebasestorage.app',
  messagingSenderId: '496203806109',
  appId: '1:496203806109:web:da7dfb296ad090956d6b74',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TARGET_NICK = '우뇨아들';

async function main() {
  console.log(`🔍 '${TARGET_NICK}' 검색 중...`);

  // 닉네임으로 user 문서 검색
  const usersSnap = await getDocs(query(collection(db, 'users'), where('nickname', '==', TARGET_NICK)));

  if (usersSnap.empty) {
    console.log('❌ 해당 닉네임의 유저를 찾을 수 없어요');
    process.exit(1);
  }

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    console.log(`✅ 찾음: uid=${data.uid || userDoc.id}, coupleCode=${data.coupleCode}`);

    const coupleCode = data.coupleCode;

    // 1. uid 기반 user 문서 업데이트 (coupleCode 제거)
    if (data.uid && data.uid !== userDoc.id) {
      await updateDoc(doc(db, 'users', data.uid), { coupleCode: '', nickname: TARGET_NICK });
      console.log(`📝 users/${data.uid} coupleCode 제거됨`);
    }

    // 2. 닉네임 기반 user 문서 삭제
    await deleteDoc(doc(db, 'users', userDoc.id));
    console.log(`🗑️ users/${userDoc.id} 삭제됨`);

    // 3. 방 members 배열에서 제거
    if (coupleCode && data.uid) {
      try {
        await updateDoc(doc(db, 'rooms', coupleCode), { members: arrayRemove(data.uid) });
        console.log(`🚪 rooms/${coupleCode} 에서 멤버 제거됨`);
      } catch (e) {
        console.log(`⚠️ room 업데이트 실패 (무시 가능):`, e.message);
      }
    }
  }

  // 닉네임 doc (users/우뇨아들) 도 삭제
  try {
    await deleteDoc(doc(db, 'users', TARGET_NICK));
    console.log(`🗑️ users/${TARGET_NICK} 닉네임 문서 삭제됨`);
  } catch {
    // 이미 없으면 무시
  }

  console.log('\n✅ 완료! 우뇨아들이 방에서 제거됐어요.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
