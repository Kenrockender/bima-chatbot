import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  const path = segments.join("/");
  const url = `${BACKEND}/api/${path}${req.nextUrl.search}`;

  // Forward only the headers the backend needs — copying everything brings
  // along hop-by-hop/platform headers that break upstream fetch on Vercel.
  const headers = new Headers();
  for (const name of ["content-type", "accept", "x-admin-password", "x-fa-id"]) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (e: any) {
    console.error("proxy fetch failed", req.method, url, e?.cause ?? e);
    return Response.json({ detail: "Backend unreachable" }, { status: 502 });
  }
  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete("content-encoding");
  respHeaders.delete("content-length");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
