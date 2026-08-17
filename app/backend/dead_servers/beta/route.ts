import { NextResponse } from "next/server";

const URL =
  "https://snowy-mountain-f5ee.wubbalubbadubdub19.workers.dev/?url=https://vimeos.net/embed-h26stj6gmvrt.html";

export async function GET() {
  try {
    const response = await fetch(URL, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch worker" },
        { status: response.status },
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
