import { currentUser } from "@/lib/supabase/server";
import { plaid } from "@/lib/plaid";

export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const r = await plaid<{ link_token: string }>("/link/token/create", {
      user: { client_user_id: user.id },
      client_name: "Budget",
      products: ["transactions"],
      transactions: { days_requested: 730 },
      country_codes: ["US"],
      language: "en",
    });
    return Response.json({ link_token: r.link_token });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
