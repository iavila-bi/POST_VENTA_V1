let ID_POSTVENTA_ACTUAL = null; // Sin 'const', debe ser 'let' para que cambie
// Este evento detecta cuando la página está lista y dispara las cargas
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Página lista, cargando datos...");
    cargarProyectos(); // Carga tus proyectos
    cargarFamilias();  // Carga tus familias
    cargarDatosIniciales(); // <--- ESTA ES LA QUE LLENA EL SELECTOR DE EJECUTANTES
});


/* ==========================================
   CONFIGURACIÓN Y CARGA INICIAL
   ========================================== */
const BASE_URL = 'http://localhost:3000'; 
//////CREACION PV
async function crearPostventa() {

    const idInmueble = document.getElementById('id_inmueble').value;
    const nombreCliente = document.getElementById('nombre_cliente').value;
    const contactoCliente = document.getElementById('telefono_cliente').value;
    const estadoTicket = document.getElementById('estado_ticket').value;

    if (!idInmueble) {
        return alert("⚠️ Seleccione un inmueble.");
    }

    if (!nombreCliente.trim()) {
        return alert("⚠️ Ingrese nombre del cliente.");
    }

    try {
        const res = await fetch(`${BASE_URL}/api/postventas/crear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id_inmueble: parseInt(idInmueble),
                nombre_cliente: nombreCliente,
                numero_contacto: contactoCliente,
                estado_ticket: estadoTicket
            })
        });

        const data = await res.json();

        if (!res.ok) {
            return alert("❌ Error servidor: " + data.error);
        }

        ID_POSTVENTA_ACTUAL = data.id_postventa;

        alert(`✅ Postventa #${ID_POSTVENTA_ACTUAL} creada correctamente.`);

        document.getElementById('btn_agregar_tabla').disabled = false;

    } catch (err) {
        console.error(err);
        alert("Error de conexión.");
    }
}

function mostrarBannerAnclado(proy, unit, id) {
    let banner = document.getElementById('banner_fijado');
    if(!banner) {
        banner = document.createElement('div');
        banner.id = "banner_fijado";
        document.body.appendChild(banner);
    }
    
    // CSS dinámico para que flote en la esquina superior derecha
    Object.assign(banner.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: '#1e3a8a',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '10px',
        boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
        zIndex: '10000',
        borderLeft: '5px solid #3b82f6',
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
    });

    banner.innerHTML = `
        <i class="fas fa-anchor" style="font-size: 1.5rem; color: #93c5fd;"></i>
        <div>
            <div style="font-size: 0.7rem; opacity: 0.8; text-transform: uppercase;">Unidad Anclada</div>
            <div style="font-weight: 700;">${proy} - ${unit}</div>
            <div style="font-size: 0.8rem; color: #bfdbfe;">ID PV: #${id}</div>
        </div>
    `;
}
// 1. Obtener Proyectos (Corregido nombre para el disparador)
async function cargarProyectos() {
    const selectProyecto = document.getElementById('id_proyecto');
    if (!selectProyecto) return;
    try {
        const respuesta = await fetch(`${BASE_URL}/api/proyectos`);
        const proyectos = await respuesta.json();
        
        selectProyecto.innerHTML = '<option value="" disabled selected>Seleccione un proyecto...</option>';
        proyectos.forEach(proy => {
            selectProyecto.innerHTML += `<option value="${proy.id_proyecto}">${proy.nombre_proyecto}</option>`;
        });
    } catch (error) {
        console.error("Error al cargar proyectos:", error);
    }
}

