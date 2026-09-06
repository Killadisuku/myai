import { createFileRoute } from "@tanstack/react-router";
import { userFromRequest } from "@/lib/chat/request-user";
import { getAttachmentImage } from "@/lib/chat/db";

export const Route = createFileRoute("/api/attachments/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await userFromRequest(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const row = await getAttachmentImage(user.id, params.id);
        if (!row?.image_data) return new Response("Not found", { status: 404 });
        const dataUrl = row.image_data;
        if (dataUrl.startsWith("data:")) {
          const comma = dataUrl.indexOf(",");
          const meta = dataUrl.slice(5, comma);
          const mime = meta.split(";")[0] || row.mime;
          const buf = Buffer.from(dataUrl.slice(comma + 1), "base64");
          return new Response(buf, {
            headers: {
              "Content-Type": mime,
              "Content-Disposition": `inline; filename="${row.filename.replace(/"/g, "")}"`,
              "Cache-Control": "private, max-age=3600",
            },
          });
        }
        const buf = Buffer.from(dataUrl, "base64");
        return new Response(buf, {
          headers: {
            "Content-Type": row.mime || "application/octet-stream",
            "Content-Disposition": `inline; filename="${row.filename.replace(/"/g, "")}"`,
            "Cache-Control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
