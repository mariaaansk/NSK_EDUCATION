const SUPABASE_URL = "https://htsxwtgcgczmdgexfxny.supabase.co";
const SUPABASE_KEY = "sb_publishable_hxcdPuJMlrh9yd4W5n-MhQ_mYeak9am";

const supabaseClient =
    window.supabase &&
    typeof window.supabase.createClient === "function"
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
        : null;

let currentStudent = null;

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
            <option value="${minutes}"
                ${String(selected) === String(minutes) ? "selected" : ""}>
                ${label}
            </option>
        `).join("")}
    `;
}

function normalizeGrade(grade, max = 20) {
    const value = Number(grade);
    const maximum = Number(max);

    if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) {
        return null;
    }

    return Number(((value / maximum) * 20).toFixed(2));
}

function showError(error) {
    console.error(error);
    alert(typeof error === "string"
        ? error
        : error?.message || "Une erreur inattendue est survenue.");
}

/* ACCUEIL */

function showHome() {
    const root = app();
    if (!root) return;

    root.innerHTML = `
        <div class="home">
            <h1>NSK Éducation</h1>
            <p>Suivi des élèves</p>
            <div class="home-buttons">
                <button onclick="showLogin()">Connexion enseignant</button>
            </div>
        </div>
    `;
}

/* CONNEXION */

function showLogin() {
    const root = app();
    if (!root) return;

    root.innerHTML = `
        <div class="login-box">
            <h1>NSK Éducation</h1>
            <h2>Connexion</h2>
            <input id="login-email" type="email" placeholder="Adresse e-mail">
            <input id="login-password" type="password" placeholder="Mot de passe">
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
        showError("Supabase n'est pas chargé. Recharge la page.");
        return;
    }

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errorElement = document.getElementById("login-error");

    if (!email || !password) {
        errorElement.textContent = "Veuillez remplir tous les champs.";
        return;
    }

    try {
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
    } catch (error) {
        errorElement.textContent = "Impossible de se connecter. Réessaie.";
        console.error("Erreur de connexion :", error);
    }
}

async function forgotPassword() {
    if (!supabaseClient) {
        showError("Supabase n'est pas chargé. Recharge la page.");
        return;
    }

    const email = prompt("Entrez votre adresse e-mail :");
    if (!email) return;

    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(
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

/* TABLEAU DE BORD */

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
                    ${students?.length
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
                        : "<p>Aucun élève enregistré.</p>"}
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

/* AJOUT D'UN ÉLÈVE */

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

    try {
        const { error } = await supabaseClient
            .from("Students")
            .insert({ name, class: studentClass });

        if (error) throw error;
        await showDashboard();
    } catch (error) {
        showError(error);
    }
}

/* MODIFICATION D'UN ÉLÈVE */

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
                <div class="topbar"><h1>Modifier l'élève</h1></div>
                <section>
                    <input id="edit-student-name"
                        value="${escapeHTML(student.name)}"
                        style="width:100%;padding:12px;margin-bottom:12px;">
                    <input id="edit-student-class"
                        value="${escapeHTML(student.class || "")}"
                        style="width:100%;padding:12px;margin-bottom:12px;">
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
    const name = document.getElementById("edit-student-name").value.trim();
    const studentClass = document.getElementById("edit-student-class").value.trim();

    if (!name) {
        alert("Le nom est obligatoire.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Students")
            .update({ name, class: studentClass })
            .eq("id", id);

        if (error) throw error;
        await showDashboard();
    } catch (error) {
        showError(error);
    }
}

/* SUPPRESSION D'UN ÉLÈVE */

async function deleteStudent(id) {
    if (!confirm("Supprimer cet élève et toutes ses données ?")) return;

    try {
        for (const table of ["Sessions", "Notes", "Progress", "Difficulties"]) {
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

/* PAGE ÉLÈVE */

async function openStudent(id) {
    if (!id) {
        renderStudentPage();
        return;
    }

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
/* =========================
   SÉANCES
========================= */

async function showSessions() {
    if (!currentStudent) {
        await showDashboard();
        return;
    }

    try {
        const { data: sessions, error } = await supabaseClient
            .from("Sessions")
            .select("*")
            .eq("student_id", currentStudent.id)
            .order("date", { ascending: false });

        if (error) throw error;

        app().innerHTML = `
            <div class="dashboard">
                <div class="topbar">
                    <div>
                        <h1>Séances</h1>
                        <p>${escapeHTML(currentStudent.name)}</p>
                    </div>
                    <button onclick="renderStudentPage()">Retour</button>
                </div>

                <button onclick="showAddSession()">+ Ajouter une séance</button>

                <div class="students-grid">
                    ${sessions && sessions.length
                        ? sessions.map(session => `
                            <div class="student-card">
                                <h3>${escapeHTML(session.title || "Séance")}</h3>
                                <p>Date : ${escapeHTML(formatDate(session.date))}</p>
                                <p>Durée : ${escapeHTML(formatDuration(session.duration))}</p>
                                <p>${escapeHTML(session.description || "")}</p>
                                <button onclick="editSession('${session.id}')">Modifier</button>
                                <button onclick="deleteSession('${session.id}')">Supprimer</button>
                            </div>
                        `).join("")
                        : "<p>Aucune séance enregistrée.</p>"}
                </div>
            </div>
        `;
    } catch (error) {
        showError(error);
    }
}

function showAddSession(session = null) {
    const editing = Boolean(session);

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <h1>${editing ? "Modifier la séance" : "Nouvelle séance"}</h1>
                <button onclick="showSessions()">Retour</button>
            </div>

            <section>
                <label for="session-title">Titre</label>
                <input id="session-title"
                    value="${escapeHTML(session?.title || "")}"
                    placeholder="Titre de la séance"
                    style="width:100%;padding:12px;margin-bottom:12px;">

                <label for="session-date">Date</label>
                <input id="session-date" type="date"
                    value="${escapeHTML(session?.date || new Date().toISOString().slice(0, 10))}"
                    style="width:100%;padding:12px;margin-bottom:12px;">

                <label for="session-duration">Durée</label>
                <select id="session-duration"
                    style="width:100%;padding:12px;margin-bottom:12px;">
                    ${durationOptions(session?.duration || "")}
                </select>

                <label for="session-description">Description</label>
                <textarea id="session-description"
                    placeholder="Contenu de la séance"
                    style="width:100%;padding:12px;margin-bottom:12px;">${escapeHTML(session?.description || "")}</textarea>

                <button onclick="${editing
                    ? `saveSession('${session.id}')`
                    : "addSession()"}">
                    Enregistrer
                </button>
                <button onclick="showSessions()">Annuler</button>
            </section>
        </div>
    `;
}

