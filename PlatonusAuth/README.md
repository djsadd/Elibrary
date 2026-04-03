# PlatonusAuth Developer Documentation

## 1. Назначение сервиса

`PlatonusAuth` это технический адаптер между нашей системой и `https://platonus.tau-edu.kz`.

Сервис не использует официальный OAuth/OpenID flow. Вместо этого он:

1. открывает страницу логина Platonus через `Playwright`;
2. логинится под пользователем;
3. забирает из браузерной сессии cookies, `sid`, `token`;
4. использует эти данные для вызова внутренних REST endpoint'ов Platonus;
5. возвращает наружу только роль пользователя и объект `info`.

Важно:

- текущий HTTP API сервиса не возвращает наружу cookies, `sid`, `token`;
- токен и cookies используются только внутри одного запроса;
- если другому разработчику нужен именно `token` или session material, код сервиса нужно расширять.

## 2. Внешний API сервиса

### 2.1 Base URL

При запуске через `docker compose`:

```text
http://localhost:8013
```

Служебные endpoint'ы:

- `GET /docs`
- `GET /openapi.json`
- `GET /metrics`

### 2.2 Endpoint авторизации

#### `POST /auth_platonus`

Авторизует пользователя в Platonus и возвращает его роль и профильные данные.

#### Request

`Content-Type: application/json`

```json
{
  "username": "user_login",
  "password": "user_password"
}
```

#### cURL

```bash
curl -X POST "http://localhost:8013/auth_platonus" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"user_login\",\"password\":\"user_password\"}"
```

#### Success response

```json
{
  "role": "студент",
  "info": {
    "...": "raw object from Platonus"
  }
}
```

### 2.3 Реальный контракт ответа

Сервис возвращает строго:

```json
{
  "role": "<role_name>",
  "info": { }
}
```

Где:

- `role` это строка, определенная по ответу `/rest/api/person/roles`;
- `info` это сырой JSON-ответ одного из endpoint'ов Platonus без нормализации.

Поддерживаемые значения `role`:

- `студент`
- `преподаватель`
- `библиотека`

Неподдерживаемые сценарии:

- `деканат` возвращает ошибку;
- любая неизвестная роль возвращает ошибку.

## 3. Что реально получает сервис после логина

После успешной авторизации в браузерной сессии код извлекает:

### 3.1 Cookies

Код вызывает:

```python
cookies = page.context.cookies("https://platonus.tau-edu.kz")
```

Далее cookies собираются в заголовок:

```http
cookie: name1=value1; name2=value2; ...
```

Это основной session context для дальнейших запросов к REST API Platonus.

### 3.2 SID

Из cookies выбирается:

```python
sid_value = cookie_map.get("plt_sid") or cookie_map.get("sid") or ""
```

Далее в запросы пробрасывается заголовок:

```http
sid: <sid_value>
```

То есть приоритет такой:

1. `plt_sid`
2. `sid`
3. пустая строка, если cookie не найдена

### 3.3 Token

Токен читается из `localStorage` браузера:

```python
localStorage.getItem('token') || localStorage.getItem('access_token') || ''
```

Далее в запросы пробрасывается:

```http
token: <token_value>
```

То есть приоритет:

1. `localStorage["token"]`
2. `localStorage["access_token"]`
3. пустая строка

### 3.4 User-Agent

Код также передает реальный browser `user-agent`:

```http
user-agent: <browser_user_agent>
```

### 3.5 Финальный набор заголовков для Platonus

Итоговый заголовочный набор формируется так:

```json
{
  "cookie": "<cookie_header>",
  "sid": "<sid_value>",
  "token": "<token_value>",
  "user-agent": "<browser_user_agent>",
  "accept": "application/json",
  "accept-language": "kz"
}
```

Это ключевая часть интеграции. Именно этими заголовками сервис авторизует последующие REST-запросы в Platonus.

## 4. Внутренний flow запроса

Ниже фактический сценарий выполнения `POST /auth_platonus`.

### Шаг 1. Открытие страницы входа

```text
GET https://platonus.tau-edu.kz/mail?type=1
```

Ожидаются DOM-элементы:

