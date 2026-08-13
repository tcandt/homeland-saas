import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 503 });
    }

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";

    const prompt = `
Bạn là một hệ thống OCR và AI nhận diện thông tin trên thẻ Căn cước công dân (CCCD) Việt Nam.
Tôi sẽ cung cấp cho bạn một hình ảnh (có thể là ảnh chụp toàn bộ CCCD hoặc ảnh chụp riêng mã QR trên CCCD, ảnh có thể bị mờ hoặc lóa).

Nhiệm vụ của bạn:
Trích xuất các thông tin sau từ hình ảnh (ưu tiên đọc từ mã QR nếu có thể, nếu không hãy đọc trực tiếp chữ trên thẻ):
- Họ và tên (fullName)
- Số CCCD (citizenId) - 12 chữ số
- Ngày sinh (birthDate) - định dạng YYYY-MM-DD nếu có thể, hoặc giữ nguyên
- Giới tính (gender) - Nam / Nữ
- Quê quán / Nơi thường trú / Địa chỉ (address)

Hãy trả về kết quả dưới dạng JSON (chỉ trả về JSON, không thêm bất kỳ văn bản nào khác).
Nếu không thể tìm thấy hoặc ảnh quá mờ không thể đọc bất kỳ thông tin nào, hãy trả về {}

Định dạng JSON yêu cầu:
{
  "fullName": "NGUYỄN VĂN A",
  "citizenId": "012345678901",
  "birthDate": "2000-01-01",
  "gender": "Nam",
  "address": "Phường X, Quận Y, Thành phố Z"
}
`;

    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: buffer.toString("base64"),
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch (error: any) {
    console.error("Error in extract-cccd API:", error);
    return NextResponse.json(
      { error: "Failed to extract CCCD info", details: error.message },
      { status: 500 }
    );
  }
}
