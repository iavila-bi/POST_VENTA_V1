const STORAGE_KEY_TEMA = "app_postventa_tema";

const estadoCalendario = {
    fechaBase: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    tareasMes: []
};

function notificarAlturaIframe() {
    if (window.parent === window) return;
    const altoDocumento = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
    );
    window.parent.postMessage(
        { type: "calendario_altura", height: altoDocumento },
        window.location.origin
    );
}

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

function formatearMesAnio(fecha) {
    return fecha.toLocaleDateString("es-CL", {
        month: "long",
        year: "numeric"
    });
}

function formatearFechaDia(valor) {
    if (!valor) return "-";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "-";
    return fecha.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit"
    });
}

function normalizarFechaDia(fecha) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function obtenerPrimerDiaVista(fechaMes) {
    const primerDiaMes = new Date(fechaMes.getFullYear(), fechaMes.getMonth(), 1);
    const diaSemana = primerDiaMes.getDay();
    const offsetLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicio = new Date(primerDiaMes);
    inicio.setDate(primerDiaMes.getDate() - offsetLunes);
    return inicio;
}

function obtenerRangoDia(tarea) {
    const inicio = tarea.fecha_inicio ? normalizarFechaDia(new Date(tarea.fecha_inicio)) : null;
    const terminoBase = tarea.fecha_termino || tarea.fecha_inicio;
    const termino = terminoBase ? normalizarFechaDia(new Date(terminoBase)) : null;
    return { inicio, termino };
}

function tareaEstaEnDia(tarea, dia) {
    const { inicio, termino } = obtenerRangoDia(tarea);
    if (!inicio || !termino) return false;
    return dia >= inicio && dia <= termino;
}

function calcularDiasDentroMes(tarea, fechaMes) {
    const { inicio, termino } = obtenerRangoDia(tarea);
    if (!inicio || !termino) return 0;

    const inicioMes = new Date(fechaMes.getFullYear(), fechaMes.getMonth(), 1);
    const finMes = new Date(fechaMes.getFullYear(), fechaMes.getMonth() + 1, 0);

    const inicioReal = inicio > inicioMes ? inicio : inicioMes;
    const finReal = termino < finMes ? termino : finMes;

    if (finReal < inicioReal) return 0;
    const milisDia = 24 * 60 * 60 * 1000;
    return Math.floor((finReal - inicioReal) / milisDia) + 1;
}

function renderizarTituloMes() {
    const titulo = document.getElementById("titulo_mes");
    if (!titulo) return;
    titulo.textContent = formatearMesAnio(estadoCalendario.fechaBase);
}

function renderizarResumenDesempeno(tareas) {
    const contenedor = document.getElementById("resumen_ejecutantes");
    if (!contenedor) return;

    if (!tareas.length) {
        contenedor.innerHTML = '<span class="chip-vacio">Sin tareas para este per&iacute;odo</span>';
        return;
    }

    const agrupado = new Map();

    tareas.forEach(tarea => {
        const key = String(tarea.id_ejecutante || "");
        if (!key) return;

        if (!agrupado.has(key)) {
            agrupado.set(key, {
                nombre: tarea.nombre_ejecutante || "Sin nombre",
                especialidad: tarea.especialidad || "Sin especialidad",
                tareas: 0,
                diasAsignados: 0
            });
        }

        const item = agrupado.get(key);
        item.tareas += 1;
        item.diasAsignados += calcularDiasDentroMes(tarea, estadoCalendario.fechaBase);
    });

    const lista = Array.from(agrupado.values())
        .sort((a, b) => {
            if (b.tareas !== a.tareas) return b.tareas - a.tareas;
            return b.diasAsignados - a.diasAsignados;
        })
        .slice(0, 12);

    contenedor.innerHTML = lista.map(item => `
        <article class="chip-desempeno">
            <p class="chip-nombre">${item.nombre} · ${item.especialidad}</p>
            <p class="chip-metricas">${item.tareas} tareas · ${item.diasAsignados} d&iacute;as asignados</p>
        </article>
    `).join("");
}

function construirTarjetaTarea(tarea) {
    return `
        <article class="tarea-card">
            <p class="tarea-ejecutante">${tarea.nombre_ejecutante || "Sin ejecutante"}</p>
            <p class="tarea-especialidad">${tarea.especialidad || "Sin especialidad"}</p>
            <p class="tarea-meta">${tarea.nombre_proyecto || "-"} · ${tarea.numero_identificador || "-"}</p>
            <p class="tarea-meta">${tarea.nombre_familia || "Sin familia"} · ${tarea.descripcion_tarea || "Sin descripción"}</p>
            <p class="tarea-rango">${formatearFechaDia(tarea.fecha_inicio)} - ${formatearFechaDia(tarea.fecha_termino || tarea.fecha_inicio)}</p>
        </article>
    `;
}

