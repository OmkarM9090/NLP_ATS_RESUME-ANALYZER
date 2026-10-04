/* ------------------------------------------------------------------
 * PDF extraction with validation.
 * Primary: text-layer extraction via pdf-parse (pdf.js engine).
 * Scanned/image PDFs (OCR fallback) are detected and reported with a
 * clear remediation message.
 * ------------------------------------------------------------------ */

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export class AnalysisError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

export class FileValidationError extends AnalysisError {
  constructor(message: string) {
    super(422, message);
  }
}

export class PDFExtractionError extends AnalysisError {
  constructor(message: string) {
    super(422, message);
  }
}

export class NLPProcessingError extends AnalysisError {
  constructor(message: string) {
    super(500, message);
  }
}

export interface ExtractedPDF {
  text: string;
  pages: number;
  method: "pdf-text-layer" | "sample-text";
  isScanned: boolean;
}

export function validatePdfBytes(bytes: Buffer, filename: string): void {
  if (!filename.toLowerCase().endsWith(".pdf")) {
    throw new FileValidationError(
      `“${filename}” is not a PDF. Please upload a .pdf file.`,
    );
  }
  if (bytes.byteLength === 0) {
    throw new FileValidationError(`“${filename}” is empty (0 bytes).`);
  }
  if (bytes.byteLength > MAX_FILE_SIZE) {
    throw new FileValidationError(
      `“${filename}” exceeds the 10MB limit (${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB).`,
    );
  }
  const header = bytes.subarray(0, 5).toString("latin1");
  if (header !== "%PDF-") {
    throw new FileValidationError(
      `“${filename}” is corrupted or not a real PDF (missing %PDF- header).`,
    );
  }
}

export async function extractPdf(bytes: Buffer): Promise<ExtractedPDF> {
  const head = bytes.subarray(0, 4096).toString("latin1");
  const tail = bytes.subarray(Math.max(0, bytes.length - 8192)).toString("latin1");
  if (head.includes("/Encrypt") || tail.includes("/Encrypt")) {
    throw new PDFExtractionError(
      "This PDF is password-protected or encrypted. Remove the password and try again.",
    );
  }

  let text = "";
  let pages = 0;
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    try {
      const result = await parser.getText();
      text = (result.text ?? "").replace(/\r/g, "");
      pages = result.total ?? 0;
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/encrypt|password/i.test(msg)) {
      throw new PDFExtractionError(
        "This PDF is password-protected or encrypted. Remove the password and try again.",
      );
    }
    throw new PDFExtractionError(
      "Could not read this PDF — it may be corrupted. Try re-exporting it.",
    );
  }

  if (text.trim().length < 50) {
    throw new PDFExtractionError(
      "This PDF appears to be image-based or scanned (no text layer). Please export a text-based PDF (e.g. “Save as PDF” / “Print to PDF”) and try again.",
    );
  }

  return { text, pages, method: "pdf-text-layer", isScanned: false };
}
