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
    duration: 45, // секунд (изменено с 60 на 45)
    spawnInterval: { min: 400, max: 900 }, // мс между появлениями
    itemLifetime: { min: 3000, max: 5000 }, // время жизни предмета
    maxItemsOnScreen: 12,
    
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

// ===== КОНФИГУРАЦИЯ API =====
const API_URL = "http://31.130.131.180:8001";  // ЗАМЕНИТЕ НА IP ВАШЕГО СЕРВЕРА!

// ===== СОХРАНЕНИЕ РЕЗУЛЬТАТОВ (ГЛОБАЛЬНАЯ ТАБЛИЦА) =====
async function saveScore(score) {
    try {
        // Отправляем на сервер
        const response = await fetch(`${API_URL}/api/save_score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: user.id,
                userName: user.first_name,
                score: score
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Результат сохранен на сервере:', result);
            
            // Также сохраняем локально (для офлайн режима)
            saveScoreLocally(score);
            
            return result;
        } else {
            console.error('Ошибка сохранения на сервере');
            // Сохраняем хотя бы локально
            saveScoreLocally(score);
        }
    } catch (error) {
        console.error('Ошибка отправки на сервер:', error);
        // Сохраняем локально если сервер недоступен
        saveScoreLocally(score);
    }
}

// Локальное сохранение (резервное)
function saveScoreLocally(score) {
    const scores = getScoresLocally();
    
    const existingIndex = scores.findIndex(s => s.userId === user.id);
    
    if (existingIndex !== -1) {
        if (score > scores[existingIndex].score) {
            scores[existingIndex] = {
                userId: user.id,
                userName: user.first_name,
                score: score,
                date: new Date().toISOString()
            };
        }
    } else {
        scores.push({
            userId: user.id,
            userName: user.first_name,
            score: score,
            date: new Date().toISOString()
        });
    }
    
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem('game_scores_local', JSON.stringify(scores));
}

function getScoresLocally() {
    const stored = localStorage.getItem('game_scores_local');
    return stored ? JSON.parse(stored) : [];
}

// ===== НАВИГАЦИЯ МЕЖДУ ЭКРАНАМИ =====
function showScreen(screenId) {
    console.log('showScreen вызвана для:', screenId);
    
    // Убираем active класс и скрываем все экраны
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    
    // Показываем нужный экран
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.style.display = 'flex';
        targetScreen.classList.add('active');
        console.log('Экран показан:', screenId);
    } else {
        console.error('Экран не найден:', screenId);
    }
    
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
    
    // Запуск фоновой музыки
    playBackgroundMusic();
    
    // Запуск таймеров
    startSpawning();
    startCountdown();
    
    // Вибрация старта
    if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function endGame() {
    console.log('=== ОКОНЧАНИЕ ИГРЫ ===');
    console.log('Финальный счет:', gameState.score);
    
    gameState.isPlaying = false;
    
    // Остановка таймеров
    clearInterval(gameState.spawnTimer);
    clearInterval(gameState.countdownTimer);
    
    // Остановка фоновой музыки
    stopBackgroundMusic();
    
    // Удаление всех предметов
    gameState.itemsOnScreen.forEach(item => {
        if (item.element && item.element.parentNode) {
            item.element.remove();
        }
    });
    gameState.itemsOnScreen = [];
    
    // Сохранение результата
    saveScore(gameState.score);
    
    console.log('Показываем результаты через 300мс...');
    
    // Небольшая задержка перед показом результатов (для плавности)
    setTimeout(() => {
        console.log('Вызов showResults()');
        showResults();
    }, 300);
    
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
    element.style.left = Math.random() * (areaRect.width - 60) + 'px';
    element.style.top = Math.random() * (areaRect.height - 60) + 'px';
    
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
    
    // Воспроизведение звука
    if (points > 0) {
        playSound('click-sound');
    } else {
        playSound('wrong-sound');
    }
    
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
    console.log('=== ПОКАЗ РЕЗУЛЬТАТОВ ===');
    console.log('Финальный счет:', gameState.score);
    
    const finalScore = gameState.score;
    const finalScoreElement = document.getElementById('final-score');
    const resultMessageElement = document.getElementById('result-message');
    
    if (!finalScoreElement || !resultMessageElement) {
        console.error('Элементы результатов не найдены!');
        return;
    }
    
    finalScoreElement.textContent = finalScore;
    
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
    
    resultMessageElement.textContent = message;
    
    console.log('Сообщение:', message);
    console.log('Переключение на result-screen');
    
    // Принудительно скрываем все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    // Показываем экран результатов
    const resultScreen = document.getElementById('result-screen');
    if (resultScreen) {
        resultScreen.style.display = 'flex';
        resultScreen.classList.add('active');
        console.log('Экран результатов показан');
    } else {
        console.error('result-screen не найден!');
    }
}

async function showLeaderboard() {
    const leaderboardList = document.getElementById('leaderboard-list');
    leaderboardList.innerHTML = '<div class="loading">Загрузка...</div>';
    
    showScreen('leaderboard-screen');
    
    try {
        // Загружаем с сервера
        const response = await fetch(`${API_URL}/api/leaderboard?user_id=${user.id}`);
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки');
        }
        
        const data = await response.json();
        const scores = data.leaderboard;
        
        if (scores.length === 0) {
            leaderboardList.innerHTML = '<div class="loading">Пока нет результатов</div>';
        } else {
            leaderboardList.innerHTML = '';
            
            scores.forEach((score) => {
                const item = document.createElement('div');
                item.className = 'leaderboard-item';
                
                if (score.isCurrentUser) {
                    item.classList.add('current-user');
                }
                
                const rankClass = score.rank === 1 ? 'top1' : score.rank === 2 ? 'top2' : score.rank === 3 ? 'top3' : '';
                
                item.innerHTML = `
                    <div class="leaderboard-rank ${rankClass}">${score.rank}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${score.userName}${score.isCurrentUser ? ' (Вы)' : ''}</div>
                        <div class="leaderboard-date">${new Date(score.date).toLocaleDateString('ru-RU')}</div>
                    </div>
                    <div class="leaderboard-score">${score.score}</div>
                `;
                
                leaderboardList.appendChild(item));
            });
            
            // Если пользователь не в топ-50, показываем его место
            if (!data.userInTop && data.userRank) {
                const userInfo = document.createElement('div');
                userInfo.className = 'user-rank-info';
                userInfo.innerHTML = `
                    <p>Ваше место: <strong>${data.userRank}</strong> из ${data.totalPlayers} игроков</p>
                `;
                leaderboardList.appendChild(userInfo);
            }
        }
        
        console.log('Таблица лидеров загружена с сервера');
        
    } catch (error) {
        console.error('Ошибка загрузки таблицы лидеров:', error);
        
        // Показываем локальные результаты если сервер недоступен
        const localScores = getScoresLocally();
        
        if (localScores.length === 0) {
            leaderboardList.innerHTML = '<div class="loading">⚠️ Сервер недоступен. Локальных результатов нет.</div>';
        } else {
            leaderboardList.innerHTML = '<div class="loading">⚠️ Показаны локальные результаты</div>';
            
            setTimeout(() => {
                leaderboardList.innerHTML = '';
                
                localScores.forEach((score, index) => {
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
            }, 1000);
        }
    }
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

// ===== ЗВУКИ =====
function playSound(soundId) {
    try {
        const audio = document.getElementById(soundId);
        if (audio) {
            audio.currentTime = 0; // Сброс на начало
            audio.volume = 0.3; // Громкость 30%
            audio.play().catch(e => {
                // Автовоспроизведение может быть заблокировано браузером
                console.log('Звук заблокирован браузером (это нормально)');
            });
        }
    } catch (e) {
        console.error('Ошибка воспроизведения звука:', e);
    }
}

// ===== ФОНОВАЯ МУЗЫКА =====
function playBackgroundMusic() {
    try {
        const music = document.getElementById('background-music');
        if (music) {
            music.volume = 0.2; // Громкость 20% (тише чем звуки кликов)
            music.currentTime = 0; // Начать с начала
            music.play().catch(e => {
                console.log('Фоновая музыка заблокирована браузером');
                // Это нормально, музыка включится после первого клика
            });
        }
    } catch (e) {
        console.error('Ошибка воспроизведения музыки:', e);
    }
}

function stopBackgroundMusic() {
    try {
        const music = document.getElementById('background-music');
        if (music) {
            music.pause();
            music.currentTime = 0;
        }
    } catch (e) {
        console.error('Ошибка остановки музыки:', e);
    }
}

// ===== ОБРАБОТКА ЗАКРЫТИЯ =====
window.addEventListener('beforeunload', () => {
    if (gameState.isPlaying) {
        endGame();
    }
});

