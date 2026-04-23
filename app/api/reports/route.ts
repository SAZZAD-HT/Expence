import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { decryptWithMaster } from "@/lib/encryption";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM, required
  const type = searchParams.get("type") ?? "monthly"; // monthly | over-budget | loans | credit-cards

  if (!month) {
    return Response.json({ error: "month is required (YYYY-MM)" }, { status: 400 });
  }

  const supabase = createServerClient();

  if (type === "monthly" || type === "food") {
    const { data: expenses, error: expErr } = await supabase
      .from("expenses")
      .select(
        "id, amount_encrypted, category_id, payment_method, description_encrypted, expense_date"
      )
      .eq("user_id", user.id)
      .gte("expense_date", `${month}-01`)
      .lte("expense_date", `${month}-31`)
      .order("expense_date", { ascending: true });

    if (expErr) {
      return Response.json({ error: expErr.message }, { status: 500 });
    }

    const { data: categories } = await supabase
      .from("category_mappings")
      .select("id, category_name_encrypted, segment_id")
      .eq("user_id", user.id);

    const { data: segments } = await supabase
      .from("budget_segments")
      .select("id, name, monthly_limit_encrypted")
      .eq("user_id", user.id);

    const decryptedExpenses = (expenses ?? []).map((row) => ({
      ...row,
      amount_encrypted: decryptWithMaster(row.amount_encrypted),
      description_encrypted: row.description_encrypted
        ? decryptWithMaster(row.description_encrypted)
        : null,
    }));

    const decryptedCategories = (categories ?? []).map((row) => ({
      ...row,
      category_name_encrypted: decryptWithMaster(row.category_name_encrypted),
    }));

    const decryptedSegments = (segments ?? []).map((row) => ({
      ...row,
      monthly_limit_encrypted: decryptWithMaster(row.monthly_limit_encrypted),
    }));

    return Response.json({
      expenses: decryptedExpenses,
      categories: decryptedCategories,
      segments: decryptedSegments,
    });
  }

  if (type === "loans") {
    const { data: loans, error } = await supabase
      .from("loans")
      .select(
        "id, loan_name_encrypted, principal_encrypted, interest_rate_encrypted, start_date, tenure_months, emi_amount_encrypted, segment_id"
      )
      .eq("user_id", user.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const { data: salaries } = await supabase
      .from("monthly_salaries")
      .select("month, salary_encrypted")
      .eq("user_id", user.id)
      .eq("month", month)
      .single();

    const decryptedLoans = (loans ?? []).map((row) => ({
      ...row,
      loan_name_encrypted: decryptWithMaster(row.loan_name_encrypted),
      principal_encrypted: decryptWithMaster(row.principal_encrypted),
      interest_rate_encrypted: decryptWithMaster(row.interest_rate_encrypted),
      emi_amount_encrypted: decryptWithMaster(row.emi_amount_encrypted),
    }));

    return Response.json({
      loans: decryptedLoans,
      salary: salaries
        ? { ...salaries, salary_encrypted: decryptWithMaster(salaries.salary_encrypted) }
        : null,
    });
  }

  if (type === "credit-cards") {
    const { data: cards, error } = await supabase
      .from("credit_cards")
      .select(
        "id, card_name_encrypted, credit_limit_encrypted, current_balance_encrypted, minimum_due_encrypted, billing_cycle_day, interest_free_days"
      )
      .eq("user_id", user.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const { data: expenses } = await supabase
      .from("expenses")
      .select("amount_encrypted, credit_card_id, expense_date")
      .eq("user_id", user.id)
      .eq("payment_method", "credit_card")
      .gte("expense_date", `${month}-01`)
      .lte("expense_date", `${month}-31`);

    const decryptedCards = (cards ?? []).map((row) => ({
      ...row,
      card_name_encrypted: decryptWithMaster(row.card_name_encrypted),
      credit_limit_encrypted: decryptWithMaster(row.credit_limit_encrypted),
      current_balance_encrypted: decryptWithMaster(row.current_balance_encrypted),
      minimum_due_encrypted: decryptWithMaster(row.minimum_due_encrypted),
    }));

    const decryptedExpenses = (expenses ?? []).map((row) => ({
      ...row,
      amount_encrypted: decryptWithMaster(row.amount_encrypted),
    }));

    return Response.json({ cards: decryptedCards, expenses: decryptedExpenses });
  }

  return Response.json({ error: "Unknown report type" }, { status: 400 });
}
