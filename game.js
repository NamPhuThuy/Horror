// =========================================================
// 13 IS CURSED, 9 IS BLESSED - GAME ENGINE
// =========================================================

const CARD_POOL = [
  {
    id: 'pendulum',
    name: 'Con Lắc',
    icon: '🕰️',
    dayDesc: 'Slot này +2, Slot đối diện (-2)',
    nightDesc: 'Slot này -3, Slot đối diện (+3)',
    type: 'geometry'
  },
  {
    id: 'monk_ward',
    name: 'Bùa Thầy Cúng',
    icon: '📜',
    dayDesc: 'Gán Bùa: Nếu chốt sổ bằng 13 ➔ biến thành 9',
    nightDesc: 'Biến tổng slot này thành số ngẫu nhiên 7..11',
    type: 'ward'
  },
  {
    id: 'mirror_shift',
    name: 'Gương Soi',
    icon: '🪞',
    dayDesc: 'Đổi Pending Modifier với slot bên cạnh',
    nightDesc: 'Đảo ngược dấu (+/-) Modifier của slot',
    type: 'manipulate'
  },
  {
    id: 'black_sun',
    name: 'Mặt Trời Đen',
    icon: '🌑',
    dayDesc: 'Slot này nhận ngay (+5)',
    nightDesc: 'Slot này nhận (-5), nhưng tua +1 lượt',
    type: 'burst'
  },
  {
    id: 'sacred_lotus',
    name: 'Hoa Sen',
    icon: '🪷',
    dayDesc: 'Slot này nhận (+3)',
    nightDesc: 'Slot này nhận (-3)',
    type: 'simple'
  },
  {
    id: 'cursed_hourglass',
    name: 'Đồng Hồ Cát',
    icon: '⏳',
    dayDesc: 'Slot này +1, 2 slot liền kề +1',
    nightDesc: 'Slot này -2, 2 slot liền kề -1',
    type: 'adjacent'
  }
];

class ClockfaceGame {
  constructor() {
    this.loopCount = 1;
    this.currentTurn = 1; // 1 to 12
    this.maxLives = 6;
    this.currentLives = 6;
    this.selectedCardIndex = null;
    this.isResolving = false;

    // 12 slots with initial values 2, 4, 6 ... 24
    this.slots = [];
    this.playerHand = [];
    this.currentHandAngle = 0; // needle angle in degrees

    this.fingerOrder = [
      { id: 'finger-pinky', name: 'Ngón Út' },
      { id: 'finger-ring', name: 'Ngón Áp Út' },
      { id: 'finger-middle', name: 'Ngón Giữa' },
      { id: 'finger-index', name: 'Ngón Trỏ' },
      { id: 'finger-thumb', name: 'Ngón Cái' },
      { id: 'part-wrist', name: 'Cổ Tay' }
    ];

    this.initSlots();
    this.bindEvents();
    this.renderAll();
    this.showHelpModal(true);
  }

  initSlots() {
    this.slots = [];
    for (let i = 1; i <= 12; i++) {
      this.slots.push({
        hour: i, // 1 to 12
        baseValue: i * 2, // 2, 4, 6 ... 24
        pendingModifier: 0,
        hasCard: true,
        hasWard: false,
        cardData: this.randomCard()
      });
    }
  }

  randomCard() {
    const card = CARD_POOL[Math.floor(Math.random() * CARD_POOL.length)];
    return { ...card, uid: Math.random().toString(36).substring(2, 9) };
  }

  isDayPhase() {
    return this.currentTurn <= 6;
  }

  bindEvents() {
    document.getElementById('btn-next-tick').addEventListener('click', () => this.advanceTurn());
    document.getElementById('btn-resolve-loop').addEventListener('click', () => this.resolveMidnight());
    document.getElementById('btn-help').addEventListener('click', () => this.showHelpModal());
    document.getElementById('modal-btn-confirm').addEventListener('click', () => this.closeModal());
  }

