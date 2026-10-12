import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { SurveyForm } from "../survey-form";

export default async function NewSurveyPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: "Survei", href: "/survei" }, { label: "Survei baru" }]}
        title="Survei baru"
        meta="Survei ini akan dimiliki oleh grup Anda dan berlaku untuk semua turunannya."
      />
      <SurveyForm />
    </div>
  );
}
