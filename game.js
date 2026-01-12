// ===== ИНИЦИАЛИЗАЦИЯ TELEGRAM WEBAPP =====
let tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Получаем данные пользователя
let user = tg.initDataUnsafe?.user || {
    id: Math.floor(Math.random() * 1000000), // Для тестирования
    first_name: "Игрок"
};

// ===== КОНФИГУРАЦИЯ ИГРЫ =====
const GAME_CONFIG = {
    duration: 45, // секунд
    spawnInterval: { min: 300, max: 800 }, // мс между появлениями
    itemLifetime: { min: 2000, max: 4000 }, // время жизни предмета
    maxItemsOnScreen: 15,
    
    items: {
        good: [
            { emoji: '🍬', points: 1, probability: 0.25 },
            { emoji: '🎅', points: 1, probability: 0.25 },
            { emoji: '🍊', points: 1, probability: 0.25 },
            { emoji: '🎄', points: 1, probability: 0.25 }
        ],
        premium: [
            { emoji: '💧', points: 2, probability: 1.0 }
        ],
        bad: [
            { emoji: '🍌', points: -1, probability: 0.25 },
            { emoji: '🍩', points: -1, probability: 0.25 },
            { emoji: '🍍', points: -1, probability: 0.25 },
            { emoji: '⏰', points: -1, probability: 0.25 }
        ]
    }
};

// ===== СОСТОЯНИЕ ИГРЫ =====
let gameState = {
    score: 0,
    timeLeft: GAME_CONFIG.duration,
    isPlaying: false,
    itemsOnScreen: [],
    spawnTimer: null,
    countdownTimer: null
};

// ===== ЛОКАЛЬНОЕ ХРАНИЛИЩЕ РЕЗУЛЬТАТОВ =====
function saveScore(score) {
    const scores = getScores();
    const newScore = {
        userId: user.id,
        userName: user.first_name,
        score: score,
        date: new Date().toISOString()
    };
    
    scores.push(newScore);
    scores.sort((a, b) => b.score - a.score);
    
    // Храним только топ-100
    if (scores.length > 100) {
        scores.length = 100;
    }
    
    localStorage.setItem('game_scores', JSON.stringify(scores));
    
    // Отправляем результат в бот (если нужно)
    if (tg.initDataUnsafe?.user) {
        tg.sendData(JSON.stringify({
            action: 'save_score',
            userId: user.id,
            userName: user.first_name,
            score: score
        }));
    }
}

function getScores() {
    const stored = localStorage.getItem('game_scores');
    return stored ? JSON.parse(stored) : [];
}

// ===== НАВИГАЦИЯ МЕЖДУ ЭКРАНАМИ =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    // Вибрация при смене экрана
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// ===== ИГРОВАЯ МЕХАНИКА =====
function startGame() {
    // Сброс состояния
    gameState.score = 0;
    gameState.timeLeft = GAME_CONFIG.duration;
    gameState.isPlaying = true;
    gameState.itemsOnScreen = [];
    
    // Очистка игровой области
    const gameArea = document.getElementById('game-area');
    gameArea.innerHTML = '';
    
    // Обновление UI
    updateScore(0);
    updateTimer(GAME_CONFIG.duration);
    
    // Показ игрового экрана
    showScreen('game-screen');
    
    // Запуск таймеров
    startSpawning();
    startCountdown();
    
    // Вибрация старта
    if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function endGame() {
    gameState.isPlaying = false;
    
    // Остановка таймеров
    clearInterval(gameState.spawnTimer);
    clearInterval(gameState.countdownTimer);
    
    // Удаление всех предметов
    gameState.itemsOnScreen.forEach(item => {
        if (item.element && item.element.parentNode) {
            item.element.remove();
        }
    });
    gameState.itemsOnScreen = [];
    
    // Сохранение результата
    saveScore(gameState.score);
    
    // Показ результатов
    showResults();
    
    // Вибрация окончания
    if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('warning');
    }
}

function startSpawning() {
    const spawn = () => {
        if (!gameState.isPlaying) return;
        
        // Ограничение количества предметов
        if (gameState.itemsOnScreen.length < GAME_CONFIG.maxItemsOnScreen) {
            // Рандомное количество предметов за раз (1-3)
            const count = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < count; i++) {
                if (gameState.itemsOnScreen.length < GAME_CONFIG.maxItemsOnScreen) {
                    spawnItem();
                }
            }
        }
        
        // Следующий spawn через случайное время
        const delay = GAME_CONFIG.spawnInterval.min + 
                     Math.random() * (GAME_CONFIG.spawnInterval.max - GAME_CONFIG.spawnInterval.min);
        gameState.spawnTimer = setTimeout(spawn, delay);
    };
    
    spawn();
}

function spawnItem() {
    const item = getRandomItem();
    const gameArea = document.getElementById('game-area');
    const areaRect = gameArea.getBoundingClientRect();
    
    // Создание элемента
    const element = document.createElement('div');
    element.className = 'game-item';
    element.textContent = item.emoji;
    element.style.left = Math.random() * (areaRect.width - 120) + 'px';
    element.style.top = Math.random() * (areaRect.height - 120) + 'px';
    
    // Обработчик клика
    element.addEventListener('click', () => handleItemClick(item, element));
    
    gameArea.appendChild(element);
    
    // Добавление в массив
    const itemObj = {
        item: item,
        element: element,
        timeout: setTimeout(() => removeItem(element), 
                           GAME_CONFIG.itemLifetime.min + 
                           Math.random() * (GAME_CONFIG.itemLifetime.max - GAME_CONFIG.itemLifetime.min))
    };
    
    gameState.itemsOnScreen.push(itemObj);
}

