#!/bin/bash

# Скрипт для запуска FNS тестов на продакшн сервере
# Использование: ./run-tests-production.sh [endpoint]

echo "🚀 Запуск FNS тестов на продакшн сервере"
echo "📍 Сервер: 91.236.198.205:4020"
echo "─────────────────────────────────────"

# Устанавливаем переменные окружения для продакшн сервера
export PORT=4020
export DATABASE_URL="postgresql://pharm_vision:pharm_vision_password@localhost:5432/pharm_vision_db_test?schema=public"
export ROOT_ADMIN_USERNAME=admin
export ROOT_ADMIN_PASSWORD=admin
export JWT_SECRET=gpW7DtMraBcCf4rXXyMmLZ25cMsrjv6z
export SALT=10
export YANDEX_ADDRESS="Anashkin.met@yandex.ru"
export YANDEX_PASS=knlqilweektnzxub
export FRONTEND_URL="https://pharm-vision.vercel.app/"
export FTX_API_URL="https://openapi.nalog.ru:8090"
export FTX_TOKEN="LFgDIA4yBZjW6h174iwVDcRoDHhjmpuFLtAX3kHPT9ctgggajk36aLJIzIcs2kZyKvTqLy4rSEHi7KOgY0fuNHKPbGCekDg9qjpin04K4ZyfolqtwDBZ6f6Isja3MMWe"
export PROD_SERVER_IP=91.236.198.205

# Проверяем доступность сервера
echo "🔍 Проверка доступности сервера..."
if curl -s --connect-timeout 5 http://91.236.198.205:4020/health > /dev/null 2>&1; then
    echo "✅ Сервер доступен"
else
    echo "⚠️ Сервер может быть недоступен (но тесты все равно будут запущены)"
fi

echo ""

# Запускаем тесты
if [ -z "$1" ]; then
    echo "🧪 Запуск всех FNS тестов..."
    node run-all-new-fns-tests.js
else
    echo "🎯 Запуск тестов для эндпоинта: $1"
    node run-all-new-fns-tests.js $1
fi

echo ""
echo "✅ Тестирование завершено"