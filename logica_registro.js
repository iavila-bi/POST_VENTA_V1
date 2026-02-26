/* ==========================================
   CONFIGURACIÓN Y CARGA INICIAL
   ========================================== */
const BASE_URL = 'http://localhost:3000'; 

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
document.getElementById('btn_generar_postventa')?.addEventListener('click', function() {
    const cliente = document.getElementById('val-nombre-cliente')?.value; // Ajusta según tu ID real
    const contacto = document.getElementById('telefono_cliente')?.value;

    if (!cliente || contacto.length < 9) {
        alert("⚠️ Por favor, ingrese el nombre del cliente y un contacto válido (9 dígitos) antes de continuar.");
        return;
    }

    // Bloqueamos los datos del cliente para que no cambien a mitad del proceso
    document.getElementById('val-nombre-cliente').readOnly = true;
    document.getElementById('telefono_cliente').readOnly = true;
    
    // Habilitamos la Sección 3 para añadir fallas
    const btnAgregar = document.getElementById('btn_agregar_tabla');
    btnAgregar.disabled = false;
    btnAgregar.style.opacity = "1";
    btnAgregar.title = "";

    alert("✅ Postventa anclada. Ahora puede añadir las familias correspondientes.");
});

// Botón: Nueva Postventa (Reset total)
document.getElementById('btn_nueva_postventa')?.addEventListener('click', function() {
    if (confirm("¿Está seguro de que desea iniciar una nueva postventa? Se perderán los datos no guardados.")) {
        location.reload(); // La forma más rápida y segura de limpiar todo
    }
});