async function addSession() {
    const title = document.getElementById("session-title").value.trim();
    const date = document.getElementById("session-date").value;
    const duration = document.getElementById("session-duration").value;
    const description = document.getElementById("session-description").value.trim();

    if (!title || !date) {
        alert("Veuillez renseigner le titre et la date.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Sessions")
            .insert({
                student_id: currentStudent.id,
                title,
                date,
                duration: duration ? Number(duration) : null,
                description
            });

        if (error) throw error;
        await showSessions();
    } catch (error) {
        showError(error);
    }
}

async function editSession(id) {
    try {
        const { data: session, error } = await supabaseClient
            .from("Sessions")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;
        showAddSession(session);
    } catch (error) {
        showError(error);
    }
}

async function saveSession(id) {
    const title = document.getElementById("session-title").value.trim();
    const date = document.getElementById("session-date").value;
    const duration = document.getElementById("session-duration").value;
    const description = document.getElementById("session-description").value.trim();

    if (!title || !date) {
        alert("Veuillez renseigner le titre et la date.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Sessions")
            .update({
                title,
                date,
                duration: duration ? Number(duration) : null,
                description
            })
            .eq("id", id)
            .eq("student_id", currentStudent.id);

        if (error) throw error;
        await showSessions();
    } catch (error) {
        showError(error);
    }
}

async function deleteSession(id) {
    if (!confirm("Supprimer cette séance ?")) return;

    try {
        const { error } = await supabaseClient
            .from("Sessions")
            .delete()
            .eq("id", id)
            .eq("student_id", currentStudent.id);

        if (error) throw error;
        await showSessions();
    } catch (error) {
        showError(error);
    }
}


/* =========================
   NOTES
========================= */

