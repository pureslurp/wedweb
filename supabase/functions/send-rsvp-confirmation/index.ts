import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.16";

const MAX_IDS = 40;
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
  if (!meal) return "";
  return MEAL_LABELS[meal] ?? meal;
}

type GuestRow = {
  first_name: string;
  last_name: string;
  email: string | null;
  rsvp: string | null;
  meal_choice: string | null;
  day_after_invited: boolean;
  day_after_rsvp: string | null;
  marriott_stay: string | null;
  shuttle_rsvp: string | null;
};

function buildPlainBody(g: GuestRow): string {
  const lines: string[] = [
    "Thank you for your RSVP!",
    "",
    "Wedding day — Saturday, September 5, 2026",
    "Ceremony: 5:30 PM",
    "Cocktail hour: 6:00–7:00 PM",
    "Reception: 7:00–11:30 PM",
    "Venue: 30 N Saginaw St Suite #300, Pontiac, MI 48342",
    "",
    `Here is what we have on file for ${g.first_name} ${g.last_name}:`,
    `- Wedding: ${g.rsvp === "yes" ? "Attending" : "Not attending"}`,
  ];
  if (g.rsvp === "yes" && g.meal_choice) {
    lines.push(`- Meal choice: ${formatMealLabel(g.meal_choice)}`);
  }
  if (g.rsvp === "yes") {
    lines.push(
      `- Staying at Auburn Hills Marriott Pontiac (room block): ${
        g.marriott_stay === "yes"
          ? "Yes"
          : g.marriott_stay === "no"
            ? "No"
            : "—"
      }`,
    );
    if (g.marriott_stay === "yes") {
      lines.push(
        `- Hotel shuttle: ${
          g.shuttle_rsvp === "yes"
            ? "Yes, planning to take the shuttle"
            : g.shuttle_rsvp === "no"
              ? "No"
              : "—"
        }`,
      );
    }
  }
  lines.push("", "Travel & hotel details: https://savandsean.com/travel.html");
  lines.push("", "— Savannah & Sean");
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
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

  if (!supabaseUrl || !serviceKey || !gmailUser || !gmailPass) {
    return new Response(
      JSON.stringify({ error: "Server configuration incomplete" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const inFilter = `(${cleanIds.join(",")})`;
  const selectCols =
    "first_name,last_name,email,rsvp,meal_choice,day_after_invited,day_after_rsvp,marriott_stay,shuttle_rsvp";
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

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const g of guests) {
    const weddingYes = g.rsvp === "yes";
    const dayAfterYes =
      g.day_after_invited === true && g.day_after_rsvp === "yes";
    if (!weddingYes && !dayAfterYes) continue;

    const to = (g.email ?? "").trim();
    if (!to) {
      errors.push(`skip ${g.first_name} ${g.last_name}: no email`);
      continue;
    }

    try {
      await transporter.sendMail({
        from: `Savannah & Sean <${gmailUser}>`,
        to,
        subject: "Your RSVP — Savannah & Sean",
        text: buildPlainBody(g),
      });
      sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("smtp error for", to, msg);
      errors.push(`${to}: ${msg}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent, skipped: errors }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
