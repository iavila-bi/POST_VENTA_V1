/* ==========================================
   LÓGICA DEL MENÚ PRINCIPAL (DASHBOARD)
   ========================================== */

document.addEventListener("DOMContentLoaded", () => {
    console.log("Menú principal cargado correctamente.");
    
    // Aquí a futuro conectaremos los gráficos y tarjetas de resumen
    // para que muestren la cantidad de tickets abiertos, cerrados, etc.
});

// Función de navegación general (por si la usas en otras tarjetas de tu menú)
function irAModulo(url) {
    window.location.href = url;
}

// Función para crear una nueva fila de ejecutante
function agregarFilaEjecutante() {
    const tbody = document.getElementById('body_ejecutantes');
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
        <td>
            <select class="sel-ejecutante-tabla">
                <option value="" disabled selected>Escribe o selecciona</option>
                </select>
        </td>
        <td><input type="date" class="date-plan" value="${new Date().toISOString().split('T')[0]}"></td>
        <td><input type="date" class="date-plan" value="${new Date().toISOString().split('T')[0]}"></td>
        <td><input type="text" placeholder="Traslado, instalación..." class="input-tarea"></td>
        <td><button type="button" onclick="this.closest('tr').remove()" class="btn-del">×</button></td>
    `;
    tbody.appendChild(tr);
}

// Escuchador del botón para agregar fila
document.getElementById('btn_add_ejecutante_row')?.addEventListener('click', agregarFilaEjecutante);

// Alerta tipo "Burbuja"
function mostrarAlertaExito(mensaje) {
    const toast = document.createElement('div');
    toast.className = 'toast-exito';
    toast.style.display = 'block';
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Ejemplo al pulsar el botón azul
document.getElementById('btn_finalizar_familia')?.addEventListener('click', () => {
    // Aquí irá la lógica de guardado en BD...
    
    mostrarAlertaExito("✅ Familia agregada con éxito");
    // Lógica para actualizar las últimas 5...
});