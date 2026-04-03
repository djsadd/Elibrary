import { EditorContent, useEditor } from "@tiptap/react";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";

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
  isActive?: () => boolean;
  onClick: () => void;
};

const FONT_OPTIONS = [
  { label: "Font", value: "" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times", value: "Times New Roman" },
  { label: "Verdana", value: "Verdana" },
  { label: "Tahoma", value: "Tahoma" },
  { label: "Courier", value: "Courier New" },
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const htmlRef = useRef(value);
  const [htmlMode, setHtmlMode] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      TextStyle,
      FontFamily.configure({
        types: ["textStyle"],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto", "tel"],
      }),
      Image,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      htmlRef.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: `ProseMirror outline-none ${minHeightClassName}`,
      },
      handlePaste: (_view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        const file = imageItem?.getAsFile();
        if (!file) return false;
        event.preventDefault();
        setUploadingImage(true);
        setUploadError(null);
        void uploadImage(file)
          .then((src) => {
            editor?.chain().focus().setImage({ src }).run();
          })
          .catch((error: any) => {
            setUploadError(error?.message || "Failed to upload image");
          })
          .finally(() => {
            setUploadingImage(false);
          });
        return true;
      },
      handleDrop: (_view, event) => {
        const file = Array.from(event.dataTransfer?.files || []).find((item) => item.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        setUploadingImage(true);
        setUploadError(null);
        void uploadImage(file)
          .then((src) => {
            editor?.chain().focus().setImage({ src }).run();
          })
          .catch((error: any) => {
            setUploadError(error?.message || "Failed to upload image");
          })
          .finally(() => {
            setUploadingImage(false);
          });
        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor || htmlMode) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
      htmlRef.current = value;
    }
  }, [editor, value, htmlMode]);

  const insertUploadedImage = async (file: File) => {
    setUploadingImage(true);
    setUploadError(null);
    try {
      const src = await uploadImage(file);
      editor?.chain().focus().setImage({ src }).run();
    } catch (error: any) {
      setUploadError(error?.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href || "https://";
    const href = promptValue("Enter link URL", previousUrl);
    if (href === null) return;
    if (!href) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const insertImageByUrl = () => {
    if (!editor) return;
    const src = promptValue("Enter image URL", "https://");
    if (!src) return;
    editor.chain().focus().setImage({ src }).run();
  };

  const insertTableMarkup = () => {
    if (!editor) return;
    const rowsRaw = promptValue("How many rows?", "2");
    const colsRaw = promptValue("How many columns?", "2");
    const rows = Math.max(1, Number(rowsRaw || "2"));
    const cols = Math.max(1, Number(colsRaw || "2"));
    const header = `<tr>${Array.from({ length: cols }, (_, idx) => `<th>Header ${idx + 1}</th>`).join("")}</tr>`;
    const bodyRows = Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => "<td>Text</td>").join("")}</tr>`).join("");
    editor.chain().focus().insertContent(`<table><thead>${header}</thead><tbody>${bodyRows}</tbody></table><p></p>`).run();
  };

  const applyFontFamily = (fontFamily: string) => {
    if (!editor) return;
    if (!fontFamily) {
      editor.chain().focus().unsetFontFamily().run();
      return;
    }
    editor.chain().focus().setFontFamily(fontFamily).run();
  };

  const actions: ToolbarAction[] = editor
    ? [
        { label: "H2", title: "Heading 2", isActive: () => editor.isActive("heading", { level: 2 }), onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
        { label: "H3", title: "Heading 3", isActive: () => editor.isActive("heading", { level: 3 }), onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
        { label: "P", title: "Paragraph", isActive: () => editor.isActive("paragraph"), onClick: () => editor.chain().focus().setParagraph().run() },
        { label: "B", title: "Bold", isActive: () => editor.isActive("bold"), onClick: () => editor.chain().focus().toggleBold().run() },
        { label: "I", title: "Italic", isActive: () => editor.isActive("italic"), onClick: () => editor.chain().focus().toggleItalic().run() },
        { label: "U", title: "Underline", isActive: () => editor.isActive("underline"), onClick: () => editor.chain().focus().toggleUnderline().run() },
        { label: "L", title: "Align left", isActive: () => editor.isActive({ textAlign: "left" }), onClick: () => editor.chain().focus().setTextAlign("left").run() },
        { label: "C", title: "Align center", isActive: () => editor.isActive({ textAlign: "center" }), onClick: () => editor.chain().focus().setTextAlign("center").run() },
        { label: "R", title: "Align right", isActive: () => editor.isActive({ textAlign: "right" }), onClick: () => editor.chain().focus().setTextAlign("right").run() },
        { label: "J", title: "Justify", isActive: () => editor.isActive({ textAlign: "justify" }), onClick: () => editor.chain().focus().setTextAlign("justify").run() },
        { label: "UL", title: "Bulleted list", isActive: () => editor.isActive("bulletList"), onClick: () => editor.chain().focus().toggleBulletList().run() },
        { label: "1.", title: "Numbered list", isActive: () => editor.isActive("orderedList"), onClick: () => editor.chain().focus().toggleOrderedList().run() },
        { label: "Q", title: "Quote", isActive: () => editor.isActive("blockquote"), onClick: () => editor.chain().focus().toggleBlockquote().run() },
        { label: "</>", title: "Code block", isActive: () => editor.isActive("codeBlock"), onClick: () => editor.chain().focus().toggleCodeBlock().run() },
        { label: "Link", title: "Insert link", isActive: () => editor.isActive("link"), onClick: setLink },
        { label: "Img", title: "Insert image by URL", onClick: insertImageByUrl },
        { label: "Tbl", title: "Insert table", onClick: insertTableMarkup },
        { label: "HR", title: "Horizontal rule", onClick: () => editor.chain().focus().setHorizontalRule().run() },
        { label: "Undo", title: "Undo", onClick: () => editor.chain().focus().undo().run() },
        { label: "Redo", title: "Redo", onClick: () => editor.chain().focus().redo().run() },
      ]
    : [];

  if (htmlMode) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 rounded-xl border bg-slate-50 p-2">
          <button
            type="button"
            onClick={() => {
              setHtmlMode(false);
              editor?.commands.setContent(value || "<p></p>", { emitUpdate: false });
            }}
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
            onClick={action.onClick}
            className={[
              "rounded-md border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100",
              action.isActive?.() ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800" : "",
            ].join(" ")}
          >
            {action.label}
          </button>
        ))}

        <button
          type="button"
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

      <div className="rich-text-editor w-full rounded-2xl border bg-white p-5">
        <EditorContent editor={editor} />
      </div>

      {uploadError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{uploadError}</div>}

      <div className="text-xs text-slate-500">
        Supports stable formatting, image upload, paste from clipboard and drag-and-drop image insertion.
      </div>
    </div>
  );
}
