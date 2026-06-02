'use client';
import { useState } from 'react';
import { REGIONS } from '@/lib/utils';

interface PlaceAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; region: string; category: 'visited' | 'wanna'; memo: string }) => void;
}

export default function PlaceAddModal({ isOpen, onClose, onSave }: PlaceAddModalProps) {
  const [placeName, setPlaceName] = useState('');
  const [placeRegion, setPlaceRegion] = useState('');
  const [placeCat, setPlaceCat] = useState<'visited' | 'wanna'>('visited');
  const [placeMemo, setPlaceMemo] = useState('');
  const [placeRegionOpen, setPlaceRegionOpen] = useState(false);

  const handleSave = () => {
    onSave({ name: placeName, region: placeRegion, category: placeCat, memo: placeMemo });
    setPlaceName(''); setPlaceRegion(''); setPlaceMemo('');
  };

  return (
    <div className={'modal-bg' + (isOpen ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-bar" />
        <div className="modal-title">장소 추가 📍</div>
        <div className="form-group">
          <label className="form-label">지역</label>
          <div className="region-wrap">
            <button className={'region-btn' + (placeRegionOpen ? ' open' : '')} onClick={() => setPlaceRegionOpen(v => !v)}>
              <span>{placeRegion || '지역을 선택하세요'}</span><span>▾</span>
            </button>
            {placeRegionOpen && (
              <div className="region-dropdown open">
                {Object.entries(REGIONS).map(([group, cities]) => (
                  <div key={group}>
                    <div className="region-group-title">{group}</div>
                    {cities.map(city => (
                      <div
                        key={city}
                        className={'region-opt' + (placeRegion === city ? ' selected' : '')}
                        onClick={() => { setPlaceRegion(city); setPlaceRegionOpen(false); }}
                      >{city}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">장소명</label>
          <input type="text" className="form-input" placeholder="예) 수성못" value={placeName} onChange={e => setPlaceName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">카테고리</label>
          <select className="form-input" value={placeCat} onChange={e => setPlaceCat(e.target.value as 'visited' | 'wanna')}>
            <option value="visited">가봤던 곳</option>
            <option value="wanna">가고싶은 곳</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">메모</label>
          <input type="text" className="form-input" placeholder="기억나는 것..." value={placeMemo} onChange={e => setPlaceMemo(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline btn-full" onClick={onClose}>취소</button>
          <button className="btn btn-rose btn-full" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
