// =====================================================
// ESTADO GLOBAL
// =====================================================
let postventaActiva = null;
let listaEjecutantes = [];
let historialFamilias = [];
let modoGestionRegistros = false;
const STORAGE_KEY_TEMA = "app_postventa_tema";
let flashCrearPostventaTimeout = null;
let toastPostventaTimeout = null;
let toastFamiliaTimeout = null;
const calendarioIntegradoState = {
    fechaBase: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    tareasMes: []
};

function aplicarTema(tema) {
    const body = document.body;
    const boton = document.getElementById("theme_toggle");
    if (!body || !boton) return;

    const esOscuro = tema === "dark";
    body.classList.toggle("dark-mode", esOscuro);
    boton.innerHTML = esOscuro
        ? '<i class="fas fa-sun" aria-hidden="true"></i>'
        : '<i class="fas fa-moon" aria-hidden="true"></i>';
    boton.setAttribute("title", esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    boton.setAttribute("aria-label", esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
}

function inicializarTema() {
    const boton = document.getElementById("theme_toggle");
    if (!boton) return;

    const guardado = localStorage.getItem(STORAGE_KEY_TEMA);
    const prefiereOscuro = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const temaInicial = guardado || (prefiereOscuro ? "dark" : "light");
    aplicarTema(temaInicial);

    boton.addEventListener("click", () => {
        const actualOscuro = document.body.classList.contains("dark-mode");
        const nuevoTema = actualOscuro ? "light" : "dark";
        localStorage.setItem(STORAGE_KEY_TEMA, nuevoTema);
        aplicarTema(nuevoTema);
    });
}

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

function formatearFechaCorta(valor) {
    if (!valor) return "-";
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("es-CL");
}

function actualizarEstadoPostventaSeleccionada(texto) {
    const el = document.getElementById("estado_postventa_seleccionada");
    if (!el) return;
    el.textContent = texto || "Ninguna";
    actualizarEstadoPostventaEnModulos(texto || "Ninguna");
}

function actualizarDetalleSeleccionada({ estado = "-", familias = 0 } = {}) {
    const estadoEl = document.getElementById("estado_ticket_seleccionada");
    const familiasEl = document.getElementById("familias_seleccionadas_count");
    if (estadoEl) estadoEl.textContent = `Estado: ${estado || "-"}`;
    if (familiasEl) familiasEl.textContent = `Familias: ${Number(familias || 0)}`;
}

function actualizarEstadoPostventaEnModulos(textoEstado) {
    const ids = ["estado_modulo_inmueble", "estado_modulo_postventa", "estado_modulo_familia"];
    const sinSeleccion = !textoEstado || textoEstado === "Ninguna";
    const texto = sinSeleccion
        ? "No hay postventa seleccionada"
        : `Postventa activa: ${textoEstado}`;

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = texto;
        el.classList.toggle("estado-postventa-modulo--sin", sinSeleccion);
        el.classList.toggle("estado-postventa-modulo--ok", !sinSeleccion);
    });
}

function actualizarEstadoPanelGestion(textoEstado) {
    const el = document.getElementById("estado_panel_gestion");
    if (!el) return;
    const sinSeleccion = !textoEstado || textoEstado === "Ninguna";
    el.textContent = sinSeleccion ? "No hay postventa seleccionada" : `Postventa activa: ${textoEstado}`;
    el.classList.toggle("estado-postventa-modulo--sin", sinSeleccion);
    el.classList.toggle("estado-postventa-modulo--ok", !sinSeleccion);
}

function construirTextoEstadoPostventa(option, idPostventa) {
    if (!option || !idPostventa) return "Ninguna";
    const proyecto = option.dataset.proyecto || "-";
    const identificador = option.dataset.identificador || "-";
    return `#${idPostventa} · ${proyecto} · ${identificador}`;
}

function renderizarGestionVacia(texto = "Seleccione una postventa para gestionar registros.") {
    const tbody = document.getElementById("tbody_gestion_registros");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7">${texto}</td></tr>`;
}

