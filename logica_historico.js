function fmtFecha(valor) {
    if (!valor) return "-";
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("es-CL");
}

function setOptions(selectId, rows, mapLabel, mapValue) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const base = select.options[0] ? select.options[0].outerHTML : '<option value="">Todos</option>';
    select.innerHTML = base;
    rows.forEach(row => {
        const op = document.createElement("option");
        op.value = mapValue(row);
        op.textContent = mapLabel(row);
        select.appendChild(op);
    });
}

async function cargarFiltros() {
    const [proyectosRes, postventasRes, familiasRes, responsablesRes] = await Promise.all([
        fetch("/api/proyectos"),
        fetch("/api/historico/postventas"),
        fetch("/api/familias"),
        fetch("/api/responsables")
    ]);

    const [proyectos, postventas, familias, responsables] = await Promise.all([
        proyectosRes.json(),
        postventasRes.json(),
        familiasRes.json(),
        responsablesRes.json()
    ]);

    setOptions("filtro_proyecto", proyectos, p => p.nombre_proyecto, p => p.id_proyecto);
    setOptions("filtro_postventa", postventas, p => `#${p.id_postventa} - ${p.nombre_proyecto} - ${p.numero_identificador}`, p => p.id_postventa);
    setOptions("filtro_familia", familias, f => f.nombre_familia, f => f.id_familia);
    setOptions("filtro_responsable", responsables, r => r.nombre_responsable, r => r.id_responsable);
}

function obtenerFiltros() {
    return {
        id_proyecto: document.getElementById("filtro_proyecto")?.value || "",
        id_postventa: document.getElementById("filtro_postventa")?.value || "",
        id_familia: document.getElementById("filtro_familia")?.value || "",
        id_responsable: document.getElementById("filtro_responsable")?.value || "",
        fecha_desde: document.getElementById("filtro_desde")?.value || "",
        fecha_hasta: document.getElementById("filtro_hasta")?.value || "",
        q: document.getElementById("filtro_busqueda")?.value.trim() || ""
    };
}

function construirQuery(paramsObj) {
    const qs = new URLSearchParams();
    Object.entries(paramsObj).forEach(([k, v]) => {
        if (v !== "") qs.append(k, v);
    });
    return qs.toString();
}

function renderTabla(rows) {
    const tbody = document.getElementById("tbody_historico");
    const total = document.getElementById("total_resultados");
    if (!tbody) return;

    if (total) total.textContent = `${rows.length} resultados`;

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="14">Sin resultados para los filtros seleccionados.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(r => {
        const cargo = r.cargo_responsable ? `<span class="tag-cargo">${r.cargo_responsable}</span>` : "";
        return `
            <tr>
                <td>#${r.id_registro}</td>
                <td>#${r.id_postventa}</td>
                <td>${r.nombre_proyecto || "-"}</td>
                <td>${r.numero_identificador || "-"}</td>
                <td>${r.cliente || "-"}</td>
                <td>${r.familia || "-"}</td>
                <td>${r.subfamilia || "-"}</td>
                <td>${r.recinto || "-"}</td>
                <td>${r.responsable || "-"} ${cargo}</td>
                <td>${r.origen || "-"}</td>
                <td>${r.etiqueta_accion || "-"}</td>
                <td>${fmtFecha(r.fecha_levantamiento)}</td>
                <td>${fmtFecha(r.fecha_visita)}</td>
                <td>${fmtFecha(r.fecha_firma_acta)}</td>
            </tr>
        `;
    }).join("");
}

async function buscarHistorico() {
    const filtros = obtenerFiltros();
    const query = construirQuery(filtros);
    const url = query ? `/api/historico/registros?${query}` : "/api/historico/registros";
    const res = await fetch(url);
    if (!res.ok) throw new Error("No se pudo cargar el histórico");
    const data = await res.json();
    renderTabla(data);
}

function limpiarFiltros() {
    const ids = [
        "filtro_proyecto",
        "filtro_postventa",
        "filtro_familia",
        "filtro_responsable",
        "filtro_desde",
        "filtro_hasta",
        "filtro_busqueda"
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await cargarFiltros();
        await buscarHistorico();
    } catch (error) {
        console.error("Error inicializando histórico:", error);
        const tbody = document.getElementById("tbody_historico");
        if (tbody) tbody.innerHTML = '<tr><td colspan="14">No se pudieron cargar datos del histórico.</td></tr>';
    }

    const btnBuscar = document.getElementById("btn_buscar");
    if (btnBuscar) btnBuscar.addEventListener("click", buscarHistorico);

    const btnLimpiar = document.getElementById("btn_limpiar");
    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", async () => {
            limpiarFiltros();
            await buscarHistorico();
        });
    }

    ["filtro_proyecto", "filtro_postventa", "filtro_familia", "filtro_responsable", "filtro_desde", "filtro_hasta"]
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("change", buscarHistorico);
        });

    const buscador = document.getElementById("filtro_busqueda");
    if (buscador) {
        buscador.addEventListener("keydown", async (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                await buscarHistorico();
            }
        });
    }
});
