import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listEntidades,
  loadSnapshot,
  type Hallazgo,
  type Proveedor,
  type ResultadoDetector,
  type Snapshot,
} from "@/lib/snapshot";
import { fecha, numero, pesos, porcentaje, sinMarkdown } from "@/lib/format";

export function generateStaticParams() {
  return listEntidades().map((e) => ({ nit: e.nit }));
}

// Only the curated entity list gets a page.
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/entidad/[nit]">): Promise<Metadata> {
  const { nit } = await params;
  const entidad = listEntidades().find((e) => e.nit === nit);
  return {
    title: entidad ? `${entidad.nombre} — contratación pública` : "Entidad",
    description: entidad
      ? `Cómo contrata ${entidad.nombre} (NIT ${entidad.nit}) según SECOP: cifras, señales a verificar y principales proveedores.`
      : undefined,
  };
}

/** Plain-language names for the detectors, in the order the page shows them. */
const DETECTORES: Record<string, string> = {
  adicion_excesiva: "Contratos que crecieron más de lo normal tras firmarse",
  proponente_unico: "Procesos competitivos con un solo oferente",
  sancionado_reincidente: "Contratistas sancionados que siguieron ganando",
  plazo_atipico: "Plazos para ofertar inusualmente cortos",
  adjudicacion_muy_por_debajo: "Adjudicaciones muy por debajo del presupuesto",
  concentracion_proveedor: "Un proveedor concentra el gasto",
  posible_fraccionamiento: "Posible fraccionamiento de contratos",
};

export default async function EntidadPage({ params }: PageProps<"/entidad/[nit]">) {
  const { nit } = await params;
  const entidad = listEntidades().find((e) => e.nit === nit);
  if (!entidad) notFound();

  const snapshot = loadSnapshot(nit);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Todas las entidades
      </Link>
      {snapshot ? (
        <Contenido snapshot={snapshot} />
      ) : (
        <>
          <h1 className="mt-4 text-3xl font-semibold">{entidad.nombre}</h1>
          <p className="mt-6 rounded-lg border border-line p-4 text-muted">
            Todavía no hay datos para esta entidad. Se generan con <code>npm run refresh</code>.
          </p>
        </>
      )}
    </main>
  );
}