async function cargarRegistrosGestionPostventa(idPostventa) {
    const tbody = document.getElementById("tbody_gestion_registros");
    const btnEliminarPostventa = document.getElementById("btn_eliminar_postventa");
    if (!tbody) return;

    if (!idPostventa) {
        renderizarGestionVacia();
        if (btnEliminarPostventa) btnEliminarPostventa.disabled = true;
        return;
    }

    try {
        const res = await fetch(`/api/postventas/${idPostventa}/registros`);
        if (!res.ok) throw new Error("No se pudieron cargar los registros");
        const data = await res.json();

        if (btnEliminarPostventa) btnEliminarPostventa.disabled = false;

        if (!data.length) {
            renderizarGestionVacia("Esta postventa no tiene familias registradas.");
            return;
        }

        tbody.innerHTML = data.map(item => {
            const fecha = item.fecha_levantamiento ? String(item.fecha_levantamiento).split("T")[0] : "-";
            return `
                <tr>
                    <td>#${item.id_registro}</td>
                    <td>${item.familia || "-"}</td>
                    <td>${item.subfamilia || "-"}</td>
                    <td>${item.recinto || "-"}</td>
                    <td>${fecha}</td>
                    <td>${item.responsable || "-"}</td>
                    <td>
                        <button type="button" class="btn-eliminar-familia" data-id-registro="${item.id_registro}">
                            Eliminar familia
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        tbody.querySelectorAll(".btn-eliminar-familia").forEach(btn => {
            btn.addEventListener("click", async () => {
                const idRegistro = btn.dataset.idRegistro;
                if (!idRegistro) return;
                const confirma = confirm(`¿Eliminar el registro de familia #${idRegistro}? Esta acción no se puede deshacer.`);
                if (!confirma) return;

                try {
                    const delRes = await fetch(`/api/registros-familia/${idRegistro}`, { method: "DELETE" });
                    const delData = await delRes.json();
                    if (!delRes.ok) throw new Error(delData.error || "No se pudo eliminar la familia");

                    await cargarFamiliasRecientesDePostventa(postventaActiva);
                    await cargarRegistrosGestionPostventa(postventaActiva);
                    const detalle = await cargarDetallePostventaSeleccionada(postventaActiva);
                    actualizarDetalleSeleccionada({
                        estado: detalle?.estado_ticket || "-",
                        familias: detalle?.total_familias || historialFamilias.length
                    });
                    await cargarPostventasRecientes(postventaActiva, false);
                    cargarIndicadoresPostventa();
                    actualizarIndicadoresFlujo();
                    cargarTareasCalendarioIntegrado();
                } catch (error) {
                    console.error("Error eliminando familia:", error);
                    alert(error.message || "No se pudo eliminar la familia.");
                }
            });
        });
    } catch (error) {
        console.error("Error cargando gestión de registros:", error);
        renderizarGestionVacia("No se pudieron cargar los registros de esta postventa.");
        if (btnEliminarPostventa) btnEliminarPostventa.disabled = true;
    }
}

function alternarPanelGestionRegistros() {
    setModoGestionRegistros(!modoGestionRegistros);
}

