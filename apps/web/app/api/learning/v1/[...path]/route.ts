import { NextResponse } from "next/server";
import { getLearningStore } from "@/lib/utils/learning-store";

export async function GET(
  request: Request,
  props: { params: Promise<{ path: string[] }> }
) {
  const params = await props.params;
  const subpath = params.path?.[0];

  try {
    const store = await getLearningStore();
    const snapshot = store.snapshot();

    if (subpath === "snapshot") {
      return NextResponse.json(snapshot, {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (subpath === "stats") {
      const stats = { ...snapshot, corner: undefined, qr: undefined };
      return NextResponse.json(stats, {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error: any) {
    console.error("Learning API error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ path: string[] }> }
) {
  const params = await props.params;
  const subpath = params.path?.[0];

  if (subpath !== "samples") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const samples = Array.isArray(body.samples)
      ? body.samples
      : body.kind
        ? [{ kind: body.kind, payload: body.payload }]
        : [];

    if (!samples.length || samples.length > 32) {
      return NextResponse.json({ error: "Expected 1-32 learning samples" }, { status: 400 });
    }

    const store = await getLearningStore();
    const result = await store.addMany(samples);
    const snapshot = store.snapshot();

    return NextResponse.json(
      { ...result, ...snapshot },
      {
        status: 202,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (error: any) {
    console.error("Learning API error:", error);
    const status = Number(error?.statusCode) || 400;
    return NextResponse.json({ error: error?.message || "Invalid learning sample" }, { status });
  }
}
