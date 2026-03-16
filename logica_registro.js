// =====================================================
// ESTADO GLOBAL
// =====================================================
let postventaActiva = null;
let listaEjecutantes = [];
let historialFamilias = [];
let modoGestionRegistros = false;
let registroFamiliaEditId = null;
let registroFamiliaEditPostventa = null;
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

function fmtFechaISO(valor) {
    if (!valor) return "-";
    return String(valor).split("T")[0];
}

function escapeHtml(s) {
    return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function setGestionArbolMensaje(texto) {
    const host = document.getElementById("gestion_arbol");
    if (!host) return;
    host.innerHTML = `<div class="gestion-arbol-vacio">${texto}</div>`;
}

// Compat: algunas partes del código aún llaman esto.
function renderizarGestionVacia(texto = "Listado de postventas. Selecciona una para ver familias y tareas.") {
    setGestionArbolMensaje(texto);
}

let gestionArbolInit = false;
function inicializarGestionArbol() {
    if (gestionArbolInit) return;
    gestionArbolInit = true;

    const host = document.getElementById("gestion_arbol");
    if (!host) return;

    host.addEventListener("click", async (e) => {
        const projToggle = e.target.closest("[data-proj-toggle]");
        const pvToggle = e.target.closest("[data-pv-toggle]");
        const pvManage = e.target.closest("[data-pv-manage]");
        const famToggle = e.target.closest("[data-fam-toggle]");
        const famManage = e.target.closest("[data-fam-manage]");
        const taskManage = e.target.closest("[data-task-manage]");

        if (projToggle) {
            const card = projToggle.closest(".proj-card");
            const id = Number(card?.dataset?.idProyecto);
            if (!Number.isFinite(id) || id <= 0) return;
            toggleProyecto(card);
            return;
        }

        if (pvToggle) {
            const card = pvToggle.closest(".pv-card");
            const id = Number(card?.dataset?.idPostventa);
            if (!Number.isFinite(id) || id <= 0) return;
            await togglePostventa(card, id);
            return;
        }

        if (pvManage) {
            const card = pvManage.closest(".pv-card");
            const id = Number(card?.dataset?.idPostventa);
            if (!Number.isFinite(id) || id <= 0) return;
            abrirModalGestion({
                tipo: "postventa",
                id_postventa: id,
                proyecto: card?.dataset?.proyecto || "",
                casa: card?.dataset?.casa || "",
                cliente: card?.dataset?.cliente || "",
                estado: card?.dataset?.estado || "",
                apertura: card?.dataset?.apertura || ""
            });
            return;
        }

        if (famToggle) {
            const fam = famToggle.closest(".fam-item");
            const idRegistro = Number(fam?.dataset?.idRegistro);
            if (!Number.isFinite(idRegistro) || idRegistro <= 0) return;
            await toggleFamilia(fam, idRegistro);
            return;
        }

        if (famManage) {
            const fam = famManage.closest(".fam-item");
            const idRegistro = Number(fam?.dataset?.idRegistro);
            if (!Number.isFinite(idRegistro) || idRegistro <= 0) return;
            const pvCard = fam?.closest(".pv-card");
            abrirModalGestion({
                tipo: "familia",
                id_registro: idRegistro,
                id_postventa: Number(pvCard?.dataset?.idPostventa),
                familia: fam?.dataset?.familia || "",
                subfamilia: fam?.dataset?.subfamilia || "",
                recinto: fam?.dataset?.recinto || "",
                proyecto: pvCard?.dataset?.proyecto || "",
                casa: pvCard?.dataset?.casa || "",
                cliente: pvCard?.dataset?.cliente || ""
            });
            return;
        }

        if (taskManage) {
            const task = taskManage.closest(".task-item");
            const fam = taskManage.closest(".fam-item");
            const pvCard = taskManage.closest(".pv-card");
            const idTarea = Number(task?.dataset?.idTarea);
            const idRegistro = Number(fam?.dataset?.idRegistro);
            if (!Number.isFinite(idTarea) || idTarea <= 0) return;
            if (!Number.isFinite(idRegistro) || idRegistro <= 0) return;
            abrirModalGestion({
                tipo: "tarea",
                id_tarea: idTarea,
                id_registro: idRegistro,
                id_postventa: Number(pvCard?.dataset?.idPostventa),
                tarea: task?.querySelector(".t")?.textContent || "",
                familia: fam?.dataset?.familia || "",
                subfamilia: fam?.dataset?.subfamilia || "",
                recinto: fam?.dataset?.recinto || "",
                proyecto: pvCard?.dataset?.proyecto || "",
                casa: pvCard?.dataset?.casa || "",
                cliente: pvCard?.dataset?.cliente || ""
            });
            return;
        }
    });
}

function agruparTareasGestion(rows) {
    const map = new Map();
    for (const r of rows) {
        const id = Number(r.id_tarea);
        if (!Number.isFinite(id) || id <= 0) continue;
        const cur = map.get(id) || {
            id_tarea: id,
            descripcion_tarea: r.descripcion_tarea,
            fecha_inicio: r.fecha_inicio,
            fecha_termino: r.fecha_termino,
            ejecutantes: []
        };
        const nombre = r.nombre_ejecutante ? String(r.nombre_ejecutante) : "";
        const esp = r.especialidad ? String(r.especialidad) : "";
        if (nombre) {
            const label = esp ? `${nombre} (${esp})` : nombre;
            if (!cur.ejecutantes.includes(label)) cur.ejecutantes.push(label);
        }
        map.set(id, cur);
    }
    return Array.from(map.values()).sort((a, b) => {
        const fa = new Date(a.fecha_inicio || "1970-01-01").getTime();
        const fb = new Date(b.fecha_inicio || "1970-01-01").getTime();
        if (fa !== fb) return fa - fb;
        return a.id_tarea - b.id_tarea;
    });
}

async function cargarGestionArbol() {
    setGestionArbolMensaje("Cargando postventas...");
    try {
        const res = await fetch("/api/postventas/listado?limit=500");
        if (!res.ok) throw new Error("No se pudo cargar postventas");
        const data = await res.json();

        const host = document.getElementById("gestion_arbol");
        if (!host) return;

        if (!Array.isArray(data) || data.length === 0) {
            setGestionArbolMensaje("No hay postventas registradas.");
            return;
        }

        // Agrupar por proyecto -> postventas
        const proyectos = new Map();
        for (const pv of data) {
            const idp = Number(pv.id_proyecto);
            const nombre = pv.nombre_proyecto || "Proyecto";
            const key = Number.isFinite(idp) && idp > 0 ? idp : 0;
            if (!proyectos.has(key)) proyectos.set(key, { id_proyecto: key, nombre_proyecto: nombre, items: [] });
            proyectos.get(key).items.push(pv);
        }

        const proyectosOrdenados = Array.from(proyectos.values()).sort((a, b) => {
            if (a.id_proyecto === 0 && b.id_proyecto !== 0) return 1;
            if (b.id_proyecto === 0 && a.id_proyecto !== 0) return -1;
            return String(a.nombre_proyecto).localeCompare(String(b.nombre_proyecto), "es");
        });

        host.innerHTML = proyectosOrdenados.map(p => {
            const totalPostventas = p.items.length;
            const totalFamilias = p.items.reduce((acc, it) => acc + Number(it.total_familias || 0), 0);

            const postventasHtml = p.items.map(pv => {
                const id = Number(pv.id_postventa);
                const proyecto = pv.nombre_proyecto || "-";
                const casa = pv.numero_identificador || "-";
                const cliente = pv.cliente || "-";
                const estado = pv.estado || "-";
                const apertura = fmtFechaISO(pv.fecha_apertura);
                const familias = Number(pv.total_familias || 0);

                const subtitle = `${proyecto} · Casa ${casa} · ${cliente}`;
                const badge = `${estado} · ${familias} familias · ${apertura}`;

                return `
                    <div class="pv-card"
                         data-id-postventa="${id}"
                         data-id-proyecto="${Number(pv.id_proyecto) || 0}"
                         data-proyecto="${escapeHtml(proyecto)}"
                         data-casa="${escapeHtml(String(casa))}"
                         data-cliente="${escapeHtml(cliente)}"
                         data-estado="${escapeHtml(estado)}"
                         data-apertura="${escapeHtml(apertura)}">
                        <div class="pv-head">
                            <div class="pv-left" data-pv-toggle>
                                <button type="button" class="pv-btn" aria-label="Ver familias">
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                                <div class="pv-title">
                                    <div class="t">Postventa #${id}</div>
                                    <div class="s">${subtitle} · ${badge}</div>
                                </div>
                            </div>
                            <div class="pv-actions">
                                <button type="button" class="pv-btn manage" data-pv-manage>
                                    Gestionar
                                </button>
                            </div>
                        </div>
                        <div class="pv-children" data-pv-children>
                            <div class="gestion-arbol-vacio">Cargando familias...</div>
                        </div>
                    </div>
                `;
            }).join("");

            const nombreProyecto = p.id_proyecto === 0 ? "Sin proyecto" : p.nombre_proyecto;
            const resumen = `${totalPostventas} postventas · ${totalFamilias} familias`;

            return `
                <div class="proj-card" data-id-proyecto="${p.id_proyecto}">
                    <div class="proj-head">
                        <div class="proj-left" data-proj-toggle>
                            <button type="button" class="pv-btn" aria-label="Ver postventas">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <div class="proj-title">
                                <div class="t">${nombreProyecto}</div>
                                <div class="s">${resumen}</div>
                            </div>
                        </div>
                    </div>
                    <div class="proj-children">
                        <div class="pv-list">
                            ${postventasHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    } catch (error) {
        console.error("Error gestion arbol:", error);
        setGestionArbolMensaje("Error cargando postventas.");
    }
}

function toggleProyecto(card) {
    if (!card) return;
    card.classList.toggle("open");
}

// ======================================================
// Modal de gestión (GESTIONAR)
// ======================================================

let gestionModalInit = false;
let gestionModalPayload = null;

function initModalGestion() {
    if (gestionModalInit) return;
    gestionModalInit = true;

    const backdrop = document.getElementById("gestion_modal_backdrop");
    const btnClose = document.getElementById("gestion_modal_close");
    const btnCancel = document.getElementById("gestion_modal_cancel");
    if (!backdrop) return;

    const cerrar = () => cerrarModalGestion();
    btnClose?.addEventListener("click", cerrar);
    btnCancel?.addEventListener("click", cerrar);

    // Click fuera del modal
    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) cerrar();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") cerrar();
    });
}

function abrirModalGestion(payload) {
    initModalGestion();

    const backdrop = document.getElementById("gestion_modal_backdrop");
    const title = document.getElementById("gestion_modal_title");
    const subtitle = document.getElementById("gestion_modal_subtitle");
    const body = document.getElementById("gestion_modal_body");
    if (!backdrop || !title || !subtitle || !body) return;

    gestionModalPayload = payload || null;

    const tipo = payload?.tipo || "";
    if (tipo === "postventa") title.textContent = "Gestión de postventa";
    else if (tipo === "familia") title.textContent = "Gestión de registro (familia)";
    else if (tipo === "tarea") title.textContent = "Gestión de tarea";
    else title.textContent = "Gestión";

    const linea = [
        payload?.proyecto ? payload.proyecto : null,
        payload?.casa ? `Casa ${payload.casa}` : null,
        payload?.cliente ? payload.cliente : null
    ].filter(Boolean).join(" · ");
    subtitle.textContent = linea || "-";

    body.innerHTML = construirHtmlModalGestion(payload);

    // Wire acciones del modal
    wireModalGestion(payload);

    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
}

function cerrarModalGestion() {
    const backdrop = document.getElementById("gestion_modal_backdrop");
    if (!backdrop || backdrop.hidden) return;
    const modal = backdrop.querySelector(".pv-modal");
    modal?.classList.remove("pv-modal--xl");
    backdrop.hidden = true;
    document.body.style.overflow = "";
    gestionModalPayload = null;
}

function construirHtmlModalGestion(p) {
    const tipo = p?.tipo || "";

    if (tipo === "postventa") {
        const id = Number(p.id_postventa);
        const estado = p.estado ? `Estado: ${p.estado}` : "";
        const apertura = p.apertura ? `Apertura: ${p.apertura}` : "";
        return `
            <div class="pv-modal-box">
                <h4>Acciones</h4>
                <p>Gestiona la postventa #${id}. ${escapeHtml([estado, apertura].filter(Boolean).join(" · "))}</p>
                <div class="pv-modal-row">
                    <button type="button" class="pv-btn" id="gm_edit_pv">
                        <i class="fas fa-pen"></i> Editar postventa
                    </button>
                    <button type="button" class="pv-btn" id="gm_open_pv">
                        <i class="fas fa-arrow-up-right-from-square"></i> Abrir en formulario
                    </button>
                </div>
            </div>

            <div class="pv-modal-box danger">
                <h4>Eliminar postventa completa</h4>
                <p>Esto eliminará la postventa, todas sus familias y tareas asociadas.</p>
                <div class="pv-modal-confirm">
                    <input id="gm_confirm_input" type="text" placeholder="Escribe: ELIMINAR POSTVENTA" autocomplete="off">
                    <button type="button" class="pv-btn danger" id="gm_delete_btn" disabled>
                        <i class="fas fa-trash"></i> Eliminar postventa
                    </button>
                </div>
            </div>
        `;
    }

    if (tipo === "familia") {
        const idReg = Number(p.id_registro);
        const idPv = Number(p.id_postventa);
        const lineaFam = [p.familia, p.subfamilia, p.recinto].filter(Boolean).join(" / ");
        return `
            <div class="pv-modal-box">
                <h4>Acciones</h4>
                <p>Registro #${idReg}${lineaFam ? ` · ${escapeHtml(lineaFam)}` : ""}</p>
                <div class="pv-modal-row">
                    <button type="button" class="pv-btn" id="gm_edit_reg">
                        <i class="fas fa-pen"></i> Editar registro
                    </button>
                    <button type="button" class="pv-btn" id="gm_open_pv">
                        <i class="fas fa-arrow-up-right-from-square"></i> Abrir postventa #${idPv}
                    </button>
                </div>
            </div>

            <div class="pv-modal-box warn">
                <h4>Eliminar familia</h4>
                <p>Esto eliminará la familia (registro) y sus tareas asociadas.</p>
                <div class="pv-modal-confirm">
                    <input id="gm_confirm_input_fam" type="text" placeholder="Escribe: ELIMINAR FAMILIA" autocomplete="off">
                    <button type="button" class="pv-btn danger" id="gm_delete_fam_btn" disabled>
                        <i class="fas fa-trash"></i> Eliminar familia
                    </button>
                </div>
            </div>

            <div class="pv-modal-box danger">
                <h4>Eliminar postventa completa</h4>
                <p>Elimina la postventa #${idPv} y todas sus familias y tareas.</p>
                <div class="pv-modal-confirm">
                    <input id="gm_confirm_input_pv" type="text" placeholder="Escribe: ELIMINAR POSTVENTA" autocomplete="off">
                    <button type="button" class="pv-btn danger" id="gm_delete_pv_btn" disabled>
                        <i class="fas fa-trash"></i> Eliminar postventa
                    </button>
                </div>
            </div>
        `;
    }

    if (tipo === "tarea") {
        const idT = Number(p.id_tarea);
        const idReg = Number(p.id_registro);
        const tarea = p.tarea ? escapeHtml(p.tarea) : "Tarea";
        return `
            <div class="pv-modal-box">
                <h4>Acciones</h4>
                <p>Tarea #${idT} · ${tarea}</p>
                <div class="pv-modal-row">
                    <button type="button" class="pv-btn" id="gm_edit_reg">
                        <i class="fas fa-pen"></i> Editar registro
                    </button>
                </div>
            </div>

            <div class="pv-modal-box danger">
                <h4>Eliminar tarea</h4>
                <p>Esto eliminará la tarea y su asignación de ejecutante.</p>
                <div class="pv-modal-confirm">
                    <input id="gm_confirm_input" type="text" placeholder="Escribe: ELIMINAR TAREA" autocomplete="off">
                    <button type="button" class="pv-btn danger" id="gm_delete_btn" disabled>
                        <i class="fas fa-trash"></i> Eliminar tarea
                    </button>
                </div>
            </div>
        `;
    }

    return `<div class="pv-modal-box"><h4>Sin acciones</h4><p>No hay acciones disponibles para este elemento.</p></div>`;
}

function wireConfirm(inputEl, btnEl, frase, onOk) {
    if (!inputEl || !btnEl) return;
    const objetivo = String(frase).trim().toUpperCase();
    const sync = () => {
        const val = String(inputEl.value || "").trim().toUpperCase();
        btnEl.disabled = val !== objetivo;
    };
    inputEl.addEventListener("input", sync);
    sync();
    btnEl.addEventListener("click", onOk);
}

function wireModalGestion(p) {
    const tipo = p?.tipo || "";
    const btnOpenPv = document.getElementById("gm_open_pv");
    const btnEditReg = document.getElementById("gm_edit_reg");
    const btnEditPv = document.getElementById("gm_edit_pv");

    btnOpenPv?.addEventListener("click", async () => {
        const idPv = Number(p.id_postventa);
        if (!Number.isFinite(idPv) || idPv <= 0) return;
        cerrarModalGestion();
        await abrirPostventaEnFormularioDesdeGestion(idPv);
    });

    btnEditPv?.addEventListener("click", async () => {
        const idPv = Number(p.id_postventa);
        if (!Number.isFinite(idPv) || idPv <= 0) return;
        await abrirModalEditarPostventa(idPv);
    });

    btnEditReg?.addEventListener("click", async () => {
        const idReg = Number(p.id_registro || p.id_registro_familia || p.id_registro);
        if (!Number.isFinite(idReg) || idReg <= 0) return;
        await abrirModalEditarRegistro(idReg, {
            modo: (tipo === "tarea" ? "tarea" : "familia"),
            foco: (tipo === "tarea" ? "tareas" : null)
        });
    });

    if (tipo === "postventa") {
        const input = document.getElementById("gm_confirm_input");
        const btn = document.getElementById("gm_delete_btn");
        wireConfirm(input, btn, "ELIMINAR POSTVENTA", async () => {
            cerrarModalGestion();
            await eliminarPostventaPorId(Number(p.id_postventa), { skipConfirm: true });
        });
    }

    if (tipo === "familia") {
        const inputFam = document.getElementById("gm_confirm_input_fam");
        const btnFam = document.getElementById("gm_delete_fam_btn");
        wireConfirm(inputFam, btnFam, "ELIMINAR FAMILIA", async () => {
            cerrarModalGestion();
            await eliminarRegistroFamiliaGestion(Number(p.id_registro), Number(p.id_postventa), { skipConfirm: true });
        });

        const inputPv = document.getElementById("gm_confirm_input_pv");
        const btnPv = document.getElementById("gm_delete_pv_btn");
        wireConfirm(inputPv, btnPv, "ELIMINAR POSTVENTA", async () => {
            cerrarModalGestion();
            await eliminarPostventaPorId(Number(p.id_postventa), { skipConfirm: true });
        });
    }

    if (tipo === "tarea") {
        const input = document.getElementById("gm_confirm_input");
        const btn = document.getElementById("gm_delete_btn");
        wireConfirm(input, btn, "ELIMINAR TAREA", async () => {
            cerrarModalGestion();
            await eliminarTareaGestion(Number(p.id_tarea), Number(p.id_registro), { skipConfirm: true });
        });
    }
}

async function abrirModalEditarRegistro(idRegistro, opts = {}) {
    initModalGestion();

    const backdrop = document.getElementById("gestion_modal_backdrop");
    const modal = backdrop?.querySelector(".pv-modal");
    const title = document.getElementById("gestion_modal_title");
    const subtitle = document.getElementById("gestion_modal_subtitle");
    const body = document.getElementById("gestion_modal_body");
    if (!backdrop || !modal || !title || !subtitle || !body) return;

    const id = Number(idRegistro);
    if (!Number.isFinite(id) || id <= 0) return;

    // Modal grande para edición
    modal.classList.add("pv-modal--xl");

    title.textContent = "Modificar registro";
    subtitle.textContent = "Cargando datos...";
    body.innerHTML = `<div class="pv-modal-box"><p>Cargando información del registro...</p></div>`;

    backdrop.hidden = false;
    document.body.style.overflow = "hidden";

    try {
        const [resDet, resTareas, resFamilias, resResp, resEjec] = await Promise.all([
            fetch(`/api/registros-familia/${id}/detalle`),
            fetch(`/api/registros-familia/${id}/tareas`),
            fetch(`/api/familias`),
            fetch(`/api/responsables`),
            fetch(`/api/ejecutantes`)
        ]);

        const det = await resDet.json().catch(() => null);
        const tareasRaw = await resTareas.json().catch(() => []);
        const familias = await resFamilias.json().catch(() => []);
        const responsables = await resResp.json().catch(() => []);
        const ejecutantes = await resEjec.json().catch(() => []);

        if (!resDet.ok) throw new Error(det?.error || "No se pudo cargar el registro");
        if (!resTareas.ok) throw new Error("No se pudieron cargar tareas");

        const idPostventa = Number(det?.id_postventa);
        if (!Number.isFinite(idPostventa) || idPostventa <= 0) throw new Error("Postventa inválida");

        const resPv = await fetch(`/api/postventas/${idPostventa}/detalle`);
        const pv = await resPv.json().catch(() => null);
        if (!resPv.ok) throw new Error(pv?.error || "No se pudo cargar la postventa");

        const resSub = await fetch(`/api/familias/${Number(det.id_familia)}/subfamilias`);
        const subfamilias = await resSub.json().catch(() => []);

        const proyecto = pv?.nombre_proyecto || "-";
        const casa = pv?.numero_identificador || "-";
        const cliente = pv?.cliente || "-";
        subtitle.textContent = `${proyecto} · Casa ${casa} · ${cliente}`;

        body.innerHTML = construirHtmlModalEditarRegistro({
            id_registro: id,
            modo: opts?.modo || "familia",
            det,
            pv,
            familias: Array.isArray(familias) ? familias : [],
            subfamilias: Array.isArray(subfamilias) ? subfamilias : [],
            responsables: Array.isArray(responsables) ? responsables : [],
            ejecutantes: Array.isArray(ejecutantes) ? ejecutantes : [],
            tareasRaw: Array.isArray(tareasRaw) ? tareasRaw : []
        });

        wireModalEditarRegistro({
            id_registro: id,
            id_postventa: idPostventa,
            foco: opts?.foco || null
        });
    } catch (error) {
        console.error("Error abriendo editor modal:", error);
        subtitle.textContent = "Error";
        body.innerHTML = `<div class="pv-modal-box danger"><h4>Error</h4><p>${escapeHtml(error.message || "No se pudo abrir el editor.")}</p></div>`;
    }
}

async function abrirModalEditarPostventa(idPostventa) {
    initModalGestion();

    const backdrop = document.getElementById("gestion_modal_backdrop");
    const modal = backdrop?.querySelector(".pv-modal");
    const title = document.getElementById("gestion_modal_title");
    const subtitle = document.getElementById("gestion_modal_subtitle");
    const body = document.getElementById("gestion_modal_body");
    if (!backdrop || !modal || !title || !subtitle || !body) return;

    const id = Number(idPostventa);
    if (!Number.isFinite(id) || id <= 0) return;

    modal.classList.add("pv-modal--xl");
    title.textContent = "Editar postventa";
    subtitle.textContent = "Cargando datos...";
    body.innerHTML = `<div class="pv-modal-box"><p>Cargando información de la postventa...</p></div>`;

    backdrop.hidden = false;
    document.body.style.overflow = "hidden";

    try {
        const resPv = await fetch(`/api/postventas/${id}/detalle`);
        const pv = await resPv.json().catch(() => null);
        if (!resPv.ok) throw new Error(pv?.error || "No se pudo cargar la postventa");

        const idProyecto = Number(pv?.id_proyecto);
        const idInmueble = Number(pv?.id_inmueble);

        const [resProy, resInm, resDetInm] = await Promise.all([
            fetch("/api/proyectos"),
            Number.isFinite(idProyecto) && idProyecto > 0 ? fetch(`/api/proyectos/${idProyecto}/inmuebles`) : Promise.resolve({ ok: true, json: async () => [] }),
            Number.isFinite(idInmueble) && idInmueble > 0 ? fetch(`/api/inmuebles/detalle/${idInmueble}`) : Promise.resolve({ ok: true, json: async () => ({}) })
        ]);

        const proyectos = await resProy.json().catch(() => []);
        const inmuebles = await resInm.json().catch(() => []);
        const detInm = await resDetInm.json().catch(() => ({}));

        if (!resProy.ok) throw new Error("No se pudieron cargar proyectos");
        if (!resInm.ok) throw new Error("No se pudieron cargar identificadores");
        if (!resDetInm.ok) throw new Error("No se pudo cargar el detalle del inmueble");

        subtitle.textContent = `${pv?.nombre_proyecto || "-"} · Casa ${pv?.numero_identificador || "-"} · ${pv?.cliente || "-"}`;

        body.innerHTML = construirHtmlModalEditarPostventa({
            id_postventa: id,
            pv,
            proyectos: Array.isArray(proyectos) ? proyectos : [],
            inmuebles: Array.isArray(inmuebles) ? inmuebles : [],
            detInm: detInm || {}
        });

        wireModalEditarPostventa({
            id_postventa: id,
            id_proyecto: idProyecto,
            id_inmueble: idInmueble
        });
    } catch (error) {
        console.error("Error abrir editar postventa:", error);
        subtitle.textContent = "Error";
        body.innerHTML = `<div class="pv-modal-box danger"><h4>Error</h4><p>${escapeHtml(error.message || "No se pudo abrir el editor de postventa.")}</p></div>`;
    }
}

function construirHtmlModalEditarPostventa(ctx) {
    const pv = ctx.pv || {};
    const det = ctx.detInm || {};

    const proyOptions = `<option value="" disabled>Seleccione proyecto...</option>` +
        construirOptions(ctx.proyectos, "id_proyecto", (it) => it.nombre_proyecto || "-", pv.id_proyecto);

    const inmOptions = `<option value="" disabled>Seleccione identificador...</option>` +
        (Array.isArray(ctx.inmuebles) ? ctx.inmuebles : []).map(it => {
            const v = String(it.id_inmueble ?? "");
            const selected = String(pv.id_inmueble) === v ? " selected" : "";
            const label = it.numero_identificador ?? v;
            return `<option value="${escapeHtml(v)}"${selected}>${escapeHtml(String(label))}</option>`;
        }).join("");

    const estadoTicket = String(pv.estado_ticket || "");
    const estadoTicketOptions = `
        <option value="" disabled>Seleccione estado</option>
        <option value="Abierta"${estadoTicket === "Abierta" ? " selected" : ""}>Abierta</option>
        <option value="Cerrada"${estadoTicket === "Cerrada" ? " selected" : ""}>Cerrada</option>
    `;

    // estado_inmueble puede o no existir en BD, lo guardamos si existe
    const estadoInmueble = String(pv.estado_inmueble || "");
    const estadoInmOptions = `
        <option value="" disabled>Seleccione estado...</option>
        <option value="En Stock"${estadoInmueble === "En Stock" ? " selected" : ""}>En Stock</option>
        <option value="En preparación"${estadoInmueble === "En preparación" ? " selected" : ""}>En preparación</option>
        <option value="Entregada"${estadoInmueble === "Entregada" ? " selected" : ""}>Entregada</option>
    `;

    return `
        <div class="pv-edit-grid">
            <section class="pv-edit-col">
                <div class="pv-modal-box">
                    <h4>1. Identificación del inmueble</h4>
                    <div class="pv-edit-fields">
                        <div class="pv-edit-field">
                            <label>Proyecto *</label>
                            <select class="pv-edit-input" id="gp_id_proyecto">${proyOptions}</select>
                        </div>
                        <div class="pv-edit-field">
                            <label>Identificador *</label>
                            <select class="pv-edit-input" id="gp_id_inmueble">${inmOptions}</select>
                        </div>
                        <div class="pv-edit-field">
                            <label>Casa/Depto</label>
                            <input class="pv-edit-input" type="text" id="gp_casa_depto" value="${escapeHtml(det.casa_o_depto || "")}" readonly>
                        </div>
                        <div class="pv-edit-field">
                            <label>Modelo</label>
                            <input class="pv-edit-input" type="text" id="gp_modelo" value="${escapeHtml(det.modelo || "")}" readonly>
                        </div>
                        <div class="pv-edit-field">
                            <label>Orientación</label>
                            <input class="pv-edit-input" type="text" id="gp_orientacion" value="${escapeHtml(det.orientacion || "")}" readonly>
                        </div>
                        <div class="pv-edit-field">
                            <label>Fecha de entrega</label>
                            <input class="pv-edit-input" type="date" id="gp_fecha_entrega" value="${escapeHtml(det.fecha_entrega ? fmtFechaISO(det.fecha_entrega) : "")}" readonly>
                        </div>
                        <div class="pv-edit-field pv-edit-field--full">
                            <label>Estado del inmueble *</label>
                            <select class="pv-edit-input" id="gp_estado_inmueble">${estadoInmOptions}</select>
                        </div>
                    </div>
                </div>
            </section>

            <section class="pv-edit-col">
                <div class="pv-modal-box">
                    <h4>2. Datos de la Postventa</h4>
                    <div class="pv-edit-fields">
                        <div class="pv-edit-field">
                            <label>Estado del Ticket *</label>
                            <select class="pv-edit-input" id="gp_estado_ticket">${estadoTicketOptions}</select>
                        </div>
                        <div class="pv-edit-field">
                            <label>Nombre del Cliente *</label>
                            <input class="pv-edit-input" type="text" id="gp_nombre_cliente" value="${escapeHtml(pv.cliente || "")}">
                        </div>
                        <div class="pv-edit-field pv-edit-field--full">
                            <label>Contacto</label>
                            <input class="pv-edit-input" type="tel" id="gp_numero_contacto" value="${escapeHtml(pv.numero_contacto || "")}" placeholder="Ej: +56 912345678">
                        </div>
                    </div>
                </div>

                <div class="pv-edit-actions">
                    <button type="button" class="btn-principal" id="gp_save_postventa">
                        <i class="fas fa-save"></i> Guardar cambios
                    </button>
                </div>
            </section>
        </div>
    `;
}

function wireModalEditarPostventa(ctx) {
    const idPostventa = Number(ctx.id_postventa);
    const selProy = document.getElementById("gp_id_proyecto");
    const selInm = document.getElementById("gp_id_inmueble");
    const btnSave = document.getElementById("gp_save_postventa");

    const cargarInmueblesProyecto = async (idProyecto) => {
        if (!selInm) return;
        selInm.innerHTML = `<option value="" disabled selected>Cargando...</option>`;
        const res = await fetch(`/api/proyectos/${idProyecto}/inmuebles`);
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error("No se pudieron cargar inmuebles");
        selInm.innerHTML = `<option value="" disabled selected>Seleccione identificador...</option>` +
            (Array.isArray(data) ? data : []).map(it => {
                const label = it.numero_identificador ?? it.id_inmueble;
                return `<option value="${escapeHtml(it.id_inmueble)}">${escapeHtml(String(label))}</option>`;
            }).join("");
    };

    const cargarDetalleInmueble = async (idInmueble) => {
        const res = await fetch(`/api/inmuebles/detalle/${idInmueble}`);
        const det = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("No se pudo cargar detalle inmueble");
        document.getElementById("gp_casa_depto").value = det.casa_o_depto || "";
        document.getElementById("gp_modelo").value = det.modelo || "";
        document.getElementById("gp_orientacion").value = det.orientacion || "";
        document.getElementById("gp_fecha_entrega").value = det.fecha_entrega ? fmtFechaISO(det.fecha_entrega) : "";
    };

    selProy?.addEventListener("change", async () => {
        const idp = Number(selProy.value);
        if (!Number.isFinite(idp) || idp <= 0) return;
        try {
            await cargarInmueblesProyecto(idp);
        } catch (e) {
            console.error(e);
            alert(e.message || "No se pudieron cargar inmuebles.");
        }
    });

    selInm?.addEventListener("change", async () => {
        const idInm = Number(selInm.value);
        if (!Number.isFinite(idInm) || idInm <= 0) return;
        try {
            await cargarDetalleInmueble(idInm);
        } catch (e) {
            console.error(e);
            alert(e.message || "No se pudo cargar el detalle del inmueble.");
        }
    });

    btnSave?.addEventListener("click", async () => {
        const id_inmueble = Number(selInm?.value || 0);
        const estado_ticket = document.getElementById("gp_estado_ticket")?.value || "";
        const nombre_cliente = String(document.getElementById("gp_nombre_cliente")?.value || "").trim();
        const numero_contacto = String(document.getElementById("gp_numero_contacto")?.value || "").trim();
        const estado_inmueble = document.getElementById("gp_estado_inmueble")?.value || null;

        if (!id_inmueble) return alert("Identificador es obligatorio.");
        if (!estado_ticket) return alert("Estado del ticket es obligatorio.");
        if (!nombre_cliente) return alert("Nombre del cliente es obligatorio.");

        try {
            const res = await fetch(`/api/postventas/${idPostventa}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_inmueble, estado_ticket, nombre_cliente, numero_contacto, estado_inmueble })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || "No se pudo guardar la postventa.");

            cerrarModalGestion();
            await cargarGestionArbol();
            await cargarPostventasRecientes(postventaActiva, false);
            cargarIndicadoresPostventa();
            actualizarIndicadoresFlujo();
            cargarTareasCalendarioIntegrado();

            if (typeof mostrarAlertaCentro === "function") {
                mostrarAlertaCentro("Postventa actualizada", "Los cambios se guardaron correctamente.", "ok");
            }
        } catch (e) {
            console.error(e);
            alert(e.message || "No se pudo guardar.");
        }
    });
}

