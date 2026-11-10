/**
 * "Import PDF as compendium book": pick a PDF (in the vault, or anywhere on
 * the device), a name and a folder; the book is written as one note a
 * chapter with tabs, tables and sidebars as rpg blocks, entries of a kind in
 * folders, and its pictures beside them. The work itself is in
 * lib/domains/pdf-import; this is its host inside Obsidian.
 */

import { App, Modal, Notice, Setting, TFile, loadPdfJs, normalizePath, requestUrl } from "obsidian";
import type { DecodedImage } from "lib/domains/pdf-import/extract";
import { LOOKS_SYSTEM, looksPrompt, parseLooks } from "lib/domains/pdf-import/llm";
import { ocrToRuns, type OcrResult } from "lib/domains/pdf-import/ocr";
import { importPdf, type ImportHost } from "lib/domains/pdf-import/pipeline";
import { fileName } from "lib/domains/pdf-import/structure";
import { DEFAULT_OPTIONS, type TextRun } from "lib/domains/pdf-import/types";
import { askAnthropic } from "lib/services/image-gen";
import type { ImageStudioSettings } from "settings";

/** Where tesseract.js's parts come from the first time OCR is used; they are kept in the plugin's folder after. */
const OCR_VERSION = "7.0.0";
const OCR_FILES = {
  worker: { name: "worker.min.js", url: `https://cdn.jsdelivr.net/npm/tesseract.js@${OCR_VERSION}/dist/worker.min.js` },
  core: {
    name: "tesseract-core-simd-lstm.wasm.js",
    url: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${OCR_VERSION}/tesseract-core-simd-lstm.wasm.js`,
  },
  lang: (lang: string) => ({
    name: `${lang}.traineddata.gz`,
    url: `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,
  }),
};

/** RGBA pixels from what pdf.js hands over (1-bit grey, RGB or RGBA). */
function toRgba(img: DecodedImage): Uint8ClampedArray<ArrayBuffer> {
  const { width, height } = img;
  const data = img.data as Uint8Array;
  const out = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  if (data.length === width * height * 4) out.set(data);
  else if (data.length === width * height * 3) {
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      out[j] = data[i];
      out[j + 1] = data[i + 1];
      out[j + 2] = data[i + 2];
      out[j + 3] = 255;
    }
  } else {
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const v = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
        const j = (y * width + x) * 4;
        out[j] = out[j + 1] = out[j + 2] = v;
        out[j + 3] = 255;
      }
  }
  return out;
}

/** A picture as WebP, no wider or taller than 2400 pixels. */
async function encodeWebp(img: DecodedImage): Promise<{ bytes: Uint8Array; ext: string } | null> {
  const scale = Math.min(1, 2400 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  let source: CanvasImageSource;
  if (img.bitmap) source = img.bitmap as ImageBitmap;
  else if (img.data) {
    const full = document.createElement("canvas");
    full.width = img.width;
    full.height = img.height;
    full.getContext("2d")?.putImageData(new ImageData(toRgba(img), img.width, img.height), 0, 0);
    source = full;
  } else return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: blob.type === "image/webp" ? "webp" : "png" };
}

