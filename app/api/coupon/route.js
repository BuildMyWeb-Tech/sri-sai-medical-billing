import prisma from "@/lib/prisma";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Verify coupon
export async function POST(request) {
    try {
        const { userId, has } = getAuth(request);

        if (!userId) {
            return NextResponse.json({ error: "Please login to apply coupon" }, { status: 401 });
        }

        const { code } = await request.json();

        if (!code || !code.trim()) {
            return NextResponse.json({ error: "Please enter a coupon code" }, { status: 400 });
        }

        // Find coupon
        const coupon = await prisma.coupon.findUnique({
            where: {
                code: code.toUpperCase().trim(),
                expiresAt: { gt: new Date() }
            }
        });

        if (!coupon) {
            return NextResponse.json({ error: "Invalid or expired coupon code" }, { status: 404 });
        }

        // Check if coupon is for new users only
        if (coupon.forNewUser) {
            const userOrders = await prisma.order.findMany({
                where: { userId }
            });

            if (userOrders.length > 0) {
                return NextResponse.json({
                    error: "This coupon is only valid for new users"
                }, { status: 400 });
            }
        }

        // Check if coupon is for members only
        if (coupon.forMember) {
            const hasPlusPlan = has({ plan: 'plus' });

            if (!hasPlusPlan) {
                return NextResponse.json({
                    error: "This coupon is only valid for premium members"
                }, { status: 400 });
            }
        }

        return NextResponse.json({ coupon });
    } catch (error) {
        console.error(error);
        return NextResponse.json({
            error: error.message || "Failed to verify coupon"
        }, { status: 500 });
    }
}