
const SUPABASE_URL = "https://htsxwtgcgczmdgexfxny.supabase.co";
const SUPABASE_KEY = "sb_publishable_hxcdPuJMlrh9yd4W5n-MhQ_mYeak9am";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

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

    const totalMinutes = Number(minutes);

    if (!Number.isFinite(totalMinutes)) return "";

    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    if (hours === 0) return `${remainingMinutes} min`;
    if (remainingMinutes === 0) return `${hours}h`;

    return `hoursh{remainingMinutes}`;
}

function durationOptions(selected = "") {
    const durations = [];

    for (let minutes = 30; minutes <= 600; minutes += 30) {
        durations.push([minutes, formatDuration(minutes)]);
    }

    return `
        <option value="">Choisir une durée</option>
        ${durations.map(([minutes, label]) => `
            <option value="${minutes}" String(selected)===String(minutes)?"selected":"">{label}</option>
        `).join("")}
    `;
}

function normalizeGrade(grade, max) {
    return Number(
        ((Number(grade) / Number(max)) * 20).toFixed(2)
    );
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
    app().innerHTML = `
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

            <button onclick="login()">
                Se connecter
            </button>

            <button
                class="secondary"
                onclick="showHome()"
            >
                Retour
            </button>

            <button
                class="link-button"
                onclick="forgotPassword()"
            >
                Mot de passe oublié ?
            </button>

        </div>
    `;
}


async function login() {
    const email =
        document.getElementById("login-email").value.trim();

    const password =
        document.getElementById("login-password").value;

    const error =
        document.getElementById("login-error");

    if (!email || !password) {
        error.textContent = "Veuillez remplir tous les champs.";
        return;
    }

    error.textContent = "Connexion en cours...";

    try {
        const { data, error: loginError } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (loginError) {
            error.textContent = "E-mail ou mot de passe incorrect.";
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

            error.textContent = "Accès réservé à l'enseignant.";
            return;
        }

        await showDashboard();

    } catch (err) {
        console.error("Erreur de connexion :", err);
        error.textContent =
            "Une erreur est survenue. Vérifie ta connexion et réessaie.";
    }
}


async function forgotPassword() {
    const email = prompt("Entrez votre adresse e-mail :");

    if (!email) return;

    try {
        const { error } =
            await supabaseClient.auth.resetPasswordForEmail(
                email,
                {
                    redirectTo: window.location.origin
                }
            );

        if (error) {
            alert(error.message);
            return;
        }

        alert("Un e-mail de réinitialisation a été envoyé.");

    } catch (err) {
        console.error("Erreur de réinitialisation :", err);
        alert("Impossible d'envoyer l'e-mail. Réessaie plus tard.");
    }
}


/* =========================
   TABLEAU DE BORD
========================= */

async function showDashboard() {
    const root = app();

    root.innerHTML = `
        <div class="dashboard">
            <h2>Chargement des élèves...</h2>
        </div>
    `;

    try {
        const { data: students, error } =
            await supabaseClient
                .from("Students")
                .select("*")
                .order("name");

        if (error) {
            root.innerHTML = `
                <div class="dashboard">
                    <h2>Erreur</h2>
                    <p>${escapeHTML(error.message)}</p>
                    <button onclick="showHome()">Retour à l'accueil</button>
                </div>
            `;
            return;
        }

        root.innerHTML = `
            <div class="dashboard">

                <div class="topbar">

                    <div>
                        <h1>NSK Éducation</h1>
                        <p>Tableau de bord enseignant</p>
                    </div>

                    <div class="topbar-buttons">
                        <button onclick="showAddStudent()">
                            + Ajouter un élève
                        </button>

                        <button onclick="logout()">
                            Déconnexion
                        </button>
                    </div>

                </div>

                <div class="section-title">
                    <h2 class="page-title">Mes élèves</h2>
                </div>

                <div class="students-grid">
                    ${
                        students && students.length
                            ? students.map(student => `
                                <div class="student-card">

                                    <div onclick="openStudent('${student.id}')">
                                        <h3>${escapeHTML(student.name)}</h3>
                                        <p>${escapeHTML(student.class || "")}</p>
                                    </div>

                                    <div style="margin-top:15px;display:flex;gap:8px;">
                                        <button
                                            onclick="editStudent('${student.id}')"
                                            style="padding:7px 10px;"
                                        >
                                            Modifier
                                        </button>

                                        <button
                                            onclick="deleteStudent('${student.id}')"
                                            style="padding:7px 10px;"
                                        >
                                            Supprimer
                                        </button>
                                    </div>

                                </div>
                            `).join("")
                            : `<p>Aucun élève enregistré.</p>`
                    }
                </div>

            </div>
        `;

    } catch (err) {
        console.error("Erreur du tableau de bord :", err);

        root.innerHTML = `
            <div class="dashboard">
                <h2>Impossible de charger les élèves</h2>
                <p>Vérifie ta connexion puis réessaie.</p>
                <button onclick="showDashboard()">Réessayer</button>
                <button onclick="logout()">Déconnexion</button>
            </div>
        `;
    }
}