function renderizarCalendario() {
    const grid = document.getElementById("calendario_grid");
    if (!grid) return;

    const inicioVista = obtenerPrimerDiaVista(estadoCalendario.fechaBase);
    const hoy = normalizarFechaDia(new Date());
    const celdas = [];

    for (let i = 0; i < 42; i += 1) {
        const dia = new Date(inicioVista);
        dia.setDate(inicioVista.getDate() + i);

        const tareasDia = estadoCalendario.tareasMes.filter(tarea => tareaEstaEnDia(tarea, dia));
        const esMesActual = dia.getMonth() === estadoCalendario.fechaBase.getMonth();
        const esHoy = dia.getTime() === hoy.getTime();

        const tareasHtml = tareasDia.length
            ? tareasDia.map(construirTarjetaTarea).join("")
            : '<p class="sin-tareas">Sin tareas</p>';

        celdas.push(`
            <div class="celda-dia ${esMesActual ? "" : "fuera-mes"} ${esHoy ? "hoy" : ""}">
                <div class="dia-header">
                    <span class="dia-num">${dia.getDate()}</span>
                    <span class="dia-cantidad">${tareasDia.length} ${tareasDia.length === 1 ? "tarea" : "tareas"}</span>
                </div>
                <div class="tareas-scroll">
                    ${tareasHtml}
                </div>
            </div>
        `);
    }

    grid.innerHTML = celdas.join("");
    notificarAlturaIframe();
}

async function cargarEjecutantesFiltro() {
    const select = document.getElementById("filtro_ejecutante");
    if (!select) return;

    try {
        const res = await fetch("/api/ejecutantes");
        if (!res.ok) throw new Error("No se pudo cargar ejecutantes");
        const data = await res.json();

        select.innerHTML = '<option value="">Todos los ejecutantes</option>';
        data.forEach(item => {
            const option = document.createElement("option");
            option.value = String(item.id_ejecutante);
            option.textContent = `${item.nombre_ejecutante} - ${item.especialidad || "Sin especialidad"}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando ejecutantes:", error);
    }
}

async function cargarProyectosFiltro() {
    const select = document.getElementById("filtro_proyecto");
    if (!select) return;

    try {
        const res = await fetch("/api/proyectos");
        if (!res.ok) throw new Error("No se pudo cargar proyectos");
        const data = await res.json();

        select.innerHTML = '<option value="">Todos los proyectos</option>';
        data.forEach(item => {
            const option = document.createElement("option");
            option.value = String(item.id_proyecto);
            option.textContent = item.nombre_proyecto || `Proyecto ${item.id_proyecto}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando proyectos:", error);
    }
}

function obtenerQueryCalendario() {
    const year = estadoCalendario.fechaBase.getFullYear();
    const month = estadoCalendario.fechaBase.getMonth() + 1;
    const idEjecutante = document.getElementById("filtro_ejecutante")?.value || "";
    const idProyecto = document.getElementById("filtro_proyecto")?.value || "";

    const params = new URLSearchParams({
        year: String(year),
        month: String(month)
    });

    if (idEjecutante) params.set("id_ejecutante", idEjecutante);
    if (idProyecto) params.set("id_proyecto", idProyecto);

    return params.toString();
}

async function cargarTareasMes() {
    try {
        renderizarTituloMes();
        const query = obtenerQueryCalendario();
        const res = await fetch(`/api/calendario/tareas?${query}`);
        if (!res.ok) throw new Error("No se pudieron cargar tareas del calendario");

        const data = await res.json();
        estadoCalendario.tareasMes = Array.isArray(data) ? data : [];
        renderizarResumenDesempeno(estadoCalendario.tareasMes);
        renderizarCalendario();
    } catch (error) {
        console.error("Error cargando calendario de tareas:", error);
        estadoCalendario.tareasMes = [];
        renderizarResumenDesempeno([]);
        renderizarCalendario();
    }
}

function moverMes(delta) {
    const nueva = new Date(estadoCalendario.fechaBase);
    nueva.setMonth(nueva.getMonth() + delta);
    estadoCalendario.fechaBase = new Date(nueva.getFullYear(), nueva.getMonth(), 1);
    cargarTareasMes();
}

function irMesActual() {
    const hoy = new Date();
    estadoCalendario.fechaBase = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    cargarTareasMes();
}

function inicializarEventos() {
    document.getElementById("btn_prev_mes")?.addEventListener("click", () => moverMes(-1));
    document.getElementById("btn_next_mes")?.addEventListener("click", () => moverMes(1));
    document.getElementById("btn_hoy")?.addEventListener("click", irMesActual);

    document.getElementById("filtro_ejecutante")?.addEventListener("change", cargarTareasMes);
    document.getElementById("filtro_proyecto")?.addEventListener("change", cargarTareasMes);
}

document.addEventListener("DOMContentLoaded", async () => {
    inicializarTema();
    inicializarEventos();
    await Promise.all([cargarEjecutantesFiltro(), cargarProyectosFiltro()]);
    await cargarTareasMes();
});

window.addEventListener("resize", () => {
    notificarAlturaIframe();
});
