import Link from "next/link";
import { listEntidades, loadSnapshot } from "@/lib/snapshot";
import { pesos, numero } from "@/lib/format";

export default function Home() {
  const entidades = listEntidades().map((e) => ({ ...e, snapshot: loadSnapshot(e.nit) }));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Cómo contrata el Estado</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Una página por entidad pública con sus cifras de contratación en SECOP, las señales que merecen una
        segunda mirada y sus principales proveedores.
      </p>

      <ul className="mt-10 divide-y divide-line border-y border-line">
        {entidades.map(({ nombre, nit, snapshot }) => {
          const c = snapshot?.perfil?.contratos;
          return (
            <li key={nit}>
              <Link
                href={`/entidad/${nit}`}
                className="flex flex-col gap-1 py-4 hover:bg-line/40 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <span className="font-medium">{nombre}</span>
                <span className="text-sm tabular-nums text-muted">
                  {c ? `${pesos(c.valor_total)} · ${numero(c.cantidad)} contratos` : "Sin datos todavía"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
