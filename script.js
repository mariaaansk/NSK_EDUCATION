
(() => {
  "use strict";

  // CONFIGURATION SUPABASE
  const SUPABASE_URL = "https://hztywwjrjkihivupcmad.supabase.co";
  const SUPABASE_KEY = "sb_publishable_am_wEiQkh4F-9VhIUC0LFg_zux-_jgu";

  const TABLES = {
    students: "Students",
    lessons: "Lessons",
    documents: "Lessons_documents"
  };

  const BUCKET = "lesson-pdfs";

  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  const state = {
    user: null,
    students: [],
    student: null,
    lessons: [],
    lesson: null,
    documents: []
  };

  const app = document.getElementById("app");

  if (!app) {
    console.error("Élément #app introuvable.");
    return;
  }

  // OUTILS
  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  const formatDate = value => {
    if (!value) return "Non renseignée";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("fr-FR");
  };

  function notify(message, error = false) {
    const box = document.getElementById("notice");
    if (box) {
      box.textContent = message;
      box.className = error ? "notice error" : "notice";
      box.hidden = false;
    } else {
      alert(message);
    }
  }

  function input(id, label, value = "", type = "text", extra = "") {
    return `
      <label class="field">
        <span>${escapeHTML(label)}</span>
        <input id="${id}" type="${type}"
          value="${escapeHTML(value)}" ${extra}>
      </label>`;
  }

  function textarea(id, label, value = "") {
    return `
      <label class="field">
        <span>${escapeHTML(label)}</span>
        <textarea id="${id}" rows="4">${escapeHTML(value)}</textarea>
      </label>`;
  }

  function button(label, action, cls = "") {
    return `<button type="button" class="${cls}"
      data-action="${action}">${escapeHTML(label)}</button>`;
  }

  function dateToday() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function setView(html) {
    app.innerHTML = `
      <header class="app-header">
        <h1>NSK Éducation</h1>
        ${state.user ? `
          <span>${escapeHTML(state.user.email || "")}</span>
          ${button("Déconnexion", "logout", "secondary")}
        ` : ""}
      </header>
      <main class="app-main">
        <div id="notice" class="notice" hidden></div>
        ${html}
      </main>
    `;
  }

  function showLoading(message = "Chargement...") {
    setView(`<section class="card"><p>${escapeHTML(message)}</p></section>`);
  }

  function showError(context, error) {
    console.error(context, error);
    notify(`${context} : ${error?.message || "Erreur inconnue"}`, true);
  }

  // AUTHENTIFICATION
  function renderLogin() {
    setView(`
      <section class="card auth-card">
        <h2>Bienvenue</h2>
        <p>Connecte-toi à ton espace NSK Éducation.</p>
        <form id="login-form">
          ${input("email", "Adresse e-mail", "", "email", "required")}
          ${input("password", "Mot de passe", "", "password", "required")}
          <div class="actions">
            <button type="submit">Se connecter</button>
            <button type="button" data-action="signup"
              class="secondary">Créer un compte</button>
          </div>
          <button type="button" data-action="reset-password"
            class="link-button">Mot de passe oublié ?</button>
        </form>
      </section>
    `);
  }

  async function login(event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) return notify(error.message, true);

    state.user = data.user;
    await loadStudents();
  }

  async function signup() {
    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value;

    if (!email || !password) {
      return notify("Renseigne ton e-mail et ton mot de passe.", true);
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) return notify(error.message, true);

    if (data.session) {
      state.user = data.user;
      await loadStudents();
    } else {
      notify("Compte créé. Vérifie tes e-mails pour confirmer l'inscription.");
    }
  }

  async function resetPassword() {
    const email = document.getElementById("email")?.value.trim();

    if (!email) {
      return notify("Saisis ton adresse e-mail d'abord.", true);
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname
    });

    if (error) return notify(error.message, true);
    notify("E-mail de réinitialisation envoyé.");
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) return notify(error.message, true);

    state.user = null;
    state.students = [];
    state.student = null;
    state.lessons = [];
    state.lesson = null;
    state.documents = [];
    renderLogin();
  }

  // ÉLÈVES
  async function loadStudents() {
    showLoading("Chargement des élèves...");

    const { data, error } = await supabase
      .from(TABLES.students)
      .select("*")
      .order("name", { ascending: true });

    if (error) return showError("Chargement des élèves impossible", error);

    state.students = data || [];
    renderStudents();
  }

  function renderStudents() {
    setView(`
      <section>
        <div class="section-heading">
          <div>
            <h2>Mes élèves</h2>
            <p>${state.students.length} élève(s)</p>
          </div>
          ${button("＋ Ajouter un élève", "new-student")}
        </div>

        <input id="student-search" placeholder="Rechercher un élève...">

        <div id="student-list" class="cards-grid">
          ${state.students.length ? state.students.map(student => `
            <article class="card student-card">
              <h3>${escapeHTML(student.name)}</h3>
              <p>Classe : ${escapeHTML(student.class || "Non renseignée")}</p>
              <div class="actions">
                ${button("Voir les séances", `student:${student.id}`)}
                ${button("Modifier", `edit-student:${student.id}`, "secondary")}
                ${button("Supprimer", `delete-student:${student.id}`, "danger")}
              </div>
            </article>
          `).join("") : "<p>Aucun élève enregistré.</p>"}
        </div>

        <section id="student-editor"></section>
      </section>
    `);
  }

  function renderStudentEditor(student = null) {
    const target = document.getElementById("student-editor");
    if (!target) return;

    target.innerHTML = `
      <section class="card">
        <h3>${student ? "Modifier l'élève" : "Ajouter un élève"}</h3>
        <form id="student-form" data-id="${student?.id ?? ""}">
          ${input("student-name", "Nom de l'élève", student?.name || "", "text", "required")}
          ${input("student-class", "Classe", student?.class || "")}
          <div class="actions">
            <button type="submit">Enregistrer</button>
            ${button("Annuler", "cancel-editor", "secondary")}
          </div>
        </form>
      </section>
    `;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveStudent(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const id = form.dataset.id;
    const name = document.getElementById("student-name").value.trim();
    const studentClass = document.getElementById("student-class").value.trim();

    if (!name) return notify("Le nom est obligatoire.", true);

    const values = {
      name,
      class: studentClass || null
    };

    const result = id
      ? await supabase.from(TABLES.students).update(values).eq("id", id)
      : await supabase.from(TABLES.students).insert(values);

    if (result.error) return showError("Enregistrement impossible", result.error);

    notify("Élève enregistré.");
    await loadStudents();
  }

  async function deleteStudent(id) {
    const student = state.students.find(s => String(s.id) === String(id));
    if (!student) return;

    if (!confirm(`Supprimer l'élève « ${student.name} » ?`)) return;

    const { error } = await supabase
      .from(TABLES.students)
      .delete()
      .eq("id", id);

    if (error) {
      return showError(
        "Suppression impossible. Vérifie si des séances sont encore liées à cet élève",
        error
      );
    }

    state.student = null;
    notify("Élève supprimé.");
    await loadStudents();
  }

  // SÉANCES
  async function openStudent(id) {
    state.student = state.students.find(s => String(s.id) === String(id));
    if (!state.student) return;

    state.lesson = null;
    await loadLessons();
  }

  async function loadLessons() {
    if (!state.student) return;

    showLoading("Chargement des séances...");

    const { data, error } = await supabase
      .from(TABLES.lessons)
      .select("*")
      .eq("student_id", state.student.id)
      .order("lesson_date", { ascending: false });

    if (error) {
      return showError(
        "Chargement des séances impossible. Vérifie la colonne student_id dans Lessons",
        error
      );
    }

    state.lessons = data || [];
    renderLessons();
  }

  function renderLessons() {
    const student = state.student;

    setView(`
      ${button("← Retour aux élèves", "back-students", "secondary")}
      <section>
        <h2>${escapeHTML(student.name)}</h2>
        <p>Classe : ${escapeHTML(student.class || "Non renseignée")}</p>

        <div class="section-heading">
          <h3>Séances</h3>
          ${button("＋ Ajouter une séance", "new-lesson")}
        </div>

        <div class="cards-grid">
          ${state.lessons.length ? state.lessons.map(lesson => `
            <article class="card">
              <h3>${escapeHTML(lesson.title)}</h3>
              <p>${escapeHTML(lesson.subject || "Matière non renseignée")}</p>
              <p>${escapeHTML(formatDate(lesson.lesson_date))}</p>
              <p>Durée : ${escapeHTML(lesson.duration_minutes || "—")} min</p>
              <p>${escapeHTML(lesson.content || "")}</p>
              <p><strong>Conclusion :</strong> ${escapeHTML(lesson.conclusion || "—")}</p>
              <div class="actions">
                ${button("Documents PDF", `documents:${lesson.id}`)}
                ${button("Modifier", `edit-lesson:${lesson.id}`, "secondary")}
                ${button("Supprimer", `delete-lesson:${lesson.id}`, "danger")}
              </div>
            </article>
          `).join("") : "<p>Aucune séance pour cet élève.</p>"}
        </div>
        <section id="lesson-editor"></section>
      </section>
    `);
  }

  function renderLessonEditor(lesson = null) {
    const target = document.getElementById("lesson-editor");
    if (!target) return;

    target.innerHTML = `
      <section class="card">
        <h3>${lesson ? "Modifier la séance" : "Nouvelle séance"}</h3>
        <form id="lesson-form" data-id="${lesson?.id ?? ""}">
          ${input("lesson-title", "Titre", lesson?.title || "", "text", "required")}
          ${input("lesson-subject", "Matière", lesson?.subject || "")}
          ${input("lesson-date", "Date", lesson?.lesson_date || dateToday(), "date")}
          ${input("lesson-duration", "Durée (minutes)", lesson?.duration_minutes || "", "number", 'min="0"')}
          ${textarea("lesson-content", "Contenu", lesson?.content || "")}
          ${textarea("lesson-conclusion", "Conclusion", lesson?.conclusion || "")}
          <div class="actions">
            <button type="submit">Enregistrer la séance</button>
            ${button("Annuler", "cancel-editor", "secondary")}
          </div>
        </form>
      </section>
    `;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveLesson(event) {
    event.preventDefault();

    const id = event.currentTarget.dataset.id;
    const title = document.getElementById("lesson-title").value.trim();

    if (!title) return notify("Le titre est obligatoire.", true);

    const values = {
      student_id: state.student.id,
      title,
      class: state.student.class || null,
      subject: document.getElementById("lesson-subject").value.trim() || null,
      lesson_date: document.getElementById("lesson-date").value || null,
      duration_minutes: document.getElementById("lesson-duration").value || null,
      content: document.getElementById("lesson-content").value.trim() || null,
      conclusion: document.getElementById("lesson-conclusion").value.trim() || null
    };

    const result = id
      ? await supabase.from(TABLES.lessons)
          .update(values).eq("id", id).eq("student_id", state.student.id)
      : await supabase.from(TABLES.lessons).insert(values);

    if (result.error) return showError("Enregistrement de la séance impossible", result.error);

    notify("Séance enregistrée.");
    await loadLessons();
  }

  async function deleteLesson(id) {
    const lesson = state.lessons.find(l => String(l.id) === String(id));
    if (!lesson || !confirm(`Supprimer la séance « ${lesson.title} » et ses PDF ?`)) return;

    const { data: docs, error: listError } = await supabase
      .from(TABLES.documents)
      .select("*")
      .eq("lesson_id", id);

    if (listError) return showError("Lecture des documents impossible", listError);

    const paths = (docs || []).map(d => d.file_path).filter(Boolean);

    if (paths.length) {
      const { error } = await supabase.storage.from(BUCKET).remove(paths);
      if (error) return showError("Suppression des fichiers impossible", error);
    }

    const { error: docsError } = await supabase
      .from(TABLES.documents)
      .delete()
      .eq("lesson_id", id);

    if (docsError) return showError("Suppression des références PDF impossible", docsError);

    const { error } = await supabase
      .from(TABLES.lessons)
      .delete()
      .eq("id", id)
      .eq("student_id", state.student.id);

    if (error) return showError("Suppression de la séance impossible", error);

    notify("Séance supprimée.");
    await loadLessons();
  }

  // DOCUMENTS PDF
  async function openDocuments(id) {
    state.lesson = state.lessons.find(l => String(l.id) === String(id));
    if (!state.lesson) return;

    const { data, error } = await supabase
      .from(TABLES.documents)
      .select("*")
      .eq("lesson_id", state.lesson.id)
      .order("created_at", { ascending: false });

    if (error) return showError("Chargement des PDF impossible", error);

    state.documents = data || [];
    renderDocuments();
  }

  function renderDocuments() {
    setView(`
      ${button("← Retour aux séances", "back-lessons", "secondary")}
      <section>
        <h2>Documents PDF</h2>
        <p>Élève : ${escapeHTML(state.student.name)}</p>
        <p>Séance : ${escapeHTML(state.lesson.title)}</p>

        <section class="card">
          <form id="document-form">
            ${input("document-file", "Choisir un PDF", "", "file", 'accept="application/pdf,.pdf" required')}
            ${input("document-type", "Type de document (facultatif)")}
            <button type="submit">Envoyer le PDF</button>
          </form>
        </section>

        <div class="cards-grid">
          ${state.documents.length ? state.documents.map(doc => `
            <article class="card">
              <h3>${escapeHTML(doc.file_name || "Document PDF")}</h3>
              <p>${escapeHTML(doc.document_type || "Document")}</p>
              ${button("Ouvrir", `open-pdf:${doc.id}`)}
              ${button("Supprimer", `delete-pdf:${doc.id}`, "danger")}
            </article>
          `).join("") : "<p>Aucun document associé à cette séance.</p>"}
        </div>
      </section>
    `);
  }

  async function uploadPdf(event) {
    event.preventDefault();

    const file = document.getElementById("document-file").files[0];
    const type = document.getElementById("document-type").value.trim();

    if (!file) return notify("Choisis un fichier PDF.", true);

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return notify("Le fichier doit être au format PDF.", true);
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${state.student.id}/${state.lesson.id}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: "application/pdf", upsert: false });

    if (uploadError) return showError("Envoi du PDF impossible", uploadError);

    const { error: insertError } = await supabase
      .from(TABLES.documents)
      .insert({
        lesson_id: state.lesson.id,
        file_name: file.name,
        file_path: path,
        document_type: type || null,
        lesson_title: state.lesson.title
      });

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([path]);
      return showError("Enregistrement du document impossible", insertError);
    }

    notify("PDF ajouté.");
    await openDocuments(state.lesson.id);
  }

  async function openPdf(id) {
    const doc = state.documents.find(d => String(d.id) === String(id));
    if (!doc?.file_path) return notify("Chemin du PDF introuvable.", true);

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.file_path, 300);

    if (error) return showError("Ouverture du PDF impossible", error);

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deletePdf(id) {
    const doc = state.documents.find(d => String(d.id) === String(id));
    if (!doc || !confirm(`Supprimer « ${doc.file_name} » ?`)) return;

    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([doc.file_path]);

    if (storageError) return showError("Suppression du fichier impossible", storageError);

    const { error } = await supabase
      .from(TABLES.documents)
      .delete()
      .eq("id", id)
      .eq("lesson_id", state.lesson.id);

    if (error) return showError("Suppression de la référence impossible", error);

    notify("PDF supprimé.");
    await openDocuments(state.lesson.id);
  }

  // CLICS ET FORMULAIRES
  app.addEventListener("submit", async event => {
    try {
      if (event.target.id === "login-form") await login(event);
      if (event.target.id === "student-form") await saveStudent(event);
      if (event.target.id === "lesson-form") await saveLesson(event);
      if (event.target.id === "document-form") await uploadPdf(event);
    } catch (error) {
      showError("Une erreur inattendue s'est produite", error);
    }
  });

  app.addEventListener("input", event => {
    if (event.target.id !== "student-search") return;

    const search = event.target.value.toLowerCase();
    document.querySelectorAll("#student-list .student-card").forEach(card => {
      card.hidden = !card.textContent.toLowerCase().includes(search);
    });
  });

  app.addEventListener("click", async event => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    try {
      if (action === "logout") return await logout();
      if (action === "signup") return await signup();
      if (action === "reset-password") return await resetPassword();
      if (action === "new-student") return renderStudentEditor();
      if (action === "cancel-editor") {
        if (state.student) renderLessons();
        else renderStudents();
        return;
      }
      if (action === "new-lesson") return renderLessonEditor();
      if (action === "back-students") {
        state.student = null;
        return renderStudents();
      }
      if (action === "back-lessons") return renderLessons();

      const [type, id] = action.split(":");

      if (type === "student") return await openStudent(id);
      if (type === "edit-student") {
        const student = state.students.find(s => String(s.id) === String(id));
        return renderStudentEditor(student);
      }
      if (type === "delete-student") return await deleteStudent(id);
      if (type === "edit-lesson") {
        const lesson = state.lessons.find(l => String(l.id) === String(id));
        return renderLessonEditor(lesson);
      }
      if (type === "delete-lesson") return await deleteLesson(id);
      if (type === "documents") return await openDocuments(id);
      if (type === "open-pdf") return await openPdf(id);
      if (type === "delete-pdf") return await deletePdf(id);
    } catch (error) {
      showError("Action impossible", error);
    }
  });

  // DÉMARRAGE
  async function start() {
    if (!window.supabase?.createClient) {
      app.innerHTML = "<p>Impossible de charger Supabase. Vérifie ta connexion internet.</p>";
      return;
    }

    renderLogin();

    const { data, error } = await supabase.auth.getSession();

    if (error) return showError("Connexion à Supabase impossible", error);

    state.user = data.session?.user || null;

    if (state.user) {
      await loadStudents();
    } else {
      renderLogin();
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      state.user = session?.user || null;

      if (!state.user) {
        state.student = null;
        state.lesson = null;
        renderLogin();
      } else {
        loadStudents();
      }
    });
  }

  start();
})();
