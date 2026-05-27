'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { REGIONS } from '@/lib/utils';

interface ChecklistItem {
  text: string;
  done: boolean;
  important: boolean;
}

interface ApplyProps {
  currentNick: string;
  currentCoupleCode: string;
  members: string[];
  showToast: (msg: string, isErr?: boolean) => void;
  onSubmitted: () => void;
}

const THEMES = ['로맨틱', '맛집탐방', '액티비티', '힐링', '문화생활', '드라이브'];

export default function Apply({ currentNick, currentCoupleCode, members, showToast, onSubmitted }: ApplyProps) {
  const [recipient, setRecipient] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('14:00');
  const [selTheme, setSelTheme] = useState('');
  const [regionMajor, setRegionMajor] = useState('');
  const [regionSubSearch, setRegionSubSearch] = useState('');
  const [regionSub, setRegionSub] = useState('');
  const [subDropOpen, setSubDropOpen] = useState(false);
  const [subCities, setSubCities] = useState<string[]>([]);
  const [subloc, setSubloc] = useState('');
  const [message, setMessage] = useState('');
  const [checkItems, setCheckItems] = useState<ChecklistItem[]>([]);
  const [newCheck, setNewCheck] = useState('');

  const [errRecipient, setErrRecipient] = useState(false);
  const [errDate, setErrDate] = useState(false);
  const [errTheme, setErrTheme] = useState(false);
  const [errRegion, setErrRegion] = useState(false);

  useEffect(() => {
    if (regionMajor && REGIONS[regionMajor]) {
      setSubCities(REGIONS[regionMajor]);
      setRegionSub('');
      setRegionSubSearch('');
      setSubDropOpen(true);
    } else {
      setSubCities([]);
      setSubDropOpen(false);
    }
  }, [regionMajor]);

  const filteredCities = regionSubSearch
    ? subCities.filter(c => c.includes(regionSubSearch))
    : subCities;

  const handleAddCheck = () => {
    if (!newCheck.trim()) return;
    if (checkItems.length >= 10) { showToast('최대 10개까지 가능해요', true); return; }
    setCheckItems([...checkItems, { text: newCheck.trim(), important: false, done: false }]);
    setNewCheck('');
  };

  const handleStarCheck = (i: number) => {
    const current = checkItems[i];
    if (!current.important && checkItems.filter(c => c.important).length >= 3) {
      showToast('중요 표시는 최대 3개', true); return;
    }
    setCheckItems(checkItems.map((c, idx) => idx === i ? { ...c, important: !c.important } : c));
  };

  const handleDelCheck = (i: number) => {
    setCheckItems(checkItems.filter((_, idx) => idx !== i));
  };

  const handleSaveSubloc = async () => {
    const regionFull = regionMajor ? (regionSub ? regionMajor + ' · ' + regionSub : regionMajor) : '';
    if (!subloc.trim() || !regionFull) { showToast('지역과 세부 장소를 입력해주세요', true); return; }
    await addDoc(collection(db, 'places'), {
      name: subloc.trim(), region: regionFull, memo: '', category: 'visited',
      coupleCode: currentCoupleCode, createdAt: serverTimestamp()
    });
    showToast('장소가 저장됐어요! 📍');
  };

  const handleSubmit = async () => {
    let valid = true;
    if (!recipient) { setErrRecipient(true); valid = false; } else setErrRecipient(false);
    if (!date) { setErrDate(true); valid = false; } else setErrDate(false);
    if (!selTheme) { setErrTheme(true); valid = false; } else setErrTheme(false);
    if (!regionMajor) { setErrRegion(true); valid = false; } else setErrRegion(false);
    if (!valid) return;

    const regionFull = regionMajor ? (regionSub ? regionMajor + ' · ' + regionSub : regionMajor) : '';
    await addDoc(collection(db, 'requests'), {
      fromUser: currentNick, toUser: recipient, date, time,
      theme: selTheme, region: regionFull, subLocation: subloc,
      checklist: checkItems.map(c => ({ ...c })),
      message,
      status: '대기', coupleCode: currentCoupleCode, createdAt: serverTimestamp()
    });

    showToast('Please Woonyo! 신청 완료 💕');
    setCheckItems([]); setSelTheme(''); setRegionMajor('');
    setRegionSub(''); setRegionSubSearch(''); setSubloc('');
    setRecipient(''); setMessage('');
    onSubmitted();
  };

  return (
    <div id="page-apply" className="page active">
      <div className="page-title">데이트 신청 💌</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">누구에게 신청할까요?</label>
          <select
            className={'form-input' + (errRecipient ? ' input-err' : '')}
            value={recipient}
            onChange={e => { setRecipient(e.target.value); setErrRecipient(false); }}
          >
            <option value="">상대방 선택</option>
            {members.filter(m => m !== currentNick).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {errRecipient && <div className="err-hint show">받는 사람을 선택해주세요</div>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">날짜</label>
            <input
              type="date"
              className={'form-input' + (errDate ? ' input-err' : '')}
              value={date}
              onChange={e => { setDate(e.target.value); setErrDate(false); }}
            />
            {errDate && <div className="err-hint show">날짜를 골라주세요</div>}
          </div>
          <div className="form-group">
            <label className="form-label">시간</label>
            <input
              type="time"
              className="form-input"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">테마</label>
          <div className="theme-grid">
            {THEMES.map(t => (
              <button
                key={t}
                className={'theme-chip' + (selTheme === t ? ' selected' : '')}
                onClick={() => { setSelTheme(t); setErrTheme(false); }}
              >{t}</button>
            ))}
          </div>
          {errTheme && <div className="err-hint show">테마를 골라주세요</div>}
        </div>

        <div className="form-group">
          <label className="form-label">지역</label>
          <select
            className={'form-input' + (errRegion ? ' input-err' : '')}
            value={regionMajor}
            onChange={e => { setRegionMajor(e.target.value); setErrRegion(false); }}
          >
            <option value="">1단계: 도/광역시 선택</option>
            {Object.keys(REGIONS).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {errRegion && <div className="err-hint show">지역 대분류를 선택해주세요</div>}
          {regionMajor && REGIONS[regionMajor] && (
            <div className="region-sub-wrap" style={{ position: 'relative', marginTop: '8px' }}>
              <input
                type="text"
                className="region-sub-search"
                placeholder="시/군 검색 또는 선택..."
                value={regionSubSearch}
                onChange={e => { setRegionSubSearch(e.target.value); setRegionSub(''); setSubDropOpen(true); }}
                onFocus={() => setSubDropOpen(true)}
              />
              {subDropOpen && filteredCities.length > 0 && (
                <div className="region-sub-dropdown open" style={{ display: 'block' }}>
                  {filteredCities.map(c => (
                    <div
                      key={c}
                      className={'region-sub-opt' + (regionSub === c ? ' selected' : '')}
                      onClick={() => {
                        setRegionSub(c);
                        setRegionSubSearch(c);
                        setSubDropOpen(false);
                      }}
                    >{c}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">세부 장소</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="예) 수성못, 동성로"
              value={subloc}
              onChange={e => setSubloc(e.target.value)}
            />
            <button className="btn btn-outline btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={handleSaveSubloc}>저장</button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">체크리스트 <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '12px' }}>(별표 최대 3개)</span></label>
          <div>
            {checkItems.map((c, i) => (
              <div key={i} className="check-item">
                <span className={'check-text' + (c.important ? ' imp' : '')}>{c.text}</span>
                {c.important && <span className="imp-badge">중요</span>}
                <button className={'star-btn' + (c.important ? ' on' : '')} onClick={() => handleStarCheck(i)}>★</button>
                <button className="del-btn" onClick={() => handleDelCheck(i)}>×</button>
              </div>
            ))}
          </div>
          <div className="add-row">
            <input
              type="text"
              className="form-input"
              placeholder="할 것 추가..."
              value={newCheck}
              onChange={e => setNewCheck(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddCheck(); }}
            />
            <button className="btn btn-outline btn-sm" onClick={handleAddCheck}>추가</button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">한마디</label>
          <textarea
            className="form-input"
            placeholder="전하고 싶은 말 💕"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>

        <button className="please-btn" onClick={handleSubmit}>Please Woonyo! 💕</button>
      </div>
    </div>
  );
}
