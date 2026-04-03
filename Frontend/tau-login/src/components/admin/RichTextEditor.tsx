import { useEffect, useId, useRef, useState } from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  minHeightClassName?: string;
};

type UploadResponse = {
  status?: string;
  file?: {
    uploaded_to?: string;
  };
  uploaded_to?: string;
};

type ToolbarAction = {
  label: string;
  title: string;
  onClick: () => void;
};

const FONT_OPTIONS = [
  { label: "Font", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: "\"Times New Roman\", serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
  { label: "Courier", value: "\"Courier New\", monospace" },
] as const;

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const [htmlMode, setHtmlMode] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    selectionRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    const range = selectionRef.current;
    if (!selection || !range) return;
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const syncEditorValue = () => {
    onChange(editorRef.current?.innerHTML || "");
  };

  const runCommand = (command: string, commandValue?: string) => {
    focusEditor();
    restoreSelection();
    try {
      (document as any).execCommand("styleWithCSS", false, true);
    } catch {}
    (document as any).execCommand(command, false, commandValue);
    syncEditorValue();
    saveSelection();
  };

  const applyFontFamily = (fontFamily: string) => {
    if (!fontFamily) return;
    focusEditor();
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const wrapper = document.createElement("span");
    wrapper.style.fontFamily = fontFamily;
    if (range.collapsed) {
      wrapper.textContent = " ";
      range.insertNode(wrapper);
      const nextRange = document.createRange();
      nextRange.setStart(wrapper.firstChild as Text, 1);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    } else {
      const content = range.extractContents();
      wrapper.appendChild(content);
      range.insertNode(wrapper);
      selection.removeAllRanges();
      const nextRange = document.createRange();
      nextRange.selectNodeContents(wrapper);
      selection.addRange(nextRange);
    }
    syncEditorValue();
    saveSelection();
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const response = await fetch("/api/files/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!response.ok) {
      const message = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(message || "Image upload failed");
    }
    const payload = (await response.json()) as UploadResponse;
    const uploadedTo = payload.file?.uploaded_to || payload.uploaded_to;
    if (!uploadedTo) throw new Error("Image URL missing in upload response");
    return uploadedTo.startsWith("/api/files/") ? uploadedTo : `/api/files${uploadedTo}`;
  };

  const insertUploadedImage = async (file: File) => {
    setUploadingImage(true);
    setUploadError(null);
    try {
      const src = await uploadImage(file);
      runCommand("insertImage", src);
    } catch (error: any) {
      setUploadError(error?.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const insertTable = () => {
    const rowsRaw = promptValue("How many rows?", "2");
    const colsRaw = promptValue("How many columns?", "2");
    const rows = Math.max(1, Number(rowsRaw || "2"));
    const cols = Math.max(1, Number(colsRaw || "2"));
    const header = `<tr>${Array.from({ length: cols }, (_, idx) => `<th>Header ${idx + 1}</th>`).join("")}</tr>`;
    const bodyRows = Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => "<td>Text</td>").join("")}</tr>`).join("");
    runCommand("insertHTML", `<table><thead>${header}</thead><tbody>${bodyRows}</tbody></table><p></p>`);
  };

  const actions: ToolbarAction[] = [
    { label: "H2", title: "Heading 2", onClick: () => runCommand("formatBlock", "<h2>") },
    { label: "H3", title: "Heading 3", onClick: () => runCommand("formatBlock", "<h3>") },
    { label: "P", title: "Paragraph", onClick: () => runCommand("formatBlock", "<p>") },
    { label: "B", title: "Bold", onClick: () => runCommand("bold") },
    { label: "I", title: "Italic", onClick: () => runCommand("italic") },
    { label: "U", title: "Underline", onClick: () => runCommand("underline") },
    { label: "L", title: "Align left", onClick: () => runCommand("justifyLeft") },
    { label: "C", title: "Align center", onClick: () => runCommand("justifyCenter") },
    { label: "R", title: "Align right", onClick: () => runCommand("justifyRight") },
    { label: "J", title: "Justify", onClick: () => runCommand("justifyFull") },
    { label: "UL", title: "Bulleted list", onClick: () => runCommand("insertUnorderedList") },
    { label: "1.", title: "Numbered list", onClick: () => runCommand("insertOrderedList") },
    { label: "Q", title: "Quote", onClick: () => runCommand("formatBlock", "<blockquote>") },
    { label: "</>", title: "Code block", onClick: () => runCommand("formatBlock", "<pre>") },
    {
      label: "Link",
      title: "Insert link",
      onClick: () => {
        const href = promptValue("Enter link URL", "https://");
        if (!href) return;
        runCommand("createLink", href);
      },
    },
    {
      label: "Img",
      title: "Insert image by URL",
      onClick: () => {
        const src = promptValue("Enter image URL", "https://");
        if (!src) return;
        runCommand("insertImage", src);
      },
    },
    { label: "Tbl", title: "Insert table", onClick: insertTable },
    { label: "HR", title: "Horizontal rule", onClick: () => runCommand("insertHorizontalRule") },
    { label: "Undo", title: "Undo", onClick: () => runCommand("undo") },
    { label: "Redo", title: "Redo", onClick: () => runCommand("redo") },
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
            Visual mode
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
        <select
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(e) => {
            applyFontFamily(e.target.value);
            e.currentTarget.value = "";
          }}
          className="rounded-md border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          title="Font family"
        >
          {FONT_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            title={action.title}
            onMouseDown={saveSelection}
            onClick={action.onClick}
            className="rounded-md border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          onMouseDown={saveSelection}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          className="rounded-md border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploadingImage ? "Uploading..." : "Upload image"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void insertUploadedImage(file);
          }}
        />
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
        onBlur={saveSelection}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onPaste={(event) => {
          const items = Array.from(event.clipboardData?.items || []);
          const imageItem = items.find((item) => item.type.startsWith("image/"));
          if (!imageItem) return;
          const file = imageItem.getAsFile();
          if (!file) return;
          event.preventDefault();
          saveSelection();
          void insertUploadedImage(file);
        }}
        onInput={syncEditorValue}
        className={`rich-text-editor w-full rounded-2xl border bg-white p-5 outline-none ${minHeightClassName}`}
      />

      {uploadError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{uploadError}</div>}

      <div className="text-xs text-slate-500">
        Supports image upload from disk and paste from clipboard with Ctrl+V.
      </div>
    </div>
  );
}
