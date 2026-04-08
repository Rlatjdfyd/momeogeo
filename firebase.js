// =============================================
// Firebase 초기화
// =============================================

// ⚠️ 아래 설정값을 Firebase 콘솔에서 발급받은 값으로 교체하세요
// https://console.firebase.google.com → 프로젝트 설정 → 웹 앱 추가
const firebaseConfig = {
  apiKey:            "AIzaSyBeLHp5qvmkxVk0NZfvbdhpGxxalIxI0xA",
  authDomain:        "grub-8efb2.firebaseapp.com",
  databaseURL:       "https://grub-8efb2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "grub-8efb2",
  storageBucket:     "grub-8efb2.firebasestorage.app",
  messagingSenderId: "1096260510630",
  appId:             "1:1096260510630:web:cf3e814f69f66398b1a567"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// DB 경로 참조
const REFS = {
  members:     () => db.ref('/members'),
  member:      (id) => db.ref(`/members/${id}`),
  records:     () => db.ref('/lunchRecords'),
  record:      (id) => db.ref(`/lunchRecords/${id}`),
  restaurants: () => db.ref('/restaurants'),
  restaurant:  (id) => db.ref(`/restaurants/${id}`),
  weeklyOrder: () => db.ref('/weeklyOrder'),
  weekOrder:   (key) => db.ref(`/weeklyOrder/${key}`),
  todayOrder:  () => db.ref('/todayOrder'),  // 오늘 실시간 주문 상태
};

// =============================================
// 유틸
// =============================================
function genId() {
  return db.ref().push().key;
}

// 스냅샷 → 배열 변환
function snapToArray(snapshot) {
  const result = [];
  snapshot.forEach(child => {
    result.push({ id: child.key, ...child.val() });
  });
  return result;
}

// =============================================
// 멤버 CRUD
// =============================================
const MemberDB = {

  // 전체 조회 (1회)
  async getAll() {
    const snap = await REFS.members().once('value');
    return snapToArray(snap);
  },

  // 실시간 구독
  onValue(callback) {
    REFS.members().on('value', snap => {
      callback(snapToArray(snap));
    });
  },

  // 추가
  async add(name) {
    const id = genId();
    await REFS.member(id).set({
      name,
      payCount: 0,
      createdAt: Date.now()
    });
    return id;
  },

  // 이름 수정
  async updateName(id, name) {
    await REFS.member(id).update({ name });
  },

  // 결제 횟수 변경 (+1 or -1 or 직접 지정)
  async updatePayCount(id, delta) {
    const snap = await REFS.member(id).child('payCount').once('value');
    const current = snap.val() || 0;
    const next = Math.max(0, current + delta);
    await REFS.member(id).update({ payCount: next });
  },

  // 결제 횟수 직접 설정
  async setPayCount(id, count) {
    await REFS.member(id).update({ payCount: Math.max(0, count) });
  },

  // 삭제
  async delete(id) {
    await REFS.member(id).remove();
  }
};

// =============================================
// 식사 기록 CRUD
// =============================================
const RecordDB = {

  // 전체 조회
  async getAll() {
    const snap = await REFS.records().orderByChild('date').once('value');
    return snapToArray(snap).reverse(); // 최신순
  },

  // 실시간 구독
  onValue(callback) {
    REFS.records().orderByChild('date').on('value', snap => {
      const records = snapToArray(snap).reverse().map(r => ({
        ...r,
        totalAmount: Number(r.totalAmount) || 0  // 문자열 → 숫자 보정
      }));
      callback(records);
    });
  },

  // 오늘 기록 존재 여부
  async getTodayRecord(dateStr) {
    const snap = await REFS.records()
      .orderByChild('date')
      .equalTo(dateStr)
      .once('value');
    const arr = snapToArray(snap);
    return arr.length > 0 ? arr[0] : null;
  },

  // 추가
  async add(data) {
    const id = genId();
    await REFS.record(id).set({
      ...data,
      createdAt: Date.now()
    });
    return id;
  },

  // 수정
  async update(id, data) {
    await REFS.record(id).update(data);
  },

  // 삭제 (결제 횟수도 롤백)
  async delete(id) {
    const snap = await REFS.record(id).once('value');
    const record = snap.val();
    if (record && record.payerId && !record.payerIsGuest) {
      await MemberDB.updatePayCount(record.payerId, -1);
    }
    await REFS.record(id).remove();
  }
};

// =============================================
// 식당 CRUD
// =============================================
const RestaurantDB = {

  async getAll() {
    const snap = await REFS.restaurants().once('value');
    return snapToArray(snap);
  },

  onValue(callback) {
    REFS.restaurants().on('value', snap => {
      callback(snapToArray(snap));
    });
  },

  async add(name, menus = []) {
    const id = genId();
    await REFS.restaurant(id).set({ name, menus });
    return id;
  },

  async update(id, data) {
    await REFS.restaurant(id).update(data);
  },

  async delete(id) {
    await REFS.restaurant(id).remove();
  }
};

// =============================================
// 오늘 주문 실시간 동기화
// =============================================
const TodayOrderDB = {

  // 오늘 주문 상태 전체 조회
  async get() {
    const snap = await REFS.todayOrder().once('value');
    return snap.val();
  },

  // 실시간 구독 (누군가 바꾸면 모두에게 즉시 반영)
  onValue(callback) {
    REFS.todayOrder().on('value', snap => {
      callback(snap.val());
    });
  },

  // 식당 선택 (담당자가 설정)
  async setRestaurant(restaurant, payerId, payerName, payerIsGuest) {
    const isGuest = payerIsGuest || false;
    await REFS.todayOrder().update({
      date:         new Date().toISOString().slice(0, 10),
      restaurant:   restaurant || '',
      payerId:      isGuest ? null : (payerId || null),
      payerName:    payerName || '',
      payerIsGuest: isGuest,
      totalAmount:  ''
    });
  },

  // 담당자 변경
  async setPayer(payerId, payerName, payerIsGuest) {
    const isGuest = payerIsGuest || false;
    await REFS.todayOrder().update({
      payerId:      isGuest ? null : (payerId || null),
      payerName:    payerName || '',
      payerIsGuest: isGuest
    });
  },

  // 멤버 참석 토글
  async toggleAttendance(memberId, memberName, attending) {
    await REFS.todayOrder().child(`attendees/${memberId}`).update({
      name:      memberName || '',
      attending: attending === true,
      menu:      ''
    });
  },

  // 멤버 메뉴 선택
  async setMemberMenu(memberId, memberName, menu, attending) {
    await REFS.todayOrder().child(`attendees/${memberId}`).update({
      name:      memberName || '',
      attending: attending === true,
      menu:      menu || ''
    });
  },

  // 게스트 추가
  async addGuest(guestId, name) {
    await REFS.todayOrder().child(`guests/${guestId}`).set({
      name: name || '',
      menu: ''
    });
  },

  // 게스트 메뉴 선택
  async setGuestMenu(guestId, menu) {
    await REFS.todayOrder().child(`guests/${guestId}`).update({ menu: menu || '' });
  },

  // 게스트 삭제
  async removeGuest(guestId) {
    await REFS.todayOrder().child(`guests/${guestId}`).remove();
  },

  // 결제 금액 입력
  async setAmount(amount) {
    await REFS.todayOrder().update({ totalAmount: amount });
  },

  // 오늘 주문 초기화 (등록 완료 후)
  async clear() {
    await REFS.todayOrder().remove();
  },

  // 오늘 날짜 주문인지 확인 (날짜가 바뀌면 자동 초기화)
  async checkAndClearIfOldDate() {
    const snap = await REFS.todayOrder().child('date').once('value');
    const savedDate = snap.val();
    const today = new Date().toISOString().slice(0, 10);
    if (savedDate && savedDate !== today) {
      await this.clear();
    }
  }
};

// =============================================
// 주간 순번 CRUD
// =============================================
const OrderDB = {

  async get(weekKey) {
    const snap = await REFS.weekOrder(weekKey).once('value');
    return snap.val(); // { order: ['id1','id2',...], isManual: bool }
  },

  async save(weekKey, order, isManual = true) {
    await REFS.weekOrder(weekKey).set({ order, isManual });
  },

  // 전체 주간 순번 이력
  async getAll() {
    const snap = await REFS.weeklyOrder().once('value');
    return snap.val() || {};
  }
};
