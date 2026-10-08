import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/affiliate-server";
import { getSessionContext } from "@/lib/partner-session";
import {
  canActorTransitionListing,
  isListingStatus,
  transitionAuditAction,
  type ListingStatus,
} from "@/lib/listing-moderation";

/**
 * /api/admin/listings — moderacijska vrsta B2B tržnice (P0-H §22).
 *
 *  GET  ?status=pending|published|draft|rejected → vrsta z lastnikom
 *        (email partnerja) + povzetek; privzeto "pending".
 *  POST → skrbniška odločitev { productId, action, reason? }:
 *        · "publish"  (pending → published) — SAMO skrbnik lahko objavi;
 *        · "reject"   (pending → rejected)  — razlog OBVEZEN (viden partnerju);
 *        · "unpublish"(published → draft)   — jemanje s police.
 *
 * Vrata: isAdminSession (DSA_ADMIN_EMAILS) → 403 fail-closed.
 * AuditLog na vsaki odločitvi (actorType "owner").
 */

export const dynamic = "force-dynamic";

const MAX_ROWS = 100;

function parseStatus(value: string | null): ListingStatus {
  if (value && isListingStatus(value)) return value;
  return "pending";
}

export async function GET(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 }
    );
  }
  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));

  try {
    const products = await db.product.findMany({
      where: { status },
      orderBy: [{ submittedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: MAX_ROWS,
    });
    const ownerIds = [...new Set(products.map((p) => p.ownerId).filter((x): x is string => Boolean(x)))];
    const owners = ownerIds.length
      ? await db.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, email: true, name: true },
        })
      : [];
    const ownerMap = new Map(owners.map((o) => [o.id, o]));

    const counts = await db.product.groupBy({ by: ["status"], _count: { _all: true } });
    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c.status] = c._count._all;

    return NextResponse.json({
      status,
      counts: countMap,
      listings: products.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        kind: p.kind,
        stock: p.stock,
        saleCount: p.saleCount,
        status: p.status,
        lat: p.lat,
        lng: p.lng,
        rejectionReason: p.rejectionReason,
        submittedAt: p.submittedAt?.toISOString() ?? null,
        reviewedAt: p.reviewedAt?.toISOString() ?? null,
        reviewedBy: p.reviewedBy,
        owner: p.ownerId
          ? {
              email: ownerMap.get(p.ownerId)?.email ?? null,
              name: ownerMap.get(p.ownerId)?.name ?? null,
            }
          : null, // null = platforma (seed) — uredniški vnos
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[api/admin/listings] GET napaka:", err);
    return NextResponse.json({ error: "Vrsta trenutno ni dosegljiva." }, { status: 500 });
  }
}

interface DecisionBody {
  productId?: unknown;
  action?: unknown; // "publish" | "reject" | "unpublish"
  reason?: unknown;
}

export async function POST(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 }
    );
  }

  let body: DecisionBody;
  try {
    body = (await request.json()) as DecisionBody;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  const productId = typeof body.productId === "string" ? body.productId : "";
  const action = body.action;
  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 500)
      : null;
  if (!productId || (action !== "publish" && action !== "reject" && action !== "unpublish")) {
    return NextResponse.json({ error: "Manjka productId ali dejanje." }, { status: 400 });
  }
  if (action === "reject" && !reason) {
    return NextResponse.json(
      { error: "Zavrnitev potrebuje razlog (viden partnerju)." },
      { status: 400 }
    );
  }

  try {
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product || !isListingStatus(product.status)) {
      return NextResponse.json({ error: "Vnos ne obstaja." }, { status: 404 });
    }
    const current: ListingStatus = product.status;
    const to: ListingStatus =
      action === "publish" ? "published" : action === "reject" ? "rejected" : "draft";

    if (!canActorTransitionListing(current, to, "admin")) {
      return NextResponse.json(
        { error: `Prehod ${current} → ${to} ni dovoljen.` },
        { status: 409 }
      );
    }

    const adminEmail = (await getAdminEmail()) ?? "admin";
    const updated = await db.$transaction(async (tx) => {
      const data: Prisma.ProductUpdateInput = {
        status: to,
        reviewedAt: new Date(),
        reviewedBy: adminEmail,
        updatedAt: new Date(),
      };
      if (to === "published") {
        data.rejectionReason = null;
      }
      if (to === "rejected") {
        data.rejectionReason = reason;
      }
      const row = await tx.product.update({ where: { id: product.id }, data });
      await tx.auditLog.create({
        data: {
          actorType: "owner",
          actorId: adminEmail,
          action: transitionAuditAction(current, to),
          entityType: "product",
          entityId: product.id,
          meta: JSON.stringify({ from: current, to, reason }),
        },
      });
      return row;
    });

    return NextResponse.json({
      ok: true,
      product: { id: updated.id, slug: updated.slug, status: updated.status },
    });
  } catch (err) {
    console.error("[api/admin/listings] POST napaka:", err);
    return NextResponse.json({ error: "Odločitev ni uspela." }, { status: 500 });
  }
}

/** E-pošta skrbnika iz seje (za reviewedBy + AuditLog). */
async function getAdminEmail(): Promise<string | null> {
  const ctx = await getSessionContext();
  return ctx?.email ?? null;
}
