/**
 * TalentOS - Authentication Controller (Supabase Auth Real + Multi-Tenant Isolation)
 */

import { CONFIG } from '../config.js';
import { supabaseService } from '../services/supabase.js';
import { telemetry } from '../services/telemetry.js';

export class AuthController {
    constructor(onLoginSuccess) {
        this.onLoginSuccess = onLoginSuccess;
        this.mode = 'login'; // 'login' | 'signup'
        this.initEvents();
        this.checkInitialSession();
    }

    async checkInitialSession() {
        try {
            const user = await supabaseService.getCurrentUser();
            if (user) {
                this.updateUserProfile(user.email);
                this.showApp();
                return;
            }
        } catch (e) {
            console.warn('[AuthController] Error checking Supabase session:', e);
        }

        // Demo fallback check
        if (sessionStorage.getItem(CONFIG.AUTH.SESSION_KEY) === '1') {
            this.updateUserProfile('admin@talentos.ai');
            this.showApp();
        } else {
            this.showLogin();
        }
    }

    updateUserProfile(email) {
        const sideUser = document.getElementById('btnLogout');
        if (!sideUser) return;

        const cleanName = email ? email.split('@')[0] : 'Reclutador';
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=0284c7&color=fff`;

        sideUser.innerHTML = `
            <img src="${avatarUrl}" alt="Avatar">
            <div style="flex:1; overflow:hidden;">
                <p style="font-size: 13px; font-weight: 600; color: #f8fafc; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;" title="${email}">
                    ${email || 'Usuario Activo'}
                </p>
                <p style="font-size: 11px; color: #94a3b8;"><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</p>
            </div>
        `;
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
        const toggleBtn = document.getElementById('btnToggleAuthMode');
        const logoutBtn = document.getElementById('btnLogout');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.mode = this.mode === 'login' ? 'signup' : 'login';
                this.updateAuthUi();
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (confirm('¿Deseas cerrar tu sesión de TalentOS?')) {
                    sessionStorage.removeItem(CONFIG.AUTH.SESSION_KEY);
                    await supabaseService.signOut();
                    this.showLogin();
                }
            });
        }

        const handleAuthAction = async () => {
            const emailOrUser = userInput?.value.trim() || '';
            const password = passInput?.value.trim() || '';

            if (errorEl) errorEl.textContent = '';

            if (!emailOrUser || !password) {
                if (errorEl) errorEl.textContent = 'Ingresa usuario/correo y contraseña.';
                return;
            }

            // Si se usan credenciales demo admin/admin
            if (emailOrUser === CONFIG.AUTH.ADMIN_USER && password === CONFIG.AUTH.ADMIN_PASS) {
                sessionStorage.setItem(CONFIG.AUTH.SESSION_KEY, '1');
                this.updateUserProfile('admin@talentos.ai');
                this.showApp();
                return;
            }

            // Validar formato de correo para Supabase Auth
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrUser);
            const targetEmail = isEmail ? emailOrUser : `${emailOrUser}@talentos.ai`;

            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
            }

            try {
                if (this.mode === 'login') {
                    const res = await supabaseService.signIn(targetEmail, password);
                    sessionStorage.setItem(CONFIG.AUTH.SESSION_KEY, '1');
                    this.updateUserProfile(res.user?.email || targetEmail);
                    this.showApp();
                } else {
                    const res = await supabaseService.signUp(targetEmail, password);
                    if (res.user && !res.session) {
                        alert(`¡Cuenta creada para ${targetEmail}! Si se requiere confirmación por correo, por favor revisa tu bandeja de entrada.`);
                    } else {
                        sessionStorage.setItem(CONFIG.AUTH.SESSION_KEY, '1');
                        this.updateUserProfile(res.user?.email || targetEmail);
                        this.showApp();
                    }
                }
            } catch (err) {
                if (errorEl) {
                    let msg = err.message;
                    if (msg.includes('Invalid login credentials')) msg = 'Correo o contraseña incorrectos.';
                    if (msg.includes('already registered')) msg = 'Este correo ya se encuentra registrado. Inicia sesión.';
                    if (msg.includes('Password should be at least')) msg = 'La contraseña debe tener al menos 6 caracteres.';
                    errorEl.textContent = msg;
                }
            } finally {
                if (loginBtn) {
                    loginBtn.disabled = false;
                    this.updateAuthUi();
                }
            }
        };

        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleAuthAction();
            });
        }

        [userInput, passInput].forEach((input) => {
            input?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAuthAction();
                }
            });
        });
    }

    updateAuthUi() {
        const titleEl = document.getElementById('loginTitle');
        const subtitleEl = document.getElementById('loginSubtitle');
        const loginBtn = document.getElementById('btnLogin');
        const toggleBtn = document.getElementById('btnToggleAuthMode');
        const userLabel = document.getElementById('loginUserLabel');

        if (this.mode === 'signup') {
            if (titleEl) titleEl.textContent = 'Crear Cuenta en TalentOS';
            if (subtitleEl) subtitleEl.textContent = 'Registra tu empresa o perfil de reclutador para gestionar tus vacantes privadas con RLS.';
            if (loginBtn) loginBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Registrarme y Acceder';
            if (toggleBtn) toggleBtn.innerHTML = '¿Ya tienes una cuenta? <strong>Inicia sesión</strong>';
            if (userLabel) userLabel.textContent = 'Correo Electrónico';
        } else {
            if (titleEl) titleEl.textContent = 'TalentOS';
            if (subtitleEl) subtitleEl.textContent = 'Acceso seguro al sistema de inteligencia de talento y evaluación de CVs.';
            if (loginBtn) loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión';
            if (toggleBtn) toggleBtn.innerHTML = '¿No tienes cuenta aún? <strong>Regístrate aquí</strong>';
            if (userLabel) userLabel.textContent = 'Correo o Usuario';
        }
    }
}