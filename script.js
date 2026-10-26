
/* =========================
   CONFIGURATION SUPABASE
========================= */

const SUPABASE_URL = "https://htsxwtgcgczmdgexfxny.supabase.co";
const SUPABASE_KEY = "sb_publishable_hxcdPuJMlrh9yd4W5n-MhQ_mYeak9am";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let currentStudent = null;


/* =========================
   OUTILS GÉNÉRAUX
========================= */

function app() {
    return document.getElementById("app");
}


function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[char];
    });
}


function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleDateString("fr-FR");
}


function formatDuration(minutes) {
    const total = Number(minutes) || 0;
    const hours = Math.floor(total / 60);
    const remainingMinutes = total % 60;

    if (hours && remainingMinutes) {
        return `${hours} h ${remainingMinutes} min`;
    }

    if (hours) {
        return `${hours} h`;
    }

    return `${remainingMinutes} min`;
}


function durationOptions(selected = 60) {
    const durations = [
        { label: "30 minutes", minutes: 30 },
        { label: "45 minutes", minutes: 45 },
        { label: "1 heure", minutes: 60 },
        { label: "1 h 15", minutes: 75 },
        { label: "1 h 30", minutes: 90 },
        { label: "1 h 45", minutes: 105 },
        { label: "2 heures", minutes: 120 },
        { label: "2 h 30", minutes: 150 },
        { label: "3 heures", minutes: 180 }
    ];

    return durations.map(item => `
        <option
            value="${item.minutes}"
            ${Number(selected) === item.minutes ? "selected" : ""}
        >
            ${item.label}
        </option>
    `).join("");
}


/* =========================
   ACCUEIL
========================= */

function showHome() {
    app().innerHTML = `
        <div class="home-page">
            <h1>NSK Éducation</h1>
            <p>Accompagnement scolaire et suivi personnalisé</p>

            <button onclick="showLogin()">
                Se connecter
            </button>
        </div>
    `;
}


/* =========================
   CONNEXION
========================= */

function showLogin() {
    app().innerHTML = `
        <div class="login-page">
            <h1>Connexion</h1>

            <form onsubmit="login(event)">
                <label for="login-email">Adresse e-mail</label>
                <input
                    id="login-email"
                    type="email"
                    autocomplete="email"
                    required
                >

                <label for="login-password">Mot de passe</label>
                <input
                    id="login-password"
                    type="password"
                    autocomplete="current-password"
                    required
                >

                <button type="submit">
                    Se connecter
                </button>
            </form>

            <button onclick="forgotPassword()">
                Mot de passe oublié ?
            </button>

            <button onclick="showHome()">
                Retour à l'accueil
            </button>
        </div>
    `;
}


async function login(event) {
    event.preventDefault();

    const email = document
        .getElementById("login-email")
        .value.trim();

    const password = document
        .getElementById("login-password")
        .value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert("Connexion impossible : " + error.message);
        return;
    }

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", data.user.id)
            .single();

    if (profileError || !profile || profile.role !== "teacher") {
        await supabaseClient.auth.signOut();

        alert("Ce compte n'a pas accès à l'espace enseignant.");
        showHome();
        return;
    }

    currentStudent = null;
    await showDashboard();
}


