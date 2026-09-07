import { CONFIG } from '../config.js';

export class AuthController {
    constructor(onLoginSuccess) {
        this.onLoginSuccess = onLoginSuccess;
        this.initEvents();
        this.checkInitialSession();
    }

    /**
     * Revisa si ya existe una sesión activa al cargar la página
     * y muestra la pantalla correcta (login o app).
     */
    checkInitialSession() {
        if (AuthController.checkSession()) {
            this.showApp();
        } else {
            this.showLogin();
        }
    }

    showApp() {
        const loginScreen = document.getElementById('loginScreen');
        const appShell = document.getElementById('appShell');
        if (loginScreen) loginScreen.style.display = 'none';
        if (appShell) appShell.style.display = 'flex';

        if (typeof this.onLoginSuccess === 'function') {
            this.onLoginSuccess();
        }
    }

    showLogin() {
        const loginScreen = document.getElementById('loginScreen');
        const appShell = document.getElementById('appShell');
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appShell) appShell.style.display = 'none';
    }

    initEvents() {
        const loginBtn = document.getElementById('btnLogin');
        const userInput = document.getElementById('loginUser');
        const passInput = document.getElementById('loginPass');
        const errorEl = document.getElementById('loginError');

        if (!loginBtn) {
            console.warn('[AuthController] No se encontró #btnLogin en el DOM.');
            return;
        }

        const attemptLogin = () => {
            const user = userInput?.value.trim() || '';
            const pass = passInput?.value.trim() || '';

            if (user === CONFIG.AUTH.ADMIN_USER && pass === CONFIG.AUTH.ADMIN_PASS) {
                sessionStorage.setItem(CONFIG.AUTH.SESSION_KEY, '1');
                this.showApp();
            } else {
                if (errorEl) {
                    errorEl.textContent = 'Credenciales incorrectas. Usa admin / admin';
                } else {
                    alert('Credenciales incorrectas. Usa admin / admin');
                }
            }
        };

        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            attemptLogin();
        });

        // Permite enviar con Enter desde cualquiera de los dos campos
        [userInput, passInput].forEach((input) => {
            input?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    attemptLogin();
                }
            });
        });
    }

    static checkSession() {
        return sessionStorage.getItem(CONFIG.AUTH.SESSION_KEY) === '1';
    }
}