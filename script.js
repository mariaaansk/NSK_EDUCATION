
const SUPABASE_URL = "https://htsxwtgcgczmdgexfxny.supabase.co";
const SUPABASE_KEY = "sb_publishable_hxcdPuJMlrh9yd4W5n-MhQ_mYeak9am";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
    return new Date(date + "T00:00:00").toLocaleDateString("fr-FR");
}

function formatDuration(minutes) {
    if (minutes == null || minutes === "") return "";

    const total = Number(minutes);
    if (!Number.isFinite(total)) return "";

    const hours = Math.floor(total / 60);
    const remainingMinutes = total % 60;

    if (hours === 0) return `${remainingMinutes} min`;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h${remainingMinutes}`;
}

function durationOptions(selected = "") {
    const durations = [];

    for (let minutes = 30; minutes <= 600; minutes += 30) {
        durations.push([minutes, formatDuration(minutes)]);
    }

    return `
        <option value="">Choisir une durée</option>
        ${durations.map(([minutes, label]) => `
            <option value="${minutes}" ${String(selected) === String(minutes) ? "selected" : ""}>
                ${label}
            </option>
        `).join("")}
    `;
}

function normalizeGrade(grade, max) {
    return Number(((Number(grade) / Number(max)) * 20).toFixed(2));
}

function showError(error) {
    alert(error?.message || "Une erreur inattendue est survenue.");
}

/* =========================
   ACCUEIL
========================= */

function showHome() {
    app().innerHTML = `
        <div class="home">
            <h1>NSK Éducation</h1>
            <p>Suivi des élèves</p>
            <div class="home-buttons">
                <button onclick="showLogin()">Connexion enseignant</button>
            </div>
        </div>
    `;
}

/* =========================
   CONNEXION
========================= */

function showLogin() {
    app().innerHTML = `
        <div class="login-box">
            <h1>NSK Éducation</h1>
            <h2>Connexion</h2>

            <input id="login-email" type="email" placeholder="Adresse e-mail">
            <input id="login-password" type="password" placeholder="Mot de passe">
            <p id="login-error"></p>

            <button onclick="login()">Se connecter</button>
            <button class="secondary" onclick="showHome()">Retour</button>
            <button class="link-button" onclick="forgotPassword()">Mot de passe oublié ?</button>
        </div>
    `;
}

async function login() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errorElement = document.getElementById("login-error");

    if (!email || !password) {
        errorElement.textContent = "Veuillez remplir tous les champs.";
        return;
    }

    const { data, error: loginError } =
        await supabaseClient.auth.signInWithPassword({ email, password });

    if (loginError) {
        errorElement.textContent = "E-mail ou mot de passe incorrect.";
        return;
    }

    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

    if (profileError || !profile || profile.role !== "teacher") {
        await supabaseClient.auth.signOut();
        errorElement.textContent = "Accès réservé à l'enseignant.";
        return;
    }

    await showDashboard();
}

async function forgotPassword() {
    const email = prompt("Entrez votre adresse e-mail :");
    if (!email) return;

    const { error } = await supabaseClient.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: window.location.origin }
    );

    if (error) {
        showError(error);
        return;
    }

    alert("Un e-mail de réinitialisation a été envoyé.");
}

/* =========================
   TABLEAU DE BORD
========================= */

async function showDashboard() {
    const { data: students, error } = await supabaseClient
        .from("Students")
        .select("*")
        .order("name");

    if (error) {
        app().innerHTML = `
            <div class="dashboard">
                <h2>Erreur</h2>
                <p>${escapeHTML(error.message)}</p>
                <button onclick="showHome()">Retour à l'accueil</button>
            </div>
        `;
        return;
    }

    app().innerHTML = `
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
}

/* =========================
   ÉLÈVES
========================= */

