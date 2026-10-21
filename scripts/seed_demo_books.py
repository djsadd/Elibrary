"""Generate original demo reading materials and seed only the loopback library API.

Run with the bundled workspace Python (reportlab, Pillow and pypdf required).
Existing demo records are reused, and all temporary login sessions are revoked.
"""
from __future__ import annotations

import base64
from datetime import datetime
import json
from pathlib import Path
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local/demo-library'
BASE = 'http://127.0.0.1:8000'
_last_request = 0.0
FONT = Path('C:/Windows/Fonts/segoeui.ttf')
BOLD = Path('C:/Windows/Fonts/segoeuib.ttf')

# Every text below is an original short exercise, not a copy of a published book.
BOOKS = [
    ('programming', 'Основы программирования', 'ru', '2026', 'Программирование', '#85334e', [
        ('Алгоритм и данные', 'Алгоритм описывает последовательность действий для решения задачи. Перед началом работы определите входные данные и ожидаемый результат. Пример: чтобы вычислить среднее трёх чисел, сложите их и разделите сумму на три.'),
        ('Условия и циклы', 'Условие выбирает действие в зависимости от значения выражения. Цикл повторяет действие для нескольких элементов. Проверьте алгоритм на пустом списке, одном элементе и обычном наборе данных.'),
        ('Проверка результата', 'Разделите задачу на небольшие функции. Для каждой функции запишите несколько входных примеров и правильные ответы. Если программа даёт другой результат, найдите первый шаг, на котором появляется расхождение.'),
    ]),
    ('mathematics', 'Математика для исследований', 'ru', '2025', 'Математика', '#385477', [
        ('Вопрос и величины', 'Начните исследование с точного вопроса. Обозначьте измеряемые величины, единицы измерения и диапазон значений. До вычислений убедитесь, что сравниваемые значения выражены в одинаковых единицах.'),
        ('Таблица и график', 'Таблица помогает сохранить точные значения, а график показывает общую форму зависимости. Подпишите обе оси и укажите единицы. Не меняйте масштаб так, чтобы небольшое различие выглядело огромным.'),
        ('Оценка и проверка', 'Перед точным вычислением получите приблизительную оценку. После расчёта сравните ответ с ней. Если результат отличается в десятки раз, проверьте единицы измерения и порядок операций.'),
    ]),
    ('writing', 'Академическое письмо', 'ru', '2026', 'Исследования', '#74506c', [
        ('Главная мысль', 'Сформулируйте основной тезис одним предложением. Каждый абзац должен объяснять одну мысль и связывать её с задачей текста. Отделяйте собственный вывод от пересказа источника.'),
        ('Аргумент и пример', 'После утверждения приведите объяснение и конкретный пример. Проверьте, поддерживает ли пример именно заявленный тезис. Если между ними нет связи, уточните утверждение или подберите другой пример.'),
        ('Редактирование', 'Сначала проверьте структуру и логику, затем формулировки и оформление. Уберите повторяющиеся предложения. При работе с внешними источниками сохраняйте сведения, необходимые для точной ссылки.'),
    ]),
    ('data-kk', 'Деректерді талдау негіздері', 'kk', '2025', 'Деректерді талдау', '#39716c', [
        ('Зерттеу сұрағы', 'Алдымен қандай сұраққа жауап іздейтініңізді жазыңыз. Әр бағанның мағынасын және өлшем бірлігін белгілеңіз. Бір кестедегі күндер мен сандардың бірдей пішімде жазылғанын тексеріңіз.'),
        ('Деректерді тазалау', 'Қайталанған жолдарды және бос ұяшықтарды табыңыз. Бос мәнді нөлмен автоматты түрде алмастырмаңыз: оның себебін анықтаңыз. Өзгерістердің қысқа журналын сақтаңыз.'),
        ('Нәтижені түсіндіру', 'Графикке түсінікті атау беріңіз және осьтерді белгілеңіз. Бақылау нәтижесі мен өз жорамалыңызды бөлек жазыңыз. Қорытындының қандай деректерге сүйенетінін көрсетіңіз.'),
    ]),
    ('logic-kk', 'Логика және сыни ойлау', 'kk', '2024', 'Логика', '#a16e43', [
        ('Тұжырым және негіз', 'Тұжырым нені айтатынын, ал дәлел оның неге қабылданатынын көрсетеді. Мәтіннен негізгі тұжырымды және оны қолдайтын себептерді бөлек көшіріп жазыңыз.'),
        ('Салыстыру', 'Екі пікірді бірдей өлшемдер бойынша салыстырыңыз. Бір пікірдің артықшылығын екіншісінің басқа қасиетімен салыстыру дұрыс қорытынды бермейді. Салыстыру өлшемдерін алдын ала анықтаңыз.'),
        ('Қарсы мысал', 'Жалпы тұжырымды тексеру үшін оған сәйкес келмейтін жағдайды іздеңіз. Қарсы мысал табылса, тұжырымның қолданылу шегін нақтылаңыз. Өз пікіріңізді жаңа дерекке қарай өзгертуге дайын болыңыз.'),
    ]),
    ('data-en', 'Introduction to Data Science', 'en', '2026', 'Data Science', '#3e5e80', [
        ('Ask a focused question', 'A useful analysis starts with a question that can be answered using the available data. Define the unit of observation and explain what each column means. Keep a copy of the original dataset before cleaning it.'),
        ('Explore before modelling', 'Inspect missing values, duplicates and unusual observations. Summarise the data using simple tables and clearly labelled charts. An unexpected pattern is a reason to investigate, not an automatic reason to remove a row.'),
        ('Communicate the result', 'Describe the evidence behind your conclusion. State which records were included and which assumptions you made. A reader should be able to distinguish a direct observation from your interpretation.'),
    ]),
    ('design-en', 'Design of Digital Products', 'en', '2025', 'Дизайн', '#b06372', [
        ('Start with the task', 'Describe what a person is trying to achieve before drawing a screen. Identify the information needed to make the next decision. A clear primary action helps the person move through the task.'),
        ('Hierarchy and consistency', 'Use a small set of type sizes and spacing values. Group related controls and label them with familiar words. Colour can support meaning, but important information should not depend on colour alone.'),
        ('Test a small prototype', 'Ask someone to complete a realistic task using a simple prototype. Observe where they hesitate and record the reason. Improve the confusing step, then repeat the task to check the change.'),
    ]),
    ('research', 'Как начать исследование', 'ru', '2024', 'Исследования', '#5c7158', [
        ('От темы к вопросу', 'Общая тема задаёт направление, но не определяет конкретную задачу. Сузьте её до вопроса, на который можно ответить в доступное время. Объясните, какие наблюдения помогут получить ответ.'),
        ('План работы', 'Разбейте работу на этапы: поиск материалов, сбор информации, анализ и описание результата. Для каждого этапа укажите ожидаемый итог. Оставьте время на проверку и исправление ошибок.'),
        ('Запись решений', 'Ведите короткий рабочий журнал. Фиксируйте, какие решения вы приняли и почему. Отмечайте ограничения: они помогают читателю правильно понять полученный результат.'),
    ]),
    ('web', 'Веб-разработка: первый проект', 'ru', '2026', 'Программирование', '#56518a', [
        ('Структура страницы', 'Сначала определите смысловые части страницы: заголовок, навигацию, основное содержимое и подвал. Используйте понятные подписи ссылок. Форма должна объяснять, какие данные нужно ввести.'),
        ('Адаптивная компоновка', 'Проверьте страницу на узком и широком экране. Текст должен переноситься, а элементы управления оставаться доступными. Не задавайте фиксированную ширину всему содержимому, если она мешает небольшим экранам.'),
        ('Проверка сценария', 'Опишите короткий сценарий: открыть страницу, найти нужный раздел и отправить форму. Проверьте успешный ввод, пустые поля и ошибку ответа. Сообщение об ошибке должно подсказывать следующий шаг.'),
    ]),
    ('reading', 'Искусство внимательного чтения', 'ru', '2025', 'Литература', '#9a6149', [
        ('Перед чтением', 'Просмотрите заголовки и определите цель чтения. Запишите один вопрос, на который хотите получить ответ. Такая подготовка помогает отличать главное от второстепенных подробностей.'),
        ('Работа с заметками', 'После небольшого фрагмента кратко перескажите его своими словами. Отмечайте непонятные термины и вопросы. Не заменяйте весь процесс чтения сплошным выделением текста.'),
        ('После чтения', 'Сопоставьте основной тезис с приведёнными доводами. Запишите, что изменилось в вашем понимании темы. Вернитесь к исходному вопросу и проверьте, удалось ли на него ответить.'),
    ]),
    ('thinking-en', 'Learning How to Learn', 'en', '2024', 'Образование', '#72734a', [
        ('Set a small goal', 'Choose a goal that describes something you can demonstrate. Break a large topic into manageable parts. Before a session, decide which part you will practise and how you will check your understanding.'),
        ('Explain without looking', 'After reading a short section, close the material and explain the main idea in your own words. Compare your explanation with the source. Use the gaps you discover to plan your next practice session.'),
        ('Review and reflect', 'Return to earlier material and try a new example. Record what was easy and what still needs work. Adjust your plan using that evidence rather than the amount of time you spent staring at a page.'),
    ]),
    ('statistics', 'Статистика: первые шаги', 'ru', '2026', 'Математика', '#477e8a', [
        ('Наблюдения и выборка', 'Уточните, что считается одним наблюдением. Опишите, как получены данные и кого они представляют. Вывод о группе зависит не только от числа наблюдений, но и от способа их отбора.'),
        ('Среднее и разброс', 'Одного среднего значения недостаточно для описания набора чисел. Рассмотрите минимум, максимум и расположение остальных значений. Для данных 2, 4 и 6 среднее равно 4, но сами наблюдения различаются.'),
        ('Осторожный вывод', 'Проверьте, следует ли вывод из представленных чисел. Наблюдаемая связь сама по себе не объясняет её причину. Укажите, какой дополнительной информации не хватает для более сильного утверждения.'),
    ]),
]

