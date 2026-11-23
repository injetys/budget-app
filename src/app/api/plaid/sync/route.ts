import { admin, currentUser } from "@/lib/supabase/server";
import { syncItem } from "@/lib/sync";

export const maxDuration = 60;

/** Sync all of the signed-in user's bank connections. */
export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const db = admin();
  const { data: items } = await db.from("plaid_items").select("id, institution").eq("user_id", user.id);
  const results = [];
  for (const it of items ?? []) {
    try {
      results.push({ institution: it.institution, ...(await syncItem(db, user.id, it.id)) });
    } catch (e) {
      results.push({ institution: it.institution, error: (e as Error).message });
    }
  }
  return Response.json({ results });
}