function showAddStudent() {
    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar"><h1>Ajouter un élève</h1></div>
            <section>
                <input id="student-name" placeholder="Nom et prénom"
                    style="width:100%;padding:12px;margin-bottom:12px;">
                <input id="student-class" placeholder="Classe"
                    style="width:100%;padding:12px;margin-bottom:12px;">
                <button onclick="addStudent()">Ajouter</button>
                <button onclick="showDashboard()">Annuler</button>
            </section>
        </div>
    `;
}

async function addStudent() {
    const name = document.getElementById("student-name").value.trim();
    const studentClass = document.getElementById("student-class").value.trim();

    if (!name) {
        alert("Veuillez renseigner le nom.");
        return;
    }

    const { error } = await supabaseClient.from("Students").insert({
        name,
        class: studentClass
    });

    if (error) {
        showError(error);
        return;
    }

    await showDashboard();
}

async function editStudent(id) {
    const { data: student, error } = await supabaseClient
        .from("Students").select("*").eq("id", id).single();

    if (error) {
        showError(error);
        return;
    }

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar"><h1>Modifier l'élève</h1></div>
            <section>
                <input id="edit-student-name" value="${escapeHTML(student.name)}"
                    style="width:100%;padding:12px;margin-bottom:12px;">
                <input id="edit-student-class" value="${escapeHTML(student.class || "")}"
                    style="width:100%;padding:12px;margin-bottom:12px;">
                <button onclick="saveStudent('${id}')">Enregistrer</button>
                <button onclick="showDashboard()">Annuler</button>
            </section>
        </div>
    `;
}

async function saveStudent(id) {
    const name = document.getElementById("edit-student-name").value.trim();
    const studentClass = document.getElementById("edit-student-class").value.trim();

    if (!name) {
        alert("Le nom est obligatoire.");
        return;
    }

    const { error } = await supabaseClient.from("Students")
        .update({ name, class: studentClass }).eq("id", id);

    if (error) {
        showError(error);
        return;
    }

    await showDashboard();
}

async function deleteStudent(id) {
    if (!confirm("Supprimer cet élève et toutes ses données ?")) return;

    for (const table of ["Sessions", "Notes", "Progress", "Difficulties"]) {
        const { error } = await supabaseClient
            .from(table).delete().eq("student_id", id);

        if (error) {
            alert(`Impossible de supprimer les données de ${table} : ${error.message}`);
            return;
        }
    }

    const { error } = await supabaseClient.from("Students").delete().eq("id", id);

    if (error) {
        showError(error);
        return;
    }

    currentStudent = null;
    await showDashboard();
}

/* =========================
   PAGE ÉLÈVE
========================= */

