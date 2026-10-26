
const SUPABASE_URL = "https://hztywwjrjkihivupcmad.supabase.co";
const SUPABASE_KEY = "sb_publishable_am_wEiQkh4F-9VhIUC0LFg_zux-_jgu";

const STUDENTS_TABLE = "Students";
const LESSONS_TABLE = "Lessons";
const DOCUMENTS_TABLE = "Lessons_documents";
const DOCUMENTS_BUCKET = "lesson-pdfs";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentUser = null;
let currentStudent = null;
let currentLesson = null;
let students = [];
let lessons = [];
let documents = [];

/* ------------------------------
   UTILITAIRES
------------------------------ */

function $(id) {
  return document.getElementById(id);
}

function showMessage(message, type = "info") {
  const target = $("message");

  if (target) {
    target.textContent = message;
    target.className = `message ${type}`;
    target.classList.remove("hidden");

    return;
  }

  if (type === "error") {
    alert(message);
  } else {
    console.log(message);
  }
}

function hideMessage() {
  const target = $("message");

  if (target) {
    target.textContent = "";
    target.classList.add("hidden");
  }
}

function showSection(id) {
  document.querySelectorAll(".app-section").forEach(section => {
    section.classList.add("hidden");
  });

  const section = $(id);

  if (section) {
    section.classList.remove("hidden");
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "Date non renseignée";

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("fr-FR");
}

function setValue(id, value) {
  const element = $(id);

  if (element) {
    element.value = value ?? "";
  }
}

function getValue(id) {
  return $(id)?.value?.trim() ?? "";
}

function setText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent = value ?? "";
  }
}

function requireStudent() {
  if (!currentStudent) {
    showMessage("Sélectionne d'abord un élève.", "error");
    return false;
  }

  return true;
}

/* ------------------------------
   AUTHENTIFICATION
------------------------------ */

async function checkSession() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  currentUser = data.session?.user ?? null;
  updateAuthView();

  if (currentUser) {
    await loadStudents();
  }
}

function updateAuthView() {
  const loginSection = $("login-section");
  const appSection = $("app-section");
  const userEmail = $("user-email");

  if (loginSection) {
    loginSection.classList.toggle("hidden", Boolean(currentUser));
  }

  if (appSection) {
    appSection.classList.toggle("hidden", !currentUser);
  }

  if (userEmail) {
    userEmail.textContent = currentUser?.email ?? "";
  }
}

async function login(event) {
  event?.preventDefault();
  hideMessage();

  const email = getValue("login-email");
  const password = $("login-password")?.value ?? "";

  if (!email || !password) {
    showMessage("Renseigne ton adresse e-mail et ton mot de passe.", "error");
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  currentUser = data.user;
  updateAuthView();
  await loadStudents();
}

async function signup(event) {
  event?.preventDefault();
  hideMessage();

  const email = getValue("login-email");
  const password = $("login-password")?.value ?? "";

  if (!email || !password) {
    showMessage("Renseigne ton adresse e-mail et ton mot de passe.", "error");
    return;
  }

  const { data, error } = await db.auth.signUp({
    email,
    password
  });

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  if (data.session) {
    currentUser = data.user;
    updateAuthView();
    await loadStudents();
  } else {
    showMessage(
      "Compte créé. Vérifie tes e-mails pour confirmer ton inscription.",
      "success"
    );
  }
}

async function resetPassword() {
  const email = getValue("login-email");

  if (!email) {
    showMessage(
      "Saisis ton adresse e-mail dans le champ de connexion.",
      "error"
    );
    return;
  }

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  showMessage("E-mail de réinitialisation envoyé.", "success");
}

async function logout() {
  const { error } = await db.auth.signOut();

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  currentUser = null;
  currentStudent = null;
  currentLesson = null;
  students = [];
  lessons = [];
  documents = [];

  updateAuthView();
  showSection("login-section");
}

/* ------------------------------
   ÉLÈVES : CHARGEMENT
------------------------------ */

async function loadStudents() {
  if (!currentUser) return;

  hideMessage();

  const { data, error } = await db
    .from(STUDENTS_TABLE)
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    showMessage(
      "Impossible de charger les élèves : " + error.message,
      "error"
    );
    return;
  }

  students = data ?? [];
  renderStudents();
  updateStudentStats();
}