/* =========================
   ÉLÈVES
========================= */

function showAddStudent() {
    app().innerHTML = `
        <div class="dashboard">

            <div class="topbar">
                <div>
                    <h1>Ajouter un élève</h1>
                </div>
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

                <button onclick="addStudent()">
                    Ajouter
                </button>

                <button onclick="showDashboard()">
                    Annuler
                </button>
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
        const { error } =
            await supabaseClient
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

    } catch (err) {
        console.error("Erreur lors de l'ajout :", err);
        alert("Une erreur est survenue lors de l'ajout de l'élève.");
    }
}


async function editStudent(id) {
    try {
        const { data: student, error } =
            await supabaseClient
                .from("Students")
                .select("*")
                .eq("id", id)
                .single();

        if (error || !student) {
            alert("Impossible de charger cet élève.");
            return;
        }

        app().innerHTML = `
            <div class="dashboard">

                <div class="topbar">
                    <h1>Modifier l'élève</h1>
                </div>

                <section>
                    <input
                        id="edit-student-name"
                        value="${escapeHTML(student.name || "")}"
                        placeholder="Nom et prénom"
                        style="width:100%;padding:12px;margin-bottom:12px;"
                    >

                    <input
                        id="edit-student-class"
                        value="${escapeHTML(student.class || "")}"
                        placeholder="Classe"
                        style="width:100%;padding:12px;margin-bottom:12px;"
                    >

                    <button onclick="saveStudent('${id}')">
                        Enregistrer
                    </button>

                    <button onclick="showDashboard()">
                        Annuler
                    </button>
                </section>

            </div>
        `;

    } catch (err) {
        console.error("Erreur lors du chargement de l'élève :", err);
        alert("Une erreur est survenue.");
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
        const { error } =
            await supabaseClient
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

    } catch (err) {
        console.error("Erreur lors de la modification :", err);
        alert("Une erreur est survenue lors de la modification.");
    }
}


async function deleteStudent(id) {
    if (!confirm("Supprimer cet élève et toutes ses données ?")) {
        return;
    }

    const tables = [
        "Sessions",
        "Notes",
        "Progress",
        "Difficulties"
    ];

    try {
        for (const table of tables) {
            const { error } =
                await supabaseClient
                    .from(table)
                    .delete()
                    .eq("student_id", id);

            if (error) {
                alert(
                    "Impossible de supprimer les données de " +
                    table +
                    " : " +
                    error.message
                );
                return;
            }
        }

        const { error } =
            await supabaseClient
                .from("Students")
                .delete()
                .eq("id", id);

        if (error) {
            alert("Impossible de supprimer l'élève : " + error.message);
            return;
        }

        await showDashboard();

    } catch (err) {
        console.error("Erreur lors de la suppression :", err);
        alert("Une erreur est survenue lors de la suppression.");
    }
}


/* =========================
   PAGE ÉLÈVE
========================= */

async function openStudent(id) {
    try {
        const { data: student, error } =
            await supabaseClient
                .from("Students")
                .select("*")
                .eq("id", id)
                .single();

        if (error || !student) {
            alert("Impossible d'ouvrir la fiche de cet élève.");
            return;
        }

        currentStudent = student;

        renderStudentPage();

    } catch (err) {
        console.error("Erreur lors de l'ouverture de l'élève :", err);
        alert("Une erreur est survenue lors de l'ouverture de la fiche.");
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

                <button onclick="showDashboard()">
                    Retour aux élèves
                </button>

            </div>

            <div class="student-menu">

                <button onclick="showSessions()">
                    Séances
                </button>

                <button onclick="showNotes()">
                    Notes
                </button>

                <button onclick="showProgress()">
                    Progression
                </button>

                <button onclick="showDifficulties()">
                    Difficultés
                </button>

            </div>

        </div>
    `;
}


/* =========================================================
   PARTIE 3/5 — GESTION DES SÉANCES
   ========================================================= */

