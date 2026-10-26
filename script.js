
/* =========================================================
   NSK ÉDUCATION — ÉLÈVES, SÉANCES ET DOCUMENTS PDF
   ========================================================= */

const SUPABASE_URL = "https://hztywwjrjkihivupcmad.supabase.co";
const SUPABASE_KEY = "sb_publishable_am_wEiQkh4F-9VhIUC0LFg_zux-_jgu";

const STUDENTS_TABLE = "Students";
const LESSONS_TABLE = "Lessons";
const DOCUMENTS_TABLE = "Lessons_documents";
const DOCUMENTS_BUCKET = "lesson-pdfs";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById("app");

let currentUser = null;
let students = [];
let lessons = [];
let documents = [];
let selectedStudent = null;
let editingStudentId = null;
let editingLessonId = null;

/* ================= OUTILS ================= */

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function formatDate(value) {
  if (!value) return "Date non renseignée";
  const d = new Date(value + "T00:00:00");
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("fr-FR");
}

function showMessage(text, type = "info") {
  let box = document.getElementById("app-message");
  if (!box) {
    box = document.createElement("div");
    box.id = "app-message";
    box.setAttribute("role", "status");
    app.prepend(box);
  }
  box.className = "alert " + type;
  box.textContent = text;
}

function showError(error) {
  console.error(error);
  let text = error?.message || "Une erreur est survenue.";

  if (/row-level security|permission denied/i.test(text)) {
    text = "Accès refusé par Supabase. Vérifie les politiques d'accès.";
  } else if (/student_id/i.test(text)) {
    text += " Vérifie la colonne student_id de la table Lessons.";
  }

  showMessage(text, "error");
}

function hide(id) {
  document.getElementById(id)?.classList.add("hidden");
}

function reveal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

function closeForms() {
  hide("student-form-section");
  hide("lesson-form-section");
  hide("document-form-section");
}

/* ================= CONNEXION ================= */