function getRandomItem() {
    // Вероятности типов предметов
    const rand = Math.random();
    let itemType;
    
    if (rand < 0.1) {
        // 10% шанс премиум предмета
        itemType = 'premium';
    } else if (rand < 0.6) {
        // 50% шанс хорошего предмета
        itemType = 'good';
    } else {
        // 40% шанс плохого предмета
        itemType = 'bad';
    }
    
    const items = GAME_CONFIG.items[itemType];
    return items[Math.floor(Math.random() * items.length)];
}

function handleItemClick(item, element) {
    if (!gameState.isPlaying) return;
    
    // Анимация клика
    element.classList.add('clicked');
    
    // Обновление очков
    const points = item.points;
    let newScore = gameState.score + points;
    
    // Не уходим в минус
    if (newScore < 0) newScore = 0;
    
    gameState.score = newScore;
    updateScore(newScore);
    
    // Показ всплывающих очков
    showScorePopup(points, element);
    
    // Удаление предмета
    removeItem(element);
    
    // Вибрация в зависимости от очков
    if (tg.HapticFeedback) {
        if (points > 0) {
            tg.HapticFeedback.impactOccurred(points > 1 ? 'heavy' : 'medium');
        } else {
            tg.HapticFeedback.impactOccurred('light');
        }
    }
}

function removeItem(element) {
    // Удаление из DOM
    if (element && element.parentNode) {
        element.remove();
    }
    
    // Удаление из массива
    gameState.itemsOnScreen = gameState.itemsOnScreen.filter(obj => {
        if (obj.element === element) {
            clearTimeout(obj.timeout);
            return false;
        }
        return true;
    });
}

function showScorePopup(points, nearElement) {
    const popup = document.createElement('div');
    popup.className = 'score-popup ' + (points > 0 ? 'positive' : 'negative');
    popup.textContent = (points > 0 ? '+' : '') + points;
    
    const rect = nearElement.getBoundingClientRect();
    popup.style.left = rect.left + rect.width / 2 + 'px';
    popup.style.top = rect.top + 'px';
    
    document.getElementById('game-area').appendChild(popup);
    
    setTimeout(() => popup.remove(), 1000);
}

function startCountdown() {
    gameState.countdownTimer = setInterval(() => {
        gameState.timeLeft--;
        updateTimer(gameState.timeLeft);
        
        if (gameState.timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

function updateScore(score) {
    document.getElementById('score').textContent = score;
}

function updateTimer(time) {
    document.getElementById('timer').textContent = time;
}

function showResults() {
    const finalScore = gameState.score;
    document.getElementById('final-score').textContent = finalScore;
    
    // Сообщение в зависимости от результата
    let message = '';
    if (finalScore === 0) {
        message = '🤔 Попробуйте еще раз!';
    } else if (finalScore < 10) {
        message = '💪 Неплохо для начала!';
    } else if (finalScore < 20) {
        message = '👍 Хороший результат!';
    } else if (finalScore < 30) {
        message = '🔥 Отличная игра!';
    } else if (finalScore < 40) {
        message = '⭐ Невероятно!';
    } else {
        message = '🏆 Вы легенда!';
    }
    
    document.getElementById('result-message').textContent = message;
    
    showScreen('result-screen');
}

function showLeaderboard() {
    const scores = getScores();
    const leaderboardList = document.getElementById('leaderboard-list');
    
    if (scores.length === 0) {
        leaderboardList.innerHTML = '<div class="loading">Пока нет результатов</div>';
    } else {
        leaderboardList.innerHTML = '';
        
        scores.forEach((score, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            
            if (score.userId === user.id) {
                item.classList.add('current-user');
            }
            
            const rankClass = index === 0 ? 'top1' : index === 1 ? 'top2' : index === 2 ? 'top3' : '';
            
            item.innerHTML = `
                <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${score.userName}</div>
                    <div class="leaderboard-date">${new Date(score.date).toLocaleDateString('ru-RU')}</div>
                </div>
                <div class="leaderboard-score">${score.score}</div>
            `;
            
            leaderboardList.appendChild(item);
        });
    }
    
    showScreen('leaderboard-screen');
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', startGame);
document.getElementById('leaderboard-btn').addEventListener('click', showLeaderboard);
document.getElementById('show-leaderboard-btn').addEventListener('click', showLeaderboard);
document.getElementById('back-to-menu-btn').addEventListener('click', () => showScreen('menu-screen'));
document.getElementById('back-from-leaderboard-btn').addEventListener('click', () => showScreen('menu-screen'));

// ===== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ =====
document.addEventListener('DOMContentLoaded', () => {
    // Показ главного меню
    showScreen('menu-screen');
    
    // Готовность приложения
    tg.ready();
    
    console.log('🎮 Игра загружена!');
    console.log('User:', user);
});

// ===== ОБРАБОТКА ЗАКРЫТИЯ =====
window.addEventListener('beforeunload', () => {
    if (gameState.isPlaying) {
        endGame();
    }
});
