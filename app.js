// =============================================
// 전역 상태
// =============================================
const State = {
  members:     [],   // 고정 멤버 5명
  records:     [],   // 전체 식사 기록
  restaurants: [],   // 식당 즐겨찾기
  weeklyOrder: [],   // 이번 주 순번 (멤버 id 배열)
  isManualOrder: false, // 수동 수정 여부

  // 오늘 점심 입력 임시 상태
  today: {
    payer:       null,   // { id, name, isGuest }
    restaurant:  '',     // 식당명
    attendees:   [],     // [{ id, name, menu, attending }]
    guests:      [],     // [{ name, menu, isPayer }]
    totalAmount: ''
  },

  // UI 상태
  activeTab:       'home',
  recordFilter:    'all',
  amountFilter:    'year',
  selectedDate:    new Date().toISOString().slice(0, 10),
  recordMonth:     new Date().toISOString().slice(0, 7), // 'YYYY-MM'
};

// =============================================
// 날짜 유틸
// =============================================
const DateUtil = {

  // YYYY-MM-DD
  today() {
    return new Date().toISOString().slice(0, 10);
  },

  // 주차 키: "2025-W03"
  weekKey(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const year = d.getFullYear();
    const week = Math.ceil(
      ((d - new Date(year, 0, 1)) / 86400000 + 1) / 7
    );
    return `${year}-W${String(week).padStart(2, '0')}`;
  },

  // 날짜 표시: "4월 1일 (화)"
  format(dateStr) {
    const d = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  },

  // 오늘 날짜 짧게: "4월 3일 금요일"
  todayShort() {
    const d = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}`;
  },

  // 오늘 날짜 표시: "2025년 4월 1일 화요일"
  todayFull() {
    const d = new Date();
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}`;
  },

  // 요일 약자
  weekday(dateStr) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[new Date(dateStr).getDay()];
  },

  // 이번 달 여부
  isThisMonth(dateStr) {
    const now = new Date();
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth();
  }
};

// =============================================
// 순번 관리 (수동 고정 + 요일 기반)
// =============================================
const OrderCalc = {

  // 순번 불러오기 (수동 고정값 우선, 없으면 멤버 등록 순서)
  async loadThisWeek() {
    const saved = await OrderDB.get('fixed'); // 주차 키 대신 'fixed' 고정키 사용
    if (saved && saved.order && saved.order.length) {
      const validIds = new Set(State.members.map(m => m.id));
      const filtered = saved.order.filter(id => validIds.has(id));
      // 순번에 없는 새 멤버는 뒤에 추가
      State.members.forEach(m => {
        if (!filtered.includes(m.id)) filtered.push(m.id);
      });
      State.weeklyOrder  = filtered;
      State.isManualOrder = true;
    } else {
      // 최초엔 멤버 등록 순서로
      State.weeklyOrder  = State.members.map(m => m.id);
      State.isManualOrder = false;
    }
  },

  // 순번 수동 저장 (고정)
  async saveManualOrder(order) {
    State.weeklyOrder  = order;
    State.isManualOrder = true;
    await OrderDB.save('fixed', order, true);
  },

  // 요일 기반 오늘 담당자
  // 월=1번(idx 0), 화=2번(idx 1), 수=3번(idx 2), 목=4번(idx 3), 금=5번(idx 4)
  getTodayPayer(dateStr) {
    if (!State.weeklyOrder.length || !State.members.length) return null;
    const d   = dateStr ? new Date(dateStr) : new Date();
    const day = d.getDay(); // 0=일, 1=월 ... 5=금, 6=토
    if (day === 0 || day === 6) return null; // 주말은 담당자 없음
    const idx = day - 1; // 월(1)→0, 화(2)→1, 수(3)→2, 목(4)→3, 금(5)→4
    const id  = State.weeklyOrder[idx];
    return State.members.find(m => m.id === id) || null;
  },

  // 순번 초기화 (멤버 등록 순서로)
  async resetOrder() {
    State.weeklyOrder  = State.members.map(m => m.id);
    State.isManualOrder = false;
    await OrderDB.save('fixed', State.weeklyOrder, false);
  }
};