async function forgotPassword() {
    const email = prompt(
        "Saisis l'adresse e-mail associée à ton compte :"
    );

    if (!email || !email.trim()) {
        return;
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(
        email.trim(),
        {
            redirectTo: window.location.origin
        }
    );

    if (error) {
        alert("Impossible d'envoyer le lien : " + error.message);
        return;
    }

    alert("Si cette adresse est associée à un compte, un e-mail de réinitialisation a été envoyé.");
}


/* =========================
   TABLEAU DE BORD
========================= */

async function showDashboard() {
    currentStudent = null;

    const { data: students, error } =
        await supabaseClient
            .from("Students")
            .select("*")
            .order("name", { ascending: true });

    if (error) {
        app().innerHTML = `
            <div class="dashboard">
                <h1>NSK Éducation</h1>
                <p>Impossible de charger les élèves.</p>
                <p>${escapeHTML(error.message)}</p>
                <button onclick="logout()">Déconnexion</button>
            </div>
        `;
        return;
    }

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <div>
                    <h1>NSK Éducation</h1>
                    <p>Gestion des élèves</p>
                </div>

                <button onclick="logout()">
                    Déconnexion
                </button>
            </div>

            <div class="section-title">
                <h2 class="page-title">Mes élèves</h2>
                <button onclick="showAddStudent()">
                    + Ajouter un élève
                </button>
            </div>

            <div class="students-grid">
                ${
                    students && students.length
                        ? students.map(student => `
                            <div class="student-card">
                                <div
                                    role="button"
                                    tabindex="0"
                                    onclick="openStudent('${String(student.id)}')"
                                    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openStudent('${String(student.id)}')}"
                                >
                                    <h3>${escapeHTML(student.name)}</h3>
                                    <p>${escapeHTML(student.class || "")}</p>
                                </div>

                                <div class="student-actions">
                                    <button
                                        onclick="event.stopPropagation();editStudent('${String(student.id)}')"
                                    >
                                        Modifier
                                    </button>

                                    <button
                                        onclick="event.stopPropagation();deleteStudent('${String(student.id)}')"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        `).join("")
                        : `<p>Aucun élève enregistré pour le moment.</p>`
                }
            </div>
        </div>
    `;
}


/* =========================
   AJOUTER UN ÉLÈVE
========================= */

function showAddStudent() {
    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <h1>Ajouter un élève</h1>
                <button onclick="showDashboard()">Retour</button>
            </div>

            <section>
                <label for="student-name">Nom et prénom</label>
                <input
                    id="student-name"
                    type="text"
                    required
                    style="width:100%;padding:12px;margin:8px 0 15px;"
                >

                <label for="student-class">Classe</label>
                <input
                    id="student-class"
                    type="text"
                    style="width:100%;padding:12px;margin:8px 0 15px;"
                >

                <button onclick="addStudent()">
                    Enregistrer l'élève
                </button>

                <button onclick="showDashboard()">
                    Annuler
                </button>
            </section>
        </div>
    `;
}


async function addStudent() {
    const name = document
        .getElementById("student-name")
        .value.trim();

    const studentClass = document
        .getElementById("student-class")
        .value.trim();

    if (!name) {
        alert("Le nom de l'élève est obligatoire.");
        return;
    }

    const { error } = await supabaseClient
        .from("Students")
        .insert({
            name,
            class: studentClass
        });

    if (error) {
        alert("Impossible d'ajouter l'élève : " + error.message);
        return;
    }

    await showDashboard();
}


/* =========================
   MODIFIER UN ÉLÈVE
========================= */

async function editStudent(id) {
    const { data: student, error } =
        await supabaseClient
            .from("Students")
            .select("*")
            .eq("id", id)
            .single();

    if (error || !student) {
        alert(error?.message || "Élève introuvable.");
        return;
    }

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <h1>Modifier un élève</h1>
                <button onclick="showDashboard()">Retour</button>
            </div>

            <section>
                <label for="edit-student-name">Nom et prénom</label>
                <input
                    id="edit-student-name"
                    value="${escapeHTML(student.name)}"
                    required
                    style="width:100%;padding:12px;margin:8px 0 15px;"
                >

                <label for="edit-student-class">Classe</label>
                <input
                    id="edit-student-class"
                    value="${escapeHTML(student.class || "")}"
                    style="width:100%;padding:12px;margin:8px 0 15px;"
                >

                <button onclick="saveStudent('${String(student.id)}')">
                    Enregistrer les modifications
                </button>

                <button onclick="showDashboard()">
                    Annuler
                </button>
            </section>
        </div>
    `;
}


async function saveStudent(id) {
    const name = document
        .getElementById("edit-student-name")
        .value.trim();

    const studentClass = document
        .getElementById("edit-student-class")
        .value.trim();

    if (!name) {
        alert("Le nom de l'élève est obligatoire.");
        return;
    }

    const { error } = await supabaseClient
        .from("Students")
        .update({
            name,
            class: studentClass
        })
        .eq("id", id);

    if (error) {
        alert("Impossible de modifier l'élève : " + error.message);
        return;
    }

    await showDashboard();
}


/* =========================
   SUPPRIMER UN ÉLÈVE
========================= */

async function deleteStudent(id) {
    const { data: student, error: findError } =
        await supabaseClient
            .from("Students")
            .select("name")
            .eq("id", id)
            .single();

    if (findError || !student) {
        alert(findError?.message || "Élève introuvable.");
        return;
    }

    if (!confirm(`Supprimer l'élève ${student.name} ?`)) {
        return;
    }

    const { error } = await supabaseClient
        .from("Students")
        .delete()
        .eq("id", id);

    if (error) {
        alert("Impossible de supprimer l'élève : " + error.message);
        return;
    }

    await showDashboard();
}


