// =====================================================
// ESTADO GLOBAL
// =====================================================
let postventaActiva = null;
let listaEjecutantes = [];
let historialFamilias = [];

function animarValorKpi(elemento, valorObjetivo, decimales = 0) {
    if (!elemento) return;

    const objetivo = Number(valorObjetivo || 0);
    const inicio = Number(elemento.dataset.valorActual || 0);
    const duracion = 700;
    const tiempoInicio = performance.now();

    function paso(tiempoActual) {
        const progreso = Math.min((tiempoActual - tiempoInicio) / duracion, 1);
        const eased = 1 - Math.pow(1 - progreso, 3);
        const valor = inicio + (objetivo - inicio) * eased;
        elemento.textContent = formatearNumero(valor, decimales);

        if (progreso < 1) {
            requestAnimationFrame(paso);
        } else {
            elemento.dataset.valorActual = String(objetivo);
            elemento.classList.add("kpi-updated");
            setTimeout(() => elemento.classList.remove("kpi-updated"), 420);
        }
    }

    requestAnimationFrame(paso);
}

function formatearNumero(valor, decimales = 0) {
    const n = Number(valor || 0);
    return n.toLocaleString("es-CL", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
    });
}

async function cargarIndicadoresPostventa() {
    try {
        const res = await fetch("/api/indicadores-postventa");
        if (!res.ok) throw new Error("No se pudieron cargar indicadores");

        const data = await res.json();

        const elCasas = document.getElementById("kpi_total_casas");
        const elFamilias = document.getElementById("kpi_total_familias");
        const elPromFamiliasCasa = document.getElementById("kpi_prom_familias_casa");
        const elPromTareasFamilia = document.getElementById("kpi_prom_tareas_familia");

        animarValorKpi(elCasas, data.total_casas_con_pv, 0);
        animarValorKpi(elFamilias, data.total_familias_acumuladas, 0);
        animarValorKpi(elPromFamiliasCasa, data.promedio_familias_por_casa, 2);
        animarValorKpi(elPromTareasFamilia, data.promedio_tareas_por_familia, 2);
    } catch (error) {
        console.error("Error cargando indicadores:", error);
    }
}