  // Find lowest-value slot with an uncollected card
  findNextTargetSlot() {
    const availableSlots = this.slots.filter(s => s.hasCard);
    if (availableSlots.length === 0) return null;

    // Sort by current predicted value (base + pending), then by hour
    availableSlots.sort((a, b) => {
      const valA = a.baseValue + a.pendingModifier;
      const valB = b.baseValue + b.pendingModifier;
      if (valA === valB) return a.hour - b.hour;
      return valA - valB;
    });

    return availableSlots[0];
  }

  // Turn Progression
  advanceTurn(skipIncrement = false) {
    if (this.isResolving || this.currentLives <= 0) return;

    audio.playTick();

    const targetSlot = this.findNextTargetSlot();
    if (targetSlot) {
      // 1. Move Clock Needle to target slot
      this.aimNeedleAtSlot(targetSlot.hour);

      // 2. Draw card from that slot into player hand
      setTimeout(() => {
        targetSlot.hasCard = false;
        this.playerHand.push(targetSlot.cardData);
        audio.playCard();
        this.logMessage(`Kim giờ chỉ vào [Cung ${targetSlot.hour}h]! Rút được lá [${targetSlot.cardData.name}].`);
        this.renderAll();
      }, 350);
    }

    if (!skipIncrement) {
      this.currentTurn++;
      if (this.currentTurn > 12) {
        // Automatically prompt midnight resolution
        setTimeout(() => this.resolveMidnight(), 600);
      }
    }

    this.renderHUD();
  }

  aimNeedleAtSlot(hour) {
    // 12 o'clock is 0 deg. Each hour is 30 deg.
    const targetDeg = (hour % 12) * 30;
    
    // Smooth rotation calculation to avoid 360-jump
    let diff = (targetDeg - (this.currentHandAngle % 360));
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    this.currentHandAngle += diff;

    const needle = document.getElementById('clock-hand');
    needle.style.transform = `rotate(${this.currentHandAngle}deg)`;
  }