function renderLogin() {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-box">
        <h1>NSK Éducation</h1>
        <p>Connecte-toi à ton espace enseignant.</p>

        <form id="login-form">
          <div class="form-group">
            <label for="login-email">Adresse e-mail</label>
            <input id="login-email" type="email"
              autocomplete="email" required>
          </div>
          <div class="form-group">
            <label for="login-password">Mot de passe</label>
            <input id="login-password" type="password"
              autocomplete="current-password" required>
          </div>
          <p id="login-error" class="error-text"></p>
          <button id="login-submit" type="submit">Se connecter</button>
        </form>

        <button id="signup-button" class="secondary w-full mt-2"
          type="button">Créer un compte</button>
        <button id="reset-button" class="link-button w-full"
          type="button">Mot de passe oublié ?</button>
      </section>
    </main>`;

  document.getElementById("login-form").addEventListener("submit", signIn);
  document.getElementById("signup-button").addEventListener("click", signUp);
  document.getElementById("reset-button").addEventListener("click", resetPassword);
}

async function signIn(event) {
  event.preventDefault();
  const button = document.getElementById("login-submit");
  button.disabled = true;
  button.textContent = "Connexion...";

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: document.getElementById("login-email").value.trim(),
      password: document.getElementById("login-password").value
    });
    if (error) throw error;
    currentUser = data.user;
    await renderDashboard();
  } catch (error) {
    document.getElementById("login-error").textContent =
      error.message || "Connexion impossible.";
  } finally {
    const b = document.getElementById("login-submit");
    if (b) {
      b.disabled = false;
      b.textContent = "Se connecter";
    }
  }
}

async function signUp() {
  const email = prompt("Adresse e-mail :");
  if (!email) return;

  const password = prompt("Choisis un mot de passe d'au moins 8 caractères :");
  if (!password) return;

  if (password.length < 8) {
    alert("Le mot de passe doit contenir au moins 8 caractères.");
    return;
  }

  try {
    const { data, error } = await db.auth.signUp({
      email: email.trim(), password
    });
    if (error) throw error;

    if (data.session) {
      currentUser = data.user;
      await renderDashboard();
    } else {
      alert("Compte créé. Vérifie tes e-mails si une confirmation est demandée.");
    }
  } catch (error) {
    alert(error.message || "Création du compte impossible.");
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
    alert("Si le compte existe, un e-mail sera envoyé.");
  } catch (error) {
    alert(error.message || "Envoi impossible.");
  }
}

async function signOut() {
  const { error } = await db.auth.signOut();
  if (error) return showError(error);

  currentUser = null;
  selectedStudent = null;
  renderLogin();
}

/* ================= TABLEAU DE BORD ================= */

async function renderDashboard() {
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
            <p>${esc(currentUser?.email || "")}</p>
          </div>
          <button id="add-student-button" type="button">
            + Ajouter un élève
          </button>
        </div>

        <div id="dashboard-message" role="status"></div>

        <section class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Élèves</div>
            <div class="stat-value" id="stat-students">0</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Séances</div>
            <div class="stat-value" id="stat-lessons">0</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Documents</div>
            <div class="stat-value" id="stat-documents">0</div>
          </div>
        </section>

        <section id="students-section" class="card mt-3">
          <h2>Mes élèves</h2>
          <div class="form-group">
            <label for="student-search">Rechercher un élève</label>
            <input id="student-search" type="search"
              placeholder="Nom ou classe...">
          </div>
          <div id="students-list">Chargement...</div>
        </section>

        <section id="student-form-section" class="card mt-3 hidden">
          <h2 id="student-form-title">Ajouter un élève</h2>
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
              <button id="save-student" type="submit">Enregistrer</button>
              <button id="cancel-student" class="secondary"
                type="button">Annuler</button>
            </div>
          </form>
        </section>

        <section id="student-profile" class="card mt-3 hidden">
          <button id="back-to-students" class="secondary" type="button">
            ← Retour aux élèves
          </button>
          <div id="student-details" class="mt-3"></div>
          <div class="form-actions">
            <button id="edit-profile" class="secondary" type="button">
              Modifier l'élève
            </button>
            <button id="new-lesson" type="button">
              + Ajouter une séance
            </button>
          </div>
          <hr>
          <h2>Ses séances</h2>
          <div id="profile-lessons"></div>
          <hr>
          <h2>Ses documents PDF</h2>
          <div id="profile-documents"></div>
        </section>

        <section id="lesson-form-section" class="card mt-3 hidden">
          <h2 id="lesson-form-title">Ajouter une séance</h2>
          <form id="lesson-form">
            <div class="form-group">
              <label for="lesson-student">Élève</label>
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
              <label for="lesson-duration">Durée (minutes)</label>
              <input id="lesson-duration" type="number" min="1" max="1440">
            </div>
            <div class="form-group">
              <label for="lesson-content">Contenu de la séance</label>
              <textarea id="lesson-content" rows="5"></textarea>
            </div>
            <div class="form-group">
              <label for="lesson-conclusion">Conclusion / bilan</label>
              <textarea id="lesson-conclusion" rows="3"></textarea>
            </div>
            <div class="form-actions">
              <button id="save-lesson" type="submit">Enregistrer la séance</button>
              <button id="cancel-lesson" class="secondary"
                type="button">Annuler</button>
            </div>
          </form>
        </section>

        <section id="document-form-section" class="card mt-3 hidden">
          <h2>Ajouter un PDF à une séance</h2>
          <form id="document-form">
            <div class="form-group">
              <label for="document-lesson">Séance</label>
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
                accept=".pdf,application/pdf" required>
            </div>
            <div class="form-actions">
              <button id="upload-pdf" type="submit">Envoyer le PDF</button>
              <button id="cancel-document" class="secondary"
                type="button">Annuler</button>
            </div>
          </form>
        </section>
      </main>
    </div>`;

  document.getElementById("logout-button").addEventListener("click", signOut);
  document.getElementById("add-student-button").addEventListener("click", () => openStudentForm());
  document.getElementById("student-form").addEventListener("submit", saveStudent);
  document.getElementById("cancel-student").addEventListener("click", closeStudentForm);
  document.getElementById("student-search").addEventListener("input", renderStudents);
  document.getElementById("back-to-students").addEventListener("click", backToStudents);
  document.getElementById("edit-profile").addEventListener("click", () => {
    if (selectedStudent) openStudentForm(selectedStudent);
  });
  document.getElementById("new-lesson").addEventListener("click", () =>
    openLessonForm(null, selectedStudent?.id));
  document.getElementById("lesson-form").addEventListener("submit", saveLesson);
  document.getElementById("cancel-lesson").addEventListener("click", closeLessonForm);
  document.getElementById("document-form").addEventListener("submit", uploadPDF);
  document.getElementById("cancel-document").addEventListener("click", closeDocumentForm);

  await Promise.all([loadStudents(), loadLessons(), loadDocuments()]);
}