function agruparTareasParaEditor(rows) {
    // rows puede venir duplicado si hay múltiples ejecutantes por tarea
    const map = new Map();
    for (const r of (Array.isArray(rows) ? rows : [])) {
        const id = Number(r.id_tarea);
        if (!Number.isFinite(id) || id <= 0) continue;
        const cur = map.get(id) || {
            id_tarea: id,
            descripcion: r.descripcion_tarea || "",
            inicio: fmtFechaISO(r.fecha_inicio),
            termino: fmtFechaISO(r.fecha_termino || r.fecha_inicio),
            ejecutantes: []
        };
        if (r.id_ejecutante) {
            cur.ejecutantes.push({
                id_ejecutante: Number(r.id_ejecutante),
                nombre: r.nombre_ejecutante || "",
                especialidad: r.especialidad || ""
            });
        }
        map.set(id, cur);
    }
    const tareas = Array.from(map.values()).sort((a, b) => a.id_tarea - b.id_tarea);
    // Si una tarea no trae ejecutantes (raro), deja 1 ejecutante vacío para editarla
    for (const t of tareas) {
        if (!t.ejecutantes.length) t.ejecutantes.push({ id_ejecutante: 0, nombre: "", especialidad: "" });
    }
    return tareas;
}

function construirOptions(items, valueKey, labelFn, selectedValue) {
    const sel = String(selectedValue ?? "");
    return (Array.isArray(items) ? items : []).map(it => {
        const v = String(it?.[valueKey] ?? "");
        const label = labelFn(it);
        const selected = (v && v === sel) ? " selected" : "";
        return `<option value="${escapeHtml(v)}"${selected}>${escapeHtml(label)}</option>`;
    }).join("");
}

