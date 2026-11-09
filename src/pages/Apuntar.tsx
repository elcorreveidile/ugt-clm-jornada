import { useState } from "react";
import { useNavigate } from "react-router";
import { addEntry } from "../api";
import ActivityForm from "../components/ActivityForm";
import { Notice } from "../components/Layout";

export default function Apuntar() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="card">
      <h1 className="mb-1 text-lg font-bold">Apuntar después</h1>
      <p className="mb-4 text-sm text-gray-600">Para lo que no pudiste fichar en el momento. Indica la fecha y las horas reales.</p>
      {error && <div className="mb-3"><Notice kind="error">{error}</Notice></div>}
      <ActivityForm
        mode="registro"
        busy={busy}
        onCancel={() => nav(-1)}
        onSubmit={async (input) => {
          setBusy(true);
          setError(null);
          try {
            await addEntry(input);
            nav("/historial");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}
