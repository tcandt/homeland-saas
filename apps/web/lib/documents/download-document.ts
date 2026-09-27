import { getAuthorizationHeader } from "../auth/auth-header";

export class DocumentDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentDownloadError";
  }
}

function sanitizeFilename(filename: string | null | undefined, fallbackFilename: string | null | undefined): string {
  const sanitize = (value: string | null | undefined) => typeof value === "string"
    ? value
      .trim()
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/^\.+$/, "")
      .slice(0, 180)
    : "";

  return sanitize(filename) || sanitize(fallbackFilename) || "document-download";
}

export function getDownloadFilename(
  contentDisposition: string | null,
  fallbackFilename = "document-download",
): string {
  if (!contentDisposition) {
    return sanitizeFilename(fallbackFilename, "document-download");
  }

  const encodedFilename = contentDisposition.match(
    /filename\*\s*=\s*(?:UTF-8'[^']*')?([^;]+)/i,
  )?.[1];

  if (encodedFilename) {
    try {
      return sanitizeFilename(
        decodeURIComponent(encodedFilename.trim().replace(/^"|"$/g, "")),
        fallbackFilename,
      );
    } catch {
      // Use the ordinary filename parameter when a malformed RFC 5987 value is returned.
    }
  }

  const filename = contentDisposition.match(/filename\s*=\s*("(?:[^"\\]|\\.)*"|[^;]+)/i)?.[1];
  if (filename) {
    return sanitizeFilename(
      filename.trim().replace(/^"|"$/g, "").replace(/\\"/g, '"'),
      fallbackFilename,
    );
  }

  return sanitizeFilename(fallbackFilename, "document-download");
}

function downloadErrorForStatus(status: number): DocumentDownloadError {
  if (status === 401) {
    return new DocumentDownloadError("Phien dang nhap da het han. Vui long dang nhap lai de tai tai lieu.");
  }

  if (status === 403) {
    return new DocumentDownloadError("Ban khong co quyen tai tai lieu nay.");
  }

  return new DocumentDownloadError(`Khong the tai tai lieu (HTTP ${status}). Vui long thu lai.`);
}

export async function downloadDocument(
  endpoint: string,
  fallbackFilename = "document-download",
): Promise<string> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      headers: getAuthorizationHeader(),
    });
  } catch {
    throw new DocumentDownloadError("Khong the ket noi de tai tai lieu. Kiem tra ket noi va thu lai.");
  }

  if (!response.ok) {
    throw downloadErrorForStatus(response.status);
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    throw new DocumentDownloadError("Khong the doc tep tai xuong. Vui long thu lai.");
  }
  if (blob.size === 0) {
    throw new DocumentDownloadError("Tep tai xuong trong. Vui long thu lai.");
  }

  const filename = getDownloadFilename(
    response.headers.get("content-disposition"),
    fallbackFilename,
  );
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);

  return filename;
}
