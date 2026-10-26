
(() => {
  "use strict";

  // =========================================================
  // 1. CONFIGURATION SUPABASE
  // =========================================================

  const SUPABASE_URL = "https://hztywwjrjkihivupcmad.supabase.co";
  const SUPABASE_KEY = "sb_publishable_am_wEiQkh4F-9VhIUC0LFg_zux-_jgu";

  const TABLE_STUDENTS = "Students";
  const TABLE_LESSONS = "Lessons";
  const TABLE_DOCUMENTS = "Lessons_documents";
  const STORAGE_BUCKET = "lesson-pdfs";

  if (!window.supabase || !window.supabase.createClient) {
    document.getElementById("app").innerHTML =
      "<p>Impossible de charger Supabase. Vérifie ta connexion internet.</p>";
    return;
  }

  const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  const state = {
    user: null,
    students: [],
    student: null,
    lessons: [],
    lesson: null,
    documents: [],
    search: ""
  };

  const app = document.getElementById("app");

  // =========================================================
  // 2. OUTILS
  // =========================================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function value(id) {
    return byId(id)?.value?.trim() ?? "";
  }

  function notify(message, isError = false) {
    const box = byId("notice");

    if (box) {
      box.textContent = message;
      box.className = isError ? "notice error" : "notice";
      box.hidden = false;
    } else {
      alert(message);
    }
  }

  function dateToday() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function formatDate(date) {
    if (!date) return "Non renseignée";

    const parsed = new Date(`${date}T00:00:00`);

    return Number.isNaN(parsed.getTime())
      ? String(date)
      : parsed.toLocaleDateString("fr-FR");
  }

  function actionButton(label, action, style = "") {
    return `
      <button type="button"
        class="btn ${style}"
        data-action="${escapeHTML(action)}">
        ${escapeHTML(label)}
      </button>
    `;
  }

  function textField(id, label, currentValue = "", type = "text", extra = "") {
    return `
      <label class="field">
        <span>${escapeHTML(label)}</span>
        <input id="${id}" type="${type}"
          value="${escapeHTML(currentValue)}" ${extra}>
      </label>
    `;
  }

  function textArea(id, label, currentValue = "") {
    return `
      <label class="field">
        <span>${escapeHTML(label)}</span>
        <textarea id="${id}" rows="4">${escapeHTML(currentValue)}</textarea>
      </label>
    `;
  }

  function page(content) {
    app.innerHTML = `
      <header class="app-header">
        <div>
          <h1>NSK Éducation</h1>
          <p>Suivi pédagogique</p>
        </div>
        ${state.user ? `
          <div class="header-user">
            <span>${escapeHTML(state.user.email || "")}</span>
            ${actionButton("Déconnexion", "logout", "secondary")}
          </div>
        ` : ""}
      </header>

      <main class="app-main">
        <div id="notice" class="notice" hidden></div>
        ${content}
      </main>
    `;
  }

  function showLoading(message = "Chargement...") {
    page(`<section class="card"><p>${escapeHTML(message)}</p></section>`);
  }

  function reportError(context, error) {
    console.error(context, error);
    notify(`${context} : ${error?.message || "Erreur inconnue"}`, true);
  }

  function requireStudent() {
    if (!state.student) {
      notify("Sélectionne d'abord un élève.", true);
      return false;
    }
    return true;
  }

  function requireLesson() {
    if (!state.lesson) {
      notify("Sélectionne d'abord une séance.", true);
      return false;
    }
    return true;
  }

  // =========================================================
  // 3. CONNEXION ET INSCRIPTION
  // =========================================================

  function renderLogin() {
    page(`
      <section class="card auth-card">
        <h2>Bienvenue sur NSK Éducation</h2>
        <p>Connecte-toi pour retrouver tes élèves et leurs séances.</p>

        <form id="login-form">
          ${textField("auth-email", "Adresse e-mail", "", "email", "required")}
          ${textField("auth-password", "Mot de passe", "", "password", "required")}

          <div class="actions">
            <button class="btn" type="submit">Se connecter</button>
            ${actionButton("Créer un compte", "signup", "secondary")}
          </div>

          ${actionButton("Mot de passe oublié ?", "reset-password", "link-button")}
        </form>
      </section>
    `);
  }

  async function login(event) {
    event.preventDefault();

    const email = value("auth-email");
    const password = byId("auth-password")?.value || "";

    if (!email || !password) {
      notify("Renseigne ton e-mail et ton mot de passe.", true);
      return;
    }

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      reportError("Connexion impossible", error);
      return;
    }

    state.user = data.user;
    await loadStudents();
  }

  async function signup() {
    const email = value("auth-email");
    const password = byId("auth-password")?.value || "";

    if (!email || !password) {
      notify("Renseigne ton e-mail et ton mot de passe.", true);
      return;
    }

    const { data, error } = await db.auth.signUp({
      email,
      password
    });

    if (error) {
      reportError("Création du compte impossible", error);
      return;
    }

    if (data.session) {
      state.user = data.user;
      await loadStudents();
    } else {
      notify("Compte créé. Vérifie tes e-mails pour confirmer l'inscription.");
    }
  }

  async function resetPassword() {
    const email = value("auth-email");

    if (!email) {
      notify("Saisis d'abord ton adresse e-mail.", true);
      return;
    }

    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });

    if (error) {
      reportError("Réinitialisation impossible", error);
      return;
    }

    notify("E-mail de réinitialisation envoyé.");
  }

  async function logout() {
    const { error } = await db.auth.signOut();

    if (error) {
      reportError("Déconnexion impossible", error);
      return;
    }

    state.user = null;
    state.students = [];
    state.student = null;
    state.lessons = [];
    state.lesson = null;
    state.documents = [];

    renderLogin();
  }

  // =========================================================
  // 4. ÉLÈVES : AFFICHAGE ET RECHERCHE
  // =========================================================

  async function loadStudents() {
    showLoading("Chargement des élèves...");

    const { data, error } = await db
      .from(TABLE_STUDENTS)
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      reportError("Chargement des élèves impossible", error);
      return;
    }

    state.students = data || [];
    renderStudents();
  }

  function renderStudents() {
    const filtered = state.students.filter(student => {
      const query = state.search.toLowerCase();

      return (
        String(student.name || "").toLowerCase().includes(query) ||
        String(student.class || "").toLowerCase().includes(query)
      );
    });

    page(`
      <section>
        <div class="section-heading">
          <div>
            <h2>Mes élèves</h2>
            <p>${state.students.length} élève(s) enregistré(s)</p>
          </div>
          ${actionButton("+ Ajouter un élève", "new-student")}
        </div>

        <label class="field">
          <span>Rechercher un élève</span>
          <input id="student-search" type="search"
            placeholder="Nom ou classe..."
            value="${escapeHTML(state.search)}">
        </label>

        <div class="cards-grid">
          ${filtered.length ? filtered.map(student => `
            <article class="card student-card">
              <h3>${escapeHTML(student.name)}</h3>
              <p>Classe : ${escapeHTML(student.class || "Non renseignée")}</p>

              <div class="actions">
                ${actionButton("Voir le profil", `student:${student.id}`)}
                ${actionButton("Modifier", `edit-student:${student.id}`, "secondary")}
                ${actionButton("Supprimer", `delete-student:${student.id}`, "danger")}
              </div>
            </article>
          `).join("") : "<p>Aucun élève trouvé.</p>"}
        </div>

        <section id="student-editor"></section>
      </section>
    `);
  }

  // =========================================================
  // 5. ÉLÈVES : CRÉATION ET MODIFICATION
  // =========================================================

  function renderStudentForm(student = null) {
    const target = byId("student-editor");
    if (!target) return;

    target.innerHTML = `
      <section class="card">
        <h3>${student ? "Modifier l'élève" : "Ajouter un élève"}</h3>

        <form id="student-form" data-id="${escapeHTML(student?.id ?? "")}">
          ${textField("student-name", "Nom de l'élève", student?.name || "", "text", "required")}
          ${textField("student-class", "Classe", student?.class || "")}

          <div class="actions">
            <button class="btn" type="submit">Enregistrer</button>
            ${actionButton("Annuler", "cancel-editor", "secondary")}
          </div>
        </form>
      </section>
    `;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveStudent(event) {
    event.preventDefault();

    const id = event.currentTarget.dataset.id;
    const name = value("student-name");
    const studentClass = value("student-class");

    if (!name) {
      notify("Le nom de l'élève est obligatoire.", true);
      return;
    }

    const values = {
      name,
      class: studentClass || null
    };

    const result = id
      ? await db.from(TABLE_STUDENTS).update(values).eq("id", id)
      : await db.from(TABLE_STUDENTS).insert(values);

    if (result.error) {
      reportError("Enregistrement de l'élève impossible", result.error);
      return;
    }

    notify("Élève enregistré.");
    await loadStudents();
  }

  async function deleteStudent(id) {
    const student = state.students.find(s => String(s.id) === String(id));
    if (!student) return;

    if (!confirm(`Supprimer l'élève « ${student.name} » ?`)) return;

    const { error } = await db
      .from(TABLE_STUDENTS)
      .delete()
      .eq("id", id);

    if (error) {
      reportError(
        "Suppression impossible. Vérifie si des séances sont encore liées à cet élève",
        error
      );
      return;
    }

    notify("Élève supprimé.");
    state.student = null;
    await loadStudents();
  }

  // =========================================================
  // 6. PROFIL DE L'ÉLÈVE ET SES SÉANCES
  // =========================================================

  async function openStudent(id) {
    state.student = state.students.find(s => String(s.id) === String(id));

    if (!state.student) {
      notify("Élève introuvable.", true);
      return;
    }

    state.lesson = null;
    await loadLessons();
  }

  async function loadLessons() {
    if (!requireStudent()) return;

    showLoading("Chargement des séances...");

    const { data, error } = await db
      .from(TABLE_LESSONS)
      .select("*")
      .eq("student_id", state.student.id)
      .order("lesson_date", { ascending: false });

    if (error) {
      reportError(
        "Chargement des séances impossible. Vérifie la colonne student_id dans Lessons",
        error
      );
      return;
    }

    state.lessons = data || [];
    renderLessons();
  }

  function renderLessons() {
    const student = state.student;

    page(`
      ${actionButton("← Retour aux élèves", "back-students", "secondary")}

      <section>
        <h2>${escapeHTML(student.name)}</h2>
        <p>Classe : ${escapeHTML(student.class || "Non renseignée")}</p>

        <div class="section-heading">
          <h3>Séances de l'élève</h3>
          ${actionButton("+ Ajouter une séance", "new-lesson")}
        </div>

        <div class="cards-grid">
          ${state.lessons.length ? state.lessons.map(lesson => `
            <article class="card lesson-card">
              <h3>${escapeHTML(lesson.title)}</h3>
              <p>Matière : ${escapeHTML(lesson.subject || "Non renseignée")}</p>
              <p>Date : ${escapeHTML(formatDate(lesson.lesson_date))}</p>
              <p>Durée : ${escapeHTML(lesson.duration_minutes || "—")} minutes</p>

              <div class="lesson-content">
                <p>${escapeHTML(lesson.content || "")}</p>
                <p><strong>Conclusion :</strong> ${escapeHTML(lesson.conclusion || "—")}</p>
              </div>

              <div class="actions">
                ${actionButton("Documents PDF", `documents:${lesson.id}`)}
                ${actionButton("Modifier", `edit-lesson:${lesson.id}`, "secondary")}
                ${actionButton("Supprimer", `delete-lesson:${lesson.id}`, "danger")}
              </div>
            </article>
          `).join("") : "<p>Aucune séance enregistrée pour cet élève.</p>"}
        </div>

        <section id="lesson-editor"></section>
      </section>
    `);
  }

  // =========================================================
  // 7. SÉANCES : CRÉATION ET MODIFICATION
  // =========================================================

  function renderLessonForm(lesson = null) {
    const target = byId("lesson-editor");
    if (!target) return;

    target.innerHTML = `
      <section class="card">
        <h3>${lesson ? "Modifier la séance" : "Ajouter une séance"}</h3>

        <form id="lesson-form" data-id="${escapeHTML(lesson?.id ?? "")}">
          ${textField("lesson-title", "Titre", lesson?.title || "", "text", "required")}
          ${textField("lesson-subject", "Matière", lesson?.subject || "")}
          ${textField("lesson-date", "Date", lesson?.lesson_date || dateToday(), "date")}
          ${textField("lesson-duration", "Durée (minutes)", lesson?.duration_minutes || "", "number", 'min="0"')}
          ${textArea("lesson-content", "Contenu de la séance", lesson?.content || "")}
          ${textArea("lesson-conclusion", "Conclusion", lesson?.conclusion || "")}

          <div class="actions">
            <button class="btn" type="submit">Enregistrer la séance</button>
            ${actionButton("Annuler", "cancel-editor", "secondary")}
          </div>
        </form>
      </section>
    `;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveLesson(event) {
    event.preventDefault();

    if (!requireStudent()) return;

    const id = event.currentTarget.dataset.id;
    const title = value("lesson-title");

    if (!title) {
      notify("Le titre de la séance est obligatoire.", true);
      return;
    }

    const values = {
      student_id: state.student.id,
      title,
      class: state.student.class || null,
      subject: value("lesson-subject") || null,
      lesson_date: value("lesson-date") || null,
      duration_minutes: value("lesson-duration") || null,
      content: value("lesson-content") || null,
      conclusion: value("lesson-conclusion") || null
    };

    const result = id
      ? await db.from(TABLE_LESSONS)
          .update(values)
          .eq("id", id)
          .eq("student_id", state.student.id)
      : await db.from(TABLE_LESSONS).insert(values);

    if (result.error) {
      reportError("Enregistrement de la séance impossible", result.error);
      return;
    }

    notify("Séance enregistrée.");
    await loadLessons();
  }

  async function deleteLesson(id) {
    const lesson = state.lessons.find(l => String(l.id) === String(id));
    if (!lesson) return;

    if (!confirm(`Supprimer la séance « ${lesson.title} » et ses PDF ?`)) return;

    const { data: docs, error: listError } = await db
      .from(TABLE_DOCUMENTS)
      .select("*")
      .eq("lesson_id", id);

    if (listError) {
      reportError("Impossible de charger les documents associés", listError);
      return;
    }

    const paths = (docs || []).map(doc => doc.file_path).filter(Boolean);

    if (paths.length) {
      const { error } = await db.storage.from(STORAGE_BUCKET).remove(paths);

      if (error) {
        reportError("Suppression des PDF impossible", error);
        return;
      }
    }

    const { error: docsError } = await db
      .from(TABLE_DOCUMENTS)
      .delete()
      .eq("lesson_id", id);

    if (docsError) {
      reportError("Suppression des références PDF impossible", docsError);
      return;
    }

    const { error } = await db
      .from(TABLE_LESSONS)
      .delete()
      .eq("id", id)
      .eq("student_id", state.student.id);

    if (error) {
      reportError("Suppression de la séance impossible", error);
      return;
    }

    notify("Séance supprimée.");
    await loadLessons();
  }

  // =========================================================
  // 8. DOCUMENTS PDF : AFFICHAGE
  // =========================================================

  async function openDocuments(id) {
    state.lesson = state.lessons.find(l => String(l.id) === String(id));

    if (!state.lesson) {
      notify("Séance introuvable.", true);
      return;
    }

    const { data, error } = await db
      .from(TABLE_DOCUMENTS)
      .select("*")
      .eq("lesson_id", state.lesson.id)
      .order("created_at", { ascending: false });

    if (error) {
      reportError("Chargement des documents impossible", error);
      return;
    }

    state.documents = data || [];
    renderDocuments();
  }

  function renderDocuments() {
    page(`
      ${actionButton("← Retour aux séances", "back-lessons", "secondary")}

      <section>
        <h2>Documents PDF</h2>
        <p>Élève : ${escapeHTML(state.student.name)}</p>
        <p>Séance : ${escapeHTML(state.lesson.title)}</p>

        <section class="card">
          <h3>Ajouter un PDF</h3>

          <form id="document-form">
            ${textField("document-file", "Fichier PDF", "", "file", 'accept=".pdf,application/pdf" required')}
            ${textField("document-type", "Type de document (facultatif)")}
            <button class="btn" type="submit">Importer le PDF</button>
          </form>
        </section>

        <h3>Documents associés</h3>

        <div class="cards-grid">
          ${state.documents.length ? state.documents.map(doc => `
            <article class="card">
              <h4>${escapeHTML(doc.file_name || "Document PDF")}</h4>
              <p>Type : ${escapeHTML(doc.document_type || "Non précisé")}</p>
              ${actionButton("Ouvrir le PDF", `open-pdf:${doc.id}`)}
              ${actionButton("Supprimer", `delete-pdf:${doc.id}`, "danger")}
            </article>
          `).join("") : "<p>Aucun PDF pour cette séance.</p>"}
        </div>
      </section>
    `);
  }

  // =========================================================
  // 9. DOCUMENTS PDF : IMPORT
  // =========================================================

  async function uploadPdf(event) {
    event.preventDefault();

    if (!requireStudent() || !requireLesson()) return;

    const file = byId("document-file")?.files?.[0];
    const type = value("document-type");

    if (!file) {
      notify("Choisis un fichier PDF.", true);
      return;
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      notify("Seuls les fichiers PDF sont acceptés.", true);
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath =
      `${state.student.id}/${state.lesson.id}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        contentType: "application/pdf",
        upsert: false
      });

    if (uploadError) {
      reportError("Import du PDF impossible", uploadError);
      return;
    }

    const { error: insertError } = await db
      .from(TABLE_DOCUMENTS)
      .insert({
        lesson_id: state.lesson.id,
        file_name: file.name,
        file_path: filePath,
        document_type: type || null,
        lesson_title: state.lesson.title
      });

    if (insertError) {
      await db.storage.from(STORAGE_BUCKET).remove([filePath]);
      reportError("Enregistrement du document impossible", insertError);
      return;
    }

    notify("PDF importé avec succès.");
    await openDocuments(state.lesson.id);
  }

  // =========================================================
  // 10. DOCUMENTS PDF : OUVERTURE ET SUPPRESSION
  // =========================================================

  async function openPdf(id) {
    const doc = state.documents.find(d => String(d.id) === String(id));

    if (!doc || !doc.file_path) {
      notify("Chemin du PDF introuvable.", true);
      return;
    }

    const { data, error } = await db.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(doc.file_path, 300);

    if (error) {
      reportError("Ouverture du PDF impossible", error);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deletePdf(id) {
    const doc = state.documents.find(d => String(d.id) === String(id));

    if (!doc) return;

    if (!confirm(`Supprimer le document « ${doc.file_name} » ?`)) return;

    const { error: storageError } = await db.storage
      .from(STORAGE_BUCKET)
      .remove([doc.file_path]);

    if (storageError) {
      reportError("Suppression du fichier impossible", storageError);
      return;
    }

    const { error } = await db
      .from(TABLE_DOCUMENTS)
      .delete()
      .eq("id", id)
      .eq("lesson_id", state.lesson.id);

    if (error) {
      reportError("Suppression de la référence impossible", error);
      return;
    }

    notify("PDF supprimé.");
    await openDocuments(state.lesson.id);
  }

  // =========================================================
  // 11. ÉVÉNEMENTS DE L'INTERFACE
  // =========================================================

  app.addEventListener("submit", async event => {
    try {
      if (event.target.id === "login-form") await login(event);
      if (event.target.id === "student-form") await saveStudent(event);
      if (event.target.id === "lesson-form") await saveLesson(event);
      if (event.target.id === "document-form") await uploadPdf(event);
    } catch (error) {
      reportError("Une erreur est survenue", error);
    }
  });

  app.addEventListener("input", event => {
    if (event.target.id === "student-search") {
      state.search = event.target.value;
      renderStudents();

      const search = byId("student-search");
      if (search) {
        search.focus();
        search.setSelectionRange(search.value.length, search.value.length);
      }
    }
  });

  app.addEventListener("click", async event => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    try {
      if (action === "logout") return await logout();
      if (action === "signup") return await signup();
      if (action === "reset-password") return await resetPassword();

      if (action === "new-student") return renderStudentForm();

      if (action === "cancel-editor") {
        return state.student ? renderLessons() : renderStudents();
      }

      if (action === "new-lesson") return renderLessonForm();

      if (action === "back-students") {
        state.student = null;
        state.lesson = null;
        return renderStudents();
      }

      if (action === "back-lessons") {
        state.lesson = null;
        return renderLessons();
      }

      const separator = action.indexOf(":");
      const type = separator === -1 ? action : action.slice(0, separator);
      const id = separator === -1 ? "" : action.slice(separator + 1);

      if (type === "student") return await openStudent(id);

      if (type === "edit-student") {
        const student = state.students.find(s => String(s.id) === String(id));
        return renderStudentForm(student);
      }

      if (type === "delete-student") return await deleteStudent(id);

      if (type === "edit-lesson") {
        const lesson = state.lessons.find(l => String(l.id) === String(id));
        return renderLessonForm(lesson);
      }

      if (type === "delete-lesson") return await deleteLesson(id);
      if (type === "documents") return await openDocuments(id);
      if (type === "open-pdf") return await openPdf(id);
      if (type === "delete-pdf") return await deletePdf(id);
    } catch (error) {
      reportError("Action impossible", error);
    }
  });

  // =========================================================
  // 12. DÉMARRAGE DE L'APPLICATION
  // =========================================================

  async function start() {
    renderLogin();

    const { data, error } = await db.auth.getSession();

    if (error) {
      reportError("Vérification de la session impossible", error);
      return;
    }

    state.user = data.session?.user || null;

    if (state.user) {
      await loadStudents();
    } else {
      renderLogin();
    }

    db.auth.onAuthStateChange((_event, session) => {
      state.user = session?.user || null;

      if (!state.user) {
        state.students = [];
        state.student = null;
        state.lessons = [];
        state.lesson = null;
        state.documents = [];
        renderLogin();
      }
    });
  }

  start();
})();
