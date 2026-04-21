// app/api/stripe/route.js

import { NextResponse } from 'next/server';

/**
 * Stripe has been disabled for this project.
 * Keeping this route to avoid breaking frontend calls.
 */

export async function POST() {
  return NextResponse.json(
    {
      message: 'Stripe is disabled in this project. Use COD / manual payment.',
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'Stripe is disabled in this project.',
    },
    { status: 410 }
  );
}