  // Play a Card on Target Slot
  playCardOnSlot(slotIndex) {
    if (this.selectedCardIndex === null || this.isResolving) return;

    const card = this.playerHand[this.selectedCardIndex];
    const targetSlot = this.slots[slotIndex];
    const isDay = this.isDayPhase();

    audio.playCard();

    // Calculate opposite slot index (hour + 6 mod 12)
    const oppositeIndex = (slotIndex + 6) % 12;
    const nextAdjacentIndex = (slotIndex + 1) % 12;
    const prevAdjacentIndex = (slotIndex + 11) % 12;

    switch (card.id) {
      case 'pendulum':
        if (isDay) {
          targetSlot.pendingModifier += 2;
          this.slots[oppositeIndex].pendingModifier -= 2;
          this.logMessage(`[Con Lắc - Ngày]: Cung ${targetSlot.hour}h (+2), Cung ${this.slots[oppositeIndex].hour}h (-2).`);
        } else {
          targetSlot.pendingModifier -= 3;
          this.slots[oppositeIndex].pendingModifier += 3;
          this.logMessage(`[Con Lắc - Đêm]: Cung ${targetSlot.hour}h (-3), Cung ${this.slots[oppositeIndex].hour}h (+3).`);
        }
        break;

      case 'monk_ward':
        if (isDay) {
          targetSlot.hasWard = true;
          this.logMessage(`[Bùa Thầy Cúng - Ngày]: Yểm bùa hộ mệnh lên Cung ${targetSlot.hour}h!`);
        } else {
          // Night: force to 7..11
          const randVal = 7 + Math.floor(Math.random() * 5);
          targetSlot.pendingModifier = randVal - targetSlot.baseValue;
          this.logMessage(`[Bùa Thầy Cúng - Đêm]: Cung ${targetSlot.hour}h bị hoán đổi thành ${randVal}.`);
        }
        break;

      case 'mirror_shift':
        if (isDay) {
          const temp = targetSlot.pendingModifier;
          targetSlot.pendingModifier = this.slots[nextAdjacentIndex].pendingModifier;
          this.slots[nextAdjacentIndex].pendingModifier = temp;
          this.logMessage(`[Gương Soi - Ngày]: Đổi Modifier giữa Cung ${targetSlot.hour}h và ${this.slots[nextAdjacentIndex].hour}h.`);
        } else {
          targetSlot.pendingModifier = -targetSlot.pendingModifier;
          this.logMessage(`[Gương Soi - Đêm]: Đảo ngược dấu Modifier Cung ${targetSlot.hour}h.`);
        }
        break;

      case 'black_sun':
        if (isDay) {
          targetSlot.pendingModifier += 5;
          this.logMessage(`[Mặt Trời Đen - Ngày]: Cung ${targetSlot.hour}h (+5)!`);
        } else {
          targetSlot.pendingModifier -= 5;
          this.logMessage(`[Mặt Trời Đen - Đêm]: Cung ${targetSlot.hour}h (-5) & Tua nhanh kim!`);
          this.advanceTurn(true);
        }
        break;

      case 'sacred_lotus':
        if (isDay) {
          targetSlot.pendingModifier += 3;
          this.logMessage(`[Hoa Sen - Ngày]: Cung ${targetSlot.hour}h (+3).`);
        } else {
          targetSlot.pendingModifier -= 3;
          this.logMessage(`[Hoa Sen - Đêm]: Cung ${targetSlot.hour}h (-3).`);
        }
        break;

      case 'cursed_hourglass':
        if (isDay) {
          targetSlot.pendingModifier += 1;
          this.slots[nextAdjacentIndex].pendingModifier += 1;
          this.slots[prevAdjacentIndex].pendingModifier += 1;
          this.logMessage(`[Đồng Hồ Cát - Ngày]: Cung ${targetSlot.hour}h và 2 cung liền kề đều (+1).`);
        } else {
          targetSlot.pendingModifier -= 2;
          this.slots[nextAdjacentIndex].pendingModifier -= 1;
          this.slots[prevAdjacentIndex].pendingModifier -= 1;
          this.logMessage(`[Đồng Hồ Cát - Đêm]: Cung ${targetSlot.hour}h (-2) và 2 cung liền kề (-1).`);
        }
        break;
    }

    // Discard played card
    this.playerHand.splice(this.selectedCardIndex, 1);
    this.selectedCardIndex = null;
    this.renderAll();
  }

  // Midnight Reckoning (Chốt Sổ)
  resolveMidnight() {
    if (this.isResolving || this.currentLives <= 0) return;
    this.isResolving = true;

    audio.playMidnightBell();
    this.logMessage(`⏰ CHUÔNG NỬA ĐÊM ĐIỂM! Đang kiểm tra giá trị toàn bộ cung giờ...`);

    // Reset needle to 12 o'clock
    this.aimNeedleAtSlot(12);

    setTimeout(() => {
      let hit13Count = 0;
      let allNine = true;

      // Evaluate each slot
      this.slots.forEach(slot => {
        let finalVal = slot.baseValue + slot.pendingModifier;
        slot.pendingModifier = 0;

        // Monk ward save
        if (slot.hasWard && finalVal === 13) {
          finalVal = 9;
          slot.hasWard = false;
          audio.playBlessing();
          this.logMessage(`✨ Bùa Thầy Cúng đã cứu Cung ${slot.hour}h khỏi số 13 ➔ Biến thành 9!`);
        }

        slot.baseValue = finalVal;

        if (slot.baseValue === 13) {
          hit13Count++;
        }
        if (slot.baseValue !== 9) {
          allNine = false;
        }
      });

      this.renderSlots();

      // Check Penalties
      if (hit13Count > 0) {
        this.triggerChopPenalty(hit13Count);
      } else {
        if (allNine) {
          // Victory
          audio.playBlessing();
          this.showEndModal(true);
          return;
        } else {
          this.logMessage(`✨ Bình yên qua đêm! Không có ô nào dính 13.`);
        }
      }

      // Check Game Over
      if (this.currentLives <= 0) {
        this.showEndModal(false);
        return;
      }

      // Start Next Loop after delay
      setTimeout(() => {
        this.startNextLoop();
      }, 1800);

    }, 800);
  }

