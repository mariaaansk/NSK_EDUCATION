
const SUPABASE_URL = "https://htsxwtgcgczmdgexfxny.supabase.co";
const SUPABASE_KEY = "sb_publishable_hxcdPuJMlrh9yd4W5n-MhQ_mYeak9am";

const supabaseClient =
    window.supabase &&
    typeof window.supabase.createClient === "function"
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
        : null;

let currentStudent = null;

/* =========================
   OUTILS
========================= */

function app() {
    return document.getElementById("app");
}

function escapeHTML(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(date) {
    if (!date) return "";

    return new Date(date + "T00:00:00")
        .toLocaleDateString("fr-FR");
}

function formatDuration(minutes) {
    if (minutes == null || minutes === "") return "";

    const total = Number(minutes);

    if (!Number.isFinite(total)) return "";

    const hours = Math.floor(total / 60);
    const remainingMinutes = total % 60;

    if (hours === 0) return `${remainingMinutes} min`;
    if (remainingMinutes === 0) return `${hours} h`;

    return `${hours} h ${remainingMinutes} min`;
}

function durationOptions(selected = "") {
    const durations = [];

    for (let minutes = 30; minutes <= 600; minutes += 30) {
        durations.push([minutes, formatDuration(minutes)]);
    }

    return `
        <option value="">Choisir une durée</option>
        ${durations.map(([minutes, label]) => `
            <option
                value="${minutes}"
                ${String(selected) === String(minutes) ? "selected" : ""}
            >
                ${label}
            </option>
        `).join("")}
    `;
}

function normalizeGrade(grade, max) {
    return Number(
        ((Number(grade) / Number(max)) * 20).toFixed(2)
    );
}

function showError(error) {
    console.error(error);
    alert(error?.message || "Une erreur inattendue est survenue.");
}

/* =========================
   ACCUEIL
========================= */

function showHome() {
    const root = app();

    if (!root) return;

    root.innerHTML = `
        <div class="home">
            <h1>NSK Éducation</h1>
            <p>Suivi des élèves</p>
            <div class="home-buttons">
                <button onclick="showLogin()">
                    Connexion enseignant
                </button>
            </div>
        </div>
    `;
}

/* =========================
   CONNEXION
========================= */

function showLogin() {
    const root = app();

    if (!root) return;

    root.innerHTML = `
        <div class="login-box">
            <h1>NSK Éducation</h1>
            <h2>Connexion</h2>

            <input
                id="login-email"
                type="email"
                placeholder="Adresse e-mail"
            >

            <input
                id="login-password"
                type="password"
                placeholder="Mot de passe"
            >

            <p id="login-error"></p>

            <button onclick="login()">Se connecter</button>
            <button class="secondary" onclick="showHome()">Retour</button>
            <button class="link-button" onclick="forgotPassword()">
                Mot de passe oublié ?
            </button>
        </div>
    `;
}

async function login() {
    if (!supabaseClient) {
        showError({
            message: "Supabase n'est pas chargé. Recharge la page."
        });
        return;
    }

    const email =
        document.getElementById("login-email").value.trim();

    const password =
        document.getElementById("login-password").value;

    const errorElement =
        document.getElementById("login-error");

    if (!email || !password) {
        errorElement.textContent =
            "Veuillez remplir tous les champs.";
        return;
    }

    try {
        const { data, error: loginError } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (loginError) {
            errorElement.textContent =
                "E-mail ou mot de passe incorrect.";
            return;
        }

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", data.user.id)
                .single();

        if (
            profileError ||
            !profile ||
            profile.role !== "teacher"
        ) {
            await supabaseClient.auth.signOut();

            errorElement.textContent =
                "Accès réservé à l'enseignant.";
            return;
        }

        await showDashboard();
    } catch (error) {
        errorElement.textContent =
            "Impossible de se connecter. Réessaie.";
        console.error("Erreur de connexion :", error);
    }
}

async function forgotPassword() {
    if (!supabaseClient) {
        showError({
            message: "Supabase n'est pas chargé. Recharge la page."
        });
        return;
    }

    const email = prompt("Entrez votre adresse e-mail :");

    if (!email) return;

    try {
        const { error } =
            await supabaseClient.auth.resetPasswordForEmail(
                email.trim(),
                { redirectTo: window.location.origin }
            );

        if (error) {
            showError(error);
            return;
        }

        alert("Un e-mail de réinitialisation a été envoyé.");
    } catch (error) {
        showError(error);
    }
}

/* =========================
   TABLEAU DE BORD
========================= */

async function showDashboard() {
    if (!supabaseClient) {
        showHome();
        return;
    }

    const root = app();
    if (!root) return;

    try {
        const { data: students, error } = await supabaseClient
            .from("Students")
            .select("*")
            .order("name");

        if (error) throw error;

        root.innerHTML = `
            <div class="dashboard">
                <div class="topbar">
                    <div>
                        <h1>NSK Éducation</h1>
                        <p>Tableau de bord enseignant</p>
                    </div>
                    <div class="topbar-buttons">
                        <button onclick="showAddStudent()">+ Ajouter un élève</button>
                        <button onclick="logout()">Déconnexion</button>
                    </div>
                </div>

                <div class="section-title">
                    <h2 class="page-title">Mes élèves</h2>
                </div>

                <div class="students-grid">
                    ${
                        students?.length
                            ? students.map(student => `
                                <div class="student-card">
                                    <div onclick="openStudent('${student.id}')">
                                        <h3>${escapeHTML(student.name)}</h3>
                                        <p>${escapeHTML(student.class || "")}</p>
                                    </div>
                                    <div style="margin-top:15px;display:flex;gap:8px;">
                                        <button onclick="editStudent('${student.id}')" style="padding:7px 10px;">Modifier</button>
                                        <button onclick="deleteStudent('${student.id}')" style="padding:7px 10px;">Supprimer</button>
                                    </div>
                                </div>
                            `).join("")
                            : "<p>Aucun élève enregistré.</p>"
                    }
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Erreur du tableau de bord :", error);
        root.innerHTML = `
            <div class="dashboard">
                <h2>Impossible de charger les élèves</h2>
                <p>${escapeHTML(error.message)}</p>
                <button onclick="showHome()">Retour à l'accueil</button>
            </div>
        `;
    }
}

/* =========================
   AJOUT D'UN ÉLÈVE
========================= */

function showAddStudent() {
    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <h1>Ajouter un élève</h1>
            </div>
            <section>
                <input
                    id="student-name"
                    placeholder="Nom et prénom"
                    style="width:100%;padding:12px;margin-bottom:12px;"
                >
                <input
                    id="student-class"
                    placeholder="Classe"
                    style="width:100%;padding:12px;margin-bottom:12px;"
                >
                <button onclick="addStudent()">Ajouter</button>
                <button onclick="showDashboard()">Annuler</button>
            </section>
        </div>
    `;
}

async function addStudent() {
    const name =
        document.getElementById("student-name").value.trim();

    const studentClass =
        document.getElementById("student-class").value.trim();

    if (!name) {
        alert("Veuillez renseigner le nom.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Students")
            .insert({
                name,
                class: studentClass
            });

        if (error) throw error;

        await showDashboard();
    } catch (error) {
        showError(error);
    }
}

/* =========================
   MODIFICATION D'UN ÉLÈVE
========================= */

async function editStudent(id) {
    try {
        const { data: student, error } = await supabaseClient
            .from("Students")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;

        app().innerHTML = `
            <div class="dashboard">
                <div class="topbar">
                    <h1>Modifier l'élève</h1>
                </div>
                <section>
                    <input
                        id="edit-student-name"
                        value="${escapeHTML(student.name)}"
                        style="width:100%;padding:12px;margin-bottom:12px;"
                    >
                    <input
                        id="edit-student-class"
                        value="${escapeHTML(student.class || "")}"
                        style="width:100%;padding:12px;margin-bottom:12px;"
                    >
                    <button onclick="saveStudent('${id}')">Enregistrer</button>
                    <button onclick="showDashboard()">Annuler</button>
                </section>
            </div>
        `;
    } catch (error) {
        showError(error);
    }
}

async function saveStudent(id) {
    const name =
        document.getElementById("edit-student-name").value.trim();

    const studentClass =
        document.getElementById("edit-student-class").value.trim();

    if (!name) {
        alert("Le nom est obligatoire.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Students")
            .update({
                name,
                class: studentClass
            })
            .eq("id", id);

        if (error) throw error;

        await showDashboard();
    } catch (error) {
        showError(error);
    }
}

/* =========================
   SUPPRESSION D'UN ÉLÈVE
========================= */

async function deleteStudent(id) {
    if (!confirm("Supprimer cet élève et toutes ses données ?")) {
        return;
    }

    try {
        for (const table of [
            "Sessions",
            "Notes",
            "Progress",
            "Difficulties"
        ]) {
            const { error } = await supabaseClient
                .from(table)
                .delete()
                .eq("student_id", id);

            if (error) {
                throw new Error(
                    `Impossible de supprimer les données de ${table} : ${error.message}`
                );
            }
        }

        const { error } = await supabaseClient
            .from("Students")
            .delete()
            .eq("id", id);

        if (error) throw error;

        currentStudent = null;
        await showDashboard();
    } catch (error) {
        showError(error);
    }
}

/* =========================
   PAGE ÉLÈVE
========================= */

async function openStudent(id) {
    try {
        const { data: student, error } = await supabaseClient
            .from("Students")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;

        currentStudent = student;
        renderStudentPage();
    } catch (error) {
        showError(error);
    }
}

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
                <button onclick="showDashboard()">Retour aux élèves</button>
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

/* =========================================================
   PARTIE 3/4 — SÉANCES ET NOTES
   ========================================================= */

/* =========================
   SÉANCES
   ========================= */

async function showSessions() {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="openStudent()">
                ← Retour à l'élève
            </button>

            <h1>Séances de ${escapeHTML(currentStudent.name)}</h1>

            <div class="actions">
                <button class="btn btn-primary" onclick="renderSessionForm()">
                    + Ajouter une séance
                </button>
                <button class="btn btn-secondary" onclick="showAllSubjectDocuments()">
                    Documents PDF
                </button>
            </div>

            <div id="sessions-list">
                <p>Chargement des séances...</p>
            </div>
        </div>
    `;

    const { data, error } = await supabaseClient
        .from("Sessions")
        .select("*")
        .eq("student_id", currentStudent.id)
        .order("date", { ascending: false });

    const list = document.getElementById("sessions-list");
    if (!list) return;

    if (error) {
        list.innerHTML = `<p class="error">Impossible de charger les séances : ${escapeHTML(error.message)}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = "<p>Aucune séance enregistrée.</p>";
        return;
    }

    list.innerHTML = data.map(session => `
        <div class="card">
            <h3>
                Séance du ${escapeHTML(formatDate(session.date))}
            </h3>
            <p><strong>Matière :</strong> ${escapeHTML(session.subject || "Non précisée")}</p>
            <p><strong>Durée :</strong> ${escapeHTML(formatDuration(session.duration_minutes))}</p>
            <p>${escapeHTML(session.summary || "")}</p>
            <div class="actions">
                <button class="btn btn-primary"
                    onclick="showSession('${session.id}')">
                    Ouvrir
                </button>
                <button class="btn btn-secondary"
                    onclick="editSession('${session.id}')">
                    Modifier
                </button>
                <button class="btn btn-danger"
                    onclick="deleteSession('${session.id}')">
                    Supprimer
                </button>
            </div>
        </div>
    `).join("");
}

function showAllSubjectDocuments() {
    alert("La gestion des documents PDF n'est pas encore configurée dans cette version.");
}

function addSessionForSubject(encodedSubject) {
    const subject = decodeURIComponent(encodedSubject);
    renderSessionForm(subject);
}

function renderSessionForm(subject = "") {
    if (!currentStudent) return;

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="showSessions()">
                ← Retour aux séances
            </button>

            <h1>Ajouter une séance</h1>

            <form id="session-form">
                <label for="session-date">Date</label>
                <input type="date" id="session-date"
                    value="${new Date().toISOString().slice(0, 10)}" required>

                <label for="session-subject">Matière</label>
                <input type="text" id="session-subject"
                    value="${escapeHTML(subject)}" required>

                <label for="session-duration">Durée</label>
                <select id="session-duration" required>
                    ${durationOptions(60)}
                </select>

                <label for="session-summary">Résumé de la séance</label>
                <textarea id="session-summary" rows="5"
                    placeholder="Contenu travaillé, exercices, objectifs..."></textarea>

                <label for="session-conclusion">Conclusion / devoirs</label>
                <textarea id="session-conclusion" rows="4"
                    placeholder="Bilan et travail à faire..."></textarea>

                <button class="btn btn-primary" type="submit">
                    Enregistrer la séance
                </button>
            </form>
        </div>
    `;

    document.getElementById("session-form").addEventListener("submit", addSession);
}

async function addSession(event) {
    event.preventDefault();

    if (!currentStudent || !supabaseClient) return;

    const date = document.getElementById("session-date").value;
    const subject = document.getElementById("session-subject").value.trim();
    const duration = Number(document.getElementById("session-duration").value);
    const summary = document.getElementById("session-summary").value.trim();
    const conclusion = document.getElementById("session-conclusion").value.trim();

    if (!date || !subject || !Number.isFinite(duration)) {
        alert("Merci de remplir la date, la matière et la durée.");
        return;
    }

    const { error } = await supabaseClient
        .from("Sessions")
        .insert([{
            student_id: currentStudent.id,
            date,
            subject,
            duration_minutes: duration,
            summary,
            conclusion
        }]);

    if (error) {
        showError("Impossible d'enregistrer la séance : " + error.message);
        return;
    }

    await showSessions();
}

async function showSubjectSessions(subject) {
    if (!currentStudent) return;

    const { data, error } = await supabaseClient
        .from("Sessions")
        .select("*")
        .eq("student_id", currentStudent.id)
        .eq("subject", subject)
        .order("date", { ascending: false });

    if (error) {
        showError("Impossible de charger les séances : " + error.message);
        return;
    }

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="openStudent()">
                ← Retour à l'élève
            </button>

            <h1>${escapeHTML(subject)}</h1>
            <button class="btn btn-primary"
                onclick="addSessionForSubject('${encodeURIComponent(subject)}')">
                + Ajouter une séance
            </button>

            <div class="cards">
                ${(data || []).map(session => `
                    <div class="card">
                        <h3>${escapeHTML(formatDate(session.date))}</h3>
                        <p>${escapeHTML(formatDuration(session.duration_minutes))}</p>
                        <p>${escapeHTML(session.summary || "")}</p>
                        <button class="btn btn-primary"
                            onclick="showSession('${session.id}')">
                            Voir la séance
                        </button>
                    </div>
                `).join("")}
            </div>

            ${(data || []).length === 0 ? "<p>Aucune séance pour cette matière.</p>" : ""}
        </div>
    `;
}

async function getSession(sessionId) {
    const { data, error } = await supabaseClient
        .from("Sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("student_id", currentStudent.id)
        .single();

    if (error) {
        showError("Impossible de charger la séance : " + error.message);
        return null;
    }

    return data;
}

async function showSession(sessionId) {
    if (!currentStudent) return;

    const session = await getSession(sessionId);
    if (!session) return;

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="showSessions()">
                ← Retour aux séances
            </button>

            <h1>Séance du ${escapeHTML(formatDate(session.date))}</h1>
            <p><strong>Matière :</strong> ${escapeHTML(session.subject || "")}</p>
            <p><strong>Durée :</strong> ${escapeHTML(formatDuration(session.duration_minutes))}</p>

            <div class="card">
                <h2>Résumé</h2>
                <p>${escapeHTML(session.summary || "Aucun résumé renseigné.")}</p>
                <button class="btn btn-secondary"
                    onclick="showSessionSummary('${session.id}')">
                    Voir le résumé
                </button>
            </div>

            <div class="card">
                <h2>Conclusion et devoirs</h2>
                <p>${escapeHTML(session.conclusion || "Aucune conclusion renseignée.")}</p>
                <button class="btn btn-secondary"
                    onclick="showSessionConclusion('${session.id}')">
                    Voir la conclusion
                </button>
            </div>

            <div class="actions">
                <button class="btn btn-primary"
                    onclick="editSession('${session.id}')">
                    Modifier
                </button>
                <button class="btn btn-danger"
                    onclick="deleteSession('${session.id}')">
                    Supprimer
                </button>
            </div>
        </div>
    `;
}

async function showSessionSummary(sessionId) {
    const session = await getSession(sessionId);
    if (!session) return;

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary"
                onclick="showSession('${session.id}')">
                ← Retour à la séance
            </button>
            <h1>Résumé de la séance</h1>
            <p><strong>${escapeHTML(session.subject || "")}</strong></p>
            <div class="card">
                <p>${escapeHTML(session.summary || "Aucun résumé renseigné.")}</p>
            </div>
        </div>
    `;
}

async function showSessionConclusion(sessionId) {
    const session = await getSession(sessionId);
    if (!session) return;

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary"
                onclick="showSession('${session.id}')">
                ← Retour à la séance
            </button>
            <h1>Conclusion et devoirs</h1>
            <p><strong>${escapeHTML(session.subject || "")}</strong></p>
            <div class="card">
                <p>${escapeHTML(session.conclusion || "Aucune conclusion renseignée.")}</p>
            </div>
        </div>
    `;
}

async function editSession(sessionId) {
    if (!currentStudent) return;

    const session = await getSession(sessionId);
    if (!session) return;

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary"
                onclick="showSession('${session.id}')">
                ← Annuler
            </button>

            <h1>Modifier la séance</h1>

            <form id="edit-session-form">
                <label for="edit-session-date">Date</label>
                <input type="date" id="edit-session-date"
                    value="${escapeHTML(session.date || "")}" required>

                <label for="edit-session-subject">Matière</label>
                <input type="text" id="edit-session-subject"
                    value="${escapeHTML(session.subject || "")}" required>

                <label for="edit-session-duration">Durée</label>
                <select id="edit-session-duration" required>
                    ${durationOptions(session.duration_minutes)}
                </select>

                <label for="edit-session-summary">Résumé</label>
                <textarea id="edit-session-summary" rows="5">${escapeHTML(session.summary || "")}</textarea>

                <label for="edit-session-conclusion">Conclusion / devoirs</label>
                <textarea id="edit-session-conclusion" rows="4">${escapeHTML(session.conclusion || "")}</textarea>

                <button class="btn btn-primary" type="submit">
                    Enregistrer les modifications
                </button>
            </form>
        </div>
    `;

    document.getElementById("edit-session-form").addEventListener(
        "submit",
        event => saveEditedSession(event, session.id)
    );
}

async function saveEditedSession(event, sessionId) {
    event.preventDefault();

    const updates = {
        date: document.getElementById("edit-session-date").value,
        subject: document.getElementById("edit-session-subject").value.trim(),
        duration_minutes: Number(document.getElementById("edit-session-duration").value),
        summary: document.getElementById("edit-session-summary").value.trim(),
        conclusion: document.getElementById("edit-session-conclusion").value.trim()
    };

    if (!updates.date || !updates.subject) {
        alert("Merci de renseigner la date et la matière.");
        return;
    }

    const { error } = await supabaseClient
        .from("Sessions")
        .update(updates)
        .eq("id", sessionId)
        .eq("student_id", currentStudent.id);

    if (error) {
        showError("Impossible de modifier la séance : " + error.message);
        return;
    }

    await showSession(sessionId);
}

async function deleteSession(sessionId) {
    if (!currentStudent) return;

    if (!confirm("Supprimer définitivement cette séance ?")) return;

    const { error } = await supabaseClient
        .from("Sessions")
        .delete()
        .eq("id", sessionId)
        .eq("student_id", currentStudent.id);

    if (error) {
        showError("Impossible de supprimer la séance : " + error.message);
        return;
    }

    await showSessions();
}


/* =========================
   NOTES
   ========================= */

async function showNotes() {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    const { data, error } = await supabaseClient
        .from("Notes")
        .select("*")
        .eq("student_id", currentStudent.id)
        .order("date", { ascending: false });

    if (error) {
        showError("Impossible de charger les notes : " + error.message);
        return;
    }

    const notes = data || [];
    const grades = notes
        .map(note => normalizeGrade(note.grade))
        .filter(grade => grade !== null);

    const average = grades.length
        ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length
        : null;

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="openStudent()">
                ← Retour à l'élève
            </button>

            <h1>Notes de ${escapeHTML(currentStudent.name)}</h1>

            <div class="card">
                <h2>Moyenne générale</h2>
                <p>${average === null ? "Aucune note" : average.toFixed(2) + " / 20"}</p>
            </div>

            <button class="btn btn-primary" onclick="addNote()">
                + Ajouter une note
            </button>

            <div class="cards">
                ${notes.map(note => `
                    <div class="card">
                        <h3>${escapeHTML(note.title || "Évaluation")}</h3>
                        <p><strong>Matière :</strong> ${escapeHTML(note.subject || "Non précisée")}</p>
                        <p><strong>Date :</strong> ${escapeHTML(formatDate(note.date))}</p>
                        <p><strong>Note :</strong> ${escapeHTML(String(normalizeGrade(note.grade) ?? note.grade ?? "—"))} / 20</p>
                        <div class="actions">
                            <button class="btn btn-primary"
                                onclick="showNote('${note.id}')">
                                Ouvrir
                            </button>
                            <button class="btn btn-secondary"
                                onclick="editNote('${note.id}')">
                                Modifier
                            </button>
                            <button class="btn btn-danger"
                                onclick="deleteNote('${note.id}')">
                                Supprimer
                            </button>
                        </div>
                    </div>
                `).join("")}
            </div>

            ${notes.length === 0 ? "<p>Aucune note enregistrée.</p>" : ""}
        </div>
    `;
}

async function showSubjectNotes(subject) {
    if (!currentStudent) return;

    const { data, error } = await supabaseClient
        .from("Notes")
        .select("*")
        .eq("student_id", currentStudent.id)
        .eq("subject", subject)
        .order("date", { ascending: false });

    if (error) {
        showError("Impossible de charger les notes : " + error.message);
        return;
    }

    const notes = data || [];

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="showNotes()">
                ← Retour aux notes
            </button>

            <h1>Notes — ${escapeHTML(subject)}</h1>

            <div class="cards">
                ${notes.map(note => `
                    <div class="card">
                        <h3>${escapeHTML(note.title || "Évaluation")}</h3>
                        <p>${escapeHTML(formatDate(note.date))}</p>
                        <p><strong>Note :</strong> ${escapeHTML(String(normalizeGrade(note.grade) ?? note.grade ?? "—"))} / 20</p>
                        <button class="btn btn-primary"
                            onclick="showNote('${note.id}')">
                            Ouvrir
                        </button>
                    </div>
                `).join("")}
            </div>

            ${notes.length === 0 ? "<p>Aucune note pour cette matière.</p>" : ""}
        </div>
    `;
}

async function getNote(noteId) {
    const { data, error } = await supabaseClient
        .from("Notes")
        .select("*")
        .eq("id", noteId)
        .eq("student_id", currentStudent.id)
        .single();

    if (error) {
        showError("Impossible de charger la note : " + error.message);
        return null;
    }

    return data;
}

async function showNote(noteId) {
    const note = await getNote(noteId);
    if (!note) return;

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="showNotes()">
                ← Retour aux notes
            </button>

            <h1>${escapeHTML(note.title || "Évaluation")}</h1>
            <p><strong>Matière :</strong> ${escapeHTML(note.subject || "Non précisée")}</p>
            <p><strong>Date :</strong> ${escapeHTML(formatDate(note.date))}</p>
            <p><strong>Note :</strong> ${escapeHTML(String(normalizeGrade(note.grade) ?? note.grade ?? "—"))} / 20</p>

            <div class="actions">
                <button class="btn btn-primary" onclick="editNote('${note.id}')">
                    Modifier
                </button>
                <button class="btn btn-danger" onclick="deleteNote('${note.id}')">
                    Supprimer
                </button>
            </div>
        </div>
    `;
}

function addNote() {
    if (!currentStudent) return;

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="showNotes()">
                ← Retour aux notes
            </button>

            <h1>Ajouter une note</h1>

            <form id="note-form">
                <label for="note-date">Date</label>
                <input type="date" id="note-date"
                    value="${new Date().toISOString().slice(0, 10)}" required>

                <label for="note-subject">Matière</label>
                <input type="text" id="note-subject" required>

                <label for="note-title">Nom de l'évaluation</label>
                <input type="text" id="note-title" required>

                <label for="note-grade">Note obtenue</label>
                <input type="number" id="note-grade" min="0" step="0.25" required>

                <label for="note-scale">Note sur</label>
                <select id="note-scale">
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20" selected>20</option>
                </select>

                <button class="btn btn-primary" type="submit">
                    Enregistrer la note
                </button>
            </form>
        </div>
    `;

    document.getElementById("note-form").addEventListener("submit", saveNote);
}

async function saveNote(event) {
    event.preventDefault();

    const date = document.getElementById("note-date").value;
    const subject = document.getElementById("note-subject").value.trim();
    const title = document.getElementById("note-title").value.trim();
    const gradeInput = Number(document.getElementById("note-grade").value);
    const scale = Number(document.getElementById("note-scale").value);

    if (!date || !subject || !title || !Number.isFinite(gradeInput) ||
        gradeInput < 0 || gradeInput > scale) {
        alert("Vérifie la date, la matière, le titre et la note.");
        return;
    }

    const grade = Math.round((gradeInput / scale) * 20 * 100) / 100;

    const { error } = await supabaseClient
        .from("Notes")
        .insert([{
            student_id: currentStudent.id,
            date,
            subject,
            title,
            grade
        }]);

    if (error) {
        showError("Impossible d'enregistrer la note : " + error.message);
        return;
    }

    await showNotes();
}

async function editNote(noteId) {
    const note = await getNote(noteId);
    if (!note) return;

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary"
                onclick="showNote('${note.id}')">
                ← Annuler
            </button>

            <h1>Modifier une note</h1>

            <form id="edit-note-form">
                <label for="edit-note-date">Date</label>
                <input type="date" id="edit-note-date"
                    value="${escapeHTML(note.date || "")}" required>

                <label for="edit-note-subject">Matière</label>
                <input type="text" id="edit-note-subject"
                    value="${escapeHTML(note.subject || "")}" required>

                <label for="edit-note-title">Nom de l'évaluation</label>
                <input type="text" id="edit-note-title"
                    value="${escapeHTML(note.title || "")}" required>

                <label for="edit-note-grade">Note sur 20</label>
                <input type="number" id="edit-note-grade" min="0" max="20"
                    step="0.25"
                    value="${escapeHTML(String(normalizeGrade(note.grade) ?? ""))}"
                    required>

                <button class="btn btn-primary" type="submit">
                    Enregistrer les modifications
                </button>
            </form>
        </div>
    `;

    document.getElementById("edit-note-form").addEventListener(
        "submit",
        event => saveEditedNote(event, note.id)
    );
}

async function saveEditedNote(event, noteId) {
    event.preventDefault();

    const date = document.getElementById("edit-note-date").value;
    const subject = document.getElementById("edit-note-subject").value.trim();
    const title = document.getElementById("edit-note-title").value.trim();
    const grade = Number(document.getElementById("edit-note-grade").value);

    if (!date || !subject || !title || !Number.isFinite(grade) ||
        grade < 0 || grade > 20) {
        alert("Vérifie les champs et saisis une note entre 0 et 20.");
        return;
    }

    const { error } = await supabaseClient
        .from("Notes")
        .update({ date, subject, title, grade })
        .eq("id", noteId)
        .eq("student_id", currentStudent.id);

    if (error) {
        showError("Impossible de modifier la note : " + error.message);
        return;
    }

    await showNote(noteId);
}

async function deleteNote(noteId) {
    if (!currentStudent) return;

    if (!confirm("Supprimer définitivement cette note ?")) return;

    const { error } = await supabaseClient
        .from("Notes")
        .delete()
        .eq("id", noteId)
        .eq("student_id", currentStudent.id);

    if (error) {
        showError("Impossible de supprimer la note : " + error.message);
        return;
    }

    await showNotes();
}

/* =========================================================
   PARTIE 4/4 — PROGRESSION, DIFFICULTÉS ET DÉMARRAGE
   ========================================================= */


/* =========================
   PROGRESSION
   ========================= */

async function showProgress() {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    const { data, error } = await supabaseClient
        .from("Progress")
        .select("*")
        .eq("student_id", currentStudent.id)
        .order("id", { ascending: false });

    if (error) {
        showError("Impossible de charger la progression : " + error.message);
        return;
    }

    const items = data || [];

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="openStudent()">
                ← Retour à l'élève
            </button>

            <h1>Progression de ${escapeHTML(currentStudent.name)}</h1>

            <button class="btn btn-primary" onclick="addProgress()">
                + Ajouter un élément
            </button>

            <div class="cards">
                ${items.map(item => `
                    <div class="card">
                        <h3>${escapeHTML(item.category || "Progression")}</h3>
                        <p>${escapeHTML(item.comment || "")}</p>
                        <div class="actions">
                            <button class="btn btn-secondary"
                                onclick="editProgress('${item.id}')">
                                Modifier
                            </button>
                            <button class="btn btn-danger"
                                onclick="deleteProgress('${item.id}')">
                                Supprimer
                            </button>
                        </div>
                    </div>
                `).join("")}
            </div>

            ${items.length === 0 ? "<p>Aucun élément de progression enregistré.</p>" : ""}
        </div>
    `;
}

function addProgress() {
    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="showProgress()">
                ← Retour
            </button>

            <h1>Ajouter à la progression</h1>

            <form id="progress-form">
                <label for="progress-category">Catégorie</label>
                <input id="progress-category" type="text" required
                    placeholder="Ex. : Lecture, calcul, autonomie">

                <label for="progress-comment">Commentaire</label>
                <textarea id="progress-comment" rows="5" required></textarea>

                <button class="btn btn-primary" type="submit">
                    Enregistrer
                </button>
            </form>
        </div>
    `;

    document.getElementById("progress-form")
        .addEventListener("submit", saveProgress);
}

async function saveProgress(event) {
    event.preventDefault();

    const category = document.getElementById("progress-category").value.trim();
    const comment = document.getElementById("progress-comment").value.trim();

    if (!category || !comment) {
        alert("Merci de remplir tous les champs.");
        return;
    }

    const { error } = await supabaseClient
        .from("Progress")
        .insert([{
            student_id: currentStudent.id,
            category,
            comment
        }]);

    if (error) {
        showError("Impossible d'enregistrer la progression : " + error.message);
        return;
    }

    await showProgress();
}

async function editProgress(progressId) {
    const { data, error } = await supabaseClient
        .from("Progress")
        .select("*")
        .eq("id", progressId)
        .eq("student_id", currentStudent.id)
        .single();

    if (error || !data) {
        showError("Impossible de charger cet élément de progression.");
        return;
    }

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="showProgress()">
                ← Annuler
            </button>

            <h1>Modifier la progression</h1>

            <form id="edit-progress-form">
                <label for="edit-progress-category">Catégorie</label>
                <input id="edit-progress-category" type="text" required
                    value="${escapeHTML(data.category || "")}">

                <label for="edit-progress-comment">Commentaire</label>
                <textarea id="edit-progress-comment" rows="5" required>${escapeHTML(data.comment || "")}</textarea>

                <button class="btn btn-primary" type="submit">
                    Enregistrer les modifications
                </button>
            </form>
        </div>
    `;

    document.getElementById("edit-progress-form")
        .addEventListener("submit", async event => {
            event.preventDefault();

            const category = document.getElementById("edit-progress-category").value.trim();
            const comment = document.getElementById("edit-progress-comment").value.trim();

            if (!category || !comment) {
                alert("Merci de remplir tous les champs.");
                return;
            }

            const { error: updateError } = await supabaseClient
                .from("Progress")
                .update({ category, comment })
                .eq("id", progressId)
                .eq("student_id", currentStudent.id);

            if (updateError) {
                showError("Impossible de modifier la progression : " + updateError.message);
                return;
            }

            await showProgress();
        });
}

async function deleteProgress(progressId) {
    if (!confirm("Supprimer définitivement cet élément de progression ?")) {
        return;
    }

    const { error } = await supabaseClient
        .from("Progress")
        .delete()
        .eq("id", progressId)
        .eq("student_id", currentStudent.id);

    if (error) {
        showError("Impossible de supprimer cet élément : " + error.message);
        return;
    }

    await showProgress();
}


/* =========================
   DIFFICULTÉS
   ========================= */

async function showDifficulties() {
    if (!currentStudent) {
        showDashboard();
        return;
    }

    const { data, error } = await supabaseClient
        .from("Difficulties")
        .select("*")
        .eq("student_id", currentStudent.id)
        .order("id", { ascending: false });

    if (error) {
        showError("Impossible de charger les difficultés : " + error.message);
        return;
    }

    const items = data || [];

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="openStudent()">
                ← Retour à l'élève
            </button>

            <h1>Difficultés de ${escapeHTML(currentStudent.name)}</h1>

            <button class="btn btn-primary" onclick="addDifficulty()">
                + Ajouter une difficulté
            </button>

            <div class="cards">
                ${items.map(item => `
                    <div class="card">
                        <h3>${escapeHTML(item.title || "Difficulté")}</h3>
                        <p>${escapeHTML(item.detail || "")}</p>
                        <div class="actions">
                            <button class="btn btn-secondary"
                                onclick="editDifficulty('${item.id}')">
                                Modifier
                            </button>
                            <button class="btn btn-danger"
                                onclick="deleteDifficulty('${item.id}')">
                                Supprimer
                            </button>
                        </div>
                    </div>
                `).join("")}
            </div>

            ${items.length === 0 ? "<p>Aucune difficulté enregistrée.</p>" : ""}
        </div>
    `;
}

function addDifficulty() {
    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="showDifficulties()">
                ← Retour
            </button>

            <h1>Ajouter une difficulté</h1>

            <form id="difficulty-form">
                <label for="difficulty-title">Titre</label>
                <input id="difficulty-title" type="text" required>

                <label for="difficulty-detail">Description</label>
                <textarea id="difficulty-detail" rows="5" required></textarea>

                <button class="btn btn-primary" type="submit">
                    Enregistrer
                </button>
            </form>
        </div>
    `;

    document.getElementById("difficulty-form")
        .addEventListener("submit", saveDifficulty);
}

async function saveDifficulty(event) {
    event.preventDefault();

    const title = document.getElementById("difficulty-title").value.trim();
    const detail = document.getElementById("difficulty-detail").value.trim();

    if (!title || !detail) {
        alert("Merci de remplir tous les champs.");
        return;
    }

    const { error } = await supabaseClient
        .from("Difficulties")
        .insert([{
            student_id: currentStudent.id,
            title,
            detail
        }]);

    if (error) {
        showError("Impossible d'enregistrer la difficulté : " + error.message);
        return;
    }

    await showDifficulties();
}

async function editDifficulty(difficultyId) {
    const { data, error } = await supabaseClient
        .from("Difficulties")
        .select("*")
        .eq("id", difficultyId)
        .eq("student_id", currentStudent.id)
        .single();

    if (error || !data) {
        showError("Impossible de charger cette difficulté.");
        return;
    }

    app.innerHTML = `
        <div class="container">
            <button class="btn btn-secondary" onclick="showDifficulties()">
                ← Annuler
            </button>

            <h1>Modifier la difficulté</h1>

            <form id="edit-difficulty-form">
                <label for="edit-difficulty-title">Titre</label>
                <input id="edit-difficulty-title" type="text" required
                    value="${escapeHTML(data.title || "")}">

                <label for="edit-difficulty-detail">Description</label>
                <textarea id="edit-difficulty-detail" rows="5" required>${escapeHTML(data.detail || "")}</textarea>

                <button class="btn btn-primary" type="submit">
                    Enregistrer les modifications
                </button>
            </form>
        </div>
    `;

    document.getElementById("edit-difficulty-form")
        .addEventListener("submit", async event => {
            event.preventDefault();

            const title = document.getElementById("edit-difficulty-title").value.trim();
            const detail = document.getElementById("edit-difficulty-detail").value.trim();

            if (!title || !detail) {
                alert("Merci de remplir tous les champs.");
                return;
            }

            const { error: updateError } = await supabaseClient
                .from("Difficulties")
                .update({ title, detail })
                .eq("id", difficultyId)
                .eq("student_id", currentStudent.id);

            if (updateError) {
                showError("Impossible de modifier la difficulté : " + updateError.message);
                return;
            }

            await showDifficulties();
        });
}

async function deleteDifficulty(difficultyId) {
    if (!confirm("Supprimer définitivement cette difficulté ?")) {
        return;
    }

    const { error } = await supabaseClient
        .from("Difficulties")
        .delete()
        .eq("id", difficultyId)
        .eq("student_id", currentStudent.id);

    if (error) {
        showError("Impossible de supprimer cette difficulté : " + error.message);
        return;
    }

    await showDifficulties();
}


/* =========================
   NAVIGATION ET DÉCONNEXION
   ========================= */

async function logout() {
    if (supabaseClient) {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            showError("Erreur lors de la déconnexion : " + error.message);
            return;
        }
    }

    currentStudent = null;
    showHome();
}


/* =========================
   DÉMARRAGE DE L'APPLICATION
   ========================= */

async function startApp() {
    if (!app) {
        console.error("Élément #app introuvable dans index.html.");
        return;
    }

    if (!supabaseClient) {
        app.innerHTML = `
            <div class="container">
                <h1>NSK Éducation</h1>
                <p class="error">
                    La bibliothèque Supabase n'a pas été chargée.
                    Vérifie ta connexion Internet et recharge la page.
                </p>
            </div>
        `;
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) {
            showHome();
            showError("Impossible de vérifier la session : " + error.message);
            return;
        }

        if (data && data.session) {
            const { data: profile, error: profileError } = await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", data.session.user.id)
                .single();

            if (!profileError && profile && profile.role === "teacher") {
                await showDashboard();
                return;
            }

            await supabaseClient.auth.signOut();
        }

        showHome();
    } catch (error) {
        console.error("Erreur au démarrage :", error);
        showHome();
        showError("Une erreur est survenue au démarrage de l'application.");
    }
}

startApp();