function showSessions() {
  if (!currentStudent) {
    showDashboard();
    return;
  }

  app().innerHTML = `
    <div class="dashboard">
      <div class="topbar">
        <h1>Séances de ${escapeHTML(currentStudent.name)}</h1>
        <div>
          <button onclick="renderStudentPage()">Retour à l'élève</button>
          <button onclick="showAllSubjectDocuments()">Documents PDF</button>
        </div>
      </div>

      <section class="card">
        <h2>Ajouter une séance</h2>

        <form onsubmit="addSessionForSubject(event)">
          <label for="session-subject">Matière</label>
          <input
            id="session-subject"
            name="subject"
            type="text"
            required
            placeholder="Ex. : Mathématiques"
          >

          <label for="session-date">Date</label>
          <input
            id="session-date"
            name="date"
            type="date"
            required
            value="${new Date().toISOString().slice(0, 10)}"
          >

          <label for="session-duration">Durée</label>
          <select id="session-duration" name="duration_minutes">
            ${durationOptions(60)}
          </select>

          <button type="submit">Ajouter la séance</button>
        </form>
      </section>

      <section class="card">
        <h2>Séances enregistrées</h2>
        <div id="sessions-list">Chargement des séances...</div>
      </section>
    </div>
  `;

  loadSessions();
}


async function loadSessions() {
  const list = document.getElementById("sessions-list");

  if (!list || !currentStudent) return;

  try {
    const { data, error } = await supabaseClient
      .from("Sessions")
      .select("*")
      .eq("student_id", currentStudent.id)
      .order("date", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML = "<p>Aucune séance enregistrée pour le moment.</p>";
      return;
    }

    list.innerHTML = data.map(session => `
      <article class="session-item card">
        <h3>${escapeHTML(formatDate(session.date))}</h3>

        <p>
          <strong>Matière :</strong>
          ${escapeHTML(session.subject || "Non renseignée")}
        </p>

        <p>
          <strong>Durée :</strong>
          ${session.duration_minutes != null
            ? escapeHTML(formatDuration(session.duration_minutes))
            : "Non renseignée"}
        </p>

        <button onclick="showSession('${session.id}')">
          Ouvrir
        </button>

        <button onclick="editSession('${session.id}')">
          Modifier
        </button>

        <button onclick="deleteSession('${session.id}')">
          Supprimer
        </button>
      </article>
    `).join("");
  } catch (error) {
    console.error("Erreur lors du chargement des séances :", error);
    list.innerHTML = `
      <p>Impossible de charger les séances.</p>
      <button onclick="loadSessions()">Réessayer</button>
    `;
  }
}


async function addSessionForSubject(event) {
  event.preventDefault();

  if (!currentStudent) {
    alert("Aucun élève sélectionné.");
    return;
  }

  const form = event.target;
  const formData = new FormData(form);

  const subject = String(formData.get("subject") || "").trim();
  const date = String(formData.get("date") || "");
  const duration = Number(formData.get("duration_minutes"));

  if (!subject || !date) {
    alert("Merci de renseigner la matière et la date.");
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("Sessions")
      .insert([{
        student_id: currentStudent.id,
        subject,
        date,
        duration_minutes: Number.isFinite(duration) ? duration : null
      }]);

    if (error) throw error;

    alert("Séance ajoutée avec succès.");
    showSessions();
  } catch (error) {
    console.error("Erreur lors de l'ajout de la séance :", error);
    alert("Impossible d'ajouter la séance. Vérifie les données et les autorisations.");
  }
}


async function showSubjectSessions(subject) {
  if (!currentStudent) {
    showDashboard();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("Sessions")
      .select("*")
      .eq("student_id", currentStudent.id)
      .eq("subject", subject)
      .order("date", { ascending: false });

    if (error) throw error;

    app().innerHTML = `
      <div class="dashboard">
        <div class="topbar">
          <h1>${escapeHTML(subject)}</h1>
          <button onclick="showSessions()">Retour aux séances</button>
        </div>

        <section class="card">
          ${
            data && data.length
              ? data.map(session => `
                <article class="session-item card">
                  <h3>${escapeHTML(formatDate(session.date))}</h3>
                  <p>
                    Durée :
                    ${session.duration_minutes != null
                      ? escapeHTML(formatDuration(session.duration_minutes))
                      : "Non renseignée"}
                  </p>
                  <button onclick="showSession('${session.id}')">
                    Ouvrir
                  </button>
                </article>
              `).join("")
              : "<p>Aucune séance pour cette matière.</p>"
          }
        </section>
      </div>
    `;
  } catch (error) {
    console.error("Erreur lors du chargement des séances par matière :", error);
    alert("Impossible de charger les séances de cette matière.");
  }
}