async function showNotes() {
    if (!currentStudent) {
        await showDashboard();
        return;
    }

    try {
        const { data: notes, error } = await supabaseClient
            .from("Notes")
            .select("*")
            .eq("student_id", currentStudent.id)
            .order("date", { ascending: false });

        if (error) throw error;

        app().innerHTML = `
            <div class="dashboard">
                <div class="topbar">
                    <div>
                        <h1>Notes</h1>
                        <p>${escapeHTML(currentStudent.name)}</p>
                    </div>
                    <button onclick="renderStudentPage()">Retour</button>
                </div>

                <button onclick="showAddNote()">+ Ajouter une note</button>

                <div class="students-grid">
                    ${notes && notes.length
                        ? notes.map(note => `
                            <div class="student-card">
                                <h3>${escapeHTML(note.title || "Note")}</h3>
                                <p>Date : ${escapeHTML(formatDate(note.date))}</p>
                                <p>Note : ${escapeHTML(note.grade ?? "—")} / ${escapeHTML(note.max_grade ?? 20)}</p>
                                <p>${escapeHTML(note.description || "")}</p>
                                <button onclick="editNote('${note.id}')">Modifier</button>
                                <button onclick="deleteNote('${note.id}')">Supprimer</button>
                            </div>
                        `).join("")
                        : "<p>Aucune note enregistrée.</p>"}
                </div>
            </div>
        `;
    } catch (error) {
        showError(error);
    }
}

