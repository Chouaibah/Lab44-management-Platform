import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { approveVMRequest } from "@/lib/vm-approval";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "instructor")) {
      return NextResponse.json({ error: "Admin or instructor access required." }, { status: 403 });
    }

    const body = await request.json();
    const { action, requestIds, note } = body as {
      action: "approve" | "reject";
      requestIds: number[];
      note?: string;
    };

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Action must be 'approve' or 'reject'." }, { status: 400 });
    }

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json({ error: "requestIds must be a non-empty array." }, { status: 400 });
    }

    let processed = 0;
    let failed = 0;
    const results: Array<{ id: number; status: string; error?: string }> = [];

    for (const id of requestIds) {
      try {
        if (action === "approve") {
          const result = await approveVMRequest({
            id,
            note: note || null,
            startVM: false,
          });

          results.push({ id, status: "approved" });
        } else {
          // Reject logic — same as single reject endpoint
          const existing = await db.vMRequest.findUnique({ where: { id } });
          if (!existing) {
            results.push({ id, status: "error", error: "Request not found." });
            failed++;
            continue;
          }

          await db.vMRequest.update({
            where: { id },
            data: {
              status: "rejected",
              note: note || null,
              reviewedAt: new Date(),
            },
          });

          results.push({ id, status: "rejected" });
        }

        processed++;
      } catch (err: any) {
        results.push({ id, status: "error", error: err.message || "Unknown error" });
        failed++;
      }
    }

    return NextResponse.json({ ok: true, processed, failed, results });
  } catch (error: any) {
    console.error("Batch VM request error:", error);
    return NextResponse.json({ error: "Failed to process batch request." }, { status: 500 });
  }
}
