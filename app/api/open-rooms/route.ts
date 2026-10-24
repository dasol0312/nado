import { NextResponse } from "next/server";

// Reserved for the Claude integration owner.
export async function POST() {
  return NextResponse.json(
    {
      error: "NOT_IMPLEMENTED",
      message: "Claude integration has not been implemented yet.",
    },
    { status: 501 },
  );
}
