let debounceTimer = null;

function mostrarToast(msg) {
    const toast = document.getElementById("toast_cierre");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 2200);
}

function fmtFecha(valor) {
    if (!valor) return "-";
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("es-CL");
}

async function cargarProyectosFiltro() {
    try {
        const res = await fetch("/api/proyectos");
        if (!res.ok) throw new Error("Error al cargar proyectos");
        const data = await res.json();

        const select = document.getElementById("filtro_proyecto");
        if (!select) return;

        select.innerHTML = '<option value="">Todos los proyectos</option>';
        data.forEach(p => {
            select.innerHTML += `<option value="${p.id_proyecto}">${p.nombre_proyecto}</option>`;
        });
    } catch (error) {
        console.error(error);
    }
}

function renderTablaPendientes(rows) {
    const tbody = document.getElementById("tbody_pendientes");
    const resumen = document.getElementById("resumen_resultados");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (resumen) resumen.textContent = `${rows.length} pendiente${rows.length === 1 ? "" : "s"}`;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="10">No hay familias pendientes de fecha firma de acta.</td></tr>`;
        return;
    }

    rows.forEach((r, idx) => {
        const filaPar = idx % 2 === 0;
        const trDatos = document.createElement("tr");
        trDatos.className = `fila-registro-datos ${filaPar ? "par" : "impar"}`;
        trDatos.innerHTML = `
            <td>${r.nombre_proyecto || "-"}</td>
            <td>${r.numero_identificador || "-"}</td>
            <td>#${r.id_postventa ?? "-"}</td>
            <td>${r.cliente || "-"}</td>
            <td>${r.familia || "-"}</td>
            <td>${r.subfamilia || "-"}</td>
            <td>${r.recinto || "-"}</td>
            <td>${r.responsable || "-"}</td>
            <td>${r.origen || "-"}</td>
            <td>${fmtFecha(r.fecha_levantamiento)}</td>
        `;
        tbody.appendChild(trDatos);

        const trAccion = document.createElement("tr");
        trAccion.className = `fila-registro-accion ${filaPar ? "par" : "impar"}`;
        trAccion.innerHTML = `
            <td colspan="10">
                <div class="accion-firma-wrap">
                    <span class="accion-label">Fecha firma de acta</span>
                    <input type="date" class="input-firma-acta" id="firma_${r.id_registro}">
                    <button type="button" class="btn-hoy-firma" data-id="${r.id_registro}">Hoy</button>
                    <button type="button" class="btn-guardar-firma" data-id="${r.id_registro}">Guardar cierre</button>
                </div>
            </td>
        `;
        tbody.appendChild(trAccion);
    });
}

async function guardarFirmaActa(idRegistro) {
    const input = document.getElementById(`firma_${idRegistro}`);
    const fecha = input?.value || "";

    if (!fecha) {
        alert("Debes seleccionar la fecha firma de acta.");
        return;
    }

    try {
        const res = await fetch(`/api/cierre-actas/${idRegistro}/firma-acta`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fecha_firma_acta: fecha })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo actualizar");

        mostrarToast("Cierre de acta guardado correctamente");
        await cargarPendientesCierre();
    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
    }
}

async function cargarPendientesCierre() {
    const proyecto = document.getElementById("filtro_proyecto")?.value || "";
    const q = document.getElementById("filtro_busqueda")?.value?.trim() || "";

    const params = new URLSearchParams();
    if (proyecto) params.set("id_proyecto", proyecto);
    if (q) params.set("q", q);

    try {
        const res = await fetch(`/api/cierre-actas/pendientes?${params.toString()}`);
        if (!res.ok) throw new Error("Error al cargar pendientes");
        const data = await res.json();
        renderTablaPendientes(data);
    } catch (error) {
        console.error(error);
        renderTablaPendientes([]);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await cargarProyectosFiltro();
    await cargarPendientesCierre();

    const filtroProyecto = document.getElementById("filtro_proyecto");
    const filtroBusqueda = document.getElementById("filtro_busqueda");

    if (filtroProyecto) {
        filtroProyecto.addEventListener("change", cargarPendientesCierre);
    }

    if (filtroBusqueda) {
        filtroBusqueda.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(cargarPendientesCierre, 280);
        });
    }

    document.addEventListener("click", async (e) => {
        const btnHoy = e.target.closest(".btn-hoy-firma");
        if (btnHoy) {
            const id = btnHoy.dataset.id;
            const input = document.getElementById(`firma_${id}`);
            if (input) input.value = new Date().toISOString().split("T")[0];
            return;
        }

        const btnGuardar = e.target.closest(".btn-guardar-firma");
        if (btnGuardar) {
            await guardarFirmaActa(btnGuardar.dataset.id);
        }
    });
});
