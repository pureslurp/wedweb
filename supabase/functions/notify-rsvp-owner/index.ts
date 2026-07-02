import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.16";

const MAX_IDS = 40;
const DEFAULT_NOTIFY_EMAIL = "s.raymor.martinez@gmail.com";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MEAL_LABELS: Record<string, string> = {
  beef: "Beef Tenderloin with Demi-Glace (8oz) — asparagus & mashed potatoes",
  chicken:
    "Grilled Chicken Breast with Basil Pesto (10oz) — asparagus & mashed potatoes",
  vegetarian: "Gnocchi Bolognese — Vegan & Vegetarian",
};

function formatMealLabel(meal: string | null): string {
  if (!meal) return "—";
  return MEAL_LABELS[meal] ?? meal;
}

function formatYesNo(value: string | null): string {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return "—";
}

type GuestRow = {
  first_name: string;
  last_name: string;
  email: string | null;
  rsvp: string | null;
  meal_choice: string | null;
  dietary_notes: string | null;
  general_notes: string | null;
  marriott_stay: string | null;
  shuttle_rsvp: string | null;
};

function buildGuestSection(g: GuestRow): string {
  const lines: string[] = [
    `${g.first_name} ${g.last_name}`,
    `  Wedding: ${g.rsvp === "yes" ? "Attending" : g.rsvp === "no" ? "Not attending" : "—"}`,
  ];

  if (g.email?.trim()) {
    lines.push(`  Email on file: ${g.email.trim()}`);
  }

  if (g.rsvp === "yes") {
    lines.push(`  Meal: ${formatMealLabel(g.meal_choice)}`);
    lines.push(
      `  Marriott room block: ${formatYesNo(g.marriott_stay)}`,
    );
    if (g.marriott_stay === "yes") {
      lines.push(`  Shuttle: ${formatYesNo(g.shuttle_rsvp)}`);
    }
  }

  if (g.dietary_notes?.trim()) {
    lines.push(`  Dietary notes: ${g.dietary_notes.trim()}`);
  }
  if (g.general_notes?.trim()) {
    lines.push(`  Notes: ${g.general_notes.trim()}`);
  }

  return lines.join("\n");
}

function buildSubject(guests: GuestRow[]): string {
  if (guests.length === 0) return "RSVP submitted";
  const first = `${guests[0].first_name} ${guests[0].last_name}`;
  if (guests.length === 1) return `RSVP submitted — ${first}`;
  return `RSVP submitted — ${first} (+${guests.length - 1} more)`;
}

function buildPlainBody(guests: GuestRow[]): string {
  const lines: string[] = [
    "A guest just submitted an RSVP on savandsean.com.",
    "",
    ...guests.map((g) => buildGuestSection(g)),
    "",
    "— Wedding website",
  ];
  return lines.join("\n");
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { guest_ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawIds = body.guest_ids;
  if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > MAX_IDS) {
    return new Response(
      JSON.stringify({
        error: "guest_ids must be a non-empty array with at most 40 ids",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const cleanIds = rawIds.filter(
    (id): id is string => typeof id === "string" && UUID_RE.test(id),
  );
  if (cleanIds.length === 0) {
    return new Response(JSON.stringify({ error: "No valid guest UUIDs" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const gmailUser = Deno.env.get("GMAIL_SMTP_USER") ?? "";
  const gmailPass = Deno.env.get("GMAIL_SMTP_APP_PASSWORD") ?? "";
  const notifyEmail =
    Deno.env.get("RSVP_NOTIFY_EMAIL")?.trim() || DEFAULT_NOTIFY_EMAIL;

  if (!supabaseUrl || !serviceKey || !gmailUser || !gmailPass) {
    return new Response(
      JSON.stringify({ error: "Server configuration incomplete" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const inFilter = `(${cleanIds.join(",")})`;
  const selectCols =
    "first_name,last_name,email,rsvp,meal_choice,dietary_notes,general_notes,marriott_stay,shuttle_rsvp";
  const url = `${supabaseUrl}/rest/v1/guests?id=in.${inFilter}&select=${selectCols}`;

  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("guests fetch failed:", res.status, errText);
    return new Response(JSON.stringify({ error: "Failed to load guests" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const guests = (await res.json()) as GuestRow[];
  if (guests.length === 0) {
    return new Response(JSON.stringify({ error: "No guests found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  try {
    await transporter.sendMail({
      from: `Wedding RSVP <${gmailUser}>`,
      to: notifyEmail,
      subject: buildSubject(guests),
      text: buildPlainBody(guests),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("owner notify smtp error:", msg);
    return new Response(JSON.stringify({ error: "Failed to send notification" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, sent: 1 }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