LABELS = {
    'ru': {'demo': 'ДЕМОНСТРАЦИОННОЕ ИЗДАНИЕ', 'intro': 'Об этом материале', 'practice': 'Практика и заметки', 'notice': 'Оригинальный тестовый материал для проверки каталога, чтения и заметок. Это краткий демонстрационный конспект, а не полноценный учебник.', 'exercise': 'Выберите одну мысль из главы. Объясните её своими словами, придумайте собственный пример и сформулируйте вопрос для дальнейшего изучения.', 'task': 'Задание', 'contents': 'Содержание', 'check': 'Проверьте себя: что вы узнали, где можете это применить и что нужно уточнить?'},
    'kk': {'demo': 'ДЕМОНСТРАЦИЯЛЫҚ БАСЫЛЫМ', 'intro': 'Материал туралы', 'practice': 'Тәжірибе және жазбалар', 'notice': 'Каталогты, оқуды және жазбаларды тексеруге арналған түпнұсқа тест материалы. Бұл толық оқулық емес, қысқа демонстрациялық конспект.', 'exercise': 'Тараудан бір ойды таңдаңыз. Оны өз сөзіңізбен түсіндіріңіз, мысал келтіріңіз және әрі қарай зерттеуге арналған сұрақ жазыңыз.', 'task': 'Тапсырма', 'contents': 'Мазмұны', 'check': 'Өзіңізді тексеріңіз: не білдіңіз, оны қайда қолданасыз және нені нақтылау керек?'},
    'en': {'demo': 'DEMONSTRATION EDITION', 'intro': 'About this material', 'practice': 'Practice and notes', 'notice': 'Original test material for checking the catalogue, reader and notes. This is a short demonstration guide, not a complete textbook.', 'exercise': 'Choose one idea from the chapter. Explain it in your own words, create an example and write a question that you would like to explore next.', 'task': 'Exercise', 'contents': 'Contents', 'check': 'Check your understanding: what did you learn, where could you apply it and what remains unclear?'},
}


