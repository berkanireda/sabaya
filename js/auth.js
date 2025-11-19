// contenu de js/auth.js

let currentSessionUser = null;
/* ====== Configuration Appwrite (Partagée) ====== */
const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const PROJECT = '690f54f700273a8387b3';
const DB_ID = '690f560f001394b2c1a6';
const COL_DRESSES = 'dresses';
const COL_BOOKINGS = 'bookings';
const BUCKET_DRESSES = '690f683500243ed9d576'; // Ajouté depuis catalogue.html
const COL_TYPES = 'dress_types'; // Ajouté depuis catalogue.html

/* ====== Init Appwrite (Partagée) ====== */
const { Client, Databases, ID, Query, Account, Storage, Avatars, Permission, Role } = Appwrite;
const client = new Client();
client.setEndpoint(ENDPOINT).setProject(PROJECT);

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client); // Ajouté pour catalogue.html
const avatars = new Avatars(client); // Ajouté pour Dashboard.html

// Variable globale pour éviter la boucle de redirection
let IS_LOGGING_OUT = false;

/* ====== Logique du Header (Chargement, Auth, Navigation) ====== */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Définir le titre spécifique de la page
    const pageTitles = {
        'index.html': 'Calendrier',
        'catalogue.html': 'Catalogue',
        'dashboard.html': 'Tableau de Bord',
    };
    const currentPath = window.location.pathname.split('/').pop();
    const pageTitle = pageTitles[currentPath] || 'Gestion';

    // 2. Lancer le chargement du header
    await loadHeaderAndAuth(pageTitle);

    // 3. (Optionnel) Exécuter la fonction d'initialisation spécifique à la page si elle existe
    // Cela permet de garder ton code de page propre.
if (currentSessionUser && typeof initPage === 'function') {
        initPage();
    }
});

/**
 * Charge le header, gère l'authentification et l'état de navigation
 * @param {string} pageTitle - Le sous-titre à afficher dans le header
 */
async function loadHeaderAndAuth(pageTitle) {
    const headerPlaceholder = document.getElementById('sidebar-placeholder');
    if (!headerPlaceholder) return;

    try {
        const response = await fetch('header.html'); // Assure-toi que header.html est à la racine
        if (!response.ok) throw new Error(`header.html introuvable (${response.status})`);
        
        const headerHTML = await response.text();
        headerPlaceholder.innerHTML = headerHTML;

        // Le header est injecté, on peut maintenant trouver ses éléments
        const userNameEl = document.getElementById('user-name');
        const userAvatarEl = document.getElementById('user-avatar');
        const logoutBtn = document.getElementById('logout-btn');
        const headerSubtitle = document.getElementById('header-subtitle');

        // A. Mettre à jour le sous-titre de la page
        if (headerSubtitle) headerSubtitle.textContent = pageTitle;

        // B. Gérer le lien "actif"
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const activeLink = document.querySelector(`.nav-link[href$="${currentPath}"]`);
        
        if (activeLink) {
            activeLink.classList.remove('text-slate-600', 'hover:bg-slate-100', 'hover:text-slate-900');
            activeLink.classList.add('text-blue-600', 'bg-blue-50');
        }

        // C. Gérer la déconnexion
        logoutBtn.addEventListener('click', async () => {
            IS_LOGGING_OUT = true;
            document.body.style.opacity = '0';
            try {
                await account.deleteSession('current');
            } catch (_) {
                // Ignore les erreurs, on redirige quoi qu'il arrive
            }
            window.location.replace('login.html');
        });

        // D. Gérer l'authentification (vérification + affichage infos)
        try {
            // ON STOCKE L'UTILISATEUR CONNECTÉ
            currentSessionUser = await account.get(); 
            
            if (userNameEl) userNameEl.textContent = currentSessionUser.name || currentSessionUser.email;
            if (userAvatarEl) userAvatarEl.src = avatars.getInitials(currentSessionUser.name || currentSessionUser.email).toString();
        
        } catch (err) {
            // Si on n'est pas sur login.html et qu'on n'est pas en train de se déconnecter
            if (!IS_LOGGING_OUT && currentPath !== 'login.html') {
                window.location.replace('login.html');
            }
        }

    } catch (err) {
        console.error('Erreur lors du chargement du header:', err);
        headerPlaceholder.innerHTML = '<div class="p-4 text-center text-red-600">Erreur de chargement du header.</div>';
    }



}


function getCurrentUser() {
    return currentSessionUser;
}