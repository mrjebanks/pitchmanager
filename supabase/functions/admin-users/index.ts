import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

const allowedTabs = new Set([
  "settings",
  "teams",
  "venues",
  "facilities",
  "friendlies",
  "assignments",
  "visual",
  "training",
]);

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normaliseRole(role: unknown) {
  return String(role || "").toLowerCase() === "admin" ? "admin" : "viewer";
}

function normaliseTabOverrides(raw: unknown) {
  if (!raw || typeof raw !== "object") return {};
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    ([tabId, value]) => allowedTabs.has(tabId) && typeof value === "boolean",
  );
  return Object.fromEntries(entries);
}

function normaliseCanWriteOverride(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = request.headers.get("Authorization");
    const requestApiKey =
      request.headers.get("apikey") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!supabaseUrl || !serviceRoleKey || !authHeader || !requestApiKey) {
      return jsonResponse(500, { error: "Supabase function environment is incomplete." });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const userClient = createClient(supabaseUrl, requestApiKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    const {
      data: claimsData,
      error: authError,
    } = await userClient.auth.getClaims(accessToken);
    const userId = String(claimsData?.claims?.sub || "");
    if (authError || !userId) {
      console.error("Authentication failed.", authError);
      return jsonResponse(401, { error: authError?.message || "Authentication failed." });
    }

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("user_profiles")
      .select("role, is_active")
      .eq("user_id", userId)
      .maybeSingle();
    if (callerProfileError) {
      return jsonResponse(500, { error: callerProfileError.message });
    }
    if (!callerProfile?.is_active || callerProfile.role !== "admin") {
      return jsonResponse(403, { error: "Admin access is required." });
    }

    const body = await request.json();
    const action = String(body?.action || "");
    const displayName = String(body?.displayName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = body?.password ? String(body.password) : "";
    const role = normaliseRole(body?.role);
    const canWriteOverride = normaliseCanWriteOverride(body?.canWriteOverride);
    const tabOverrides = normaliseTabOverrides(body?.tabOverrides);

    if (!displayName || !email) {
      return jsonResponse(400, { error: "Name and email are required." });
    }

    if (action === "create_user") {
      if (!password || password.length < 8) {
        return jsonResponse(400, { error: "A password of at least 8 characters is required." });
      }

      const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (createError || !createdUser.user) {
        return jsonResponse(400, { error: createError?.message || "Unable to create user." });
      }

      const { error: profileError } = await adminClient.from("user_profiles").upsert({
        user_id: createdUser.user.id,
        email,
        display_name: displayName,
        role,
        can_write_override: canWriteOverride,
        tab_overrides: tabOverrides,
      });
      if (profileError) {
        return jsonResponse(400, { error: profileError.message });
      }

      return jsonResponse(200, { ok: true, userId: createdUser.user.id });
    }

    if (action === "update_user") {
      const userId = String(body?.userId || "");
      if (!userId) {
        return jsonResponse(400, { error: "User ID is required." });
      }

      const updatePayload: { email?: string; password?: string; user_metadata?: Record<string, string> } = {
        user_metadata: { display_name: displayName },
      };
      if (email) updatePayload.email = email;
      if (password) {
        if (password.length < 8) {
          return jsonResponse(400, { error: "Passwords must be at least 8 characters." });
        }
        updatePayload.password = password;
      }

      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(userId, updatePayload);
      if (updateAuthError) {
        return jsonResponse(400, { error: updateAuthError.message });
      }

      const { error: profileError } = await adminClient
        .from("user_profiles")
        .update({
          email,
          display_name: displayName,
          role,
          can_write_override: canWriteOverride,
          tab_overrides: tabOverrides,
        })
        .eq("user_id", userId);
      if (profileError) {
        return jsonResponse(400, { error: profileError.message });
      }

      return jsonResponse(200, { ok: true, userId });
    }

    return jsonResponse(400, { error: "Unsupported action." });
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
});
