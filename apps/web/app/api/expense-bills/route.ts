import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { resolveExpenseBillStorageDir } from "../../../lib/server/expense-bill-storage";

const uploadDir = resolveExpenseBillStorageDir();
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "IMAGE_TYPE_UNSUPPORTED" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 400 });
  }

  await mkdir(uploadDir, { recursive: true });

  const extension = path.extname(file.name).toLowerCase() || ".jpg";
  const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const target = path.join(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(target, buffer);

  return NextResponse.json({
    url: `/api/expense-bills/${filename}`,
    filename,
  });
}