// =============================================
// 오늘 점심 상태 관리 (Firebase 실시간 연동)
// =============================================
const TodayState = {

  // 앱 시작 시 오늘 날짜 확인 후 오래된 데이터 정리
  async init() {
    await TodayOrderDB.checkAndClearIfOldDate();
  },

  // Firebase에서 받은 데이터 → State.today 동기화
  syncFromFirebase(data) {
    // 요일 기반 기본 담당자
    const defaultPayer = OrderCalc.getTodayPayer(State.selectedDate);

    if (!data) {
      State.today = {
        payer: defaultPayer
          ? { id: defaultPayer.id, name: defaultPayer.name, isGuest: false }
          : null,
        restaurant:  '',
        attendees:   State.members.map(m => ({
          id: m.id, name: m.name, menu: '', attending: true
        })),
        guests:      [],
        totalAmount: ''
      };
    } else {
      const attendeesMap = data.attendees || {};
      const guestsMap    = data.guests    || {};

      // payer가 없거나 비어있으면 요일 기반 담당자 사용
      const payer = (data.payerName)
        ? { id: data.payerId || null, name: data.payerName, isGuest: data.payerIsGuest || false }
        : defaultPayer
          ? { id: defaultPayer.id, name: defaultPayer.name, isGuest: false }
          : null;

      State.today = {
        payer,
        restaurant:  data.restaurant || '',
        attendees: State.members.map(m => ({
          id:        m.id,
          name:      m.name,
          attending: attendeesMap[m.id]?.attending ?? true,
          menu:      attendeesMap[m.id]?.menu || ''
        })),
        guests: Object.entries(guestsMap).map(([id, g]) => ({
          id, name: g.name, menu: g.menu || ''
        })),
        totalAmount: data.totalAmount || ''
      };
    }
  },

  // ── 식당 선택 (Firebase에 즉시 저장) ──
  async setRestaurant(name) {
    const payer = State.today.payer;
    await TodayOrderDB.setRestaurant(
      name,
      payer?.id,
      payer?.name || '',
      payer?.isGuest || false
    );
    // 식당 선택 시 멤버 전원 기본 참석 상태로 초기화
    for (const m of State.members) {
      await TodayOrderDB.toggleAttendance(m.id, m.name, true);
    }
  },

  // ── 담당자 변경 ──
  async setPayer(id, name, isGuest) {
    await TodayOrderDB.setPayer(id, name, isGuest);
  },

  // ── 참석 토글 ──
  async toggleAttendance(memberId) {
    const a = State.today.attendees.find(a => a.id === memberId);
    if (!a) return;
    const next = !a.attending;
    await TodayOrderDB.toggleAttendance(memberId, a.name, next);
  },

  // ── 멤버 메뉴 선택 ──
  async setMemberMenu(memberId, menu) {
    const a = State.today.attendees.find(a => a.id === memberId);
    if (!a) return;
    await TodayOrderDB.setMemberMenu(memberId, a.name, menu, a.attending);
  },

  // ── 게스트 추가 ──
  async addGuest(name) {
    const guestId = 'g_' + Date.now();
    await TodayOrderDB.addGuest(guestId, name);
  },

  // ── 게스트 메뉴 ──
  async setGuestMenu(guestId, menu) {
    await TodayOrderDB.setGuestMenu(guestId, menu);
  },

  // ── 게스트 삭제 ──
  async removeGuest(guestId) {
    await TodayOrderDB.removeGuest(guestId);
    // 삭제된 게스트가 결제자였으면 담당자 초기화
    if (State.today.payer?.isGuest) {
      const defaultPayer = OrderCalc.getTodayPayer();
      if (defaultPayer) {
        await TodayOrderDB.setPayer(defaultPayer.id, defaultPayer.name, false);
      }
    }
  },

  // ── 금액 입력 ──
  async setAmount(amount) {
    await TodayOrderDB.setAmount(Number(amount) || 0);
  },

  // ── 유효성 검사 ──
  validate() {
    const t = State.today;
    if (!t.payer?.name) return '결제자를 선택해 주세요.';
    if (!t.restaurant.trim()) return '식당을 선택해 주세요.';
    if (!t.totalAmount || isNaN(Number(String(t.totalAmount).replace(/,/g, '')))) {
      return '결제 금액을 입력해 주세요.';
    }
    return null;
  },

  // ── 등록 완료 ──
  async submit() {
    const err = this.validate();
    if (err) { showToast(err, 'error'); return false; }

    const t = State.today;
    const amount = Number(String(t.totalAmount).replace(/,/g, ''));

    const recordData = {
      date:         State.selectedDate,
      restaurant:   t.restaurant.trim(),
      payerId:      t.payer.isGuest ? null : t.payer.id,
      payerName:    t.payer.name,
      payerIsGuest: t.payer.isGuest || false,
      totalAmount:  amount,
      attendees:    t.attendees.filter(a => a.attending),
      guests:       t.guests
    };

    await RecordDB.add(recordData);

    // 결제자가 고정 멤버면 payCount +1
    if (!t.payer.isGuest && t.payer.id) {
      await MemberDB.updatePayCount(t.payer.id, 1);
      const m = State.members.find(m => m.id === t.payer.id);
      if (m) m.payCount = (m.payCount || 0) + 1;
    }

    // 오늘 주문 상태 초기화
    await TodayOrderDB.clear();

    // 순번 재계산
    await OrderCalc.resetOrder();

    return true;
  }
};