function construirHtmlModalEditarRegistro(ctx) {
    const det = ctx.det || {};
    const pv = ctx.pv || {};
    const modo = String(ctx.modo || "familia");

    const tareas = agruparTareasParaEditor(ctx.tareasRaw);

    const opcionesOrigen = [
        "Correo",
        "Entidad Patrocinante",
        "Jocelin",
        "MDA",
        "Nuevas / Entrega",
        "Serviu",
        "Terreno"
    ];

    const origenOptions = `<option value="" disabled>Seleccionar origen...</option>` + opcionesOrigen.map(o => {
        const s = String(det.origen || "") === o ? " selected" : "";
        return `<option value="${escapeHtml(o)}"${s}>${escapeHtml(o)}</option>`;
    }).join("");

    const familiasOptions = `<option value="" disabled>Seleccione familia...</option>` +
        construirOptions(ctx.familias, "id_familia", (it) => it.nombre_familia || "-", det.id_familia);

    const subOptions = `<option value="" disabled>Seleccione subfamilia...</option>` +
        construirOptions(ctx.subfamilias, "id_subfamilia", (it) => it.nombre_subfamilia || "-", det.id_subfamilia);

    const respOptions = `<option value="" disabled>Seleccione responsable...</option>` +
        construirOptions(ctx.responsables, "id_responsable", (it) => (it.nombre_responsable ? `${it.nombre_responsable}${it.cargo ? ` (${it.cargo})` : ""}` : "-"), det.id_responsable);

    const etiqueta = String(det.etiqueta_accion || "");
    const etiquetaOptions = `
        <option value="" disabled>Seleccionar...</option>
        <option value="APLICA"${etiqueta === "APLICA" ? " selected" : ""}>APLICA</option>
        <option value="NO APLICA"${etiqueta === "NO APLICA" ? " selected" : ""}>NO APLICA</option>
    `;

    const tareasHtml = (tareas.length ? tareas : [{ id_tarea: 0, descripcion: "", inicio: "", termino: "", ejecutantes: [{ id_ejecutante: 0 }] }])
        .flatMap(t => t.ejecutantes.map(ej => ({
            id_tarea: t.id_tarea,
            descripcion: t.descripcion,
            inicio: t.inicio,
            termino: t.termino,
            id_ejecutante: ej.id_ejecutante || 0
        })))
        .map(row => {
            const ejecOptions = `<option value="" disabled>Ejecutante...</option>` +
                construirOptions(ctx.ejecutantes, "id_ejecutante", (it) => (it.nombre_ejecutante ? `${it.nombre_ejecutante}${it.especialidad ? ` (${it.especialidad})` : ""}` : "-"), row.id_ejecutante || "");

            return `
                <div class="pv-edit-task-row" data-gm-task-row data-id-tarea="${escapeHtml(String(row.id_tarea || 0))}">
                    <div class="pv-edit-cell">
                        <span class="pv-edit-cell-label">Ejecutante</span>
                        <select class="pv-edit-input" data-gm-ejecutante>${ejecOptions}</select>
                    </div>
                    <div class="pv-edit-cell">
                        <span class="pv-edit-cell-label">Inicio</span>
                        <input class="pv-edit-input" type="date" data-gm-inicio value="${escapeHtml(row.inicio || "")}">
                    </div>
                    <div class="pv-edit-cell">
                        <span class="pv-edit-cell-label">Término</span>
                        <input class="pv-edit-input" type="date" data-gm-termino value="${escapeHtml(row.termino || "")}">
                    </div>
                    <div class="pv-edit-cell">
                        <span class="pv-edit-cell-label">Tarea</span>
                        <input class="pv-edit-input" type="text" data-gm-desc placeholder="Descripción" value="${escapeHtml(row.descripcion || "")}">
                    </div>
                    <div class="pv-edit-cell pv-edit-cell--action">
                        <span class="pv-edit-cell-label">Acción</span>
                        <button type="button" class="pv-btn danger pv-edit-task-del" data-gm-del-row title="Quitar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join("");

    // Para edición de familia/tarea: NO mostramos el apartado Postventa (solo en "Editar postventa").
    const headerChips = `
        <div class="pv-modal-box pv-edit-summary">
            <h4>Resumen</h4>
            <div class="pv-edit-summary-chips">
                <span class="pv-chip">Postventa #${escapeHtml(String(pv.id_postventa || ""))}</span>
                <span class="pv-chip">${escapeHtml(pv.nombre_proyecto || "-")}</span>
                <span class="pv-chip">Casa ${escapeHtml(String(pv.numero_identificador || "-"))}</span>
                <span class="pv-chip">${escapeHtml(pv.cliente || "-")}</span>
            </div>
        </div>
    `;

    const familiaBox = `
        <div class="pv-modal-box">
            <h4>Familia</h4>
            <div class="pv-edit-fields">
                <div class="pv-edit-field">
                    <label>Origen *</label>
                    <select class="pv-edit-input" id="gm_origen">${origenOptions}</select>
                </div>
                <div class="pv-edit-field">
                    <label>Familia *</label>
                    <select class="pv-edit-input" id="gm_familia">${familiasOptions}</select>
                </div>
                <div class="pv-edit-field">
                    <label>Subfamilia *</label>
                    <select class="pv-edit-input" id="gm_subfamilia">${subOptions}</select>
                </div>
                <div class="pv-edit-field">
                    <label>Recinto *</label>
                    <input class="pv-edit-input" type="text" id="gm_recinto" value="${escapeHtml(det.recinto || "")}">
                </div>
                <div class="pv-edit-field pv-edit-field--full">
                    <label>Comentarios previos</label>
                    <input class="pv-edit-input" type="text" id="gm_comentarios" value="${escapeHtml(det.comentarios_previos || "")}">
                </div>
                <div class="pv-edit-field">
                    <label>Fecha levantamiento *</label>
                    <input class="pv-edit-input" type="date" id="gm_f_lev" value="${escapeHtml(det.fecha_levantamiento ? fmtFechaISO(det.fecha_levantamiento) : "")}">
                </div>
                <div class="pv-edit-field">
                    <label>Fecha visita</label>
                    <input class="pv-edit-input" type="date" id="gm_f_vis" value="${escapeHtml(det.fecha_visita ? fmtFechaISO(det.fecha_visita) : "")}">
                </div>
                <div class="pv-edit-field">
                    <label>Responsable *</label>
                    <select class="pv-edit-input" id="gm_responsable">${respOptions}</select>
                </div>
                <div class="pv-edit-field">
                    <label>Etiqueta Acción *</label>
                    <select class="pv-edit-input" id="gm_etiqueta">${etiquetaOptions}</select>
                </div>
                <div class="pv-edit-field">
                    <label>Fecha firma acta</label>
                    <input class="pv-edit-input" type="date" id="gm_f_acta" value="${escapeHtml(det.fecha_firma_acta ? fmtFechaISO(det.fecha_firma_acta) : "")}">
                </div>
            </div>
        </div>
    `;

    const tareasBox = `
        <div class="pv-modal-box" id="gm_box_tareas">
            <div class="pv-edit-tareas-head">
                <h4>Ejecutantes y planificación</h4>
                <button type="button" class="pv-btn" id="gm_add_task">
                    <i class="fas fa-plus"></i> Agregar ejecutante
                </button>
            </div>
            <div class="pv-edit-task-list" id="gm_task_list">
                <div class="pv-edit-task-row pv-edit-task-row--head">
                    <div>Ejecutante</div><div>Inicio</div><div>Término</div><div>Tarea</div><div></div>
                </div>
                ${tareasHtml}
            </div>
        </div>
    `;

    const acciones = `
        <div class="pv-edit-actions">
            <button type="button" class="btn-principal" id="gm_save_registro">
                <i class="fas fa-save"></i> Guardar cambios
            </button>
        </div>
    `;

    // Modo tarea: mostramos solo tareas + guardar (sin caja de familia)
    if (modo === "tarea") {
        return `
            <div class="pv-edit-grid pv-edit-grid--one">
                ${headerChips}
                ${tareasBox}
                ${acciones}
            </div>
        `;
    }

    // Modo familia (default): familia + tareas + guardar
    return `
        <div class="pv-edit-grid pv-edit-grid--one">
            ${headerChips}
            ${familiaBox}
            ${tareasBox}
            ${acciones}
        </div>
    `;
}

function wireModalEditarRegistro(ctx) {
    const idRegistro = Number(ctx.id_registro);
    const idPostventa = Number(ctx.id_postventa);

    const selFam = document.getElementById("gm_familia");
    const selSub = document.getElementById("gm_subfamilia");
    const btnAdd = document.getElementById("gm_add_task");
    const list = document.getElementById("gm_task_list");
    const btnSave = document.getElementById("gm_save_registro");

    selFam?.addEventListener("change", async () => {
        const idFam = Number(selFam.value);
        if (!Number.isFinite(idFam) || idFam <= 0 || !selSub) return;
        selSub.innerHTML = `<option value="" disabled selected>Cargando...</option>`;
        try {
            const res = await fetch(`/api/familias/${idFam}/subfamilias`);
            const data = await res.json().catch(() => []);
            if (!res.ok) throw new Error("No se pudieron cargar subfamilias");
            const opts = `<option value="" disabled selected>Seleccione subfamilia...</option>` +
                (Array.isArray(data) ? data : []).map(sf => `<option value="${escapeHtml(sf.id_subfamilia)}">${escapeHtml(sf.nombre_subfamilia || "-")}</option>`).join("");
            selSub.innerHTML = opts;
        } catch (e) {
            console.error(e);
            selSub.innerHTML = `<option value="" disabled selected>Error</option>`;
        }
    });

    list?.addEventListener("click", (e) => {
        const del = e.target.closest("[data-gm-del-row]");
        if (!del) return;
        const row = del.closest("[data-gm-task-row]");
        row?.remove();
    });

    btnAdd?.addEventListener("click", () => {
        if (!list) return;
        const ejecSel = document.querySelector("[data-gm-task-row] select[data-gm-ejecutante]");
        const options = ejecSel ? ejecSel.innerHTML : `<option value=\"\" disabled selected>Ejecutante...</option>`;
        const row = document.createElement("div");
        row.className = "pv-edit-task-row";
        row.setAttribute("data-gm-task-row", "");
        row.setAttribute("data-id-tarea", "0");
        row.innerHTML = `
            <div class="pv-edit-cell">
                <span class="pv-edit-cell-label">Ejecutante</span>
                <select class="pv-edit-input" data-gm-ejecutante>${options}</select>
            </div>
            <div class="pv-edit-cell">
                <span class="pv-edit-cell-label">Inicio</span>
                <input class="pv-edit-input" type="date" data-gm-inicio value="">
            </div>
            <div class="pv-edit-cell">
                <span class="pv-edit-cell-label">Término</span>
                <input class="pv-edit-input" type="date" data-gm-termino value="">
            </div>
            <div class="pv-edit-cell">
                <span class="pv-edit-cell-label">Tarea</span>
                <input class="pv-edit-input" type="text" data-gm-desc placeholder="Descripción" value="">
            </div>
            <div class="pv-edit-cell pv-edit-cell--action">
                <span class="pv-edit-cell-label">Acción</span>
                <button type="button" class="pv-btn danger pv-edit-task-del" data-gm-del-row title="Quitar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        list.appendChild(row);
    });

    btnSave?.addEventListener("click", async () => {
        const origen = document.getElementById("gm_origen")?.value || "";
        const idFamilia = Number(document.getElementById("gm_familia")?.value || 0);
        const idSubfamilia = Number(document.getElementById("gm_subfamilia")?.value || 0);
        const recinto = String(document.getElementById("gm_recinto")?.value || "").trim();
        const comentarios = String(document.getElementById("gm_comentarios")?.value || "").trim();
        const fLev = document.getElementById("gm_f_lev")?.value || "";
        const fVis = document.getElementById("gm_f_vis")?.value || "";
        const idResp = Number(document.getElementById("gm_responsable")?.value || 0);
        const etiqueta = String(document.getElementById("gm_etiqueta")?.value || "");
        const fActa = document.getElementById("gm_f_acta")?.value || "";

        if (!origen) return alert("Origen es obligatorio.");
        if (!idFamilia) return alert("Familia es obligatoria.");
        if (!idSubfamilia) return alert("Subfamilia es obligatoria.");
        if (!recinto) return alert("Recinto es obligatorio.");
        if (!fLev) return alert("Fecha levantamiento es obligatoria.");
        if (!idResp) return alert("Responsable es obligatorio.");
        if (!etiqueta) return alert("Etiqueta acción es obligatoria.");

        const rows = Array.from(document.querySelectorAll("[data-gm-task-row]"));
        const tareas = rows.map(r => {
            const idEj = Number(r.querySelector("[data-gm-ejecutante]")?.value || 0);
            const inicio = r.querySelector("[data-gm-inicio]")?.value || "";
            const termino = r.querySelector("[data-gm-termino]")?.value || "";
            const desc = String(r.querySelector("[data-gm-desc]")?.value || "").trim();
            return { id_ejecutante: idEj, inicio, termino, descripcion: desc };
        }).filter(t => t.id_ejecutante && t.inicio && t.descripcion);

        if (!tareas.length) return alert("Debes dejar al menos una tarea con ejecutante, fecha inicio y descripción.");

        try {
            const payload = {
                registro: {
                    id_postventa: idPostventa,
                    id_familia: idFamilia,
                    id_subfamilia: idSubfamilia,
                    id_responsable: idResp,
                    origen,
                    etiqueta_accion: etiqueta,
                    recinto,
                    comentarios_previos: comentarios,
                    fecha_levantamiento: fLev,
                    fecha_visita: fVis || null,
                    fecha_firma_acta: fActa || null
                },
                tareas
            };

            const res = await fetch(`/api/registros-familia/${idRegistro}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || "No se pudo actualizar el registro.");

            cerrarModalGestion();
            await refrescarPostventaEnArbol(idPostventa);
            cargarIndicadoresPostventa();
            actualizarIndicadoresFlujo();
            cargarTareasCalendarioIntegrado();

            if (typeof mostrarAlertaCentro === "function") {
                mostrarAlertaCentro("Registro actualizado", "Los cambios se guardaron correctamente.", "ok");
            }
        } catch (error) {
            console.error(error);
            alert(error.message || "No se pudo guardar.");
        }
    });

    if (ctx.foco === "tareas") {
        setTimeout(() => document.getElementById("gm_box_tareas")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
}

async function abrirPostventaEnFormularioDesdeGestion(idPostventa) {
    const id = Number(idPostventa);
    if (!Number.isFinite(id) || id <= 0) return;

    try {
        const res = await fetch(`/api/postventas/${id}/detalle`);
        const det = await res.json().catch(() => null);
        if (!res.ok) throw new Error(det?.error || "No se pudo cargar la postventa");

        // Salir de gestión y seleccionar la postventa (aunque sea histórica)
        setModoGestionRegistros(false);

        const select = document.getElementById("select_postventa_existente");
        if (!select) throw new Error("No se encontró el selector de postventas");

        let opt = Array.from(select.options).find(o => o.value === String(id));
        if (!opt) {
            opt = document.createElement("option");
            opt.value = String(id);
            select.appendChild(opt);
        }

        const proyecto = det?.nombre_proyecto || opt.dataset.proyecto || "-";
        const identificador = det?.numero_identificador || opt.dataset.identificador || "-";
        const cliente = det?.cliente || opt.dataset.cliente || "-";
        const estado = det?.estado_ticket || opt.dataset.estado || "-";
        const familias = String(det?.total_familias ?? opt.dataset.familias ?? 0);

        opt.dataset.proyecto = proyecto;
        opt.dataset.identificador = identificador;
        opt.dataset.cliente = cliente;
        opt.dataset.estado = estado;
        opt.dataset.familias = familias;
        opt.textContent = `#${id} - ${proyecto} - ${identificador} - Familias: ${familias}`;

        select.value = String(id);
        await seleccionarPostventaExistente();

        document.getElementById("modulo_selector_postventa")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        console.error("Error abrir postventa desde gestión:", error);
        alert(error.message || "No se pudo abrir la postventa en el formulario.");
    }
}

async function togglePostventa(card, idPostventa) {
    const isOpen = card.classList.toggle("open");
    if (!isOpen) return;

    const children = card.querySelector("[data-pv-children]");
    if (!children) return;

    await cargarFamiliasPostventaGestion(children, idPostventa);
}

async function cargarFamiliasPostventaGestion(children, idPostventa) {
    if (!children) return;
    if (children.dataset.loaded === "1") return;
    children.innerHTML = `<div class="gestion-arbol-vacio">Cargando familias...</div>`;

    try {
        const res = await fetch(`/api/postventas/${idPostventa}/registros`);
        if (!res.ok) throw new Error("No se pudieron cargar familias");
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            children.innerHTML = `<div class="gestion-arbol-vacio">Sin familias registradas.</div>`;
            children.dataset.loaded = "1";
            return;
        }

        const famHtml = data.map(rf => {
            const idRegistro = Number(rf.id_registro);
            const fam = rf.familia || "-";
            const sub = rf.subfamilia || "-";
            const recinto = rf.recinto || "-";
            const responsable = rf.responsable || "-";
            const lev = fmtFechaISO(rf.fecha_levantamiento);
            const estado = rf.estado_tarea || "Pendiente";

            return `
                <div class="fam-item"
                     data-id-registro="${idRegistro}"
                     data-familia="${escapeHtml(fam)}"
                     data-subfamilia="${escapeHtml(sub)}"
                     data-recinto="${escapeHtml(recinto)}">
                    <div class="fam-head">
                        <div class="fam-left" data-fam-toggle>
                            <button type="button" class="pv-btn" aria-label="Ver tareas">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <div>
                                <div class="t">${fam} · ${sub} · ${recinto}</div>
                                <div class="s">Registro #${idRegistro} · ${responsable} · ${lev} · ${estado}</div>
                            </div>
                        </div>
                        <div class="pv-actions">
                            <button type="button" class="pv-btn manage" data-fam-manage>
                                Gestionar
                            </button>
                        </div>
                    </div>
                    <div class="fam-children" data-fam-children>
                        <div class="gestion-arbol-vacio">Cargando tareas...</div>
                    </div>
                </div>
            `;
        }).join("");

        children.innerHTML = `<div class="fam-list">${famHtml}</div>`;
        children.dataset.loaded = "1";
    } catch (error) {
        console.error("Error cargando familias gestion:", error);
        children.innerHTML = `<div class="gestion-arbol-vacio">Error cargando familias.</div>`;
        children.dataset.loaded = "1";
    }
}

