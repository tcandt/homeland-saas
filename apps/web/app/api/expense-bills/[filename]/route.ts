import { readFile, unlink } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { resolveExpenseBillPath, resolveExpenseBillStorageDir } from "../../../../lib/server/expense-bill-storage";

const uploadDir = resolveExpenseBillStorageDir();
const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  let file: Buffer;
  try {
    file = await readFile(resolveExpenseBillPath(filename, uploadDir));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse(null, { status: 404 });
    }
    if (error instanceof Error && error.message === "UNSAFE_PATH") {
      return NextResponse.json({ error: "INVALID_FILENAME" }, { status: 400 });
    }
    throw error;
  }
  const contentType = contentTypes[path.extname(filename).toLowerCase()] || "application/octet-stream";

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  try {
    await unlink(resolveExpenseBillPath(filename, uploadDir));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      if (error instanceof Error && error.message === "UNSAFE_PATH") {
        return NextResponse.json({ error: "INVALID_FILENAME" }, { status: 400 });
      }
      throw error;
    }
  }
  return NextResponse.json({ ok: true });
}