function showAddNote(note = null) {
    const editing = Boolean(note);

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <h1>${editing ? "Modifier la note" : "Nouvelle note"}</h1>
                <button onclick="showNotes()">Retour</button>
            </div>

            <section>
                <label for="note-title">Titre</label>
                <input id="note-title"
                    value="${escapeHTML(note?.title || "")}"
                    placeholder="Matière ou évaluation"
                    style="width:100%;padding:12px;margin-bottom:12px;">

                <label for="note-date">Date</label>
                <input id="note-date" type="date"
                    value="${escapeHTML(note?.date || new Date().toISOString().slice(0, 10))}"
                    style="width:100%;padding:12px;margin-bottom:12px;">

                <label for="note-grade">Note obtenue</label>
                <input id="note-grade" type="number" min="0" step="any"
                    value="${escapeHTML(note?.grade ?? "")}"
                    placeholder="Note obtenue"
                    style="width:100%;padding:12px;margin-bottom:12px;">

                <label for="note-max-grade">Note maximale</label>
                <input id="note-max-grade" type="number" min="0.01" step="any"
                    value="${escapeHTML(note?.max_grade ?? 20)}"
                    style="width:100%;padding:12px;margin-bottom:12px;">

                <label for="note-description">Commentaire</label>
                <textarea id="note-description"
                    placeholder="Commentaire facultatif"
                    style="width:100%;padding:12px;margin-bottom:12px;">${escapeHTML(note?.description || "")}</textarea>

                <button onclick="${editing
                    ? `saveNote('${note.id}')`
                    : "addNote()"}">
                    Enregistrer
                </button>
                <button onclick="showNotes()">Annuler</button>
            </section>
        </div>
    `;
}

async function addNote() {
    const title = document.getElementById("note-title").value.trim();
    const date = document.getElementById("note-date").value;
    const gradeInput = document.getElementById("note-grade").value;
    const maxInput = document.getElementById("note-max-grade").value;
    const description = document.getElementById("note-description").value.trim();

    if (!title || !date || gradeInput === "" || maxInput === "") {
        alert("Veuillez remplir le titre, la date et les notes.");
        return;
    }

    const grade = Number(gradeInput);
    const maxGrade = Number(maxInput);

    if (!Number.isFinite(grade) || !Number.isFinite(maxGrade) ||
        maxGrade <= 0 || grade < 0 || grade > maxGrade) {
        alert("Vérifiez la note obtenue et la note maximale.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Notes")
            .insert({
                student_id: currentStudent.id,
                title,
                date,
                grade,
                max_grade: maxGrade,
                description
            });

        if (error) throw error;
        await showNotes();
    } catch (error) {
        showError(error);
    }
}

async function editNote(id) {
    try {
        const { data: note, error } = await supabaseClient
            .from("Notes")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;
        showAddNote(note);
    } catch (error) {
        showError(error);
    }
}

async function saveNote(id) {
    const title = document.getElementById("note-title").value.trim();
    const date = document.getElementById("note-date").value;
    const gradeInput = document.getElementById("note-grade").value;
    const maxInput = document.getElementById("note-max-grade").value;
    const description = document.getElementById("note-description").value.trim();

    if (!title || !date || gradeInput === "" || maxInput === "") {
        alert("Veuillez remplir le titre, la date et les notes.");
        return;
    }

    const grade = Number(gradeInput);
    const maxGrade = Number(maxInput);

    if (!Number.isFinite(grade) || !Number.isFinite(maxGrade) ||
        maxGrade <= 0 || grade < 0 || grade > maxGrade) {
        alert("Vérifiez la note obtenue et la note maximale.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Notes")
            .update({
                title,
                date,
                grade,
                max_grade: maxGrade,
                description
            })
            .eq("id", id)
            .eq("student_id", currentStudent.id);

        if (error) throw error;
        await showNotes();
    } catch (error) {
        showError(error);
    }
}

async function deleteNote(id) {
    if (!confirm("Supprimer cette note ?")) return;

    try {
        const { error } = await supabaseClient
            .from("Notes")
            .delete()
            .eq("id", id)
            .eq("student_id", currentStudent.id);

        if (error) throw error;
        await showNotes();
    } catch (error) {
        showError(error);
    }
}
/* =========================
   PROGRESSION
========================= */

async function showProgress() {
    if (!currentStudent) {
        await showDashboard();
        return;
    }

    try {
        const { data: progressItems, error } = await supabaseClient
            .from("Progress")
            .select("*")
            .eq("student_id", currentStudent.id)
            .order("date", { ascending: false });

        if (error) throw error;

        app().innerHTML = `
            <div class="dashboard">
                <div class="topbar">
                    <div>
                        <h1>Progression</h1>
                        <p>${escapeHTML(currentStudent.name)}</p>
                    </div>
                    <button onclick="renderStudentPage()">Retour</button>
                </div>

                <button onclick="showAddProgress()">+ Ajouter une progression</button>

                <div class="students-grid">
                    ${progressItems && progressItems.length
                        ? progressItems.map(item => `
                            <div class="student-card">
                                <h3>${escapeHTML(item.title || "Progression")}</h3>
                                <p>Date : ${escapeHTML(formatDate(item.date))}</p>
                                <p>Évolution : ${escapeHTML(item.level ?? "—")}</p>
                                <p>${escapeHTML(item.description || "")}</p>
                                <button onclick="editProgress('${item.id}')">Modifier</button>
                                <button onclick="deleteProgress('${item.id}')">Supprimer</button>
                            </div>
                        `).join("")
                        : "<p>Aucune progression enregistrée.</p>"}
                </div>
            </div>
        `;
    } catch (error) {
        showError(error);
    }
}

function showAddProgress(item = null) {
    const editing = Boolean(item);

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <h1>${editing ? "Modifier la progression" : "Nouvelle progression"}</h1>
                <button onclick="showProgress()">Retour</button>
            </div>

            <section>
                <label for="progress-title">Compétence ou objectif</label>
                <input id="progress-title"
                    value="${escapeHTML(item?.title || "")}"
                    placeholder="Compétence ou objectif"
                    style="width:100%;padding:12px;margin-bottom:12px;">

                <label for="progress-date">Date</label>
                <input id="progress-date" type="date"
                    value="${escapeHTML(item?.date || new Date().toISOString().slice(0, 10))}"
                    style="width:100%;padding:12px;margin-bottom:12px;">

                <label for="progress-level">Niveau</label>
                <select id="progress-level"
                    style="width:100%;padding:12px;margin-bottom:12px;">
                    <option value="">Choisir un niveau</option>
                    <option value="À travailler"
                        ${item?.level === "À travailler" ? "selected" : ""}>
                        À travailler
                    </option>
                    <option value="En cours"
                        ${item?.level === "En cours" ? "selected" : ""}>
                        En cours
                    </option>
                    <option value="Acquis"
                        ${item?.level === "Acquis" ? "selected" : ""}>
                        Acquis
                    </option>
                    <option value="Maîtrisé"
                        ${item?.level === "Maîtrisé" ? "selected" : ""}>
                        Maîtrisé
                    </option>
                </select>

                <label for="progress-description">Commentaire</label>
                <textarea id="progress-description"
                    placeholder="Observations et progrès"
                    style="width:100%;padding:12px;margin-bottom:12px;">${escapeHTML(item?.description || "")}</textarea>

                <button onclick="${editing
                    ? `saveProgress('${item.id}')`
                    : "addProgress()"}">
                    Enregistrer
                </button>
                <button onclick="showProgress()">Annuler</button>
            </section>
        </div>
    `;
}

async function addProgress() {
    const title = document.getElementById("progress-title").value.trim();
    const date = document.getElementById("progress-date").value;
    const level = document.getElementById("progress-level").value;
    const description = document.getElementById("progress-description").value.trim();

    if (!title || !date || !level) {
        alert("Veuillez remplir l'objectif, la date et le niveau.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Progress")
            .insert({
                student_id: currentStudent.id,
                title,
                date,
                level,
                description
            });

        if (error) throw error;
        await showProgress();
    } catch (error) {
        showError(error);
    }
}

