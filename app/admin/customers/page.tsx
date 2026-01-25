import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import { CustomersAdminClient } from "./customers-admin-client";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

// Server Actions
async function createCustomer(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const name = formData.get("name") as string;

  if (!name) {
    throw new Error("Navn er påkrevd");
  }

  // Generate slug from name or use UUID
  const id = name
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Check if slug already exists
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("id", id)
    .single();

  const finalId = existing ? `${id}-${crypto.randomUUID().slice(0, 8)}` : id;

  const { error } = await supabase.from("customers").insert({
    id: finalId,
    name,
  });

  if (error) {
    throw new Error(`Kunne ikke opprette kunde: ${error.message}`);
  }

  revalidatePath("/admin/customers");
}

async function updateCustomer(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;

  if (!id || !name) {
    throw new Error("Alle felt er påkrevd");
  }

  const { error } = await supabase
    .from("customers")
    .update({ name })
    .eq("id", id);

  if (error) {
    throw new Error(`Kunne ikke oppdatere kunde: ${error.message}`);
  }

  revalidatePath("/admin/customers");
}

async function deleteCustomer(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const id = formData.get("id") as string;

  // Check if customer has projects
  const { count } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("customer_id", id);

  if (count && count > 0) {
    throw new Error(
      `Kan ikke slette kunden. Den har ${count} prosjekt${count > 1 ? "er" : ""}.`
    );
  }

  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) {
    throw new Error(`Kunne ikke slette kunde: ${error.message}`);
  }

  revalidatePath("/admin/customers");
}

export default async function AdminCustomersPage() {
  if (!adminEnabled) {
    redirect("/");
  }

  const supabase = createServerClient();

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-600">
            Supabase ikke konfigurert
          </h1>
          <p className="mt-2 text-gray-600">
            Sett NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY i .env
          </p>
        </div>
      </div>
    );
  }

  // Fetch customers
  const { data: customers, error } = await supabase
    .from("customers")
    .select("*")
    .order("name");

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-600">Database-feil</h1>
          <p className="mt-2 text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  // Get project counts per customer
  const { data: projectCounts } = await supabase
    .from("projects")
    .select("customer_id");

  const countMap: Record<string, number> = {};
  if (projectCounts) {
    for (const project of projectCounts) {
      if (project.customer_id) {
        countMap[project.customer_id] = (countMap[project.customer_id] || 0) + 1;
      }
    }
  }

  const customersWithCount = (customers || []).map((customer) => ({
    ...customer,
    projectCount: countMap[customer.id] || 0,
  }));

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Laster...
        </div>
      }
    >
      <CustomersAdminClient
        customers={customersWithCount}
        createCustomer={createCustomer}
        updateCustomer={updateCustomer}
        deleteCustomer={deleteCustomer}
      />
    </Suspense>
  );
}
