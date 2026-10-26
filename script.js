
/* =========================================================
   NSK ÉDUCATION — FICHES ÉLÈVES, SÉANCES ET PDF
   Supabase + GitHub Pages
   ========================================================= */

const SUPABASE_URL = "https://hztywwjrjkihivupcmad.supabase.co";
const SUPABASE_KEY = "sb_publishable_am_wEiQkh4F-9VhIUC0LFg_zux-_jgu";

const BUCKET = "lesson-pdfs";
const DOCS_TABLE = "lessons-documents";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById("app");

let currentUser = null;
let students = [];
let lessons = [];
let documents = [];
let selectedStudent = null;
let editingStudentId = null;
let editingLessonId = null;

/* ======================= OUTILS ======================= */

const $ = id => document.getElementById(id);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function dateFR(value) {
  if (!value) return "Date non renseignée";
  const d = new Date(value + "T00:00:00");
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("fr-FR");
}

function errorText(error) {
  const message = error?.message || "Une erreur inconnue est survenue.";
  if (/row-level security|permission denied|not allowed/i.test(message)) {
    return "Accès refusé par Supabase. Vérifie les autorisations des tables et du stockage.";
  }
  if (/column .*student_id|student_id.*does not exist/i.test(message)) {
    return "La colonne student_id manque dans la table lessons. Consulte l'étape 2.";
  }
  return message;
}

function message(text, type = "info") {
  const box = $("message");
  if (!box) {
    alert(text);
    return;
  }
  box.textContent = text;
  box.className = "alert " + type;
  box.classList.remove("hidden");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  if (label) button.textContent = label;
}

/* ======================= CONNEXION ======================= */

