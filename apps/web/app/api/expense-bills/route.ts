import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { resolveExpenseBillStorageDir } from "../../../lib/server/expense-bill-storage";
import { requireRoutePermission } from "../../../lib/server/route-auth";

const uploadDir = resolveExpenseBillStorageDir();
const allowedTypes: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function matchesImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (mimeType === "image/gif") return buffer.subarray(0, 3).toString("ascii") === "GIF";
  return false;
}

export async function POST(request: NextRequest) {
  const auth = await requireRoutePermission(request, "finance.update");
  if ("response" in auth) return auth.response;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
  }

  if (!allowedTypes[file.type]) {
    return NextResponse.json({ error: "IMAGE_TYPE_UNSUPPORTED" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 400 });
  }

  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesImageSignature(buffer, file.type)) {
    return NextResponse.json({ error: "IMAGE_SIGNATURE_INVALID" }, { status: 400 });
  }

  const extension = allowedTypes[file.type] || path.extname(file.name).toLowerCase() || ".jpg";
  const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const target = path.join(uploadDir, filename);
  await writeFile(target, buffer);

  return NextResponse.json(
    {
      url: `/api/expense-bills/${filename}`,
      filename,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
