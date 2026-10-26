
/* =====================================================
   NSK ÉDUCATION
   Connexion + élèves + séances + documents PDF
   ===================================================== */

const SUPABASE_URL = "https://hztywwjrjkihivupcmad.supabase.co";
const SUPABASE_KEY = "sb_publishable_am_wEiQkh4F-9VhIUC0LFg_zux-_jgu";

const DOCUMENTS_BUCKET = "lesson-pdfs";
const DOCUMENTS_TABLE = "lessons-documents";

const app = document.getElementById("app");
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let students = [];
let lessons = [];
let documents = [];
let editingLessonId = null;

/* ===================== UTILITAIRES ===================== */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showMessage(message, type = "info") {
  const box = document.getElementById("message");
  if (!box) {
    alert(message);
    return;
  }
  box.textContent = message;
  box.className = "alert " + type;
  box.classList.remove("hidden");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function friendlyError(error) {
  const message = error?.message || "Erreur inconnue.";
  if (/row-level security|permission denied|not allowed/i.test(message)) {
    return "Accès refusé par Supabase. Vérifie les autorisations de la table ou du stockage.";
  }
  if (/bucket/i.test(message)) {
    return "Le bucket lesson-pdfs est introuvable ou inaccessible. Vérifie son nom et ses autorisations.";
  }
  return message;
}

function formatDate(date) {
  if (!date) return "Non renseignée";
  const parsed = new Date(date + "T00:00:00");
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("fr-FR");
}

/* ===================== CONNEXION ===================== */

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
        <button id="signup-button" class="secondary w-full mt-2"
          type="button">Créer un compte</button>
        <button id="forgot-button" class="link-button w-full"
          type="button">Mot de passe oublié ?</button>
      </section>
    </main>`;

  document.getElementById("login-form").addEventListener("submit", login);
  document.getElementById("signup-button").addEventListener("click", signup);
  document.getElementById("forgot-button").addEventListener("click", resetPassword);
}

async function login(event) {
  event.preventDefault();

  const button = document.getElementById("login-button");
  const errorBox = document.getElementById("login-error");
  button.disabled = true;
  button.textContent = "Connexion...";

  try {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;

    currentUser = data.user;
    await showDashboard();
  } catch (error) {
    errorBox.textContent = friendlyError(error);
  } finally {
    if (document.getElementById("login-button")) {
      button.disabled = false;
      button.textContent = "Se connecter";
    }
  }
}

async function signup() {
  const email = prompt("Quelle est ton adresse e-mail ?");
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
      alert("Compte créé. Vérifie ton e-mail si Supabase demande une confirmation.");
    }
  } catch (error) {
    alert("Création impossible : " + friendlyError(error));
  }
}

async function resetPassword() {
  const email = prompt("Saisis l'adresse e-mail de ton compte.");
  if (!email) return;

  try {
    const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin
    });
    if (error) throw error;
    alert("Si cette adresse correspond à un compte, un e-mail sera envoyé.");
  } catch (error) {
    alert("Erreur : " + friendlyError(error));
  }
}

/* ===================== TABLEAU DE BORD ===================== */

async function showDashboard() {
  if (!currentUser) return showLogin();

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
            <p>Connecté avec ${escapeHTML(currentUser.email || "")}</p>
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
            <div class="stat-label">Documents PDF</div>
            <div id="document-count" class="stat-value">0</div>
          </div>
        </section>

        <section class="card mt-3">
          <h2>Mes élèves</h2>
          <div class="form-group">
            <label for="student-search">Rechercher un élève</label>
            <input id="student-search" type="search" placeholder="Nom ou classe...">
          </div>
          <div id="students-container">Chargement des élèves...</div>
        </section>

        <section id="student-form-section" class="card mt-3 hidden">
          <h2 id="student-form-heading">Ajouter un élève</h2>
          <form id="student-form">
            <input id="student-id" type="hidden">
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

        <section class="card mt-3">
          <h2>Mes séances</h2>
          <button id="add-lesson-button" type="button">+ Ajouter une séance</button>
          <div id="lessons-container" class="mt-3">Chargement des séances...</div>
        </section>

        <section id="lesson-form-section" class="card mt-3 hidden">
          <h2 id="lesson-form-heading">Ajouter une séance</h2>
          <form id="lesson-form">
            <div class="form-group">
              <label for="lesson-title">Titre</label>
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
              <label for="lesson-content">Résumé de la séance</label>
              <textarea id="lesson-content" rows="5"></textarea>
            </div>
            <div class="form-group">
              <label for="lesson-conclusion">Conclusion</label>
              <textarea id="lesson-conclusion" rows="3"></textarea>
            </div>
            <div class="form-actions">
              <button id="save-lesson-button" type="submit">Enregistrer la séance</button>
              <button id="cancel-lesson-button" class="secondary"
                type="button">Annuler</button>
            </div>
          </form>
        </section>

        <section class="card mt-3">
          <h2>Mes documents PDF</h2>
          <form id="document-form">
            <div class="form-group">
              <label for="document-lesson">Séance associée</label>
              <select id="document-lesson" required>
                <option value="">Choisir une séance</option>
              </select>
            </div>
            <div class="form-group">
              <label for="document-type">Type de document</label>
              <input id="document-type" maxlength="100"
                placeholder="Cours, exercice, correction...">
            </div>
            <div class="form-group">
              <label for="document-file">Fichier PDF</label>
              <input id="document-file" type="file"
                accept="application/pdf,.pdf" required>
            </div>
            <button id="upload-document-button" type="submit">Ajouter le PDF</button>
          </form>
          <div id="documents-container" class="mt-3">Chargement des documents...</div>
        </section>
      </main>
    </div>`;

  document.getElementById("logout-button").addEventListener("click", logout);
  document.getElementById("add-student-button").addEventListener("click", () => openStudentForm());
  document.getElementById("student-form").addEventListener("submit", saveStudent);
  document.getElementById("cancel-student-button").addEventListener("click", closeStudentForm);
  document.getElementById("student-search").addEventListener("input", renderStudents);
  document.getElementById("add-lesson-button").addEventListener("click", () => openLessonForm());
  document.getElementById("lesson-form").addEventListener("submit", saveLesson);
  document.getElementById("cancel-lesson-button").addEventListener("click", closeLessonForm);
  document.getElementById("document-form").addEventListener("submit", uploadDocument);

  await Promise.all([loadStudents(), loadLessons(), loadDocuments()]);
}