/** Language data, unzipped, under the key tesseract.js's worker reads its cache by (idb-keyval's default store). */
async function seedOcrCache(lang: string, gz: Uint8Array): Promise<void> {
  const stream = new Blob([gz as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  const data = new Uint8Array(await new Response(stream).arrayBuffer());
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("keyval-store");
    open.onupgradeneeded = () => open.result.createObjectStore("keyval");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put(data, `./${lang}.traineddata`);
      tx.oncomplete = () => {
        open.result.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

export class PdfImportModal extends Modal {
  private pdfPath = "";
  private external: File | null = null;
  private title = "";
  private folder = "";
  private images = true;
  private ocr = true;
  private ocrLang = "eng";
  private useModel = false;
  private maxLines = DEFAULT_OPTIONS.maxLines;
  private running = false;
  private cancelled = false;
  private ocrWorker: any = null;
  private blobUrls: string[] = [];

  constructor(
    app: App,
    private readonly studio: ImageStudioSettings,
    private readonly pluginDir: string
  ) {
    super(app);
    const active = app.workspace.getActiveFile();
    if (active?.extension === "pdf") {
      this.pdfPath = active.path;
      this.title = active.basename;
    }
    this.folder = active?.parent?.path && active.parent.path !== "/" ? active.parent.path : "";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("rpg-pdf-import");
    this.setTitle("Import PDF as compendium book");
    const pdfs = this.app.vault.getFiles().filter((f) => f.extension === "pdf");

    let titleInput: HTMLInputElement | null = null;
    const setTitleFrom = (name: string) => {
      if (this.title) return;
      this.title = name.replace(/\.pdf$/i, "").replace(/[_]+/g, " ");
      if (titleInput) titleInput.value = this.title;
    };
    const pdf = new Setting(contentEl)
      .setName("PDF")
      .setDesc("A PDF in the vault, or one from anywhere on this device (it is read where it is, not copied).");
    pdf.addText((t) => {
      t.setPlaceholder("Books/Player's Guide.pdf")
        .setValue(this.pdfPath)
        .onChange((v) => {
          this.pdfPath = v.trim();
          this.external = null;
          setTitleFrom(this.pdfPath.split("/").pop() ?? "");
        });
      const list = contentEl.createEl("datalist", { attr: { id: "rpg-pdf-import-files" } });
      for (const f of pdfs) list.createEl("option", { value: f.path });
      t.inputEl.setAttribute("list", "rpg-pdf-import-files");
      pdf.addButton((b) =>
        b.setButtonText("Choose file…").onClick(() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "application/pdf,.pdf";
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            this.external = file;
            this.pdfPath = "";
            t.setValue(file.name);
            setTitleFrom(file.name);
          };
          input.click();
        })
      );
    });

    new Setting(contentEl)
      .setName("Book name")
      .setDesc("Names the book's folder, and the source its notes carry.")
      .addText((t) => {
        titleInput = t.inputEl;
        t.setValue(this.title).onChange((v) => (this.title = v.trim()));
      });

    new Setting(contentEl)
      .setName("Folder")
      .setDesc("The book's folder is made inside this one.")
      .addText((t) => {
        t.setValue(this.folder).onChange((v) => (this.folder = v.trim()));
        const list = contentEl.createEl("datalist", { attr: { id: "rpg-pdf-import-folders" } });
        for (const f of this.app.vault.getAllFolders()) list.createEl("option", { value: f.path });
        t.inputEl.setAttribute("list", "rpg-pdf-import-folders");
      });

    new Setting(contentEl)
      .setName("Pictures")
      .setDesc("Keep the book's art (as WebP in the book's _assets folder). Page backgrounds and rules are left out.")
      .addToggle((t) => t.setValue(this.images).onChange((v) => (this.images = v)));

    new Setting(contentEl)
      .setName("OCR")
      .setDesc(
        "Read pages that are only a scan. The first use downloads the reader (about 15 MB) into the plugin's folder. Language: a Tesseract code such as eng, por, spa."
      )
      .addText((t) => {
        t.setValue(this.ocrLang).onChange((v) => (this.ocrLang = v.trim() || "eng"));
        t.inputEl.style.width = "4em";
      })
      .addToggle((t) => t.setValue(this.ocr).onChange((v) => (this.ocr = v)));

    new Setting(contentEl)
      .setName("Note length")
      .setDesc("A chapter or section longer than this many lines is split into tabs, each a note in a folder.")
      .addText((t) => {
        t.setValue(String(this.maxLines)).onChange((v) => (this.maxLines = Math.max(80, Number(v) || 300)));
        t.inputEl.style.width = "4em";
      });

    if (this.studio.anthropicUrl.trim()) {
      new Setting(contentEl)
        .setName("Ask the model for tab icons")
        .setDesc(
          "One short request with the tab titles only (no book text), to the Anthropic link in the image studio's settings. Off: icons come from rules of thumb."
        )
        .addToggle((t) => t.setValue(this.useModel).onChange((v) => (this.useModel = v)));
    }

    const status = contentEl.createDiv({ cls: "rpg-pdf-import-status" });
    const bar = status.createEl("progress", { attr: { max: "1", value: "0" } });
    bar.style.width = "100%";
    bar.style.display = "none";
    const label = status.createDiv({ cls: "setting-item-description" });

    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          if (this.running) this.cancelled = true;
          else this.close();
        })
      )
      .addButton((b) =>
        b
          .setButtonText("Import")
          .setCta()
          .onClick(async () => {
            if (this.running) return;
            b.setDisabled(true);
            bar.style.display = "";
            try {
              await this.run((stage, done, total) => {
                bar.max = Math.max(1, total);
                bar.value = done;
                label.setText(total > 1 ? `${stage} — ${done} of ${total}` : stage);
              });
            } catch (e) {
              label.setText(String((e as Error).message ?? e));
              new Notice(`PDF import: ${(e as Error).message ?? e}`);
            } finally {
              b.setDisabled(false);
            }
          })
      );
  }

  onClose(): void {
    this.cancelled = true;
    void this.ocrWorker?.terminate?.();
    for (const url of this.blobUrls) URL.revokeObjectURL(url);
    this.contentEl.empty();
  }

  /** A part of the OCR reader as a blob URL: from the plugin's folder, or downloaded into it once. */
  private async ocrFile(
    part: { name: string; url: string },
    type: string
  ): Promise<{ url: string; bytes: Uint8Array }> {
    const adapter = this.app.vault.adapter;
    const dir = normalizePath(`${this.pluginDir}/ocr`);
    const path = `${dir}/${part.name}`;
    let bytes: ArrayBuffer;
    if (await adapter.exists(path)) bytes = await adapter.readBinary(path);
    else {
      const res = await requestUrl({ url: part.url, throw: false });
      if (res.status >= 400) throw new Error(`Could not download the OCR reader (${part.name}): ${res.status}`);
      bytes = res.arrayBuffer;
      if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
      await adapter.writeBinary(path, bytes);
    }
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    this.blobUrls.push(url);
    return { url, bytes: new Uint8Array(bytes) };
  }

  private async ocrPage(page: any): Promise<TextRun[]> {
    if (!this.ocrWorker) {
      const { createWorker } = await import("tesseract.js");
      const worker = await this.ocrFile(OCR_FILES.worker, "text/javascript");
      const core = await this.ocrFile(OCR_FILES.core, "text/javascript");
      const lang = await this.ocrFile(OCR_FILES.lang(this.ocrLang), "application/gzip");
      // The reader looks for its language data in its own cache before the network: put it there.
      await seedOcrCache(this.ocrLang, lang.bytes);
      this.ocrWorker = await createWorker(this.ocrLang, 1, {
        workerPath: worker.url,
        // tesseract.js takes a path ending in `js` as the file itself, not a folder to pick one from.
        corePath: `${core.url}#core.js`,
        workerBlobURL: false,
      } as any);
    }
    const scale = 2.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const { data } = await this.ocrWorker.recognize(canvas, {}, { blocks: true });
    return ocrToRuns(data as OcrResult, scale);
  }

  private async run(progress: (stage: string, done: number, total: number) => void): Promise<void> {
    const title = this.title || "Imported Book";
    let url: string;
    if (this.external) {
      url = URL.createObjectURL(this.external);
      this.blobUrls.push(url);
    } else {
      const file = this.app.vault.getAbstractFileByPath(normalizePath(this.pdfPath));
      if (!(file instanceof TFile) || file.extension !== "pdf") throw new Error("Pick a PDF first.");
      url = this.app.vault.getResourcePath(file);
    }
    this.running = true;
    this.cancelled = false;
    const adapter = this.app.vault.adapter;
    const made = new Set<string>();
    const ensureDir = async (path: string) => {
      const dir = path.split("/").slice(0, -1).join("/");
      if (!dir || made.has(dir)) return;
      const parts = dir.split("/");
      for (let i = 1; i <= parts.length; i++) {
        const sub = parts.slice(0, i).join("/");
        if (made.has(sub)) continue;
        if (!(await adapter.exists(sub))) await adapter.mkdir(sub);
        made.add(sub);
      }
    };
    const host: ImportHost = {
      writeText: async (path, text) => {
        await ensureDir(path);
        await adapter.write(path, text);
      },
      writeBinary: async (path, bytes) => {
        await ensureDir(path);
        await adapter.writeBinary(
          path,
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
        );
      },
      remove: async (path) => {
        if (await adapter.exists(path)) await adapter.remove(path);
      },
      rename: async (from, to) => {
        if (await adapter.exists(to)) await adapter.remove(to);
        await adapter.rename(from, to);
      },
      encodeImage: encodeWebp,
      ocrPage: this.ocr ? (page) => this.ocrPage(page) : undefined,
      refineLooks: this.useModel
        ? async (titles) => parseLooks(await askAnthropic(this.studio, LOOKS_SYSTEM, looksPrompt(titles), 6000), titles)
        : undefined,
      progress,
      cancelled: () => this.cancelled,
    };
    try {
      const pdfjs = await loadPdfJs();
      // The file is read in pieces as pages are asked for, so a book of hundreds of megabytes
      // never sits in memory whole.
      const doc = await pdfjs.getDocument({ url, disableAutoFetch: true, rangeChunkSize: 1 << 20 }).promise;
      const parent = normalizePath(this.folder || "/").replace(/^\/$/, "");
      const result = await importPdf(
        pdfjs,
        doc,
        { ...DEFAULT_OPTIONS, title, images: this.images, ocr: this.ocr, maxLines: this.maxLines },
        host,
        parent
      );
      await doc.destroy();
      new Notice(
        `Imported "${title}": ${result.notes} notes, ${result.tables} tables, ${result.images} pictures` +
          (result.ocrPages ? `, ${result.ocrPages} pages by OCR` : "") +
          "."
      );
      const index = this.app.vault.getAbstractFileByPath(`${result.folder}/${fileName(title)}.md`);
      this.close();
      if (index instanceof TFile) await this.app.workspace.getLeaf(false).openFile(index);
    } finally {
      this.running = false;
    }
  }
}
