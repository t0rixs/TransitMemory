// Todo管理クラス
class TodoManager {
    constructor() {
        this.todos = [];
        this.storageKey = 'travel-todos';
        this.locationHistoryKey = 'location-history';
        this.locationHistory = [];
        this.confirmCallback = null; // 確認モーダル用のコールバック
        this.init();
    }

    // 初期化
    init() {
        this.loadFromStorage();
        this.loadLocationHistory();
        this.removeExpiredTodos();
        this.setDateInputConstraints();
        this.bindEvents();
        this.render();
    }

    // イベントリスナーの設定
    bindEvents() {
        const form = document.getElementById('todoForm');
        form.addEventListener('submit', this.handleSubmit.bind(this));
        
        // 編集フォームのイベントリスナー
        const editForm = document.getElementById('editTodoForm');
        editForm.addEventListener('submit', this.handleEditSubmit.bind(this));
        
        // モーダル関連のイベントリスナー
        const addTodoBtn = document.getElementById('addTodoBtn');
        const closeModalBtn = document.getElementById('closeModal');
        const modal = document.getElementById('todoModal');
        const modalOverlay = document.querySelector('.modal-overlay');

        addTodoBtn.addEventListener('click', this.openModal.bind(this));
        closeModalBtn.addEventListener('click', this.closeModal.bind(this));
        modalOverlay.addEventListener('click', this.closeModal.bind(this));

        // 編集モーダル関連のイベントリスナー
        const closeEditModalBtn = document.getElementById('closeEditModal');
        const deleteBtn = document.getElementById('deleteBtn');
        const editModal = document.getElementById('editTodoModal');
        const editModalOverlay = editModal.querySelector('.modal-overlay');

        closeEditModalBtn.addEventListener('click', this.closeEditModal.bind(this));
        deleteBtn.addEventListener('click', this.handleDelete.bind(this));
        editModalOverlay.addEventListener('click', this.closeEditModal.bind(this));

        // URL入力モーダル関連のイベントリスナー
        const urlForm = document.getElementById('urlForm');
        const closeUrlModalBtn = document.getElementById('closeUrlModal');
        const urlModal = document.getElementById('urlModal');
        const urlModalOverlay = urlModal.querySelector('.modal-overlay');

        urlForm.addEventListener('submit', this.handleUrlSubmit.bind(this));
        closeUrlModalBtn.addEventListener('click', this.closeUrlModal.bind(this));
        urlModalOverlay.addEventListener('click', this.closeUrlModal.bind(this));

        // 日付ダイヤルモーダル関連のイベントリスナー
        const closeDateDialModalBtn = document.getElementById('closeDateDialModal');
        const dateDialConfirmBtn = document.getElementById('dateDialConfirmBtn');
        const dateDialModal = document.getElementById('dateDialModal');
        const dateDialModalOverlay = dateDialModal.querySelector('.modal-overlay');

        closeDateDialModalBtn.addEventListener('click', this.closeDateDialModal.bind(this));
        dateDialConfirmBtn.addEventListener('click', this.handleDateDialConfirm.bind(this));
        dateDialModalOverlay.addEventListener('click', this.closeDateDialModal.bind(this));

        // フォーム用ダイヤル選択ボタンのイベントリスナー
        const openDialForAdd = document.getElementById('openDialForAdd');
        const openDialForEdit = document.getElementById('openDialForEdit');
        
        openDialForAdd.addEventListener('click', () => {
            this.openDateDialModalForForm('add');
        });
        
        openDialForEdit.addEventListener('click', () => {
            this.openDateDialModalForForm('edit');
        });

        // 日付入力フィールドの変更監視（逆方向連携）
        const datetimeInput = document.getElementById('datetime');
        const editDatetimeInput = document.getElementById('editDatetime');
        
        datetimeInput.addEventListener('change', (e) => {
            this.syncDateInputToDial(e.target.value, 'add');
        });
        
        editDatetimeInput.addEventListener('change', (e) => {
            this.syncDateInputToDial(e.target.value, 'edit');
        });

        // Escキーでモーダルを閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (modal.style.display === 'block') {
                    this.closeModal();
                }
                if (editModal.style.display === 'block') {
                    this.closeEditModal();
                }
                if (urlModal.style.display === 'block') {
                    this.closeUrlModal();
                }
                if (dateDialModal.style.display === 'block') {
                    this.closeDateDialModal();
                }
                if (confirmModal.style.display === 'block') {
                    this.closeConfirmModal();
                }
            }
        });

        // 履歴全削除ボタンのイベントリスナー
        const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');
        clearAllHistoryBtn.addEventListener('click', this.handleClearAllHistory.bind(this));

        // 確認モーダル関連のイベントリスナー
        const confirmModal = document.getElementById('confirmModal');
        const closeConfirmModalBtn = document.getElementById('closeConfirmModal');
        const confirmCancelBtn = document.getElementById('confirmCancelBtn');
        const confirmOkBtn = document.getElementById('confirmOkBtn');
        const confirmModalOverlay = confirmModal.querySelector('.modal-overlay');

        closeConfirmModalBtn.addEventListener('click', this.closeConfirmModal.bind(this));
        confirmCancelBtn.addEventListener('click', this.closeConfirmModal.bind(this));
        confirmOkBtn.addEventListener('click', this.handleConfirmOk.bind(this));
        confirmModalOverlay.addEventListener('click', this.closeConfirmModal.bind(this));
    }

    // フォーム送信処理
    handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const todo = {
            id: Date.now().toString(),
            transportType: formData.get('transportType'),
            departureLocation: formData.get('departureLocation'),
            returnLocation: formData.get('returnLocation'),
            datetime: formData.get('datetime'),
            reserved: false, // 予約ステータス（デフォルトは未予約）
            reservationUrl: '', // 予約確認URL
            createdAt: new Date().toISOString()
        };

        // バリデーション
        const validationResult = this.validateTodo(todo);
        if (!validationResult.isValid) {
            this.showErrorMessage(validationResult.message);
            return;
        }

        // 選択された都道府県を履歴に追加
        this.addToLocationHistory(todo.departureLocation);
        this.addToLocationHistory(todo.returnLocation);
        
        // Todoを追加
        this.addTodo(todo);
        
        // モーダルを閉じる
        this.closeModal();
        
        // 成功メッセージを表示
        this.showSuccessMessage('新しいTodoが追加されました！');
    }

    // 今日の日付を取得（YYYY-MM-DD形式）
    getTodayDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 1週間後の日付を取得（YYYY-MM-DD形式）
    getOneWeekLaterDate() {
        const oneWeekLater = new Date();
        oneWeekLater.setDate(oneWeekLater.getDate() + 7);
        const year = oneWeekLater.getFullYear();
        const month = String(oneWeekLater.getMonth() + 1).padStart(2, '0');
        const day = String(oneWeekLater.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 1ヶ月後の日付を取得（YYYY-MM-DD形式）
    getOneMonthLaterDate() {
        const oneMonthLater = new Date();
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        const year = oneMonthLater.getFullYear();
        const month = String(oneMonthLater.getMonth() + 1).padStart(2, '0');
        const day = String(oneMonthLater.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 1週間以内の日付かどうかを判定
    isWithinOneWeek(dateString) {
        const today = this.getTodayDate();
        const oneWeekLater = this.getOneWeekLaterDate();
        return dateString >= today && dateString <= oneWeekLater;
    }

    // 1ヶ月以内の日付かどうかを判定
    isWithinOneMonth(dateString) {
        const today = this.getTodayDate();
        const oneMonthLater = this.getOneMonthLaterDate();
        return dateString >= today && dateString <= oneMonthLater;
    }

    // 二つの日付間の期間境界を検出
    detectTimeBoundaries(date1, date2) {
        const boundaries = [];
        const today = this.getTodayDate();
        const oneWeekLater = this.getOneWeekLaterDate();
        const oneMonthLater = this.getOneMonthLaterDate();
        
        // date1 < date2 であることを前提とする
        
        // 1週間境界をチェック
        if (date1 <= oneWeekLater && date2 > oneWeekLater) {
            boundaries.push({
                type: 'week',
                label: '残り1週間',
                date: oneWeekLater
            });
        }
        
        // 1ヶ月境界をチェック
        if (date1 <= oneMonthLater && date2 > oneMonthLater) {
            boundaries.push({
                type: 'month',
                label: '残り1ヶ月',
                date: oneMonthLater
            });
        }
        
        return boundaries;
    }

    // 期限切れのTodoを削除
    removeExpiredTodos() {
        const today = this.getTodayDate();
        const originalLength = this.todos.length;
        
        this.todos = this.todos.filter(todo => {
            return todo.datetime >= today;
        });
        
        // 削除されたTodoがある場合、ストレージを更新
        if (this.todos.length < originalLength) {
            this.saveToStorage();
            const removedCount = originalLength - this.todos.length;
            console.log(`期限切れのTodo ${removedCount}件を削除しました。`);
        }
    }

    // 日付入力フィールドの制約を設定
    setDateInputConstraints() {
        const today = this.getTodayDate();
        const datetimeInput = document.getElementById('datetime');
        const editDatetimeInput = document.getElementById('editDatetime');
        
        if (datetimeInput) {
            datetimeInput.setAttribute('min', today);
        }
        if (editDatetimeInput) {
            editDatetimeInput.setAttribute('min', today);
        }
    }

    // バリデーション
    validateTodo(todo) {
        // 基本的な必須フィールドのチェック
        if (!todo.transportType || !todo.departureLocation || !todo.returnLocation || !todo.datetime) {
            return {
                isValid: false,
                message: 'すべての項目を入力してください。'
            };
        }
        
        // 日付が今日以降かチェック
        const today = this.getTodayDate();
        if (todo.datetime < today) {
            return {
                isValid: false,
                message: '日付は今日以降を選択してください。過去の日付は無効です。'
            };
        }
        
        return {
            isValid: true,
            message: ''
        };
    }

    // Todo追加
    addTodo(todo) {
        this.todos.push(todo);
        this.saveToStorage();
        this.render();
    }

    // Todo削除
    deleteTodo(id) {
        this.todos = this.todos.filter(todo => todo.id !== id);
        this.saveToStorage();
        this.render();
        this.showSuccessMessage('Todoが削除されました。');
    }

    // ローカルストレージに保存
    saveToStorage() {
        try {
            const jsonData = JSON.stringify(this.todos);
            localStorage.setItem(this.storageKey, jsonData);
        } catch (error) {
            console.error('保存エラー:', error);
            this.showErrorMessage('データの保存に失敗しました。');
        }
    }

    // ローカルストレージから読み込み
    loadFromStorage() {
        try {
            const jsonData = localStorage.getItem(this.storageKey);
            if (jsonData) {
                this.todos = JSON.parse(jsonData);
                
                // 後方互換性：既存のTodoに新しいフィールドがない場合は追加
                this.todos = this.todos.map(todo => ({
                    ...todo,
                    reserved: todo.reserved || false,
                    reservationUrl: todo.reservationUrl || ''
                }));
            }
        } catch (error) {
            console.error('読み込みエラー:', error);
            this.showErrorMessage('データの読み込みに失敗しました。');
            this.todos = [];
        }
    }

    // 都道府県履歴を読み込み
    loadLocationHistory() {
        try {
            const historyData = localStorage.getItem(this.locationHistoryKey);
            if (historyData) {
                this.locationHistory = JSON.parse(historyData);
            }
        } catch (error) {
            console.error('履歴読み込みエラー:', error);
            this.locationHistory = [];
        }
    }

    // 都道府県履歴を保存
    saveLocationHistory() {
        try {
            localStorage.setItem(this.locationHistoryKey, JSON.stringify(this.locationHistory));
        } catch (error) {
            console.error('履歴保存エラー:', error);
        }
    }

    // 都道府県を履歴に追加
    addToLocationHistory(location) {
        if (!location || location === '') return;
        
        // 既存の履歴から同じものを削除
        this.locationHistory = this.locationHistory.filter(item => item !== location);
        
        // 先頭に追加
        this.locationHistory.unshift(location);
        
        // 最大10件まで保持
        if (this.locationHistory.length > 10) {
            this.locationHistory = this.locationHistory.slice(0, 10);
        }
        
        this.saveLocationHistory();
    }

    // 都道府県選択肢を履歴順+北順に並び替え（上位6件+---+全47都道府県）
    updateLocationOptions(selectElement) {
        if (!selectElement) return;
        
        // 現在の選択値を保持
        const currentValue = selectElement.value;
        
        // 都道府県の北順リスト（都道府県コード順）
        const prefecturesInOrder = [
            '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
            '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
            '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
            '岐阜県', '静岡県', '愛知県', '三重県',
            '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
            '鳥取県', '島根県', '岡山県', '広島県', '山口県',
            '徳島県', '香川県', '愛媛県', '高知県',
            '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
        ];
        
        // 履歴にある都道府県（履歴順、最大6件）
        const historyLocations = this.locationHistory.filter(location => 
            prefecturesInOrder.includes(location)
        ).slice(0, 6);
        
        // 選択肢をクリア（最初のオプションは残す）
        selectElement.innerHTML = '<option value="">選択してください</option>';
        
        // 上位6件を追加
        historyLocations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            option.dataset.isHistory = 'true';
            selectElement.appendChild(option);
        });
        
        // 区切り線（---）を追加
        if (historyLocations.length > 0) {
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '---';
            separator.value = '';
            separator.dataset.isSeparator = 'true';
            selectElement.appendChild(separator);
        }
        
        // 全47都道府県を下部に追加（重複あり）
        prefecturesInOrder.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            option.dataset.isAll = 'true';
            selectElement.appendChild(option);
        });
        
        // 元の選択値を復元
        selectElement.value = currentValue;
    }

    // 画面表示の更新
    render() {
        const container = document.getElementById('todoContainer');
        
        // 今日の予約を表示
        this.renderTodayReservations();
        
        if (this.todos.length === 0) {
            container.innerHTML = `
                <div class="no-todos">
                    <p>まだTogoがありません。新しいTogoを追加してください。</p>
                </div>
            `;
            return;
        }

        // 日付順に並べる
        const sortedTodos = this.todos.sort((a, b) => {
            return new Date(a.datetime) - new Date(b.datetime);
        });

        const todoHTML = sortedTodos.map((todo, index) => {
            // 次のTodoがあるかどうかと接続されているかどうかを判定
            let isConnected = false;
            if (index < sortedTodos.length - 1) {
                const nextTodo = sortedTodos[index + 1];
                isConnected = todo.returnLocation === nextTodo.departureLocation;
            }
            
            const currentTodoHTML = this.createTodoHTML(todo, isConnected);
            
            // 次のTodoがある場合、接続線と期間境界線を追加
            if (index < sortedTodos.length - 1) {
                const nextTodo = sortedTodos[index + 1];
                const connectionHTML = this.createConnectionHTML(todo, nextTodo);
                return currentTodoHTML + connectionHTML;
            }
            
            return currentTodoHTML;
        }).join('');
        
        container.innerHTML = todoHTML;

        // 削除ボタンのイベントリスナーを設定
        this.bindEditButtons();
        
        // ステータスライトのイベントリスナーを設定
        this.bindStatusLights();
        
        // 日付カレンダーのクリックイベントリスナーを設定
        this.bindDateCalendarClicks();
        
        // スマホ用todoアイテムタップイベントを設定
        this.bindMobileTapEvents();
    }

    // 今日の予約を表示
    renderTodayReservations() {
        const today = this.getTodayDate();
        const todayTodos = this.todos.filter(todo => {
            return todo.datetime === today;
        });

        const todayUrlSection = document.getElementById('todayUrlSection');
        const todayUrlList = document.getElementById('todayUrlList');

        if (todayTodos.length === 0) {
            todayUrlSection.style.display = 'none';
            return;
        }

        todayUrlSection.style.display = 'block';
        
        const todayHTML = todayTodos.map(todo => {
            const transportText = todo.transportType === 'airplane' ? '✈️ 飛行機' : '🚌 高速バス';
            const isReserved = todo.reserved && todo.reservationUrl;
            const itemClass = isReserved ? 'reserved' : 'not-reserved';
            
            let actionContent;
            if (isReserved) {
                const urlDomain = this.extractDomain(todo.reservationUrl);
                actionContent = `
                    <a href="${todo.reservationUrl}" target="_blank" rel="noopener noreferrer" class="today-url-link">
                        URL${urlDomain}で確認
                    </a>
                `;
            } else {
                actionContent = `
                    <div class="today-warning">
                        <span class="today-warning-icon">⚠️</span>
                        予約は済んでいますか？
                    </div>
                `;
            }
            
            return `
                <div class="today-url-item ${itemClass}">
                    <div class="today-url-info">
                        <div class="today-url-route">
                            ${todo.departureLocation} → ${todo.returnLocation}
                        </div>
                        <div class="today-url-transport">
                            ${transportText}
                        </div>
                    </div>
                    ${actionContent}
                </div>
            `;
        }).join('');

        todayUrlList.innerHTML = todayHTML;
    }

    // URLからドメイン名を抽出
    extractDomain(url) {
        try {
            const domain = new URL(url).hostname;
            // www. を除去
            return domain.replace(/^www\./, '');
        } catch (error) {
            return 'リンク';
        }
    }

    // Todo項目のHTML生成
    createTodoHTML(todo, isConnected = false) {
        const transportTypeText = todo.transportType === 'airplane' ? '飛行機' : '高速バス';
        const datetime = new Date(todo.datetime);
        
        // 日付を月と日に分けて表示
        const month = datetime.getMonth() + 1;
        const day = datetime.getDate();
        const monthText = `${month}月`;
        const dayText = `${day}`;
        
        // スマホ用の日付表示（M/D形式）
        const internalDateText = `${month}/${day}`;

        // 接続されている場合は特別なクラスを適用
        const itemClass = isConnected ? 'todo-item-connection' : 'todo-item';

        // 1週間以内で未予約の場合の警告（アクションエリア用）
        const isWithinOneWeek = this.isWithinOneWeek(todo.datetime);
        const isNotReserved = !todo.reserved || !todo.reservationUrl;
        const showWarning = isWithinOneWeek && isNotReserved;

        return `
            <div class="${itemClass} transport-${todo.transportType}" data-id="${todo.id}">
                
                <!-- 枠外日付表示 - カレンダー風 -->
                <div class="todo-date-external">
                    <div class="date-month">${monthText}</div>
                    <div class="date-day">${dayText}</div>
                </div>
                
                <div class="todo-details-location">
                    <div>
                        <span>${todo.departureLocation}</span>
                    </div>
                    <span class="todo-arrow">${todo.transportType === 'airplane' ? '→✈️→' : '→🚌→'}</span>
                    <div>
                        <span>${todo.returnLocation}</span>
                    </div>
                </div>

                <div class="todo-actions">
                    <div class="action-row">
                        <div class="action-left">
                            <button class="edit-btn" data-id="${todo.id}">編集</button>
                            ${showWarning ? `
                                <div class="warning-inline">
                                    <span class="warning-icon">⚠️</span>
                                    <span class="warning-text">あと1週間</span>
                                </div>
                            ` : ''}
                        </div>
                        <div class="action-right">
                            ${showWarning ? `
                                <div class="warning-inline">
                                    <span class="warning-icon">⚠️</span>
                                    <span class="warning-text">あと1週間</span>
                                </div>
                            ` : ''}
                            <div class="status-group">
                                <div class="status-text ${todo.reserved ? 'reserved' : 'not-reserved'}">${todo.reserved ? '予約済み' : '未予約'}</div>
                                <div class="status-light ${todo.reserved ? 'reserved' : 'not-reserved'}" data-id="${todo.id}" title="${todo.reserved ? '予約済み' : '未予約'}">
                                    <div class="light-inner"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- スマホ用の枠内日付表示 -->
                <div class="todo-date-internal">${internalDateText}</div>
            </div>
        `;
    }

    // Todo間の接続線HTML生成
    createConnectionHTML(currentTodo, nextTodo) {
        const currentReturn = currentTodo.returnLocation;
        const nextDeparture = nextTodo.departureLocation;
        
        // 期間境界を取得
        const boundaries = this.detectTimeBoundaries(currentTodo.datetime, nextTodo.datetime);
        const boundary = boundaries.find(b => b.type === 'week') || boundaries[0];
        
        // 前のTodoの到着地と次のTodoの出発地が同じ場合のみ接続線を表示
        if (currentReturn === nextDeparture) {
            const currentTime = new Date(currentTodo.datetime);
            const nextTime = new Date(nextTodo.datetime);
            const stayDuration = this.calculateStayDuration(currentTime,nextTime);
            
            // 境界線がある場合は背景に表示
            const boundaryBackground = boundary ? `<div class="boundary-line-background"></div>` : '';
            const boundaryLabel = boundary ? `
                <div class="boundary-label">
                    <span class="boundary-text">${boundary.label}</span>
                </div>
            ` : '';
            
            return `
                <div class="todo-connection">
                    ${boundaryBackground}
                    <div class="connection-line"></div>
                    <div class="connection-info">
                        <div class="stay-location">
                            <span class="mobile-shown">${currentReturn}</span>
                            <span class="mobile-hidden">${currentReturn}での滞在</span>
                        </div>
                        <div class="stay-duration">${stayDuration}</div>
                    </div>
                    ${boundaryLabel}
                </div>
            `;
        } else {
            // 接続がない場合でも80pxの間隔を確保
            const boundaryContent = boundary ? `
                <div class="boundary-line-background"></div>
                <div class="boundary-label">
                    <span class="boundary-text">${boundary.label}</span>
                </div>
            ` : '';
            
            return `
                <div class="time-boundary">
                    ${boundaryContent}
                </div>
            `;
        }
    }



    // 滞在時間の計算（日数のみ）
    calculateStayDuration(startTime, endTime) {
        const diffMs = endTime - startTime;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return `0日`;
        } else {
            return `${diffDays}日`;
        }
    }

    // 削除ボタンのイベントリスナー設定
    bindEditButtons() {
        const editButtons = document.querySelectorAll('.edit-btn');
        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                this.openEditModal(id);
            });
        });
    }

    // ステータスライトのイベントリスナー設定
    bindStatusLights() {
        const statusLights = document.querySelectorAll('.status-light');
        statusLights.forEach(light => {
            light.addEventListener('click', (e) => {
                e.stopPropagation(); // 親要素のイベント伝播を防ぐ
                const id = e.currentTarget.getAttribute('data-id');
                this.toggleReservationStatus(id);
            });
        });
    }

    // 予約ステータスの切り替え
    toggleReservationStatus(id) {
        const todo = this.todos.find(todo => todo.id === id);
        if (todo) {
            if (todo.reserved) {
                // 既に予約済みの場合、予約解除の確認
                if (confirm('予約を取り消しますか？')) {
                    todo.reserved = false;
                    todo.reservationUrl = '';
                    this.saveToStorage();
                    this.render();
                    this.showSuccessMessage('予約を取り消しました。');
                }
            } else {
                // 未予約の場合、URL入力モーダルを表示
                this.openUrlModal(id);
            }
        }
    }

    // 成功メッセージ表示
    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    // エラーメッセージ表示
    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    // メッセージ表示（共通）
    showMessage(message, type) {
        // 既存のメッセージを削除
        const existingMessages = document.querySelectorAll('.success-message, .error-message');
        existingMessages.forEach(msg => msg.remove());

        // 新しいメッセージを作成
        const messageElement = document.createElement('div');
        messageElement.className = `${type}-message show`;
        messageElement.textContent = message;

        // フォームの前に挿入
        const form = document.getElementById('todoForm');
        form.parentNode.insertBefore(messageElement, form);

        // 3秒後に自動削除
        setTimeout(() => {
            messageElement.remove();
        }, 3000);
    }

    // JSONデータのエクスポート（デバッグ用）
    exportData() {
        return JSON.stringify(this.todos, null, 2);
    }

    // JSONデータのインポート（デバッグ用）
    importData(jsonData) {
        try {
            this.todos = JSON.parse(jsonData);
            this.saveToStorage();
            this.render();
            this.showSuccessMessage('データがインポートされました。');
        } catch (error) {
            console.error('インポートエラー:', error);
            this.showErrorMessage('データのインポートに失敗しました。');
        }
    }

    // モーダルを開く
    openModal() {
        const modal = document.getElementById('todoModal');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // スクロールを無効化
        
        // 都道府県選択肢を履歴順に更新
        this.updateLocationOptions(document.getElementById('departureLocation'));
        this.updateLocationOptions(document.getElementById('returnLocation'));
    }

    // モーダルを閉じる
    closeModal() {
        const modal = document.getElementById('todoModal');
        modal.style.display = 'none';
        document.body.style.overflow = ''; // スクロールを復元
        
        // フォームをリセット
        const form = document.getElementById('todoForm');
        form.reset();
    }

    // 編集モーダルを開く
    openEditModal(id) {
        const modal = document.getElementById('editTodoModal');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // スクロールを無効化

        // 都道府県選択肢を履歴順に更新
        this.updateLocationOptions(document.getElementById('editDepartureLocation'));
        this.updateLocationOptions(document.getElementById('editReturnLocation'));

        // 編集対象のTodoを取得してフォームに設定
        const todoToEdit = this.todos.find(todo => todo.id === id);
        if (todoToEdit) {
            document.getElementById('editTodoId').value = todoToEdit.id;
            document.getElementById('editTransportType').value = todoToEdit.transportType;
            document.getElementById('editDepartureLocation').value = todoToEdit.departureLocation;
            document.getElementById('editReturnLocation').value = todoToEdit.returnLocation;
            document.getElementById('editDatetime').value = todoToEdit.datetime;
            document.getElementById('editReserved').checked = todoToEdit.reserved || false;
            
            // 削除ボタンにIDを設定
            document.getElementById('deleteBtn').setAttribute('data-id', todoToEdit.id);
        }
    }

    // 編集モーダルを閉じる
    closeEditModal() {
        const modal = document.getElementById('editTodoModal');
        modal.style.display = 'none';
        document.body.style.overflow = ''; // スクロールを復元
        
        // フォームをリセット
        const form = document.getElementById('editTodoForm');
        form.reset();
    }

    // 編集フォーム送信処理
    handleEditSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const originalTodo = this.todos.find(todo => todo.id === formData.get('editTodoId'));
        const editedTodo = {
            id: formData.get('editTodoId'),
            transportType: formData.get('transportType'),
            departureLocation: formData.get('departureLocation'),
            returnLocation: formData.get('returnLocation'),
            datetime: formData.get('datetime'),
            reserved: formData.has('reserved'), // チェックボックスの状態を取得
            reservationUrl: originalTodo.reservationUrl || '', // 元のURLを維持
            createdAt: originalTodo.createdAt // 元の作成日時を維持
        };

        // バリデーション
        const validationResult = this.validateTodo(editedTodo);
        if (!validationResult.isValid) {
            this.showErrorMessage(validationResult.message);
            return;
        }

        // 選択された都道府県を履歴に追加
        this.addToLocationHistory(editedTodo.departureLocation);
        this.addToLocationHistory(editedTodo.returnLocation);
        
        // Todoを更新
        this.updateTodo(editedTodo);
        
        // 編集モーダルを閉じる
        this.closeEditModal();
        
        // 成功メッセージを表示
        this.showSuccessMessage('Todoが更新されました！');
    }

    // Todoを更新
    updateTodo(editedTodo) {
        const index = this.todos.findIndex(todo => todo.id === editedTodo.id);
        if (index !== -1) {
            this.todos[index] = editedTodo;
            this.saveToStorage();
            this.render();
        }
    }

    // 削除処理
    handleDelete(e) {
        const id = document.getElementById('deleteBtn').getAttribute('data-id');
        this.showConfirmModal(
            'Todo削除の確認',
            'このTodoを削除してもよろしいですか？',
            () => {
                this.deleteTodo(id);
                this.closeEditModal();
                this.showSuccessMessage('Todoが削除されました。');
            }
        );
    }

    // 履歴全削除処理
    handleClearAllHistory() {
        // カスタム確認モーダルを表示
        this.showConfirmModal(
            '履歴全削除の確認',
            '本当に全ての履歴を削除しますか？\nこの操作は取り消せません。',
            () => {
                // 全てのTodoを削除
                this.todos = [];
                this.saveToStorage();
                
                // 今日の予約セクションを非表示
                const todayUrlSection = document.getElementById('todayUrlSection');
                todayUrlSection.style.display = 'none';
                
                // 画面を再描画
                this.render();
                
                // 成功メッセージを表示
                this.showSuccessMessage('全ての履歴が削除されました。');
            }
        );
    }

    // 確認モーダルを表示
    showConfirmModal(title, message, callback) {
        this.confirmCallback = callback;
        
        // モーダルの内容を設定
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        
        // モーダルを表示
        const modal = document.getElementById('confirmModal');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    // 確認モーダルを閉じる
    closeConfirmModal() {
        const modal = document.getElementById('confirmModal');
        modal.style.display = 'none';
        document.body.style.overflow = '';
        this.confirmCallback = null;
    }

    // 確認モーダルのOKボタン処理
    handleConfirmOk() {
        if (this.confirmCallback) {
            this.confirmCallback();
        }
        this.closeConfirmModal();
    }

    // URL入力モーダルを開く
    openUrlModal(id) {
        const modal = document.getElementById('urlModal');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // TodoのIDを設定
        document.getElementById('urlTodoId').value = id;
        
        // URLフィールドをリセット
        document.getElementById('reservationUrl').value = '';
    }

    // URL入力モーダルを閉じる
    closeUrlModal() {
        const modal = document.getElementById('urlModal');
        modal.style.display = 'none';
        document.body.style.overflow = '';
        
        // フォームをリセット
        const form = document.getElementById('urlForm');
        form.reset();
    }

    // URL入力フォーム送信処理
    handleUrlSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const todoId = formData.get('todoId');
        const reservationUrl = formData.get('reservationUrl');
        
        // URLのバリデーション
        if (!reservationUrl) {
            this.showErrorMessage('URLを入力してください。');
            return;
        }
        
        // URLの形式チェック
        try {
            new URL(reservationUrl);
        } catch (error) {
            this.showErrorMessage('有効なURLを入力してください。');
            return;
        }
        
        // Todoを予約済みに更新
        const todo = this.todos.find(todo => todo.id === todoId);
        if (todo) {
            todo.reserved = true;
            todo.reservationUrl = reservationUrl;
            this.saveToStorage();
            this.render();
            
            // モーダルを閉じる
            this.closeUrlModal();
            
            // 成功メッセージを表示
            this.showSuccessMessage('予約が確認されました！');
        }
    }

    // 日付カレンダーのクリックイベントリスナー設定
    bindDateCalendarClicks() {
        const dateCalendars = document.querySelectorAll('.todo-date-external');
        dateCalendars.forEach(calendar => {
            calendar.addEventListener('click', (e) => {
                e.stopPropagation();
                const todoItem = calendar.closest('.todo-item, .todo-item-connection');
                const todoId = todoItem.getAttribute('data-id');
                this.openDateDialModal(todoId);
            });
        });
    }

    // スマホ用todoアイテムタップイベント設定
    bindMobileTapEvents() {
        const todoItems = document.querySelectorAll('.todo-item, .todo-item-connection');
        todoItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // 画面幅が768px以下の場合のみ処理
                if (window.innerWidth > 768) {
                    return;
                }
                
                // 既にクリックされた要素が編集ボタンやステータスライトの場合はスキップ
                if (e.target.classList.contains('edit-btn') || 
                    e.target.classList.contains('status-light') ||
                    e.target.closest('.status-light') ||
                    e.target.closest('.edit-btn') ||
                    e.target.closest('.todo-date-external')) {
                    return;
                }
                
                const id = item.getAttribute('data-id');
                if (id) {
                    this.openEditModal(id);
                }
            });
        });
    }

    // 日付ダイヤルモーダルを開く
    openDateDialModal(todoId) {
        const modal = document.getElementById('dateDialModal');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // TodoのIDを設定
        document.getElementById('dateDialTodoId').value = todoId;
        this.dialMode = 'todo'; // モードを設定
        
        // 現在の日付を取得
        const todo = this.todos.find(todo => todo.id === todoId);
        if (todo) {
            const currentDate = new Date(todo.datetime);
            this.selectedYear = currentDate.getFullYear();
            this.selectedMonth = currentDate.getMonth() + 1;
            this.selectedDay = currentDate.getDate();
            
            // ダイヤルを初期化
            this.initializeDials();
            this.updateCurrentDateDisplay();
        }
    }

    // フォーム用の日付ダイヤルモーダルを開く
    openDateDialModalForForm(formType) {
        const modal = document.getElementById('dateDialModal');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // フォームタイプを設定
        this.dialMode = formType; // 'add' or 'edit'
        
        // 日付の初期値を決定（優先順位順）
        let initialDate;
        
        // 1. 同期された日付があればそれを使用
        if (this.formDateSync && this.formDateSync[formType]) {
            const syncedDate = this.formDateSync[formType];
            this.selectedYear = syncedDate.year;
            this.selectedMonth = syncedDate.month;
            this.selectedDay = syncedDate.day;
        } else {
            // 2. 日付入力フィールドの値を取得
            let dateInput;
            if (formType === 'add') {
                dateInput = document.getElementById('datetime');
            } else if (formType === 'edit') {
                dateInput = document.getElementById('editDatetime');
            }
            
            if (dateInput.value) {
                // 既に値が入力されている場合はそれを使用
                initialDate = new Date(dateInput.value);
                this.selectedYear = initialDate.getFullYear();
                this.selectedMonth = initialDate.getMonth() + 1;
                this.selectedDay = initialDate.getDate();
            } else {
                // 3. 値がない場合は今日の日付を使用
                initialDate = new Date();
                this.selectedYear = initialDate.getFullYear();
                this.selectedMonth = initialDate.getMonth() + 1;
                this.selectedDay = initialDate.getDate();
            }
        }
        
        // ダイヤルを初期化
        this.initializeDials();
        this.updateCurrentDateDisplay();
    }

    // 日付ダイヤルモーダルを閉じる
    closeDateDialModal() {
        const modal = document.getElementById('dateDialModal');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    // ダイヤルを初期化
    initializeDials() {
        this.initializeYearDial();
        this.initializeMonthDial();
        this.initializeDayDial();
        
        // スクロールイベントリスナーを設定
        this.setupScrollSnapListeners();
    }

    // 年ダイヤルを初期化
    initializeYearDial() {
        const yearItems = document.getElementById('yearItems');
        const currentYear = new Date().getFullYear();
        const startYear = currentYear;
        const endYear = currentYear + 10;
        
        yearItems.innerHTML = '';
        
        for (let year = startYear; year <= endYear; year++) {
            const item = document.createElement('div');
            item.className = 'dial-item';
            item.textContent = year;
            item.dataset.value = year;
            
            if (year === this.selectedYear) {
                item.classList.add('selected');
            }
            
            item.addEventListener('click', () => {
                this.selectedYear = year;
                this.updateDialSelection('year');
                this.updateDayDial(); // 年が変わったら日も更新
                this.updateCurrentDateDisplay();
                // クリック後に自動スクロール
                this.scrollToSelected('yearDial');
            });
            
            yearItems.appendChild(item);
        }
        
        // スクロール位置を調整
        this.scrollToSelected('yearDial');
    }

    // 月ダイヤルを初期化
    initializeMonthDial() {
        const monthItems = document.getElementById('monthItems');
        const months = [
            '1月', '2月', '3月', '4月', '5月', '6月',
            '7月', '8月', '9月', '10月', '11月', '12月'
        ];
        
        monthItems.innerHTML = '';
        
        months.forEach((monthName, index) => {
            const monthValue = index + 1;
            const item = document.createElement('div');
            item.className = 'dial-item';
            item.textContent = monthName;
            item.dataset.value = monthValue;
            
            if (monthValue === this.selectedMonth) {
                item.classList.add('selected');
            }
            
            item.addEventListener('click', () => {
                this.selectedMonth = monthValue;
                this.updateDialSelection('month');
                this.updateDayDial(); // 月が変わったら日も更新
                this.updateCurrentDateDisplay();
                // クリック後に自動スクロール
                this.scrollToSelected('monthDial');
            });
            
            monthItems.appendChild(item);
        });
        
        // スクロール位置を調整
        this.scrollToSelected('monthDial');
    }

    // 日ダイヤルを初期化
    initializeDayDial() {
        this.updateDayDial();
        this.scrollToSelected('dayDial');
    }

    // 日ダイヤルを更新（月や年の変更に対応）
    updateDayDial() {
        const dayItems = document.getElementById('dayItems');
        const daysInMonth = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
        
        dayItems.innerHTML = '';
        
        for (let day = 1; day <= daysInMonth; day++) {
            const item = document.createElement('div');
            item.className = 'dial-item';
            item.textContent = day;
            item.dataset.value = day;
            
            if (day === this.selectedDay) {
                item.classList.add('selected');
            }
            
            item.addEventListener('click', () => {
                this.selectedDay = day;
                this.updateDialSelection('day');
                this.updateCurrentDateDisplay();
                // クリック後に自動スクロール
                this.scrollToSelected('dayDial');
            });
            
            dayItems.appendChild(item);
        }
        
        // 選択されている日が月の日数を超えている場合は調整
        if (this.selectedDay > daysInMonth) {
            this.selectedDay = daysInMonth;
            this.updateCurrentDateDisplay();
        }
        
        // 日ダイヤルが更新された後もスクロールスナップを再設定
        setTimeout(() => {
            this.setupDialScrollSnap('dayDial', 'day');
        }, 100);
    }

    // ダイヤルの選択状態を更新
    updateDialSelection(dialType) {
        const dialId = dialType + 'Items';
        const items = document.querySelectorAll(`#${dialId} .dial-item`);
        
        items.forEach(item => {
            item.classList.remove('selected');
            const value = parseInt(item.dataset.value);
            
            if ((dialType === 'year' && value === this.selectedYear) ||
                (dialType === 'month' && value === this.selectedMonth) ||
                (dialType === 'day' && value === this.selectedDay)) {
                item.classList.add('selected');
            }
        });
    }

    // 選択された項目にスクロール
    scrollToSelected(dialId) {
        setTimeout(() => {
            const dial = document.getElementById(dialId);
            const selectedItem = dial.querySelector('.dial-item.selected');
            
            if (selectedItem) {
                const dialRect = dial.getBoundingClientRect();
                const itemRect = selectedItem.getBoundingClientRect();
                const scrollTop = selectedItem.offsetTop - (dial.offsetHeight / 2) + (selectedItem.offsetHeight / 2);
                
                dial.scrollTop = scrollTop;
            }
        }, 100);
    }

    // 現在の日付表示を更新
    updateCurrentDateDisplay() {
        const display = document.getElementById('currentDateDisplay');
        const dateString = `${this.selectedYear}年${this.selectedMonth}月${this.selectedDay}日`;
        display.textContent = dateString;
    }

    // 日付ダイヤル確定処理
    handleDateDialConfirm() {
        // 新しい日付を作成（YYYY-MM-DD形式）
        const year = this.selectedYear;
        const month = String(this.selectedMonth).padStart(2, '0');
        const day = String(this.selectedDay).padStart(2, '0');
        const newDate = `${year}-${month}-${day}`;
        
        // 今日以降かチェック
        const today = this.getTodayDate();
        if (newDate < today) {
            this.showErrorMessage('日付は今日以降を選択してください。');
            return;
        }
        
        // モードに応じて処理を分岐
        if (this.dialMode === 'todo') {
            // 既存Todo日付変更の処理
            const todoId = document.getElementById('dateDialTodoId').value;
            const todo = this.todos.find(todo => todo.id === todoId);
            
            if (todo) {
                // Todoの日付を更新
                todo.datetime = newDate;
                this.saveToStorage();
                this.render();
                
                // 成功メッセージを表示
                this.showSuccessMessage('日付を変更しました！');
            }
        } else if (this.dialMode === 'add') {
            // 新規追加フォームの日付入力フィールドに設定
            const dateInput = document.getElementById('datetime');
            dateInput.value = newDate;
            
            // 成功メッセージを表示
            this.showSuccessMessage('日付を設定しました！');
        } else if (this.dialMode === 'edit') {
            // 編集フォームの日付入力フィールドに設定
            const dateInput = document.getElementById('editDatetime');
            dateInput.value = newDate;
            
            // 成功メッセージを表示
            this.showSuccessMessage('日付を設定しました！');
        }
        
        // モーダルを閉じる
        this.closeDateDialModal();
    }

    // スクロールスナップリスナーを設定
    setupScrollSnapListeners() {
        this.setupDialScrollSnap('yearDial', 'year');
        this.setupDialScrollSnap('monthDial', 'month');
        this.setupDialScrollSnap('dayDial', 'day');
    }

    // 各ダイヤルのスクロールスナップを設定
    setupDialScrollSnap(dialId, dialType) {
        const dial = document.getElementById(dialId);
        
        // 既存のスクロールタイムアウトをクリア
        if (this.scrollTimeouts && this.scrollTimeouts[dialId]) {
            clearTimeout(this.scrollTimeouts[dialId]);
        }
        
        // スクロールタイムアウトを管理するオブジェクトを初期化
        if (!this.scrollTimeouts) {
            this.scrollTimeouts = {};
        }
        
        // 既存のスクロールリスナーを削除（重複防止）
        if (this.scrollListeners && this.scrollListeners[dialId]) {
            dial.removeEventListener('scroll', this.scrollListeners[dialId]);
        }
        
        // スクロールリスナーを管理するオブジェクトを初期化
        if (!this.scrollListeners) {
            this.scrollListeners = {};
        }
        
        // 新しいスクロールリスナーを作成
        const scrollListener = () => {
            // 自動スクロール中はスナップ処理をスキップ
            if (this.isScrolling && this.isScrolling[dialId]) {
                return;
            }
            
            // 前のタイムアウトをクリア
            clearTimeout(this.scrollTimeouts[dialId]);
            
            // スクロールが止まったら実行（200ms後）
            this.scrollTimeouts[dialId] = setTimeout(() => {
                this.snapToNearestItem(dialId, dialType);
            }, 200);
        };
        
        // リスナーを保存
        this.scrollListeners[dialId] = scrollListener;
        
        // イベントリスナーを追加
        dial.addEventListener('scroll', scrollListener);
    }

    // 最も近いアイテムにスナップ
    snapToNearestItem(dialId, dialType) {
        const dial = document.getElementById(dialId);
        const items = dial.querySelectorAll('.dial-item');
        
        if (items.length === 0) return;
        
        const dialRect = dial.getBoundingClientRect();
        const dialCenter = dialRect.top + dialRect.height / 2;
        
        let nearestItem = null;
        let minDistance = Infinity;
        
        // 最も中央に近いアイテムを見つける
        items.forEach(item => {
            const itemRect = item.getBoundingClientRect();
            const itemCenter = itemRect.top + itemRect.height / 2;
            const distance = Math.abs(itemCenter - dialCenter);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestItem = item;
            }
        });
        
        if (nearestItem) {
            // 値を更新
            const value = parseInt(nearestItem.dataset.value);
            
            if (dialType === 'year') {
                this.selectedYear = value;
                this.updateDayDial(); // 年が変わったら日も更新
            } else if (dialType === 'month') {
                this.selectedMonth = value;
                this.updateDayDial(); // 月が変わったら日も更新
            } else if (dialType === 'day') {
                this.selectedDay = value;
            }
            
            // 選択状態を更新
            this.updateDialSelection(dialType);
            
            // 日付表示を更新
            this.updateCurrentDateDisplay();
            
            // アイテムに滑らかにスクロール（スナップ専用）
            this.smoothScrollToItemWithSnap(dial, nearestItem, dialId);
        }
    }

    // 指定されたアイテムに滑らかにスクロール
    smoothScrollToItem(dial, item) {
        const scrollTop = item.offsetTop - (dial.offsetHeight / 2) + (item.offsetHeight / 2);
        
        dial.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
        });
    }

    // スナップ用の滑らかスクロール（リスナー競合を防ぐ）
    smoothScrollToItemWithSnap(dial, item, dialId) {
        // スクロール中フラグを管理するオブジェクトを初期化
        if (!this.isScrolling) {
            this.isScrolling = {};
        }
        
        // 既にスクロール中の場合は何もしない
        if (this.isScrolling[dialId]) {
            return;
        }
        
        // スクロール中フラグを設定
        this.isScrolling[dialId] = true;
        
        // 一時的にスクロールリスナーを無効化
        if (this.scrollListeners && this.scrollListeners[dialId]) {
            dial.removeEventListener('scroll', this.scrollListeners[dialId]);
        }
        
        const scrollTop = item.offsetTop - (dial.offsetHeight / 2) + (item.offsetHeight / 2);
        
        dial.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
        });
        
        // スクロール完了後にリスナーを再有効化
        setTimeout(() => {
            this.isScrolling[dialId] = false;
            
            // スクロールリスナーを再追加
            if (this.scrollListeners && this.scrollListeners[dialId]) {
                dial.addEventListener('scroll', this.scrollListeners[dialId]);
            }
        }, 500); // smooth scrollの完了を待つ
    }

    // 日付入力フィールドの値をダイヤル用に同期
    syncDateInputToDial(dateValue, formType) {
        if (!dateValue) return;
        
        try {
            const date = new Date(dateValue);
            
            // フォームタイプごとに同期された日付を保存
            if (!this.formDateSync) {
                this.formDateSync = {};
            }
            
            this.formDateSync[formType] = {
                year: date.getFullYear(),
                month: date.getMonth() + 1,
                day: date.getDate()
            };
            
        } catch (error) {
            console.error('日付の同期でエラーが発生しました:', error);
        }
    }

    // デバウンス関数（ユーティリティ）
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// DOMContentLoadedイベントで初期化
document.addEventListener('DOMContentLoaded', () => {
    // TodoManagerのインスタンスを作成
    const todoManager = new TodoManager();
    
    // グローバルスコープに登録（デバッグ用）
    window.todoManager = todoManager;
    
    // 開発者向けコンソールメッセージ
    console.log('旅行予約確認Todoアプリが初期化されました。');
    console.log('デバッグ用：');
    console.log('- データをエクスポート: todoManager.exportData()');
    console.log('- データをインポート: todoManager.importData(jsonString)');
});
