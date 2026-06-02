export interface Place {
  id: string;
  name: string;
  region: string;
  memo?: string;
  category: 'visited' | 'wanna';
  coupleCode: string;
}

export interface Bucketlist {
  id: string;
  roomId: string;
  region: string;
  regionName?: string;
  createdBy?: string;
  createdAt?: { toDate?: () => Date; seconds?: number };
  memo?: string;
}

export interface DateRequest {
  id: string;
  date: string;
  time: string;
  theme: string;
  region: string;
  subLocation?: string;
  status: string;
}

export interface Diary {
  id: string;
  reqId?: string;
  date: string;
  title: string;
  star?: number;
  region?: string;
}

export type PlaceTab = 'visited' | 'wanna' | 'stats';

export interface MapPageProps {
  currentNick: string;
  currentCoupleCode: string;
  allPlaces: Place[];
  allBucketlist: Bucketlist[];
  allRequests: DateRequest[];
  allAnniversaries: { id: string; date: string }[];
  allDiaries: Diary[];
  showToast: (msg: string, isErr?: boolean) => void;
  showConfirm: (msg: string, onOk: () => void) => void;
}
