import Link from "next/link";
import { getDepartments } from "@/lib/departments";
import PageHeader from "@/app/components/PageHeader";
import RegistraceForm from "./RegistraceForm";

export default function RegistracePage() {
  const departments = getDepartments().map((d) => ({ name: d.name, label: d.label }));

  return (
    <div className="k-shell">
      <PageHeader title="Registrace" mobileTitle="Registrace" />

      <div className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav flex items-start justify-center">
        <div className="max-w-sm w-full flex flex-col gap-4 py-4">

          <div className="flex flex-col items-center gap-1 mb-1">
            <p className="font-display font-bold text-[18px] text-stone-900">Vytvoř si účet</p>
            <p className="text-[13px] text-stone-500">Pro přístup ke Kantýně</p>
          </div>

          <RegistraceForm departments={departments} />

          <p className="text-center text-[13px] text-stone-500">
            Už máš účet?{" "}
            <Link href="/login" className="text-amber-700 font-semibold hover:underline">
              Přihlásit se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