/* ===================== ÉLÈVES ===================== */

async function loadStudents() {
  const container = document.getElementById("students-container");
  if (!container || !currentUser) return;

  container.textContent = "Chargement...";

  try {
    const { data, error } = await db.from("Students")
      .select("id, name, class")
      .order("name", { ascending: true });

    if (error) throw error;
    students = data || [];
    document.getElementById("student-count").textContent = students.length;
    renderStudents();
  } catch (error) {
    container.innerHTML = `<div class="alert error">${escapeHTML(friendlyError(error))}</div>`;
  }
}

function renderStudents() {
  const container = document.getElementById("students-container");
  if (!container) return;

  const search = (document.getElementById("student-search")?.value || "")
    .toLowerCase().trim();

  const filtered = students.filter(student =>
    String(student.name || "").toLowerCase().includes(search) ||
    String(student.class || "").toLowerCase().includes(search)
  );

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><p>Aucun élève trouvé.</p></div>`;
    return;
  }

  container.innerHTML = `<div class="students-grid">
    ${filtered.map(student => `
      <article class="student-card">
        <h3>${escapeHTML(student.name)}</h3>
        <p>Classe : ${escapeHTML(student.class || "Non renseignée")}</p>
        <div class="student-menu">
          <button class="secondary" type="button"
            data-edit-student="${escapeHTML(student.id)}">Modifier</button>
          <button class="danger" type="button"
            data-delete-student="${escapeHTML(student.id)}">Supprimer</button>
        </div>
      </article>`).join("")}
  </div>`;

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
  document.getElementById("student-form-heading").textContent =
    student ? "Modifier l'élève" : "Ajouter un élève";
  document.getElementById("student-id").value = student?.id || "";
  document.getElementById("student-name").value = student?.name || "";
  document.getElementById("student-class").value = student?.class || "";

  const section = document.getElementById("student-form-section");
  section.classList.remove("hidden");
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeStudentForm() {
  document.getElementById("student-form").reset();
  document.getElementById("student-id").value = "";
  document.getElementById("student-form-section").classList.add("hidden");
}

async function saveStudent(event) {
  event.preventDefault();

  const button = document.getElementById("save-student-button");
  const id = document.getElementById("student-id").value;
  const name = document.getElementById("student-name").value.trim();
  const studentClass = document.getElementById("student-class").value.trim();

  if (!name) {
    showMessage("Le nom de l'élève est obligatoire.", "error");
    return;
  }

  button.disabled = true;

  try {
    const query = id
      ? db.from("Students").update({ name, class: studentClass || null }).eq("id", id)
      : db.from("Students").insert({ name, class: studentClass || null });

    const { error } = await query;
    if (error) throw error;

    closeStudentForm();
    showMessage("Élève enregistré.", "success");
    await loadStudents();
  } catch (error) {
    showMessage(friendlyError(error), "error");
  } finally {
    button.disabled = false;
  }
}

async function deleteStudent(id) {
  const student = students.find(s => String(s.id) === String(id));
  if (!student || !confirm(`Supprimer l'élève ${student.name} ?`)) return;

  try {
    const { error } = await db.from("Students").delete().eq("id", id);
    if (error) throw error;

    showMessage("Élève supprimé.", "success");
    await loadStudents();
  } catch (error) {
    showMessage(friendlyError(error), "error");
  }
}