async function toggleFamilia(famEl, idRegistro) {
    const isOpen = famEl.classList.toggle("open");
    if (!isOpen) return;

    const children = famEl.querySelector("[data-fam-children]");
    if (!children) return;
    await cargarTareasFamiliaGestion(children, idRegistro);
}

async function cargarTareasFamiliaGestion(children, idRegistro) {
    if (!children) return;
    if (children.dataset.loaded === "1") return;
    children.innerHTML = `<div class="gestion-arbol-vacio">Cargando tareas...</div>`;

    try {
        const res = await fetch(`/api/registros-familia/${idRegistro}/tareas`);
        if (!res.ok) throw new Error("No se pudieron cargar tareas");
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            children.innerHTML = `<div class="gestion-arbol-vacio">Sin tareas registradas.</div>`;
            children.dataset.loaded = "1";
            return;
        }

        const tareas = agruparTareasGestion(data);

        const tasksHtml = tareas.map(t => {
            const rango = `${fmtFechaISO(t.fecha_inicio)} → ${fmtFechaISO(t.fecha_termino || t.fecha_inicio)}`;
            const desc = t.descripcion_tarea || "-";
            const ejecutantes = (t.ejecutantes && t.ejecutantes.length) ? t.ejecutantes.join(" · ") : "Sin ejecutante";
            return `
                <div class="task-item" data-id-tarea="${t.id_tarea}">
                    <div class="task-main">
                        <div class="top">
                            <div class="t">${desc}</div>
                            <div class="m">${rango}</div>
                        </div>
                        <div class="m">${ejecutantes}</div>
                    </div>
                    <div class="task-actions">
                        <button type="button" class="pv-btn manage" data-task-manage title="Gestionar tarea">
                            Gestionar
                        </button>
                    </div>
                </div>
            `;
        }).join("");

        children.innerHTML = `<div class="task-list">${tasksHtml}</div>`;
        children.dataset.loaded = "1";
    } catch (error) {
        console.error("Error tareas gestion:", error);
        children.innerHTML = `<div class="gestion-arbol-vacio">Error cargando tareas.</div>`;
        children.dataset.loaded = "1";
    }
}

