let debounceTimer = null;

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

    rows.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
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
        tbody.appendChild(tr);
    });
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
});

