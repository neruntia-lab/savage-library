import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth";
import { AdminLoginForm } from "../../../components/admin/AdminLoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrator sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "admin") redirect("/admin");

  return (
    <section className="admin-login-shell">
      <div className="admin-login-card">
        <Image
          src="/savage-library-logo.svg"
          alt="Savage Library"
          width={118}
          height={154}
          priority
        />
        <p className="eyebrow">Keeper access</p>
        <h1>Enter the archive</h1>
        <p>
          Sign in to create releases, translate resources, manage Patreon
          access, and publish the library.
        </p>
        <AdminLoginForm />
      </div>
    </section>
  );
}