async function eliminarTareaGestion(idTarea, idRegistro, opts = {}) {
    const id = Number(idTarea);
    if (!Number.isFinite(id) || id <= 0) return;
    if (!opts?.skipConfirm) {
        const ok = confirm(`¿Eliminar la tarea #${id}?`);
        if (!ok) return;
    }

    try {
        const res = await fetch(`/api/tareas/${id}`, { method: "DELETE" });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "No se pudo eliminar la tarea");

        // Refrescar solo las tareas de la familia abierta
        const famEl = document.querySelector(`.fam-item[data-id-registro='${Number(idRegistro)}']`);
        const children = famEl?.querySelector("[data-fam-children]");
        if (children) children.dataset.loaded = "0";
        if (famEl?.classList.contains("open") && children) {
            await cargarTareasFamiliaGestion(children, Number(idRegistro));
        }

        cargarIndicadoresPostventa();
        actualizarIndicadoresFlujo();
        cargarTareasCalendarioIntegrado();

        if (typeof mostrarAlertaCentro === "function") {
            mostrarAlertaCentro("Tarea eliminada", "Se eliminó la tarea correctamente.", "ok");
        }
    } catch (error) {
        console.error("Error eliminando tarea:", error);
        alert(error.message || "No se pudo eliminar la tarea.");
    }
}