- `#login_input`
- `#pass_input`
- `#Submit1`

Если эти селекторы изменятся, логин перестанет работать.

### Шаг 2. Логин через UI

Код:

```python
page.fill("#login_input", username)
page.fill("#pass_input", password)
page.click("#Submit1")
page.wait_for_load_state("networkidle")
```

### Шаг 3. Получение session material

После логина код извлекает:

- cookies;
- `sid`;
- `token`;
- `user-agent`.

### Шаг 4. Получение `personID`

Запрос:

```http
GET https://platonus.tau-edu.kz/rest/api/person/personID
```

Ожидаемый тип ответа:

```json
{
  "personID": 12345
}
```

Особенность текущей реализации:

- если `personID` не найден, сервис делает повторный запрос еще один раз;
- если ответ не JSON, возвращается `401` с текстом `personID response is not JSON` или `personID retry response is not JSON`.

### Шаг 5. Получение ролей

Запрос:

```http
GET https://platonus.tau-edu.kz/rest/api/person/roles
```

Ожидаемый тип ответа:

```json
[
  {
    "name": "Студент"
  }
]
```

Код приводит `name` к lowercase и сравнивает с захардкоженными строками ролей.

### Шаг 6. Получение профильных данных

#### Если роль `студент`

Запрос:

```http
GET https://platonus.tau-edu.kz/rest/student/studentInfo/{person_id}/ru
```

Возвращается:

```json
{
  "role": "студент",
  "info": { "...": "studentInfo raw payload" }
}
```

#### Если роль `преподаватель` или `библиотека`

Запрос:

```http
GET https://platonus.tau-edu.kz/rest/employee/employeeInfo/{person_id}/3/ru?dn=1
```

Возвращается:

```json
{
  "role": "преподаватель",
  "info": { "...": "employeeInfo raw payload" }
}
```

или

```json
{
  "role": "библиотека",
  "info": { "...": "employeeInfo raw payload" }
}
```

#### Если роль `деканат`

Возвращается ошибка:

```json
{
  "detail": "Временно отключено для выбранной роли."
}
```

#### Если роль неизвестна

Возвращается ошибка:

```json
{
  "detail": "Роль не поддерживается для входа."
}
```

## 5. Что не отдается наружу, хотя внутри уже есть

Это критично для другого разработчика.

Внутри `register.py` после логина уже существуют:

- полный набор cookies;
- `cookie_header`;
- `sid_value`;
- `token_value`;
- `user_agent`;
- `person_id`;
- `roles_data`.

Но наружу endpoint `/auth_platonus` возвращает только:

```json
{
  "role": "...",
  "info": { }
}
```

То есть сейчас внешний клиент не может:

- переиспользовать сессию Platonus;
- забрать `token`;
- забрать `sid`;
- забрать cookies;
- самостоятельно сходить в другие endpoint'ы Platonus от имени пользователя.

Если это требуется, API нужно менять.

## 6. Как расширить сервис, если нужен token/sid/cookies

Если задача другого разработчика это не просто получить профиль, а дальше вызывать Platonus API, то минимально нужно расширить `register.py` и `app.py`.

### 6.1 Что добавить в return из `auth()`

Нужно возвращать не только:

```python
return {"role": role, "info": info}
```

а, например:

```python
return {
    "role": role,
    "info": info,
    "session": {
        "cookies": cookies,
        "cookie_header": cookie_header,
        "sid": sid_value,
        "token": token_value,
        "user_agent": user_agent,
        "person_id": person_id,
        "roles": roles_data,
    },
}
```

### 6.2 Что изменить в HTTP response

Сейчас `app.py` отдает:

```python
return {"role": response["role"], "info": response["info"]}
```

Если нужен расширенный контракт, нужно отдавать:

```python
return response
```

или отдельный DTO через `Pydantic`.

### 6.3 Рекомендуемый ответ для тех. интеграции

Если цель именно developer-facing API, лучше использовать такой контракт:

```json
{
  "role": "студент",
  "person_id": 12345,
  "roles": [
    {
      "name": "Студент"
    }
  ],
  "session": {
    "sid": "....",
    "token": "....",
    "cookie_header": "..."
  },
  "info": {
    "...": "raw payload"
  }
}
```