/* ===================== SÉANCES ===================== */

async function loadLessons() {
  const container = document.getElementById("lessons-container");
  if (!container || !currentUser) return;

  container.textContent = "Chargement des séances...";

  try {
    const { data, error } = await db.from("lessons")
      .select("id, created_at, title, class, content, subject, duration_minutes, lesson_date, conclusion")
      .order("lesson_date", { ascending: false });

    if (error) throw error;

    lessons = data || [];
    document.getElementById("lesson-count").textContent = lessons.length;
    renderLessons();
    updateLessonSelect();
  } catch (error) {
    container.innerHTML = `<div class="alert error">${escapeHTML(friendlyError(error))}</div>`;
  }
}

function renderLessons() {
  const container = document.getElementById("lessons-container");
  if (!container) return;

  if (!lessons.length) {
    container.innerHTML = `<div class="empty-state"><p>Aucune séance pour le moment.</p></div>`;
    return;
  }

  container.innerHTML = lessons.map(lesson => `
    <article class="card mt-3">
      <h3>${escapeHTML(lesson.title)}</h3>
      <p><strong>Matière :</strong> ${escapeHTML(lesson.subject || "Non renseignée")}</p>
      <p><strong>Classe :</strong> ${escapeHTML(lesson.class || "Non renseignée")}</p>
      <p><strong>Date :</strong> ${escapeHTML(formatDate(lesson.lesson_date))}</p>
      <p><strong>Durée :</strong> ${escapeHTML(lesson.duration_minutes || "Non renseignée")}${lesson.duration_minutes ? " min" : ""}</p>
      <p><strong>Résumé :</strong></p>
      <p>${escapeHTML(lesson.content || "Aucun résumé").replace(/\n/g, "<br>")}</p>
      <p><strong>Conclusion :</strong></p>
      <p>${escapeHTML(lesson.conclusion || "Aucune conclusion").replace(/\n/g, "<br>")}</p>
      <div class="form-actions">
        <button class="secondary" type="button"
          data-edit-lesson="${escapeHTML(lesson.id)}">Modifier</button>
        <button class="danger" type="button"
          data-delete-lesson="${escapeHTML(lesson.id)}">Supprimer</button>
      </div>
    </article>`).join("");

  container.querySelectorAll("[data-edit-lesson]").forEach(button => {
    button.addEventListener("click", () => {
      const lesson = lessons.find(l => String(l.id) === button.dataset.editLesson);
      if (lesson) openLessonForm(lesson);
    });
  });

  container.querySelectorAll("[data-delete-lesson]").forEach(button => {
    button.addEventListener("click", () => deleteLesson(button.dataset.deleteLesson));
  });
}