async function eliminarRegistroFamiliaGestion(idRegistro, idPostventa, opts = {}) {
    const id = Number(idRegistro);
    if (!Number.isFinite(id) || id <= 0) return;
    if (!opts?.skipConfirm) {
        const confirma = confirm(`¿Eliminar el registro de familia #${id}? Esta acción no se puede deshacer.`);
        if (!confirma) return;
    }

    try {
        const delRes = await fetch(`/api/registros-familia/${id}`, { method: "DELETE" });
        const delData = await delRes.json().catch(() => null);
        if (!delRes.ok) throw new Error(delData?.error || "No se pudo eliminar la familia");

        await refrescarPostventaEnArbol(idPostventa);

        await cargarPostventasRecientes(postventaActiva, false);
        cargarIndicadoresPostventa();
        actualizarIndicadoresFlujo();
        cargarTareasCalendarioIntegrado();
    } catch (error) {
        console.error("Error eliminando familia:", error);
        alert(error.message || "No se pudo eliminar la familia.");
    }
}

async function refrescarPostventaEnArbol(idPostventa) {
    const id = Number(idPostventa);
    if (!Number.isFinite(id) || id <= 0) return cargarGestionArbol();
    const card = document.querySelector(`.pv-card[data-id-postventa='${id}']`);
    const children = card?.querySelector("[data-pv-children]");
    if (!card || !children) return cargarGestionArbol();
    const proj = card.closest(".proj-card");
    if (proj) proj.classList.add("open");
    card.classList.add("open");
    children.dataset.loaded = "0";
    await cargarFamiliasPostventaGestion(children, id);
}

async function eliminarPostventaPorId(idPostventa, opts = {}) {
    const id = Number(idPostventa);
    if (!Number.isFinite(id) || id <= 0) return;
    if (!opts?.skipConfirm) {
        const confirma = confirm(`¿Eliminar la postventa #${id} completa? Se eliminarán todas sus familias y tareas.`);
        if (!confirma) return;
    }

    try {
        const res = await fetch(`/api/postventas/${id}`, { method: "DELETE" });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "No se pudo eliminar la postventa.");

        // Si era la activa, resetea cabeceras/selección
        if (postventaActiva && Number(postventaActiva) === id) {
            postventaActiva = null;
            historialFamilias = [];
            resetearFormularioPostventa();
            bloquearCamposCabecera(false);
            renderizarUltimosRegistros();
            limpiarAnclajePostventa();
            actualizarDetalleSeleccionada({ estado: "-", familias: 0 });
        }

        await cargarGestionArbol();
        await cargarPostventasRecientes(postventaActiva, false);
        cargarIndicadoresPostventa();
        actualizarIndicadoresFlujo();
        cargarTareasCalendarioIntegrado();

        if (typeof mostrarAlertaCentro === "function") {
            mostrarAlertaCentro("Postventa eliminada correctamente");
        }
    } catch (error) {
        console.error("Error eliminando postventa:", error);
        alert(error.message || "No se pudo eliminar la postventa.");
    }
}

