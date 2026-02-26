/* ==========================================
   CARGA INICIAL DESDE LA BASE DE DATOS
   ========================================== */
const BASE_URL = 'http://localhost:3000'; 

document.addEventListener("DOMContentLoaded", () => {
    obtenerProyectosDesdeBD();
    obtenerFamiliasDesdeBD();
});

// 1. Obtener Proyectos
async function obtenerProyectosDesdeBD() {
    const selectProyecto = document.getElementById('id_proyecto');
    try {
        const respuesta = await fetch(`${BASE_URL}/api/proyectos`);
        const proyectos = await respuesta.json();
        
        selectProyecto.innerHTML = '<option value="" disabled selected>Seleccione un proyecto...</option>';
        proyectos.forEach(proy => {
            selectProyecto.innerHTML += `<option value="${proy.id_proyecto}">${proy.nombre_proyecto}</option>`;
        });
    } catch (error) {
        console.error("Error al cargar proyectos:", error);
        selectProyecto.innerHTML = '<option value="" disabled>Error de conexión a BD</option>';
    }
}

// 2. Obtener Familias
async function obtenerFamiliasDesdeBD() {
    const selectFamilia = document.getElementById('id_familia');
    try {
        const respuesta = await fetch(`${BASE_URL}/api/familias`);
        const familias = await respuesta.json();
        
        selectFamilia.innerHTML = '<option value="" disabled selected>Seleccione...</option>';
        familias.forEach(fam => {
            selectFamilia.innerHTML += `<option value="${fam.id_familia}">${fam.nombre_familia}</option>`;
        });
    } catch (error) {
        console.error("Error al cargar familias:", error);
        selectFamilia.innerHTML = '<option value="" disabled>Error de conexión a BD</option>';
    }
}

/* ==========================================
   LÓGICA EN CASCADA CON LA BASE DE DATOS
   ========================================== */

// 3. Cargar Identificadores (Corregido con BASE_URL)
async function cargarIdentificadores() {
    const idProyecto = document.getElementById('id_proyecto').value;
    const selectInmueble = document.getElementById('id_inmueble');

    if (!idProyecto) return;

    selectInmueble.innerHTML = '<option value="" disabled selected>Cargando identificadores...</option>';
    selectInmueble.disabled = true;

    try {
        // Se añade BASE_URL para evitar errores de ruta
        const respuesta = await fetch(`${BASE_URL}/api/proyectos/${idProyecto}/inmuebles`);
        const inmuebles = await respuesta.json();

        // Ordenamiento Natural de menor a mayor
        inmuebles.sort((a, b) => 
            a.numero_identificador.localeCompare(b.numero_identificador, undefined, { numeric: true, sensitivity: 'base' })
        );

        selectInmueble.innerHTML = '<option value="" disabled selected>Seleccione identificador...</option>';
        
        inmuebles.forEach(inm => {
            selectInmueble.innerHTML += `<option value="${inm.id_inmueble}">${inm.numero_identificador}</option>`;
        });
        
        // Se habilita el campo una vez cargados los datos
        selectInmueble.disabled = false; 
    } catch (error) {
        console.error("Error al cargar identificadores:", error);
        selectInmueble.innerHTML = '<option value="" disabled>Error de conexión</option>';
    }
}

// 4. Cargar Subfamilias
async function cargarSubfamilias() {
    const idFamilia = document.getElementById('id_familia').value;
    const selectSubfamilia = document.getElementById('id_subfamilia');

    if (!idFamilia) return;

    selectSubfamilia.innerHTML = '<option value="" disabled selected>Cargando subfamilias...</option>';
    selectSubfamilia.disabled = true;

    try {
        const respuesta = await fetch(`${BASE_URL}/api/familias/${idFamilia}/subfamilias`);
        const subfamilias = await respuesta.json();

        selectSubfamilia.innerHTML = '<option value="" disabled selected>Seleccione Subfamilia...</option>';
        subfamilias.forEach(sub => {
            selectSubfamilia.innerHTML += `<option value="${sub.id_subfamilia}">${sub.nombre_subfamilia}</option>`;
        });
        selectSubfamilia.disabled = false;
    } catch (error) {
        console.error("Error al cargar subfamilias:", error);
        selectSubfamilia.innerHTML = '<option value="" disabled>Error al cargar</option>';
    }
}

