import { requireAdmin } from "@/services/session";
import { createStudentTemplate } from "@/lib/institution/template";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  await requireAdmin();
  const buffer = await createStudentTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="modelo-importacao-alunos-sabenca.xlsx"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
