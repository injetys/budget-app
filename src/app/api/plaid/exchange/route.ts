import { admin, currentUser } from "@/lib/supabase/server";
import { plaid } from "@/lib/plaid";
import { syncItem } from "@/lib/sync";

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { public_token, institution } = await req.json();
  try {
    const r = await plaid<{ access_token: string; item_id: string }>("/item/public_token/exchange", { public_token });
    const db = admin();
    const { data: item, error } = await db.from("plaid_items")
      .upsert({ user_id: user.id, plaid_item_id: r.item_id, institution: institution ?? null }, { onConflict: "plaid_item_id" })
      .select("id").single();
    if (error || !item) throw error ?? new Error("Could not save bank connection");
    await db.from("plaid_secrets").upsert({ item_id: item.id, access_token: r.access_token });
    const result = await syncItem(db, user.id, item.id);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