// =============================================
// 통계 계산
// =============================================
const Stats = {

  // 멤버별 결제 횟수
  payCountByMember(records, filter = 'all') {
    const filtered = filter === 'month'
      ? records.filter(r => DateUtil.isThisMonth(r.date))
      : records;

    const counts = {};
    State.members.forEach(m => { counts[m.id] = 0; });

    filtered.forEach(r => {
      if (!r.payerIsGuest && r.payerId && counts[r.payerId] !== undefined) {
        counts[r.payerId]++;
      }
    });

    return State.members
      .map(m => ({ id: m.id, name: m.name, count: counts[m.id] }))
      .sort((a, b) => b.count - a.count);
  },

  // 올해 월별 총 금액
  amountByMonth(records) {
    const thisYear = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: `${thisYear}-${String(i + 1).padStart(2, '0')}`,
      label: `${i + 1}월`,
      total: 0,
      count: 0
    }));

    records
      .filter(r => r.date.startsWith(String(thisYear)))
      .forEach(r => {
        const month = r.date.slice(0, 7);
        const m = months.find(m => m.month === month);
        if (m) {
          m.total += r.totalAmount || 0;
          m.count += 1;
        }
      });

    return months;
  },

  // 이번 달 요약
  thisMonthSummary(records) {
    const thisMonth = records.filter(r => DateUtil.isThisMonth(r.date));
    const total = thisMonth.reduce((s, r) => s + (r.totalAmount || 0), 0);
    const count = thisMonth.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    return { total, count, avg };
  },

  // 올해 요약
  thisYearSummary(records) {
    const thisYear = String(new Date().getFullYear());
    const yearly = records.filter(r => r.date.startsWith(thisYear));
    const total = yearly.reduce((s, r) => s + (r.totalAmount || 0), 0);
    const count = yearly.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    return { total, count, avg };
  }
};

// =============================================
// 앱 초기화
// =============================================
const App = {

  async init() {
    // 오늘 날짜 확인 (날짜 바뀌면 todayOrder 자동 정리)
    await TodayOrderDB.checkAndClearIfOldDate();

    // 멤버 실시간 구독
    MemberDB.onValue(members => {
      State.members = members;
      OrderCalc.loadThisWeek().then(() => {
        UI.renderAll();
      });
    });

    // 오늘 주문 실시간 구독 (핵심: 누가 바꾸면 모두에게 즉시 반영)
    TodayOrderDB.onValue(data => {
      TodayState.syncFromFirebase(data);
      UI.renderHome();
    });

    // 식사 기록 실시간 구독
    RecordDB.onValue(records => {
      State.records = records;
      UI.renderRecords();
      UI.renderStats();
    });

    // 식당 실시간 구독
    RestaurantDB.onValue(restaurants => {
      State.restaurants = restaurants;
      UI.renderRestaurantStep();
    });
  }
};