/* ================= ÉLÈVES ================= */

async function loadStudents() {
  try {
    const { data, error } = await db.from(STUDENTS_TABLE)
      .select("id, name, class")
      .order("name", { ascending: true });

    if (error) throw error;

    students = data || [];
    document.getElementById("stat-students").textContent = students.length;
    renderStudents();
    updateStudentSelect();
  } catch (error) {
    showError(error);
    document.getElementById("students-list").textContent =
      error.message || "Chargement impossible.";
  }
}

function renderStudents() {
  const container = document.getElementById("students-list");
  if (!container) return;

  const search = (document.getElementById("student-search")?.value || "")
    .toLowerCase().trim();

  const filtered = students.filter(s =>
    String(s.name || "").toLowerCase().includes(search) ||
    String(s.class || "").toLowerCase().includes(search)
  );

  if (!filtered.length) {
    container.innerHTML = "<p>Aucun élève trouvé.</p>";
    return;
  }

  container.innerHTML = `
    <div class="students-grid">
      ${filtered.map(s => `
        <article class="student-card">
          <button type="button" class="student-open"
            data-open="${esc(s.id)}">
            <h3>${esc(s.name)}</h3>
            <p>Classe : ${esc(s.class || "Non renseignée")}</p>
            <p>Ouvrir la fiche →</p>
          </button>
          <div class="form-actions">
            <button class="secondary" type="button"
              data-edit-student="${esc(s.id)}">Modifier</button>
            <button class="danger" type="button"
              data-delete-student="${esc(s.id)}">Supprimer</button>
          </div>
        </article>
      `).join("")}
    </div>`;

  container.querySelectorAll("[data-open]").forEach(button => {
    button.addEventListener("click", () => {
      const student = students.find(s => String(s.id) === button.dataset.open);
      if (student) openStudentProfile(student);
    });
  });

  container.querySelectorAll("[data-edit-student]").forEach(button => {
    button.addEventListener("click", () => {
      const student = students.find(s => String(s.id) === button.dataset.editStudent);
      if (student) openStudentForm(student);
    });
  });

  container.querySelectorAll("[data-delete-student]").forEach(button => {
    button.addEventListener("click", () => deleteStudent(button.dataset.deleteStudent));
  });
}

function openStudentForm(student = null) {
  editingStudentId = student?.id ?? null;
  closeForms();

  document.getElementById("student-form-title").textContent =
    student ? "Modifier l'élève" : "Ajouter un élève";
  document.getElementById("student-name").value = student?.name || "";
  document.getElementById("student-class").value = student?.class || "";

  reveal("student-form-section");
  document.getElementById("student-form-section")
    .scrollIntoView({ behavior: "smooth" });
}

function closeStudentForm() {
  document.getElementById("student-form").reset();
  editingStudentId = null;
  hide("student-form-section");
}

async function saveStudent(event) {
  event.preventDefault();
  const button = document.getElementById("save-student");
  button.disabled = true;

  try {
    const values = {
      name: document.getElementById("student-name").value.trim(),
      class: document.getElementById("student-class").value.trim() || null
    };

    if (!values.name) throw new Error("Le nom de l'élève est obligatoire.");

    const query = editingStudentId !== null
      ? db.from(STUDENTS_TABLE).update(values).eq("id", editingStudentId)
      : db.from(STUDENTS_TABLE).insert(values);

    const { error } = await query;
    if (error) throw error;

    closeStudentForm();
    await loadStudents();

    if (selectedStudent) {
      selectedStudent = students.find(s =>
        String(s.id) === String(selectedStudent.id)) || null;
      if (selectedStudent) await openStudentProfile(selectedStudent);
    }

    showMessage("Élève enregistré.", "success");
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
  }
}

async function deleteStudent(id) {
  const student = students.find(s => String(s.id) === String(id));
  if (!student || !confirm(`Supprimer l'élève ${student.name} ?`)) return;

  try {
    const { error } = await db.from(STUDENTS_TABLE).delete().eq("id", id);
    if (error) throw error;

    selectedStudent = null;
    hide("student-profile");
    await loadStudents();
    showMessage("Élève supprimé.", "success");
  } catch (error) {
    showError(error);
  }
}