function openLessonForm(lesson = null) {
  editingLessonId = lesson?.id || null;

  document.getElementById("lesson-form-heading").textContent =
    lesson ? "Modifier la séance" : "Ajouter une séance";
  document.getElementById("lesson-title").value = lesson?.title || "";
  document.getElementById("lesson-subject").value = lesson?.subject || "";
  document.getElementById("lesson-class").value = lesson?.class || "";
  document.getElementById("lesson-date").value = lesson?.lesson_date || "";
  document.getElementById("lesson-duration").value = lesson?.duration_minutes || "";
  document.getElementById("lesson-content").value = lesson?.content || "";
  document.getElementById("lesson-conclusion").value = lesson?.conclusion || "";

  const section = document.getElementById("lesson-form-section");
  section.classList.remove("hidden");
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeLessonForm() {
  document.getElementById("lesson-form").reset();
  editingLessonId = null;
  document.getElementById("lesson-form-section").classList.add("hidden");
}

async function saveLesson(event) {
  event.preventDefault();

  const button = document.getElementById("save-lesson-button");
  const title = document.getElementById("lesson-title").value.trim();

  if (!title) {
    showMessage("Le titre de la séance est obligatoire.", "error");
    return;
  }

  const duration = document.getElementById("lesson-duration").value;

  const lessonData = {
    title,
    subject: document.getElementById("lesson-subject").value.trim() || null,
    class: document.getElementById("lesson-class").value.trim() || null,
    lesson_date: document.getElementById("lesson-date").value || null,
    duration_minutes: duration ? String(duration) : null,
    content: document.getElementById("lesson-content").value.trim() || null,
    conclusion: document.getElementById("lesson-conclusion").value.trim() || null
  };

  button.disabled = true;

  try {
    const query = editingLessonId
      ? db.from("lessons").update(lessonData).eq("id", editingLessonId)
      : db.from("lessons").insert(lessonData);

    const { error } = await query;
    if (error) throw error;

    closeLessonForm();
    showMessage("Séance enregistrée.", "success");
    await loadLessons();
  } catch (error) {
    showMessage("Impossible d'enregistrer : " + friendlyError(error), "error");
  } finally {
    button.disabled = false;
  }
}

async function deleteLesson(id) {
  const lesson = lessons.find(l => String(l.id) === String(id));
  if (!lesson || !confirm(`Supprimer la séance « ${lesson.title} » ?`)) return;

  try {
    const { error } = await db.from("lessons").delete().eq("id", id);
    if (error) throw error;

    showMessage("Séance supprimée.", "success");
    await loadLessons();
    await loadDocuments();
  } catch (error) {
    showMessage(friendlyError(error), "error");
  }
}

function updateLessonSelect() {
  const select = document.getElementById("document-lesson");
  if (!select) return;

  const previous = select.value;
  select.innerHTML = `<option value="">Choisir une séance</option>` +
    lessons.map(lesson => `
      <option value="${escapeHTML(lesson.id)}">${escapeHTML(lesson.title)}</option>
    `).join("");

  if (lessons.some(l => String(l.id) === previous)) select.value = previous;
}

/* ===================== DOCUMENTS PDF ===================== */

async function loadDocuments() {
  const container = document.getElementById("documents-container");
  if (!container || !currentUser) return;

  container.textContent = "Chargement des documents...";

  try {
    const { data, error } = await db.from(DOCUMENTS_TABLE)
      .select("id, created_at, lesson_id, file_name, file_path, document_type, lesson_title")
      .order("created_at", { ascending: false });

    if (error) throw error;

    documents = data || [];
    document.getElementById("document-count").textContent = documents.length;
    await renderDocuments();
  } catch (error) {
    container.innerHTML = `<div class="alert error">${escapeHTML(friendlyError(error))}</div>`;
  }
}

async function renderDocuments() {
  const container = document.getElementById("documents-container");
  if (!container) return;

  if (!documents.length) {
    container.innerHTML = `<div class="empty-state"><p>Aucun document enregistré.</p></div>`;
    return;
  }

  container.innerHTML = "<p>Préparation des liens PDF...</p>";

  const rows = await Promise.all(documents.map(async document => {
    let url = "";

    if (document.file_path) {
      const { data, error } = await db.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(document.file_path, 3600);

      if (!error && data?.signedUrl) url = data.signedUrl;
    }

    return { document, url };
  }));

  container.innerHTML = rows.map(({ document, url }) => `
    <article class="card mt-3">
      <h3>${escapeHTML(document.file_name || "Document PDF")}</h3>
      <p><strong>Séance :</strong> ${escapeHTML(document.lesson_title || "Non renseignée")}</p>
      <p><strong>Type :</strong> ${escapeHTML(document.document_type || "PDF")}</p>
      ${url
        ? `<p><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Ouvrir le PDF</a></p>`
        : `<p class="error-text">Lien indisponible. Vérifie le bucket et ses autorisations.</p>`}
      <button class="danger" type="button"
        data-delete-document="${escapeHTML(document.id)}">Supprimer le document</button>
    </article>`).join("");

  container.querySelectorAll("[data-delete-document]").forEach(button => {
    button.addEventListener("click", () => deleteDocument(button.dataset.deleteDocument));
  });
}

async function uploadDocument(event) {
  event.preventDefault();

  const button = document.getElementById("upload-document-button");
  const file = document.getElementById("document-file").files[0];
  const lessonId = document.getElementById("document-lesson").value;
  const documentType = document.getElementById("document-type").value.trim();

  if (!file || !lessonId) {
    showMessage("Choisis une séance et un fichier PDF.", "error");
    return;
  }

  if (file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")) {
    showMessage("Seuls les fichiers PDF sont acceptés.", "error");
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    showMessage("Le PDF dépasse la limite de 20 Mo.", "error");
    return;
  }

  const lesson = lessons.find(l => String(l.id) === String(lessonId));
  if (!lesson) {
    showMessage("Séance introuvable. Recharge la page et réessaie.", "error");
    return;
  }

  button.disabled = true;
  button.textContent = "Envoi du PDF...";

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${currentUser.id}/${lessonId}/${Date.now()}_${safeName}`;
  let uploaded = false;

  try {
    const { error: uploadError } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, file, {
        contentType: "application/pdf",
        upsert: false
      });

    if (uploadError) throw uploadError;
    uploaded = true;

    const { error: insertError } = await db.from(DOCUMENTS_TABLE).insert({
      lesson_id: lesson.id,
      file_name: file.name,
      file_path: filePath,
      document_type: documentType || "PDF",
      lesson_title: lesson.title
    });

    if (insertError) throw insertError;

    document.getElementById("document-form").reset();
    showMessage("PDF ajouté avec succès.", "success");
    await loadDocuments();
  } catch (error) {
    if (uploaded) {
      await db.storage.from(DOCUMENTS_BUCKET).remove([filePath]);
    }
    showMessage("Impossible d'ajouter le PDF : " + friendlyError(error), "error");
  } finally {
    button.disabled = false;
    button.textContent = "Ajouter le PDF";
  }
}

async function deleteDocument(id) {
  const document = documents.find(d => String(d.id) === String(id));
  if (!document || !confirm(`Supprimer le document « ${document.file_name} » ?`)) return;

  try {
    const { error: rowError } = await db.from(DOCUMENTS_TABLE)
      .delete().eq("id", id);

    if (rowError) throw rowError;

    if (document.file_path) {
      const { error: storageError } = await db.storage
        .from(DOCUMENTS_BUCKET)
        .remove([document.file_path]);

      if (storageError) {
        showMessage(
          "La fiche est supprimée, mais le fichier peut rester dans le stockage : " +
          friendlyError(storageError),
          "error"
        );
        await loadDocuments();
        return;
      }
    }

    showMessage("Document supprimé.", "success");
    await loadDocuments();
  } catch (error) {
    showMessage(friendlyError(error), "error");
  }
}

/* ===================== DÉCONNEXION ===================== */

async function logout() {
  const { error } = await db.auth.signOut();

  if (error) {
    showMessage(friendlyError(error), "error");
    return;
  }

  currentUser = null;
  students = [];
  lessons = [];
  documents = [];
  showLogin();
}

/* ===================== DÉMARRAGE ===================== */

async function startApp() {
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;

    currentUser = data.session?.user || null;

    if (currentUser) {
      await showDashboard();
    } else {
      showLogin();
    }
  } catch (error) {
    app.innerHTML = `
      <main class="login-page">
        <section class="login-box">
          <h1>NSK Éducation</h1>
          <p class="error-text">Impossible de démarrer : ${escapeHTML(friendlyError(error))}</p>
          <button id="retry-button" type="button">Réessayer</button>
        </section>
      </main>`;

    document.getElementById("retry-button")
      .addEventListener("click", () => location.reload());
  }
}

startApp();