  // Guillotine Chop Animation
  triggerChopPenalty(chops = 1) {
    audio.playChop();

    // 1. Blade Drop
    const blade = document.getElementById('guillotine-blade');
    blade.classList.add('strike');

    // 2. Screen Shake & Blood Flash
    const wrapper = document.getElementById('screen-shake-wrapper');
    wrapper.classList.add('shake-hard');
    const blood = document.getElementById('blood-overlay');
    blood.classList.add('active');

    setTimeout(() => {
      blade.classList.remove('strike');
      wrapper.classList.remove('shake-hard');
      blood.classList.remove('active');
    }, 450);

    // 3. Sever finger(s)
    for (let c = 0; c < chops; c++) {
      if (this.currentLives > 0) {
        const fingerIdx = 6 - this.currentLives;
        const targetFinger = this.fingerOrder[fingerIdx];
        this.currentLives--;

        // Visual update on SVG
        if (targetFinger.id === 'part-wrist') {
          document.getElementById('part-wrist').style.fill = '#2a0a0a';
        } else {
          const el = document.getElementById(targetFinger.id);
          if (el) el.classList.add('severed');
        }

        this.logMessage(`🩸 PHẬP! Máy chém rơi xuống: Chặt đứt ${targetFinger.name}!`);
      }
    }

    this.renderHandStatus();
  }

  startNextLoop() {
    this.loopCount++;
    this.currentTurn = 1;
    this.isResolving = false;

    // Restock all cards
    this.slots.forEach(slot => {
      slot.hasCard = true;
      slot.cardData = this.randomCard();
      slot.pendingModifier = 0;
    });

    this.logMessage(`Vòng Lặp ${this.loopCount} bắt đầu. Sương mù siết chặt...`);
    this.renderAll();
  }

  logMessage(msg) {
    const logEl = document.getElementById('hand-log');
    logEl.textContent = msg;
  }

  // =========================================================
  // RENDERING FUNCTIONS
  // =========================================================

  renderAll() {
    this.renderHUD();
    this.renderSlots();
    this.renderPlayerHand();
    this.renderHandStatus();
  }

  renderHUD() {
    document.getElementById('turn-display').textContent = `${this.currentTurn} / 12`;
    document.getElementById('loop-display').textContent = this.loopCount;
    document.getElementById('hand-count').textContent = this.playerHand.length;

    const isDay = this.isDayPhase();
    const body = document.body;
    const badge = document.getElementById('phase-badge');
    const icon = document.getElementById('phase-icon');
    const text = document.getElementById('phase-text');

    if (isDay) {
      body.classList.remove('night-phase');
      body.classList.add('day-phase');
      icon.textContent = '☀️';
      text.textContent = 'BAN NGÀY (DAY)';
    } else {
      body.classList.remove('day-phase');
      body.classList.add('night-phase');
      icon.textContent = '🌙';
      text.textContent = 'BAN ĐÊM (NIGHT)';
    }
  }

  renderHandStatus() {
    document.getElementById('hp-counter').textContent = `${this.currentLives} / ${this.maxLives}`;
    const pips = document.querySelectorAll('.hp-pip');
    pips.forEach((pip, idx) => {
      if (idx < this.currentLives) {
        pip.classList.add('alive');
        pip.classList.remove('severed');
      } else {
        pip.classList.remove('alive');
        pip.classList.add('severed');
      }
    });
  }