async function openStudentProfile(student) {
  selectedStudent = student;
  closeForms();
  hide("students-section");
  reveal("student-profile");

  document.getElementById("student-details").innerHTML = `
    <h1>${esc(student.name)}</h1>
    <p>Classe : ${esc(student.class || "Non renseignée")}</p>`;

  document.getElementById("student-profile")
    .scrollIntoView({ behavior: "smooth" });

  await renderStudentLessons();
}

function backToStudents() {
  selectedStudent = null;
  hide("student-profile");
  closeForms();
  reveal("students-section");
  renderStudents();
}

/* ================= SÉANCES ================= */

async function loadLessons() {
  try {
    const { data, error } = await db.from(LESSONS_TABLE)
      .select("id, created_at, student_id, title, class, content, subject, duration_minutes, lesson_date, conclusion")
      .order("lesson_date", { ascending: false });

    if (error) throw error;

    lessons = data || [];
    document.getElementById("stat-lessons").textContent = lessons.length;
    updateStudentSelect();

    if (selectedStudent) await renderStudentLessons();
  } catch (error) {
    showError(error);
    document.getElementById("profile-lessons").textContent =
      error.message || "Chargement des séances impossible.";
  }
}

function updateStudentSelect() {
  const select = document.getElementById("lesson-student");
  if (!select) return;

  const previous = select.value;

  select.innerHTML = `
    <option value="">Choisir un élève</option>
    ${students.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}`;

  if (students.some(s => String(s.id) === previous)) {
    select.value = previous;
  } else if (selectedStudent) {
    select.value = String(selectedStudent.id);
  }
}

function openLessonForm(lesson = null, studentId = null) {
  if (!students.length) {
    showMessage("Ajoute d'abord un élève.", "error");
    return;
  }

  editingLessonId = lesson?.id ?? null;
  closeForms();
  updateStudentSelect();

  document.getElementById("lesson-form-title").textContent =
    lesson ? "Modifier la séance" : "Ajouter une séance";

  document.getElementById("lesson-student").value = String(
    lesson?.student_id ?? studentId ?? selectedStudent?.id ?? ""
  );
  document.getElementById("lesson-title").value = lesson?.title || "";
  document.getElementById("lesson-subject").value = lesson?.subject || "";
  document.getElementById("lesson-class").value =
    lesson?.class || selectedStudent?.class || "";
  document.getElementById("lesson-date").value = lesson?.lesson_date || "";
  document.getElementById("lesson-duration").value = lesson?.duration_minutes || "";
  document.getElementById("lesson-content").value = lesson?.content || "";
  document.getElementById("lesson-conclusion").value = lesson?.conclusion || "";

  reveal("lesson-form-section");
  document.getElementById("lesson-form-section")
    .scrollIntoView({ behavior: "smooth" });
}

function closeLessonForm() {
  document.getElementById("lesson-form").reset();
  editingLessonId = null;
  hide("lesson-form-section");
}

async function saveLesson(event) {
  event.preventDefault();
  const button = document.getElementById("save-lesson");
  button.disabled = true;

  try {
    const studentId = document.getElementById("lesson-student").value;
    const title = document.getElementById("lesson-title").value.trim();
    const student = students.find(s => String(s.id) === String(studentId));

    if (!student) throw new Error("Choisis un élève valide.");
    if (!title) throw new Error("Le titre de la séance est obligatoire.");

    const values = {
      student_id: studentId,
      title,
      subject: document.getElementById("lesson-subject").value.trim() || null,
      class: document.getElementById("lesson-class").value.trim() || null,
      lesson_date: document.getElementById("lesson-date").value || null,
      duration_minutes: document.getElementById("lesson-duration").value
        ? String(document.getElementById("lesson-duration").value) : null,
      content: document.getElementById("lesson-content").value.trim() || null,
      conclusion: document.getElementById("lesson-conclusion").value.trim() || null
    };

    const query = editingLessonId !== null
      ? db.from(LESSONS_TABLE).update(values).eq("id", editingLessonId)
      : db.from(LESSONS_TABLE).insert(values);

    const { error } = await query;
    if (error) throw error;

    closeLessonForm();
    await loadLessons();
    await loadDocuments();
    await openStudentProfile(student);
    showMessage("Séance enregistrée.", "success");
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
  }
}