function Contenido({ snapshot }: { snapshot: Snapshot }) {
  const { entidad, perfil, anomalias, procesos_abiertos: abiertos } = snapshot;
  const c = perfil?.contratos;
  const total = c?.valor_total ?? 0;
  const hayContratos = !!c && c.cantidad > 0 && total > 0;
  const resultados = anomalias?.resultados?.map(limpiarSanciones);

  // Additions the server itself flags as data-entry errors still count in
  // perfil's totals; when they're a big slice, the headline is misleading.
  const inflado = (resultados?.find((r) => r.detector === "adicion_excesiva")?.hallazgos ?? [])
    .filter((h) => h.probable_error_de_captura)
    .reduce((s, h) => s + (h.adicionado ?? 0), 0);

  const advertencias = Array.from(
    new Set([
      ...(perfil?.advertencias ?? []),
      ...(anomalias?.advertencias ?? []),
      ...(abiertos?.advertencias ?? []),
    ]),
  );

  return (
    <article className="mt-4 space-y-14">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{entidad.nombre}</h1>
        <p className="mt-2 text-muted">
          NIT {entidad.nit}
          {perfil?.orden_administrativo && <> · Orden {perfil.orden_administrativo.toLowerCase()}</>}
          {perfil?.departamento && <> · {perfil.departamento}</>}
        </p>
        <p className="mt-4 text-sm text-muted">
          Contratos firmados desde {fecha(snapshot.desde)} · Datos SECOP al {fecha(perfil?.datos_al)} ·
          Actualizado {fecha(snapshot.generado_en)}
        </p>
        {snapshot.errores.length > 0 && (
          <p className="mt-4 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">
            Parte de los datos no se pudo cargar en la última actualización: {snapshot.errores.join("; ")}
          </p>
        )}
      </header>

      {!hayContratos && (
        <p className="rounded-lg border border-line p-4 text-muted">
          No aparecen contratos firmados de esta entidad desde {fecha(snapshot.desde)} en los datos. Eso no
          significa que no haya contratado: puede que no publique sus contratos en SECOP o que los tramite bajo
          otro NIT.
        </p>
      )}

      {hayContratos && inflado / total > 0.05 && (
        <p className="rounded-lg border border-warn/40 bg-warn/10 p-4 text-sm">
          <strong>Ojo con el valor total.</strong> Incluye {pesos(inflado)} en adiciones que SECOP marca como
          probable error de captura ({porcentaje(inflado / total)} del total), por ejemplo un dígito de más en una
          modificación. Las cifras, proveedores y categorías de esta página están inflados por ese registro.
          Ver «Contratos que crecieron más de lo normal» abajo.
        </p>
      )}

      {hayContratos && c && (
        <section aria-labelledby="cifras">
          <h2 id="cifras" className="sr-only">
            Cifras principales
          </h2>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            <Cifra etiqueta="Valor contratado" valor={pesos(c.valor_total)} />
            <Cifra etiqueta="Contratos" valor={numero(c.cantidad)} />
            <Cifra etiqueta="Proveedores distintos" valor={numero(c.proveedores_distintos)} />
            <Cifra etiqueta="Contrato mediano" valor={pesos(c.valor_mediano)} />
          </dl>
          <p className="mt-3 text-sm text-muted">
            Entre {fecha(c.desde)} y {fecha(c.hasta)}. El valor de cada contrato ya incluye sus adiciones.
            {c.valor_pagado_total != null && <> Pagado según SECOP: {pesos(c.valor_pagado_total)}.</>}
          </p>
        </section>
      )}

      {hayContratos && resultados && (
        <Senales anomalias={resultados} porDetector={anomalias?.hallazgos_por_detector} />
      )}

      {hayContratos && perfil?.modalidades && (
        <Seccion titulo="Cómo contrata" id="modalidades">
          <p className="mb-5 text-muted">
            Modalidad de selección, por valor. La contratación directa y los regímenes especiales no exigen
            competencia abierta.
          </p>
          <Barras
            filas={perfil.modalidades.map((m) => ({
              etiqueta: m.modalidad,
              valor: m.valor,
              detalle: `${numero(m.contratos)} contratos`,
            }))}
            total={total}
          />
        </Seccion>
      )}

      {hayContratos && perfil?.principales_proveedores && (
        <Proveedores proveedores={perfil.principales_proveedores} total={total} />
      )}

      {hayContratos && perfil?.principales_categorias && (
        <Seccion titulo="En qué gasta" id="categorias">
          <p className="mb-5 text-muted">Las diez categorías (UNSPSC) con más valor contratado.</p>
          <Barras
            filas={perfil.principales_categorias.map((cat) => ({
              etiqueta: cat.nombre ?? "Sin categoría UNSPSC válida",
              valor: cat.valor,
              detalle: `${numero(cat.contratos)} contratos`,
            }))}
            total={total}
          />
        </Seccion>
      )}

      {abiertos && (
        <Seccion titulo="Procesos abiertos ahora" id="abiertos">
          {abiertos.procesos && abiertos.procesos.length > 0 ? (
            <ul className="divide-y divide-line">
              {abiertos.procesos.map((p, i) => (
                <li key={p.id ?? i} className="py-3">
                  <Enlace url={p.url}>{p.objeto ?? p.id}</Enlace>
                  <p className="text-sm text-muted">
                    {p.modalidad} · {pesos(p.presupuesto)}
                    {p.cierre_recepcion && <> · recibe ofertas hasta el {fecha(p.cierre_recepcion)}</>}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">
              No aparece ningún proceso abierto para esta entidad en los datos de los últimos 90 días.
            </p>
          )}
        </Seccion>
      )}

      {advertencias.length > 0 && (
        <Seccion titulo="Cómo leer estos datos" id="advertencias">
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            {advertencias.map((a) => (
              <li key={a}>{sinMarkdown(a)}</li>
            ))}
          </ul>
        </Seccion>
      )}
    </article>
  );
}

type Resultado = ResultadoDetector & { descartados?: number };

/**
 * sancionado_reincidente matches contractors to sanctions by document
 * number, and SECOP fills unknown documents with placeholders ("0", "1").
 * That joins unrelated consortia to someone else's sanction — and a test
 * entity ("Z ENTIDAD DE PRUEBA") lives in the sanctions table too. On a
 * page journalists may cite, a false "sanctioned" label is worse than a
 * missing one, so those rows are dropped and counted.
 */
function limpiarSanciones(r: ResultadoDetector): Resultado {
  if (r.detector !== "sancionado_reincidente") return r;
  const validos = r.hallazgos.filter(
    (h) => /^\d{6,}$/.test(h.documento ?? "") && !/entidad de prueba/i.test(h.sancionado_por ?? ""),
  );
  const descartados = r.hallazgos.length - validos.length;
  return { ...r, hallazgos: validos, total_hallazgos: r.total_hallazgos - descartados, descartados };
}

function Senales({ anomalias, porDetector }: { anomalias: Resultado[]; porDetector?: number }) {
  const orden = Object.keys(DETECTORES);
  const resultados = [...anomalias].sort((a, b) => orden.indexOf(a.detector) - orden.indexOf(b.detector));
  const conHallazgos = resultados.filter((r) => r.total_hallazgos > 0);
  const sinHallazgos = resultados.filter((r) => r.total_hallazgos === 0);

  return (
    <Seccion titulo="Señales a verificar" id="senales">
      <p className="mb-6 text-muted">
        Patrones estadísticos que merecen una segunda mirada. No son hallazgos de irregularidad: cada uno
        puede tener una explicación legítima y debe verificarse en el expediente del proceso.
      </p>

      <div className="space-y-8">
        {conHallazgos.map((r) => (
          <Detector key={r.detector} resultado={r} porDetector={porDetector} />
        ))}
      </div>

      {sinHallazgos.length > 0 && (
        <p className="mt-8 text-sm text-muted">
          Sin hallazgos con los umbrales aplicados:{" "}
          {sinHallazgos
            .map(
              (r) =>
                (DETECTORES[r.detector] ?? r.que_busca) +
                (r.descartados ? ` (se omitieron ${r.descartados} coincidencias con documento de relleno o entidad de prueba)` : ""),
            )
            .join(" · ")}
          . Que un detector no encuentre nada no descarta el patrón.
        </p>
      )}
    </Seccion>
  );
}

function Detector({ resultado: r, porDetector }: { resultado: Resultado; porDetector?: number }) {
  const reales = r.hallazgos.filter((h) => !h.probable_error_de_captura);
  const errores = r.hallazgos.filter((h) => h.probable_error_de_captura);
  const mostrados = r.hallazgos.length;

  return (
    <div className="rounded-xl border border-line p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-semibold">{DETECTORES[r.detector] ?? r.que_busca}</h3>
        <span className="shrink-0 text-2xl font-semibold tabular-nums">{numero(r.total_hallazgos)}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{r.que_busca}</p>

      {reales.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {reales.map((h, i) => (
            <FilaHallazgo key={h.id_contrato ?? h.id_proceso ?? h.documento ?? i} detector={r.detector} h={h} />
          ))}
        </ul>
      )}

      {errores.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted">
            {errores.length} {errores.length === 1 ? "caso parece" : "casos parecen"} un error de captura en
            SECOP, no una señal real
          </summary>
          <ul className="mt-2 divide-y divide-line">
            {errores.map((h, i) => (
              <FilaHallazgo key={h.id_contrato ?? h.id_proceso ?? i} detector={r.detector} h={h} />
            ))}
          </ul>
          {r.cobertura?.errores_de_captura && (
            <p className="mt-2 text-muted">{sinMarkdown(r.cobertura.errores_de_captura)}</p>
          )}
        </details>
      )}

      {!!r.descartados && (
        <p className="mt-3 text-sm text-muted">
          Se omitieron {r.descartados} {r.descartados === 1 ? "coincidencia" : "coincidencias"} que el registro
          cruza por un número de documento de relleno o con una entidad de prueba: no identifican a un
          contratista real.
        </p>
      )}

      {r.total_hallazgos > mostrados && (
        <p className="mt-3 text-sm text-muted">
          Se muestran {mostrados} de {numero(r.total_hallazgos)}
          {porDetector ? ` (los primeros ${porDetector} que devuelve el detector)` : ""}.
        </p>
      )}

      {r.cobertura?.nota && (
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{sinMarkdown(r.cobertura.nota)}</p>
      )}
    </div>
  );
}

function FilaHallazgo({ detector, h }: { detector: string; h: Hallazgo }) {
  let detalle: React.ReactNode = null;
  switch (detector) {
    case "adicion_excesiva":
      detalle = (
        <>
          {h.proveedor} · firmado {fecha(h.fecha_firma)} · de {pesos(h.valor_base)} a {pesos(h.valor_final)} (
          <strong>+{porcentaje(h.proporcion ?? 0)}</strong>) en {h.n_modificaciones} modificaciones
        </>
      );
      break;
    case "proponente_unico":
      detalle = (
        <>
          {h.modalidad} · {fecha(h.fecha_publicacion)} · presupuesto {pesos(h.presupuesto)} · ganó {h.proveedor}
        </>
      );
      break;
    case "plazo_atipico":
      detalle = (
        <>
          {h.modalidad} · {fecha(h.fecha_publicacion)} · {h.dias_de_ventana} días para ofertar (el 5% más corto
          del país en esta modalidad: ≤ {h.corte_de_su_modalidad} días)
        </>
      );
      break;
    case "adjudicacion_muy_por_debajo":
      detalle = (
        <>
          {h.proveedor} · {fecha(h.fecha_publicacion)} · presupuesto {pesos(h.presupuesto)}, adjudicado{" "}
          {pesos(h.valor_adjudicado)}
        </>
      );
      break;
    case "posible_fraccionamiento":
      detalle = (
        <>
          NIT {h.documento_proveedor} · {h.contratos} contratos de la misma categoría ({h.categoria}) firmados
          {h.dias_entre_extremos === 0
            ? ` el mismo día (${fecha(h.primera_firma)})`
            : ` en ${h.dias_entre_extremos} días (${fecha(h.primera_firma)} – ${fecha(h.ultima_firma)})`}{" "}
          · suman {pesos(h.valor_conjunto)}
        </>
      );
      break;
    case "sancionado_reincidente":
      detalle = (
        <>
          NIT {h.documento} · sancionado por {h.sancionado_por} (en firme desde {fecha(h.primera_sancion_en_firme)}) ·
          después ganó {h.contratos_posteriores} {h.contratos_posteriores === 1 ? "contrato" : "contratos"} por{" "}
          {pesos(h.valor_posterior)}
        </>
      );
      break;
  }

  const titulo = h.objeto ?? h.proveedor;

  return (
    <li className="py-3">
      <Enlace url={h.url}>
        <span className="line-clamp-2">{titulo}</span>
      </Enlace>
      {detalle && <p className="mt-1 text-sm text-muted">{detalle}</p>}
    </li>
  );
}

function Proveedores({
  proveedores,
  total,
}: {
  proveedores: Proveedor[];
  total: number;
}) {
  const top10 = proveedores.slice(0, 10).reduce((s, p) => s + p.valor, 0);
  const mostrados = proveedores.slice(0, 15);

  return (
    <Seccion titulo="A quién le compra" id="proveedores">
      <p className="mb-5 text-muted">
        Los diez mayores proveedores suman <strong className="text-foreground">{porcentaje(top10 / total)}</strong>{" "}
        del valor contratado.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 pr-3 font-normal">Proveedor</th>
              <th className="py-2 pr-3 text-right font-normal">Contratos</th>
              <th className="py-2 pr-3 text-right font-normal">Valor</th>
              <th className="py-2 text-right font-normal">% del total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {mostrados.map((p) => (
              <tr key={`${p.documento_proveedor}-${p.proveedor}`}>
                <td className="py-2 pr-3">
                  {p.proveedor}
                  {p.es_consorcio && (
                    <span className="ml-2 rounded border border-line px-1.5 py-0.5 text-xs text-muted">
                      consorcio / UT
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{numero(p.contratos)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{pesos(p.valor)}</td>
                <td className="py-2 text-right tabular-nums">{porcentaje(p.valor / total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted">
        Los miembros de consorcios y uniones temporales no se publican en SECOP: lo que una empresa gana a través
        de ellos no se le suma aquí.
      </p>
    </Seccion>
  );
}

function Barras({
  filas,
  total,
}: {
  filas: { etiqueta: string; valor: number; detalle: string }[];
  total: number;
}) {
  return (
    <ul className="space-y-3">
      {filas.map((f) => {
        const share = f.valor / total;
        return (
          <li key={f.etiqueta}>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span>{f.etiqueta}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {pesos(f.valor)} · {porcentaje(share)}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-line" aria-hidden>
              <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(share * 100, 0.5)}%` }} />
            </div>
            <p className="mt-0.5 text-xs text-muted">{f.detalle}</p>
          </li>
        );
      })}
    </ul>
  );
}

function Seccion({ titulo, id, children }: { titulo: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 text-xl font-semibold">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="bg-background p-4">
      <dt className="text-sm text-muted">{etiqueta}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

function Enlace({ url, children }: { url?: string; children: React.ReactNode }) {
  if (!url) return <span>{children}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-4 hover:decoration-foreground">
      {children}
    </a>
  );
}
