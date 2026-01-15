# Документация проекта Elib

Документ составлен по текущему содержимому репозитория `Elib` и `docker-compose.yml`.

## Обзор
Elib — монорепозиторий с микросервисной архитектурой, веб‑клиентом и мобильным приложением.
Запуск в локальном окружении организован через `docker-compose.yml`.

## Структура репозитория
- `API-Gateaway` — API Gateway (проксирование запросов, базовые проверки авторизации).
- `AuthService` — регистрация/логин, JWT, роли пользователей.
- `CatalogService` — каталог книг, авторы, темы, плейлисты, статистика.
- `FileStorageService` — хранение файлов книг (PDF/иное), доступ к файлам.
- `NotificationService` — уведомления (email/мессенджеры), Celery задачи.
- `AnalyticsService` — аналитика, ClickHouse/БД.
- `ReportingService` — отчеты (в репозитории есть директория, зависимости пустые).
- `SearchService` — сервис поиска (в репозитории есть директория, зависимости пустые).
- `OtherLibraryIntegrations` — интеграции с внешними библиотеками, фоновые задачи.
- `AI` — AI/LLM сервис.
- `PlatonusAuth` — интеграция/авторизация через Platonus.
- `favourites` — избранное.
- `reviews` — отзывы.
- `UserProfileService` — профиль пользователя (в репозитории, не подключен в compose).
- `ServiceRegistry`, `Logging`, `Monitoring`, `MessageBroker` — инфраструктурные модули (в репозитории, не подключены в compose).
- `Frontend/tau-login` — веб‑клиент (React + Vite).
- `Frontend/mobile` — мобильное приложение (Expo/React Native).
- `postgres-init` — SQL для инициализации БД.

## Архитектура и сервисы (по docker-compose.yml)

### Инфраструктура
- `postgres` — PostgreSQL 16, база `elib_default`, volume `pgdata`.
- `redis` — Redis 7.
- `clickhouse` — ClickHouse 24.3, volume `clickhouse_data`.

### Микросервисы
| Сервис | Назначение | Технологии (по requirements) | Порт | Env |
| --- | --- | --- | --- | --- |
| `gateway` | API Gateway, прокси на сервисы | FastAPI, httpx, JWT | `8000` | `API-Gateaway/.env.prod` |
| `auth` | Аутентификация, роли, JWT | FastAPI, SQLAlchemy, Redis, JWT | `8001` | `AuthService/.env.prod` |
| `catalog` | Каталог книг, метаданные | FastAPI, SQLAlchemy | `8002` | `CatalogService/.env.prod` |
| `filestorage` | Файлы книг, storage | FastAPI, MinIO SDK | `8003` | `FileStorageService/.env.prod` |
| `notifications` | Уведомления | FastAPI, Celery | `8006` | `NotificationService/.env.prod` |
| `reviews` | Отзывы | FastAPI, SQLAlchemy | `8007` | `reviews/.env.prod` |
| `favourites` | Избранное | FastAPI, SQLAlchemy | `8008` | `favourites/.env.prod` |
| `otherlibraryintegrations` | Интеграции | FastAPI, Celery, Redis, OpenAI | `8009` | `OtherLibraryIntegrations/.env.prod` |
| `analytics` | Аналитика | FastAPI, ClickHouse, SQLAlchemy | `8011` | `AnalyticsService/.env.prod` |
| `ai` | AI/LLM сервис | FastAPI | `8010` | `AI/.env` |
| `platonusauth` | Авторизация Platonus | FastAPI (по зависимостям) | `8013` | env vars |

### Веб‑клиент
| Компонент | Назначение | Стек | Порт |
| --- | --- | --- | --- |
| `frontend` | Веб‑приложение | React 19, Vite, React Router | `80` |

## Порты и маршрутизация
- Входная точка API: `gateway` на `http://localhost:8000`.
- `API-Gateaway` проксирует запросы на внутренние сервисы (например, `/auth/*`, `/catalog/*`).
- Веб‑клиент доступен на `http://localhost/` (порт 80).

## Конфигурация
Основные конфиги находятся в `.env.prod` внутри сервисов. Примеры:
- `AuthService/.env.prod`
- `CatalogService/.env.prod`
- `NotificationService/.env.prod`
- `API-Gateaway/.env.prod`
- `AnalyticsService/.env.prod`
- `OtherLibraryIntegrations/.env.prod`
- `reviews/.env.prod`
- `favourites/.env.prod`
- `FileStorageService/.env.prod`
- `AI/.env`

Для `PlatonusAuth` параметры пробрасываются через переменные окружения:
`PLATONUS_USERNAME`, `PLATONUS_PASSWORD`.

## Хранилище и файлы
- Postgres и ClickHouse используют отдельные docker‑volumes.
- Каталог хранит файлы в volume `filestorage_data`, подключенном к `CatalogService` и `FileStorageService`.

## Веб‑клиент (Frontend/tau-login)
Основные команды:
```bash
npm install
npm run dev
npm run build
npm run preview
```
Стек: React 19, Vite, React Router, pdfjs-dist, Tailwind CSS.

## Мобильное приложение (Frontend/mobile)
Expo‑приложение:
```bash
npm install
npm run start
npm run android
npm run ios
npm run web
```
Пакеты: Expo 54, React Native 0.81, `react-native-webview`, `expo-file-system`.
Идентификатор: `com.elib.mobile` (Android/iOS).

## Локальный запуск (docker-compose)
```bash
docker compose up --build
```

## Что может потребовать доработки
- В `SearchService` и `ReportingService` сейчас пустые `requirements.txt`.
- `UserProfileService`, `ServiceRegistry`, `Logging`, `Monitoring`, `MessageBroker` присутствуют в репозитории, но не включены в `docker-compose.yml`.