function renderizarFechaEncabezado() {
    const el = document.getElementById("app_fecha");
    if (!el) return;

    const hoy = new Date();
    el.textContent = hoy.toLocaleDateString("es-CL", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

function actualizarIndicadoresFlujo() {
    const chipInmueble = document.getElementById("chip_inmueble");
    const chipPostventa = document.getElementById("chip_postventa");
    const chipFamilias = document.getElementById("chip_familias");
    if (!chipInmueble || !chipPostventa || !chipFamilias) return;

    const inmuebleCompleto = Boolean(
        document.getElementById("id_proyecto")?.value &&
        document.getElementById("id_inmueble")?.value &&
        document.getElementById("estado_inmueble")?.value
    );
    const postventaCompleta = Boolean(postventaActiva);
    const familiasCompleto = historialFamilias.length > 0;

    chipInmueble.classList.toggle("completado", inmuebleCompleto);
    chipInmueble.classList.toggle("pendiente", !inmuebleCompleto);

    chipPostventa.classList.toggle("completado", postventaCompleta);
    chipPostventa.classList.toggle("pendiente", !postventaCompleta);

    chipFamilias.classList.toggle("completado", familiasCompleto);
    chipFamilias.classList.toggle("pendiente", !familiasCompleto);
}

function mostrarAnclajePostventa() {
    const banner = document.getElementById("banner_anclaje");
    if (!banner || !postventaActiva) return;

    const proyecto = document.getElementById("id_proyecto")?.selectedOptions?.[0]?.text || "-";
    const identificador = document.getElementById("id_inmueble")?.selectedOptions?.[0]?.text || "-";
    const cliente = document.getElementById("nombre_cliente")?.value?.trim() || "-";
    const estado = document.getElementById("estado_ticket")?.value || "-";

    banner.innerHTML = `
        <div class="anclaje-card">
            <strong>Postventa activa #${postventaActiva}</strong><br>
            <small>Proyecto: ${proyecto} | Identificador: ${identificador} | Cliente: ${cliente} | Estado: ${estado}</small>
        </div>
    `;
    banner.hidden = false;
}

function limpiarAnclajePostventa() {
    const banner = document.getElementById("banner_anclaje");
    if (!banner) return;
    banner.hidden = true;
    banner.innerHTML = "";
}

function actualizarColorEtiquetaAccion() {
    const select = document.getElementById("etiqueta_accion");
    if (!select) return;

    select.classList.remove("etiqueta-aplica", "etiqueta-no-aplica");

    if (select.value === "APLICA") {
        select.classList.add("etiqueta-aplica");
    } else if (select.value === "NO APLICA") {
        select.classList.add("etiqueta-no-aplica");
    }
}

function renderizarUltimosRegistros() {
    const tbody = document.getElementById("tbody-registros");
    const chips = document.getElementById("lista_recientes_chips");
    if (!tbody) return;

    const ultimosCinco = historialFamilias.slice(0, 5);
    tbody.innerHTML = "";

    if (ultimosCinco.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">Sin registros recientes.</td></tr>`;
        if (chips) chips.innerHTML = '<span class="sin-registros">Esperando primer registro...</span>';
        return;
    }

    ultimosCinco.forEach(item => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td>${item.familia}</td>
            <td>${item.subfamilia}</td>
            <td>${item.recinto}</td>
            <td>${item.levantamiento}</td>
            <td>${item.responsable}</td>
        `;
        tbody.appendChild(fila);
    });

    if (chips) {
        chips.innerHTML = ultimosCinco
            .map(item => `<span class="chip-reciente">${item.familia} - ${item.recinto}</span>`)
            .join("");
    }
}


// =====================================================
// INICIO
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    cargarProyectos();
    cargarFamilias();
    cargarResponsables();
    cargarEjecutantes();
    activarBotonNuevaPostventa();
    renderizarUltimosRegistros();
    limpiarAnclajePostventa();
    actualizarColorEtiquetaAccion();
    actualizarIndicadoresFlujo();
    renderizarFechaEncabezado();
    cargarIndicadoresPostventa();

    ["id_proyecto", "id_inmueble", "estado_inmueble"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", actualizarIndicadoresFlujo);
    });
});
//------------------------------------CARGA DE DATOS------------------//
async function cargarProyectos() {
    try {
        const res = await fetch("/api/proyectos");
        const data = await res.json();

        const select = document.getElementById("id_proyecto");
        select.innerHTML = '<option value="">Seleccione proyecto...</option>';

        data.forEach(p => {
            select.innerHTML += `<option value="${p.id_proyecto}">${p.nombre_proyecto}</option>`;
        });

    } catch (error) {
        console.error("Error cargando proyectos:", error);
    }
}

//INMUEBLES//
async function cargarIdentificadores() {

    const id_proyecto = document.getElementById("id_proyecto").value;

    if (!id_proyecto) {
        actualizarIndicadoresFlujo();
        return;
    }

    const res = await fetch(`/api/proyectos/${id_proyecto}/inmuebles`);
    const data = await res.json();

    const select = document.getElementById("id_inmueble");
    select.innerHTML = '<option value="">Seleccione identificador...</option>';

    const ordenados = [...data].sort((a, b) =>
        String(a.numero_identificador).localeCompare(
            String(b.numero_identificador),
            "es",
            { numeric: true, sensitivity: "base" }
        )
    );

    ordenados.forEach(i => {
        select.innerHTML += `<option value="${i.id_inmueble}">${i.numero_identificador}</option>`;
    });
    actualizarIndicadoresFlujo();
}

//-- CARGAR DATOS DEL INMUEBLE--//
async function cargarDatosInmueble() {

    const id_inmueble = document.getElementById("id_inmueble").value;

    if (!id_inmueble) {
        actualizarIndicadoresFlujo();
        return;
    }

    const res = await fetch(`/api/inmuebles/detalle/${id_inmueble}`);
    const data = await res.json();

    document.getElementById("val-tipo").value = data.casa_o_depto || "";
    document.getElementById("val-modelo").value = data.modelo || "";
    document.getElementById("val-orientacion").value = data.orientacion || "";
    document.getElementById("val-fecha").value = data.fecha_entrega?.split("T")[0] || "";
    actualizarIndicadoresFlujo();
}

//-------CARGAR SUBFAMILIAS DINÃMICAMENTE-------//
async function cargarSubfamilias() {

    const id_familia = document.getElementById("select_familia").value;

    if (!id_familia) return;

    try {

        const res = await fetch(`/api/familias/${id_familia}/subfamilias`);

        if (!res.ok) {
            console.error("Error backend subfamilias");
            return;
        }

        const data = await res.json();

        const select = document.getElementById("select_subfamilia");

        select.innerHTML = '<option value="">Seleccione subfamilia...</option>';

        data.forEach(sf => {
            select.innerHTML += `
                <option value="${sf.id_subfamilia}">
                    ${sf.nombre_subfamilia}
                </option>
            `;
        });

    } catch (error) {
        console.error("Error cargando subfamilias:", error);
    }
}
// =====================================================
// CREAR POSTVENTA
// =====================================================
async function crearPostventa() {

    const id_inmueble = document.getElementById("id_inmueble").value;
    const nombre_cliente = document.getElementById("nombre_cliente").value.trim();
    const numero_contacto = document.getElementById("telefono_cliente").value.trim();
    const estado_ticket = document.getElementById("estado_ticket").value;

    if (!id_inmueble || !nombre_cliente) {
        alert("Complete los datos antes de crear la postventa");
        return;
    }

    const response = await fetch("/api/postventas/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id_inmueble,
            nombre_cliente,
            numero_contacto,
            estado_ticket
        })
    });

    const data = await response.json();

    if (!response.ok) {
        alert("Error al crear postventa");
        return;
    }

    postventaActiva = data.id_postventa;

    // ðŸ”“ Activar botÃ³n
    document.getElementById("btn_agregar_tabla").disabled = false;
    document.getElementById("icono_boton").className = "fas fa-plus";

    mostrarAnclajePostventa();
    actualizarIndicadoresFlujo();
    cargarIndicadoresPostventa();
}


// =====================================================
// NUEVA POSTVENTA
// =====================================================
function activarBotonNuevaPostventa() {
    const resetPostventa = () => {
            postventaActiva = null;
            historialFamilias = [];
            renderizarUltimosRegistros();
            limpiarAnclajePostventa();
            document.getElementById("btn_agregar_tabla").disabled = true;
            document.getElementById("icono_boton").className = "fas fa-lock";
            alert("Lista para crear nueva postventa");
            actualizarIndicadoresFlujo();
            cargarIndicadoresPostventa();
    };

    const botones = [
        document.getElementById("btn_nueva_postventa"),
        document.getElementById("btn_nueva_postventa_footer")
    ].filter(Boolean);

    botones.forEach(btn => btn.addEventListener("click", resetPostventa));
}


// =====================================================

// =====================================================
// CARGAR FAMILIAS
// =====================================================
async function cargarFamilias() {
    const res = await fetch("/api/familias");
    const data = await res.json();

    const select = document.getElementById("select_familia");
    select.innerHTML = '<option value="">Seleccione familia...</option>';

    data.forEach(f => {
        select.innerHTML += `<option value="${f.id_familia}">${f.nombre_familia}</option>`;
    });
}


// =====================================================
// CARGAR RESPONSABLES
// =====================================================
async function cargarResponsables() {
    const res = await fetch("/api/responsables");
    const data = await res.json();

    const select = document.getElementById("reg_responsable");
    select.innerHTML = '<option value="">Seleccione responsable...</option>';

    data.forEach(r => {
        select.innerHTML += `<option value="${r.id_responsable}">${r.nombre_responsable}</option>`;
    });
}


// =====================================================
// CARGAR EJECUTANTES
// =====================================================
async function cargarEjecutantes() {
    const res = await fetch("/api/ejecutantes");
    listaEjecutantes = await res.json();

    const select = document.getElementById("input_sel_ejecutante");
    select.innerHTML = '<option value="" disabled selected>Seleccione para agregar...</option>';

    listaEjecutantes.forEach(e => {
        select.innerHTML += `<option value="${e.id_ejecutante}">${e.nombre_ejecutante}</option>`;
    });
}


// =====================================================
// AGREGAR FILA EJECUTANTE
// =====================================================
function confirmarNuevaFila() {

    const id_ejecutante = document.getElementById("input_sel_ejecutante").value;
    const nombre = document.getElementById("input_sel_ejecutante").selectedOptions[0].text;
    const inicio = document.getElementById("input_f_inicio").value;
    const termino = document.getElementById("input_f_termino").value;
    const tarea = document.getElementById("input_f_tarea").value;

    if (!id_ejecutante || !tarea) {
        alert("Complete ejecutante y tarea");
        return;
    }

    const tbody = document.getElementById("body_ejecutantes");

    const fila = document.createElement("tr");
    fila.classList.add("fila-tarea");

    fila.innerHTML = `
        <td data-id="${id_ejecutante}">${nombre}</td>
        <td>${inicio}</td>
        <td>${termino}</td>
        <td>${tarea}</td>
        <td><button onclick="this.parentElement.parentElement.remove()">X</button></td>
    `;

    tbody.appendChild(fila);

    document.getElementById("input_f_tarea").value = "";
}


// =====================================================
// GUARDAR FAMILIA COMPLETA
async function guardarFamiliaCompleta() {
    // 1. Validar que exista una postventa activa
    if (!postventaActiva) {
        alert("Error: No hay una Postventa anclada. Genere una primero.");
        return;
    }

    // 2. Recolectar datos (Asegurando que no vayan NULL a columnas obligatorias)
    const registro = {
        id_postventa: postventaActiva,
        id_familia: document.getElementById("select_familia").value,
        id_subfamilia: document.getElementById("select_subfamilia").value,
        id_responsable: document.getElementById("reg_responsable").value,
        origen: document.getElementById("reg_origen").value,
        etiqueta_accion: document.getElementById("etiqueta_accion").value,
        recinto: document.getElementById("reg_recinto").value,
        comentarios_previos: document.getElementById("reg_comentarios_cliente").value,
        fecha_firma_acta: document.getElementById("fecha_firma_acta").value || null,
        
        // CORRECCIÃ“N CLAVE: Usamos la fecha del acta o la de hoy 
        // para que 'fecha_levantamiento' nunca sea NULL y no rompa la DB
        fecha_levantamiento: document.getElementById("fecha_firma_acta").value || new Date().toISOString().split('T')[0],
        fecha_visita: document.getElementById("fecha_firma_acta").value || new Date().toISOString().split('T')[0]
    };

    if (!registro.etiqueta_accion) {
        alert("Debe seleccionar una Etiqueta Acción (APLICA / NO APLICA).");
        return;
    }

    // 3. Recolectar tareas
    const tareas = [];
    const filas = document.querySelectorAll(".fila-tarea");

    filas.forEach(fila => {
        const celdas = fila.children;
        tareas.push({
            id_ejecutante: celdas[0].dataset.id,
            inicio: celdas[1].innerText,
            termino: celdas[2].innerText,
            descripcion: celdas[3].innerText
        });
    });

    if (tareas.length === 0) {
        alert("Debe agregar al menos una tarea.");
        return;
    }

    try {
        const response = await fetch("/api/guardar-familia-completa", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ registro, tareas })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Error en el servidor");
        }

        // --- Ã‰XITO ---
        

        const familiaTxt = document.getElementById("select_familia").selectedOptions[0]?.text || "-";
        const subfamiliaTxt = document.getElementById("select_subfamilia").selectedOptions[0]?.text || "-";
        const responsableTxt = document.getElementById("reg_responsable").selectedOptions[0]?.text || "-";
        const recintoTxt = document.getElementById("reg_recinto").value || "-";
        const fechaLevTxt = registro.fecha_levantamiento || "-";

        historialFamilias.unshift({
            familia: familiaTxt,
            subfamilia: subfamiliaTxt,
            recinto: recintoTxt,
            levantamiento: fechaLevTxt,
            responsable: responsableTxt
        });
        renderizarUltimosRegistros();
        actualizarIndicadoresFlujo();
        cargarIndicadoresPostventa();
        // Mostrar alerta verde (Toast)
        const toast = document.getElementById('toast_familia');
        if (toast) {
            toast.classList.add('visible');
            setTimeout(() => toast.classList.remove('visible'), 3000);
        }

        // Limpiar campos de la secciÃ³n familia
        document.querySelectorAll('.input-familia').forEach(i => i.value = "");
        
        // Limpiar tabla de tareas
        const tabla = document.getElementById("body_ejecutantes");
        if (tabla) tabla.innerHTML = "";

        const selectEtiqueta = document.getElementById("etiqueta_accion");
        if (selectEtiqueta) {
            selectEtiqueta.value = "";
            actualizarColorEtiquetaAccion();
        }

        console.log("Guardado exitoso con ID:", data.id_registro);

    } catch (error) {
        console.error("Error al guardar:", error);
        alert("No se pudo guardar: " + error.message);
    }
}









