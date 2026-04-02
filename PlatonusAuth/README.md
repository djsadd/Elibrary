# PlatonusAuth API

Сервис `PlatonusAuth` отвечает за авторизацию пользователя через Platonus и получение его профиля по роли.

## Назначение

Сервис:

- принимает логин и пароль пользователя Platonus;
- выполняет вход в `https://platonus.tau-edu.kz`;
- определяет `personID` и роли пользователя;
- возвращает роль и профильные данные из Platonus.

Текущая реализация построена на `FastAPI + Playwright`.

## Базовый URL

При запуске через `docker-compose` сервис доступен по адресу:

```text
http://localhost:8013
```

Swagger UI:

```text
http://localhost:8013/docs
```

OpenAPI schema:

```text
http://localhost:8013/openapi.json
```

Метрики Prometheus:

```text
http://localhost:8013/metrics
```

## Основной endpoint

### `POST /auth_platonus`

Авторизует пользователя в Platonus по логину и паролю.

#### Request body

```json
{
  "username": "student_login",
  "password": "student_password"
}
```

#### Пример запроса

```bash
curl -X POST "http://localhost:8013/auth_platonus" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "student_login",
    "password": "student_password"
  }'
```

#### Успешный ответ `200 OK`

```json
{
  "role": "студент",
  "info": {
    "id": 12345,
    "firstname": "Иван",
    "lastname": "Иванов"
  }
}
```

Поле `info` возвращается в том виде, в котором его отдает Platonus:

- для студентов: ответ `GET /rest/student/studentInfo/{person_id}/ru`;
- для сотрудников: ответ `GET /rest/employee/employeeInfo/{person_id}/3/ru?dn=1`.

## Поддерживаемые роли

В текущей реализации поддерживаются:

- `студент`;
- `преподаватель`;
- `библиотека`.

Особенности:

- роль `деканат` явно отключена и возвращает ошибку;
- любые неподдерживаемые роли завершаются ошибкой авторизации.

## Коды ответов

### `200 OK`

Авторизация успешна, роль и данные пользователя получены.

### `400 Bad Request`

Логин или пароль не переданы в теле запроса.

Пример:

```json
{
  "detail": "Credentials not provided. Set PLATONUS_USERNAME and PLATONUS_PASSWORD environment variables."
}
```

Примечание: текст ошибки унаследован из кода, но endpoint фактически ожидает `username` и `password` именно в JSON-запросе.

### `401 Unauthorized`

Platonus не принял учетные данные или роль пользователя недоступна для входа через этот сервис.

Примеры причин:

- неверный логин или пароль;
- роль временно отключена;
- роль не поддерживается текущей логикой сервиса.

### `500 Internal Server Error`

Ошибка на этапе взаимодействия с Platonus или при разборе ответа внешнего API.

Возможные причины:

- Platonus изменил HTML-структуру страницы входа;
- внешний API вернул не JSON;
- временно недоступен сайт `platonus.tau-edu.kz`.

## Как работает авторизация

Сервис делает следующие шаги:

1. Открывает страницу входа Platonus через headless Chromium.
2. Вводит логин и пароль в форму.
3. После входа извлекает cookies, `sid` и token из браузерного контекста.
4. Запрашивает `personID` через REST API Platonus.
5. Запрашивает список ролей пользователя.
6. В зависимости от роли получает подробную информацию о пользователе.

Используемые внешние endpoint'ы Platonus:

- `GET /rest/api/person/personID`
- `GET /rest/api/person/roles`
- `GET /rest/student/studentInfo/{person_id}/ru`
- `GET /rest/employee/employeeInfo/{person_id}/3/ru?dn=1`

Базовый домен:

```text
https://platonus.tau-edu.kz
```

## Запуск через Docker Compose

В корневом `docker-compose.yml` сервис публикуется на порт `8013`.

Команда запуска:

```bash
docker compose up --build platonusauth
```

После запуска сервис будет доступен на:

```text
http://localhost:8013
```

## Локальный запуск без Docker

Перейдите в директорию сервиса:

```bash
cd PlatonusAuth
```

Установите зависимости:

```bash
pip install -r requirements.txt
```

Запустите API:

```bash
uvicorn app:app --host 0.0.0.0 --port 8013
```

## Переменные окружения

В API endpoint `POST /auth_platonus` логин и пароль передаются в теле запроса.

Переменные окружения:

- `PLATONUS_USERNAME`
- `PLATONUS_PASSWORD`

нужны только для прямого запуска файла `register.py` как standalone-скрипта.

Пример:

```bash
python register.py
```

## Ограничения текущей реализации

- Сервис зависит от доступности и HTML-разметки страницы входа Platonus.
- Авторизация работает через браузерную автоматизацию, а не через прямой официальный OAuth/OpenID flow.
- Формат поля `info` не нормализуется внутри сервиса и зависит от ответа Platonus.
- При изменении ролей или внутренних endpoint'ов Platonus код может потребовать доработки.

## Быстрая интеграция

Минимальный сценарий для другого сервиса или фронтенда:

1. Отправить `POST /auth_platonus`.
2. Передать `username` и `password` в JSON.
3. Проверить `role` в ответе.
4. Использовать объект `info` как профиль пользователя из Platonus.

## Файлы сервиса

- `app.py` - FastAPI приложение и endpoint `/auth_platonus`;
- `register.py` - логика входа в Platonus через Playwright;
- `Dockerfile` - контейнер для запуска сервиса.