async function editarRegistroFamiliaDesdeGestion(idRegistro) {
    const id = Number(idRegistro);
    if (!Number.isFinite(id) || id <= 0) return;

    try {
        const [resDet, resTareas] = await Promise.all([
            fetch(`/api/registros-familia/${id}/detalle`),
            fetch(`/api/registros-familia/${id}/tareas`)
        ]);
        const det = await resDet.json();
        const tareas = await resTareas.json();
        if (!resDet.ok) throw new Error(det?.error || "No se pudo cargar el registro");
        if (!resTareas.ok) throw new Error(tareas?.error || "No se pudieron cargar tareas");

        registroFamiliaEditId = id;
        registroFamiliaEditPostventa = Number(det.id_postventa);

        // Cambia a modo familias
        setModoGestionRegistros(false);

        // Asegura que quede anclada la postventa del registro editado
        postventaActiva = Number(det.id_postventa);

        // Carga detalle (cliente/proyecto/inmueble) para consistencia visual
        try {
            const detallePV = await cargarDetallePostventaSeleccionada(postventaActiva);
            actualizarDetalleSeleccionada({
                estado: detallePV?.estado_ticket || "-",
                familias: detallePV?.total_familias || 0
            });
        } catch (_) { /* noop */ }

        // Completa formulario de familia
        document.getElementById("reg_origen").value = String(det.origen || "");
        document.getElementById("select_familia").value = String(det.id_familia || "");
        await cargarSubfamilias();
        document.getElementById("select_subfamilia").value = String(det.id_subfamilia || "");
        document.getElementById("reg_recinto").value = det.recinto || "";
        document.getElementById("reg_comentarios_cliente").value = det.comentarios_previos || "";
        document.getElementById("reg_fecha_levantamiento").value = det.fecha_levantamiento ? fmtFechaISO(det.fecha_levantamiento) : "";
        document.getElementById("reg_fecha_visita").value = det.fecha_visita ? fmtFechaISO(det.fecha_visita) : "";
        document.getElementById("reg_responsable").value = String(det.id_responsable || "");
        document.getElementById("fecha_firma_acta").value = det.fecha_firma_acta ? fmtFechaISO(det.fecha_firma_acta) : "";
        document.getElementById("etiqueta_accion").value = String(det.etiqueta_accion || "");
        actualizarColorEtiquetaAccion?.();

        // Carga tabla de tareas
        const tbody = document.getElementById("body_ejecutantes");
        if (tbody) tbody.innerHTML = "";
        (Array.isArray(tareas) ? tareas : []).forEach(t => {
            if (!tbody) return;
            const idEj = t.id_ejecutante || "";
            const nombre = t.nombre_ejecutante || "Ejecutante";
            const especialidad = t.especialidad || "Sin especialidad";
            const inicio = fmtFechaISO(t.fecha_inicio);
            const termino = fmtFechaISO(t.fecha_termino || t.fecha_inicio);
            const desc = t.descripcion_tarea || "-";

            const fila = document.createElement("tr");
            fila.classList.add("fila-tarea");
            fila.innerHTML = `
                <td data-id="${idEj}">
                    <div class="ejecutante-con-etiqueta">
                        <span class="ejecutante-nombre">${nombre}</span>
                        <span class="tag-especialidad">${especialidad}</span>
                    </div>
                </td>
                <td>${inicio}</td>
                <td>${termino}</td>
                <td>${desc}</td>
                <td><button onclick="this.parentElement.parentElement.remove()">X</button></td>
            `;
            tbody.appendChild(fila);
        });

        // UI edición
        const btnGuardar = document.querySelector(".btn-guardar-familia");
        if (btnGuardar) {
            btnGuardar.innerHTML = '<i class="fas fa-pen"></i> Actualizar familia';
        }
        const btnCancelar = document.getElementById("btn_cancelar_edicion_familia");
        if (btnCancelar) btnCancelar.style.display = "";

        const moduloFamilia = document.getElementById("modulo_registro_familia");
        if (moduloFamilia) moduloFamilia.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        console.error("Error edición familia:", error);
        alert(error.message || "No se pudo cargar para edición.");
    }
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

let modoReporteria = false;
function setModoReporteria(activo) {
    modoReporteria = Boolean(activo);

    const panelReport = document.getElementById("panel_reporteria");
    if (panelReport) panelReport.hidden = !modoReporteria;

    // En reportes ocultamos todos los módulos operativos (pero mantenemos header + KPIs)
    const modulosOperativos = [
        document.getElementById("modulo_selector_postventa"),
        document.getElementById("modulo_identificacion_inmueble"),
        document.getElementById("modulo_datos_postventa"),
        document.getElementById("modulo_registro_familia"),
        document.getElementById("modulo_resumen_postventa"),
        document.getElementById("modulo_calendario_embebido"),
        document.getElementById("panel_gestion_registros")
    ];
    modulosOperativos.forEach(m => { if (m) m.hidden = modoReporteria; });

    if (modoReporteria && modoGestionRegistros) {
        setModoGestionRegistros(false);
    }

    const btnPlan = document.getElementById("btn_tab_planificacion");
    const btnRep = document.getElementById("btn_tab_reporteria");
    if (btnPlan) {
        btnPlan.classList.toggle("is-active", !modoReporteria);
        btnPlan.setAttribute("aria-selected", (!modoReporteria).toString());
    }
    if (btnRep) {
        btnRep.classList.toggle("is-active", modoReporteria);
        btnRep.setAttribute("aria-selected", (modoReporteria).toString());
    }

    // Por defecto, reporteria abre "Gestión de registros"
    if (modoReporteria) {
        setVistaReporteria("gestion");
    }
}

let gestionPanelMount = null;
function ensureGestionPanelMount() {
    if (gestionPanelMount) return gestionPanelMount;
    const panel = document.getElementById("panel_gestion_registros");
    if (!panel) return null;
    const placeholder = document.createComment("panel_gestion_registros_mount");
    const parent = panel.parentNode;
    if (!parent) return null;
    parent.insertBefore(placeholder, panel);
    gestionPanelMount = { panel, parent, placeholder };
    return gestionPanelMount;
}

function mountGestionPanelTo(container) {
    const m = ensureGestionPanelMount();
    if (!m || !container) return;
    if (m.panel.parentNode !== container) container.appendChild(m.panel);
    m.panel.hidden = false;

    // Contexto: dentro de Reportería no dependemos de "postventa seleccionada"
    m.panel.dataset.contexto = "reporteria";
    const elEstado = document.getElementById("estado_panel_gestion");
    if (elEstado) {
        elEstado.textContent = "Histórico";
        elEstado.classList.remove("estado-postventa-modulo--sin");
        elEstado.classList.add("estado-postventa-modulo--ok");
    }
}

function restoreGestionPanel() {
    const m = gestionPanelMount;
    if (!m) return;
    if (m.panel.parentNode !== m.parent) {
        m.parent.insertBefore(m.panel, m.placeholder.nextSibling);
    }
    if (m.panel) delete m.panel.dataset.contexto;
}

function setVistaReporteria(vista) {
    const v = String(vista || "gestion");
    const views = {
        gestion: document.getElementById("rep_view_gestion"),
        historico: document.getElementById("rep_view_historico"),
        cierre: document.getElementById("rep_view_cierre"),
        usuarios: document.getElementById("rep_view_usuarios"),
        auditoria: document.getElementById("rep_view_auditoria")
    };

    Object.entries(views).forEach(([k, el]) => {
        if (!el) return;
        el.hidden = (k !== v);
    });

    // Marca tab activa
    document.querySelectorAll(".panel-reporteria .report-tab").forEach(btn => {
        const key = btn.getAttribute("data-rep-view") || "";
        btn.classList.toggle("is-active", key === v);
    });

    // Gestión de registros dentro de reportes: montamos el panel existente
    if (v === "gestion") {
        const host = views.gestion;
        mountGestionPanelTo(host);
        inicializarGestionArbol();
        cargarGestionArbol();
    } else if (v === "historico") {
        initHistoricoEmbebido();
    } else {
        // Si nos vamos a otra vista, dejamos el panel montado en reportería pero oculto para no romper listeners
        const panel = document.getElementById("panel_gestion_registros");
        if (panel) panel.hidden = true;
    }
}

// ======================================================
// Reportería: Histórico embebido (sin salir de registro.html)
// ======================================================

let historicoEmbebidoInit = false;

function repHistGet(id) {
    return document.getElementById(id);
}

function repHistSetOptions(selectId, rows, mapLabel, mapValue) {
    const select = repHistGet(selectId);
    if (!select) return;
    const base = select.options[0] ? select.options[0].outerHTML : '<option value="">Todos</option>';
    select.innerHTML = base;
    (Array.isArray(rows) ? rows : []).forEach(row => {
        const op = document.createElement("option");
        op.value = mapValue(row);
        op.textContent = mapLabel(row);
        select.appendChild(op);
    });
}

function repHistFiltros() {
    return {
        id_proyecto: repHistGet("rep_hist_filtro_proyecto")?.value || "",
        cliente: repHistGet("rep_hist_filtro_cliente")?.value.trim() || "",
        id_familia: repHistGet("rep_hist_filtro_familia")?.value || "",
        estado_familia: repHistGet("rep_hist_filtro_estado")?.value || ""
    };
}

function repHistQuery(paramsObj) {
    const qs = new URLSearchParams();
    Object.entries(paramsObj).forEach(([k, v]) => {
        if (v !== "") qs.append(k, v);
    });
    return qs.toString();
}

function repHistFmtFecha(valor) {
    if (!valor) return "-";
    return fmtFechaISO(valor);
}

function repHistRenderTabla(rows) {
    const tbody = repHistGet("rep_hist_tbody");
    const total = repHistGet("rep_hist_total");
    if (!tbody) return;

    const list = Array.isArray(rows) ? rows : [];
    if (total) total.textContent = `${list.length} resultados`;

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8">Sin resultados para los filtros seleccionados.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(r => {
        return `
            <tr>
                <td>#${r.id_postventa}</td>
                <td>${escapeHtml(r.nombre_proyecto || "-")}</td>
                <td>${escapeHtml(r.numero_identificador || "-")}</td>
                <td>${escapeHtml(r.cliente || "-")}</td>
                <td>${escapeHtml(r.familia || "-")}</td>
                <td>${escapeHtml(r.subfamilia || "-")}</td>
                <td>${escapeHtml(r.recinto || "-")}</td>
                <td>${escapeHtml(r.estado_familia || "-")}</td>
            </tr>
        `;
    }).join("");
}