async function editProgress(id) {
    try {
        const { data: item, error } = await supabaseClient
            .from("Progress")
            .select("*")
            .eq("id", id)
            .eq("student_id", currentStudent.id)
            .single();

        if (error) throw error;
        showAddProgress(item);
    } catch (error) {
        showError(error);
    }
}

async function saveProgress(id) {
    const title = document.getElementById("progress-title").value.trim();
    const date = document.getElementById("progress-date").value;
    const level = document.getElementById("progress-level").value;
    const description = document.getElementById("progress-description").value.trim();

    if (!title || !date || !level) {
        alert("Veuillez remplir l'objectif, la date et le niveau.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Progress")
            .update({ title, date, level, description })
            .eq("id", id)
            .eq("student_id", currentStudent.id);

        if (error) throw error;
        await showProgress();
    } catch (error) {
        showError(error);
    }
}

async function deleteProgress(id) {
    if (!confirm("Supprimer cette progression ?")) return;

    try {
        const { error } = await supabaseClient
            .from("Progress")
            .delete()
            .eq("id", id)
            .eq("student_id", currentStudent.id);

        if (error) throw error;
        await showProgress();
    } catch (error) {
        showError(error);
    }
}


/* =========================
   DIFFICULTÉS
========================= */

async function showDifficulties() {
    if (!currentStudent) {
        await showDashboard();
        return;
    }

    try {
        const { data: difficulties, error } = await supabaseClient
            .from("Difficulties")
            .select("*")
            .eq("student_id", currentStudent.id)
            .order("date", { ascending: false });

        if (error) throw error;

        app().innerHTML = `
            <div class="dashboard">
                <div class="topbar">
                    <div>
                        <h1>Difficultés</h1>
                        <p>${escapeHTML(currentStudent.name)}</p>
                    </div>
                    <button onclick="renderStudentPage()">Retour</button>
                </div>

                <button onclick="showAddDifficulty()">+ Ajouter une difficulté</button>

                <div class="students-grid">
                    ${difficulties && difficulties.length
                        ? difficulties.map(item => `
                            <div class="student-card">
                                <h3>${escapeHTML(item.title || "Difficulté")}</h3>
                                <p>Date : ${escapeHTML(formatDate(item.date))}</p>
                                <p>Statut : ${escapeHTML(item.status || "À suivre")}</p>
                                <p>${escapeHTML(item.description || "")}</p>
                                <button onclick="editDifficulty('${item.id}')">Modifier</button>
                                <button onclick="deleteDifficulty('${item.id}')">Supprimer</button>
                            </div>
                        `).join("")
                        : "<p>Aucune difficulté enregistrée.</p>"}
                </div>
            </div>
        `;
    } catch (error) {
        showError(error);
    }
}