async function renderStudentLessons() {
  if (!selectedStudent) return;

  const container = document.getElementById("profile-lessons");
  const list = lessons.filter(l =>
    String(l.student_id) === String(selectedStudent.id)
  );

  if (!list.length) {
    container.innerHTML = "<p>Aucune séance enregistrée pour cet élève.</p>";
    document.getElementById("profile-documents").innerHTML =
      "<p>Aucun document pour le moment.</p>";
    return;
  }

  container.innerHTML = list.map(lesson => `
    <article class="card mt-3">
      <h3>${esc(lesson.title)}</h3>
      <p><strong>Date :</strong> ${esc(formatDate(lesson.lesson_date))}</p>
      <p><strong>Matière :</strong> ${esc(lesson.subject || "Non renseignée")}</p>
      <p><strong>Durée :</strong> ${esc(lesson.duration_minutes || "Non renseignée")}${lesson.duration_minutes ? " minutes" : ""}</p>
      <p><strong>Contenu :</strong></p>
      <p>${esc(lesson.content || "Aucun contenu").replace(/\n/g, "<br>")}</p>
      <p><strong>Conclusion :</strong></p>
      <p>${esc(lesson.conclusion || "Aucune conclusion").replace(/\n/g, "<br>")}</p>
      <div class="form-actions">
        <button class="secondary" type="button"
          data-edit-lesson="${esc(lesson.id)}">Modifier</button>
        <button type="button"
          data-add-pdf="${esc(lesson.id)}">+ Ajouter un PDF</button>
        <button class="danger" type="button"
          data-delete-lesson="${esc(lesson.id)}">Supprimer</button>
      </div>
    </article>
  `).join("");

  container.querySelectorAll("[data-edit-lesson]").forEach(button => {
    button.addEventListener("click", () => {
      const lesson = lessons.find(l => String(l.id) === button.dataset.editLesson);
      if (lesson) openLessonForm(lesson);
    });
  });

  container.querySelectorAll("[data-add-pdf]").forEach(button => {
    button.addEventListener("click", () => openDocumentForm(button.dataset.addPdf));
  });

  container.querySelectorAll("[data-delete-lesson]").forEach(button => {
    button.addEventListener("click", () => deleteLesson(button.dataset.deleteLesson));
  });

  await renderStudentDocuments(list.map(l => l.id));
}

async function deleteLesson(id) {
  const lesson = lessons.find(l => String(l.id) === String(id));
  if (!lesson || !confirm(`Supprimer la séance « ${lesson.title} » ?`)) return;

  try {
    const related = documents.filter(d => String(d.lesson_id) === String(id));

    for (const doc of related) {
      if (doc.file_path) {
        const { error } = await db.storage.from(DOCUMENTS_BUCKET).remove([doc.file_path]);
        if (error) throw error;
      }
    }

    if (related.length) {
      const { error } = await db.from(DOCUMENTS_TABLE).delete().eq("lesson_id", id);
      if (error) throw error;
    }

    const { error } = await db.from(LESSONS_TABLE).delete().eq("id", id);
    if (error) throw error;

    await loadLessons();
    await loadDocuments();
    showMessage("Séance supprimée.", "success");
  } catch (error) {
    showError(error);
  }
}

/* ================= DOCUMENTS PDF ================= */

async function loadDocuments() {
  try {
    const { data, error } = await db.from(DOCUMENTS_TABLE)
      .select("id, created_at, lesson_id, file_name, file_path, document_type, lesson_title")
      .order("created_at", { ascending: false });

    if (error) throw error;

    documents = data || [];
    document.getElementById("stat-documents").textContent = documents.length;

    if (selectedStudent) {
      const list = lessons.filter(l =>
        String(l.student_id) === String(selectedStudent.id));
      await renderStudentDocuments(list.map(l => l.id));
    }
  } catch (error) {
    showError(error);
    document.getElementById("profile-documents").textContent =
      error.message || "Chargement des documents impossible.";
  }
}

function openDocumentForm(lessonId = null) {
  if (!selectedStudent) {
    showMessage("Ouvre d'abord la fiche d'un élève.", "error");
    return;
  }

  const list = lessons.filter(l =>
    String(l.student_id) === String(selectedStudent.id));

  if (!list.length) {
    showMessage("Ajoute d'abord une séance à cet élève.", "error");
    return;
  }

  closeForms();
  document.getElementById("document-form").reset();

  document.getElementById("document-lesson").innerHTML = list.map(l => `
    <option value="${esc(l.id)}">${esc(l.title)} — ${esc(formatDate(l.lesson_date))}</option>
  `).join("");

  if (lessonId && list.some(l => String(l.id) === String(lessonId))) {
    document.getElementById("document-lesson").value = String(lessonId);
  }

  reveal("document-form-section");
  document.getElementById("document-form-section")
    .scrollIntoView({ behavior: "smooth" });
}