async function showSession(sessionId) {
  try {
    const { data: session, error } = await supabaseClient
      .from("Sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error) throw error;

    if (!session) {
      alert("Séance introuvable.");
      return;
    }

    app().innerHTML = `
      <div class="dashboard">
        <div class="topbar">
          <h1>Séance du escapeHTML(formatDate(session.date)){
            session.duration_minutes != null
              ? ` — ${escapeHTML(formatDuration(session.duration_minutes))}`
              : ""
          }</h1>

          <button onclick="showSessions()">Retour aux séances</button>
        </div>

        <section class="card">
          <p>
            <strong>Matière :</strong>
            ${escapeHTML(session.subject || "Non renseignée")}
          </p>

          <p>
            <strong>Date :</strong>
            ${escapeHTML(formatDate(session.date))}
          </p>

          <p>
            <strong>Durée :</strong>
            ${session.duration_minutes != null
              ? escapeHTML(formatDuration(session.duration_minutes))
              : "Non renseignée"}
          </p>

          <button onclick="showSessionSummary('${session.id}')">
            Voir le résumé
          </button>

          <button onclick="showSessionConclusion('${session.id}')">
            Voir la conclusion
          </button>

          <button onclick="editSession('${session.id}')">
            Modifier la séance
          </button>
        </section>
      </div>
    `;
  } catch (error) {
    console.error("Erreur lors de l'ouverture de la séance :", error);
    alert("Impossible d'ouvrir cette séance.");
  }
}


async function showSessionSummary(sessionId) {
  try {
    const { data: session, error } = await supabaseClient
      .from("Sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error) throw error;

    app().innerHTML = `
      <div class="dashboard">
        <div class="topbar">
          <h1>Résumé de la séance</h1>
          <button onclick="showSession('${session.id}')">Retour</button>
        </div>

        <section class="card">
          <h2>${escapeHTML(session.subject || "Séance")}</h2>

          <p>
            ${escapeHTML(
              session.summary ||
              session.resume ||
              "Aucun résumé n'a encore été renseigné."
            )}
          </p>
        </section>
      </div>
    `;
  } catch (error) {
    console.error("Erreur lors du chargement du résumé :", error);
    alert("Impossible de charger le résumé.");
  }
}


async function showSessionConclusion(sessionId) {
  try {
    const { data: session, error } = await supabaseClient
      .from("Sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error) throw error;

    app().innerHTML = `
      <div class="dashboard">
        <div class="topbar">
          <h1>Conclusion de la séance</h1>
          <button onclick="showSession('${session.id}')">Retour</button>
        </div>

        <section class="card">
          <h2>${escapeHTML(session.subject || "Séance")}</h2>

          <p>
            ${escapeHTML(
              session.conclusion ||
              "Aucune conclusion n'a encore été renseignée."
            )}
          </p>
        </section>
      </div>
    `;
  } catch (error) {
    console.error("Erreur lors du chargement de la conclusion :", error);
    alert("Impossible de charger la conclusion.");
  }
}


async function addSession() {
  if (!currentStudent) {
    alert("Aucun élève sélectionné.");
    return;
  }

  const subject = prompt("Matière de la séance :");
  if (subject === null || !subject.trim()) return;

  const date = prompt(
    "Date de la séance (AAAA-MM-JJ) :",
    new Date().toISOString().slice(0, 10)
  );

  if (date === null || !date.trim()) return;

  const durationInput = prompt("Durée en minutes :", "60");
  if (durationInput === null) return;

  const duration = Number(durationInput);

  if (!Number.isFinite(duration) || duration < 0) {
    alert("La durée doit être un nombre positif ou nul.");
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("Sessions")
      .insert([{
        student_id: currentStudent.id,
        subject: subject.trim(),
        date: date.trim(),
        duration_minutes: duration
      }]);

    if (error) throw error;

    alert("Séance ajoutée.");
    showSessions();
  } catch (error) {
    console.error("Erreur lors de l'ajout de la séance :", error);
    alert("Impossible d'ajouter la séance.");
  }
}


async function saveSession(sessionId, updates) {
  try {
    const { error } = await supabaseClient
      .from("Sessions")
      .update(updates)
      .eq("id", sessionId);

    if (error) throw error;

    alert("Séance enregistrée.");
    showSession(sessionId);
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la séance :", error);
    alert("Impossible d'enregistrer la séance.");
  }
}


async function editSession(sessionId) {
  try {
    const { data: session, error } = await supabaseClient
      .from("Sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error) throw error;

    const subject = prompt("Matière :", session.subject || "");
    if (subject === null) return;

    const date = prompt("Date (AAAA-MM-JJ) :", session.date || "");
    if (date === null) return;

    const durationInput = prompt(
      "Durée en minutes :",
      session.duration_minutes == null
        ? "60"
        : String(session.duration_minutes)
    );

    if (durationInput === null) return;

    const duration = Number(durationInput);

    if (!subject.trim() || !date.trim()) {
      alert("La matière et la date sont obligatoires.");
      return;
    }

    if (!Number.isFinite(duration) || duration < 0) {
      alert("La durée doit être un nombre positif ou nul.");
      return;
    }

    await saveSession(sessionId, {
      subject: subject.trim(),
      date: date.trim(),
      duration_minutes: duration
    });
  } catch (error) {
    console.error("Erreur lors de la modification de la séance :", error);
    alert("Impossible de modifier cette séance.");
  }
}


async function saveEditedSession(sessionId, updates) {
  await saveSession(sessionId, updates);
}


async function deleteSession(sessionId) {
  if (!confirm("Voulez-vous vraiment supprimer cette séance ?")) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("Sessions")
      .delete()
      .eq("id", sessionId);

    if (error) throw error;

    alert("Séance supprimée.");
    showSessions();
  } catch (error) {
    console.error("Erreur lors de la suppression de la séance :", error);
    alert("Impossible de supprimer cette séance.");
  }
}


/*
 * La table ou le système de stockage des documents PDF n'étant
 * pas défini dans le script fourni, cette fonction évite une
 * erreur lorsque l'utilisateur clique sur « Documents PDF ».
 */
function showAllSubjectDocuments() {
  app().innerHTML = `
    <div class="dashboard">
      <div class="topbar">
        <h1>Documents PDF</h1>
        <button onclick="showSessions()">Retour aux séances</button>
      </div>

      <section class="card">
        <p>
          La section Documents PDF n'est pas encore configurée.
          Le stockage et la liste des documents devront être reliés
          à leur table ou espace de stockage.
        </p>
      </section>
    </div>
  `;
}


/* =========================================================
   PARTIE 4/5 — NOTES ET PROGRÈS
   ========================================================= */

/* ---------- GESTION DES NOTES ---------- */

async function showNotes() {
  if (!currentStudent) {
    showDashboard();
    return;
  }

  app().innerHTML = `
    <div class="dashboard">
      <div class="topbar">
        <h1>Notes de ${escapeHTML(currentStudent.name)}</h1>
        <button onclick="renderStudentPage()">Retour à l'élève</button>
      </div>

      <section class="card">
        <h2>Ajouter une note</h2>

        <form onsubmit="addNote(event)">
          <label for="note-subject">Matière</label>
          <input
            id="note-subject"
            name="subject"
            type="text"
            required
            placeholder="Ex. : Français"
          >

          <label for="note-value">Note obtenue</label>
          <input
            id="note-value"
            name="grade"
            type="text"
            required
            placeholder="Ex. : 15/20"
          >

          <label for="note-date">Date</label>
          <input
            id="note-date"
            name="date"
            type="date"
            required
            value="${new Date().toISOString().slice(0, 10)}"
          >

          <label for="note-comment">Commentaire</label>
          <textarea
            id="note-comment"
            name="comment"
            placeholder="Commentaire facultatif"
          ></textarea>

          <button type="submit">Enregistrer la note</button>
        </form>
      </section>

      <section class="card">
        <h2>Notes enregistrées</h2>
        <div id="notes-list">Chargement des notes...</div>
      </section>
    </div>
  `;

  await loadNotes();
}


async function loadNotes() {
  const list = document.getElementById("notes-list");

  if (!list || !currentStudent) return;

  try {
    const { data, error } = await supabaseClient
      .from("Notes")
      .select("*")
      .eq("student_id", currentStudent.id)
      .order("date", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML = "<p>Aucune note enregistrée.</p>";
      return;
    }

    list.innerHTML = data.map(note => `
      <article class="card">
        <h3>${escapeHTML(note.subject || "Matière non renseignée")}</h3>

        <p>
          <strong>Note :</strong>
          ${escapeHTML(normalizeGrade(note.grade))}
        </p>

        <p>
          <strong>Date :</strong>
          ${escapeHTML(formatDate(note.date))}
        </p>

        <p>
          <strong>Commentaire :</strong>
          ${escapeHTML(note.comment || "Aucun commentaire")}
        </p>

        <button onclick="editNote('${note.id}')">Modifier</button>
        <button onclick="deleteNote('${note.id}')">Supprimer</button>
      </article>
    `).join("");
  } catch (error) {
    console.error("Erreur lors du chargement des notes :", error);
    list.innerHTML = `
      <p>Impossible de charger les notes.</p>
      <button onclick="loadNotes()">Réessayer</button>
    `;
  }
}


async function addNote(event) {
  event.preventDefault();

  if (!currentStudent) {
    alert("Aucun élève sélectionné.");
    return;
  }

  const formData = new FormData(event.target);

  const subject = String(formData.get("subject") || "").trim();
  const grade = String(formData.get("grade") || "").trim();
  const date = String(formData.get("date") || "");
  const comment = String(formData.get("comment") || "").trim();

  if (!subject || !grade || !date) {
    alert("Merci de remplir la matière, la note et la date.");
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("Notes")
      .insert([{
        student_id: currentStudent.id,
        subject,
        grade: normalizeGrade(grade),
        date,
        comment
      }]);

    if (error) throw error;

    alert("Note enregistrée.");
    showNotes();
  } catch (error) {
    console.error("Erreur lors de l'ajout de la note :", error);
    alert("Impossible d'enregistrer la note. Vérifie les champs et les autorisations.");
  }
}


async function editNote(noteId) {
  try {
    const { data: note, error } = await supabaseClient
      .from("Notes")
      .select("*")
      .eq("id", noteId)
      .single();

    if (error) throw error;

    const subject = prompt("Matière :", note.subject || "");
    if (subject === null) return;

    const grade = prompt("Note obtenue :", note.grade || "");
    if (grade === null) return;

    const date = prompt("Date (AAAA-MM-JJ) :", note.date || "");
    if (date === null) return;

    const comment = prompt("Commentaire :", note.comment || "");
    if (comment === null) return;

    if (!subject.trim() || !grade.trim() || !date.trim()) {
      alert("La matière, la note et la date sont obligatoires.");
      return;
    }

    const { error: updateError } = await supabaseClient
      .from("Notes")
      .update({
        subject: subject.trim(),
        grade: normalizeGrade(grade.trim()),
        date: date.trim(),
        comment: comment.trim()
      })
      .eq("id", noteId);

    if (updateError) throw updateError;

    alert("Note modifiée.");
    showNotes();
  } catch (error) {
    console.error("Erreur lors de la modification de la note :", error);
    alert("Impossible de modifier cette note.");
  }
}


async function deleteNote(noteId) {
  if (!confirm("Voulez-vous vraiment supprimer cette note ?")) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("Notes")
      .delete()
      .eq("id", noteId);

    if (error) throw error;

    alert("Note supprimée.");
    showNotes();
  } catch (error) {
    console.error("Erreur lors de la suppression de la note :", error);
    alert("Impossible de supprimer cette note.");
  }
}


/* ---------- SUIVI DES PROGRÈS ---------- */

async function showProgress() {
  if (!currentStudent) {
    showDashboard();
    return;
  }

  app().innerHTML = `
    <div class="dashboard">
      <div class="topbar">
        <h1>Progrès de ${escapeHTML(currentStudent.name)}</h1>
        <button onclick="renderStudentPage()">Retour à l'élève</button>
      </div>

      <section class="card">
        <h2>Ajouter un suivi de progrès</h2>

        <form onsubmit="addProgress(event)">
          <label for="progress-subject">Matière</label>
          <input
            id="progress-subject"
            name="subject"
            type="text"
            required
            placeholder="Ex. : Mathématiques"
          >

          <label for="progress-date">Date</label>
          <input
            id="progress-date"
            name="date"
            type="date"
            required
            value="${new Date().toISOString().slice(0, 10)}"
          >

          <label for="progress-description">Progrès constatés</label>
          <textarea
            id="progress-description"
            name="description"
            required
            placeholder="Décris les progrès observés..."
          ></textarea>

          <button type="submit">Enregistrer le progrès</button>
        </form>
      </section>

      <section class="card">
        <h2>Historique des progrès</h2>
        <div id="progress-list">Chargement des progrès...</div>
      </section>
    </div>
  `;

  await loadProgress();
}


async function loadProgress() {
  const list = document.getElementById("progress-list");

  if (!list || !currentStudent) return;

  try {
    const { data, error } = await supabaseClient
      .from("Progress")
      .select("*")
      .eq("student_id", currentStudent.id)
      .order("date", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML = "<p>Aucun progrès enregistré pour le moment.</p>";
      return;
    }

    list.innerHTML = data.map(progress => `
      <article class="card">
        <h3>${escapeHTML(progress.subject || "Matière non renseignée")}</h3>

        <p>
          <strong>Date :</strong>
          ${escapeHTML(formatDate(progress.date))}
        </p>

        <p>
          ${escapeHTML(progress.description || progress.notes || "Aucune description")}
        </p>

        <button onclick="editProgress('${progress.id}')">Modifier</button>
        <button onclick="deleteProgress('${progress.id}')">Supprimer</button>
      </article>
    `).join("");
  } catch (error) {
    console.error("Erreur lors du chargement des progrès :", error);
    list.innerHTML = `
      <p>Impossible de charger les progrès.</p>
      <button onclick="loadProgress()">Réessayer</button>
    `;
  }
}


async function addProgress(event) {
  event.preventDefault();

  if (!currentStudent) {
    alert("Aucun élève sélectionné.");
    return;
  }

  const formData = new FormData(event.target);

  const subject = String(formData.get("subject") || "").trim();
  const date = String(formData.get("date") || "");
  const description = String(formData.get("description") || "").trim();

  if (!subject || !date || !description) {
    alert("Merci de remplir tous les champs obligatoires.");
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("Progress")
      .insert([{
        student_id: currentStudent.id,
        subject,
        date,
        description
      }]);

    if (error) throw error;

    alert("Progrès enregistré.");
    showProgress();
  } catch (error) {
    console.error("Erreur lors de l'ajout du progrès :", error);
    alert("Impossible d'enregistrer ce progrès.");
  }
}


async function editProgress(progressId) {
  try {
    const { data: progress, error } = await supabaseClient
      .from("Progress")
      .select("*")
      .eq("id", progressId)
      .single();

    if (error) throw error;

    const subject = prompt("Matière :", progress.subject || "");
    if (subject === null) return;

    const date = prompt("Date (AAAA-MM-JJ) :", progress.date || "");
    if (date === null) return;

    const description = prompt(
      "Progrès constatés :",
      progress.description || progress.notes || ""
    );

    if (description === null) return;

    if (!subject.trim() || !date.trim() || !description.trim()) {
      alert("Tous les champs sont obligatoires.");
      return;
    }

    const { error: updateError } = await supabaseClient
      .from("Progress")
      .update({
        subject: subject.trim(),
        date: date.trim(),
        description: description.trim()
      })
      .eq("id", progressId);

    if (updateError) throw updateError;

    alert("Progrès modifié.");
    showProgress();
  } catch (error) {
    console.error("Erreur lors de la modification du progrès :", error);
    alert("Impossible de modifier ce progrès.");
  }
}


async function deleteProgress(progressId) {
  if (!confirm("Voulez-vous vraiment supprimer ce suivi de progrès ?")) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("Progress")
      .delete()
      .eq("id", progressId);

    if (error) throw error;

    alert("Suivi de progrès supprimé.");
    showProgress();
  } catch (error) {
    console.error("Erreur lors de la suppression du progrès :", error);
    alert("Impossible de supprimer ce suivi.");
  }
}


/* =========================================================
   PARTIE 5/5 — DIFFICULTÉS, DÉCONNEXION ET DÉMARRAGE
   ========================================================= */

/* ---------- GESTION DES DIFFICULTÉS ---------- */

async function showDifficulties() {
  if (!currentStudent) {
    showDashboard();
    return;
  }

  app().innerHTML = `
    <div class="dashboard">
      <div class="topbar">
        <h1>Difficultés de ${escapeHTML(currentStudent.name)}</h1>
        <button onclick="renderStudentPage()">Retour à l'élève</button>
      </div>

      <section class="card">
        <h2>Ajouter une difficulté</h2>

        <form onsubmit="addDifficulty(event)">
          <label for="difficulty-subject">Matière</label>
          <input
            id="difficulty-subject"
            name="subject"
            type="text"
            required
            placeholder="Ex. : Français"
          >

          <label for="difficulty-description">Description</label>
          <textarea
            id="difficulty-description"
            name="description"
            required
            placeholder="Décris la difficulté rencontrée..."
          ></textarea>

          <label for="difficulty-date">Date</label>
          <input
            id="difficulty-date"
            name="date"
            type="date"
            required
            value="${new Date().toISOString().slice(0, 10)}"
          >

          <button type="submit">Enregistrer la difficulté</button>
        </form>
      </section>

      <section class="card">
        <h2>Difficultés enregistrées</h2>
        <div id="difficulties-list">Chargement des difficultés...</div>
      </section>
    </div>
  `;

  await loadDifficulties();
}


async function loadDifficulties() {
  const list = document.getElementById("difficulties-list");

  if (!list || !currentStudent) return;

  try {
    const { data, error } = await supabaseClient
      .from("Difficulties")
      .select("*")
      .eq("student_id", currentStudent.id)
      .order("date", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML = "<p>Aucune difficulté enregistrée.</p>";
      return;
    }

    list.innerHTML = data.map(difficulty => `
      <article class="card">
        <h3>${escapeHTML(difficulty.subject || "Matière non renseignée")}</h3>

        <p>
          <strong>Date :</strong>
          ${escapeHTML(formatDate(difficulty.date))}
        </p>

        <p>
          ${escapeHTML(
            difficulty.description ||
            difficulty.notes ||
            "Aucune description"
          )}
        </p>

        <button onclick="editDifficulty('${difficulty.id}')">
          Modifier
        </button>

        <button onclick="deleteDifficulty('${difficulty.id}')">
          Supprimer
        </button>
      </article>
    `).join("");
  } catch (error) {
    console.error("Erreur lors du chargement des difficultés :", error);

    list.innerHTML = `
      <p>Impossible de charger les difficultés.</p>
      <button onclick="loadDifficulties()">Réessayer</button>
    `;
  }
}


async function addDifficulty(event) {
  event.preventDefault();

  if (!currentStudent) {
    alert("Aucun élève sélectionné.");
    return;
  }

  const formData = new FormData(event.target);

  const subject = String(formData.get("subject") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const date = String(formData.get("date") || "");

  if (!subject || !description || !date) {
    alert("Merci de remplir tous les champs obligatoires.");
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("Difficulties")
      .insert([{
        student_id: currentStudent.id,
        subject,
        description,
        date
      }]);

    if (error) throw error;

    alert("Difficulté enregistrée.");
    showDifficulties();
  } catch (error) {
    console.error("Erreur lors de l'ajout de la difficulté :", error);
    alert("Impossible d'enregistrer cette difficulté.");
  }
}


async function editDifficulty(difficultyId) {
  try {
    const { data: difficulty, error } = await supabaseClient
      .from("Difficulties")
      .select("*")
      .eq("id", difficultyId)
      .single();

    if (error) throw error;

    const subject = prompt(
      "Matière :",
      difficulty.subject || ""
    );

    if (subject === null) return;

    const description = prompt(
      "Description :",
      difficulty.description || difficulty.notes || ""
    );

    if (description === null) return;

    const date = prompt(
      "Date (AAAA-MM-JJ) :",
      difficulty.date || ""
    );

    if (date === null) return;

    if (!subject.trim() || !description.trim() || !date.trim()) {
      alert("Tous les champs sont obligatoires.");
      return;
    }

    const { error: updateError } = await supabaseClient
      .from("Difficulties")
      .update({
        subject: subject.trim(),
        description: description.trim(),
        date: date.trim()
      })
      .eq("id", difficultyId);

    if (updateError) throw updateError;

    alert("Difficulté modifiée.");
    showDifficulties();
  } catch (error) {
    console.error("Erreur lors de la modification de la difficulté :", error);
    alert("Impossible de modifier cette difficulté.");
  }
}


async function deleteDifficulty(difficultyId) {
  if (!confirm("Voulez-vous vraiment supprimer cette difficulté ?")) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("Difficulties")
      .delete()
      .eq("id", difficultyId);

    if (error) throw error;

    alert("Difficulté supprimée.");
    showDifficulties();
  } catch (error) {
    console.error("Erreur lors de la suppression de la difficulté :", error);
    alert("Impossible de supprimer cette difficulté.");
  }
}


/* ---------- DÉCONNEXION ---------- */

async function logout() {
  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) throw error;

    currentStudent = null;
    showHome();
  } catch (error) {
    console.error("Erreur lors de la déconnexion :", error);
    alert("La déconnexion a échoué. Réessaie.");
  }
}