/* =========================
   OUVRIR LA FICHE D'UN ÉLÈVE
========================= */

async function openStudent(id) {
    const clickedId = String(id);

    const { data: student, error } =
        await supabaseClient
            .from("Students")
            .select("*")
            .eq("id", clickedId)
            .single();

    if (error || !student) {
        alert(error?.message || "Élève introuvable.");
        return;
    }

    // Vérification : on ouvre la fiche correspondant à l'identifiant cliqué.
    if (String(student.id) !== clickedId) {
        alert("Erreur : l'identifiant de l'élève ne correspond pas.");
        return;
    }

    currentStudent = student;
    renderStudentPage();
}


/* =========================
   PAGE PRINCIPALE DE L'ÉLÈVE
========================= */

function renderStudentPage() {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <div>
                    <h1>${escapeHTML(currentStudent.name)}</h1>
                    <p>${escapeHTML(currentStudent.class || "")}</p>
                </div>

                <button onclick="showDashboard()">
                    Retour aux élèves
                </button>
            </div>

            <div class="student-menu">
                <button onclick="showSessions()">Séances</button>
                <button onclick="showNotes()">Notes</button>
                <button onclick="showProgress()">Progression</button>
                <button onclick="showDifficulties()">Difficultés</button>
            </div>
        </div>
    `;
}
// ============================================
// PARTIE 2 — FICHE ÉLÈVE ET SÉANCES
// ============================================

// Afficher la fiche de l'élève sélectionné
async function openStudent(id) {
    try {
        const studentId = Number(id);

        if (!Number.isSafeInteger(studentId) || studentId <= 0) {
            alert("Identifiant d'élève invalide.");
            return;
        }

        const { data: student, error } = await supabaseClient
            .from("Students")
            .select("*")
            .eq("id", studentId)
            .single();

        if (error) throw error;

        if (!student) {
            alert("Élève introuvable.");
            return;
        }

        // Toujours conserver l'élève réellement sélectionné
        currentStudent = student;

        renderStudentPage();
    } catch (error) {
        console.error("Erreur ouverture fiche élève :", error);
        alert("Impossible d'ouvrir cette fiche élève.");
    }
}


// Afficher la fiche de l'élève
function renderStudentPage() {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    const student = currentStudent;

    app.innerHTML = `
        <div class="page-container">
            <button class="btn btn-secondary" onclick="showDashboard()">
                ← Retour aux élèves
            </button>

            <div class="student-header">
                <h1>${escapeHTML(student.name || "Élève")}</h1>
                <p>Classe : ${escapeHTML(student.class || "Non renseignée")}</p>
            </div>

            <div class="student-menu">
                <button class="btn" onclick="showSessions()">
                    Séances
                </button>

                <button class="btn" onclick="showNotes()">
                    Notes
                </button>

                <button class="btn" onclick="showProgress()">
                    Progression
                </button>

                <button class="btn" onclick="showDifficulties()">
                    Difficultés
                </button>
            </div>
        </div>
    `;
}


// ============================================
// SÉANCES — LISTE DES SÉANCES DE L'ÉLÈVE
// ============================================

async function showSessions() {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    const studentId = currentStudent.id;

    app.innerHTML = `
        <div class="page-container">
            <button class="btn btn-secondary" onclick="renderStudentPage()">
                ← Retour à la fiche
            </button>

            <h1>Séances de ${escapeHTML(currentStudent.name || "")}</h1>

            <button class="btn btn-primary"
                onclick="addSessionForSubject()">
                + Ajouter une séance
            </button>

            <div id="sessions-list">
                Chargement des séances...
            </div>
        </div>
    `;

    try {
        const { data: sessions, error } = await supabaseClient
            .from("Sessions")
            .select("*")
            .eq("student_id", studentId)
            .order("date", { ascending: false });

        if (error) throw error;

        // Éviter d'afficher les résultats d'un autre élève
        if (!currentStudent || Number(currentStudent.id) !== Number(studentId)) {
            return;
        }

        const list = document.getElementById("sessions-list");
        if (!list) return;

        if (!sessions || sessions.length === 0) {
            list.innerHTML = `
                <p>Aucune séance enregistrée pour cet élève.</p>
            `;
            return;
        }

        list.innerHTML = sessions.map(session => `
            <div class="session-card">
                <h3>${escapeHTML(session.subject || "Séance")}</h3>

                <p>
                    Date :
                    ${escapeHTML(session.date || "Non renseignée")}
                </p>

                <button class="btn"
                    onclick="showSession(${Number(session.id)})">
                    Ouvrir
                </button>
            </div>
        `).join("");

    } catch (error) {
        console.error("Erreur chargement séances :", error);

        const list = document.getElementById("sessions-list");
        if (list) {
            list.innerHTML = `
                <p>Erreur lors du chargement des séances.</p>
            `;
        }
    }
}


// ============================================
// AJOUTER UNE SÉANCE
// ============================================

function addSessionForSubject() {
    if (!currentStudent) {
        alert("Veuillez d'abord sélectionner un élève.");
        return;
    }

    app.innerHTML = `
        <div class="page-container">
            <button class="btn btn-secondary" onclick="showSessions()">
                ← Retour aux séances
            </button>

            <h1>Nouvelle séance</h1>

            <form id="add-session-form">
                <label for="session-subject">Matière</label>
                <input
                    id="session-subject"
                    name="subject"
                    type="text"
                    required
                >

                <label for="session-date">Date</label>
                <input
                    id="session-date"
                    name="date"
                    type="date"
                    value="${new Date().toISOString().slice(0, 10)}"
                    required
                >

                <label for="session-duration">Durée (minutes)</label>
                <input
                    id="session-duration"
                    name="duration"
                    type="number"
                    min="1"
                    value="60"
                    required
                >

                <label for="session-content">Contenu de la séance</label>
                <textarea
                    id="session-content"
                    name="content"
                    rows="5"
                ></textarea>

                <button class="btn btn-primary" type="submit">
                    Enregistrer la séance
                </button>
            </form>
        </div>
    `;

    document.getElementById("add-session-form")
        .addEventListener("submit", addSession);
}


// Enregistrer une nouvelle séance
async function addSession(event) {
    if (event) event.preventDefault();

    if (!currentStudent) {
        alert("Aucun élève sélectionné.");
        return;
    }

    const studentId = currentStudent.id;
    const form = document.getElementById("add-session-form");

    if (!form) return;

    const formData = new FormData(form);

    const session = {
        student_id: studentId,
        subject: String(formData.get("subject") || "").trim(),
        date: String(formData.get("date") || ""),
        duration: Number(formData.get("duration") || 60),
        content: String(formData.get("content") || "").trim()
    };

    if (!session.subject || !session.date || session.duration <= 0) {
        alert("Veuillez vérifier les champs du formulaire.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Sessions")
            .insert(session);

        if (error) throw error;

        alert("Séance enregistrée !");
        showSessions();

    } catch (error) {
        console.error("Erreur ajout séance :", error);
        alert("Impossible d'enregistrer la séance. Vérifiez les colonnes de la table Sessions.");
    }
}


// ============================================
// OUVRIR UNE SÉANCE PRÉCISE
// ============================================

async function showSession(id) {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    const studentId = currentStudent.id;
    const sessionId = Number(id);

    if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
        alert("Identifiant de séance invalide.");
        return;
    }

    try {
        const { data: session, error } = await supabaseClient
            .from("Sessions")
            .select("*")
            .eq("id", sessionId)
            .eq("student_id", studentId)
            .single();

        if (error) throw error;

        if (!session) {
            alert("Cette séance n'existe pas pour cet élève.");
            return;
        }

        // Vérifier que l'élève actif n'a pas changé pendant la requête
        if (
            !currentStudent ||
            Number(currentStudent.id) !== Number(studentId)
        ) {
            return;
        }

        app.innerHTML = `
            <div class="page-container">
                <button class="btn btn-secondary" onclick="showSessions()">
                    ← Retour aux séances
                </button>

                <h1>${escapeHTML(session.subject || "Séance")}</h1>

                <p>
                    Élève :
                    <strong>${escapeHTML(currentStudent.name || "")}</strong>
                </p>

                <p>Date : ${escapeHTML(session.date || "Non renseignée")}</p>

                <p>Durée : ${escapeHTML(String(session.duration ?? ""))} minutes</p>

                <h3>Contenu</h3>
                <div class="session-content">
                    ${escapeHTML(session.content || "Aucun contenu renseigné.")}
                </div>

                <button class="btn"
                    onclick="editSession(${Number(session.id)})">
                    Modifier
                </button>

                <button class="btn btn-danger"
                    onclick="deleteSession(${Number(session.id)})">
                    Supprimer
                </button>
            </div>
        `;

    } catch (error) {
        console.error("Erreur ouverture séance :", error);
        alert("Impossible d'ouvrir cette séance.");
    }
}
// ============================================
// PARTIE 3 — MODIFIER UNE SÉANCE
// ============================================

async function editSession(id) {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    const studentId = currentStudent.id;
    const sessionId = Number(id);

    try {
        const { data: session, error } = await supabaseClient
            .from("Sessions")
            .select("*")
            .eq("id", sessionId)
            .eq("student_id", studentId)
            .single();

        if (error) throw error;

        if (
            !currentStudent ||
            Number(currentStudent.id) !== Number(studentId)
        ) {
            return;
        }

        app.innerHTML = `
            <div class="page-container">
                <button class="btn btn-secondary" onclick="showSessions()">
                    ← Retour
                </button>

                <h1>Modifier la séance</h1>

                <form id="edit-session-form">
                    <label for="edit-subject">Matière</label>
                    <input
                        id="edit-subject"
                        name="subject"
                        type="text"
                        value="${escapeHTML(session.subject || "")}"
                        required
                    >

                    <label for="edit-date">Date</label>
                    <input
                        id="edit-date"
                        name="date"
                        type="date"
                        value="${escapeHTML(session.date || "")}"
                        required
                    >

                    <label for="edit-duration">Durée (minutes)</label>
                    <input
                        id="edit-duration"
                        name="duration"
                        type="number"
                        min="1"
                        value="${Number(session.duration) || 60}"
                        required
                    >

                    <label for="edit-content">Contenu</label>
                    <textarea
                        id="edit-content"
                        name="content"
                        rows="6"
                    >${escapeHTML(session.content || "")}</textarea>

                    <button class="btn btn-primary" type="submit">
                        Enregistrer les modifications
                    </button>
                </form>
            </div>
        `;

        document
            .getElementById("edit-session-form")
            .addEventListener("submit", function(event) {
                saveEditedSession(event, sessionId, studentId);
            });

    } catch (error) {
        console.error("Erreur chargement séance :", error);
        alert("Impossible de charger cette séance.");
    }
}


// Enregistrer les modifications d'une séance
async function saveEditedSession(event, sessionId, studentId) {
    event.preventDefault();

    if (
        !currentStudent ||
        Number(currentStudent.id) !== Number(studentId)
    ) {
        alert("L'élève sélectionné a changé. Veuillez réessayer.");
        return;
    }

    const form = document.getElementById("edit-session-form");
    if (!form) return;

    const formData = new FormData(form);

    const updates = {
        subject: String(formData.get("subject") || "").trim(),
        date: String(formData.get("date") || ""),
        duration: Number(formData.get("duration")),
        content: String(formData.get("content") || "").trim()
    };

    if (
        !updates.subject ||
        !updates.date ||
        !Number.isFinite(updates.duration) ||
        updates.duration <= 0
    ) {
        alert("Veuillez vérifier les informations saisies.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Sessions")
            .update(updates)
            .eq("id", sessionId)
            .eq("student_id", studentId);

        if (error) throw error;

        alert("Séance modifiée avec succès !");
        showSessions();

    } catch (error) {
        console.error("Erreur modification séance :", error);
        alert("Impossible de modifier la séance.");
    }
}


// ============================================
// SUPPRIMER UNE SÉANCE
// ============================================

async function deleteSession(id) {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    const studentId = currentStudent.id;
    const sessionId = Number(id);

    if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
        alert("Identifiant de séance invalide.");
        return;
    }

    const confirmation = confirm(
        "Voulez-vous vraiment supprimer cette séance ? Cette action est irréversible."
    );

    if (!confirmation) return;

    try {
        const { error } = await supabaseClient
            .from("Sessions")
            .delete()
            .eq("id", sessionId)
            .eq("student_id", studentId);

        if (error) throw error;

        alert("Séance supprimée.");
        showSessions();

    } catch (error) {
        console.error("Erreur suppression séance :", error);
        alert("Impossible de supprimer cette séance.");
    }
}
// ============================================
// PARTIE 4 — NOTES
// ============================================

async function showNotes() {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    const studentId = currentStudent.id;

    app.innerHTML = `
        <div class="page-container">
            <button class="btn btn-secondary" onclick="renderStudentPage()">
                ← Retour à la fiche
            </button>

            <h1>Notes — ${escapeHTML(currentStudent.name || "")}</h1>

            <form id="note-form">
                <label for="note-title">Titre</label>
                <input id="note-title" name="title" required>

                <label for="note-content">Note</label>
                <textarea id="note-content" name="content" rows="4" required></textarea>

                <button class="btn btn-primary" type="submit">
                    Ajouter une note
                </button>
            </form>

            <div id="notes-list">Chargement...</div>
        </div>
    `;

    document.getElementById("note-form")
        .addEventListener("submit", saveNote);

    try {
        const { data, error } = await supabaseClient
            .from("Notes")
            .select("*")
            .eq("student_id", studentId)
            .order("id", { ascending: false });

        if (error) throw error;

        if (!currentStudent || Number(currentStudent.id) !== Number(studentId)) {
            return;
        }

        const list = document.getElementById("notes-list");
        if (!list) return;

        list.innerHTML = !data || data.length === 0
            ? "<p>Aucune note enregistrée.</p>"
            : data.map(note => `
                <article class="note-card">
                    <h3>${escapeHTML(note.title || "Note")}</h3>
                    <p>${escapeHTML(note.content || "")}</p>
                    <button class="btn btn-danger"
                        onclick="deleteNote(${Number(note.id)})">
                        Supprimer
                    </button>
                </article>
            `).join("");

    } catch (error) {
        console.error("Erreur chargement notes :", error);
        const list = document.getElementById("notes-list");
        if (list) list.textContent = "Impossible de charger les notes.";
    }
}


async function saveNote(event) {
    event.preventDefault();

    if (!currentStudent) return;

    const studentId = currentStudent.id;
    const form = document.getElementById("note-form");
    if (!form) return;

    const formData = new FormData(form);

    const note = {
        student_id: studentId,
        title: String(formData.get("title") || "").trim(),
        content: String(formData.get("content") || "").trim()
    };

    if (!note.title || !note.content) {
        alert("Veuillez remplir le titre et la note.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Notes")
            .insert(note);

        if (error) throw error;

        showNotes();

    } catch (error) {
        console.error("Erreur enregistrement note :", error);
        alert("Impossible d'enregistrer la note. Vérifiez la structure de la table Notes.");
    }
}


async function deleteNote(id) {
    if (!currentStudent) return;

    if (!confirm("Supprimer cette note ?")) return;

    try {
        const { error } = await supabaseClient
            .from("Notes")
            .delete()
            .eq("id", Number(id))
            .eq("student_id", currentStudent.id);

        if (error) throw error;

        showNotes();

    } catch (error) {
        console.error("Erreur suppression note :", error);
        alert("Impossible de supprimer cette note.");
    }
}


// ============================================
// PARTIE 4 — PROGRESSION
// ============================================

async function showProgress() {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    const studentId = currentStudent.id;

    app.innerHTML = `
        <div class="page-container">
            <button class="btn btn-secondary" onclick="renderStudentPage()">
                ← Retour à la fiche
            </button>

            <h1>Progression — ${escapeHTML(currentStudent.name || "")}</h1>

            <form id="progress-form">
                <label for="progress-subject">Matière</label>
                <input id="progress-subject" name="subject" required>

                <label for="progress-level">Niveau / progression</label>
                <input id="progress-level" name="level" required>

                <label for="progress-comment">Commentaire</label>
                <textarea id="progress-comment" name="comment" rows="4"></textarea>

                <button class="btn btn-primary" type="submit">
                    Enregistrer
                </button>
            </form>

            <div id="progress-list">Chargement...</div>
        </div>
    `;

    document.getElementById("progress-form")
        .addEventListener("submit", saveProgress);

    try {
        const { data, error } = await supabaseClient
            .from("Progress")
            .select("*")
            .eq("student_id", studentId)
            .order("id", { ascending: false });

        if (error) throw error;

        if (!currentStudent || Number(currentStudent.id) !== Number(studentId)) {
            return;
        }

        const list = document.getElementById("progress-list");
        if (!list) return;

        list.innerHTML = !data || data.length === 0
            ? "<p>Aucune progression enregistrée.</p>"
            : data.map(item => `
                <article class="progress-card">
                    <h3>${escapeHTML(item.subject || "Matière")}</h3>
                    <p><strong>Niveau :</strong> ${escapeHTML(item.level || "")}</p>
                    <p>${escapeHTML(item.comment || "")}</p>
                    <button class="btn btn-danger"
                        onclick="deleteProgress(${Number(item.id)})">
                        Supprimer
                    </button>
                </article>
            `).join("");

    } catch (error) {
        console.error("Erreur chargement progression :", error);
        const list = document.getElementById("progress-list");
        if (list) list.textContent = "Impossible de charger la progression.";
    }
}


async function saveProgress(event) {
    event.preventDefault();

    if (!currentStudent) return;

    const form = document.getElementById("progress-form");
    if (!form) return;

    const formData = new FormData(form);

    const record = {
        student_id: currentStudent.id,
        subject: String(formData.get("subject") || "").trim(),
        level: String(formData.get("level") || "").trim(),
        comment: String(formData.get("comment") || "").trim()
    };

    if (!record.subject || !record.level) {
        alert("Veuillez remplir la matière et le niveau.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Progress")
            .insert(record);

        if (error) throw error;

        showProgress();

    } catch (error) {
        console.error("Erreur enregistrement progression :", error);
        alert("Impossible d'enregistrer la progression. Vérifiez la structure de la table Progress.");
    }
}


async function deleteProgress(id) {
    if (!currentStudent) return;
    if (!confirm("Supprimer cette progression ?")) return;

    try {
        const { error } = await supabaseClient
            .from("Progress")
            .delete()
            .eq("id", Number(id))
            .eq("student_id", currentStudent.id);

        if (error) throw error;

        showProgress();

    } catch (error) {
        console.error("Erreur suppression progression :", error);
        alert("Impossible de supprimer cette progression.");
    }
}


// ============================================
// PARTIE 4 — DIFFICULTÉS
// ============================================

async function showDifficulties() {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    const studentId = currentStudent.id;

    app.innerHTML = `
        <div class="page-container">
            <button class="btn btn-secondary" onclick="renderStudentPage()">
                ← Retour à la fiche
            </button>

            <h1>Difficultés — ${escapeHTML(currentStudent.name || "")}</h1>

            <form id="difficulty-form">
                <label for="difficulty-subject">Matière</label>
                <input id="difficulty-subject" name="subject" required>

                <label for="difficulty-description">Difficulté constatée</label>
                <textarea id="difficulty-description" name="description"
                    rows="4" required></textarea>

                <button class="btn btn-primary" type="submit">
                    Ajouter
                </button>
            </form>

            <div id="difficulties-list">Chargement...</div>
        </div>
    `;

    document.getElementById("difficulty-form")
        .addEventListener("submit", saveDifficulty);

    try {
        const { data, error } = await supabaseClient
            .from("Difficulties")
            .select("*")
            .eq("student_id", studentId)
            .order("id", { ascending: false });

        if (error) throw error;

        if (!currentStudent || Number(currentStudent.id) !== Number(studentId)) {
            return;
        }

        const list = document.getElementById("difficulties-list");
        if (!list) return;

        list.innerHTML = !data || data.length === 0
            ? "<p>Aucune difficulté enregistrée.</p>"
            : data.map(item => `
                <article class="difficulty-card">
                    <h3>${escapeHTML(item.subject || "Matière")}</h3>
                    <p>${escapeHTML(item.description || "")}</p>
                    <button class="btn btn-danger"
                        onclick="deleteDifficulty(${Number(item.id)})">
                        Supprimer
                    </button>
                </article>
            `).join("");

    } catch (error) {
        console.error("Erreur chargement difficultés :", error);
        const list = document.getElementById("difficulties-list");
        if (list) list.textContent = "Impossible de charger les difficultés.";
    }
}


async function saveDifficulty(event) {
    event.preventDefault();

    if (!currentStudent) return;

    const form = document.getElementById("difficulty-form");
    if (!form) return;

    const formData = new FormData(form);

    const record = {
        student_id: currentStudent.id,
        subject: String(formData.get("subject") || "").trim(),
        description: String(formData.get("description") || "").trim()
    };

    if (!record.subject || !record.description) {
        alert("Veuillez remplir tous les champs.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Difficulties")
            .insert(record);

        if (error) throw error;

        showDifficulties();

    } catch (error) {
        console.error("Erreur enregistrement difficulté :", error);
        alert("Impossible d'enregistrer la difficulté. Vérifiez la structure de la table Difficulties.");
    }
}


async function deleteDifficulty(id) {
    if (!currentStudent) return;
    if (!confirm("Supprimer cette difficulté ?")) return;

    try {
        const { error } = await supabaseClient
            .from("Difficulties")
            .delete()
            .eq("id", Number(id))
            .eq("student_id", currentStudent.id);

        if (error) throw error;

        showDifficulties();

    } catch (error) {
        console.error("Erreur suppression difficulté :", error);
        alert("Impossible de supprimer cette difficulté.");
    }
}
