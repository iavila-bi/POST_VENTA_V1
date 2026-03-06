document.addEventListener("DOMContentLoaded", () => {
    inicializarTema();
    renderFechaActual();
    activarEfectosDashboard();
});

const STORAGE_KEY_TEMA = "app_postventa_tema";

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

function renderFechaActual() {
    const elFecha = document.getElementById("fecha-actual");
    if (!elFecha) return;

    const hoy = new Date();
    const texto = hoy.toLocaleDateString("es-CL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    elFecha.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
}

function activarEfectosDashboard() {
    const cards = document.querySelectorAll(".card");
    cards.forEach((card, index) => {
        card.style.animationDelay = `${0.08 * index}s`;
        card.classList.add("card-reveal");
    });
}
