import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

/**
 * POST /api/auth/register — ustvari račun popotnika (credentials).
 *
 * Izvirnik: polna registracija prek API-ja; tukaj mostovna oblika:
 * e-pošta (unique) + ime + geslo (scrypt hash). 409 ob že obstoječem
 * naslovu — iskreno, brez tihega prepisovanja.
 */

interface RegisterBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { error: "Ime mora imeti med 2 in 80 znakov." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email) || email.length > 160) {
    return NextResponse.json(
      { error: "Vpiši veljaven e-poštni naslov." },
      { status: 400 }
    );
  }
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json(
      { error: "Geslo mora imeti med 8 in 200 znakov." },
      { status: 400 }
    );
  }

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Račun s tem e-poštnim naslovom že obstaja — prijavi se." },
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash: hashPassword(password),
      },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error && e.message.includes("Unique")
            ? "Račun s tem naslovom že obstaja."
            : "Registracija trenutno ni mogoča — poskusi znova.",
      },
      { status: 500 }
    );
  }
}