function setModoGestionRegistros(activo) {
    modoGestionRegistros = Boolean(activo);

    const panel = document.getElementById("panel_gestion_registros");
    const modulos = [
        document.getElementById("modulo_identificacion_inmueble"),
        document.getElementById("modulo_datos_postventa"),
        document.getElementById("modulo_registro_familia"),
        document.getElementById("modulo_resumen_postventa")
    ];
    const btnGestion = document.getElementById("btn_gestion_registros");

    if (panel) panel.hidden = !modoGestionRegistros;
    modulos.forEach(m => { if (m) m.hidden = modoGestionRegistros; });

    if (btnGestion) {
        btnGestion.classList.toggle("activo", modoGestionRegistros);
        btnGestion.innerHTML = modoGestionRegistros
            ? '<i class="fas fa-clipboard-list"></i> Gestión de registros (activa)'
            : '<i class="fas fa-clipboard-list"></i> Gestión de registros';
    }

    if (modoGestionRegistros && panel) {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

async function eliminarPostventaActiva() {
    if (!postventaActiva) {
        alert("No hay una postventa seleccionada.");
        return;
    }

    const confirma = confirm(`¿Eliminar la postventa #${postventaActiva} completa? Se eliminarán todas sus familias y tareas.`);
    if (!confirma) return;

    try {
        const res = await fetch(`/api/postventas/${postventaActiva}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo eliminar la postventa.");

        postventaActiva = null;
        historialFamilias = [];
        resetearFormularioPostventa();
        bloquearCamposCabecera(false);
        renderizarUltimosRegistros();
        limpiarAnclajePostventa();
        actualizarEstadoPanelGestion("Ninguna");
        renderizarGestionVacia();
        const selectPostventa = document.getElementById("select_postventa_existente");
        if (selectPostventa) selectPostventa.value = "";
        const btnEliminarPostventa = document.getElementById("btn_eliminar_postventa");
        if (btnEliminarPostventa) btnEliminarPostventa.disabled = true;
        document.getElementById("btn_agregar_tabla").disabled = true;
        document.getElementById("icono_boton").className = "fas fa-lock";

        await cargarPostventasRecientes();
        cargarIndicadoresPostventa();
        actualizarIndicadoresFlujo();
        cargarTareasCalendarioIntegrado();
        mostrarAlertaCentro("Postventa eliminada correctamente");
    } catch (error) {
        console.error("Error eliminando postventa:", error);
        alert(error.message || "No se pudo eliminar la postventa.");
    }
}

function setValorSeguroSelect(select, valor) {
    if (!select) return;
    const existe = Array.from(select.options).some(op => String(op.value) === String(valor));
    if (existe) {
        select.value = String(valor);
    }
}

function bloquearCamposCabecera(bloquear) {
    const ids = [
        "id_proyecto",
        "id_inmueble",
        "estado_inmueble",
        "estado_ticket",
        "nombre_cliente",
        "telefono_cliente"
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = bloquear;
    });

    const botonCrear = document.getElementById("btn_agregar_tabla");
    const icono = document.getElementById("icono_boton");
    if (!botonCrear || !icono) return;

    if (bloquear) {
        botonCrear.disabled = true;
        icono.className = "fas fa-lock";
    } else {
        botonCrear.disabled = false;
        icono.className = "fas fa-plus";
    }
}

async function cargarDetallePostventaSeleccionada(idPostventa) {
    const res = await fetch(`/api/postventas/${idPostventa}/detalle`);
    if (!res.ok) throw new Error("No se pudo cargar el detalle de la postventa");
    const detalle = await res.json();

    const proyecto = document.getElementById("id_proyecto");
    const inmueble = document.getElementById("id_inmueble");
    const estadoTicket = document.getElementById("estado_ticket");
    const nombreCliente = document.getElementById("nombre_cliente");
    const telefono = document.getElementById("telefono_cliente");

    if (proyecto) {
        proyecto.value = String(detalle.id_proyecto || "");
        await cargarIdentificadores();
    }

    setValorSeguroSelect(inmueble, detalle.id_inmueble);
    await cargarDatosInmueble();
    setValorSeguroSelect(estadoTicket, detalle.estado_ticket);
    if (nombreCliente) nombreCliente.value = detalle.cliente || "";
    if (telefono) telefono.value = detalle.numero_contacto || "";

    return detalle;
}

async function cargarFamiliasRecientesDePostventa(idPostventa) {
    const res = await fetch(`/api/postventas/${idPostventa}/familias-recientes?limit=5`);
    if (!res.ok) throw new Error("No se pudieron cargar los registros recientes");
    const data = await res.json();

    historialFamilias = data.map(item => ({
        id_registro: item.id_registro,
        familia: item.familia || "-",
        subfamilia: item.subfamilia || "-",
        recinto: item.recinto || "-",
        levantamiento: item.levantamiento ? String(item.levantamiento).split("T")[0] : "-",
        responsable: item.responsable || "-",
        cargo_responsable: item.cargo_responsable || "",
        estado_tarea: item.estado_tarea || "Pendiente"
    }));
    renderizarUltimosRegistros();
}

function normalizarEstadoTarea(valor) {
    return (valor === "Finalizado" || valor === "Finalizada") ? "Finalizado" : "Pendiente";
}

function claseEstadoFila(estado) {
    return normalizarEstadoTarea(estado) === "Finalizado"
        ? "fila-estado-finalizada"
        : "fila-estado-pendiente";
}

async function actualizarEstadoTareaRegistro(idRegistro, estadoTarea) {
    if (!idRegistro) return;
    try {
        const res = await fetch(`/api/registros-familia/${idRegistro}/estado-tarea`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado_tarea: estadoTarea })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo actualizar el estado.");

        historialFamilias = historialFamilias.map(item => (
            Number(item.id_registro) === Number(idRegistro)
                ? { ...item, estado_tarea: estadoTarea }
                : item
        ));

        const estadoPostventa = data?.postventa?.estado || "Abierta";
        const totalFamilias = Number(data?.postventa?.total_familias || historialFamilias.length);
        const estadoTicket = document.getElementById("estado_ticket");
        if (estadoTicket) estadoTicket.value = estadoPostventa;
        actualizarDetalleSeleccionada({ estado: estadoPostventa, familias: totalFamilias });

        const selectPostventa = document.getElementById("select_postventa_existente");
        if (selectPostventa && postventaActiva) {
            const option = Array.from(selectPostventa.options).find(op => op.value === String(postventaActiva));
            if (option) option.dataset.estado = estadoPostventa;
        }

        renderizarUltimosRegistros();
        await cargarPostventasRecientes(postventaActiva, false);
    } catch (error) {
        console.error("Error actualizando estado_tarea:", error);
        alert(error.message || "No se pudo actualizar el estado de la tarea.");
    }
}

async function cargarPostventasRecientes(preseleccionarId = null, autoSeleccionar = true) {
    const select = document.getElementById("select_postventa_existente");
    if (!select) return;

    try {
        const res = await fetch("/api/postventas/recientes?dias=7");
        if (!res.ok) throw new Error("Error al cargar postventas recientes");
        const data = await res.json();

        select.innerHTML = '<option value="">-- Ninguna --</option>';
        data.forEach(item => {
            const option = document.createElement("option");
            option.value = String(item.id_postventa);
            option.dataset.proyecto = item.nombre_proyecto || "-";
            option.dataset.identificador = item.numero_identificador || "-";
            option.dataset.cliente = item.cliente || "-";
            option.dataset.estado = item.estado || "-";
            option.dataset.familias = String(item.total_familias || 0);
            option.textContent = `#${item.id_postventa} - ${item.nombre_proyecto} - ${item.numero_identificador} - Familias: ${item.total_familias || 0}`;
            select.appendChild(option);
        });

        const idObjetivo = preseleccionarId || postventaActiva;
        if (idObjetivo) {
            const existe = Array.from(select.options).some(op => op.value === String(idObjetivo));
            select.value = existe ? String(idObjetivo) : "";
        } else {
            select.value = "";
        }

        if (select.value && autoSeleccionar) {
            await seleccionarPostventaExistente();
        } else if (!postventaActiva) {
            actualizarEstadoPostventaSeleccionada("Ninguna");
        }
    } catch (error) {
        console.error("Error cargando postventas recientes:", error);
    }
}

async function seleccionarPostventaExistente() {
    const select = document.getElementById("select_postventa_existente");
    if (!select) return;

    const idSeleccionado = select.value;
    if (!idSeleccionado) {
        postventaActiva = null;
        historialFamilias = [];
        renderizarUltimosRegistros();
        renderizarGestionVacia();
        actualizarEstadoPanelGestion("Ninguna");
        const btnEliminarPostventa = document.getElementById("btn_eliminar_postventa");
        if (btnEliminarPostventa) btnEliminarPostventa.disabled = true;
        bloquearCamposCabecera(false);
        limpiarAnclajePostventa();
        actualizarIndicadoresFlujo();
        return;
    }

    postventaActiva = Number(idSeleccionado);
    try {
        const detalle = await cargarDetallePostventaSeleccionada(postventaActiva);
        await cargarFamiliasRecientesDePostventa(postventaActiva);
        await cargarRegistrosGestionPostventa(postventaActiva);
        bloquearCamposCabecera(true);

        const option = select.selectedOptions[0];
        mostrarAnclajePostventa({
            proyecto: detalle?.nombre_proyecto || option?.dataset.proyecto || "-",
            identificador: detalle?.numero_identificador || option?.dataset.identificador || "-",
            cliente: detalle?.cliente || option?.dataset.cliente || "-",
            estado: detalle?.estado_ticket || option?.dataset.estado || "-",
            familias: detalle?.total_familias || 0
        });
        actualizarEstadoPostventaSeleccionada(construirTextoEstadoPostventa(option, postventaActiva));
        actualizarEstadoPanelGestion(construirTextoEstadoPostventa(option, postventaActiva));
        actualizarDetalleSeleccionada({
            estado: detalle?.estado_ticket || option?.dataset.estado || "-",
            familias: detalle?.total_familias || historialFamilias.length
        });
        actualizarIndicadoresFlujo();
    } catch (error) {
        console.error("Error seleccionando postventa existente:", error);
        alert("No se pudo cargar la postventa seleccionada.");
    }
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

function mostrarAnclajePostventa(detalle = null) {
    const banner = document.getElementById("banner_anclaje");
    if (!postventaActiva) return;

    const proyecto = detalle?.proyecto ?? document.getElementById("id_proyecto")?.selectedOptions?.[0]?.text ?? "-";
    const identificador = detalle?.identificador ?? document.getElementById("id_inmueble")?.selectedOptions?.[0]?.text ?? "-";
    const cliente = detalle?.cliente ?? document.getElementById("nombre_cliente")?.value?.trim() ?? "-";
    const estado = detalle?.estado ?? document.getElementById("estado_ticket")?.value ?? "-";
    const familias = Number(detalle?.familias ?? historialFamilias.length ?? 0);

    if (banner) {
        banner.innerHTML = "";
        banner.hidden = true;
    }

    actualizarEstadoPostventaSeleccionada(`#${postventaActiva} · ${proyecto} · ${identificador}`);
    actualizarDetalleSeleccionada({ estado, familias });
}

function limpiarAnclajePostventa() {
    const banner = document.getElementById("banner_anclaje");
    if (banner) {
        banner.innerHTML = "";
        banner.hidden = true;
    }
    actualizarEstadoPostventaSeleccionada("Ninguna");
    actualizarDetalleSeleccionada({ estado: "-", familias: 0 });
}

function mostrarAlertaCentro(texto) {
    const toast = document.getElementById("toast_reset_postventa");
    if (!toast) return;
    toast.textContent = texto;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 1900);
}

function flashBotonExito(boton, iconoEl, { iconoDurante = "fas fa-check", iconoDespues = null, ms = 1200 } = {}) {
    if (!boton) return;

    if (flashCrearPostventaTimeout) {
        clearTimeout(flashCrearPostventaTimeout);
        flashCrearPostventaTimeout = null;
    }

    boton.classList.remove("btn-flash-success");
    void boton.offsetWidth;
    boton.classList.add("btn-flash-success");

    if (iconoEl && iconoDurante) iconoEl.className = iconoDurante;

    flashCrearPostventaTimeout = setTimeout(() => {
        boton.classList.remove("btn-flash-success");
        if (iconoEl && iconoDespues) iconoEl.className = iconoDespues;
        flashCrearPostventaTimeout = null;
    }, ms);
}

function mostrarToast(idToast, texto, { ms = 2600 } = {}) {
    const toast = document.getElementById(idToast);
    if (!toast) return;

    const span = toast.querySelector("span");
    if (span) span.textContent = texto;

    toast.classList.remove("visible");
    void toast.offsetWidth;
    toast.classList.add("visible");

    return setTimeout(() => toast.classList.remove("visible"), ms);
}

function mostrarToastPostventaCreada(idPostventa) {
    if (toastPostventaTimeout) clearTimeout(toastPostventaTimeout);
    const texto = idPostventa ? `Postventa creada (#${idPostventa})` : "Postventa creada";
    toastPostventaTimeout = mostrarToast("toast_postventa", texto, { ms: 2600 });
}

function resetearFormularioPostventa() {
    const proyecto = document.getElementById("id_proyecto");
    const inmueble = document.getElementById("id_inmueble");
    const estadoInmueble = document.getElementById("estado_inmueble");
    const estadoTicket = document.getElementById("estado_ticket");
    const nombreCliente = document.getElementById("nombre_cliente");
    const telefono = document.getElementById("telefono_cliente");

    if (proyecto) proyecto.value = "";
    if (inmueble) inmueble.innerHTML = '<option value="">Seleccione proyecto...</option>';
    if (estadoInmueble) estadoInmueble.value = "";
    if (estadoTicket) estadoTicket.value = "";
    if (nombreCliente) nombreCliente.value = "";
    if (telefono) telefono.value = "";

    const valTipo = document.getElementById("val-tipo");
    const valModelo = document.getElementById("val-modelo");
    const valOrientacion = document.getElementById("val-orientacion");
    const valFecha = document.getElementById("val-fecha");
    if (valTipo) valTipo.value = "";
    if (valModelo) valModelo.value = "";
    if (valOrientacion) valOrientacion.value = "";
    if (valFecha) valFecha.value = "";

    const regOrigen = document.getElementById("reg_origen");
    const regFamilia = document.getElementById("select_familia");
    const regSubfamilia = document.getElementById("select_subfamilia");
    const regRecinto = document.getElementById("reg_recinto");
    const regComentario = document.getElementById("reg_comentarios_cliente");
    const regFLev = document.getElementById("reg_fecha_levantamiento");
    const regFVis = document.getElementById("reg_fecha_visita");
    const regResp = document.getElementById("reg_responsable");
    const regObs = document.getElementById("reg_observaciones_internas");
    const regFFirma = document.getElementById("fecha_firma_acta");
    const regEtiqueta = document.getElementById("etiqueta_accion");

    if (regOrigen) regOrigen.value = "";
    if (regFamilia) regFamilia.value = "";
    if (regSubfamilia) regSubfamilia.innerHTML = '<option value="">Seleccionar subfamilia...</option>';
    if (regRecinto) regRecinto.value = "";
    if (regComentario) regComentario.value = "";
    if (regFLev) regFLev.value = "";
    if (regFVis) regFVis.value = "";
    if (regResp) regResp.value = "";
    if (regObs) regObs.value = "";
    if (regFFirma) regFFirma.value = "";
    if (regEtiqueta) regEtiqueta.value = "";
    actualizarColorEtiquetaAccion();

    const tbodyTareas = document.getElementById("body_ejecutantes");
    if (tbodyTareas) tbodyTareas.innerHTML = "";

    const inpEjecutante = document.getElementById("input_sel_ejecutante");
    const inpInicio = document.getElementById("input_f_inicio");
    const inpTermino = document.getElementById("input_f_termino");
    const inpTarea = document.getElementById("input_f_tarea");
    if (inpEjecutante) inpEjecutante.value = "";
    if (inpInicio) inpInicio.value = "";
    if (inpTermino) inpTermino.value = "";
    if (inpTarea) inpTarea.value = "";
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
        tbody.innerHTML = `<tr><td colspan="6">Sin registros recientes.</td></tr>`;
        if (chips) {
            const textoVacio = postventaActiva
                ? "Sin familias registradas en esta postventa."
                : "Esperando primer registro...";
            chips.innerHTML = `<span class="sin-registros">${textoVacio}</span>`;
        }
        return;
    }

    ultimosCinco.forEach(item => {
        const fila = document.createElement("tr");
        fila.classList.add(claseEstadoFila(item.estado_tarea));
        const cargoResponsable = item.cargo_responsable
            ? `<span class="tag-cargo">${item.cargo_responsable}</span>`
            : "";
        const estadoActual = normalizarEstadoTarea(item.estado_tarea);
        fila.innerHTML = `
            <td>${item.familia}</td>
            <td>${item.subfamilia}</td>
            <td>${item.recinto}</td>
            <td>${item.levantamiento}</td>
            <td>
                <div class="responsable-con-etiqueta">
                    <span>${item.responsable}</span>
                    ${cargoResponsable}
                </div>
            </td>
            <td>
                <select class="select-estado-tarea" data-id-registro="${item.id_registro}">
                    <option value="Pendiente" ${estadoActual === "Pendiente" ? "selected" : ""}>Pendiente</option>
                    <option value="Finalizado" ${estadoActual === "Finalizado" ? "selected" : ""}>Finalizado</option>
                </select>
            </td>
        `;
        tbody.appendChild(fila);
    });

    tbody.querySelectorAll(".select-estado-tarea").forEach(select => {
        select.addEventListener("change", (event) => {
            const idRegistro = event.target.dataset.idRegistro;
            const estado = normalizarEstadoTarea(event.target.value);
            actualizarEstadoTareaRegistro(idRegistro, estado);
        });
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
    inicializarTema();
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
    cargarPostventasRecientes();
    inicializarCalendarioIntegrado();

    ["id_proyecto", "id_inmueble", "estado_inmueble"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", actualizarIndicadoresFlujo);
    });

    const selectPostventa = document.getElementById("select_postventa_existente");
    if (selectPostventa) {
        selectPostventa.addEventListener("change", seleccionarPostventaExistente);
    }

    const btnGestion = document.getElementById("btn_gestion_registros");
    if (btnGestion) btnGestion.addEventListener("click", alternarPanelGestionRegistros);

    const btnIrHistorico = document.getElementById("btn_ir_historico");
    if (btnIrHistorico) {
        btnIrHistorico.addEventListener("click", () => {
            window.location.href = "historico.html";
        });
    }

    const btnIrCalendario = document.getElementById("btn_ir_calendario");
    if (btnIrCalendario) {
        btnIrCalendario.addEventListener("click", () => {
            window.location.href = "calendario_tareas.html";
        });
    }

    const btnEliminarPostventa = document.getElementById("btn_eliminar_postventa");
    if (btnEliminarPostventa) btnEliminarPostventa.addEventListener("click", eliminarPostventaActiva);

    const btnGestionFamilias = document.getElementById("btn_gestion_familias");
    if (btnGestionFamilias) {
        btnGestionFamilias.addEventListener("click", () => {
            setModoGestionRegistros(false);
            const moduloFamilia = document.getElementById("modulo_registro_familia");
            if (moduloFamilia) moduloFamilia.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    actualizarEstadoPanelGestion("Ninguna");
    renderizarGestionVacia();
    setModoGestionRegistros(false);
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

    // Feedback UX: boton verde temporal + toast explicito.
    const botonCrear = document.getElementById("btn_agregar_tabla");
    const iconoBoton = document.getElementById("icono_boton");
    flashBotonExito(botonCrear, iconoBoton, { iconoDurante: "fas fa-check", iconoDespues: "fas fa-plus", ms: 1300 });
    mostrarToastPostventaCreada(postventaActiva);

    // Activar boton
    if (botonCrear) botonCrear.disabled = false;

    bloquearCamposCabecera(false);
    mostrarAnclajePostventa({ familias: 0 });
    actualizarIndicadoresFlujo();
    cargarIndicadoresPostventa();
    await cargarPostventasRecientes(postventaActiva, false);
    const select = document.getElementById("select_postventa_existente");
    const option = select?.selectedOptions?.[0];
    actualizarEstadoPostventaSeleccionada(construirTextoEstadoPostventa(option, postventaActiva));
    actualizarDetalleSeleccionada({
        estado: document.getElementById("estado_ticket")?.value || "-",
        familias: 0
    });
    actualizarEstadoPanelGestion(construirTextoEstadoPostventa(option, postventaActiva));
    await cargarRegistrosGestionPostventa(postventaActiva);
}


// =====================================================
// NUEVA POSTVENTA
// =====================================================
function activarBotonNuevaPostventa() {
    const resetPostventa = () => {
            postventaActiva = null;
            historialFamilias = [];
            resetearFormularioPostventa();
            bloquearCamposCabecera(false);
            renderizarUltimosRegistros();
            renderizarGestionVacia();
            actualizarEstadoPanelGestion("Ninguna");
            limpiarAnclajePostventa();
            const selectPostventa = document.getElementById("select_postventa_existente");
            if (selectPostventa) selectPostventa.value = "";
            const btnEliminarPostventa = document.getElementById("btn_eliminar_postventa");
            if (btnEliminarPostventa) btnEliminarPostventa.disabled = true;
            document.getElementById("btn_agregar_tabla").disabled = true;
            document.getElementById("icono_boton").className = "fas fa-lock";
            mostrarAlertaCentro("Formulario listo para nueva postventa");
            actualizarIndicadoresFlujo();
            cargarIndicadoresPostventa();
            cargarPostventasRecientes();
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
        const cargo = (r.cargo || "Sin cargo").trim();
        select.innerHTML += `
            <option value="${r.id_responsable}" data-cargo="${cargo}">
                ${r.nombre_responsable} - ${cargo}
            </option>
        `;
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
        const especialidad = (e.especialidad || "Sin especialidad").trim();
        select.innerHTML += `
            <option value="${e.id_ejecutante}" data-especialidad="${especialidad}">
                ${e.nombre_ejecutante} - ${especialidad}
            </option>
        `;
    });
}


// =====================================================
// AGREGAR FILA EJECUTANTE
// =====================================================
function confirmarNuevaFila() {

    const id_ejecutante = document.getElementById("input_sel_ejecutante").value;
    const ejecutanteOption = document.getElementById("input_sel_ejecutante").selectedOptions[0];
    const nombreCompleto = ejecutanteOption?.text || "";
    const nombre = nombreCompleto.split(" - ")[0] || nombreCompleto;
    const especialidad = ejecutanteOption?.dataset?.especialidad || "Sin especialidad";
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
        <td data-id="${id_ejecutante}">
            <div class="ejecutante-con-etiqueta">
                <span class="ejecutante-nombre">${nombre}</span>
                <span class="tag-especialidad">${especialidad}</span>
            </div>
        </td>
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
        const responsableOption = document.getElementById("reg_responsable").selectedOptions[0];
        const responsableCompleto = responsableOption?.text || "-";
        const responsableTxt = responsableCompleto.split(" - ")[0] || responsableCompleto;
        const cargoResponsableTxt = responsableOption?.dataset?.cargo || "";
        const recintoTxt = document.getElementById("reg_recinto").value || "-";
        const fechaLevTxt = registro.fecha_levantamiento || "-";

        historialFamilias.unshift({
            familia: familiaTxt,
            subfamilia: subfamiliaTxt,
            recinto: recintoTxt,
            levantamiento: fechaLevTxt,
            responsable: responsableTxt,
            cargo_responsable: cargoResponsableTxt
        });
        await cargarFamiliasRecientesDePostventa(postventaActiva);
        await cargarRegistrosGestionPostventa(postventaActiva);
        const detallePostventa = await cargarDetallePostventaSeleccionada(postventaActiva);
        actualizarDetalleSeleccionada({
            estado: detallePostventa?.estado_ticket || "-",
            familias: detallePostventa?.total_familias || historialFamilias.length
        });
        actualizarIndicadoresFlujo();
        cargarIndicadoresPostventa();
        cargarTareasCalendarioIntegrado();
        // Mostrar alerta verde (Toast)
        const btnGuardarFamilia = document.querySelector(".btn-guardar-familia");
        flashBotonExito(btnGuardarFamilia, btnGuardarFamilia?.querySelector("i"), {
            iconoDurante: "fas fa-check",
            iconoDespues: "fas fa-save",
            ms: 1300
        });

        if (toastFamiliaTimeout) clearTimeout(toastFamiliaTimeout);
        toastFamiliaTimeout = mostrarToast(
            "toast_familia",
            `Familia agregada: ${familiaTxt} · ${recintoTxt}`,
            { ms: 3000 }
        );

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

function calendarioIntegradoDisponible() {
    return Boolean(document.getElementById("cal_calendario_grid"));
}

function calFormatearMesAnio(fecha) {
    return fecha.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
}

function calFormatearDiaMes(valor) {
    if (!valor) return "-";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "-";
    return fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
}

function calNormalizarDia(fecha) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function calInicioVista(fechaMes) {
    const primerDia = new Date(fechaMes.getFullYear(), fechaMes.getMonth(), 1);
    const diaSemana = primerDia.getDay();
    const offsetLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicio = new Date(primerDia);
    inicio.setDate(primerDia.getDate() - offsetLunes);
    return inicio;
}

function calObtenerRango(tarea) {
    const inicio = tarea.fecha_inicio ? calNormalizarDia(new Date(tarea.fecha_inicio)) : null;
    const terminoBase = tarea.fecha_termino || tarea.fecha_inicio;
    const termino = terminoBase ? calNormalizarDia(new Date(terminoBase)) : null;
    return { inicio, termino };
}

function calTareaEnDia(tarea, dia) {
    const { inicio, termino } = calObtenerRango(tarea);
    if (!inicio || !termino) return false;
    return dia >= inicio && dia <= termino;
}

function calDiasEnMesDeTarea(tarea) {
    const { inicio, termino } = calObtenerRango(tarea);
    if (!inicio || !termino) return 0;

    const base = calendarioIntegradoState.fechaBase;
    const inicioMes = new Date(base.getFullYear(), base.getMonth(), 1);
    const finMes = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const inicioReal = inicio > inicioMes ? inicio : inicioMes;
    const finReal = termino < finMes ? termino : finMes;
    if (finReal < inicioReal) return 0;
    return Math.floor((finReal - inicioReal) / 86400000) + 1;
}

function renderizarTituloCalendarioIntegrado() {
    const el = document.getElementById("cal_titulo_mes");
    if (!el) return;
    el.textContent = calFormatearMesAnio(calendarioIntegradoState.fechaBase);
}

function renderizarResumenCalendarioIntegrado(tareas) {
    const contenedor = document.getElementById("cal_resumen_ejecutantes");
    if (!contenedor) return;

    if (!tareas.length) {
        contenedor.innerHTML = '<span class="cal-chip-vacio">Sin tareas para este per&iacute;odo</span>';
        return;
    }

    const map = new Map();
    tareas.forEach(tarea => {
        const key = String(tarea.id_ejecutante || "");
        if (!key) return;
        if (!map.has(key)) {
            map.set(key, {
                nombre: tarea.nombre_ejecutante || "Sin nombre",
                especialidad: tarea.especialidad || "Sin especialidad",
                tareas: 0,
                dias: 0
            });
        }
        const item = map.get(key);
        item.tareas += 1;
        item.dias += calDiasEnMesDeTarea(tarea);
    });

    const lista = Array.from(map.values())
        .sort((a, b) => (b.tareas - a.tareas) || (b.dias - a.dias))
        .slice(0, 12);

    contenedor.innerHTML = lista.map(item => `
        <article class="cal-chip-desempeno">
            <p class="chip-nombre">${item.nombre} · ${item.especialidad}</p>
            <p class="chip-metricas">${item.tareas} tareas · ${item.dias} d&iacute;as</p>
        </article>
    `).join("");
}

function calConstruirCardTarea(tarea) {
    return `
        <article class="cal-tarea-card">
            <p class="cal-tarea-ejecutante">${tarea.nombre_ejecutante || "Sin ejecutante"}</p>
            <p class="cal-tarea-especialidad">${tarea.especialidad || "Sin especialidad"}</p>
            <p class="cal-tarea-meta">${tarea.nombre_proyecto || "-"} · ${tarea.numero_identificador || "-"}</p>
            <p class="cal-tarea-meta">${tarea.nombre_familia || "Sin familia"} · ${tarea.descripcion_tarea || "Sin descripción"}</p>
            <p class="cal-tarea-rango">${calFormatearDiaMes(tarea.fecha_inicio)} - ${calFormatearDiaMes(tarea.fecha_termino || tarea.fecha_inicio)}</p>
        </article>
    `;
}

function renderizarCalendarioIntegrado() {
    const grid = document.getElementById("cal_calendario_grid");
    if (!grid) return;

    const inicio = calInicioVista(calendarioIntegradoState.fechaBase);
    const hoy = calNormalizarDia(new Date());
    const celdas = [];

    for (let i = 0; i < 42; i += 1) {
        const dia = new Date(inicio);
        dia.setDate(inicio.getDate() + i);
        const esMesActual = dia.getMonth() === calendarioIntegradoState.fechaBase.getMonth();
        const esHoy = dia.getTime() === hoy.getTime();
        const tareas = calendarioIntegradoState.tareasMes.filter(tarea => calTareaEnDia(tarea, dia));

        const tareasHtml = tareas.length
            ? tareas.map(calConstruirCardTarea).join("")
            : '<p class="cal-sin-tareas">Sin tareas</p>';

        celdas.push(`
            <div class="cal-celda-dia ${esMesActual ? "" : "fuera-mes"} ${esHoy ? "hoy" : ""}">
                <div class="cal-dia-header">
                    <span class="cal-dia-num">${dia.getDate()}</span>
                    <span class="cal-dia-cantidad">${tareas.length} ${tareas.length === 1 ? "tarea" : "tareas"}</span>
                </div>
                <div class="cal-tareas-scroll">
                    ${tareasHtml}
                </div>
            </div>
        `);
    }

    grid.innerHTML = celdas.join("");
}

async function cargarFiltrosCalendarioIntegrado() {
    if (!calendarioIntegradoDisponible()) return;

    const selectE = document.getElementById("cal_filtro_ejecutante");
    const selectP = document.getElementById("cal_filtro_proyecto");
    if (!selectE || !selectP) return;

    try {
        const [resE, resP] = await Promise.all([
            fetch("/api/ejecutantes"),
            fetch("/api/proyectos")
        ]);

        if (resE.ok) {
            const dataE = await resE.json();
            selectE.innerHTML = '<option value="">Todos los ejecutantes</option>';
            dataE.forEach(item => {
                const option = document.createElement("option");
                option.value = String(item.id_ejecutante);
                option.textContent = `${item.nombre_ejecutante} - ${item.especialidad || "Sin especialidad"}`;
                selectE.appendChild(option);
            });
        }

        if (resP.ok) {
            const dataP = await resP.json();
            selectP.innerHTML = '<option value="">Todos los proyectos</option>';
            dataP.forEach(item => {
                const option = document.createElement("option");
                option.value = String(item.id_proyecto);
                option.textContent = item.nombre_proyecto || `Proyecto ${item.id_proyecto}`;
                selectP.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error cargando filtros calendario integrado:", error);
    }
}

function queryCalendarioIntegrado() {
    const params = new URLSearchParams({
        year: String(calendarioIntegradoState.fechaBase.getFullYear()),
        month: String(calendarioIntegradoState.fechaBase.getMonth() + 1)
    });

    const idEjecutante = document.getElementById("cal_filtro_ejecutante")?.value || "";
    const idProyecto = document.getElementById("cal_filtro_proyecto")?.value || "";
    if (idEjecutante) params.set("id_ejecutante", idEjecutante);
    if (idProyecto) params.set("id_proyecto", idProyecto);

    return params.toString();
}

async function cargarTareasCalendarioIntegrado() {
    if (!calendarioIntegradoDisponible()) return;
    try {
        renderizarTituloCalendarioIntegrado();
        const res = await fetch(`/api/calendario/tareas?${queryCalendarioIntegrado()}`);
        if (!res.ok) throw new Error("No se pudo cargar calendario integrado");
        const data = await res.json();
        calendarioIntegradoState.tareasMes = Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Error calendario integrado:", error);
        calendarioIntegradoState.tareasMes = [];
    }

    renderizarResumenCalendarioIntegrado(calendarioIntegradoState.tareasMes);
    renderizarCalendarioIntegrado();
}

function moverMesCalendarioIntegrado(delta) {
    const base = new Date(calendarioIntegradoState.fechaBase);
    base.setMonth(base.getMonth() + delta);
    calendarioIntegradoState.fechaBase = new Date(base.getFullYear(), base.getMonth(), 1);
    cargarTareasCalendarioIntegrado();
}

function inicializarCalendarioIntegrado() {
    if (!calendarioIntegradoDisponible()) return;

    document.getElementById("cal_btn_prev_mes")?.addEventListener("click", () => moverMesCalendarioIntegrado(-1));
    document.getElementById("cal_btn_next_mes")?.addEventListener("click", () => moverMesCalendarioIntegrado(1));
    document.getElementById("cal_btn_hoy")?.addEventListener("click", () => {
        const hoy = new Date();
        calendarioIntegradoState.fechaBase = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        cargarTareasCalendarioIntegrado();
    });
    document.getElementById("cal_filtro_ejecutante")?.addEventListener("change", cargarTareasCalendarioIntegrado);
    document.getElementById("cal_filtro_proyecto")?.addEventListener("change", cargarTareasCalendarioIntegrado);

    cargarFiltrosCalendarioIntegrado().then(cargarTareasCalendarioIntegrado);
}









