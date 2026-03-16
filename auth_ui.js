// Auth UI: menú de usuario + cerrar sesión, reusable para todas las páginas.
// Requiere que el login guarde:
//   localStorage.token (JWT)
//   localStorage.user  (JSON con { username, rol, ... })

(function () {
    const IS_LOGIN = /\/login\.html(\?|#|$)/i.test(location.pathname) || location.pathname === "/";
    const EARLY_TOKEN = localStorage.getItem("token") || "";
    if (!IS_LOGIN && !EARLY_TOKEN) {
        // Redirige lo antes posible (antes de ejecutar lógica de la página)
        location.href = "/";
        return;
    }

    function getSesion() {
        const token = localStorage.getItem("token") || "";
        let user = null;
        try {
            user = JSON.parse(localStorage.getItem("user") || "null");
        } catch (_) {
            user = null;
        }
        return { token, user };
    }

    function esAdmin(user) {
        return String(user?.rol || "").toLowerCase() === "admin";
    }

    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        // Vuelve al landing ("/" sirve login.html)
        location.href = "/";
    }

    function svgUser() {
        return `
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M12 12a4.2 4.2 0 1 0-4.2-4.2A4.2 4.2 0 0 0 12 12Zm0 2c-4.2 0-7.6 2.1-7.6 4.7V20h15.2v-1.3C19.6 16.1 16.2 14 12 14Z"/>
            </svg>
        `;
    }

    function svgChev() {
        return `
            <svg class="auth-menu__chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M7.4 9.4a1 1 0 0 1 1.4 0L12 12.6l3.2-3.2a1 1 0 1 1 1.4 1.4l-3.9 3.9a1 1 0 0 1-1.4 0L7.4 10.8a1 1 0 0 1 0-1.4Z"/>
            </svg>
        `;
    }

    function buildMenu({ user }) {
        const username = user?.username || "Usuario";
        const rol = user?.rol || "-";
        const admin = esAdmin(user);

        const root = document.createElement("div");
        root.className = "auth-menu auth-menu--fixed";
        root.innerHTML = `
            <button type="button" class="auth-menu__btn" id="auth_menu_btn" aria-haspopup="true" aria-expanded="false">
                <span class="auth-menu__avatar">${svgUser()}</span>
                <span class="auth-menu__name" title="${escapeHtml(username)}">${escapeHtml(username)}</span>
                ${svgChev()}
            </button>
            <div class="auth-menu__dropdown" id="auth_menu_dd" role="menu">
                <div class="auth-menu__meta">
                    <div class="u">${escapeHtml(username)}</div>
                    <div class="r">Rol: <strong>${escapeHtml(rol)}</strong></div>
                </div>
                <div class="auth-menu__items">
                    ${admin ? `<a class="auth-item" href="usuarios.html">Gestión de usuarios <span>›</span></a>` : ""}
                    ${admin ? `<a class="auth-item" href="auditoria.html">Auditoría <span>›</span></a>` : ""}
                    <button type="button" class="auth-item danger" id="auth_logout_btn">Cerrar sesión <span>⟶</span></button>
                </div>
            </div>
        `;

        // Evita choque con theme toggle top-right (registro)
        const theme = document.getElementById("theme_toggle");
        if (theme) {
            const cs = getComputedStyle(theme);
            if (cs.position === "fixed" && cs.right !== "auto" && cs.top !== "auto") {
                root.style.right = "72px";
            }
        }

        return root;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (m) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        }[m]));
    }

    function wireMenu(root) {
        const btn = root.querySelector("#auth_menu_btn");
        const dd = root.querySelector("#auth_menu_dd");
        const logoutBtn = root.querySelector("#auth_logout_btn");

        const close = () => {
            root.classList.remove("open");
            btn?.setAttribute("aria-expanded", "false");
        };
        const open = () => {
            root.classList.add("open");
            btn?.setAttribute("aria-expanded", "true");
        };
        const toggle = () => (root.classList.contains("open") ? close() : open());

        btn?.addEventListener("click", (e) => {
            e.stopPropagation();
            toggle();
        });

        dd?.addEventListener("click", (e) => {
            // Permite click dentro sin cerrar inmediatamente
            e.stopPropagation();
        });

        logoutBtn?.addEventListener("click", () => {
            logout();
        });

        document.addEventListener("click", close);
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") close();
        });
    }

    function init() {
        const { token, user } = getSesion();

        // En login no forzamos redirect (login.html ya maneja token existente)
        if (!IS_LOGIN && !token) {
            location.href = "/";
            return;
        }

        if (IS_LOGIN) return;

        // Oculta UI admin-only si corresponde (compat con index.html)
        const admin = esAdmin(user);
        document.querySelectorAll("[data-admin-only]").forEach(el => {
            el.style.display = admin ? "" : "none";
        });

        // Si existe header user-profile, lo reemplazamos por el menú (misma posición, mismo layout)
        const host = document.querySelector(".user-profile");
        if (host) {
            host.innerHTML = "";
            host.style.padding = "0";
            host.style.border = "0";
            host.style.background = "transparent";
            host.style.boxShadow = "none";
            const menu = buildMenu({ user });
            menu.classList.remove("auth-menu--fixed");
            host.appendChild(menu);
            wireMenu(menu);
            return;
        }

        // Fallback: fijo arriba a la derecha
        const menu = buildMenu({ user });
        document.body.appendChild(menu);
        wireMenu(menu);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