function showAddDifficulty(item = null) {
    const editing = Boolean(item);

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <h1>${editing ? "Modifier la difficulté" : "Nouvelle difficulté"}</h1>
                <button onclick="showDifficulties()">Retour</button>
            </div>

            <section>
                <label for="difficulty-title">Difficulté rencontrée</label>
                <input id="difficulty-title"
                    value="${escapeHTML(item?.title || "")}"
                    placeholder="Titre de la difficulté"
                    style="width:100%;padding:12px;margin-bottom:12px;">

                <label for="difficulty-date">Date</label>
                <input id="difficulty-date" type="date"
                    value="${escapeHTML(item?.date || new Date().toISOString().slice(0, 10))}"
                    style="width:100%;padding:12px;margin-bottom:12px;">

                <label for="difficulty-status">Statut</label>
                <select id="difficulty-status"
                    style="width:100%;padding:12px;margin-bottom:12px;">
                    <option value="À suivre"
                        ${(!item?.status || item.status === "À suivre") ? "selected" : ""}>
                        À suivre
                    </option>
                    <option value="En cours"
                        ${item?.status === "En cours" ? "selected" : ""}>
                        En cours
                    </option>
                    <option value="Résolue"
                        ${item?.status === "Résolue" ? "selected" : ""}>
                        Résolue
                    </option>
                </select>

                <label for="difficulty-description">Description et solutions envisagées</label>
                <textarea id="difficulty-description"
                    placeholder="Décrivez la difficulté et les pistes de travail"
                    style="width:100%;padding:12px;margin-bottom:12px;">${escapeHTML(item?.description || "")}</textarea>

                <button onclick="${editing
                    ? `saveDifficulty('${item.id}')`
                    : "addDifficulty()"}">
                    Enregistrer
                </button>
                <button onclick="showDifficulties()">Annuler</button>
            </section>
        </div>
    `;
}

async function addDifficulty() {
    const title = document.getElementById("difficulty-title").value.trim();
    const date = document.getElementById("difficulty-date").value;
    const status = document.getElementById("difficulty-status").value;
    const description = document.getElementById("difficulty-description").value.trim();

    if (!title || !date) {
        alert("Veuillez renseigner le titre et la date.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Difficulties")
            .insert({
                student_id: currentStudent.id,
                title,
                date,
                status,
                description
            });

        if (error) throw error;
        await showDifficulties();
    } catch (error) {
        showError(error);
    }
}

async function editDifficulty(id) {
    try {
        const { data: item, error } = await supabaseClient
            .from("Difficulties")
            .select("*")
            .eq("id", id)
            .eq("student_id", currentStudent.id)
            .single();

        if (error) throw error;
        showAddDifficulty(item);
    } catch (error) {
        showError(error);
    }
}

async function saveDifficulty(id) {
    const title = document.getElementById("difficulty-title").value.trim();
    const date = document.getElementById("difficulty-date").value;
    const status = document.getElementById("difficulty-status").value;
    const description = document.getElementById("difficulty-description").value.trim();

    if (!title || !date) {
        alert("Veuillez renseigner le titre et la date.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("Difficulties")
            .update({ title, date, status, description })
            .eq("id", id)
            .eq("student_id", currentStudent.id);

        if (error) throw error;
        await showDifficulties();
    } catch (error) {
        showError(error);
    }
}

async function deleteDifficulty(id) {
    if (!confirm("Supprimer cette difficulté ?")) return;

    try {
        const { error } = await supabaseClient
            .from("Difficulties")
            .delete()
            .eq("id", id)
            .eq("student_id", currentStudent.id);

        if (error) throw error;
        await showDifficulties();
    } catch (error) {
        showError(error);
    }
}
/* =========================
   DÉCONNEXION
========================= */

async function logout() {
    if (supabaseClient) {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            showError(error);
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
    const root = app();

    if (!root) {
        console.error("Élément #app introuvable dans index.html.");
        return;
    }

    if (!supabaseClient) {
        root.innerHTML = `
            <div class="dashboard">
                <h1>NSK Éducation</h1>
                <p>Impossible de charger Supabase.</p>
                <p>Vérifie que la bibliothèque Supabase est chargée dans index.html.</p>
            </div>
        `;
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        const session = data?.session;

        if (!session) {
            showHome();
            return;
        }

        const { data: profile, error: profileError } = await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();

        if (profileError || !profile || profile.role !== "teacher") {
            await supabaseClient.auth.signOut();
            showHome();
            return;
        }

        await showDashboard();
    } catch (error) {
        console.error("Erreur au démarrage :", error);

        root.innerHTML = `
            <div class="dashboard">
                <h1>NSK Éducation</h1>
                <p>Impossible de démarrer l'application.</p>
                <button onclick="startApp()">Réessayer</button>
            </div>
        `;
    }
}


/* =========================
   LANCEMENT
========================= */

document.addEventListener("DOMContentLoaded", startApp);

/* =========================================
   CORRECTIONS + DOCUMENTS PDF DES SÉANCES
   Bucket Supabase privé : documents-pdf
========================================= */

// Correction de l'affichage des durées.
function formatDuration(minutes) {
    if (minutes == null || minutes === "") return "";

    const total = Number(minutes);
    const hours = Math.floor(total / 60);
    const remainingMinutes = total % 60;

    if (hours === 0) return `${remainingMinutes} min`;
    if (remainingMinutes === 0) return `${hours}h`;

    return `${hours}h ${remainingMinutes} min`;
}

// Correction de la liste des durées.
function durationOptions(selected = "") {
    const durations = [];

    for (let minutes = 30; minutes <= 600; minutes += 30) {
        durations.push(`
            <option
                value="${minutes}"
                ${String(selected) === String(minutes) ? "selected" : ""}
            >${formatDuration(minutes)}</option>
        `);
    }

    return `
        <option value="">Choisir une durée</option>
        ${durations.join("")}
    `;
}

// Affiche une séance avec sa liste de PDF.
async function showSession(id) {
    const { data: session, error } = await supabaseClient
        .from("Sessions")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        alert(error.message);
        return;
    }

    const { data: documents, error: docsError } = await supabaseClient
        .from("session_documents")
        .select("*")
        .eq("session_id", id)
        .order("created_at", { ascending: false });

    if (docsError) {
        alert("Erreur de lecture des PDF : " + docsError.message);
        return;
    }

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <div>
                    <h1>Séance du ${formatDate(session.date)}</h1>
                    <p>${escapeHTML(session.subject || "")}</p>
                    <p>${session.duration_minutes != null
                        ? escapeHTML(formatDuration(session.duration_minutes))
                        : ""}</p>
                </div>
                <button onclick="showSubjectSessions('${encodeURIComponent(session.subject || "")}')">
                    Retour
                </button>
            </div>

            <div class="student-menu">
                <button onclick="showSessionSummary('${session.id}')">
                    Résumé de la séance
                </button>
                <button onclick="showSessionConclusion('${session.id}')">
                    Conclusion
                </button>
            </div>

            <section style="text-align:left">
                <h2>Documents PDF</h2>
                <p>Tu peux ajouter plusieurs fichiers PDF à cette séance.</p>

                <input
                    id="session-pdf-files"
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    style="display:block;width:100%;margin:15px 0"
                >

                <button onclick="uploadSessionPDFs('${session.id}')">
                    Ajouter les PDF sélectionnés
                </button>

                <div style="margin-top:20px">
                    ${
                        documents && documents.length
                        ? documents.map(doc => `
                            <div style="
                                display:flex;
                                flex-wrap:wrap;
                                align-items:center;
                                justify-content:space-between;
                                gap:10px;
                                padding:12px 0;
                                border-bottom:1px solid #dde2e8;
                            ">
                                <span>📄 ${escapeHTML(doc.file_name)}</span>
                                <div style="display:flex;gap:8px;flex-wrap:wrap">
                                    <button onclick="openSessionPDF('${doc.id}')">
                                        Ouvrir
                                    </button>
                                    <button onclick="deleteSessionPDF('${doc.id}')">
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        `).join("")
                        : "<p>Aucun PDF pour cette séance.</p>"
                    }
                </div>
            </section>

            <section style="margin-top:20px;text-align:left">
                <button onclick="editSession('${session.id}')">
                    Modifier la séance
                </button>
                <button onclick="deleteSession('${session.id}')">
                    Supprimer la séance
                </button>
            </section>
        </div>
    `;
}