function showLogin() {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-box">
        <h1>NSK Éducation</h1>
        <p>Bienvenue dans ton espace enseignant.</p>
        <form id="login-form">
          <div class="form-group">
            <label for="email">Adresse e-mail</label>
            <input id="email" type="email" autocomplete="email" required>
          </div>
          <div class="form-group">
            <label for="password">Mot de passe</label>
            <input id="password" type="password"
              autocomplete="current-password" required>
          </div>
          <p id="login-error" class="error-text"></p>
          <button id="login-button" type="submit">Se connecter</button>
        </form>
        <button id="signup-button" class="secondary w-full mt-2" type="button">
          Créer un compte
        </button>
        <button id="forgot-button" class="link-button w-full" type="button">
          Mot de passe oublié ?
        </button>
      </section>
    </main>`;

  $("login-form").addEventListener("submit", login);
  $("signup-button").addEventListener("click", signup);
  $("forgot-button").addEventListener("click", resetPassword);
}

async function login(event) {
  event.preventDefault();
  const button = $("login-button");
  setBusy(button, true, "Connexion...");

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });
    if (error) throw error;
    currentUser = data.user;
    await showDashboard();
  } catch (error) {
    $("login-error").textContent = errorText(error);
  } finally {
    if ($("login-button")) {
      setBusy($("login-button"), false, "Se connecter");
    }
  }
}

async function signup() {
  const email = prompt("Ton adresse e-mail :");
  if (!email) return;
  const password = prompt("Choisis un mot de passe d'au moins 8 caractères :");
  if (!password) return;

  if (password.length < 8) {
    alert("Le mot de passe doit contenir au moins 8 caractères.");
    return;
  }

  try {
    const { data, error } = await db.auth.signUp({
      email: email.trim(),
      password
    });
    if (error) throw error;

    if (data.session && data.user) {
      currentUser = data.user;
      await showDashboard();
    } else {
      alert("Compte créé. Vérifie tes e-mails si une confirmation est demandée.");
    }
  } catch (error) {
    alert("Création impossible : " + errorText(error));
  }
}

async function resetPassword() {
  const email = prompt("Adresse e-mail de ton compte :");
  if (!email) return;

  try {
    const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin
    });
    if (error) throw error;
    alert("Si cette adresse correspond à un compte, un e-mail sera envoyé.");
  } catch (error) {
    alert(errorText(error));
  }
}

async function logout() {
  const { error } = await db.auth.signOut();
  if (error) {
    message(errorText(error), "error");
    return;
  }

  currentUser = null;
  students = [];
  lessons = [];
  documents = [];
  selectedStudent = null;
  showLogin();
}

/* ======================= TABLEAU DE BORD ======================= */

async function showDashboard() {
  if (!currentUser) return showLogin();

  selectedStudent = null;

  app.innerHTML = `
    <div class="dashboard">
      <header class="topbar">
        <div class="topbar-brand">
          <div class="topbar-logo">NSK</div>
          <span>NSK Éducation</span>
        </div>
        <button id="logout-button" class="secondary" type="button">
          Déconnexion
        </button>
      </header>

      <main class="dashboard-content">
        <div class="page-header">
          <div>
            <h1 class="page-title">Mon espace enseignant</h1>
            <p>${esc(currentUser.email || "")}</p>
          </div>
          <button id="add-student-button" type="button">+ Ajouter un élève</button>
        </div>

        <div id="message" class="hidden" role="status"></div>

        <section class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Élèves</div>
            <div id="student-count" class="stat-value">0</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Séances</div>
            <div id="lesson-count" class="stat-value">0</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">PDF</div>
            <div id="document-count" class="stat-value">0</div>
          </div>
        </section>

        <section id="students-section" class="card mt-3">
          <h2>Mes élèves</h2>
          <div class="form-group">
            <label for="student-search">Rechercher un élève</label>
            <input id="student-search" type="search"
              placeholder="Nom ou classe...">
          </div>
          <div id="students-container">Chargement des élèves...</div>
        </section>

        <section id="student-form-section" class="card mt-3 hidden">
          <h2 id="student-form-heading">Ajouter un élève</h2>
          <form id="student-form">
            <div class="form-group">
              <label for="student-name">Nom de l'élève</label>
              <input id="student-name" maxlength="150" required>
            </div>
            <div class="form-group">
              <label for="student-class">Classe</label>
              <input id="student-class" maxlength="100">
            </div>
            <div class="form-actions">
              <button id="save-student-button" type="submit">Enregistrer</button>
              <button id="cancel-student-button" class="secondary"
                type="button">Annuler</button>
            </div>
          </form>
        </section>

        <section id="student-profile" class="card mt-3 hidden">
          <button id="back-students-button" class="secondary" type="button">
            ← Retour aux élèves
          </button>
          <div id="student-profile-content" class="mt-3"></div>

          <div class="form-actions">
            <button id="profile-edit-button" class="secondary" type="button">
              Modifier l'élève
            </button>
            <button id="profile-add-lesson-button" type="button">
              + Ajouter une séance
            </button>
          </div>

          <hr>
          <h2>Ses séances</h2>
          <div id="student-lessons"></div>

          <hr>
          <h2>Ses documents PDF</h2>
          <div id="student-documents"></div>
        </section>

        <section id="lesson-form-section" class="card mt-3 hidden">
          <h2 id="lesson-form-heading">Ajouter une séance</h2>
          <form id="lesson-form">
            <div class="form-group">
              <label for="lesson-student">Élève concerné</label>
              <select id="lesson-student" required></select>
            </div>
            <div class="form-group">
              <label for="lesson-title">Titre de la séance</label>
              <input id="lesson-title" maxlength="200" required>
            </div>
            <div class="form-group">
              <label for="lesson-subject">Matière</label>
              <input id="lesson-subject" maxlength="150">
            </div>
            <div class="form-group">
              <label for="lesson-class">Classe</label>
              <input id="lesson-class" maxlength="100">
            </div>
            <div class="form-group">
              <label for="lesson-date">Date</label>
              <input id="lesson-date" type="date">
            </div>
            <div class="form-group">
              <label for="lesson-duration">Durée en minutes</label>
              <input id="lesson-duration" type="number" min="1" max="1440">
            </div>
            <div class="form-group">
              <label for="lesson-content">Contenu / résumé</label>
              <textarea id="lesson-content" rows="5"></textarea>
            </div>
            <div class="form-group">
              <label for="lesson-conclusion">Conclusion / bilan</label>
              <textarea id="lesson-conclusion" rows="3"></textarea>
            </div>
            <div class="form-actions">
              <button id="save-lesson-button" type="submit">
                Enregistrer la séance
              </button>
              <button id="cancel-lesson-button" class="secondary" type="button">
                Annuler
              </button>
            </div>
          </form>
        </section>

        <section id="document-form-section" class="card mt-3 hidden">
          <h2>Ajouter un PDF à cette séance</h2>
          <form id="document-form">
            <div class="form-group">
              <label for="document-lesson">Séance concernée</label>
              <select id="document-lesson" required></select>
            </div>
            <div class="form-group">
              <label for="document-type">Type de document</label>
              <input id="document-type" maxlength="100"
                placeholder="Cours, exercices, correction...">
            </div>
            <div class="form-group">
              <label for="document-file">Fichier PDF</label>
              <input id="document-file" type="file"
                accept="application/pdf,.pdf" required>
            </div>
            <div class="form-actions">
              <button id="upload-document-button" type="submit">
                Envoyer le PDF
              </button>
              <button id="cancel-document-button" class="secondary"
                type="button">Annuler</button>
            </div>
          </form>
        </section>
      </main>
    </div>`;

  $("logout-button").addEventListener("click", logout);
  $("add-student-button").addEventListener("click", () => openStudentForm());
  $("student-form").addEventListener("submit", saveStudent);
  $("cancel-student-button").addEventListener("click", closeStudentForm);
  $("student-search").addEventListener("input", renderStudents);
  $("back-students-button").addEventListener("click", backToStudents);
  $("profile-edit-button").addEventListener("click", () =>
    openStudentForm(selectedStudent));
  $("profile-add-lesson-button").addEventListener("click", () =>
    openLessonForm(null, selectedStudent?.id));
  $("lesson-form").addEventListener("submit", saveLesson);
  $("cancel-lesson-button").addEventListener("click", closeLessonForm);
  $("document-form").addEventListener("submit", uploadDocument);
  $("cancel-document-button").addEventListener("click", closeDocumentForm);

  await Promise.all([loadStudents(), loadLessons(), loadDocuments()]);
}

/* ======================= ÉLÈVES ======================= */

async function loadStudents() {
  try {
    const { data, error } = await db.from("Students")
      .select("id, name, class")
      .order("name", { ascending: true });

    if (error) throw error;

    students = data || [];
    $("student-count").textContent = students.length;
    renderStudents();
    updateStudentSelect();
  } catch (error) {
    $("students-container").innerHTML =
      `<p class="error-text">${esc(errorText(error))}</p>`;
  }
}

function renderStudents() {
  const container = $("students-container");
  if (!container) return;

  const search = ($("student-search")?.value || "").toLowerCase().trim();
  const filtered = students.filter(s =>
    String(s.name || "").toLowerCase().includes(search) ||
    String(s.class || "").toLowerCase().includes(search)
  );

  if (!filtered.length) {
    container.innerHTML = `<p>Aucun élève trouvé.</p>`;
    return;
  }

  container.innerHTML = `<div class="students-grid">
    ${filtered.map(s => `
      <article class="student-card">
        <button type="button" class="student-open"
          data-open-student="${esc(s.id)}">
          <h3>${esc(s.name)}</h3>
          <p>Classe : ${esc(s.class || "Non renseignée")}</p>
          <p>Ouvrir la fiche →</p>
        </button>
        <div class="student-menu">
          <button class="secondary" type="button"
            data-edit-student="${esc(s.id)}">Modifier</button>
          <button class="danger" type="button"
            data-delete-student="${esc(s.id)}">Supprimer</button>
        </div>
      </article>`).join("")}
  </div>`;

  container.querySelectorAll("[data-open-student]").forEach(button => {
    button.addEventListener("click", () => {
      const student = students.find(s =>
        String(s.id) === button.dataset.openStudent);
      if (student) openStudentProfile(student);
    });
  });

  container.querySelectorAll("[data-edit-student]").forEach(button => {
    button.addEventListener("click", () => {
      const student = students.find(s =>
        String(s.id) === button.dataset.editStudent);
      if (student) openStudentForm(student);
    });
  });

  container.querySelectorAll("[data-delete-student]").forEach(button => {
    button.addEventListener("click", () => deleteStudent(button.dataset.deleteStudent));
  });
}

function openStudentForm(student = null) {
  editingStudentId = student?.id ?? null;
  $("student-form-heading").textContent =
    student ? "Modifier l'élève" : "Ajouter un élève";
  $("student-name").value = student?.name || "";
  $("student-class").value = student?.class || "";
  $("student-form-section").classList.remove("hidden");
  $("student-form-section").scrollIntoView({ behavior: "smooth" });
}

function closeStudentForm() {
  $("student-form").reset();
  editingStudentId = null;
  $("student-form-section").classList.add("hidden");
}

async function saveStudent(event) {
  event.preventDefault();

  const button = $("save-student-button");
  const name = $("student-name").value.trim();
  const studentClass = $("student-class").value.trim();

  if (!name) return message("Le nom est obligatoire.", "error");

  setBusy(button, true, "Enregistrement...");

  try {
    const values = { name, class: studentClass || null };
    const query = editingStudentId !== null
      ? db.from("Students").update(values).eq("id", editingStudentId)
      : db.from("Students").insert(values);

    const { error } = await query;
    if (error) throw error;

    closeStudentForm();
    await loadStudents();

    if (selectedStudent) {
      selectedStudent = students.find(s =>
        String(s.id) === String(selectedStudent.id)) || null;
      if (selectedStudent) await openStudentProfile(selectedStudent);
    }

    message("Élève enregistré.", "success");
  } catch (error) {
    message(errorText(error), "error");
  } finally {
    setBusy(button, false, "Enregistrer");
  }
}

async function deleteStudent(id) {
  const student = students.find(s => String(s.id) === String(id));
  if (!student || !confirm(`Supprimer ${student.name} ?`)) return;

  try {
    // Supabase refusera la suppression si des séances lui sont liées,
    // sauf si la base prévoit explicitement une suppression en cascade.
    const { error } = await db.from("Students").delete().eq("id", id);
    if (error) throw error;

    selectedStudent = null;
    $("student-profile").classList.add("hidden");
    await loadStudents();
    message("Élève supprimé.", "success");
  } catch (error) {
    message("Suppression impossible. Vérifie si cet élève possède des séances. " +
      errorText(error), "error");
  }
}

async function openStudentProfile(student) {
  selectedStudent = student;

  $("students-section").classList.add("hidden");
  $("student-form-section").classList.add("hidden");
  $("lesson-form-section").classList.add("hidden");
  $("document-form-section").classList.add("hidden");
  $("student-profile").classList.remove("hidden");

  $("student-profile-content").innerHTML = `
    <h1>${esc(student.name)}</h1>
    <p>Classe : ${esc(student.class || "Non renseignée")}</p>`;

  $("student-profile").scrollIntoView({ behavior: "smooth" });

  await renderStudentLessons();
}

function backToStudents() {
  selectedStudent = null;
  $("student-profile").classList.add("hidden");
  $("lesson-form-section").classList.add("hidden");
  $("document-form-section").classList.add("hidden");
  $("student-form-section").classList.add("hidden");
  $("students-section").classList.remove("hidden");
  renderStudents();
}

/* ======================= SÉANCES ======================= */

async function loadLessons() {
  try {
    const { data, error } = await db.from("lessons")
      .select("id, created_at, student_id, title, class, content, subject, duration_minutes, lesson_date, conclusion")
      .order("lesson_date", { ascending: false });

    if (error) throw error;

    lessons = data || [];
    $("lesson-count").textContent = lessons.length;
    updateLessonSelect();
    updateStudentSelect();

    if (selectedStudent) {
      await renderStudentLessons();
    }
  } catch (error) {
    $("lesson-count").textContent = "—";
    if ($("student-lessons")) {
      $("student-lessons").innerHTML =
        `<p class="error-text">${esc(errorText(error))}</p>`;
    }
  }
}

function updateStudentSelect() {
  const select = $("lesson-student");
  if (!select) return;

  const oldValue = select.value;
  select.innerHTML = `<option value="">Choisir un élève</option>` +
    students.map(s => `
      <option value="${esc(s.id)}">${esc(s.name)}</option>
    `).join("");

  if (students.some(s => String(s.id) === oldValue)) {
    select.value = oldValue;
  } else if (selectedStudent) {
    select.value = String(selectedStudent.id);
  }
}

function openLessonForm(lesson = null, studentId = null) {
  if (!students.length) {
    message("Ajoute d'abord un élève.", "error");
    return;
  }

  editingLessonId = lesson?.id ?? null;
  $("lesson-form-heading").textContent =
    lesson ? "Modifier la séance" : "Ajouter une séance";

  updateStudentSelect();

  $("lesson-student").value = String(
    lesson?.student_id ?? studentId ?? selectedStudent?.id ?? ""
  );
  $("lesson-title").value = lesson?.title || "";
  $("lesson-subject").value = lesson?.subject || "";
  $("lesson-class").value = lesson?.class || selectedStudent?.class || "";
  $("lesson-date").value = lesson?.lesson_date || "";
  $("lesson-duration").value = lesson?.duration_minutes || "";
  $("lesson-content").value = lesson?.content || "";
  $("lesson-conclusion").value = lesson?.conclusion || "";

  $("lesson-form-section").classList.remove("hidden");
  $("document-form-section").classList.add("hidden");
  $("lesson-form-section").scrollIntoView({ behavior: "smooth" });
}

function closeLessonForm() {
  $("lesson-form").reset();
  editingLessonId = null;
  $("lesson-form-section").classList.add("hidden");
}

async function saveLesson(event) {
  event.preventDefault();

  const button = $("save-lesson-button");
  const title = $("lesson-title").value.trim();
  const studentId = $("lesson-student").value;

  if (!studentId) return message("Choisis un élève.", "error");
  if (!title) return message("Le titre est obligatoire.", "error");

  const values = {
    student_id: studentId,
    title,
    subject: $("lesson-subject").value.trim() || null,
    class: $("lesson-class").value.trim() || null,
    lesson_date: $("lesson-date").value || null,
    duration_minutes: $("lesson-duration").value
      ? String($("lesson-duration").value) : null,
    content: $("lesson-content").value.trim() || null,
    conclusion: $("lesson-conclusion").value.trim() || null
  };

  setBusy(button, true, "Enregistrement...");

  try {
    const query = editingLessonId !== null
      ? db.from("lessons").update(values).eq("id", editingLessonId)
      : db.from("lessons").insert(values);

    const { error } = await query;
    if (error) throw error;

    const student = students.find(s => String(s.id) === String(studentId));
    closeLessonForm();
    await loadLessons();
    await loadDocuments();

    if (student) await openStudentProfile(student);
    message("Séance enregistrée.", "success");
  } catch (error) {
    message("Impossible d'enregistrer la séance : " + errorText(error), "error");
  } finally {
    setBusy(button, false, "Enregistrer la séance");
  }
}

async function renderStudentLessons() {
  const container = $("student-lessons");
  if (!container || !selectedStudent) return;

  const list = lessons.filter(l =>
    String(l.student_id) === String(selectedStudent.id)
  );

  if (!list.length) {
    container.innerHTML = `
      <p>Aucune séance enregistrée pour cet élève.</p>
      <p>Utilise « Ajouter une séance » pour commencer son suivi.</p>`;
    $("student-documents").innerHTML = "<p>Aucun document pour le moment.</p>";
    return;
  }

  container.innerHTML = list.map(lesson => `
    <article class="card mt-3">
      <h3>${esc(lesson.title)}</h3>
      <p><strong>Date :</strong> ${esc(dateFR(lesson.lesson_date))}</p>
      <p><strong>Matière :</strong> ${esc(lesson.subject || "Non renseignée")}</p>
      <p><strong>Durée :</strong> ${esc(lesson.duration_minutes || "Non renseignée")}${lesson.duration_minutes ? " min" : ""}</p>
      <p><strong>Contenu :</strong></p>
      <p>${esc(lesson.content || "Aucun résumé").replace(/\n/g, "<br>")}</p>
      <p><strong>Conclusion :</strong></p>
      <p>${esc(lesson.conclusion || "Aucune conclusion").replace(/\n/g, "<br>")}</p>
      <div class="form-actions">
        <button class="secondary" type="button"
          data-edit-lesson="${esc(lesson.id)}">Modifier</button>
        <button type="button" data-add-pdf="${esc(lesson.id)}">
          + Ajouter un PDF
        </button>
        <button class="danger" type="button"
          data-delete-lesson="${esc(lesson.id)}">Supprimer</button>
      </div>
    </article>`).join("");

  container.querySelectorAll("[data-edit-lesson]").forEach(button => {
    button.addEventListener("click", () => {
      const lesson = lessons.find(l =>
        String(l.id) === button.dataset.editLesson);
      if (lesson) openLessonForm(lesson);
    });
  });

  container.querySelectorAll("[data-add-pdf]").forEach(button => {
    button.addEventListener("click", () =>
      openDocumentForm(button.dataset.addPdf));
  });

  container.querySelectorAll("[data-delete-lesson]").forEach(button => {
    button.addEventListener("click", () =>
      deleteLesson(button.dataset.deleteLesson));
  });

  await renderStudentDocuments(list.map(l => l.id));
}

async function deleteLesson(id) {
  const lesson = lessons.find(l => String(l.id) === String(id));
  if (!lesson || !confirm(`Supprimer la séance « ${lesson.title} » et ses liens de documents ?`)) return;

  try {
    const relatedDocs = documents.filter(d =>
      String(d.lesson_id) === String(id));

    // Supprimer les fichiers du stockage puis leurs lignes de métadonnées.
    for (const doc of relatedDocs) {
      if (doc.file_path) {
        const { error } = await db.storage.from(BUCKET).remove([doc.file_path]);
        if (error) throw error;
      }
    }

    if (relatedDocs.length) {
      const { error } = await db.from(DOCS_TABLE).delete().eq("lesson_id", id);
      if (error) throw error;
    }

    const { error } = await db.from("lessons").delete().eq("id", id);
    if (error) throw error;

    await loadLessons();
    await loadDocuments();
    message("Séance supprimée.", "success");
  } catch (error) {
    message("Suppression impossible : " + errorText(error), "error");
  }
}

/* ======================= DOCUMENTS PDF ======================= */

async function loadDocuments() {
  try {
    const { data, error } = await db.from(DOCS_TABLE)
      .select("id, created_at, lesson_id, file_name, file_path, document_type, lesson_title")
      .order("created_at", { ascending: false });

    if (error) throw error;

    documents = data || [];
    $("document-count").textContent = documents.length;

    if (selectedStudent) {
      const studentLessons = lessons.filter(l =>
        String(l.student_id) === String(selectedStudent.id));
      await renderStudentDocuments(studentLessons.map(l => l.id));
    }
  } catch (error) {
    $("document-count").textContent = "—";
    if ($("student-documents")) {
      $("student-documents").innerHTML =
        `<p class="error-text">${esc(errorText(error))}</p>`;
    }
  }
}

async function renderStudentDocuments(lessonIds) {
  const container = $("student-documents");
  if (!container) return;

  const ids = new Set(lessonIds.map(String));
  const list = documents.filter(d => ids.has(String(d.lesson_id)));

  if (!list.length) {
    container.innerHTML = "<p>Aucun PDF associé aux séances de cet élève.</p>";
    return;
  }

  container.innerHTML = "<p>Chargement des liens PDF...</p>";

  const rows = await Promise.all(list.map(async doc => {
    let url = "";
    if (doc.file_path) {
      const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUrl(doc.file_path, 3600);
      if (!error) url = data?.signedUrl || "";
    }
    return { doc, url };
  }));

  container.innerHTML = rows.map(({ doc, url }) => `
    <article class="card mt-3">
      <h3>${esc(doc.file_name || "Document PDF")}</h3>
      <p><strong>Séance :</strong> ${esc(doc.lesson_title || "Séance")}</p>
      <p><strong>Type :</strong> ${esc(doc.document_type || "PDF")}</p>
      ${url
        ? `<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ouvrir le PDF</a></p>`
        : `<p class="error-text">Lien indisponible. Vérifie les droits du bucket.</p>`}
      <button class="danger" type="button"
        data-delete-document="${esc(doc.id)}">Supprimer le PDF</button>
    </article>`).join("");

  container.querySelectorAll("[data-delete-document]").forEach(button => {
    button.addEventListener("click", () =>
      deleteDocument(button.dataset.deleteDocument));
  });
}

function openDocumentForm(lessonId = null) {
  if (!selectedStudent) {
    message("Ouvre d'abord la fiche d'un élève.", "error");
    return;
  }

  const studentLessons = lessons.filter(l =>
    String(l.student_id) === String(selectedStudent.id));

  if (!studentLessons.length) {
    message("Ajoute d'abord une séance à cet élève.", "error");
    return;
  }

  $("document-form").reset();
  $("document-lesson").innerHTML = studentLessons.map(l => `
    <option value="${esc(l.id)}">${esc(l.title)} — ${esc(dateFR(l.lesson_date))}</option>
  `).join("");

  if (lessonId && studentLessons.some(l => String(l.id) === String(lessonId))) {
    $("document-lesson").value = String(lessonId);
  }

  $("document-form-section").classList.remove("hidden");
  $("document-form-section").scrollIntoView({ behavior: "smooth" });
}

function closeDocumentForm() {
  $("document-form").reset();
  $("document-form-section").classList.add("hidden");
}

async function uploadDocument(event) {
  event.preventDefault();

  const button = $("upload-document-button");
  const file = $("document-file").files[0];
  const lessonId = $("document-lesson").value;
  const type = $("document-type").value.trim();

  if (!file || !lessonId) {
    return message("Choisis une séance et un fichier PDF.", "error");
  }
  if (file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")) {
    return message("Seuls les fichiers PDF sont acceptés.", "error");
  }
  if (file.size > 20 * 1024 * 1024) {
    return message("Le fichier dépasse 20 Mo.", "error");
  }

  const lesson = lessons.find(l => String(l.id) === String(lessonId));
  if (!lesson || String(lesson.student_id) !== String(selectedStudent?.id)) {
    return message("Cette séance n'appartient pas à l'élève sélectionné.", "error");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${currentUser.id}/${lessonId}/${Date.now()}_${safeName}`;
  let uploaded = false;

  setBusy(button, true, "Envoi du PDF...");

  try {
    const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, {
      contentType: "application/pdf",
      upsert: false
    });
    if (uploadError) throw uploadError;
    uploaded = true;

    const { error: insertError } = await db.from(DOCS_TABLE).insert({
      lesson_id: lesson.id,
      file_name: file.name,
      file_path: path,
      document_type: type || "PDF",
      lesson_title: lesson.title
    });
    if (insertError) throw insertError;

    closeDocumentForm();
    await loadDocuments();
    message("PDF ajouté à la séance.", "success");
  } catch (error) {
    if (uploaded) {
      await db.storage.from(BUCKET).remove([path]);
    }
    message("Impossible d'ajouter le PDF : " + errorText(error), "error");
  } finally {
    setBusy(button, false, "Envoyer le PDF");
  }
}

async function deleteDocument(id) {
  const doc = documents.find(d => String(d.id) === String(id));
  if (!doc || !confirm(`Supprimer le PDF « ${doc.file_name} » ?`)) return;

  try {
    if (doc.file_path) {
      const { error } = await db.storage.from(BUCKET).remove([doc.file_path]);
      if (error) throw error;
    }

    const { error } = await db.from(DOCS_TABLE).delete().eq("id", id);
    if (error) throw error;

    await loadDocuments();
    message("PDF supprimé.", "success");
  } catch (error) {
    message("Suppression du PDF impossible : " + errorText(error), "error");
  }
}

/* ======================= DÉMARRAGE ======================= */

async function startApp() {
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;

    currentUser = data.session?.user || null;
    if (currentUser) await showDashboard();
    else showLogin();
  } catch (error) {
    app.innerHTML = `
      <main class="login-page">
        <section class="login-box">
          <h1>NSK Éducation</h1>
          <p class="error-text">${esc(errorText(error))}</p>
          <button type="button" onclick="location.reload()">Réessayer</button>
        </section>
      </main>`;
  }
}

startApp();
