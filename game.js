/**
 * THE SEVERED LOOP - Core Gameplay Engine
 * Compact, concise, strictly fit within 100vh viewport.
 */

class SeveredLoopGame {
    constructor() {
        this.stage = 1;
        this.maxStages = 3;
        this.turn = 1;
        this.calm = 3;
        this.maxCalm = 3;

        // Health: 5 Nails -> 5 Fingers (10 HP)
        this.nails = ['pinky', 'ring', 'middle', 'index', 'thumb'];
        this.fingers = ['pinky', 'ring', 'middle', 'index', 'thumb'];

        // Memory Loop Sequence
        this.sequence = ['▲', '●', '■'];
        this.sequenceProgress = 0;

        // Grid Board State
        this.gridSize = 4; // 4x4 (Stage 1-2), 5x5 (Stage 3)
        this.grid = [];
        this.keysRequired = 1;
        this.keysFound = 0;

        // Threat System
        this.threatCardId = null;
        this.threatTurnsLeft = 0;
        this.shieldActive = false;
        this.ripNailMode = false;

        // 5 Skill Cards
        this.cards = [
            { id: 'scout', name: 'SOIKÍNH', cost: 1, state: 'intact', desc: 'Soi an toàn 2 ô kề cạnh' },
            { id: 'shield', name: 'KHIÊNG', cost: 1, state: 'intact', desc: 'Chặn 1 đòn bẫy kế tiếp' },
            { id: 'disarm', name: 'GỠ BẪY', cost: 1, state: 'intact', desc: 'Hóa giải 1 bẫy đã lật' },
            { id: 'truthLens', name: 'KÍNH THẬT', cost: 1, state: 'intact', desc: 'Kiểm tra Thật hay Giả' },
            { id: 'focus', name: 'BÌNH TÂM', cost: 1, state: 'intact', desc: 'Hoãn quái tấn công +2 lượt' }
        ];

        this.lastRevealedStatement = null;
        this.initCanvas();
        this.bindEvents();
        this.startStage(1);
    }

