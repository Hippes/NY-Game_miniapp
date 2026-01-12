import asyncio
import logging
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Конфигурация
BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"  # Замените на токен вашего бота
WEBAPP_URL = "https://your-game.vercel.app"  # URL вашей игры после деплоя

# Инициализация бота
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


def get_game_keyboard() -> InlineKeyboardMarkup:
    """Создает клавиатуру с кнопкой запуска игры"""
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎮 Играть в Новогодний Клик",
                    web_app=WebAppInfo(url=WEBAPP_URL)
                )
            ]
        ]
    )
    return keyboard


@dp.message(CommandStart())
async def cmd_start(message: Message):
    """Обработчик команды /start"""
    user_name = message.from_user.first_name
    
    await message.answer(
        f"🎄 Привет, {user_name}!\n\n"
        "Добро пожаловать в **Новогодний Клик** — увлекательную игру на скорость и реакцию!\n\n"
        "🎯 **Цель игры:**\n"
        "Кликай на новогодние предметы и набирай очки за 60 секунд!\n\n"
        "🍬 Новогодние предметы — **+1 очко**\n"
        "💧 Редкий предмет (вода) — **+2 очка**\n"
        "🍌 Другие предметы — **-1 очко**\n\n"
        "Нажми на кнопку ниже, чтобы начать играть! 🎮",
        reply_markup=get_game_keyboard(),
        parse_mode="Markdown"
    )


@dp.message(F.text == "🎮 Играть")
async def play_game(message: Message):
    """Обработчик текстовой команды для игры"""
    await message.answer(
        "🎄 Нажми на кнопку, чтобы запустить игру!",
        reply_markup=get_game_keyboard()
    )


@dp.message()
async def handle_webapp_data(message: Message):
    """Обработчик данных от Web App"""
    if message.web_app_data:
        import json
        data = json.loads(message.web_app_data.data)
        
        if data.get('action') == 'save_score':
            score = data.get('score', 0)
            user_name = data.get('userName', 'Игрок')
            
            await message.answer(
                f"🎉 Отличная игра, {user_name}!\n\n"
                f"Ваш результат: **{score} очков**\n\n"
                "Хотите сыграть еще раз? 🔄",
                reply_markup=get_game_keyboard(),
                parse_mode="Markdown"
            )
            
            logger.info(f"Сохранен результат: {user_name} - {score} очков")


async def main():
    """Главная функция запуска бота"""
    logger.info("🎮 Бот запускается...")
    
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    except Exception as e:
        logger.error(f"Ошибка: {e}")
    finally:
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Бот остановлен")
