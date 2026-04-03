import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Alignment,
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  FontBackgroundColor,
  FontColor,
  FontFamily,
  FontSize,
  Heading,
  Image,
  ImageToolbar,
  ImageUpload,
  Indent,
  Italic,
  Link,
  List,
  Paragraph,
  PasteFromOffice,
  RemoveFormat,
  SourceEditing,
  Strikethrough,
  Table,
  TableToolbar,
  Underline,
} from "ckeditor5";
import { useMemo, useState } from "react";
import "ckeditor5/ckeditor5.css";

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

function createUploadAdapter(loader: any, setUploadError: (value: string | null) => void) {
  return {
    upload: async () => {
      try {
        setUploadError(null);
        const file = await loader.file;
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
        const url = uploadedTo.startsWith("/api/files/") ? uploadedTo : `/api/files${uploadedTo}`;
        return { default: url };
      } catch (error: any) {
        const message = error?.message || "Image upload failed";
        setUploadError(message);
        throw error;
      }
    },
    abort: () => {},
  };
}

function uploadAdapterPlugin(setUploadError: (value: string | null) => void) {
  return (editor: any) => {
    editor.plugins.get("FileRepository").createUploadAdapter = (loader: any) => createUploadAdapter(loader, setUploadError);
  };
}

export default function RichTextEditor({
  value,
  onChange,
  minHeightClassName = "min-h-[420px]",
}: RichTextEditorProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);

  const config: any = useMemo(
    () => ({
      licenseKey: (import.meta.env.VITE_CKEDITOR_LICENSE_KEY as string | undefined) || "GPL",
      plugins: [
        Essentials,
        Paragraph,
        Heading,
        Bold,
        Italic,
        Underline,
        Strikethrough,
        RemoveFormat,
        FontFamily,
        FontSize,
        FontColor,
        FontBackgroundColor,
        Alignment,
        Indent,
        Link,
        List,
        BlockQuote,
        PasteFromOffice,
        Table,
        TableToolbar,
        Image,
        ImageUpload,
        ImageToolbar,
        SourceEditing,
      ],
      extraPlugins: [uploadAdapterPlugin(setUploadError)],
      toolbar: {
        shouldNotGroupWhenFull: true,
        items: [
          "undo",
          "redo",
          "|",
          "heading",
          "|",
          "fontFamily",
          "fontSize",
          "fontColor",
          "fontBackgroundColor",
          "|",
          "bold",
          "italic",
          "underline",
          "strikethrough",
          "removeFormat",
          "|",
          "alignment",
          "|",
          "bulletedList",
          "numberedList",
          "|",
          "outdent",
          "indent",
          "|",
          "link",
          "insertTable",
          "imageUpload",
          "blockQuote",
          "sourceEditing",
        ],
      },
      heading: {
        options: [
          { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
          { model: "heading1", view: "h1", title: "Heading 1", class: "ck-heading_heading1" },
          { model: "heading2", view: "h2", title: "Heading 2", class: "ck-heading_heading2" },
          { model: "heading3", view: "h3", title: "Heading 3", class: "ck-heading_heading3" },
        ],
      },
      fontFamily: {
        supportAllValues: true,
      },
      fontSize: {
        options: [10, 12, 14, "default", 18, 20, 22, 24, 28, 32, 40],
        supportAllValues: true,
      },
      image: {
        toolbar: ["imageTextAlternative"],
      },
      table: {
        contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
      },
    }),
    [],
  );

  return (
    <div className="space-y-3">
      <div className={`rich-text-editor rich-text-editor-ckeditor w-full rounded-2xl border bg-white ${minHeightClassName}`}>
        <CKEditor
          editor={ClassicEditor}
          config={config}
          data={value}
          onReady={(editor) => {
            editor.editing.view.change((writer: any) => {
              writer.setStyle("min-height", "420px", editor.editing.view.document.getRoot());
            });
          }}
          onChange={(_, editor) => {
            const data = editor.getData();
            setUploadError(null);
            onChange(data);
          }}
        />
      </div>

      {uploadError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{uploadError}</div>}

      <div className="text-xs text-slate-500">
        CKEditor 5 with Office paste, tables, fonts, colors, source editing and image upload.
      </div>
    </div>
  );
}
