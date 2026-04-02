from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse


ALLOWED_TAGS = {
    "a",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "span",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
}

VOID_TAGS = {"br", "hr", "img"}

ALLOWED_ATTRS = {
    "a": {"href", "title", "target", "rel"},
    "img": {"src", "alt", "title"},
    "th": {"colspan", "rowspan"},
    "td": {"colspan", "rowspan"},
}

ALLOWED_SCHEMES = {"http", "https", "mailto", "tel"}


def _is_safe_url(value: str) -> bool:
    if not value:
        return False
    if value.startswith(("/", "#")):
        return True
    parsed = urlparse(value)
    if not parsed.scheme:
        return True
    return parsed.scheme.lower() in ALLOWED_SCHEMES


class SafeHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        normalized = tag.lower()
        if normalized not in ALLOWED_TAGS:
            return

        rendered_attrs: list[str] = []
        allowed_attrs = ALLOWED_ATTRS.get(normalized, set())
        for name, value in attrs:
            attr_name = (name or "").lower()
            if attr_name not in allowed_attrs or value is None:
                continue
            if attr_name in {"href", "src"} and not _is_safe_url(value):
                continue
            rendered_attrs.append(f' {attr_name}="{escape(value, quote=True)}"')

        self.parts.append(f"<{normalized}{''.join(rendered_attrs)}>")

    def handle_endtag(self, tag: str) -> None:
        normalized = tag.lower()
        if normalized not in ALLOWED_TAGS or normalized in VOID_TAGS:
            return
        self.parts.append(f"</{normalized}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_data(self, data: str) -> None:
        self.parts.append(escape(data))

    def handle_entityref(self, name: str) -> None:
        self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.parts.append(f"&#{name};")


def sanitize_html(raw_html: str | None) -> str | None:
    if not raw_html:
        return None
    parser = SafeHtmlParser()
    parser.feed(raw_html)
    parser.close()
    cleaned = "".join(parser.parts).strip()
    return cleaned or None