function renderStudents() {
  const container = $("students-list") || $("students-grid");

  if (!container) return;

  if (students.length === 0) {
    container.innerHTML = "<p>Aucun élève pour le moment.</p>";
    return;
  }

  container.innerHTML = students.map(student => `
    <article class="student-card">
      <h3>${escapeHTML(student.name)}</h3>
      <p>Classe : ${escapeHTML(student.class || "Non renseignée")}</p>
      <div class="form-actions">
        <button type="button"
          onclick="openStudentProfile('${escapeHTML(student.id)}')">
          Voir les séances
        </button>
        <button type="button" class="secondary"
          onclick="editStudent('${escapeHTML(student.id)}')">
          Modifier
        </button>
        <button type="button" class="danger"
          onclick="deleteStudent('${escapeHTML(student.id)}')">
          Supprimer
        </button>
      </div>
    </article>
  `).join("");
}

function updateStudentStats() {
  setText("students-count", students.length);
}

/* ------------------------------
   ÉLÈVES : AJOUT / MODIFICATION
------------------------------ */

function openStudentForm(studentId = null) {
  const student = studentId
    ? students.find(item => String(item.id) === String(studentId))
    : null;

  if (studentId && !student) {
    showMessage("Élève introuvable.", "error");
    return;
  }

  setValue("student-id", student?.id ?? "");
  setValue("student-name", student?.name ?? "");
  setValue("student-class", student?.class ?? "");

  const form = $("student-form");

  if (form) {
    form.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function editStudent(studentId) {
  openStudentForm(studentId);
}

function closeStudentForm() {
  $("student-form")?.classList.add("hidden");
}

async function saveStudent(event) {
  event?.preventDefault();
  hideMessage();

  const id = getValue("student-id");
  const name = getValue("student-name");
  const studentClass = getValue("student-class");

  if (!name) {
    showMessage("Le nom de l'élève est obligatoire.", "error");
    return;
  }

  const values = {
    name,
    class: studentClass || null
  };

  let query;

  if (id) {
    query = db
      .from(STUDENTS_TABLE)
      .update(values)
      .eq("id", id);
  } else {
    query = db
      .from(STUDENTS_TABLE)
      .insert(values);
  }

  const { error } = await query;

  if (error) {
    showMessage("Impossible d'enregistrer l'élève : " + error.message, "error");
    return;
  }

  closeStudentForm();
  showMessage("Élève enregistré.", "success");
  await loadStudents();
}

async function deleteStudent(studentId) {
  const student = students.find(
    item => String(item.id) === String(studentId)
  );

  if (!student) return;

  const confirmed = confirm(
    `Supprimer l'élève ${student.name} ? Cette action peut aussi nécessiter de supprimer ses séances et documents.`
  );

  if (!confirmed) return;

  const { error } = await db
    .from(STUDENTS_TABLE)
    .delete()
    .eq("id", studentId);

  if (error) {
    showMessage(
      "Impossible de supprimer l'élève. Vérifie si des séances lui sont encore liées : " +
      error.message,
      "error"
    );
    return;
  }

  if (currentStudent &&
      String(currentStudent.id) === String(studentId)) {
    currentStudent = null;
    currentLesson = null;
  }

  showMessage("Élève supprimé.", "success");
  await loadStudents();
}

/* ------------------------------
   PROFIL DE L'ÉLÈVE
------------------------------ */

async function openStudentProfile(studentId) {
  const student = students.find(
    item => String(item.id) === String(studentId)
  );

  if (!student) {
    showMessage("Élève introuvable.", "error");
    return;
  }

  currentStudent = student;
  currentLesson = null;

  setText("profile-student-name", student.name);
  setText("profile-student-class", student.class || "Non renseignée");

  showSection("student-profile-section");

  await loadLessons();
}

function backToStudents() {
  currentStudent = null;
  currentLesson = null;
  showSection("app-section");
}

/* ------------------------------
   SÉANCES : CHARGEMENT
------------------------------ */

async function loadLessons() {
  if (!requireStudent()) return;

  const { data, error } = await db
    .from(LESSONS_TABLE)
    .select("*")
    .eq("student_id", currentStudent.id)
    .order("lesson_date", { ascending: false });

  if (error) {
    showMessage(
      "Impossible de charger les séances : " + error.message +
      ". Vérifie notamment que la colonne student_id existe dans Lessons.",
      "error"
    );
    return;
  }

  lessons = data ?? [];
  renderLessons();
}

function renderLessons() {
  const container = $("lessons-list");

  if (!container) return;

  if (lessons.length === 0) {
    container.innerHTML = "<p>Aucune séance enregistrée pour cet élève.</p>";
    return;
  }

  container.innerHTML = lessons.map(lesson => `
    <article class="card lesson-card">
      <h3>${escapeHTML(lesson.title)}</h3>
      <p><strong>Matière :</strong> ${escapeHTML(lesson.subject || "Non renseignée")}</p>
      <p><strong>Date :</strong> ${escapeHTML(formatDate(lesson.lesson_date))}</p>
      <p><strong>Durée :</strong> ${escapeHTML(lesson.duration_minutes || "Non renseignée")} min</p>
      <p>${escapeHTML(lesson.content || "")}</p>
      <div class="form-actions">
        <button type="button"
          onclick="openLessonDocuments('${escapeHTML(lesson.id)}')">
          Documents PDF
        </button>
        <button type="button" class="secondary"
          onclick="editLesson('${escapeHTML(lesson.id)}')">
          Modifier
        </button>
        <button type="button" class="danger"
          onclick="deleteLesson('${escapeHTML(lesson.id)}')">
          Supprimer
        </button>
      </div>
    </article>
  `).join("");
}

/* ------------------------------
   SÉANCES : AJOUT / MODIFICATION
------------------------------ */

function openLessonForm(lessonId = null) {
  if (!requireStudent()) return;

  const lesson = lessonId
    ? lessons.find(item => String(item.id) === String(lessonId))
    : null;

  if (lessonId && !lesson) {
    showMessage("Séance introuvable.", "error");
    return;
  }

  setValue("lesson-id", lesson?.id ?? "");
  setValue("lesson-title", lesson?.title ?? "");
  setValue("lesson-subject", lesson?.subject ?? "");
  setValue("lesson-date", lesson?.lesson_date ?? "");
  setValue("lesson-duration", lesson?.duration_minutes ?? "");
  setValue("lesson-content", lesson?.content ?? "");
  setValue("lesson-conclusion", lesson?.conclusion ?? "");

  const form = $("lesson-form");

  if (form) {
    form.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function editLesson(lessonId) {
  openLessonForm(lessonId);
}

function closeLessonForm() {
  $("lesson-form")?.classList.add("hidden");
}

async function saveLesson(event) {
  event?.preventDefault();
  hideMessage();

  if (!requireStudent()) return;

  const id = getValue("lesson-id");
  const title = getValue("lesson-title");

  if (!title) {
    showMessage("Le titre de la séance est obligatoire.", "error");
    return;
  }

  const values = {
    student_id: currentStudent.id,
    title,
    subject: getValue("lesson-subject") || null,
    lesson_date: getValue("lesson-date") || null,
    duration_minutes: getValue("lesson-duration") || null,
    content: getValue("lesson-content") || null,
    conclusion: getValue("lesson-conclusion") || null,
    class: currentStudent.class || null
  };

  let query;

  if (id) {
    query = db
      .from(LESSONS_TABLE)
      .update(values)
      .eq("id", id)
      .eq("student_id", currentStudent.id);
  } else {
    query = db
      .from(LESSONS_TABLE)
      .insert(values);
  }

  const { error } = await query;

  if (error) {
    showMessage(
      "Impossible d'enregistrer la séance : " + error.message,
      "error"
    );
    return;
  }

  closeLessonForm();
  currentLesson = null;
  showMessage("Séance enregistrée.", "success");
  await loadLessons();
}

async function deleteLesson(lessonId) {
  if (!requireStudent()) return;

  const confirmed = confirm(
    "Supprimer cette séance et ses documents associés ?"
  );

  if (!confirmed) return;

  // Supprime d'abord les références aux documents.
  const { data: linkedDocs, error: docsError } = await db
    .from(DOCUMENTS_TABLE)
    .select("*")
    .eq("lesson_id", lessonId);

  if (docsError) {
    showMessage(
      "Impossible de vérifier les documents : " + docsError.message,
      "error"
    );
    return;
  }

  // Supprime les fichiers du stockage avant leurs références.
  const paths = (linkedDocs ?? [])
    .map(doc => doc.file_path)
    .filter(Boolean);

  if (paths.length) {
    const { error: storageError } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .remove(paths);

    if (storageError) {
      showMessage(
        "Suppression des fichiers impossible : " + storageError.message,
        "error"
      );
      return;
    }
  }

  const { error: deleteDocsError } = await db
    .from(DOCUMENTS_TABLE)
    .delete()
    .eq("lesson_id", lessonId);

  if (deleteDocsError) {
    showMessage(deleteDocsError.message, "error");
    return;
  }

  const { error } = await db
    .from(LESSONS_TABLE)
    .delete()
    .eq("id", lessonId)
    .eq("student_id", currentStudent.id);

  if (error) {
    showMessage("Impossible de supprimer la séance : " + error.message, "error");
    return;
  }

  currentLesson = null;
  showMessage("Séance supprimée.", "success");
  await loadLessons();
}

/* ------------------------------
   DOCUMENTS PDF : AFFICHAGE
------------------------------ */

async function openLessonDocuments(lessonId) {
  if (!requireStudent()) return;

  const lesson = lessons.find(
    item => String(item.id) === String(lessonId)
  );

  if (!lesson) {
    showMessage("Séance introuvable.", "error");
    return;
  }

  currentLesson = lesson;

  setText("documents-lesson-title", lesson.title);

  const { data, error } = await db
    .from(DOCUMENTS_TABLE)
    .select("*")
    .eq("lesson_id", lesson.id)
    .order("created_at", { ascending: false });

  if (error) {
    showMessage(
      "Impossible de charger les documents : " + error.message,
      "error"
    );
    return;
  }

  documents = data ?? [];
  renderDocuments();

  showSection("lesson-documents-section");
}

function renderDocuments() {
  const container = $("documents-list");

  if (!container) return;

  if (documents.length === 0) {
    container.innerHTML = "<p>Aucun document pour cette séance.</p>";
    return;
  }

  container.innerHTML = documents.map(doc => `
    <article class="card document-card">
      <p><strong>${escapeHTML(doc.file_name || "Document PDF")}</strong></p>
      <p>Type : ${escapeHTML(doc.document_type || "Non précisé")}</p>
      <button type="button"
        onclick="openPdf('${escapeHTML(doc.id)}')">
        Ouvrir le PDF
      </button>
      <button type="button" class="danger"
        onclick="deleteDocument('${escapeHTML(doc.id)}')">
        Supprimer
      </button>
    </article>
  `).join("");
}

async function openPdf(documentId) {
  const doc = documents.find(
    item => String(item.id) === String(documentId)
  );

  if (!doc || !doc.file_path) {
    showMessage("Chemin du PDF introuvable.", "error");
    return;
  }

  const { data, error } = await db.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.file_path, 60);

  if (error) {
    showMessage("Impossible d'ouvrir le PDF : " + error.message, "error");
    return;
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

/* ------------------------------
   DOCUMENTS PDF : AJOUT
------------------------------ */

async function uploadDocument(event) {
  event?.preventDefault();
  hideMessage();

  if (!currentStudent || !currentLesson) {
    showMessage("Sélectionne d'abord une séance.", "error");
    return;
  }

  const input = $("document-file");
  const file = input?.files?.[0];

  if (!file) {
    showMessage("Choisis un fichier PDF.", "error");
    return;
  }

  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    showMessage("Seuls les fichiers PDF sont acceptés.", "error");
    return;
  }

  // Nom de stockage unique, sans caractères problématiques.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath =
    `${currentStudent.id}/${currentLesson.id}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await db.storage
    .from(DOCUMENTS_BUCKET)
    .upload(filePath, file, {
      contentType: "application/pdf",
      upsert: false
    });

  if (uploadError) {
    showMessage("Envoi du PDF impossible : " + uploadError.message, "error");
    return;
  }

  const documentType = getValue("document-type") || null;

  const { error: insertError } = await db
    .from(DOCUMENTS_TABLE)
    .insert({
      lesson_id: currentLesson.id,
      file_name: file.name,
      file_path: filePath,
      document_type: documentType,
      lesson_title: currentLesson.title
    });

  if (insertError) {
    // Nettoie le fichier si l'enregistrement de sa référence échoue.
    await db.storage.from(DOCUMENTS_BUCKET).remove([filePath]);

    showMessage(
      "Le fichier a été envoyé, mais sa référence n'a pas pu être enregistrée : " +
      insertError.message,
      "error"
    );
    return;
  }

  if (input) input.value = "";
  setValue("document-type", "");

  showMessage("PDF ajouté avec succès.", "success");
  await openLessonDocuments(currentLesson.id);
}

/* ------------------------------
   DOCUMENTS PDF : SUPPRESSION
------------------------------ */

async function deleteDocument(documentId) {
  const doc = documents.find(
    item => String(item.id) === String(documentId)
  );

  if (!doc) return;

  if (!confirm(`Supprimer le document "${doc.file_name}" ?`)) {
    return;
  }

  const { error: storageError } = await db.storage
    .from(DOCUMENTS_BUCKET)
    .remove([doc.file_path]);

  if (storageError) {
    showMessage(
      "Impossible de supprimer le fichier : " + storageError.message,
      "error"
    );
    return;
  }

  const { error } = await db
    .from(DOCUMENTS_TABLE)
    .delete()
    .eq("id", documentId)
    .eq("lesson_id", currentLesson.id);

  if (error) {
    showMessage(
      "Le fichier a été supprimé du stockage, mais sa référence reste en base : " +
      error.message,
      "error"
    );
    return;
  }

  showMessage("Document supprimé.", "success");
  await openLessonDocuments(currentLesson.id);
}

/* ------------------------------
   RETOUR AUX SÉANCES
------------------------------ */

function backToLessons() {
  currentLesson = null;
  showSection("student-profile-section");
}

/* ------------------------------
   RECHERCHE DES ÉLÈVES
------------------------------ */

function searchStudents() {
  const search = getValue("student-search").toLowerCase();

  const filtered = students.filter(student =>
    String(student.name ?? "").toLowerCase().includes(search) ||
    String(student.class ?? "").toLowerCase().includes(search)
  );

  const container = $("students-list") || $("students-grid");

  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = "<p>Aucun élève correspondant à la recherche.</p>";
    return;
  }

  container.innerHTML = filtered.map(student => `
    <article class="student-card">
      <h3>${escapeHTML(student.name)}</h3>
      <p>Classe : ${escapeHTML(student.class || "Non renseignée")}</p>
      <div class="form-actions">
        <button type="button"
          onclick="openStudentProfile('${escapeHTML(student.id)}')">
          Voir les séances
        </button>
        <button type="button" class="secondary"
          onclick="editStudent('${escapeHTML(student.id)}')">
          Modifier
        </button>
        <button type="button" class="danger"
          onclick="deleteStudent('${escapeHTML(student.id)}')">
          Supprimer
        </button>
      </div>
    </article>
  `).join("");
}

/* ------------------------------
   ÉVÉNEMENTS ET INITIALISATION
------------------------------ */

function bindEvent(id, eventName, handler) {
  const element = $(id);

  if (element) {
    element.addEventListener(eventName, handler);
  }
}

function initApp() {
  bindEvent("login-form", "submit", login);
  bindEvent("signup-button", "click", signup);
  bindEvent("reset-password-button", "click", resetPassword);
  bindEvent("logout-button", "click", logout);

  bindEvent("student-form", "submit", saveStudent);
  bindEvent("add-student-button", "click", () => openStudentForm());
  bindEvent("cancel-student-button", "click", closeStudentForm);
  bindEvent("student-search", "input", searchStudents);

  bindEvent("lesson-form", "submit", saveLesson);
  bindEvent("add-lesson-button", "click", () => openLessonForm());
  bindEvent("cancel-lesson-button", "click", closeLessonForm);

  bindEvent("document-form", "submit", uploadDocument);
  bindEvent("back-to-students-button", "click", backToStudents);
  bindEvent("back-to-lessons-button", "click", backToLessons);

  db.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    updateAuthView();

    if (currentUser) {
      // Évite de bloquer le callback d'authentification.
      setTimeout(() => loadStudents(), 0);
    } else {
      students = [];
      lessons = [];
      documents = [];
      currentStudent = null;
      currentLesson = null;
    }
  });

  checkSession();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

/* Fonctions utilisées par les boutons HTML. */
window.login = login;
window.signup = signup;
window.logout = logout;
window.resetPassword = resetPassword;
window.loadStudents = loadStudents;
window.openStudentForm = openStudentForm;
window.editStudent = editStudent;
window.saveStudent = saveStudent;
window.deleteStudent = deleteStudent;
window.openStudentProfile = openStudentProfile;
window.backToStudents = backToStudents;
window.openLessonForm = openLessonForm;
window.editLesson = editLesson;
window.saveLesson = saveLesson;
window.deleteLesson = deleteLesson;
window.openLessonDocuments = openLessonDocuments;
window.uploadDocument = uploadDocument;
window.openPdf = openPdf;
window.deleteDocument = deleteDocument;
window.backToLessons = backToLessons;
window.searchStudents = searchStudents;
