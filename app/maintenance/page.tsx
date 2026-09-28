import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Archive improvements underway",
  description: "Savage Library is temporarily offline while the archive is improved.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <section className="maintenance-page" aria-labelledby="maintenance-title">
      <div className="maintenance-grid" aria-hidden="true" />
      <div className="maintenance-panel">
        <div className="maintenance-mark">
          <Image
            src="/savage-library-logo.svg"
            alt=""
            width={80}
            height={108}
            priority
          />
        </div>
        <p className="eyebrow">Archive restoration in progress</p>
        <h1 id="maintenance-title">The archive is being refined.</h1>
        <p className="maintenance-intro">
          We&apos;re improving Savage Library and will bring it back online as
          soon as possible. Thank you for your patience.
        </p>

        <div className="maintenance-rule" aria-hidden="true" />

        <div className="maintenance-translation" lang="es">
          <p className="eyebrow">Restauración del archivo en curso</p>
          <h2>Estamos mejorando el archivo.</h2>
          <p>
            Estamos mejorando Savage Library y volveremos a ponerlo en línea
            tan pronto como sea posible. Gracias por tu paciencia.
          </p>
        </div>
      </div>
    </section>
  );
}
