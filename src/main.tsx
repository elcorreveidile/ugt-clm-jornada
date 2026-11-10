import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";
import Layout from "./components/Layout";
import Hoy from "./pages/Hoy";
import Apuntar from "./pages/Apuntar";
import Historial from "./pages/Historial";
import Horario from "./pages/Horario";
import Exportar from "./pages/Exportar";
import Ajustes from "./pages/Ajustes";
import Entrar from "./pages/Entrar";
import Verificar from "./pages/Verificar";
import Aviso from "./pages/Aviso";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/verificar" element={<Verificar />} />
        <Route path="/aviso" element={<Aviso />} />
        <Route element={<Layout />}>
          <Route index element={<Hoy />} />
          <Route path="/apuntar" element={<Apuntar />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/horario" element={<Horario />} />
          <Route path="/exportar" element={<Exportar />} />
          <Route path="/ajustes" element={<Ajustes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
