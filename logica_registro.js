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