// Téléverse plusieurs PDF dans le bucket privé.
async function uploadSessionPDFs(sessionId) {
    const input = document.getElementById("session-pdf-files");
    const files = Array.from(input.files || []);

    if (!files.length) {
        alert("Sélectionne au moins un fichier PDF.");
        return;
    }

    if (files.some(file =>
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
    )) {
        alert("Sélectionne uniquement des fichiers PDF.");
        return;
    }

    const { data: { user }, error: authError } =
        await supabaseClient.auth.getUser();

    if (authError || !user) {
        alert("Ta session a expiré. Reconnecte-toi.");
        return;
    }

    for (const file of files) {
        // Le chemin unique évite les collisions entre fichiers.
        const safeName = file.name
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9._-]/g, "_");

        const filePath =
            `${user.id}/${sessionId}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabaseClient.storage
            .from("documents-pdf")
            .upload(filePath, file, {
                contentType: "application/pdf",
                upsert: false
            });

        if (uploadError) {
            alert(`Échec du téléversement de ${file.name} : ${uploadError.message}`);
            return;
        }

        const { error: insertError } = await supabaseClient
            .from("session_documents")
            .insert({
                session_id: Number(sessionId),
                file_name: file.name,
                file_path: filePath
            });

        if (insertError) {
            // Si l'enregistrement échoue, on retire le fichier envoyé.
            await supabaseClient.storage
                .from("documents-pdf")
                .remove([filePath]);

            alert(`Erreur d'enregistrement de ${file.name} : ${insertError.message}`);
            return;
        }
    }

    alert("PDF ajouté(s) avec succès.");
    await showSession(sessionId);
}