/* ---------- DÉMARRAGE DE L'APPLICATION ---------- */

async function startApp() {
  try {
    if (typeof supabase === "undefined") {
      throw new Error(
        "La bibliothèque Supabase n'a pas été chargée. Vérifie le script CDN dans ton fichier HTML."
      );
    }

    if (typeof supabaseClient === "undefined" || !supabaseClient) {
      throw new Error("Le client Supabase n'est pas initialisé.");
    }

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    const session = data?.session;

    if (!session) {
      showHome();
      return;
    }

    const { data: teacher, error: teacherError } = await supabaseClient
      .from("Teachers")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (teacherError) throw teacherError;

    if (teacher) {
      currentTeacher = teacher;
      showDashboard();
    } else {
      showHome();
    }
  } catch (error) {
    console.error("Erreur au démarrage de l'application :", error);

    const root = document.getElementById("app");

    if (root) {
      root.innerHTML = `
        <div class="dashboard">
          <section class="card">
            <h1>Impossible de démarrer l'application</h1>

            <p>
              Une erreur est survenue lors de la connexion au service.
              Vérifie ta connexion Internet et la configuration Supabase.
            </p>

            <button onclick="startApp()">Réessayer</button>

            <button onclick="showHome()">Retour à l'accueil</button>
          </section>
        </div>
      `;
    }
  }
}


/* ---------- LANCEMENT ---------- */

document.addEventListener("DOMContentLoaded", () => {
  startApp();
});


