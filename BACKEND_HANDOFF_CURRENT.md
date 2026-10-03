# Сводка для бэкенд-разработчика — «Пойдём»

## Как подключить фронтенд

Фронтенд находится в репозитории `future-fashion-hub/Poidem`. Он умеет работать
в двух режимах: `mock` для демо и `backend` для Go API.

1. Запустите Go API на `http://localhost:8080`.
2. В корне фронтенда создайте `.env` по примеру `.env.example`:

```dotenv
VITE_API_MODE=backend
VITE_BACKEND_URL=http://localhost:8080
```

3. В `backend/.env` укажите:

```dotenv
FRONTEND_URL=http://localhost:8443
API_URL=http://localhost:8080
OAUTH_CALLBACK_URL=http://localhost:8080/api/v1/auth/google/callback
REFRESH_COOKIE_SECURE=false
REFRESH_COOKIE_SAME_SITE=lax
```

4. В корне фронтенда выполните:

```powershell
npm install
npm run dev
```

Vite проксирует `/api/*` с `http://localhost:8443` на
`http://localhost:8080`, поэтому отдельный CORS для локального запуска не
нужен.

## Что уже сделано на фронтенде

- регистрация и вход по логину/паролю в мок-режиме;
- OAuth-вход Google, Telegram и VK через существующий контракт;
- профиль пользователя: имя, фамилия, фото, город, описание, интересы, пол и
  дата рождения;
- редактирование всех перечисленных полей в личном кабинете;
- каталог событий, карта OpenStreetMap, поиск, фильтры, координаты и обложки;
- участие самостоятельно, создание компаний, открытое вступление и вступление
  по заявке;
- возрастные ограничения компании (`minAge`, `maxAge`);
- личный кабинет, «Мои события», «Мои компании», заявки и чаты компаний;
- модерация: пользователи, мероприятия, компании и жалобы;
- создание события на фронтенде планируется вести через статус `pending`, чтобы
  показать его другим пользователям только после одобрения администратором.

## Уже используемые endpoint'ы

Фронтенд рассчитан на следующие методы существующего контракта:

```text
GET    /api/v1/cities
GET    /api/v1/interests
GET    /api/v1/event-categories
GET    /api/v1/events
GET    /api/v1/events/{eventId}/companies
POST   /api/v1/events/{eventId}/solo-participation
POST   /api/v1/events/{eventId}/companies
POST   /api/v1/companies/{companyId}/join
POST   /api/v1/companies/{companyId}/applications
GET    /api/v1/companies/{companyId}/applications
POST   /api/v1/companies/{companyId}/applications/{applicationId}/approve
POST   /api/v1/companies/{companyId}/applications/{applicationId}/reject
GET    /api/v1/users/me
PATCH  /api/v1/users/me
POST   /api/v1/users/me/avatar
GET    /api/v1/users/me/events
GET    /api/v1/users/me/companies
GET    /api/v1/users/me/applications
GET    /api/v1/admin/*
```

## Что необходимо добавить или расширить в Go API

### 1. Вход и регистрация по логину/паролю

В текущем Go-проекте есть OAuth, но нет обычных учётных данных. Нужны:

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
```

Тело обоих запросов:

```json
{ "username": "danila", "password": "минимум 8 символов" }
```

Ответ регистрации — `201`, ответа входа — `200`. В обоих случаях: refresh
cookie и JSON `{ "accessToken": "...", "user": { ... } }`. Пароли хранить
только как Argon2id/bcrypt-хеши; логин должен быть уникальным.

### 2. Поля профиля

В `users` и `User` добавить:

```text
gender: "male" | "female" | "other" | null
birthDate: YYYY-MM-DD | null
```

Поддержать их в `PATCH /users/me`, `GET /auth/me`, `GET /users/me` и ответах
публичного профиля. Дата рождения нужна серверу для возрастной проверки.

### 3. Возрастные ограничения компаний

В `companies` добавить nullable-поля:

```text
min_age integer
max_age integer
```

Поддержать их в создании/редактировании/ответе компании. При `POST
/companies/{id}/join` и создании заявки сервер обязан определить возраст по
`birthDate` и вернуть `403 AGE_RESTRICTION`, если пользователь не подходит.
Если дата рождения не заполнена, доступ к возрастной компании также отклонять.

### 4. Заявки в компании

Владелец компании должен получать только заявки своей компании и иметь право
их решить. При `approve` в одной транзакции:

1. проверить, что заявка ожидает решения и есть свободное место;
2. добавить пользователя в участников;
3. изменить статус на `approved`;
4. обновить `membersCount`;
5. вернуть `409 COMPANY_FULL` при заполненной компании.

### 5. Публичный профиль кандидата

Нужен endpoint:

```http
GET /api/v1/users/{userId}
```

Он должен возвращать только безопасные данные: имя, фамилию, аватар, город,
описание, интересы, пол и возраст/дату рождения по согласованной политике.
Не отдавать логин, email, refresh-сессии и хеш пароля.

### 6. Чаты компаний

```http
GET  /api/v1/companies/{companyId}/messages?page=1&limit=100
POST /api/v1/companies/{companyId}/messages
```

Тело отправки: `{ "text": "Сообщение" }`.
Доступ только участникам и владельцу компании. Для live-обновлений можно
добавить SSE или WebSocket; первая версия работает через HTTP с повторной
загрузкой истории.

### 7. Создание и модерация мероприятий

Нужен `POST /api/v1/events` для авторизованного пользователя. Новое событие
создаётся со статусом `pending` и не попадает в публичный `GET /events` и на
карту, пока администратор не выполнит `POST /admin/events/{id}/approve`.

Минимальные данные события:

```json
{
  "title": "Название",
  "description": "Описание",
  "categoryId": 1,
  "cityId": 1,
  "startsAt": "2026-10-18T19:00:00+03:00",
  "endsAt": "2026-10-18T23:00:00+03:00",
  "locationName": "Площадка",
  "address": "Адрес",
  "location": { "latitude": 55.75, "longitude": 37.61 },
  "imageUrl": "https://..."
}
```

### 8. Наполнение данных

Внести миграцию/seed для расширенного списка интересов: книги, театр,
фотография, настольные игры, танцы, психология, волонтёрство, языки,
предпринимательство, наука, прогулки, йога и здоровье.

## Ручная проверка после интеграции

1. Зарегистрировать пользователя, заполнить профиль с датой рождения и фото.
2. Выйти и войти тем же логином/паролем.
3. Создать компанию с возрастным ограничением и проверить подходящего и
   неподходящего пользователя.
4. Проверить заявку, профиль кандидата, принятие/отклонение.
5. Создать мероприятие, убедиться, что оно не видно публично до модерации.
6. Одобрить мероприятие админом, проверить каталог и карту.
7. Проверить обновление access token через refresh-cookie после перезагрузки.
