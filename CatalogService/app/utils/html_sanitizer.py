from html import escape
from html.parser import HTMLParser
import re
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

STYLE_ATTR_TAGS = {
    "div",
    "p",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "img",
    "pre",
    "code",
}

SAFE_FONT_FAMILIES = {
    "arial",
    "georgia",
    "times new roman",
    "verdana",
    "tahoma",
    "courier new",
    "serif",
    "sans-serif",
    "monospace",
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


def _sanitize_style(value: str) -> str | None:
    if not value:
        return None
    safe_parts: list[str] = []
    for raw_rule in value.split(";"):
        if ":" not in raw_rule:
            continue
        prop, raw_css_value = raw_rule.split(":", 1)
        name = prop.strip().lower()
        css_value = raw_css_value.strip()
        normalized = " ".join(css_value.split())
        if not normalized:
            continue
        if name == "text-align":
            allowed = {"left", "center", "right", "justify"}
            if normalized.lower() in allowed:
                safe_parts.append(f"text-align: {normalized.lower()}")
        elif name == "font-family":
            families = []
            valid = True
            for part in normalized.split(","):
                cleaned = re.sub(r"['\"]", "", part).strip().lower()
                if cleaned not in SAFE_FONT_FAMILIES:
                    valid = False
                    break
                families.append(cleaned)
            if valid and families:
                safe_parts.append(f"font-family: {', '.join(families)}")
    if not safe_parts:
        return None
    return "; ".join(safe_parts)


class SafeHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        normalized = tag.lower()
        if normalized not in ALLOWED_TAGS:
            return

        rendered_attrs: list[str] = []
        allowed_attrs = set(ALLOWED_ATTRS.get(normalized, set()))
        if normalized in STYLE_ATTR_TAGS:
            allowed_attrs.add("style")
        for name, value in attrs:
            attr_name = (name or "").lower()
            if attr_name not in allowed_attrs or value is None:
                continue
            if attr_name in {"href", "src"} and not _is_safe_url(value):
                continue
            if attr_name == "style":
                safe_style = _sanitize_style(value)
                if not safe_style:
                    continue
                value = safe_style
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
