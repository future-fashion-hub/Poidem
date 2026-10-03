# Запуск backend Poydem и подключение фронтенда

Эта инструкция предназначена для локальной разработки на Windows. Backend находится в папке `backend` и запускается в Docker Compose вместе с PostgreSQL, MinIO и автоматическим применением миграций.

## 1. Что нужно установить

- Docker Desktop с включённым Docker Compose;
- Git;
- Node.js и npm — только для запуска фронтенда.

Go и PostgreSQL отдельно не требуются, если использовать Docker Compose.

## 2. Настроить backend

Откройте PowerShell в папке backend:

```powershell
cd C:\Users\Данила\Desktop\Poidem\backend
Copy-Item .env.example .env
```

Откройте `backend/.env` и задайте минимум следующие значения:

```dotenv
# PostgreSQL в Docker
POSTGRES_USER=poidem
POSTGRES_PASSWORD=change_this_local_password
POSTGRES_DB=poidem
POSTGRES_PORT=5432

# Секрет должен содержать минимум 32 символа.
JWT_SECRET=replace_with_a_long_random_secret_at_least_32_characters
JWT_ISSUER=poydem
JWT_AUDIENCE=poydem-api

# Адреса локальных приложений
FRONTEND_URL=http://localhost:8443
API_URL=http://localhost:8080
APP_PORT=8080

# Для локального HTTP-разработки
REFRESH_COOKIE_SECURE=false
REFRESH_COOKIE_SAME_SITE=lax
REFRESH_COOKIE_PATH=/api/v1/auth

# MinIO: значения подходят для локальной разработки
MINIO_ROOT_USER=poidem_minio
MINIO_ROOT_PASSWORD=change_this_minio_password
S3_PUBLIC_URL=http://localhost:9000
S3_BUCKET=poidem-media
```

`POSTGRES_HOST`, `S3_ENDPOINT` и остальные внутренние адреса для контейнерного запуска не нужно менять: Compose подставляет адреса сервисов `db` и `minio` самостоятельно.

Файл `.env` содержит секреты. Его нельзя коммитить или отправлять в GitHub.

## 3. Запустить backend

В той же папке выполните:

```powershell
docker compose up -d --build --wait
```

Compose запустит четыре сервиса:

- `db` — PostgreSQL;
- `migrate` — применит SQL-миграции;
- `minio` — хранилище аватаров и обложек;
- `app` — API на порту 8080.

Проверить состояние:

```powershell
docker compose ps
```

Посмотреть логи API при проблеме:

```powershell
docker compose logs -f app
```

Проверить, что API доступен:

```powershell
Invoke-WebRequest http://localhost:8080/health
Invoke-WebRequest http://localhost:8080/api/v1/cities
```

Остановить контейнеры, сохранив данные PostgreSQL и MinIO:

```powershell
docker compose down
```

## 4. Подключить фронтенд

В корне фронтенда создайте файл `C:\Users\Данила\Desktop\Poidem\.env`:

```dotenv
VITE_API_MODE=backend
VITE_BACKEND_URL=http://localhost:8080
```

Затем запустите фронтенд:

```powershell
cd C:\Users\Данила\Desktop\Poidem
npm install
npm run dev
```

Vite откроет сайт на `http://localhost:8443`. После изменения `.env` Vite нужно перезапустить.

## 5. Первый администратор

1. Зарегистрируйте обычного пользователя через frontend или API.
2. Узнайте его числовой ID в базе либо через административный список после временного назначения.
3. Укажите ID в `backend/.env`:

```dotenv
BOOTSTRAP_ADMIN_USER_ID=123
```

4. Перезапустите API:

```powershell
docker compose up -d --build --wait
```

После этого пользователь получит роль `admin`. Он входит через ту же форму логина, а в шапке сайта появляется кнопка «Админка».

## 6. OAuth — необязательно для первого запуска

Вход по логину и паролю не зависит от OAuth. Кнопки Google, Telegram и VK будут возвращать `OAUTH_PROVIDER_UNAVAILABLE`, пока провайдеры не настроены.

Для Google потребуются значения:

```dotenv
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OAUTH_CALLBACK_URL=http://localhost:8080/api/v1/auth/google/callback
```

В консоли Google OAuth redirect URI должен совпадать с `OAUTH_CALLBACK_URL`. Для Telegram и VK необходимы аналогичные настройки провайдеров в backend.

## 7. Что проверить после запуска

1. `GET /health` отвечает `200`.
2. `GET /api/v1/cities`, `/interests`, `/event-categories` возвращают справочники.
3. Регистрация и password-вход создают сессию; после обновления страницы frontend восстанавливает её через refresh-cookie.
4. Можно изменить профиль, загрузить и удалить аватар.
5. Созданное событие имеет статус `pending`; после одобрения администратором появляется в публичном каталоге.
6. События без `location` показываются в списке, но не получают ложную метку на карте.
7. Возрастная компания отклоняет неподходящего пользователя при вступлении, подаче и одобрении заявки.

## 8. Если frontend не видит backend

- убедитесь, что `VITE_API_MODE=backend`, а не `mock`;
- перезапустите Vite после изменения `.env`;
- проверьте `http://localhost:8080/health` в браузере;
- проверьте, что `FRONTEND_URL=http://localhost:8443` в `backend/.env`;
- в логах `app` не должно быть ошибки подключения к PostgreSQL или MinIO.
