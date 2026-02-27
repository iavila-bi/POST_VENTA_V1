// =====================================================
// ESTADO GLOBAL
// =====================================================
let postventaActiva = null;
let listaEjecutantes = [];


// =====================================================
// INICIO
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    cargarProyectos();
    cargarFamilias();
    cargarResponsables();
    cargarEjecutantes();
    activarBotonNuevaPostventa();
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

    if (!id_proyecto) return;

    const res = await fetch(`/api/proyectos/${id_proyecto}/inmuebles`);
    const data = await res.json();

    const select = document.getElementById("id_inmueble");
    select.innerHTML = '<option value="">Seleccione identificador...</option>';

    data.forEach(i => {
        select.innerHTML += `<option value="${i.id_inmueble}">${i.numero_identificador}</option>`;
    });
}

//-- CARGAR DATOS DEL INMUEBLE--//
async function cargarDatosInmueble() {

    const id_inmueble = document.getElementById("id_inmueble").value;

    if (!id_inmueble) return;

    const res = await fetch(`/api/inmuebles/detalle/${id_inmueble}`);
    const data = await res.json();

    document.getElementById("val-tipo").value = data.casa_o_depto || "";
    document.getElementById("val-modelo").value = data.modelo || "";
    document.getElementById("val-orientacion").value = data.orientacion || "";
    document.getElementById("val-fecha").value = data.fecha_entrega?.split("T")[0] || "";
}

//-------CARGAR SUBFAMILIAS DINÁMICAMENTE-------//
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

    // 🔓 Activar botón
    document.getElementById("btn_agregar_tabla").disabled = false;
    document.getElementById("icono_boton").className = "fas fa-plus";

    alert("Postventa creada correctamente");
}


// =====================================================
// NUEVA POSTVENTA
// =====================================================
function activarBotonNuevaPostventa() {
    document.getElementById("btn_nueva_postventa")
        .addEventListener("click", () => {
            postventaActiva = null;
            document.getElementById("btn_agregar_tabla").disabled = true;
            document.getElementById("icono_boton").className = "fas fa-lock";
            alert("Lista para crear nueva postventa");
        });
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
        recinto: document.getElementById("reg_recinto").value,
        comentarios_previos: document.getElementById("reg_comentarios_cliente").value,
        fecha_firma_acta: document.getElementById("fecha_firma_acta").value,
        
        // CORRECCIÓN CLAVE: Usamos la fecha del acta o la de hoy 
        // para que 'fecha_levantamiento' nunca sea NULL y no rompa la DB
        fecha_levantamiento: document.getElementById("fecha_firma_acta").value || new Date().toISOString().split('T')[0],
        fecha_visita: document.getElementById("fecha_firma_acta").value || new Date().toISOString().split('T')[0]
    };

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

        // --- ÉXITO ---
        
        // Mostrar alerta verde (Toast)
        const toast = document.getElementById('toast_familia');
        if (toast) {
            toast.classList.add('visible');
            setTimeout(() => toast.classList.remove('visible'), 3000);
        }

        // Limpiar campos de la sección familia
        document.querySelectorAll('.input-familia').forEach(i => i.value = "");
        
        // Limpiar tabla de tareas
        const tabla = document.getElementById("body_ejecutantes");
        if (tabla) tabla.innerHTML = "";

        console.log("Guardado exitoso con ID:", data.id_registro);

    } catch (error) {
        console.error("Error al guardar:", error);
        alert("No se pudo guardar: " + error.message);
    }
}