Важно:

- это уже чувствительные auth-данные;
- такой ответ нельзя бездумно логировать;
- такой ответ нельзя отдавать фронтенду без отдельной оценки рисков.

## 7. Ошибки и их реальное происхождение

### `400 Bad Request`

Причина:

- `username` не передан;
- `password` не передан.

Текущий текст ошибки в коде неудачный:

```json
{
  "detail": "Credentials not provided. Set PLATONUS_USERNAME and PLATONUS_PASSWORD environment variables."
}
```

Фактически env-переменные для HTTP API не нужны.

### `401 Unauthorized`

Это не только неправильный пароль. В текущем коде сюда попадает любой `RuntimeError`, в том числе:

- страница логина изменилась;
- не найден selector `#login_input`;
- `personID` не JSON;
- `roles` не JSON;
- `studentInfo` не JSON;
- `employeeInfo` не JSON;
- роль отключена;
- роль не поддерживается.

То есть `401` здесь смешивает auth-ошибки и ошибки интеграции.

### `500 Internal Server Error`

Это любая другая непойманная ошибка Python.

Текущий текст:

```json
{
  "detail": "Failed to fetch notifications: ..."
}
```

Это тоже некорректное сообщение, унаследованное из другого кода.

## 8. Ограничения текущей реализации

### 8.1 Хрупкость по DOM

Сервис зависит от селекторов:

- `#login_input`
- `#pass_input`
- `#Submit1`

Любое изменение страницы логина ломает интеграцию.

### 8.2 Хрупкость по внутреннему API Platonus

Сервис зависит от endpoint'ов:

- `/rest/api/person/personID`
- `/rest/api/person/roles`
- `/rest/student/studentInfo/{person_id}/ru`
- `/rest/employee/employeeInfo/{person_id}/3/ru?dn=1`

Если Platonus изменит:

- формат заголовков;
- обязательность `token`;
- способ сессии;
- схему JSON;

код придется обновлять.

### 8.3 Нет нормализации доменной модели

`info` это сырой payload внешней системы.

Плюсы:

- быстро;
- без потери данных.

Минусы:

- интеграция хрупкая;
- фронтенд или другой сервис зависят от структуры Platonus;
- нет стабильного внутреннего контракта.

### 8.4 Нет session persistence

Сессия существует только внутри одного запроса. После ответа браузер закрывается:

```python
browser.close()
```

То есть сервис не хранит:

- refresh token;
- access token cache;
- cookie jar;
- сессионный state между запросами.

## 9. Практический сценарий для другого разработчика

Если нужна только проверка пользователя и его профиль:

1. дергай `POST /auth_platonus`;
2. передай логин и пароль;
3. читай `role`;
4. используй `info`.

Если нужно дальше ходить в Platonus от имени пользователя:

1. текущего API недостаточно;
2. нужно расширять контракт ответа;
3. нужно возвращать `token`, `sid`, `cookie_header`, `person_id`, `roles`.

## 10. Точки входа в коде

- [app.py](/d:/Users/admin/PycharmProjects/Elib/PlatonusAuth/app.py) - HTTP API, endpoint `POST /auth_platonus`
- [register.py](/d:/Users/admin/PycharmProjects/Elib/PlatonusAuth/register.py) - логика браузерной авторизации, сбор cookies/token/sid, вызовы REST API Platonus
- [Dockerfile](/d:/Users/admin/PycharmProjects/Elib/PlatonusAuth/Dockerfile) - контейнер запуска сервиса
- [requirements.txt](/d:/Users/admin/PycharmProjects/Elib/PlatonusAuth/requirements.txt) - зависимости

## 11. Рекомендации по доработке

Если этот сервис должен использоваться как стабильная developer API-интеграция, следующая минимальная доработка обязательна:

1. исправить некорректные тексты ошибок;
2. разделить auth-ошибки и integration-ошибки по разным status code;
3. ввести нормализованную response schema;
4. отдельно решить, можно ли возвращать `token/sid/cookies` наружу;
5. убрать чувствительные данные из stdout-логов, если сервис пойдет в production.