async function repHistBuscar() {
    const filtros = repHistFiltros();
    const query = repHistQuery(filtros);
    const url = query ? `/api/historico/registros?${query}` : "/api/historico/registros";
    const res = await fetch(url);
    if (!res.ok) throw new Error("No se pudo cargar el histórico");
    const data = await res.json();
    repHistRenderTabla(data);
}

function repHistLimpiar() {
    [
        "rep_hist_filtro_proyecto",
        "rep_hist_filtro_cliente",
        "rep_hist_filtro_familia",
        "rep_hist_filtro_estado"
    ].forEach(id => {
        const el = repHistGet(id);
        if (el) el.value = "";
    });
}

async function initHistoricoEmbebido() {
    if (historicoEmbebidoInit) return;
    historicoEmbebidoInit = true;

    try {
        const [proyectosRes, familiasRes] = await Promise.all([
            fetch("/api/proyectos"),
            fetch("/api/familias")
        ]);
        const [proyectos, familias] = await Promise.all([
            proyectosRes.json(),
            familiasRes.json()
        ]);

        repHistSetOptions("rep_hist_filtro_proyecto", proyectos, p => p.nombre_proyecto, p => p.id_proyecto);
        repHistSetOptions("rep_hist_filtro_familia", familias, f => f.nombre_familia, f => f.id_familia);

        await repHistBuscar();
    } catch (error) {
        console.error("Error inicializando histórico embebido:", error);
        const tbody = repHistGet("rep_hist_tbody");
        if (tbody) tbody.innerHTML = '<tr><td colspan="8">No se pudieron cargar datos del histórico.</td></tr>';
    }

    repHistGet("rep_hist_btn_limpiar")?.addEventListener("click", () => {
        repHistLimpiar();
        repHistBuscar().catch(() => null);
    });

    const debounce = (fn, ms = 250) => {
        let t = null;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    };
    const buscarDeb = debounce(() => repHistBuscar().catch(() => null), 250);

    [
        "rep_hist_filtro_proyecto",
        "rep_hist_filtro_familia",
        "rep_hist_filtro_estado"
    ].forEach(id => {
        repHistGet(id)?.addEventListener("change", buscarDeb);
    });

    [
        "rep_hist_filtro_cliente"
    ].forEach(id => {
        repHistGet(id)?.addEventListener("input", buscarDeb);
        repHistGet(id)?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                repHistBuscar().catch(() => null);
            }
        });
    });
}

function setModoGestionRegistros(activo) {
    modoGestionRegistros = Boolean(activo);

    const panel = document.getElementById("panel_gestion_registros");
    const modulos = [
        document.getElementById("modulo_selector_postventa"),
        document.getElementById("modulo_identificacion_inmueble"),
        document.getElementById("modulo_datos_postventa"),
        document.getElementById("modulo_registro_familia"),
        document.getElementById("modulo_resumen_postventa"),
        document.getElementById("modulo_calendario_embebido")
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
        const elEstado = document.getElementById("estado_panel_gestion");
        if (elEstado) {
            elEstado.textContent = "Histórico";
            elEstado.classList.remove("estado-postventa-modulo--sin");
            elEstado.classList.add("estado-postventa-modulo--ok");
        }
        inicializarGestionArbol();
        cargarGestionArbol();
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

        const contentType = res.headers.get("content-type") || "";
        const data = contentType.includes("application/json") ? await res.json() : null;
        if (!res.ok) {
            const msg = data?.error
                ? String(data.error)
                : `No se pudo actualizar el estado (HTTP ${res.status}).`;
            throw new Error(msg);
        }

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

    const btnCancelarEd = document.getElementById("btn_cancelar_edicion_familia");
    if (btnCancelarEd) {
        btnCancelarEd.addEventListener("click", () => {
            registroFamiliaEditId = null;
            registroFamiliaEditPostventa = null;
            const btnGuardar = document.querySelector(".btn-guardar-familia");
            if (btnGuardar) btnGuardar.innerHTML = '<i class="fas fa-save"></i> Agregar familia a la Postventa';
            btnCancelarEd.style.display = "none";
            limpiarFormularioFamilia();
        });
    }

    const btnGestionFamilias = document.getElementById("btn_gestion_familias");
    if (btnGestionFamilias) {
        btnGestionFamilias.addEventListener("click", () => {
            setModoGestionRegistros(false);
            const moduloFamilia = document.getElementById("modulo_registro_familia");
            if (moduloFamilia) moduloFamilia.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    // Tabs superiores: Planificación / Reportería
    const btnTabPlan = document.getElementById("btn_tab_planificacion");
    const btnTabRep = document.getElementById("btn_tab_reporteria");
    if (btnTabPlan) btnTabPlan.addEventListener("click", () => setModoReporteria(false));
    if (btnTabRep) btnTabRep.addEventListener("click", () => setModoReporteria(true));

    // Tabs internos (Reportería)
    document.querySelectorAll(".panel-reporteria .report-tab[data-rep-view]").forEach(btn => {
        btn.addEventListener("click", () => {
            const v = btn.getAttribute("data-rep-view") || "gestion";
            setVistaReporteria(v);
        });
    });

    actualizarEstadoPanelGestion("Ninguna");
    setGestionArbolMensaje("Listado de postventas. Selecciona una para ver familias y tareas.");
    setModoGestionRegistros(false);
    setModoReporteria(false);
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

        const selectGestion = document.getElementById("gestion_filtro_proyecto");
        if (selectGestion) {
            selectGestion.innerHTML = '<option value="">Todos</option>';
            data.forEach(p => {
                selectGestion.innerHTML += `<option value="${p.id_proyecto}">${p.nombre_proyecto}</option>`;
            });
        }

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
    const esEdicion = Boolean(registroFamiliaEditId);
    const idPostventaTarget = Number(registroFamiliaEditPostventa || postventaActiva);

    if (!idPostventaTarget) {
        alert("Error: No hay una Postventa anclada. Genere una primero.");
        return;
    }

    postventaActiva = idPostventaTarget;

    // 2. Recolectar datos (Asegurando que no vayan NULL a columnas obligatorias)
    const registro = {
        id_postventa: idPostventaTarget,
        id_familia: document.getElementById("select_familia").value,
        id_subfamilia: document.getElementById("select_subfamilia").value,
        id_responsable: document.getElementById("reg_responsable").value,
        origen: document.getElementById("reg_origen").value,
        etiqueta_accion: document.getElementById("etiqueta_accion").value,
        recinto: document.getElementById("reg_recinto").value,
        comentarios_previos: document.getElementById("reg_comentarios_cliente").value,
        fecha_firma_acta: document.getElementById("fecha_firma_acta").value || null,

        // fechas del formulario (fecha_visita es opcional)
        fecha_levantamiento: document.getElementById("reg_fecha_levantamiento").value || new Date().toISOString().split('T')[0],
        fecha_visita: document.getElementById("reg_fecha_visita").value || null
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
        const endpoint = esEdicion
            ? `/api/registros-familia/${registroFamiliaEditId}`
            : "/api/guardar-familia-completa";
        const response = await fetch(endpoint, {
            method: esEdicion ? "PUT" : "POST",
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

        if (!esEdicion) {
            historialFamilias.unshift({
                familia: familiaTxt,
                subfamilia: subfamiliaTxt,
                recinto: recintoTxt,
                levantamiento: fechaLevTxt,
                responsable: responsableTxt,
                cargo_responsable: cargoResponsableTxt
            });
        }
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
            esEdicion
                ? `Familia actualizada: ${familiaTxt} · ${recintoTxt}`
                : `Familia agregada: ${familiaTxt} · ${recintoTxt}`,
            { ms: 3000 }
        );

        // Dejar el módulo listo para registrar una nueva familia desde 0 (sin desanclar postventa)
        limpiarFormularioFamilia();

        console.log("Guardado exitoso con ID:", data.id_registro);

    } catch (error) {
        console.error("Error al guardar:", error);
        alert("No se pudo guardar: " + error.message);
    }
}

function limpiarFormularioFamilia() {
    // Sale de modo edición si estaba activo
    registroFamiliaEditId = null;
    registroFamiliaEditPostventa = null;
    const btnGuardar = document.querySelector(".btn-guardar-familia");
    if (btnGuardar) btnGuardar.innerHTML = '<i class="fas fa-save"></i> Agregar familia a la Postventa';
    const btnCancelar = document.getElementById("btn_cancelar_edicion_familia");
    if (btnCancelar) btnCancelar.style.display = "none";

    const setSelectPlaceholder = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.selectedIndex = 0;
        // Si el primer option no tiene value, dejamos value en "" para consistencia.
        el.value = el.value || "";
    };

    const setValue = (id, val = "") => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    // Campos "Detalles de la familia"
    setSelectPlaceholder("reg_origen");
    setSelectPlaceholder("select_familia");

    // Subfamilias: vuelve al placeholder
    const sub = document.getElementById("select_subfamilia");
    if (sub) {
        sub.innerHTML = '<option value="" disabled selected>Seleccionar subfamilia...</option>';
    }

    setValue("reg_recinto", "");

    // Campos "Detalles del trabajo"
    setValue("reg_comentarios_cliente", "");
    setValue("reg_fecha_levantamiento", "");
    setValue("reg_fecha_visita", "");
    setSelectPlaceholder("reg_responsable");
    setValue("reg_observaciones_internas", "");
    setValue("fecha_firma_acta", "");

    const etiqueta = document.getElementById("etiqueta_accion");
    if (etiqueta) {
        etiqueta.selectedIndex = 0;
        etiqueta.value = "";
        if (typeof actualizarColorEtiquetaAccion === "function") {
            actualizarColorEtiquetaAccion();
        }
    }

    // Planificación: limpia tabla y fila de ingreso
    const tabla = document.getElementById("body_ejecutantes");
    if (tabla) tabla.innerHTML = "";

    setSelectPlaceholder("input_sel_ejecutante");
    setValue("input_f_inicio", "");
    setValue("input_f_termino", "");
    setValue("input_f_tarea", "");
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