// 2. Cargar Familias
async function cargarFamilias() {
    const select = document.getElementById('select_familia');
    if (!select) return;
    try {
        const respuesta = await fetch(`${BASE_URL}/api/familias`);
        const familias = await respuesta.json();
        
        select.innerHTML = '<option value="" disabled selected>Seleccione familia...</option>';
        familias.forEach(f => {
            const option = document.createElement('option');
            option.value = f.id_familia;
            option.textContent = f.nombre_familia;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando familias:", error);
    }
}

// 3. Cargar Responsables (Unificada)
async function cargarResponsables() {
    const select = document.getElementById('reg_responsable');
    if (!select) return;
    try {
        const respuesta = await fetch(`${BASE_URL}/api/responsables`);
        const responsables = await respuesta.json();
        
        select.innerHTML = '<option value="" disabled selected>Seleccione responsable...</option>';
        
        if (Array.isArray(responsables)) {
            responsables.forEach(r => {
                const option = document.createElement('option');
                
                // 1. Usamos id_responsable para el VALUE
                option.value = r.id_responsable; 
                
                // 2. Usamos nombre_responsable y cargo para el TEXTO
                // El cargo lo ponemos entre paréntesis solo si existe
                const cargoInfo = r.cargo ? ` (${r.cargo})` : "";
                option.textContent = `${r.nombre_responsable}${cargoInfo}`;
                
                select.appendChild(option);
            });
            console.log("Responsables cargados con éxito");
        }
    } catch (error) {
        console.error("Error cargando responsables:", error);
    }
}
/* ==========================================
   LÓGICA EN CASCADA (PROYECTOS -> INMUEBLES)
   ========================================== */

async function cargarIdentificadores() {
    const idProyecto = document.getElementById('id_proyecto').value;
    const selectInmueble = document.getElementById('id_inmueble');
    if (!idProyecto) return;

    selectInmueble.innerHTML = '<option value="" disabled selected>Cargando...</option>';
    try {
        const respuesta = await fetch(`${BASE_URL}/api/proyectos/${idProyecto}/inmuebles`);
        const inmuebles = await respuesta.json();

        inmuebles.sort((a, b) => a.numero_identificador.localeCompare(b.numero_identificador, undefined, { numeric: true }));

        selectInmueble.innerHTML = '<option value="" disabled selected>Seleccione identificador...</option>';
        inmuebles.forEach(inm => {
            selectInmueble.innerHTML += `<option value="${inm.id_inmueble}">${inm.numero_identificador}</option>`;
        });
    } catch (error) {
        console.error("Error al cargar identificadores:", error);
    }
}

async function cargarDatosInmueble() {
    const idInmueble = document.getElementById('id_inmueble').value;
    if (!idInmueble) return;

    try {
        const respuesta = await fetch(`${BASE_URL}/api/inmuebles/detalle/${idInmueble}`);
        const datos = await respuesta.json();
        
        document.getElementById('val-tipo').value = datos.casa_o_depto || '';
        document.getElementById('val-modelo').value = datos.modelo || '';
        document.getElementById('val-orientacion').value = datos.orientacion || '';
        
        const inputFecha = document.getElementById('val-fecha');
        const selectEstado = document.getElementById('estado_inmueble');

        if (!datos.fecha_entrega) {
            inputFecha.value = ''; 
            selectEstado.value = "En Stock"; 
        } else {
            inputFecha.value = datos.fecha_entrega.split('T')[0];
            selectEstado.value = "Entregada";
        }
    } catch (error) {
        console.error("Error al cargar detalles:", error);
    }
}

/* ==========================================
   SECCIÓN 3: GESTIÓN DE LA TABLA
   ========================================== */

// Cargar Subfamilias según Familia seleccionada
async function cargarSubfamilias() {
    const idFamilia = document.getElementById('select_familia').value;
    const selectSub = document.getElementById('select_subfamilia');
    if (!idFamilia || !selectSub) return;

    try {
        const respuesta = await fetch(`${BASE_URL}/api/familias/${idFamilia}/subfamilias`);
        const subfamilias = await respuesta.json();

        selectSub.innerHTML = '<option value="" disabled selected>Seleccione Subfamilia...</option>';
        subfamilias.forEach(sub => {
            selectSub.innerHTML += `<option value="${sub.id_subfamilia}">${sub.nombre_subfamilia}</option>`;
        });
    } catch (error) {
        console.error("Error al cargar subfamilias:", error);
    }
}

// Botón Agregar a Tabla
document.getElementById('btn_agregar_tabla')?.addEventListener('click', function() {
    const origen = document.getElementById('reg_origen').value;
    const familia = document.getElementById('select_familia').options[document.getElementById('select_familia').selectedIndex]?.text;
    const subfamilia = document.getElementById('select_subfamilia').options[document.getElementById('select_subfamilia').selectedIndex]?.text;
    const recinto = document.getElementById('reg_recinto').value.trim();
    const comentarios = document.getElementById('reg_comentarios_cliente').value.trim();
    const fechaLev = document.getElementById('reg_fecha_lev').value;
    const responsable = document.getElementById('reg_responsable').value;

    if (!origen || !familia || !subfamilia || !recinto || !comentarios || !fechaLev || !responsable) {
        alert("⚠️ Complete todos los campos obligatorios (*)");
        return;
    }

    const tabla = document.querySelector('.tabla-registros tbody');
    const fila = document.createElement('tr');
    fila.innerHTML = `
        <td>${familia}</td>
        <td>${subfamilia}</td>
        <td>${recinto}</td>
        <td><span class="badge badge-planificacion">Pendiente</span></td>
        <td><button class="btn-eliminar" onclick="this.closest('tr').remove()"><i class="fas fa-trash"></i></button></td>
    `;
    tabla.appendChild(fila);
    
    document.getElementById('reg_recinto').value = '';
    document.getElementById('reg_comentarios_cliente').value = '';
});

// Validación Teléfono
document.getElementById('telefono_cliente')?.addEventListener('input', function() {
    this.value = this.value.replace(/[^0-9]/g, '').slice(0, 9);
});
//// VALIDADOR DE SUBSFAMILIAS

// Cuando cambie la familia, cargar sus subfamilias
document.getElementById('select_familia')?.addEventListener('change', cargarSubfamilias);

/* ==========================================
   DISPARADOR DE INICIO
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    cargarProyectos();
    cargarFamilias();
    cargarResponsables();
});

// --- LÓGICA DE CONTROL DE POSTVENTA ---

// Al iniciar, desactivamos la Sección 3
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn_agregar_tabla').disabled = true;
    document.getElementById('btn_agregar_tabla').style.opacity = "0.5";
    document.getElementById('btn_agregar_tabla').title = "Debe generar una postventa primero";
});

// Botón: Generar Postventa
// Busca esta parte en tu código y reemplázala:
    // Habilitamos la Sección 3 para añadir fallas
    const btnAgregar = document.getElementById('btn_agregar_tabla');
    const icono = document.getElementById('icono_boton'); // Necesitamos el ID del ícono

    if (btnAgregar) {
        btnAgregar.disabled = false;
        btnAgregar.style.opacity = "1";
        btnAgregar.title = "";
        
        // Cambiamos el candado por el ícono de disco/guardar
        if (icono) {
            icono.className = 'fas fa-save'; 
        }
    }
// Botón: Nueva Postventa (Reset total)
document.getElementById('btn_nueva_postventa')?.addEventListener('click', function() {
    if (confirm("¿Está seguro de que desea iniciar una nueva postventa? Se perderán los datos no guardados.")) {
        location.reload(); // La forma más rápida y segura de limpiar todo
    }
});


// VINCULAR EL BOTÓN (Asegúrate de que esto se ejecute al cargar la página)
document.getElementById('btn_agregar_tabla').onclick = finalizarRegistroFamilia;

// Función para agregar una fila con el selector correcto
// REEMPLAZA tu función de agregar fila por esta:
// 1. Función para agregar filas con el look profesional
// 1. Cargar los ejecutantes en el selector permanente al iniciar
function cargarSelectorEjecutantes(lista) {
    const select = document.getElementById('input_sel_ejecutante');
    if (!select) return;
    
    select.innerHTML = '<option value="" disabled selected>Seleccione para agregar...</option>';
    lista.forEach(e => {
        select.innerHTML += `<option value="${e.id_ejecutante}">${e.nombre_ejecutante.toUpperCase()} — ${e.especialidad.toUpperCase()}</option>`;
    });
}
/* ============================================================
   LÓGICA DE EJECUTANTES Y PLANIFICACIÓN (AZUL)
   ============================================================ */

// 1. CARGA INICIAL: Trae los nombres del servidor al selector azul
async function cargarDatosIniciales() {
    try {
        const respuesta = await fetch(`${BASE_URL}/api/ejecutantes`);
        
        // Si el servidor responde 404, esto lanzará el error
        if (!respuesta.ok) throw new Error("No se encontró la ruta /api/ejecutantes en el servidor");
        
        const ejecutantes = await respuesta.json();
        console.log("✅ Ejecutantes cargados:", ejecutantes);
        
        cargarSelectorEjecutantes(ejecutantes);
        
    } catch (error) {
        console.error("❌ Error al cargar ejecutantes:", error);
    }
}

function cargarSelectorEjecutantes(lista) {
    const select = document.getElementById('input_sel_ejecutante');
    if (!select) return;
    
    select.innerHTML = '<option value="" disabled selected>Seleccione para agregar...</option>';
    
    lista.forEach(e => {
        const option = document.createElement('option');
        option.value = e.id_ejecutante;
        
        // Formato Profesional: NOMBRE — ESPECIALIDAD
        const nombre = (e.nombre_ejecutante || "Sin nombre").toUpperCase();
        const cargo = (e.especialidad || "General").toUpperCase();
        
        option.textContent = `${nombre} — ${cargo}`;
        select.appendChild(option);
    });
}

// 3. ANCLAR FILA: Pasa los datos de la fila de entrada a la tabla de arriba
function confirmarNuevaFila() {
    const sel = document.getElementById('input_sel_ejecutante');
    const ini = document.getElementById('input_f_inicio');
    const ter = document.getElementById('input_f_termino');
    const tar = document.getElementById('input_f_tarea');

    if (!sel.value) {
        alert("⚠️ Por favor, seleccione un ejecutante de la lista.");
        return;
    }

    const tbody = document.getElementById('body_ejecutantes');
    const tr = document.createElement('tr');

    // Recuperamos el texto "NOMBRE — CARGO" que el usuario seleccionó
    const textoMostrar = sel.options[sel.selectedIndex].text;

    tr.innerHTML = `
        <td style="font-weight: 600; color: #1e40af;">
            <input type="hidden" class="select-ejecutante-custom" value="${sel.value}">
            ${textoMostrar}
        </td>
        <td><input type="date" class="input-plan-azul date-inicio" value="${ini.value}"></td>
        <td><input type="date" class="input-plan-azul date-termino" value="${ter.value}"></td>
        <td><input type="text" class="input-plan-azul in-tarea" value="${tar.value}"></td>
        <td style="text-align:center;">
            <button type="button" class="btn-borrar-fila" onclick="this.closest('tr').remove()" title="Quitar">
                <i class="fas fa-times"></i>
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);

    // Limpiamos selector y tarea para la siguiente carga rápida
    sel.value = "";
    tar.value = "";
    sel.focus(); // Devuelve el foco al selector para velocidad
}

// 4. GUARDADO FINAL: Envía todo al servidor
async function finalizarRegistroFamilia() {
    // Validar anclaje de postventa
    if (!typeof ID_POSTVENTA_ACTUAL !== 'undefined' || !ID_POSTVENTA_ACTUAL) {
        return alert("⚠️ Error: No hay una Postventa anclada. Genere una primero.");
    }

    const filas = document.querySelectorAll('#body_ejecutantes tr');
    if (filas.length === 0) return alert("⚠️ Agregue al menos un ejecutante a la planificación.");

    // Construcción del objeto de envío (Payload)
    const datosEnvio = {
        registro: {
            id_postventa: ID_POSTVENTA_ACTUAL,
            id_familia: document.getElementById('select_familia').value,
            id_subfamilia: document.getElementById('select_subfamilia').value,
            id_responsable: document.getElementById('reg_responsable').value,
            recinto: document.getElementById('reg_recinto').value,
            comentarios: document.getElementById('reg_comentarios').value,
            fecha_acta: document.getElementById('fecha_firma_acta').value // NUEVO CAMPO
        },
        tareas: Array.from(filas).map(f => ({
            id_ejecutante: f.querySelector('.select-ejecutante-custom').value,
            inicio: f.querySelector('.date-inicio').value,
            termino: f.querySelector('.date-termino').value,
            descripcion: f.querySelector('.in-tarea').value
        }))
    };

    try {
        const res = await fetch(`${BASE_URL}/api/guardar-familia-completa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosEnvio)
        });

        if (res.ok) {
            alert("✅ Registro y Planificación guardados con éxito.");
            
            // Actualizar burbujas de historial
            const selFam = document.getElementById('select_familia');
            const nombreFam = selFam.options[selFam.selectedIndex].text;
            actualizarBurbujasConfirmacion(nombreFam);

            // LIMPIEZA POST-GUARDADO
            document.getElementById('body_ejecutantes').innerHTML = ''; 
            document.getElementById('fecha_firma_acta').value = '';
            if (typeof limpiarSeccionRegistro === 'function') limpiarSeccionRegistro();
            
        } else {
            const errorData = await res.json();
            alert("❌ Error al guardar: " + (errorData.error || "Consulte al administrador"));
        }
    } catch (e) {
        console.error("Error en el envío:", e);
        alert("❌ Error de conexión con el servidor.");
    }
}

// Vinculación del botón principal (Asegurar que el ID existe en el HTML)
document.getElementById('btn_agregar_tabla')?.addEventListener('click', finalizarRegistroFamilia);

// Ejecutar cuando cargue la página
window.onload = function() {
    cargarProyectos();
    cargarFamilias();
    cargarDatosIniciales(); // <--- Esta es la clave
};