// 5. Cargar detalles del inmueble (Automáticos)
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

        // Si la fecha es null o undefined, ponemos "En Stock"
        if (!datos.fecha_entrega) {
            inputFecha.value = ''; 
            selectEstado.value = "En Stock"; // 🚀 Esto selecciona la opción automáticamente
        } else {
            inputFecha.value = datos.fecha_entrega.split('T')[0];
            // Si hay fecha, usamos el estado de la BD o por defecto "Entregada"
            selectEstado.value = datos.estado_inmueble || "Entregada";
        }
        
    } catch (error) {
        console.error("Error al cargar detalles del inmueble:", error);
    }
}

function agregarFamiliaATabla() {
    alert("Función lista para procesar los registros.");
}

// ... (tu código anterior de proyectos e inmuebles)

// --- NUEVA LÓGICA SECCIÓN 3 ---

// 1. Cargar Responsables desde la BD
async function cargarResponsables() {
    try {
        const respuesta = await fetch(`${BASE_URL}/api/responsables`);
        const responsables = await respuesta.json();
        const select = document.getElementById('reg_responsable');
        
        select.innerHTML = '<option value="" disabled selected>Seleccione responsable...</option>';
        responsables.forEach(r => {
            const option = document.createElement('option');
            option.value = r.id_usuario;
            option.textContent = r.nombre;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando responsables:", error);
    }
}

// 2. Control del teléfono (Máximo 9 dígitos)
document.getElementById('telefono_cliente')?.addEventListener('input', function (e) {
    this.value = this.value.replace(/[^0-9]/g, '');
    if (this.value.length > 9) {
        this.value = this.value.slice(0, 9);
    }
});

// 3. Función para agregar a la tabla con validaciones
document.getElementById('btn_agregar_tabla')?.addEventListener('click', function() {
    const origen = document.getElementById('reg_origen').value;
    const familiaText = document.getElementById('select_familia').options[document.getElementById('select_familia').selectedIndex]?.text;
    const subfamiliaText = document.getElementById('select_subfamilia').options[document.getElementById('select_subfamilia').selectedIndex]?.text;
    const recinto = document.getElementById('reg_recinto').value.trim();
    const comentarios = document.getElementById('reg_comentarios_cliente').value.trim();
    const fechaLev = document.getElementById('reg_fecha_lev').value;
    const responsable = document.getElementById('reg_responsable').value;

    if (!origen || !familiaText || familiaText.includes("Seleccione") || !subfamiliaText || !recinto || !comentarios || !fechaLev || !responsable) {
        alert("⚠️ Por favor, complete todos los campos obligatorios (*)");
        return;
    }

    const tabla = document.querySelector('.tabla-registros tbody');
    const fila = document.createElement('tr');

    fila.innerHTML = `
        <td>${familiaText}</td>
        <td>${subfamiliaText}</td>
        <td>${recinto}</td>
        <td><span class="badge badge-planificacion">Pendiente</span></td>
        <td>
            <button class="btn-eliminar" onclick="this.closest('tr').remove()"><i class="fas fa-trash"></i></button>
        </td>
    `;
    tabla.appendChild(fila);
    
    // Limpiar campos de texto para el próximo ingreso
    document.getElementById('reg_recinto').value = '';
    document.getElementById('reg_comentarios_cliente').value = '';
});

// 4. EL DISPARADOR: Ejecutar todo al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // Aquí llamas a todas tus funciones de carga inicial
    cargarProyectos(); 
    cargarResponsables(); 
});