def request(path, *, token=None, body=None, raw=None, headers=None, method=None):
    global _last_request
    head = dict(headers or {})
    if token:
        head['Authorization'] = 'Bearer ' + token
    if body is not None:
        raw = json.dumps(body).encode()
        head['Content-Type'] = 'application/json'
    req = urllib.request.Request(BASE + path, data=raw, headers=head, method=method)
    for attempt in range(5):
        time.sleep(max(0.0, .27 - (time.monotonic() - _last_request)))
        _last_request = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                payload = response.read()
                return json.loads(payload) if 'application/json' in response.headers.get('Content-Type', '') and payload else payload
        except urllib.error.HTTPError as error:
            if error.code == 429 and attempt < 4:
                time.sleep(min(30, max(1, float(error.headers.get('Retry-After', '1')))))
                continue
            raise RuntimeError(f'{path}: HTTP {error.code}: {error.read().decode()[:500]}') from error


def wrap(text, font, width):
    lines, line = [], ''
    for word in text.split():
        candidate = f'{line} {word}'.strip()
        if line and font.getlength(candidate) > width:
            lines.append(line)
            line = word
        else:
            line = candidate
    return lines + ([line] if line else [])


def cover_image(index, title, subject, year, lang, accent, target):
    image = Image.new('RGB', (700, 980), '#faf4ef')
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 17, 980), fill=accent)
    draw.rectangle((17, 0, 700, 17), fill=accent)
    font = lambda size, bold=False: ImageFont.truetype(str(BOLD if bold else FONT), size)
    draw.text((60, 56), 'TAU / LIBRARY', font=font(25, True), fill=accent)
    draw.text((60, 105), 'DEMO COLLECTION', font=font(16), fill='#8b7774')
    draw.line((60, 155, 640, 155), fill=accent, width=2)
    title_font = font(62, True)
    lines = wrap(title, title_font, 565)
    if len(lines) > 5:
        title_font = font(53, True)
        lines = wrap(title, title_font, 565)
    assert len(lines) <= 5
    y = 202
    for line in lines:
        draw.text((57, y), line, font=title_font, fill=accent)
        y += 79
    draw.text((60, y + 18), subject, font=font(22), fill='#8b7774')
    draw.arc((250, 594, 790, 1134), 180, 345, fill=accent, width=4)
    draw.arc((330, 674, 710, 1054), 180, 345, fill=accent, width=2)
    draw.text((58, 682), f'{index:02d}', font=font(132), fill=accent)
    draw.line((60, 855, 640, 855), fill=accent, width=2)
    draw.text((60, 879), 'TAU Demo', font=font(20, True), fill=accent)
    draw.text((60, 918), f'{year} / {lang.upper()} / TEST EDITION', font=font(16), fill='#8b7774')
    image.save(target)


