export async function GET() {
  return Response.json({ status: "ok" }, { status: 503 });
}

export async function HEAD() {
  return new Response(null, { status: 503 });
}
