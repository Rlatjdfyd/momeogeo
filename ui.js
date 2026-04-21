// =============================================
// 유틸 함수
// =============================================

function $(id) { return document.getElementById(id); }

function showToast(msg, type = '') {
  const container = document.querySelector('.toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function numberWithCommas(n) {
  return n ? Number(String(n).replace(/,/g, '')).toLocaleString('ko-KR') : '';
}

function getInitial(name) {
  return name ? name.charAt(0) : '?';
}

// =============================================
// 탭 라우터
// =============================================
const Router = {
  go(tab) {
    State.activeTab = tab;

    document.querySelectorAll('.tab-pane').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });

    document.querySelectorAll('.tab-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });

    // 탭 진입 시 렌더
    if (tab === 'home')    UI.renderHome();
    if (tab === 'records') UI.renderRecords();
    if (tab === 'settings') UI.renderSettings();
  }
};

// =============================================
// 바텀시트 관리
// =============================================
const Sheet = {
  open(sheetId) {
    $('sheet-overlay').classList.add('open');
    $(sheetId)?.classList.add('open');
  },
  close() {
    $('sheet-overlay').classList.remove('open');
    document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('open'));
  }
};

// =============================================
// UI 렌더러
// =============================================
const UI = {

  renderAll() {
    this.renderHome();
    this.renderRecords();
    this.renderStats();
    this.renderSettings();
  },

  // ─── 홈 탭 ───────────────────────────────
  renderHome() {
    // 날짜 인풋 & 헤더 레이블 초기화
    const dateInput = $('lunch-date-input');
    if (dateInput && !dateInput.value) {
      dateInput.value = State.selectedDate || DateUtil.today();
    }
    this.updateHeaderDate();
    this.renderPayerCard();
    this.renderRestaurantStep();
    this.renderMenuStep();
    this.renderPaymentStep();
  },

  updateHeaderDate() {
    const el = $('header-date-label');
    if (!el) return;
    const isToday = State.selectedDate === DateUtil.today();
    el.textContent = isToday ? DateUtil.todayShort() : DateUtil.format(State.selectedDate);
    // 오늘이 아니면 파란색으로 강조
    el.style.color = isToday ? '' : 'var(--primary)';
    el.style.fontWeight = isToday ? '' : '700';
  },

  renderPayerCard() {
    const payer = State.today.payer;
    const el = $('payer-card');
    if (!el) return;

    const hasMembers = State.members.length > 0;

    if (!hasMembers) {
      el.innerHTML = `
        <div class="payer-label">오늘의 결제 담당자</div>
        <div class="payer-name">미지정</div>
        <div class="payer-meta">설정 탭에서 멤버를 먼저 등록해 주세요</div>`;
      return;
    }

    // 주말 체크
    const d   = new Date(State.selectedDate);
    const day = d.getDay();
    if (day === 0 || day === 6) {
      const dayName = day === 6 ? '토요일' : '일요일';
      // 교체로 지정된 담당자가 있으면 표시
      if (payer && payer.name) {
        const isGuest = payer.isGuest;
        el.innerHTML = `
          <div class="payer-label">${dayName} 결제 담당자</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px">
            <div>
              <div class="payer-name">${payer.name}</div>
              <div class="payer-meta">${isGuest ? '게스트 결제' : '수동 지정'}</div>
            </div>
            <button class="btn-change" style="flex-shrink:0" onclick="Actions.openPayerChange()">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              교체
            </button>
          </div>`;
      } else {
        el.innerHTML = `
          <div class="payer-label">${dayName} 결제 담당자</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px">
            <div>
              <div class="payer-name">미지정</div>
              <div class="payer-meta">담당자를 직접 선택해 주세요</div>
            </div>
            <button class="btn-change" style="flex-shrink:0" onclick="Actions.openPayerChange()">
              담당자 선택
            </button>
          </div>`;
      }
      this.renderPayerChangeSheet();
      return;
    }

    // 요일 기반 담당자
    const dayNames = ['', '월', '화', '수', '목', '금'];
    const orderIdx = day - 1; // 월=0 ... 금=4
    const orderId  = State.weeklyOrder[orderIdx];
    const orderMember = State.members.find(m => m.id === orderId);

    const displayPayer = (payer && payer.name)
      ? payer
      : orderMember
        ? { id: orderMember.id, name: orderMember.name, isGuest: false }
        : null;

    if (!displayPayer) {
      el.innerHTML = `
        <div class="payer-label">오늘의 결제 담당자</div>
        <div class="payer-name">미지정</div>
        <div class="payer-meta">순번을 확인해 주세요</div>
        <button class="btn-change" onclick="Actions.openPayerChange()">담당자 선택</button>`;
      return;
    }

    const isToday  = State.selectedDate === DateUtil.today();
    const dateLabel = isToday ? '오늘의 결제 담당자' : `${DateUtil.format(State.selectedDate)} 결제 담당자`;
    const isGuest  = displayPayer.isGuest;
    const member   = State.members.find(m => m.id === displayPayer.id);
    const meta     = isGuest ? '게스트 결제' : `${dayNames[day]}요일 ${orderIdx + 1}번 담당`;

    el.innerHTML = `
      <div class="payer-label">${dateLabel}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px">
        <div>
          <div class="payer-name">${displayPayer.name}</div>
          <div class="payer-meta">${meta}</div>
        </div>
        <button class="btn-change" style="flex-shrink:0" onclick="Actions.openPayerChange()">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          교체
        </button>
      </div>`;

    this.renderPayerChangeSheet();
  },

  renderPayerChangeSheet() {
    const el = $('sheet-payer-list');
    if (!el) return;

    // 식당 선택 전이면 전체 멤버, 선택 후면 참석자만
    const memberList = State.today.restaurant
      ? State.today.attendees.filter(a => a.attending)
      : State.members.map(m => ({ id: m.id, name: m.name }));

    const currentPayerId = State.today.payer?.id;
    const currentPayerIsGuest = State.today.payer?.isGuest;

    let html = '';

    // 고정 멤버 목록
    memberList.forEach(a => {
      const m = State.members.find(m => m.id === a.id);
      const isSelected = currentPayerId === a.id && !currentPayerIsGuest;
      html += `
        <div class="list-item" style="cursor:pointer"
             onclick="Actions.setPayer('${a.id}', '${a.name}', false)">
          <div class="avatar">${getInitial(a.name)}</div>
          <div class="list-item-content">
            <div class="list-item-title">${a.name}</div>
            <div class="list-item-sub">누적 결제 ${m?.payCount || 0}회</div>
          </div>
          ${isSelected ? '<span class="badge badge-blue">✓ 선택됨</span>' : ''}
        </div>`;
    });

    // 게스트 목록 (식당 선택 후에만 표시)
    if (State.today.restaurant) {
      State.today.guests.forEach(g => {
        const isSelected = currentPayerIsGuest && State.today.payer?.name === g.name;
        html += `
          <div class="list-item" style="cursor:pointer"
               onclick="Actions.setPayer(null, '${g.name}', true)">
            <div class="avatar" style="background:var(--warning-light);color:var(--warning)">
              ${getInitial(g.name)}
            </div>
            <div class="list-item-content">
              <div class="list-item-title">${g.name}</div>
              <div class="list-item-sub"><span class="guest-tag">게스트</span></div>
            </div>
            ${isSelected ? '<span class="badge badge-blue">✓ 선택됨</span>' : ''}
          </div>`;
      });
    }

    el.innerHTML = html || `
      <div class="empty-state">
        <div class="empty-text">멤버가 없어요</div>
        <div class="empty-sub">설정 탭에서 멤버를 추가해 주세요</div>
      </div>`;
  },

  renderRestaurantStep() {
    const el = $('restaurant-step');
    if (!el) return;

    const selected = State.today.restaurant;
    const isDone = !!selected;

    el.innerHTML = `
      <div class="step-header">
        <div class="step-num ${isDone ? 'done' : ''}">
          ${isDone ? `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>` : '2'}
        </div>
        <div class="step-title">식당 선택</div>
      </div>

      ${isDone ? `
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:var(--font-lg);font-weight:700">${selected}</span>
          <button class="btn btn-ghost btn-sm" onclick="Actions.clearRestaurant()">변경</button>
        </div>` : `
        <div class="chip-group">
          ${State.restaurants.map(r => `
            <div class="chip" onclick="Actions.selectRestaurant('${r.name.replace(/'/g, "\\'")}')">
              ${r.name}
            </div>`).join('')}
          <div class="chip chip-add" onclick="Sheet.open('sheet-restaurant-input')">
            + 직접 입력
          </div>
        </div>`
      }`;
  },

  renderMenuStep() {
    const el = $('menu-step');
    if (!el) return;

    if (!State.today.restaurant) {
      el.innerHTML = `
        <div class="step-header">
          <div class="step-num">3</div>
          <div class="step-title" style="color:var(--gray-300)">메뉴 선택</div>
        </div>
        <div style="color:var(--gray-400);font-size:var(--font-sm)">식당을 먼저 선택해 주세요</div>`;
      return;
    }

    const restaurant = State.restaurants.find(r => r.name === State.today.restaurant);
    const menus = restaurant?.menus || [];

    let membersHtml = State.today.attendees.map(a => {
      const isAbsent = !a.attending;
      const hasMenu  = !!a.menu;
      return `
        <div class="member-menu-card ${isAbsent ? 'absent' : ''}" id="member-card-${a.id}">
          <div class="member-menu-top">
            <div class="avatar avatar-sm">${getInitial(a.name)}</div>
            <span class="member-menu-name">${a.name}</span>
            ${a.attending && hasMenu
              ? `<span style="font-size:var(--font-sm);font-weight:600;color:var(--gray-700);flex:1;text-align:right;margin-right:6px">${a.menu}</span>
                 <button class="btn btn-ghost btn-sm" style="padding:4px 8px"
                         onclick="Actions.clearMemberMenu('${a.id}')">변경</button>`
              : `<button class="toggle ${a.attending ? 'on' : ''}"
                         onclick="Actions.toggleAttendance('${a.id}')"></button>`
            }
          </div>
          ${a.attending && !hasMenu ? `
            <div class="chip-group" style="margin-bottom:8px">
              ${menus.map(m => `
                <div class="chip"
                     onclick="Actions.setMemberMenu('${a.id}', '${m.replace(/'/g, "\\'")}')">
                  ${m}
                </div>`).join('')}
            </div>
            <input class="input-field"
                   placeholder="메뉴 직접 입력"
                   value=""
                   onchange="Actions.setMemberMenu('${a.id}', this.value)"
                   style="padding:10px 12px;font-size:var(--font-sm)"/>` : ''}
        </div>`;
    }).join('');

    let guestsHtml = State.today.guests.map((g) => {
      const isCurrentPayer = State.today.payer?.isGuest &&
                             State.today.payer?.name === g.name;
      const hasMenu = !!g.menu;
      return `
        <div class="member-menu-card" style="${isCurrentPayer ? 'border-color:var(--primary);background:var(--primary-light)' : ''}">
          <div class="member-menu-top">
            <div class="avatar avatar-sm" style="background:var(--warning-light);color:var(--warning)">
              ${getInitial(g.name)}
            </div>
            <span class="member-menu-name">${g.name} <span class="guest-tag">게스트</span></span>
            <div style="display:flex;gap:4px;align-items:center">
              ${hasMenu
                ? `<span style="font-size:var(--font-sm);font-weight:600;color:var(--gray-700)">${g.menu}</span>
                   <button class="btn btn-ghost btn-sm" style="padding:4px 8px"
                           onclick="Actions.clearGuestMenu('${g.id}')">변경</button>`
                : isCurrentPayer
                  ? `<span class="badge badge-blue" style="font-size:10px">결제자</span>`
                  : `<button class="btn btn-sm" style="background:var(--primary-light);color:var(--primary);padding:5px 8px;font-size:10px;font-weight:700"
                             onclick="Actions.setGuestAsPayer('${g.id}', '${g.name}')">결제자 지정</button>`
              }
              <button class="btn btn-icon btn-sm"
                      onclick="Actions.removeGuest('${g.id}')"
                      style="background:var(--danger-light);color:var(--danger)">✕</button>
            </div>
          </div>
          ${!hasMenu ? `
            <div class="chip-group" style="margin-bottom:8px">
              ${menus.map(m => `
                <div class="chip"
                     onclick="Actions.setGuestMenu('${g.id}', '${m.replace(/'/g, "\\'")}')">
                  ${m}
                </div>`).join('')}
            </div>
            <input class="input-field"
                   placeholder="메뉴 직접 입력"
                   value=""
                   onchange="Actions.setGuestMenu('${g.id}', this.value)"
                   style="padding:10px 12px;font-size:var(--font-sm)"/>` : ''}
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="step-header">
        <div class="step-num">3</div>
        <div class="step-title">메뉴 선택</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${membersHtml}
        ${guestsHtml}
        <button class="btn btn-secondary" onclick="Sheet.open('sheet-guest-add')"
                style="margin-top:4px">
          + 게스트 추가
        </button>
      </div>`;
  },

  renderPaymentStep() {
    const el = $('payment-step');
    if (!el) return;

    el.innerHTML = `
      <div class="step-header">
        <div class="step-num">4</div>
        <div class="step-title">결제 완료</div>
      </div>
      <div class="amount-input-wrap" style="margin-bottom:12px">
        <input class="input-field"
               id="amount-input"
               type="text"
               inputmode="numeric"
               placeholder="0"
               value="${State.today.totalAmount}"
               oninput="Actions.setAmount(this.value)"
               style="padding:14px 48px 14px 16px;font-size:var(--font-xl);font-weight:700"/>
        <span class="amount-unit">원</span>
      </div>
      <button class="btn btn-primary" onclick="Actions.submitLunch()"
              ${!State.today.restaurant ? 'disabled' : ''}>
        등록 완료
      </button>`;
  },

  // ─── 기록 탭 ──────────────────────────────
  renderRecords() {
    this.renderWeeklyOrder();
    this.renderRecordList();
    this.renderStats();
  },

  renderWeeklyOrder() {
    const el = $('weekly-order-list');
    if (!el) return;

    if (!State.members.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-text">멤버를 등록해 주세요</div></div>';
      return;
    }

    const days      = ['월', '화', '수', '목', '금'];
    const todayDay  = new Date().getDay(); // 0=일...6=토
    const rankClass = (i) => i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n';

    el.innerHTML = State.weeklyOrder.map((id, idx) => {
      const m      = State.members.find(m => m.id === id);
      if (!m) return '';
      const isToday = (idx + 1) === todayDay; // 월=1→idx0, 화=2→idx1...
      return `
        <div class="order-item-h" draggable="true"
             data-id="${id}" data-idx="${idx}"
             ondragstart="DragOrder.start(event)"
             ondragover="DragOrder.over(event)"
             ondrop="DragOrder.drop(event)"
             ondragend="DragOrder.end(event)"
             style="${isToday ? 'border-color:var(--primary);background:var(--primary-light)' : ''}">
          <div class="order-rank ${rankClass(idx)}">${idx + 1}</div>
          <div style="font-size:10px;color:${isToday ? 'var(--primary)' : 'var(--gray-400)'};font-weight:600">${days[idx] || ''}</div>
          <div class="av av-sm" style="margin:4px 0">${getInitial(m.name)}</div>
          <div class="order-name-h" style="${isToday ? 'color:var(--primary)' : ''}">${m.name}</div>
        </div>`;
    }).join('');
  },

  renderRecordList() {
    const el = $('record-list');
    if (!el) return;

    // 월 라벨 업데이트
    const labelEl = $('record-month-label');
    const nextBtn = $('record-next-btn');
    const [y, m]  = State.recordMonth.split('-').map(Number);
    if (labelEl) labelEl.textContent = `${y}년 ${m}월`;

    // 다음달 버튼 — 현재 달이면 비활성화
    const nowMonth = new Date().toISOString().slice(0, 7);
    if (nextBtn) {
      nextBtn.disabled = State.recordMonth >= nowMonth;
      nextBtn.style.opacity = State.recordMonth >= nowMonth ? '0.3' : '1';
    }

    // 해당 월 기록 필터
    const records = State.records.filter(r => r.date.startsWith(State.recordMonth));

    if (!records.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🍽️</div>
          <div class="empty-text">${m}월 기록이 없어요</div>
          <div class="empty-sub">이 달엔 아직 기록이 없어요</div>
        </div>`;
      return;
    }

    el.innerHTML = records.map(r => `
      <div class="record-item" onclick="Actions.showRecordDetail('${r.id}')">
        <div class="record-date-col">
          <div class="record-day">${r.date.slice(8)}</div>
          <div class="record-weekday">${DateUtil.weekday(r.date)}</div>
        </div>
        <div class="record-info">
          <div class="record-restaurant">${r.restaurant}</div>
          <div class="record-meta">
            ${r.payerIsGuest
              ? `<span class="guest-tag">게스트</span> ${r.payerName}`
              : r.payerName} 결제
            · ${(r.attendees?.length || 0) + (r.guests?.length || 0)}명
          </div>
        </div>
        <div class="record-amount">${numberWithCommas(r.totalAmount)}원</div>
      </div>`).join('');
  },

  renderStats() {
    this.renderAmountStats();
  },

  renderAmountStats() {
    const el = $('amount-stats');
    if (!el) return;

    const filter = State.amountFilter || 'year';

    // 개인별 결제 금액 계산 (멤버 등록 순서 유지)
    const memberAmountMap = (records) => {
      const map = {};
      State.members.forEach(m => { map[m.id] = { name: m.name, total: 0, count: 0 }; });
      records.forEach(r => {
        if (!r.payerIsGuest && r.payerId && map[r.payerId]) {
          map[r.payerId].total += Number(r.totalAmount) || 0;  // 문자열 → 숫자 변환
          map[r.payerId].count += 1;
        }
      });
      return State.members.map(m => map[m.id]).filter(Boolean);
    };

    // 개인별 바 — 올해용 (최대값 기준)
    const memberBarHtml = (members) => {
      const maxAmt = Math.max(...members.map(m => m.total), 1);
      return members.map(m => `
        <div class="stat-bar-item">
          <div class="stat-bar-name">${m.name}</div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill" style="width:${(m.total / maxAmt) * 100}%"></div>
          </div>
          <div style="font-size:var(--font-xs);font-weight:700;color:var(--gray-900);white-space:nowrap;min-width:64px;text-align:right">
            ${numberWithCommas(m.total)}원
          </div>
        </div>`).join('');
    };

    // 개인별 바 — 이번달 한도용 (20만원 기준)
    const MONTHLY_LIMIT = 200000;
    const memberLimitBarHtml = (members) => {
      return members.map(m => {
        const total  = Number(m.total) || 0;
        const pct    = Math.min((total / MONTHLY_LIMIT) * 100, 100);
        const isOver = total >= MONTHLY_LIMIT;
        const isWarn = !isOver && total >= MONTHLY_LIMIT * 0.8;
        const barBg  = isOver ? '#F03E3E' : isWarn ? '#F59E0B' : '#3182F6';
        const txtClr = isOver ? '#F03E3E' : '#191F28';
        return `
          <div class="stat-bar-item">
            <div class="stat-bar-name">${m.name}</div>
            <div class="stat-bar-track" style="background:var(--gray-100);border-radius:999px;height:10px;flex:1">
              <div style="height:100%;width:${pct}%;background:${barBg};border-radius:999px;transition:width 0.5s"></div>
            </div>
            <div style="font-size:var(--font-xs);font-weight:700;color:${txtClr};white-space:nowrap;min-width:64px;text-align:right">
              ${numberWithCommas(total)}원${isOver ? ' 🚨' : ''}
            </div>
          </div>`;
      }).join('');
    };

    if (filter === 'year') {
      const summary      = Stats.thisYearSummary(State.records);
      const months       = Stats.amountByMonth(State.records);
      const visibleMonths = months.filter(m => m.total > 0);
      const maxTotal     = Math.max(...visibleMonths.map(m => m.total), 1);
      const yearRecords  = State.records.filter(r => r.date.startsWith(String(new Date().getFullYear())));
      const memberAmounts = memberAmountMap(yearRecords);

      el.innerHTML = `
        <!-- 요약 카드 -->
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <div style="flex:1;background:var(--primary-light);border-radius:var(--radius-md);padding:12px;text-align:center">
            <div style="font-size:var(--font-xs);color:var(--primary);font-weight:600;margin-bottom:4px">올해 총액</div>
            <div style="font-size:var(--font-lg);font-weight:800;color:var(--primary)">${numberWithCommas(summary.total)}원</div>
          </div>
          <div style="flex:1;background:var(--gray-100);border-radius:var(--radius-md);padding:12px;text-align:center">
            <div style="font-size:var(--font-xs);color:var(--gray-600);font-weight:600;margin-bottom:4px">식사 횟수</div>
            <div style="font-size:var(--font-lg);font-weight:800;color:var(--gray-900)">${summary.count}회</div>
          </div>
          <div style="flex:1;background:var(--gray-100);border-radius:var(--radius-md);padding:12px;text-align:center">
            <div style="font-size:var(--font-xs);color:var(--gray-600);font-weight:600;margin-bottom:4px">평균</div>
            <div style="font-size:var(--font-lg);font-weight:800;color:var(--gray-900)">${numberWithCommas(summary.avg)}원</div>
          </div>
        </div>

        <!-- 월별 그래프 -->
        <div style="font-size:var(--font-xs);font-weight:600;color:var(--gray-500);margin-bottom:8px">월별 금액</div>
        ${visibleMonths.length === 0
          ? `<div class="empty-state"><div class="empty-sub">올해 기록이 없어요</div></div>`
          : `<div class="stat-bar-list" style="margin-bottom:16px">
              ${visibleMonths.map(m => `
                <div class="stat-bar-item">
                  <div class="stat-bar-name">${m.label}</div>
                  <div class="stat-bar-track">
                    <div class="stat-bar-fill" style="width:${(m.total / maxTotal) * 100}%"></div>
                  </div>
                  <div style="font-size:var(--font-xs);font-weight:700;color:var(--gray-900);white-space:nowrap;min-width:64px;text-align:right">
                    ${numberWithCommas(m.total)}원
                  </div>
                </div>`).join('')}
            </div>
            <!-- 개인별 결제 금액 -->
            <div style="font-size:var(--font-xs);font-weight:600;color:var(--gray-500);margin-bottom:8px">개인별 결제 금액</div>
            <div class="stat-bar-list">
              ${memberBarHtml(memberAmounts)}
            </div>`
        }`;

    } else {
      // 이번 달
      const summary          = Stats.thisMonthSummary(State.records);
      const thisMonthRecords = State.records.filter(r => DateUtil.isThisMonth(r.date));
      const memberAmounts    = memberAmountMap(thisMonthRecords);

      el.innerHTML = `
        <!-- 요약 카드 -->
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <div style="flex:1;background:var(--success-light);border-radius:var(--radius-md);padding:12px;text-align:center">
            <div style="font-size:var(--font-xs);color:var(--success);font-weight:600;margin-bottom:4px">이번달 총액</div>
            <div style="font-size:var(--font-lg);font-weight:800;color:var(--success)">${numberWithCommas(summary.total)}원</div>
          </div>
          <div style="flex:1;background:var(--gray-100);border-radius:var(--radius-md);padding:12px;text-align:center">
            <div style="font-size:var(--font-xs);color:var(--gray-600);font-weight:600;margin-bottom:4px">식사 횟수</div>
            <div style="font-size:var(--font-lg);font-weight:800;color:var(--gray-900)">${summary.count}회</div>
          </div>
          <div style="flex:1;background:var(--gray-100);border-radius:var(--radius-md);padding:12px;text-align:center">
            <div style="font-size:var(--font-xs);color:var(--gray-600);font-weight:600;margin-bottom:4px">평균</div>
            <div style="font-size:var(--font-lg);font-weight:800;color:var(--gray-900)">${numberWithCommas(summary.avg)}원</div>
          </div>
        </div>
        <!-- 개인별 결제 금액 -->
        ${memberAmounts.every(m => m.total === 0)
          ? `<div class="empty-state"><div class="empty-sub">이번 달 기록이 없어요</div></div>`
          : `<div style="font-size:var(--font-xs);font-weight:600;color:var(--gray-500);margin-bottom:8px">개인별 결제 현황 (월 한도 20만원)</div>
             <div class="stat-bar-list">${memberLimitBarHtml(memberAmounts)}</div>`
        }`;
    }
  },

  // ─── 설정 탭 ──────────────────────────────
  renderSettings() {
    this.renderMemberSettings();
    this.renderRestaurantSettings();
  },

  renderMemberSettings() {
    const el = $('member-settings-list');
    if (!el) return;

    if (!State.members.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-text">멤버를 추가해 주세요</div></div>`;
      return;
    }

    el.innerHTML = State.members.map(m => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--gray-100)">
        <span style="flex:1;font-size:var(--font-md);font-weight:600;color:var(--gray-900)">${m.name}</span>
        <span style="font-size:var(--font-xs);color:var(--gray-400);margin-right:4px">결제</span>
        <div style="display:flex;align-items:center;gap:6px">
          <button class="count-btn" onclick="Actions.adjustPayCount('${m.id}', -1)">−</button>
          <span style="font-size:var(--font-md);font-weight:700;min-width:20px;text-align:center">${m.payCount}</span>
          <button class="count-btn" onclick="Actions.adjustPayCount('${m.id}', 1)">+</button>
        </div>
        <button class="btn btn-icon btn-sm" onclick="Actions.deleteMember('${m.id}', '${m.name}')"
                style="background:var(--danger-light);color:var(--danger);width:28px;height:28px;font-size:12px">✕</button>
      </div>`).join('');
  },

  renderRestaurantSettings() {
    const el = $('restaurant-settings-list');
    if (!el) return;

    if (!State.restaurants.length) {
      el.innerHTML = `<div style="text-align:center;padding:12px 0;color:var(--gray-400);font-size:var(--font-sm)">등록된 식당이 없어요</div>`;
      return;
    }

    el.innerHTML = State.restaurants.map((r, idx) => `
      <div style="padding:8px 0;${idx < State.restaurants.length - 1 ? 'border-bottom:1px solid var(--gray-100)' : ''}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="min-width:0;flex:1">
            <div style="font-size:var(--font-md);font-weight:600;color:var(--gray-900)">${r.name}</div>
            ${r.menus?.length
              ? `<div style="font-size:var(--font-xs);color:var(--gray-400);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.menus.join(' · ')}</div>`
              : `<div style="font-size:var(--font-xs);color:var(--gray-300);margin-top:2px">메뉴 없음</div>`}
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="btn btn-ghost btn-sm" style="padding:5px 10px"
                    onclick="Actions.editRestaurant('${r.id}')">수정</button>
            <button class="btn btn-sm" style="background:var(--danger-light);color:var(--danger);padding:5px 10px"
                    onclick="Actions.deleteRestaurant('${r.id}', '${r.name}')">삭제</button>
          </div>
        </div>
      </div>`).join('');
  },

  // 기록 수정 시트 열기
  showRecordEdit(id) {
    const record = State.records.find(r => r.id === id);
    if (!record) return;

    const el = $('sheet-record-edit-body');
    if (!el) return;

    // 결제자 드롭다운 옵션
    const memberOptions = State.members.map(m =>
      `<option value="${m.id}|${m.name}|false"
        ${record.payerId === m.id && !record.payerIsGuest ? 'selected' : ''}>
        ${m.name}
      </option>`
    ).join('');

    const guestOptions = (record.guests || []).map(g =>
      `<option value="null|${g.name}|true"
        ${record.payerIsGuest && record.payerName === g.name ? 'selected' : ''}>
        ${g.name} (게스트)
      </option>`
    ).join('');

    // 멤버별 메뉴 수정 입력란
    const attendeeInputs = (record.attendees || []).map((a, idx) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div class="avatar avatar-sm" style="flex-shrink:0">${getInitial(a.name)}</div>
        <span style="font-size:var(--font-sm);font-weight:600;width:52px;flex-shrink:0">${a.name}</span>
        <input class="input-field" id="edit-menu-${idx}"
               value="${a.menu || ''}" placeholder="메뉴"
               style="padding:9px 12px;font-size:var(--font-sm)"/>
      </div>`).join('');

    // 게스트 메뉴 수정 입력란
    const guestInputs = (record.guests || []).map((g, idx) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div class="avatar avatar-sm" style="flex-shrink:0;background:var(--warning-light);color:var(--warning)">${getInitial(g.name)}</div>
        <span style="font-size:var(--font-sm);font-weight:600;width:52px;flex-shrink:0">${g.name}</span>
        <input class="input-field" id="edit-guest-menu-${idx}"
               value="${g.menu || ''}" placeholder="메뉴"
               style="padding:9px 12px;font-size:var(--font-sm)"/>
      </div>`).join('');

    el.innerHTML = `
      <input type="hidden" id="edit-record-id" value="${id}"/>
      <div>
        <label class="input-label">식당명</label>
        <input class="input-field" id="edit-record-restaurant" value="${record.restaurant}"/>
      </div>
      <div>
        <label class="input-label">결제자</label>
        <select class="input-field" id="edit-record-payer">
          ${memberOptions}${guestOptions}
        </select>
      </div>
      <div>
        <label class="input-label">결제 금액</label>
        <div class="amount-input-wrap">
          <input class="input-field" id="edit-record-amount"
                 type="text" inputmode="numeric"
                 value="${record.totalAmount || ''}"
                 oninput="this.value=this.value.replace(/[^0-9]/g,'')"
                 style="padding:13px 48px 13px 16px;font-size:var(--font-xl);font-weight:700"/>
          <span class="amount-unit">원</span>
        </div>
      </div>
      ${attendeeInputs || guestInputs ? `
      <div>
        <label class="input-label">메뉴</label>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${attendeeInputs}${guestInputs}
        </div>
      </div>` : ''}
      <button class="btn btn-primary" onclick="Actions.saveRecordEdit()">저장</button>`;

    // 상세 시트 숨기고 수정 시트 바로 열기 (오버레이는 유지)
    $('sheet-record-detail').classList.remove('open');
    $('sheet-record-edit').classList.add('open');
  }
};

// =============================================
// 드래그 순번 수정
// =============================================
const DragOrder = {
  dragSrcIdx: null,

  start(e) {
    this.dragSrcIdx = parseInt(e.currentTarget.dataset.idx);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  },

  over(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.order-item-h').forEach(el => el.classList.remove('drag-over'));
    e.currentTarget.classList.add('drag-over');
  },

  drop(e) {
    e.preventDefault();
    const targetIdx = parseInt(e.currentTarget.dataset.idx);
    if (this.dragSrcIdx === null || this.dragSrcIdx === targetIdx) return;

    const newOrder = [...State.weeklyOrder];
    const [moved] = newOrder.splice(this.dragSrcIdx, 1);
    newOrder.splice(targetIdx, 0, moved);

    OrderCalc.saveManualOrder(newOrder).then(() => {
      UI.renderWeeklyOrder();
      showToast('순번이 변경되었어요');
    });
  },

  end(e) {
    document.querySelectorAll('.order-item-h').forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });
    this.dragSrcIdx = null;
  }
};

// =============================================
// 액션 (이벤트 핸들러)
// =============================================
const Actions = {

  // 날짜를 오늘로 초기화
  setDateToday() {
    State.selectedDate = DateUtil.today();
    const input = $('lunch-date-input');
    if (input) input.value = State.selectedDate;
    UI.renderPayerCard();
  },

  // 날짜 변경
  async onDateChange(val) {
    if (!val) return;
    State.selectedDate = val;
    // 선택 날짜 바뀌면 임시 저장 정리
    await TodayOrderDB.checkAndClearIfOldDate(val);
    State.today.payer = null;
    UI.updateHeaderDate();
    UI.renderPayerCard();
  },

  // 담당자 교체 시트 열기 (순서 보장)
  openPayerChange() {
    UI.renderPayerChangeSheet();
    Sheet.open('sheet-payer-change');
  },

  // 담당자 변경
  async setPayer(id, name, isGuest) {
    const resolvedId = (id === 'null' || id === null) ? null : id;
    const resolvedIsGuest = isGuest === true || isGuest === 'true';

    if (State.today.restaurant) {
      // 식당 선택 후 → Firebase에 저장
      await TodayState.setPayer(resolvedId, name, resolvedIsGuest);
    } else {
      // 식당 선택 전 → 로컬 상태만 업데이트
      State.today.payer = { id: resolvedId, name, isGuest: resolvedIsGuest };
      UI.renderPayerCard();
    }
    Sheet.close();
  },

  // 식당 선택
  async selectRestaurant(name) {
    await TodayState.setRestaurant(name);
    Sheet.close();
  },

  async clearRestaurant() {
    await TodayOrderDB.clear();
  },

  // 식당 직접 입력 확인
  async confirmRestaurantInput() {
    const val = $('restaurant-input-field')?.value?.trim();
    if (!val) { showToast('식당 이름을 입력해 주세요', 'error'); return; }
    await TodayState.setRestaurant(val);
    Sheet.close();
  },

  // 참석 토글
  async toggleAttendance(memberId) {
    await TodayState.toggleAttendance(memberId);
  },

  // 멤버 메뉴 선택
  async setMemberMenu(memberId, menu) {
    await TodayState.setMemberMenu(memberId, menu);
  },

  // 멤버 메뉴 초기화 (변경 버튼)
  async clearMemberMenu(memberId) {
    await TodayState.setMemberMenu(memberId, '');
  },

  // 게스트를 결제자로 지정
  async setGuestAsPayer(guestId, guestName) {
    await TodayState.setPayer(null, guestName, true);
    UI.renderPayerCard();
    UI.renderMenuStep();
    showToast(`${guestName}님이 결제자로 지정됐어요`);
  },

  // 게스트 추가
  async addGuestConfirm() {
    const val = $('guest-name-input')?.value?.trim();
    if (!val) { showToast('게스트 이름을 입력해 주세요', 'error'); return; }
    await TodayState.addGuest(val);
    if ($('guest-name-input')) $('guest-name-input').value = '';
    Sheet.close();
  },

  // 게스트 메뉴
  async setGuestMenu(guestId, menu) {
    await TodayState.setGuestMenu(guestId, menu);
  },

  // 게스트 메뉴 초기화 (변경 버튼)
  async clearGuestMenu(guestId) {
    await TodayState.setGuestMenu(guestId, '');
  },

  // 게스트 삭제
  async removeGuest(guestId) {
    await TodayState.removeGuest(guestId);
  },

  // 금액 입력 (디바운스 적용)
  _amountTimer: null,
  setAmount(val) {
    const raw = val.replace(/[^0-9]/g, '');
    const input = $('amount-input');
    if (input) input.value = numberWithCommas(raw);

    clearTimeout(this._amountTimer);
    this._amountTimer = setTimeout(async () => {
      await TodayState.setAmount(raw);
    }, 600);
  },

  // 등록
  async submitLunch() {
    const btn = document.querySelector('#payment-step .btn-primary');
    if (btn) btn.disabled = true;

    const success = await TodayState.submit();
    if (success) {
      showToast('점심이 등록되었어요 🎉', 'success');
      Router.go('records');
    } else {
      if (btn) btn.disabled = false;
    }
  },

  // 기록 상세
  showRecordDetail(id) {
    const record = State.records.find(r => r.id === id);
    if (!record) return;

    const el = $('sheet-record-body');
    if (!el) return;

    const attendeeList = (record.attendees || [])
      .map(a => `
        <div class="list-item">
          <div class="avatar avatar-sm">${getInitial(a.name)}</div>
          <div class="list-item-content">
            <div class="list-item-title">${a.name}</div>
            ${a.menu ? `<div class="list-item-sub">${a.menu}</div>` : '<div class="list-item-sub" style="color:var(--gray-300)">메뉴 미선택</div>'}
          </div>
        </div>`).join('');

    const guestList = (record.guests || [])
      .map(g => `
        <div class="list-item">
          <div class="avatar avatar-sm" style="background:var(--warning-light);color:var(--warning)">${getInitial(g.name)}</div>
          <div class="list-item-content">
            <div class="list-item-title">${g.name} <span class="guest-tag">게스트</span></div>
            ${g.menu ? `<div class="list-item-sub">${g.menu}</div>` : ''}
          </div>
        </div>`).join('');

    el.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-size:var(--font-2xl);font-weight:800;margin-bottom:4px">${record.restaurant}</div>
        <div style="color:var(--gray-500);font-size:var(--font-sm)">${DateUtil.format(record.date)}</div>
      </div>
      <div class="card card-sm" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:var(--gray-500);font-size:var(--font-sm)">결제자</span>
          <span style="font-weight:700">${record.payerName}
            ${record.payerIsGuest ? '<span class="guest-tag" style="margin-left:4px">게스트</span>' : ''}
          </span>
        </div>
        <div class="divider"></div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:var(--gray-500);font-size:var(--font-sm)">총 금액</span>
          <span style="font-size:var(--font-xl);font-weight:800;color:var(--primary)">${numberWithCommas(record.totalAmount)}원</span>
        </div>
      </div>
      <div class="card card-sm" style="margin-bottom:12px">
        ${attendeeList}${guestList}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" style="flex:1"
                onclick="UI.showRecordEdit('${id}')">수정</button>
        <button class="btn btn-danger" style="flex:1"
                onclick="Actions.deleteRecord('${id}')">삭제</button>
      </div>`;

    Sheet.open('sheet-record-detail');
  },

  async deleteRecord(id) {
    if (!confirm('이 기록을 삭제할까요?')) return;
    await RecordDB.delete(id);
    showToast('삭제되었어요');
    Sheet.close();
  },

  // 기록 수정 저장
  async saveRecordEdit() {
    const id        = $('edit-record-id')?.value;
    const restaurant = $('edit-record-restaurant')?.value?.trim();
    const amountRaw  = $('edit-record-amount')?.value?.replace(/,/g, '');
    const payerVal   = $('edit-record-payer')?.value; // "id|name|isGuest"

    if (!restaurant) { showToast('식당명을 입력해 주세요', 'error'); return; }
    if (!amountRaw || isNaN(Number(amountRaw))) { showToast('금액을 입력해 주세요', 'error'); return; }

    const [payerId, payerName, payerIsGuestStr] = payerVal.split('|');
    const payerIsGuest = payerIsGuestStr === 'true';

    const record = State.records.find(r => r.id === id);
    if (!record) return;

    // 멤버 메뉴 업데이트
    const updatedAttendees = (record.attendees || []).map((a, idx) => ({
      ...a,
      menu: $(`edit-menu-${idx}`)?.value?.trim() || ''
    }));

    // 게스트 메뉴 업데이트
    const updatedGuests = (record.guests || []).map((g, idx) => ({
      ...g,
      menu: $(`edit-guest-menu-${idx}`)?.value?.trim() || ''
    }));

    // 결제자 변경 시 payCount 조정
    const oldPayerId    = record.payerId;
    const oldIsGuest    = record.payerIsGuest;
    const newPayerId    = payerIsGuest ? null : payerId;
    const newIsGuest    = payerIsGuest;

    // 기존 결제자 카운트 -1
    if (!oldIsGuest && oldPayerId) {
      await MemberDB.updatePayCount(oldPayerId, -1);
    }
    // 새 결제자 카운트 +1
    if (!newIsGuest && newPayerId) {
      await MemberDB.updatePayCount(newPayerId, 1);
    }

    await RecordDB.update(id, {
      restaurant,
      totalAmount:  Number(amountRaw),
      payerId:      newPayerId,
      payerName,
      payerIsGuest: newIsGuest,
      attendees:    updatedAttendees,
      guests:       updatedGuests
    });

    // 순번 재계산
    await OrderCalc.resetOrder();

    showToast('수정되었어요 ✓', 'success');
    Sheet.close();
  },

  // 이전 달
  prevMonth() {
    const [y, m] = State.recordMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1); // m-2 because month is 0-indexed
    State.recordMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    UI.renderRecordList();
  },

  // 다음 달
  nextMonth() {
    const nowMonth = new Date().toISOString().slice(0, 7);
    if (State.recordMonth >= nowMonth) return;
    const [y, m] = State.recordMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    State.recordMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    UI.renderRecordList();
  },

  // 순번 초기화
  async resetOrder() {
    await OrderCalc.resetOrder();
    UI.renderWeeklyOrder();
    showToast('순번이 초기화되었어요');
  },

  // 금액 필터 변경
  setAmountFilter(filter) {
    State.amountFilter = filter;
    document.querySelectorAll('[data-filter]').forEach(el => {
      if (el.dataset.filter === 'year' || el.dataset.filter === 'month') {
        el.classList.toggle('active', el.dataset.filter === filter);
      }
    });
    UI.renderAmountStats();
  },

  // 필터 변경 (내역용)
  setRecordFilter(filter) {
    State.recordFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.filter === filter);
    });
    UI.renderRecordList();
    UI.renderStats();
  },

  // 멤버 추가
  async addMember() {
    const val = $('member-name-input')?.value?.trim();
    if (!val) { showToast('이름을 입력해 주세요', 'error'); return; }
    if (State.members.length >= 10) { showToast('멤버는 최대 10명까지 가능해요', 'error'); return; }
    await MemberDB.add(val);
    $('member-name-input').value = '';
    showToast(`${val}님이 추가되었어요`);
  },

  async adjustPayCount(id, delta) {
    await MemberDB.updatePayCount(id, delta);
    await OrderCalc.loadThisWeek();
    UI.renderWeeklyOrder();
  },

  async deleteMember(id, name) {
    if (!confirm(`${name}님을 삭제할까요?`)) return;
    await MemberDB.delete(id);
    showToast(`${name}님이 삭제되었어요`);
  },

  // 식당 추가 시트 열기
  openAddRestaurant() {
    const nameInput = $('rest-name-input');
    const menusInput = $('rest-menus-input');
    if (nameInput) nameInput.value = '';
    if (menusInput) menusInput.value = '';
    Sheet.open('sheet-restaurant-add');
    setTimeout(() => nameInput?.focus(), 300);
  },

  // 식당 추가
  async addRestaurant() {
    const name = $('rest-name-input')?.value?.trim();
    const menusRaw = $('rest-menus-input')?.value?.trim();
    if (!name) { showToast('식당 이름을 입력해 주세요', 'error'); return; }
    const menus = menusRaw ? menusRaw.split(',').map(m => m.trim()).filter(Boolean) : [];
    await RestaurantDB.add(name, menus);
    $('rest-name-input').value = '';
    $('rest-menus-input').value = '';
    Sheet.close();
    showToast(`${name} 추가 완료`);
    UI.renderRestaurantSettings();
  },

  editRestaurant(id) {
    const r = State.restaurants.find(r => r.id === id);
    if (!r) return;
    Sheet.open('sheet-restaurant-edit');
    $('edit-rest-id').value = id;
    $('edit-rest-name').value = r.name;
    $('edit-rest-menus').value = (r.menus || []).join(', ');
  },

  async saveRestaurantEdit() {
    const id = $('edit-rest-id')?.value;
    const name = $('edit-rest-name')?.value?.trim();
    const menusRaw = $('edit-rest-menus')?.value?.trim();
    if (!name) { showToast('식당 이름을 입력해 주세요', 'error'); return; }
    const menus = menusRaw ? menusRaw.split(',').map(m => m.trim()).filter(Boolean) : [];
    await RestaurantDB.update(id, { name, menus });
    Sheet.close();
    showToast('수정 완료');
    UI.renderRestaurantSettings();
  },

  async deleteRestaurant(id, name) {
    if (!confirm(`${name}을 삭제할까요?`)) return;
    await RestaurantDB.delete(id);
    showToast(`${name} 삭제 완료`);
  },

  // 데이터 백업
  async exportData() {
    const data = {
      members:     State.members,
      records:     State.records,
      restaurants: State.restaurants,
      exportedAt:  new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lunch-backup-${DateUtil.today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('백업 파일 다운로드 완료');
  }
};

// =============================================
// 초기화
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  // 날짜 인풋 초기값 설정
  const dateInput = $('lunch-date-input');
  if (dateInput) dateInput.value = DateUtil.today();

  // 헤더 날짜 초기화
  UI.updateHeaderDate();

  // 탭 이벤트
  document.querySelectorAll('.tab-item').forEach(el => {
    el.addEventListener('click', () => Router.go(el.dataset.tab));
  });

  // 오버레이 클릭 → 시트 닫기
  $('sheet-overlay')?.addEventListener('click', () => Sheet.close());

  // Firebase 앱 초기화
  App.init();

  // 기본 탭
  Router.go('home');
});