function closeDocumentForm() {
  document.getElementById("document-form").reset();
  hide("document-form-section");
}

async function uploadPDF(event) {
  event.preventDefault();

  const button = document.getElementById("upload-pdf");
  const file = document.getElementById("document-file").files[0];
  const lessonId = document.getElementById("document-lesson").value;
  const type = document.getElementById("document-type").value.trim();

  if (!file || !lessonId) {
    showMessage("Choisis une séance et un fichier PDF.", "error");
    return;
  }

  if (file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")) {
    showMessage("Seuls les PDF sont acceptés.", "error");
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    showMessage("Le PDF dépasse 20 Mo.", "error");
    return;
  }

  const lesson = lessons.find(l => String(l.id) === String(lessonId));
  if (!lesson || String(lesson.student_id) !== String(selectedStudent?.id)) {
    showMessage("Cette séance n'appartient pas à cet élève.", "error");
    return;
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${currentUser.id}/${lessonId}/${Date.now()}_${safeName}`;

  button.disabled = true;
  let uploaded = false;

  try {
    const { error: uploadError } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, file, { contentType: "application/pdf", upsert: false });

    if (uploadError) throw uploadError;
    uploaded = true;

    const { error: insertError } = await db.from(DOCUMENTS_TABLE).insert({
      lesson_id: lesson.id,
      file_name: file.name,
      file_path: path,
      document_type: type || "PDF",
      lesson_title: lesson.title
    });

    if (insertError) throw insertError;

    closeDocumentForm();
    await loadDocuments();
    showMessage("PDF ajouté à la séance.", "success");
  } catch (error) {
    if (uploaded) {
      await db.storage.from(DOCUMENTS_BUCKET).remove([path]);
    }
    showError(error);
  } finally {
    button.disabled = false;
    button.textContent = "Envoyer le PDF";
  }
}

async function renderStudentDocuments(lessonIds) {
  const container = document.getElementById("profile-documents");
  if (!container) return;

  const ids = new Set(lessonIds.map(String));
  const list = documents.filter(d => ids.has(String(d.lesson_id)));

  if (!list.length) {
    container.innerHTML = "<p>Aucun PDF associé aux séances de cet élève.</p>";
    return;
  }

  container.innerHTML = "<p>Chargement des PDF...</p>";

  const rows = await Promise.all(list.map(async doc => {
    let url = "";

    if (doc.file_path) {
      const { data, error } = await db.storage
        .from(DOCUMENTS_BUCKET)
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
        : `<p class="error-text">Lien indisponible : vérifie les droits du bucket.</p>`}
      <button class="danger" type="button"
        data-delete-pdf="${esc(doc.id)}">Supprimer le PDF</button>
    </article>
  `).join("");

  container.querySelectorAll("[data-delete-pdf]").forEach(button => {
    button.addEventListener("click", () => deletePDF(button.dataset.deletePdf));
  });
}

async function deletePDF(id) {
  const doc = documents.find(d => String(d.id) === String(id));
  if (!doc || !confirm(`Supprimer le PDF « ${doc.file_name} » ?`)) return;

  try {
    if (doc.file_path) {
      const { error } = await db.storage.from(DOCUMENTS_BUCKET).remove([doc.file_path]);
      if (error) throw error;
    }

    const { error } = await db.from(DOCUMENTS_TABLE).delete().eq("id", id);
    if (error) throw error;

    await loadDocuments();
    showMessage("PDF supprimé.", "success");
  } catch (error) {
    showError(error);
  }
}

/* ================= DÉMARRAGE ================= */

async function startApp() {
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;

    currentUser = data.session?.user || null;

    if (currentUser) {
      await renderDashboard();
    } else {
      renderLogin();
    }
  } catch (error) {
    app.innerHTML = `
      <main class="login-page">
        <section class="login-box">
          <h1>NSK Éducation</h1>
          <p class="error-text">${esc(error.message || "Chargement impossible.")}</p>
          <button type="button" onclick="location.reload()">Réessayer</button>
        </section>
      </main>`;
  }
}

startApp();