  renderSlots() {
    const ring = document.getElementById('slots-ring');
    ring.innerHTML = '';

    const centerX = 290;
    const centerY = 290;
    const radius = 222;

    this.slots.forEach((slot, index) => {
      // 12 o'clock is at top: angle = hour * 30 - 90 deg
      const angleRad = ((slot.hour * 30) - 90) * (Math.PI / 180);
      const x = centerX + radius * Math.cos(angleRad);
      const y = centerY + radius * Math.sin(angleRad);

      const predictedTotal = slot.baseValue + slot.pendingModifier;

      const slotEl = document.createElement('div');
      slotEl.className = 'card-slot';
      slotEl.style.left = `${x}px`;
      slotEl.style.top = `${y}px`;

      if (slot.hasCard) slotEl.classList.add('has-card');
      else slotEl.classList.add('collected');

      if (slot.hasWard) slotEl.classList.add('has-ward');

      // Visual classes for 9 and 13
      if (predictedTotal === 9) slotEl.classList.add('is-sacred');
      if (predictedTotal === 13) slotEl.classList.add('peril-13');

      if (this.selectedCardIndex !== null) {
        slotEl.classList.add('targetable-hover');
      }

      // Slot inner HTML
      slotEl.innerHTML = `
        <div class="slot-card-pocket">
          <span class="slot-hour-badge">${slot.hour}h</span>
          <span class="slot-ward-badge" title="Được bảo vệ bởi Bùa Thầy Cúng">🛡️</span>
        </div>
        <div class="slot-value-panel">
          <span class="base-value">${slot.baseValue}</span>
          <span class="pending-modifier ${slot.pendingModifier !== 0 ? 'active' : ''} ${slot.pendingModifier > 0 ? 'positive' : 'negative'}">
            ${slot.pendingModifier > 0 ? '+' : ''}${slot.pendingModifier !== 0 ? slot.pendingModifier : ''}
          </span>
        </div>
      `;

      slotEl.addEventListener('click', () => {
        if (this.selectedCardIndex !== null) {
          this.playCardOnSlot(index);
        }
      });

      ring.appendChild(slotEl);
    });
  }

  renderPlayerHand() {
    const list = document.getElementById('player-hand-list');
    list.innerHTML = '';

    if (this.playerHand.length === 0) {
      list.innerHTML = `<div style="color: #7d6b5c; font-style: italic; font-size: 0.8rem; padding: 20px;">
        Chưa có bài trên tay. Hãy bấm [NHÍCH KIM] để rút bài từ các cung giờ!
      </div>`;
      return;
    }

    const isDay = this.isDayPhase();

    this.playerHand.forEach((card, index) => {
      const cardEl = document.createElement('div');
      cardEl.className = `tarot-card ${this.selectedCardIndex === index ? 'selected' : ''}`;

      cardEl.innerHTML = `
        <div class="card-top-row">
          <span class="card-name">${card.name}</span>
          <span class="card-icon">${card.icon}</span>
        </div>
        <div class="card-effect-box">
          <span class="effect-label ${isDay ? 'day' : 'night'}">
            ${isDay ? '☀️ BẢN NGÃ NGÀY' : '🌙 DẠNG QUỶ ĐÊM'}:
          </span>
          ${isDay ? card.dayDesc : card.nightDesc}
        </div>
        <div class="card-footer">
          <span>${isDay ? 'Blessed' : 'Cursed'}</span>
          <span>Click để chọn</span>
        </div>
      `;

      cardEl.addEventListener('click', () => {
        if (this.selectedCardIndex === index) {
          this.selectedCardIndex = null;
        } else {
          this.selectedCardIndex = index;
          audio.playCard();
        }
        this.renderAll();
      });

      list.appendChild(cardEl);
    });
  }

  // =========================================================
  // MODALS
  // =========================================================