// Crée une URL temporaire pour ouvrir un PDF privé.
async function openSessionPDF(documentId) {
    const { data: doc, error } = await supabaseClient
        .from("session_documents")
        .select("*")
        .eq("id", documentId)
        .single();

    if (error || !doc) {
        alert("Impossible de retrouver ce document.");
        return;
    }

    const { data, error: urlError } = await supabaseClient.storage
        .from("documents-pdf")
        .createSignedUrl(doc.file_path, 300);

    if (urlError || !data?.signedUrl) {
        alert("Impossible d'ouvrir le PDF : " + (urlError?.message || ""));
        return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

// Supprime un PDF du stockage et de la table.
async function deleteSessionPDF(documentId) {
    if (!confirm("Supprimer ce PDF ? Cette action est définitive.")) {
        return;
    }

    const { data: doc, error } = await supabaseClient
        .from("session_documents")
        .select("*")
        .eq("id", documentId)
        .single();

    if (error || !doc) {
        alert("Impossible de retrouver ce document.");
        return;
    }

    const { error: storageError } = await supabaseClient.storage
        .from("documents-pdf")
        .remove([doc.file_path]);

    if (storageError) {
        alert("Erreur lors de la suppression du fichier : " + storageError.message);
        return;
    }

    const { error: rowError } = await supabaseClient
        .from("session_documents")
        .delete()
        .eq("id", documentId);

    if (rowError) {
        alert("Le fichier a été supprimé, mais pas sa référence : " + rowError.message);
        return;
    }

    alert("PDF supprimé.");
    await showSession(doc.session_id);
}

// Page regroupant les PDF des séances de l'élève actuel.
async function showAllSubjectDocuments() {
    const { data: sessions, error } = await supabaseClient
        .from("Sessions")
        .select("id, subject, date")
        .eq("student_id", currentStudent.id)
        .order("date", { ascending: false });

    if (error) {
        alert(error.message);
        return;
    }

    if (!sessions || !sessions.length) {
        app().innerHTML = `
            <div class="dashboard">
                <h1>Documents PDF</h1>
                <p>Aucune séance enregistrée.</p>
                <button onclick="showSessions()">Retour</button>
            </div>
        `;
        return;
    }

    const sessionIds = sessions.map(s => s.id);

    const { data: documents, error: docsError } = await supabaseClient
        .from("session_documents")
        .select("*")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: false });

    if (docsError) {
        alert(docsError.message);
        return;
    }

    const sessionById = Object.fromEntries(
        sessions.map(s => [String(s.id), s])
    );

    app().innerHTML = `
        <div class="dashboard">
            <div class="topbar">
                <div>
                    <h1>Documents PDF</h1>
                    <p>${escapeHTML(currentStudent.name)}</p>
                </div>
                <button onclick="showSessions()">Retour aux séances</button>
            </div>

            <section style="text-align:left">
                ${
                    documents && documents.length
                    ? documents.map(doc => {
                        const session = sessionById[String(doc.session_id)];
                        return `
                            <div style="
                                padding:14px 0;
                                border-bottom:1px solid #dde2e8;
                            ">
                                <strong>📄 ${escapeHTML(doc.file_name)}</strong>
                                <p>
                                    ${escapeHTML(session?.subject || "")}
                                    — ${formatDate(session?.date)}
                                </p>
                                <button onclick="openSessionPDF('${doc.id}')">
                                    Ouvrir
                                </button>
                                <button onclick="showSession('${doc.session_id}')">
                                    Voir la séance
                                </button>
                            </div>
                        `;
                    }).join("")
                    : "<p>Aucun document PDF pour cet élève.</p>"
                }
            </section>
        </div>
    `;
}

// Supprime aussi les fichiers associés avant de supprimer la séance.
async function deleteSession(id) {
    if (!confirm("Supprimer cette séance et ses documents PDF ?")) {
        return;
    }

    const { data: documents, error: docsError } = await supabaseClient
        .from("session_documents")
        .select("id, file_path")
        .eq("session_id", id);

    if (docsError) {
        alert("Impossible de charger les PDF : " + docsError.message);
        return;
    }

    if (documents && documents.length) {
        const paths = documents.map(doc => doc.file_path);

        const { error: storageError } = await supabaseClient.storage
            .from("documents-pdf")
            .remove(paths);

        if (storageError) {
            alert("Impossible de supprimer les PDF : " + storageError.message);
            return;
        }

        const { error: rowsError } = await supabaseClient
            .from("session_documents")
            .delete()
            .eq("session_id", id);

        if (rowsError) {
            alert("Impossible de supprimer les références PDF : " + rowsError.message);
            return;
        }
    }

    const { error } = await supabaseClient
        .from("Sessions")
        .delete()
        .eq("id", id);

    if (error) {
        alert(error.message);
        return;
    }

    await showSessions();
}
