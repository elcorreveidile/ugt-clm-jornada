import { Link } from "react-router";

// Texto base. Pendiente de revisión por los servicios jurídicos de UGT antes de
// abrir la herramienta a todo el centro (los datos entre corchetes, por completar).
export default function Aviso() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6 text-sm leading-relaxed text-gray-800">
      <h1 className="text-2xl font-bold">Aviso legal, privacidad y valor probatorio</h1>
      <p className="rounded-xl bg-amber-50 p-3 text-amber-900 ring-1 ring-amber-200">
        Texto provisional, pendiente de revisión por los servicios jurídicos de UGT.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Qué es esta herramienta</h2>
        <p>
          Un registro personal de jornada para que cualquier persona trabajadora deje constancia de sus horas, turnos,
          pausas, desplazamientos e incidencias. Se adapta a cada colectivo: docencia, hostelería, comercio, limpieza,
          cuidados, sanidad, transporte, seguridad, campo y manipulado, y otros. La ha desarrollado la Sección Sindical de
          UGT en el Centro de Lenguas Modernas de la Universidad de Granada. Usarla no implica estar afiliado y no se
          registra la afiliación de nadie.
        </p>
        <p>
          No anotes datos personales de terceras personas (por ejemplo, nombres de usuarios o pacientes): basta con una
          referencia que tú entiendas.
        </p>
        <p>
          <strong>No sustituye al registro de jornada de la empresa.</strong> El artículo 34.9 del Estatuto de los
          Trabajadores obliga a la empresa a llevar un registro diario de jornada, conservarlo cuatro años y tenerlo a
          disposición de las personas trabajadoras, de su representación legal y de la Inspección de Trabajo. Este
          registro personal es un medio de prueba propio que se puede aportar junto a aquel o frente a él.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Por qué sirve como prueba</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Las anotaciones no se pueden modificar ni borrar. Una corrección o una anulación es una anotación nueva que remite a la original, y las dos constan.</li>
          <li>Cada anotación lleva la huella digital (SHA-256) de la anterior: si se tocara una, la cadena dejaría de cuadrar y se notaría.</li>
          <li>Cada anotación se sella con una autoridad externa de sellado de tiempo (RFC 3161). El sello prueba que la anotación existía en esa fecha y nadie, tampoco quien administra la aplicación, puede cambiarlo después.</li>
          <li>Se distingue lo fichado en el momento (con el botón, a la hora del servidor) de lo apuntado después. Lo primero pesa más.</li>
          <li>Los informes señalan indicios de posibles incumplimientos de los límites del Estatuto (más de 9 h de trabajo efectivo al día, más de 6 h seguidas sin pausa, menos de 12 h de descanso entre jornadas), para revisarlos con el convenio aplicable.</li>
          <li>El paquete de evidencias permite comprobarlo todo con herramientas abiertas, sin depender de esta aplicación.</li>
        </ul>
        <p>
          Por ahora el sello lo pone FreeTSA, una autoridad gratuita que <strong>no es cualificada</strong>. Un sello
          cualificado según el Reglamento eIDAS (UE 910/2014, art. 41) tiene además presunción legal de exactitud de la
          fecha. La herramienta está preparada para cambiar a una autoridad cualificada.
        </p>
        <p>
          En un procedimiento, quien juzga valora libremente la prueba. Consejos: ficha en el momento siempre que puedas,
          descarga cada mes el PDF y el paquete de evidencias y guárdalos fuera de la aplicación.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Privacidad</h2>
        <p><strong>Responsable:</strong> Sección Sindical de UGT en el Centro de Lenguas Modernas de la Universidad de Granada. [Dirección y CIF de UGT por completar] · Contacto: [correo de la sección].</p>
        <p><strong>Datos:</strong> tu correo, tu nombre, tu DNI/NIE si decides ponerlo, tu horario asignado y lo que anotes.</p>
        <p><strong>Para qué:</strong> solo para que lleves tu registro y obtengas tus informes. Base jurídica: tu consentimiento al darte de alta (art. 6.1.a RGPD), que puedes retirar en cualquier momento borrando tu cuenta.</p>
        <p>
          <strong>Quién lo ve:</strong> solo tú. La sección sindical no consulta los registros de nadie: si quieres que te
          ayude, eres tú quien le entrega tus informes. Las personas que mantienen técnicamente la aplicación podrían
          acceder a la base de datos, con deber de confidencialidad, y no pueden alterar el registro sin que se note.
        </p>
        <p>
          <strong>Proveedores:</strong> Vercel (alojamiento), Neon (base de datos), Brevo (envío del correo de acceso) y la
          autoridad de sellado, que solo recibe la huella de cada anotación, nunca su contenido.
        </p>
        <p>
          <strong>Tus derechos:</strong> acceso, rectificación, supresión, oposición, limitación y portabilidad, escribiendo
          al contacto de arriba. Puedes borrar tu cuenta y todo tu registro desde Ajustes. También puedes reclamar ante la
          Agencia Española de Protección de Datos (aepd.es).
        </p>
      </section>

      <p>
        <Link to="/" className="text-ugt underline">Volver</Link>
      </p>
    </div>
  );
}
