import {
  createSiteAppIcon,
  isSiteAppIconSize,
} from "@/lib/site-app-icon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function notFoundResponse() {
  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      size: string;
    }>;
  }
) {
  const { size: rawSize } = await context.params;
  const size = Number(rawSize);

  if (!Number.isInteger(size) || !isSiteAppIconSize(size)) {
    return notFoundResponse();
  }

  const response = await createSiteAppIcon(size);
  response.headers.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=31536000, immutable"
  );
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
}
