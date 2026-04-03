import { Editor } from "@tinymce/tinymce-react";
import { useMemo, useState } from "react";
import "tinymce/tinymce";
import "tinymce/icons/default";
import "tinymce/models/dom";
import "tinymce/themes/silver";
import "tinymce/skins/ui/oxide/skin.css";
import "tinymce/plugins/advlist";
import "tinymce/plugins/anchor";
import "tinymce/plugins/autolink";
import "tinymce/plugins/autosave";
import "tinymce/plugins/charmap";
import "tinymce/plugins/code";
import "tinymce/plugins/codesample";
import "tinymce/plugins/directionality";
import "tinymce/plugins/fullscreen";
import "tinymce/plugins/image";
import "tinymce/plugins/insertdatetime";
import "tinymce/plugins/link";
import "tinymce/plugins/lists";
import "tinymce/plugins/media";
import "tinymce/plugins/nonbreaking";
import "tinymce/plugins/pagebreak";
import "tinymce/plugins/preview";
import "tinymce/plugins/searchreplace";
import "tinymce/plugins/table";
import "tinymce/plugins/visualblocks";
import "tinymce/plugins/visualchars";
import "tinymce/plugins/wordcount";

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

async function uploadImage(file: File): Promise<string> {
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
}

export default function RichTextEditor({
  value,
  onChange,
  minHeightClassName = "min-h-[420px]",
}: RichTextEditorProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);

  const init = useMemo(
    () => ({
      branding: false,
      promotion: false,
      menubar: "file edit view insert format tools table help",
      min_height: 420,
      height: 520,
      resize: true,
      browser_spellcheck: true,
      contextmenu: "undo redo | inserttable | cell row column deletetable | link image",
      plugins: [
        "advlist",
        "anchor",
        "autolink",
        "autosave",
        "charmap",
        "code",
        "codesample",
        "directionality",
        "fullscreen",
        "image",
        "insertdatetime",
        "link",
        "lists",
        "media",
        "nonbreaking",
        "pagebreak",
        "preview",
        "searchreplace",
        "table",
        "visualblocks",
        "visualchars",
        "wordcount",
      ],
      skin: false,
      content_css: false,
      toolbar:
        "undo redo | blocks fontfamily fontsize | bold italic underline strikethrough forecolor backcolor | " +
        "alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | " +
        "link image media table blockquote codesample | removeformat code preview fullscreen",
      block_formats: "Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; Heading 5=h5; Heading 6=h6",
      font_family_formats:
        "Arial=arial,helvetica,sans-serif;" +
        "Verdana=verdana,geneva,sans-serif;" +
        "Tahoma=tahoma,arial,helvetica,sans-serif;" +
        "Trebuchet MS=trebuchet ms,geneva,sans-serif;" +
        "Times New Roman=times new roman,times,serif;" +
        "Georgia=georgia,palatino,serif;" +
        "Courier New=courier new,courier,monospace;",
      font_size_formats: "8pt 10pt 12pt 14pt 16pt 18pt 20pt 24pt 28pt 32pt 36pt 48pt",
      toolbar_mode: "sliding" as const,
      paste_data_images: true,
      automatic_uploads: true,
      image_caption: true,
      image_title: true,
      image_advtab: true,
      convert_urls: false,
      relative_urls: false,
      remove_script_host: false,
      content_style: `
        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #0f172a;
          margin: 1rem;
        }
        img {
          max-width: 100%;
          height: auto;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        table td, table th {
          border: 1px solid #cbd5e1;
          padding: 8px;
        }
      `,
      images_upload_handler: async (blobInfo: any) => {
        try {
          setUploadError(null);
          const file = blobInfo.blob();
          return await uploadImage(file);
        } catch (error: any) {
          const message = error?.message || "Image upload failed";
          setUploadError(message);
          throw error;
        }
      },
      setup: (editor: any) => {
        editor.on("PastePostProcess", () => {
          setUploadError(null);
        });
      },
    }),
    [],
  );

  return (
    <div className="space-y-3">
      <div className={`rich-text-editor rich-text-editor-tinymce w-full rounded-2xl border bg-white ${minHeightClassName}`}>
        <Editor
          licenseKey="gpl"
          value={value}
          onEditorChange={(content) => {
            setUploadError(null);
            onChange(content);
          }}
          init={init}
        />
      </div>

      {uploadError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{uploadError}</div>}

      <div className="text-xs text-slate-500">
        TinyMCE with tables, media, colors, fonts, justify, code view, Office-friendly paste and image upload.
      </div>
    </div>
  );
}