def make_pdf(index, book, cover, target):
    slug, title, lang, year, subject, accent, chapters = book
    label = LABELS[lang]
    width, height = A4
    pdf = canvas.Canvas(str(target), pagesize=A4)
    pdf.setTitle(title + ' / Demo')
    pdf.setAuthor('TAU Demo')
    colour = colors.HexColor(accent)
    body = ParagraphStyle('body', fontName='Segoe', fontSize=12, leading=21, textColor=colors.HexColor('#5c5154'))
    heading = ParagraphStyle('heading', fontName='SegoeBold', fontSize=25, leading=33, textColor=colour)
    def paragraph(text, y, style=body):
        paragraph = Paragraph(escape(text), style)
        _, size = paragraph.wrap(width - 100, height)
        assert y - size > 80, f'Content overflow: {slug}'
        paragraph.drawOn(pdf, 50, y - size)
        return y - size
    def page(number):
        pdf.setFillColor(colors.HexColor('#fffdf9'))
        pdf.rect(0, 0, width, height, fill=1, stroke=0)
        pdf.setFillColor(colour)
        pdf.setFont('SegoeBold', 10)
        pdf.drawString(50, height - 44, 'TAU / LIBRARY')
        pdf.setFont('Segoe', 9)
        pdf.drawRightString(width - 50, height - 44, label['demo'])
        pdf.setStrokeColor(colors.HexColor('#e7dcd6'))
        pdf.line(50, 48, width - 50, 48)
        pdf.setFont('Segoe', 9)
        pdf.setFillColor(colors.HexColor('#9a8585'))
        pdf.drawString(50, 30, f'DEMO / {slug.upper()}')
        pdf.drawRightString(width - 50, 30, f'{number:02d} / 06')
    pdf.drawImage(str(cover), 0, 0, width=width, height=height)
    pdf.showPage()
    page(2)
    y = paragraph(label['intro'], height - 105, heading)
    y = paragraph(label['notice'], y - 28)
    y = paragraph(label['contents'], y - 55, heading)
    for i, (name, _) in enumerate(chapters, 1):
        y = paragraph(f'{i:02d} / {name}', y - 23)
    pdf.showPage()
    for i, (name, text) in enumerate(chapters, 3):
        page(i)
        y = paragraph(name, height - 105, heading)
        y = paragraph(text, y - 30)
        y = paragraph(label['task'], y - 52, heading)
        y = paragraph(label['exercise'], y - 22)
        pdf.setStrokeColor(colors.HexColor('#e8dce0'))
        for line_y in range(290, 95, -32):
            pdf.line(50, line_y, width - 50, line_y)
        pdf.showPage()
    page(6)
    y = paragraph(label['practice'], height - 105, heading)
    paragraph(label['check'], y - 30)
    pdf.setStrokeColor(colors.HexColor('#e8dce0'))
    for line_y in range(570, 90, -32):
        pdf.line(50, line_y, width - 50, line_y)
    pdf.showPage()
    pdf.save()
    reader = PdfReader(target)
    assert len(reader.pages) == 6
    assert title.split()[0] in reader.pages[1].extract_text() or label['intro'] in reader.pages[1].extract_text()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont('Segoe', str(FONT)))
    pdfmetrics.registerFont(TTFont('SegoeBold', str(BOLD)))
    records = []
    for index, book in enumerate(BOOKS, 1):
        cover, pdf = OUT / f'{book[0]}.png', OUT / f'{book[0]}.pdf'
        cover_image(index, book[1], book[4], book[3], book[2], book[5], cover)
        make_pdf(index, book, cover, pdf)
        records.append({'slug': book[0], 'cover': str(cover), 'pdf': str(pdf)})
    # Back up the isolated local catalogue without modifying a running database file.
    backup = ROOT / '.local/backups' / ('before-demo-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '.db')
    backup.parent.mkdir(parents=True, exist_ok=True)
    database = ROOT / '.local/data/catalog.db'
    if not database.is_file():
        raise SystemExit('Start the local catalogue before seeding demo books.')
    with sqlite3.connect(database) as source, sqlite3.connect(backup) as dest:
        source.backup(dest)
    users = json.loads((ROOT / '.local/credentials.json').read_text(encoding='utf-8'))
    account = next(user for user in users if user['role'] == 'admin')
    login = request('/api/auth/login', body={'email': account['email'], 'password': account['password']})
    token = login.get('access_token') or login.get('token')
    created = reused = 0
    try:
        for index, (record, book) in enumerate(zip(records, BOOKS), 1):
            marker = f'[TAU-DEMO-{book[0]}]'
            found = request('/api/catalog/books?limit=100&q=' + urllib.parse.quote(book[1]), token=token)['items']
            existing = next((item for item in found if marker in (item.get('summary') or '')), None)
            if existing:
                record['id'] = existing['id']
                reused += 1
                continue
            uploaded = request('/api/catalog/upload/raw', token=token, raw=Path(record['pdf']).read_bytes(), headers={'Content-Type': 'application/pdf', 'x-filename': book[0] + '.pdf'})['file']
            payload = {
                'title': book[1], 'year': book[3], 'lang': book[2],
                'summary': marker + ' ' + LABELS[book[2]]['notice'],
                'pub_info': 'TAU Demo / Local test collection',
                'cover': 'data:image/png;base64,' + base64.b64encode(Path(record['cover']).read_bytes()).decode(),
                'file_id': uploaded['file_id'], 'download_url': uploaded['download_url'],
                'authors': [f'TAU Demo / {1 + (index - 1) % 4:02d}'],
                'subjects': [book[4], 'Демонстрационная коллекция'],
                'source': 'OTHER', 'formats': ['EBOOK'], 'edition': 'Demo edition',
                'page_count': 6, 'available_copies': 10, 'is_public': True,
            }
            result = request('/api/catalog/books', token=token, body=payload)
            record['id'] = result['id']
            created += 1
        playlists = request('/api/catalog/playlists', token=token)
        groups = [
            ('Технологии и данные · Демо', [0, 3, 5, 8]),
            ('Чтение и исследования · Демо', [2, 6, 7, 9]),
            ('Наука и мышление · Демо', [1, 4, 10, 11]),
        ]
        for title, indices in groups:
            if any(item['title'] == title for item in playlists):
                continue
            request('/api/catalog/playlists', token=token, body={'title': title, 'description': 'Тестовая подборка: оригинальные краткие материалы на русском, казахском и английском.', 'book_ids': [records[i]['id'] for i in indices]})
        (OUT / 'manifest.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'created': created, 'reused': reused, 'demo_books': len(records), 'collections': 3, 'pages_per_book': 6}))
    finally:
        request('/api/auth/logout', token=token, body={'token': login['refresh_token']} if login.get('refresh_token') else {})


if __name__ == '__main__':
    main()
