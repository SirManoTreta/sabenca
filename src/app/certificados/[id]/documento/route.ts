import { NextResponse } from "next/server";
import { requireIdentity } from "@/services/session";
import { certificateFile } from "@/services/certificates";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { client, user } = await requireIdentity();
  try {
    const { id } = await params;
    const path = await certificateFile(user.id, id);
    if (!path) throw new Error("Unavailable");
    const { data, error } = await client.storage
      .from("certificates")
      .createSignedUrl(path, 60, { download: true });
    if (error || !data) throw new Error("Unavailable");
    return NextResponse.redirect(data.signedUrl, {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new NextResponse("Documento não encontrado ou sem permissão.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