  showHelpModal(isWelcome = false) {
    const title = isWelcome ? "BẮT ĐẦU BUỔI GỌI HỒN: 13 IS CURSED, 9 IS BLESSED" : "LUẬT CHƠI";
    const body = `
      <p>Tay trái của bạn đang bị cùm sắt khoá chặt trên bàn gọi hồn. Mỗi sai lầm sẽ phải trả giá bằng một ngón tay!</p>
      
      <h3>🎯 MỤC TIÊU CHIẾN THẮNG:</h3>
      <p>Điều phối giá trị của <strong>TẤT CẢ 12 Card Slot về đúng số 9</strong> (Con số Phước lành / Thần tài của người Thái).</p>

      <h3>🩸 ĐIỀU KIỆN CHẶT TAY (THUA PHẠT):</h3>
      <p>Mỗi khi kim hoàn thành 12 lượt và bước vào <strong>Pha Chốt Sổ</strong>: Nếu có bất kỳ ô nào có giá trị chạm đúng <strong>13 (Quỷ Ám)</strong> ➔ Máy chém rơi xuống chặt đứt 1 ngón tay!</p>
      <p>Mất cả 5 ngón và cổ tay (hết 6 máu) ➔ <strong>GAME OVER</strong>.</p>

      <h3>☀️ CHU KỲ NGÀY & ĐÊM:</h3>
      <ul>
        <li><strong>Lượt 1 - 6 (Ban Ngày):</strong> Bài ở dạng Phước Lành (Cộng điểm, bùa hộ mệnh).</li>
        <li><strong>Lượt 7 - 12 (Ban Đêm):** Bài ở Dạng Quỷ (Trừ điểm, đánh đổi rủi ro).</li>
      </ul>

      <h3>⏱️ CÁCH CHƠI:</h3>
      <ol>
        <li>Bấm nút <strong>[NHÍCH KIM]</strong>: Kim sẽ quay đến cung giờ có số nhỏ nhất để rút lá bài úp lên tay bạn.</li>
        <li>Click chọn 1 lá bài trên tay ➔ Click vào 1 Cung giờ trên đồng hồ để kích hoạt hiệu ứng.</li>
        <li>Tính toán modifier sao cho né xa số 13 và tiến sát về số 9!</li>
      </ol>
    `;

    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-content').innerHTML = body;
    document.getElementById('modal-btn-confirm').textContent = isWelcome ? "BẮT ĐẦU VÁN ĐẤU" : "ĐÃ HIỂU";
    document.getElementById('modal-backdrop').classList.add('open');
  }

  showEndModal(isWin) {
    const title = isWin ? "🏆 CHIẾN THẮNG - NGHI THỨC HOÀN TẤT!" : "💀 BẠN ĐÃ CHẾT - BÀN TAY ĐỨT LÌA!";
    const body = isWin ? `
      <p style="color: #ffd700; font-size: 1.1rem; font-weight: 800;">
        Ánh sáng thần thánh rọi xuống! Tất cả các cung giờ đều đã đạt con số Phước Lành 9!
      </p>
      <p>Cùm sắt bật mở, lưỡi dao máy chém dừng lại. Bạn đã trốn thoát khỏi Cỗ Máy Đồng Hồ Quỷ Quyệt nguyên vẹn bàn tay!</p>
    ` : `
      <p style="color: #ff4d4d; font-size: 1.1rem; font-weight: 800;">
        Nhát chém cuối cùng đã chặt lìa cổ tay bạn! Máu phun ngập tràn bàn tế lễ!
      </p>
      <p>Linh hồn của bạn đã bị con quỷ của số 13 giam cầm vĩnh viễn trong vòng lặp thời gian...</p>
    `;

    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-content').innerHTML = body;
    const btn = document.getElementById('modal-btn-confirm');
    btn.textContent = "CHƠI LẠI TỪ ĐẦU";
    btn.onclick = () => {
      window.location.reload();
    };

    document.getElementById('modal-backdrop').classList.add('open');
  }

  closeModal() {
    document.getElementById('modal-backdrop').classList.remove('open');
  }
}

// Start game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.game = new ClockfaceGame();
});