    initCanvas() {
        this.canvas = document.getElementById('bloodCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.bloodDrops = [];
        this.renderBloodLoop();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    spawnBlood(x, y, count = 18) {
        for (let i = 0; i < count; i++) {
            this.bloodDrops.push({
                x: x || (window.innerWidth / 2 + (Math.random() * 160 - 80)),
                y: y || (window.innerHeight / 2 + (Math.random() * 160 - 80)),
                vx: (Math.random() - 0.5) * 6,
                vy: Math.random() * 5 + 2,
                radius: Math.random() * 4 + 2,
                alpha: 1,
                decay: Math.random() * 0.02 + 0.01
            });
        }
    }

    renderBloodLoop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = this.bloodDrops.length - 1; i >= 0; i--) {
            const b = this.bloodDrops[i];
            b.x += b.vx;
            b.y += b.vy;
            b.alpha -= b.decay;

            this.ctx.fillStyle = `rgba(239, 35, 60, ${b.alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            this.ctx.fill();

            if (b.alpha <= 0) {
                this.bloodDrops.splice(i, 1);
            }
        }
        requestAnimationFrame(() => this.renderBloodLoop());
    }

    triggerScreenShake() {
        document.body.classList.add('shake');
        setTimeout(() => document.body.classList.remove('shake'), 350);
    }

    log(msg, type = 'normal') {
        const logBox = document.getElementById('eventLog');
        const entry = document.createElement('div');
        entry.className = `log-item ${type}`;
        entry.textContent = `[T${this.turn}] ${msg}`;
        logBox.appendChild(entry);
        logBox.scrollTop = logBox.scrollHeight;
    }

    bindEvents() {
        document.getElementById('btnMute').addEventListener('click', () => {
            window.soundController.enabled = !window.soundController.enabled;
            document.getElementById('btnMute').textContent = window.soundController.enabled ? '🔊 ÂM THANH' : '🔇 TẮT TIẾNG';
        });

        document.getElementById('btnRestart').addEventListener('click', () => {
            this.resetFullRun();
        });

        // Sacrifice Buttons
        document.getElementById('btnRipNail').addEventListener('click', () => this.handleSacrificeRipNail());
        document.getElementById('btnShieldCard').addEventListener('click', () => this.handleSacrificeShieldCard());
        document.getElementById('btnOverdrive').addEventListener('click', () => this.handleSacrificeOverdrive());

        // Modal close
        document.getElementById('modalBtnClose').addEventListener('click', () => {
            document.getElementById('modalOverlay').classList.add('hidden');
        });
    }

    resetFullRun() {
        this.stage = 1;
        this.turn = 1;
        this.calm = 3;
        this.nails = ['pinky', 'ring', 'middle', 'index', 'thumb'];
        this.fingers = ['pinky', 'ring', 'middle', 'index', 'thumb'];
        this.sequenceProgress = 0;
        this.cards.forEach(c => c.state = 'intact');
        this.threatCardId = null;
        this.threatTurnsLeft = 0;
        this.startStage(1);
        this.log('Làm mới Run. Bắt đầu lại Stage 1.', 'warn');
    }

    startStage(stageNum) {
        this.stage = stageNum;
        this.calm = this.maxCalm;
        this.sequenceProgress = 0;
        this.keysFound = 0;
        this.gridSize = (stageNum === 3) ? 5 : 4;
        this.keysRequired = stageNum;

        this.generateGrid();
        this.updateHUD();
        this.renderHand();
        this.renderCards();
        this.log(`Bắt đầu Stage ${this.stage}/${this.maxStages} (Lưới ${this.gridSize}x${this.gridSize}).`, 'sys');
    }

    generateGrid() {
        const boardEl = document.getElementById('boardGrid');
        boardEl.className = `board-grid grid-${this.gridSize}x${this.gridSize}`;
        boardEl.innerHTML = '';

        let trapCount = (this.stage === 1) ? 2 : (this.stage === 2 ? 3 : 5);
        let clueCount = (this.stage === 3) ? 3 : 2;
        let statementCount = (this.stage === 1) ? 2 : 3;
        let triggerCount = (this.stage === 3) ? 2 : 1;
        let keyCount = this.keysRequired;

        // Init grid
        this.grid = [];
        for (let r = 0; r < this.gridSize; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.gridSize; c++) {
                this.grid[r][c] = {
                    r, c,
                    type: 'safe',
                    revealed: false,
                    sealed: false,
                    keyGlyph: null,
                    statement: null,
                    clueVal: 0
                };
            }
        }

        // Start Tile (0, 0) is safe and revealed
        this.grid[0][0].revealed = true;
        this.grid[0][0].type = 'safe';

        let coords = [];
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (r === 0 && c === 0) continue;
                coords.push({ r, c });
            }
        }
        coords.sort(() => Math.random() - 0.5);

        // Keys
        for (let k = 0; k < keyCount; k++) {
            const pos = coords.pop();
            this.grid[pos.r][pos.c].type = 'key';
            this.grid[pos.r][pos.c].keyGlyph = this.sequence[k];
        }

        // Traps
        let trapCoords = [];
        for (let t = 0; t < trapCount; t++) {
            const pos = coords.pop();
            this.grid[pos.r][pos.c].type = 'trap';
            trapCoords.push(pos);
        }

        // Trigger
        for (let tr = 0; tr < triggerCount; tr++) {
            const pos = coords.pop();
            this.grid[pos.r][pos.c].type = 'trigger';
        }

        // Statements
        for (let s = 0; s < statementCount; s++) {
            const pos = coords.pop();
            this.grid[pos.r][pos.c].type = 'statement';
            const isEvil = (this.stage > 1 && s === 0);
            this.grid[pos.r][pos.c].statement = this.createDeductionStatement(pos, trapCoords, isEvil);
        }

        // Clues
        for (let cl = 0; cl < clueCount; cl++) {
            const pos = coords.pop();
            this.grid[pos.r][pos.c].type = 'clue';
        }

        // Clue numbers
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                let adjacentTraps = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < this.gridSize && nc >= 0 && nc < this.gridSize) {
                            if (this.grid[nr][nc].type === 'trap') adjacentTraps++;
                        }
                    }
                }
                this.grid[r][c].clueVal = adjacentTraps;
            }
        }

        // Render tiles
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const tileEl = this.createTileElement(this.grid[r][c]);
                boardEl.appendChild(tileEl);
            }
        }

        this.updateBoardReachability();
    }

    createDeductionStatement(pos, trapCoords, isEvil) {
        const trapInSameRow = trapCoords.some(t => t.r === pos.r);
        let truthText = trapInSameRow ? `Hàng [${pos.r + 1}] có bẫy.` : `Hàng [${pos.r + 1}] sạch bẫy.`;
        let lieText = trapInSameRow ? `Hàng [${pos.r + 1}] sạch bẫy.` : `Hàng [${pos.r + 1}] có bẫy.`;

        return {
            speaker: isEvil ? 'DỐI (EVIL)' : 'THẬT (GOOD)',
            isEvil: isEvil,
            text: isEvil ? lieText : truthText,
            revealedTruth: false
        };
    }

    createTileElement(tile) {
        const el = document.createElement('div');
        el.className = 'card-tile' + (tile.revealed ? ' revealed' : '');
        el.id = `tile_${tile.r}_${tile.c}`;

        el.innerHTML = `
            <div class="card-face card-back">
                <span class="card-rune">☩</span>
                <span class="coord">${tile.r},${tile.c}</span>
            </div>
            <div class="card-face card-front ${this.getTileClass(tile)}">
                ${this.getTileFrontContent(tile)}
            </div>
        `;

        el.addEventListener('click', () => this.handleTileClick(tile.r, tile.c));
        return el;
    }

    getTileClass(tile) {
        switch (tile.type) {
            case 'safe': return 'tile-safe';
            case 'trap': return 'tile-trap';
            case 'clue': return 'tile-clue';
            case 'statement': return 'tile-statement';
            case 'trigger': return 'tile-trigger';
            case 'key': return 'tile-key';
            default: return '';
        }
    }

    getTileFrontContent(tile) {
        switch (tile.type) {
            case 'safe':
                return `<span class="tile-icon">👣</span><span class="tile-name">AN TOÀN</span>`;
            case 'trap':
                return `<span class="tile-icon">☠️</span><span class="tile-name">BẪY</span>`;
            case 'clue':
                return `<span class="clue-number clue-${Math.min(tile.clueVal, 3)}">${tile.clueVal}</span><span class="tile-name">BẪY GẦN</span>`;
            case 'statement':
                return `<span class="tile-icon">👁️</span><span class="tile-name">LỜI KHAI</span>`;
            case 'trigger':
                return `<span class="tile-icon">⚡</span><span class="tile-name">NỔ (+)</span>`;
            case 'key':
                return `<span class="key-glyph">${tile.keyGlyph}</span><span class="tile-name">KHÓA</span>`;
            default:
                return '';
        }
    }

    isReachable(r, c) {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (let [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < this.gridSize && nc >= 0 && nc < this.gridSize) {
                if (this.grid[nr][nc].revealed) return true;
            }
        }
        return false;
    }

    updateBoardReachability() {
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const tile = this.grid[r][c];
                const el = document.getElementById(`tile_${r}_${c}`);
                if (!el) continue;

                if (tile.revealed) {
                    el.classList.add('revealed');
                    el.classList.remove('reachable', 'locked');
                } else if (tile.sealed) {
                    el.classList.add('sealed');
                } else if (this.isReachable(r, c) || this.ripNailMode) {
                    el.classList.add('reachable');
                    el.classList.remove('locked');
                } else {
                    el.classList.add('locked');
                    el.classList.remove('reachable');
                }
            }
        }
    }

    handleTileClick(r, c) {
        const tile = this.grid[r][c];

        if (this.ripNailMode) {
            this.ripNailMode = false;
            document.body.style.cursor = 'default';
            this.log(`Soi sáng ô [${r}, ${c}].`, 'gain');
            this.revealTile(tile, true);
            return;
        }

        if (tile.revealed) {
            if (tile.type === 'statement') this.displayStatement(tile.statement);
            return;
        }

        if (tile.sealed) {
            this.log(`Ô [${r}, ${c}] đã bị phong ấn.`, 'warn');
            return;
        }

        if (!this.isReachable(r, c)) {
            this.log(`Ô [${r}, ${c}] bị khóa! Chỉ lật ô kề cạnh.`, 'warn');
            return;
        }

        this.revealTile(tile, false);
        this.nextTurn();
    }

    revealTile(tile, isSafeReveal = false) {
        tile.revealed = true;
        const el = document.getElementById(`tile_${tile.r}_${tile.c}`);
        if (el) el.classList.add('revealed');

        window.soundController.playCardFlip();

        if (tile.type === 'safe') {
            this.log(`Lật [${tile.r}, ${tile.c}]: An toàn.`);
        } else if (tile.type === 'trap') {
            if (isSafeReveal) {
                this.log(`Hóa giải Bẫy tại [${tile.r}, ${tile.c}].`, 'gain');
            } else if (this.shieldActive) {
                this.shieldActive = false;
                this.log(`KHIÊNG đỡ đòn bẫy [${tile.r}, ${tile.c}].`, 'gain');
                window.soundController.playKeyUnlock();
            } else {
                this.log(`DẪM BẪY [${tile.r}, ${tile.c}]! (-1 HP)`, 'dmg');
                window.soundController.playTrap();
                this.takeDamage(1);
            }
        } else if (tile.type === 'clue') {
            this.log(`Gợi ý [${tile.r}, ${tile.c}]: Có ${tile.clueVal} bẫy kề.`);
        } else if (tile.type === 'statement') {
            this.log(`Lật Lời Khai [${tile.r}, ${tile.c}].`);
            this.displayStatement(tile.statement);
        } else if (tile.type === 'trigger') {
            this.log(`TRIGGER [${tile.r}, ${tile.c}]! Nổ 4 ô kề cạnh.`, 'warn');
            window.soundController.playTriggerExplosion();
            this.executeCrossTrigger(tile.r, tile.c);
        } else if (tile.type === 'key') {
            this.handleKeyTile(tile);
        }

        this.updateBoardReachability();
    }

    executeCrossTrigger(r, c) {
        const cross = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        cross.forEach(([dr, dc]) => {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < this.gridSize && nc >= 0 && nc < this.gridSize) {
                const target = this.grid[nr][nc];
                if (!target.revealed && !target.sealed) {
                    setTimeout(() => this.revealTile(target, false), 150);
                }
            }
        });
    }

    displayStatement(statement) {
        this.lastRevealedStatement = statement;
        const box = document.getElementById('statementContent');
        const speakerClass = statement.isEvil ? 'speaker-evil' : 'speaker-good';
        box.innerHTML = `
            <div class="speaker-tag ${speakerClass}">${statement.speaker}</div>
            <div>"${statement.text}"</div>
            ${statement.revealedTruth ? `<div style="color:#4ade80; font-size:0.65rem; margin-top:2px;">✔ Đã xác thực: ${statement.isEvil ? 'NÓI DỐI' : 'NÓI THẬT'}</div>` : ''}
        `;
    }

    handleKeyTile(tile) {
        const expectedGlyph = this.sequence[this.sequenceProgress];
        const keyEl = document.getElementById(`tile_${tile.r}_${tile.c}`);

        if (tile.keyGlyph === expectedGlyph) {
            this.sequenceProgress++;
            this.keysFound++;
            tile.activated = true;
            if (keyEl) keyEl.querySelector('.card-front').classList.add('activated');

            window.soundController.playKeyUnlock();
            this.log(`ĐÚNG NGHI THỨC: [${tile.keyGlyph}] (${this.sequenceProgress}/${this.sequence.length}).`, 'gain');
            this.updateHUD();

            if (this.keysFound >= this.keysRequired) {
                setTimeout(() => this.completeStage(), 500);
            }
        } else {
            this.log(`SAI NGHI THỨC! Cần [${expectedGlyph}], kích hoạt [${tile.keyGlyph}]. Trừ 1 ngón!`, 'dmg');
            window.soundController.playBoneCrack();
            this.triggerScreenShake();
            this.spawnBlood(window.innerWidth / 2, window.innerHeight / 2, 25);
            this.takeDamage(1);
        }
    }

    completeStage() {
        if (this.stage < this.maxStages) {
            this.showModal(
                `QUA STAGE ${this.stage}!`,
                `Đã giải mã thành công nghi thức. Bước sang Stage ${this.stage + 1}...`,
                () => this.startStage(this.stage + 1)
            );
        } else {
            window.soundController.playVictory();
            this.showModal(
                `🎉 CHIẾN THẮNG (RUN THÀNH CÔNG)!`,
                `Vượt qua cả 3 Stage!<br>
                 - Móng: <strong>${this.nails.length}/5</strong> | Ngón: <strong>${this.fingers.length}/5</strong><br>
                 - Thẻ bảo toàn: <strong>${this.cards.filter(c => c.state !== 'destroyed').length}/5</strong>`
            );
        }
    }

    takeDamage(amount = 1) {
        this.triggerScreenShake();
        this.spawnBlood(window.innerWidth / 2, window.innerHeight / 2, 20);

        for (let i = 0; i < amount; i++) {
            if (this.nails.length > 0) {
                const ripped = this.nails.shift();
                window.soundController.playNailRip();
                this.log(`Móng (${ripped.toUpperCase()}) bị rách! (-1 HP)`, 'dmg');
            } else if (this.fingers.length > 0) {
                const severed = this.fingers.shift();
                window.soundController.playBoneCrack();
                this.log(`Ngón (${severed.toUpperCase()}) bị chặt đứt! (-1 HP)`, 'dmg');
            } else {
                this.triggerGameOver('Hết ngón tay! Bàn tay bị hủy hoàn toàn.');
                return;
            }
        }

        this.renderHand();
        this.updateHUD();

        if (this.nails.length === 0 && this.fingers.length === 0) {
            this.triggerGameOver('Hết ngón tay! Bàn tay bị hủy.');
        }
    }

    triggerGameOver(reason) {
        window.soundController.playDefeat();
        this.showModal(`☠️ THẤT BẠI (GAME OVER)`, `${reason}<br><br>Nhấn RESET để chơi lại.`);
    }

    nextTurn() {
        this.turn++;
        this.tickThreatSystem();
        this.updateHUD();
    }

    tickThreatSystem() {
        if (!this.threatCardId && this.turn % 2 === 0) {
            const availableCards = this.cards.filter(c => c.state !== 'destroyed');
            if (availableCards.length > 0) {
                const target = availableCards[Math.floor(Math.random() * availableCards.length)];
                this.threatCardId = target.id;
                this.threatTurnsLeft = 1;
                window.soundController.playThreatWarning();
                this.log(`CẢNH BÁO: Quái ngắm thẻ [${target.name}]!`, 'dmg');
                this.updateThreatBanner(true, `CẢNH BÁO: Quái sẽ xé thẻ [${target.name}] ở lượt sau! Hãy chặt ngón hoặc dùng skill!`);
                this.renderCards();
            }
        } else if (this.threatCardId) {
            this.threatTurnsLeft--;
            if (this.threatTurnsLeft <= 0) {
                const card = this.cards.find(c => c.id === this.threatCardId);
                if (card && card.state !== 'destroyed') {
                    if (card.state === 'intact') {
                        card.state = 'damaged';
                        this.log(`Thẻ [${card.name}] bị cào rách!`, 'dmg');
                    } else {
                        card.state = 'destroyed';
                        this.log(`Thẻ [${card.name}] BỊ HỦY!`, 'dmg');
                    }
                    window.soundController.playTrap();
                    this.triggerScreenShake();
                }
                this.threatCardId = null;
                this.updateThreatBanner(false);
                this.renderCards();

                if (this.cards.every(c => c.state === 'destroyed')) {
                    this.triggerGameOver('Mất toàn bộ 5 thẻ hỗ trợ!');
                }
            }
        }
    }

    updateThreatBanner(show, text = '') {
        const banner = document.getElementById('threatBanner');
        const txt = document.getElementById('threatText');
        if (show) {
            banner.classList.remove('hidden');
            txt.textContent = text;
        } else {
            banner.classList.add('hidden');
        }
    }

    handleSacrificeRipNail() {
        if (this.nails.length === 0) {
            alert('Đã hết móng tay!');
            return;
        }
        const rip = this.nails.shift();
        window.soundController.playNailRip();
        this.triggerScreenShake();
        this.spawnBlood(window.innerWidth / 2, window.innerHeight * 0.8, 15);
        this.log(`Bẻ móng (${rip.toUpperCase()})! Chọn 1 ô để soi sáng.`, 'gain');

        this.ripNailMode = true;
        document.body.style.cursor = 'crosshair';
        this.renderHand();
        this.updateHUD();
        this.updateBoardReachability();
    }

    handleSacrificeShieldCard() {
        if (!this.threatCardId) {
            alert('Quái chưa ngắm vào thẻ nào!');
            return;
        }
        if (this.fingers.length === 0) {
            alert('Không còn ngón tay nào!');
            return;
        }
        const severed = this.fingers.shift();
        window.soundController.playBoneCrack();
        this.triggerScreenShake();
        this.spawnBlood(window.innerWidth / 2, window.innerHeight * 0.8, 25);

        this.log(`Chặt ngón (${severed.toUpperCase()})! Cứu thẻ [${this.threatCardId.toUpperCase()}].`, 'gain');
        this.threatCardId = null;
        this.updateThreatBanner(false);
        this.renderHand();
        this.renderCards();
        this.updateHUD();

        if (this.fingers.length === 0) this.triggerGameOver('Chặt đến ngón cuối cùng! Thua cuộc.');
    }

    handleSacrificeOverdrive() {
        if (this.fingers.length === 0) {
            alert('Không còn ngón tay nào!');
            return;
        }
        const severed = this.fingers.shift();
        window.soundController.playBoneCrack();
        this.triggerScreenShake();
        this.spawnBlood(window.innerWidth / 2, window.innerHeight * 0.8, 25);

        this.calm = this.maxCalm;
        this.log(`OVERDRIVE! Chặt ngón (${severed.toUpperCase()}) hồi đầy 3 Calm.`, 'gain');
        this.renderHand();
        this.updateHUD();

        if (this.fingers.length === 0) this.triggerGameOver('Chặt đến ngón cuối cùng! Thua cuộc.');
    }

    useCardSkill(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card || card.state === 'destroyed') return;

        if (this.calm < card.cost) {
            this.log(`Không đủ Calm (cần ${card.cost}).`, 'warn');
            return;
        }

        this.calm -= card.cost;
        window.soundController.playCardFlip();
        this.updateHUD();

        switch (cardId) {
            case 'scout':
                this.skillScout();
                break;
            case 'shield':
                this.shieldActive = true;
                this.log('KHIÊNG kích hoạt: Đỡ 1 bẫy tiếp theo.', 'gain');
                break;
            case 'disarm':
                this.skillDisarm();
                break;
            case 'truthLens':
                this.skillTruthLens();
                break;
            case 'focus':
                if (this.threatTurnsLeft > 0) {
                    this.threatTurnsLeft += 2;
                    this.log('BÌNH TÂM: Hoãn đòn quái +2 lượt.', 'gain');
                } else {
                    this.log('BÌNH TÂM: Không có đòn quái nào.', 'warn');
                }
                break;
        }
    }

    skillScout() {
        let reachable = [];
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (!this.grid[r][c].revealed && this.isReachable(r, c)) {
                    reachable.push(this.grid[r][c]);
                }
            }
        }
        if (reachable.length === 0) {
            this.log('Không còn ô kề cạnh nào chưa lật.', 'warn');
            return;
        }
        reachable.sort(() => Math.random() - 0.5);
        const scouted = reachable.slice(0, 2);
        scouted.forEach(t => {
            this.log(`Soi [${t.r}, ${t.c}]: [${t.type.toUpperCase()}].`, 'gain');
            this.revealTile(t, true);
        });
    }

    skillDisarm() {
        let revealedTraps = [];
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.grid[r][c].revealed && this.grid[r][c].type === 'trap') {
                    revealedTraps.push(this.grid[r][c]);
                }
            }
        }
        if (revealedTraps.length > 0) {
            const trap = revealedTraps[0];
            trap.type = 'safe';
            const el = document.getElementById(`tile_${trap.r}_${trap.c}`);
            if (el) el.querySelector('.card-front').className = 'card-face card-front tile-safe';
            this.log(`Gỡ bẫy [${trap.r}, ${trap.c}] thành công.`, 'gain');
            window.soundController.playKeyUnlock();
        } else {
            this.log('Không có bẫy lộ diện để gỡ.', 'warn');
        }
    }

    skillTruthLens() {
        if (!this.lastRevealedStatement) {
            this.log('Chưa lật Lời Khai nào.', 'warn');
            return;
        }
        this.lastRevealedStatement.revealedTruth = true;
        const result = this.lastRevealedStatement.isEvil ? 'NÓI DỐI (EVIL)' : 'NÓI THẬT (GOOD)';
        this.log(`KÍNH THẬT: Lời khai là ${result}.`, 'gain');
        this.displayStatement(this.lastRevealedStatement);
    }

    renderHand() {
        const fingerMap = {
            pinky: document.getElementById('fingerPinky'),
            ring: document.getElementById('fingerRing'),
            middle: document.getElementById('fingerMiddle'),
            index: document.getElementById('fingerIndex'),
            thumb: document.getElementById('fingerThumb')
        };

        const nailMap = {
            pinky: document.getElementById('nailPinky'),
            ring: document.getElementById('nailRing'),
            middle: document.getElementById('nailMiddle'),
            index: document.getElementById('nailIndex'),
            thumb: document.getElementById('nailThumb')
        };

        Object.keys(nailMap).forEach(key => {
            nailMap[key].className = this.nails.includes(key) ? 'nail intact' : 'nail ripped';
        });

        Object.keys(fingerMap).forEach(key => {
            if (this.fingers.includes(key)) {
                fingerMap[key].classList.remove('severed');
            } else {
                fingerMap[key].classList.add('severed');
            }
        });

        document.getElementById('nailCountBadge').textContent = `MÓNG: ${this.nails.length}/5`;
        document.getElementById('fingerCountBadge').textContent = `NGÓN: ${this.fingers.length}/5`;
    }

    renderCards() {
        const list = document.getElementById('cardsList');
        list.innerHTML = '';

        this.cards.forEach(card => {
            const el = document.createElement('div');
            el.className = `skill-card ${card.state}`;
            if (this.threatCardId === card.id) el.classList.add('targeted');

            el.innerHTML = `
                <div class="card-top-bar">
                    <span class="c-name">${card.name}</span>
                    <span class="c-cost">${card.cost}C</span>
                </div>
                <div class="c-desc">${card.desc}</div>
                <div class="c-status">${card.state.toUpperCase()}</div>
            `;

            el.addEventListener('click', () => this.useCardSkill(card.id));
            list.appendChild(el);
        });
    }

    updateHUD() {
        document.getElementById('stageIndicator').textContent = `${this.stage} / ${this.maxStages}`;
        document.getElementById('turnCounter').textContent = String(this.turn).padStart(2, '0');
        document.getElementById('calmCounter').textContent = `${this.calm} / ${this.maxCalm}`;

        const seqContainer = document.getElementById('sequenceDisplay');
        const steps = seqContainer.querySelectorAll('.seq-step');
        steps.forEach((st, idx) => {
            st.classList.remove('active', 'completed');
            if (idx < this.sequenceProgress) st.classList.add('completed');
            else if (idx === this.sequenceProgress) st.classList.add('active');
        });
    }

    showModal(title, content, onClose = null) {
        const overlay = document.getElementById('modalOverlay');
        const titleEl = document.getElementById('modalTitle');
        const contentEl = document.getElementById('modalContent');
        const btn = document.getElementById('modalBtnClose');

        titleEl.innerHTML = title;
        contentEl.innerHTML = content;
        overlay.classList.remove('hidden');

        btn.onclick = () => {
            overlay.classList.add('hidden');
            if (onClose) onClose();
        };
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.game = new SeveredLoopGame();
});
