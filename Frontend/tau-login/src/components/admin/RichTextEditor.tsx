import { useEffect, useId, useRef, useState } from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  minHeightClassName?: string;
};

type ToolbarAction = {
  label: string;
  title: string;
  onClick: () => void;
};

function promptValue(message: string, fallback = ""): string | null {
  const value = window.prompt(message, fallback);
  if (value === null) return null;
  return value.trim();
}

export default function RichTextEditor({
  value,
  onChange,
  minHeightClassName = "min-h-[420px]",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [htmlMode, setHtmlMode] = useState(false);
  const editorId = useId();

  useEffect(() => {
    const el = editorRef.current;
    if (!el || htmlMode) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value, htmlMode]);

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const runCommand = (command: string, commandValue?: string) => {
    focusEditor();
    (document as any).execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || "");
  };

  const insertTable = () => {
    const rowsRaw = promptValue("Сколько строк?", "2");
    const colsRaw = promptValue("Сколько столбцов?", "2");
    const rows = Math.max(1, Number(rowsRaw || "2"));
    const cols = Math.max(1, Number(colsRaw || "2"));
    const header = `<tr>${Array.from({ length: cols }, (_, idx) => `<th>Заголовок ${idx + 1}</th>`).join("")}</tr>`;
    const bodyRows = Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => "<td>Текст</td>").join("")}</tr>`).join("");
    runCommand("insertHTML", `<table><thead>${header}</thead><tbody>${bodyRows}</tbody></table><p></p>`);
  };

  const actions: ToolbarAction[] = [
    { label: "H2", title: "Заголовок", onClick: () => runCommand("formatBlock", "<h2>") },
    { label: "H3", title: "Подзаголовок", onClick: () => runCommand("formatBlock", "<h3>") },
    { label: "P", title: "Абзац", onClick: () => runCommand("formatBlock", "<p>") },
    { label: "B", title: "Жирный", onClick: () => runCommand("bold") },
    { label: "I", title: "Курсив", onClick: () => runCommand("italic") },
    { label: "U", title: "Подчеркнутый", onClick: () => runCommand("underline") },
    { label: "•", title: "Маркированный список", onClick: () => runCommand("insertUnorderedList") },
    { label: "1.", title: "Нумерованный список", onClick: () => runCommand("insertOrderedList") },
    { label: "❝", title: "Цитата", onClick: () => runCommand("formatBlock", "<blockquote>") },
    { label: "</>", title: "Код", onClick: () => runCommand("formatBlock", "<pre>") },
    {
      label: "Link",
      title: "Ссылка",
      onClick: () => {
        const href = promptValue("Введите URL ссылки", "https://");
        if (!href) return;
        runCommand("createLink", href);
      },
    },
    {
      label: "Img",
      title: "Картинка",
      onClick: () => {
        const src = promptValue("Введите URL картинки", "https://");
        if (!src) return;
        runCommand("insertImage", src);
      },
    },
    { label: "Tbl", title: "Таблица", onClick: insertTable },
    { label: "HR", title: "Разделитель", onClick: () => runCommand("insertHorizontalRule") },
    { label: "↺", title: "Отменить", onClick: () => runCommand("undo") },
    { label: "↻", title: "Повторить", onClick: () => runCommand("redo") },
  ];

  if (htmlMode) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 rounded-xl border bg-slate-50 p-2">
          <button
            type="button"
            onClick={() => setHtmlMode(false)}
            className="rounded-md border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Визуальный режим
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-2xl border bg-slate-950 p-4 font-mono text-sm text-slate-100 outline-none ${minHeightClassName}`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 rounded-xl border bg-slate-50 p-2">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            title={action.title}
            onClick={action.onClick}
            className="rounded-md border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setHtmlMode(true)}
          className="ml-auto rounded-md border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          HTML
        </button>
      </div>

      <div
        id={editorId}
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML || "")}
        className={`rich-text-editor w-full rounded-2xl border bg-white p-5 outline-none ${minHeightClassName}`}
      />
    </div>
  );
}