async function openStudent(id) {
    const { data: student, error } = await supabaseClient
        .from("Students").select("*").eq("id", id).single();

    if (error) {
        showError(error);
        return;
    }

    currentStudent = student;
    renderStudentPage();
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

/* =========================
   SÉANCES
========================= */

async function showSessions() {
    const { data: sessions, error } = await supabaseClient
        .from("Sessions").select("*")
        .eq("student_id", currentStudent.id)
        .order("date", { ascending: false });

    if (error) {
        showError(error);
        return;
    }

    const subjects = [...new Set((sessions || [])
        .map(session => session.subject).filter(Boolean))];

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <div><h1>Séances</h1><p>${escapeHTML(currentStudent.name)}</p></div>
                <button onclick="renderStudentPage()">Retour</button>
            </div>

            <div class="section-title">
                <h2 class="page-title">Matières</h2>
                <button onclick="addSession()">+ Ajouter une séance</button>
                <button onclick="showAllSubjectDocuments()">📚 Documents PDF</button>
            </div>

            <div>
                ${
                    subjects.length
                        ? subjects.map(subject => {
                            const subjectSessions = sessions.filter(
                                session => session.subject === subject
                            );

                            return `
                                <section style="margin-bottom:20px;padding:20px;border:1px solid #dde2e8;border-radius:12px;text-align:left;">
                                    <div style="display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:15px;">
                                        <h2 style="margin:0;text-align:left;">${escapeHTML(subject)}</h2>
                                        <button onclick="addSessionForSubject('${encodeURIComponent(subject)}')">
                                            + Ajouter une séance
                                        </button>
                                    </div>

                                    ${
                                        subjectSessions.length
                                            ? subjectSessions.map(session => `
                                                <div style="padding:15px 0;border-bottom:1px solid #dde2e8;cursor:pointer;text-align:left;"
                                                    onclick="showSession('${session.id}')">
                                                    <strong>Séance du ${formatDate(session.date)}</strong>
                                                    ${session.duration_minutes != null
                                                        ? `<span style="margin-left:10px;color:#64748b;">${formatDuration(session.duration_minutes)}</span>`
                                                        : ""}
                                                </div>
                                            `).join("")
                                            : "<p>Aucune séance.</p>"
                                    }
                                </section>
                            `;
                        }).join("")
                        : "<p>Aucune séance enregistrée.</p>"
                }
            </div>
        </div>
    `;
}

/*
 * Le bouton Documents PDF est conservé.
 * Cette fonction affiche un message tant que la fonctionnalité PDF
 * n'a pas été reliée à une table et à un stockage de fichiers.
 */
function showAllSubjectDocuments() {
    alert("La gestion des documents PDF n'est pas encore configurée. Aucun document n'a été supprimé.");
}

function addSessionForSubject(encodedSubject) {
    const subject = decodeURIComponent(encodedSubject);
    renderSessionForm({ subject, readonlySubject: true });
}

function addSession() {
    renderSessionForm();
}

function renderSessionForm({ subject = "", readonlySubject = false, session = null } = {}) {
    const editing = Boolean(session);
    const prefix = editing ? "edit-session" : "session";

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar"><h1>${editing ? "Modifier la séance" : "Ajouter une séance"}</h1></div>
            <section>
                <label>Date</label>
                <input id="${prefix}-date" type="date" value="${escapeHTML(session?.date || "")}"
                    style="width:100%;padding:12px;margin:8px 0 15px;">

                <label>Matière</label>
                <input id="${prefix}-subject" value="${escapeHTML(session?.subject || subject)}"
                    ${readonlySubject ? "readonly" : ""}
                    style="width:100%;padding:12px;margin:8px 0 15px;${readonlySubject ? "background:#f3f4f6;" : ""}">

                <label>Durée totale</label>
                <select id="${prefix}-duration" style="width:100%;padding:12px;margin:8px 0 15px;">
                    ${durationOptions(session?.duration_minutes ?? "")}
                </select>

                <label>Résumé</label>
                <textarea id="${prefix}-summary" rows="6"
                    style="width:100%;padding:12px;margin:8px 0 15px;text-align:left !important;direction:ltr;">${escapeHTML(session?.summary || "")}</textarea>

                <label>Conclusion</label>
                <textarea id="${prefix}-conclusion" rows="5"
                    style="width:100%;padding:12px;margin:8px 0 15px;text-align:left !important;direction:ltr;">${escapeHTML(session?.conclusion || "")}</textarea>

                <button onclick="${editing ? `saveEditedSession('${session.id}')` : "saveSession()"}">Enregistrer</button>
                <button onclick="${editing ? `showSession('${session.id}')` : "showSessions()"}">Annuler</button>
            </section>
        </div>
    `;
}

async function showSubjectSessions(encodedSubject) {
    const subject = decodeURIComponent(encodedSubject);
    const { data: sessions, error } = await supabaseClient
        .from("Sessions").select("*")
        .eq("student_id", currentStudent.id)
        .eq("subject", subject)
        .order("date", { ascending: false });

    if (error) {
        showError(error);
        return;
    }

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <div><h1>${escapeHTML(subject)}</h1><p>Séances</p></div>
                <button onclick="showSessions()">Retour</button>
            </div>
            <section>
                <h2>Dates</h2>
                ${
                    sessions?.length
                        ? sessions.map(session => `
                            <div style="padding:15px 0;border-bottom:1px solid #dde2e8;cursor:pointer;text-align:left;"
                                onclick="showSession('${session.id}')">
                                <strong>Séance du ${formatDate(session.date)}</strong>
                                ${session.duration_minutes != null
                                    ? `<span style="margin-left:10px;color:#64748b;">${formatDuration(session.duration_minutes)}</span>`
                                    : ""}
                            </div>
                        `).join("")
                        : "<p>Aucune séance.</p>"
                }
            </section>
        </div>
    `;
}

async function getSession(id) {
    const { data, error } = await supabaseClient
        .from("Sessions").select("*").eq("id", id).single();

    if (error) {
        showError(error);
        return null;
    }

    return data;
}

async function showSession(id) {
    const session = await getSession(id);
    if (!session) return;

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <div>
                    <h1>Séance du ${formatDate(session.date)}${session.duration_minutes != null ? ` — ${formatDuration(session.duration_minutes)}` : ""}</h1>
                    <p>${escapeHTML(session.subject)}</p>
                </div>
                <button onclick="showSubjectSessions('${encodeURIComponent(session.subject || "")}')">Retour</button>
            </div>

            <div class="student-menu">
                <button onclick="showSessionSummary('${session.id}')">Résumé de la séance</button>
                <button onclick="showSessionConclusion('${session.id}')">Conclusion</button>
            </div>

            <section style="margin-top:20px;text-align:left;">
                <button onclick="editSession('${session.id}')">Modifier</button>
                <button onclick="deleteSession('${session.id}')">Supprimer</button>
            </section>
        </div>
    `;
}

async function showSessionSummary(id) {
    const session = await getSession(id);
    if (!session) return;

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <h1>Résumé de la séance</h1>
                <button onclick="showSession('${id}')">Retour</button>
            </div>
            <section style="text-align:left;">
                <p style="white-space:pre-wrap;text-align:left !important;direction:ltr;text-indent:0;">${escapeHTML(session.summary || "Aucun résumé.")}</p>
            </section>
        </div>
    `;
}

async function showSessionConclusion(id) {
    const session = await getSession(id);
    if (!session) return;

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <h1>Conclusion</h1>
                <button onclick="showSession('${id}')">Retour</button>
            </div>
            <section style="text-align:left;">
                <p style="white-space:pre-wrap;text-align:left !important;direction:ltr;text-indent:0;">${escapeHTML(session.conclusion || "Aucune conclusion.")}</p>
            </section>
        </div>
    `;
}

async function saveSession() {
    const date = document.getElementById("session-date").value;
    const subject = document.getElementById("session-subject").value.trim();
    const summary = document.getElementById("session-summary").value.trim();
    const conclusion = document.getElementById("session-conclusion").value.trim();
    const durationMinutes = document.getElementById("session-duration").value;

    if (!date || !subject) {
        alert("La date et la matière sont obligatoires.");
        return;
    }

    if (!durationMinutes) {
        alert("Choisis la durée totale de la séance.");
        return;
    }

    const { error } = await supabaseClient.from("Sessions").insert({
        student_id: currentStudent.id,
        date,
        subject,
        summary,
        conclusion,
        duration_minutes: Number(durationMinutes)
    });

    if (error) {
        showError(error);
        return;
    }

    await showSessions();
}

async function editSession(id) {
    const session = await getSession(id);
    if (!session) return;
    renderSessionForm({ session });
}

async function saveEditedSession(id) {
    const date = document.getElementById("edit-session-date").value;
    const subject = document.getElementById("edit-session-subject").value.trim();
    const summary = document.getElementById("edit-session-summary").value.trim();
    const conclusion = document.getElementById("edit-session-conclusion").value.trim();
    const durationMinutes = document.getElementById("edit-session-duration").value;

    if (!date || !subject) {
        alert("La date et la matière sont obligatoires.");
        return;
    }

    const { error } = await supabaseClient.from("Sessions").update({
        date,
        subject,
        summary,
        conclusion,
        duration_minutes: durationMinutes ? Number(durationMinutes) : null
    }).eq("id", id);

    if (error) {
        showError(error);
        return;
    }

    await showSession(id);
}

async function deleteSession(id) {
    if (!confirm("Supprimer cette séance ?")) return;

    const { error } = await supabaseClient.from("Sessions").delete().eq("id", id);

    if (error) {
        showError(error);
        return;
    }

    await showSessions();
}

/* =========================
   NOTES
========================= */

async function showNotes() {
    const { data: notes, error } = await supabaseClient
        .from("Notes").select("*")
        .eq("student_id", currentStudent.id)
        .order("date", { ascending: false });

    if (error) {
        showError(error);
        return;
    }

    const average = notes?.length
        ? (notes.reduce((sum, note) => sum + Number(note.grade || 0), 0) / notes.length).toFixed(2)
        : "—";

    const subjects = [...new Set((notes || []).map(note => note.subject).filter(Boolean))];

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <div><h1>Notes</h1><p>${escapeHTML(currentStudent.name)}</p></div>
                <button onclick="renderStudentPage()">Retour</button>
            </div>

            <div class="average-box">
                <p>Moyenne générale</p>
                <strong>${average}</strong>
                <span>/20</span>
            </div>

            <div class="section-title">
                <h2 class="page-title">Matières</h2>
                <button onclick="addNote()">+ Ajouter une note</button>
            </div>

            <div class="student-menu">
                ${
                    subjects.length
                        ? subjects.map(subject => `
                            <button onclick="showSubjectNotes('${encodeURIComponent(subject)}')">${escapeHTML(subject)}</button>
                        `).join("")
                        : "<p>Aucune note.</p>"
                }
            </div>
        </div>
    `;
}

async function showSubjectNotes(encodedSubject) {
    const subject = decodeURIComponent(encodedSubject);
    const { data: notes, error } = await supabaseClient
        .from("Notes").select("*")
        .eq("student_id", currentStudent.id)
        .eq("subject", subject)
        .order("date", { ascending: false });

    if (error) {
        showError(error);
        return;
    }

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <div><h1>${escapeHTML(subject)}</h1><p>Notes</p></div>
                <button onclick="showNotes()">Retour</button>
            </div>
            <section>
                ${
                    notes?.length
                        ? notes.map(note => `
                            <div style="padding:15px 0;border-bottom:1px solid #dde2e8;cursor:pointer;text-align:left;"
                                onclick="showNote('${note.id}')">
                                <strong>${escapeHTML(note.title || "Note")}</strong>
                                <p style="text-align:left;">${formatDate(note.date)} — ${Number(note.grade).toFixed(2)}/20</p>
                            </div>
                        `).join("")
                        : "<p>Aucune note dans cette matière.</p>"
                }
            </section>
        </div>
    `;
}

async function getNote(id) {
    const { data, error } = await supabaseClient.from("Notes").select("*").eq("id", id).single();
    if (error) {
        showError(error);
        return null;
    }
    return data;
}

async function showNote(id) {
    const note = await getNote(id);
    if (!note) return;

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <div>
                    <h1>${escapeHTML(note.title || "Note")}</h1>
                    <p>${escapeHTML(note.subject || "")}</p>
                </div>
                <button onclick="showSubjectNotes('${encodeURIComponent(note.subject || "")}')">Retour</button>
            </div>
            <section>
                <p style="text-align:left;">Date : ${formatDate(note.date)}</p>
                <p style="margin-top:10px;text-align:left;">Note : <strong>${Number(note.grade).toFixed(2)}/20</strong></p>
            </section>
            <section>
                <button onclick="editNote('${note.id}')">Modifier</button>
                <button onclick="deleteNote('${note.id}')">Supprimer</button>
            </section>
        </div>
    `;
}

function addNote() {
    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar"><h1>Ajouter une note</h1></div>
            <section>
                <label>Date</label>
                <input id="note-date" type="date" style="width:100%;padding:12px;margin:8px 0 15px;">

                <label>Matière</label>
                <input id="note-subject" style="width:100%;padding:12px;margin:8px 0 15px;text-align:left;">

                <label>Évaluation</label>
                <input id="note-title" style="width:100%;padding:12px;margin:8px 0 15px;text-align:left;">

                <label>Note</label>
                <input id="note-grade" type="number" step="0.01" min="0" style="width:100%;padding:12px;margin:8px 0 15px;">

                <label>Sur</label>
                <select id="note-max" style="width:100%;padding:12px;margin:8px 0 15px;">
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20" selected>20</option>
                </select>

                <button onclick="saveNote()">Enregistrer</button>
                <button onclick="showNotes()">Annuler</button>
            </section>
        </div>
    `;
}

async function saveNote() {
    const date = document.getElementById("note-date").value;
    const subject = document.getElementById("note-subject").value.trim();
    const title = document.getElementById("note-title").value.trim();
    const gradeValue = document.getElementById("note-grade").value;
    const grade = Number(gradeValue);
    const max = Number(document.getElementById("note-max").value);

    if (!date || !subject || !title || gradeValue === "" || !Number.isFinite(grade)) {
        alert("Veuillez remplir tous les champs.");
        return;
    }

    if (grade < 0 || grade > max) {
        alert("La note est incorrecte.");
        return;
    }

    const { error } = await supabaseClient.from("Notes").insert({
        student_id: currentStudent.id,
        date,
        subject,
        title,
        grade: normalizeGrade(grade, max)
    });

    if (error) {
        showError(error);
        return;
    }

    await showNotes();
}

async function editNote(id) {
    const note = await getNote(id);
    if (!note) return;

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar"><h1>Modifier la note</h1></div>
            <section>
                <label>Date</label>
                <input id="edit-note-date" type="date" value="${escapeHTML(note.date || "")}" style="width:100%;padding:12px;margin:8px 0 15px;">

                <label>Matière</label>
                <input id="edit-note-subject" value="${escapeHTML(note.subject || "")}" style="width:100%;padding:12px;margin:8px 0 15px;">

                <label>Évaluation</label>
                <input id="edit-note-title" value="${escapeHTML(note.title || "")}" style="width:100%;padding:12px;margin:8px 0 15px;">

                <label>Nouvelle note /20</label>
                <input id="edit-note-grade" type="number" min="0" max="20" step="0.01" value="${Number(note.grade)}" style="width:100%;padding:12px;margin:8px 0 15px;">

                <button onclick="saveEditedNote('${id}')">Enregistrer</button>
                <button onclick="showNote('${id}')">Annuler</button>
            </section>
        </div>
    `;
}

async function saveEditedNote(id) {
    const date = document.getElementById("edit-note-date").value;
    const subject = document.getElementById("edit-note-subject").value.trim();
    const title = document.getElementById("edit-note-title").value.trim();
    const gradeValue = document.getElementById("edit-note-grade").value;
    const grade = Number(gradeValue);

    if (!date || !subject || !title || gradeValue === "" || !Number.isFinite(grade)) {
        alert("Veuillez remplir tous les champs.");
        return;
    }

    if (grade < 0 || grade > 20) {
        alert("La note doit être entre 0 et 20.");
        return;
    }

    const { error } = await supabaseClient.from("Notes")
        .update({ date, subject, title, grade }).eq("id", id);

    if (error) {
        showError(error);
        return;
    }

    await showNote(id);
}

async function deleteNote(id) {
    if (!confirm("Supprimer cette note ?")) return;

    const { error } = await supabaseClient.from("Notes").delete().eq("id", id);

    if (error) {
        showError(error);
        return;
    }

    await showNotes();
}

/* =========================
   PROGRESSION
========================= */

async function showProgress() {
    const { data: progress, error } = await supabaseClient
        .from("Progress").select("*")
        .eq("student_id", currentStudent.id)
        .order("id");

    if (error) {
        showError(error);
        return;
    }

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <div><h1>Progression</h1><p>${escapeHTML(currentStudent.name)}</p></div>
                <button onclick="renderStudentPage()">Retour</button>
            </div>

            <div class="section-title">
                <h2 class="page-title">Suivi de progression</h2>
                <button onclick="addProgress()">+ Ajouter</button>
            </div>

            ${
                progress?.length
                    ? progress.map(item => `
                        <section style="text-align:left;">
                            <h2 style="text-align:left;">${escapeHTML(item.category || "")}</h2>
                            <p style="white-space:pre-wrap;text-align:left !important;direction:ltr;text-indent:0;">${escapeHTML(item.comment || "")}</p>
                            <div style="margin-top:15px;text-align:left;">
                                <button onclick="editProgress('${item.id}')">Modifier</button>
                                <button onclick="deleteProgress('${item.id}')">Supprimer</button>
                            </div>
                        </section>
                    `).join("")
                    : "<section><p style='text-align:left;'>Aucune progression enregistrée.</p></section>"
            }
        </div>
    `;
}

function addProgress() {
    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar"><h1>Ajouter une progression</h1></div>
            <section>
                <input id="progress-category" placeholder="Catégorie" style="width:100%;padding:12px;margin-bottom:15px;text-align:left;">
                <textarea id="progress-comment" placeholder="Détail" rows="6" style="width:100%;padding:12px;margin-bottom:15px;text-align:left !important;direction:ltr;"></textarea>
                <button onclick="saveProgress()">Enregistrer</button>
                <button onclick="showProgress()">Annuler</button>
            </section>
        </div>
    `;
}

async function saveProgress() {
    const category = document.getElementById("progress-category").value.trim();
    const comment = document.getElementById("progress-comment").value.trim();

    if (!category) {
        alert("La catégorie est obligatoire.");
        return;
    }

    const { error } = await supabaseClient.from("Progress").insert({
        student_id: currentStudent.id,
        category,
        comment
    });

    if (error) {
        showError(error);
        return;
    }

    await showProgress();
}

async function editProgress(id) {
    const { data: item, error } = await supabaseClient
        .from("Progress").select("*").eq("id", id).single();

    if (error) {
        showError(error);
        return;
    }

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar"><h1>Modifier la progression</h1></div>
            <section>
                <input id="edit-progress-category" value="${escapeHTML(item.category || "")}" style="width:100%;padding:12px;margin-bottom:15px;text-align:left;">
                <textarea id="edit-progress-comment" rows="6" style="width:100%;padding:12px;margin-bottom:15px;text-align:left !important;direction:ltr;">${escapeHTML(item.comment || "")}</textarea>
                <button onclick="saveEditedProgress('${id}')">Enregistrer</button>
                <button onclick="showProgress()">Annuler</button>
            </section>
        </div>
    `;
}

async function saveEditedProgress(id) {
    const category = document.getElementById("edit-progress-category").value.trim();
    const comment = document.getElementById("edit-progress-comment").value.trim();

    if (!category) {
        alert("La catégorie est obligatoire.");
        return;
    }

    const { error } = await supabaseClient.from("Progress")
        .update({ category, comment }).eq("id", id);

    if (error) {
        showError(error);
        return;
    }

    await showProgress();
}

async function deleteProgress(id) {
    if (!confirm("Supprimer cette progression ?")) return;

    const { error } = await supabaseClient.from("Progress").delete().eq("id", id);

    if (error) {
        showError(error);
        return;
    }

    await showProgress();
}

/* =========================
   DIFFICULTÉS
========================= */

async function showDifficulties() {
    const { data: difficulties, error } = await supabaseClient
        .from("Difficulties").select("*")
        .eq("student_id", currentStudent.id)
        .order("id");

    if (error) {
        showError(error);
        return;
    }

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <div><h1>Difficultés</h1><p>${escapeHTML(currentStudent.name)}</p></div>
                <button onclick="renderStudentPage()">Retour</button>
            </div>

            <div class="section-title">
                <h2 class="page-title">Points à travailler</h2>
                <button onclick="addDifficulty()">+ Ajouter</button>
            </div>

            ${
                difficulties?.length
                    ? difficulties.map(item => `
                        <section style="text-align:left;">
                            <h2 style="text-align:left;">${escapeHTML(item.title || "")}</h2>
                            <p style="white-space:pre-wrap;text-align:left !important;direction:ltr;text-indent:0;">${escapeHTML(item.detail || "")}</p>
                            <div style="margin-top:15px;text-align:left;">
                                <button onclick="editDifficulty('${item.id}')">Modifier</button>
                                <button onclick="deleteDifficulty('${item.id}')">Supprimer</button>
                            </div>
                        </section>
                    `).join("")
                    : "<section><p style='text-align:left;'>Aucune difficulté enregistrée.</p></section>"
            }
        </div>
    `;
}

function addDifficulty() {
    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar"><h1>Ajouter une difficulté</h1></div>
            <section>
                <input id="difficulty-title" placeholder="Titre" style="width:100%;padding:12px;margin-bottom:15px;text-align:left;">
                <textarea id="difficulty-detail" placeholder="Détail" rows="6" style="width:100%;padding:12px;margin-bottom:15px;text-align:left !important;direction:ltr;"></textarea>
                <button onclick="saveDifficulty()">Enregistrer</button>
                <button onclick="showDifficulties()">Annuler</button>
            </section>
        </div>
    `;
}

async function saveDifficulty() {
    const title = document.getElementById("difficulty-title").value.trim();
    const detail = document.getElementById("difficulty-detail").value.trim();

    if (!title) {
        alert("Le titre est obligatoire.");
        return;
    }

    const { error } = await supabaseClient.from("Difficulties").insert({
        student_id: currentStudent.id,
        title,
        detail
    });

    if (error) {
        showError(error);
        return;
    }

    await showDifficulties();
}

async function editDifficulty(id) {
    const { data: item, error } = await supabaseClient
        .from("Difficulties").select("*").eq("id", id).single();

    if (error) {
        showError(error);
        return;
    }

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar"><h1>Modifier la difficulté</h1></div>
            <section>
                <input id="edit-difficulty-title" value="${escapeHTML(item.title || "")}" style="width:100%;padding:12px;margin-bottom:15px;text-align:left;">
                <textarea id="edit-difficulty-detail" rows="6" style="width:100%;padding:12px;margin-bottom:15px;text-align:left !important;direction:ltr;">${escapeHTML(item.detail || "")}</textarea>
                <button onclick="saveEditedDifficulty('${id}')">Enregistrer</button>
                <button onclick="showDifficulties()">Annuler</button>
            </section>
        </div>
    `;
}

async function saveEditedDifficulty(id) {
    const title = document.getElementById("edit-difficulty-title").value.trim();
    const detail = document.getElementById("edit-difficulty-detail").value.trim();

    if (!title) {
        alert("Le titre est obligatoire.");
        return;
    }

    const { error } = await supabaseClient.from("Difficulties")
        .update({ title, detail }).eq("id", id);

    if (error) {
        showError(error);
        return;
    }

    await showDifficulties();
}

async function deleteDifficulty(id) {
    if (!confirm("Supprimer cette difficulté ?")) return;

    const { error } = await supabaseClient.from("Difficulties").delete().eq("id", id);

    if (error) {
        showError(error);
        return;
    }

    await showDifficulties();
}

/* =========================
   DÉCONNEXION
========================= */

async function logout() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        showError(error);
        return;
    }

    currentStudent = null;
    showHome();
}

/* =========================
   DÉMARRAGE
========================= */

async function startApp() {
    if (!app()) {
        console.error('Élément "#app" introuvable dans index.html.');
        return;
    }

    if (typeof supabase === "undefined") {
        app().innerHTML = "<p>Erreur : la bibliothèque Supabase n'est pas chargée.</p>";
        console.error("La bibliothèque Supabase doit être chargée avant ce script.");
        return;
    }

    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("Erreur de récupération de session :", error);
        showHome();
        return;
    }

    if (!session) {
        showHome();
        return;
    }

    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles").select("role")
        .eq("id", session.user.id)
        .single();

    if (!profileError && profile?.role === "teacher") {
        await showDashboard();
    } else {
        await supabaseClient.auth.signOut();
        showHome();
    }
}

startApp();
