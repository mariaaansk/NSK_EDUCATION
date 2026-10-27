
(() => {
  "use strict";

  // ============================================
  // CONFIGURATION SUPABASE
  // ============================================

  const SUPABASE_URL =
    "https://hztywwjrjkihivupcmad.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_am_wEiQkh4F-9VhIUC0LFg_zux-_jgu";

  const STUDENTS = "Students";
  const LESSONS = "Lessons";
  const DOCUMENTS = "Lessons_documents";
  const BUCKET = "lesson-pdfs";

  const app = document.getElementById("app");

  if (!app) {
    console.error("Élément #app introuvable.");
    return;
  }

  let db;
  let user = null;
  let students = [];
  let student = null;
  let lessons = [];
  let lesson = null;
  let documents = [];
  let search = "";
  let editingLessonId = null;

  // ============================================
  // OUTILS
  // ============================================

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  function formatDuration(minutes) {
    if (
      minutes === null ||
      minutes === undefined ||
      String(minutes).trim() === ""
    ) {
      return "Non renseignée";
    }

    const value = Number(minutes);

    if (!Number.isFinite(value) || value < 0) {
      return "Non renseignée";
    }

    if (!Number.isInteger(value)) {
      return `${value} minutes`;
    }

    if (value === 0) {
      return "0 minute";
    }

    const hours = Math.floor(value / 60);
    const remainingMinutes = value % 60;

    if (hours === 0) {
      return `${value} ${value === 1 ? "minute" : "minutes"}`;
    }

    if (remainingMinutes === 0) {
      return `${hours} ${hours === 1 ? "heure" : "heures"}`;
    }

    return `${hours} h ${remainingMinutes}`;
  }

  function notice(message, isError = false) {
    let box = document.getElementById("notice");

    if (!box) {
      box = document.createElement("div");
      box.id = "notice";
      app.prepend(box);
    }

    box.hidden = false;
    box.textContent = message;
    box.style.cssText = `
      margin: 16px 0;
      padding: 13px 16px;
      border-radius: 12px;
      background: ${isError ? "#fff0f2" : "#e9f9f2"};
      color: ${isError ? "#b52f49" : "#13775d"};
      overflow-wrap: anywhere;
    `;
  }

  function fail(context, error) {
    console.error(context, error);
    notice(
      context + " : " + (error?.message || String(error)),
      true
    );
  }

  function loading(message = "Chargement...") {
    app.innerHTML = `
      <main style="max-width:650px;margin:40px auto;padding:24px">
        <h1>NSK Éducation</h1>
        <p>${esc(message)}</p>
      </main>
    `;
  }

  // Champ de formulaire avec possibilité de préremplir une valeur.
  function field(
    name,
    label,
    type = "text",
    required = true,
    value = ""
  ) {
    return `
      <div class="form-group" style="margin:14px 0">
        <label for="${esc(name)}"
          style="display:block;margin-bottom:7px">
          ${esc(label)}
        </label>
        <input
          id="${esc(name)}"
          name="${esc(name)}"
          type="${esc(type)}"
          value="${esc(value)}"
          ${required ? "required" : ""}
          style="box-sizing:border-box;width:100%;padding:12px"
        >
      </div>
    `;
  }

  function btn(action, label, id = null, extra = "") {
    const idAttribute = id !== null
      ? `data-id="${esc(id)}"`
      : "";

    return `
      <button
        type="button"
        data-action="${esc(action)}"
        ${idAttribute}
        ${extra}
        style="padding:10px 14px;margin:4px;cursor:pointer"
      >${esc(label)}</button>
    `;
  }

  function shell(content) {
    app.innerHTML = `
      <header class="topbar"
        style="padding:18px;background:#202044;color:white">
        <h1 style="color:white;margin-top:0">
          NSK Éducation
        </h1>
        ${
          user
            ? `
              <p>Connecté : ${esc(user.email || "")}</p>
              ${btn("logout", "Se déconnecter")}
            `
            : ""
        }
      </header>

      <main class="dashboard-content"
        style="max-width:1100px;margin:auto;padding:24px">
        <div id="notice" hidden></div>
        ${content}
      </main>
    `;
  }

  function showNoticeAfterRender(message, isError = false) {
    notice(message, isError);
  }

  // ============================================
  // AUTHENTIFICATION
  // ============================================

  function showLogin(errorText = "") {
    app.innerHTML = `
      <main class="login-box"
        style="max-width:440px;margin:40px auto;padding:28px">
        <h1>NSK Éducation</h1>
        <p>Connecte-toi à ton espace pédagogique.</p>
        <div id="notice" hidden></div>

        <form id="login-form">
          ${field("email", "Adresse e-mail", "email")}
          ${field("password", "Mot de passe", "password")}

          <button type="submit" style="width:100%">
            Se connecter
          </button>
        </form>

        <p>${btn("signup-page", "Créer un compte")}</p>
        <p>${btn("reset-page", "Mot de passe oublié ?")}</p>
      </main>
    `;

    if (errorText) notice(errorText, true);
  }

  function showSignup() {
    app.innerHTML = `
      <main class="login-box"
        style="max-width:440px;margin:40px auto;padding:28px">
        <h1>Créer un compte</h1>
        <div id="notice" hidden></div>

        <form id="signup-form">
          ${field("email", "Adresse e-mail", "email")}
          ${field(
            "password",
            "Mot de passe (6 caractères minimum)",
            "password"
          )}

          <button type="submit">Créer mon compte</button>
        </form>

        ${btn("login-page", "Retour à la connexion")}
      </main>
    `;
  }

  function showReset() {
    app.innerHTML = `
      <main class="login-box"
        style="max-width:440px;margin:40px auto;padding:28px">
        <h1>Mot de passe oublié</h1>
        <p>Nous t'enverrons un lien de réinitialisation.</p>
        <div id="notice" hidden></div>

        <form id="reset-form">
          ${field("email", "Adresse e-mail", "email")}
          <button type="submit">Envoyer le lien</button>
        </form>

        ${btn("login-page", "Retour à la connexion")}
      </main>
    `;
  }

  async function login(form) {
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    loading("Connexion en cours...");

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showLogin(error.message);
      return;
    }

    user = data.user;
    await loadStudents();
  }

  async function signup(form) {
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    if (password.length < 6) {
      notice(
        "Le mot de passe doit contenir au moins 6 caractères.",
        true
      );
      return;
    }

    const { data, error } = await db.auth.signUp({
      email,
      password
    });

    if (error) {
      fail("Inscription impossible", error);
      return;
    }

    if (data.session) {
      user = data.user;
      await loadStudents();
    } else {
      showLogin(
        "Compte créé. Vérifie tes e-mails pour confirmer ton adresse."
      );
    }
  }

  async function resetPassword(form) {
    const email = form.elements.email.value.trim();

    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname
    });

    if (error) {
      fail("Envoi du lien impossible", error);
    } else {
      notice(
        "Si cette adresse est enregistrée, un e-mail sera envoyé."
      );
    }
  }

  async function logout() {
    const { error } = await db.auth.signOut();

    if (error) {
      fail("Déconnexion impossible", error);
      return;
    }

    user = null;
    students = [];
    student = null;
    lessons = [];
    lesson = null;
    documents = [];
    search = "";
    editingLessonId = null;

    showLogin();
  }

  // ============================================
  // ÉLÈVES
  // ============================================

  async function loadStudents() {
    loading("Chargement des élèves...");

    const { data, error } = await db
      .from(STUDENTS)
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      renderStudents();
      notice(
        "Chargement des élèves impossible : " + error.message,
        true
      );
      return;
    }

    students = data || [];
    student = null;
    lesson = null;
    lessons = [];
    documents = [];
    editingLessonId = null;

    renderStudents();
  }

  function renderStudents() {
    const filtered = students.filter(s =>
      `${s.name || ""} ${s.class || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );

    shell(`
      <div class="page-header">
        <h2 class="page-title">Mes élèves</h2>
      </div>

      <section class="card">
        <h3>Ajouter un élève</h3>
        <form id="student-form">
          ${field("name", "Nom de l'élève")}
          ${field("class", "Classe")}
          <button type="submit">Ajouter l'élève</button>
        </form>
      </section>

      <section class="card">
        <label for="student-search">Rechercher un élève</label>
        <input
          id="student-search"
          value="${esc(search)}"
          placeholder="Nom ou classe"
        >
      </section>

      <section id="students-list" class="students-grid"
        style="display:grid;grid-template-columns:
        repeat(auto-fit,minmax(230px,1fr));gap:16px">
        ${filtered.map(s => `
          <article class="student-card"
            style="padding:20px;border:1px solid #e8e5f2;
            border-radius:16px;background:white">
            <h3>${esc(s.name)}</h3>
            <p>Classe : ${esc(s.class || "Non renseignée")}</p>
            ${btn("open-student", "Ouvrir l'espace", s.id)}
            ${btn("delete-student", "Supprimer", s.id)}
          </article>
        `).join("") || "<p>Aucun élève trouvé.</p>"}
      </section>
    `);
  }

  async function addStudent(form) {
    const name = form.elements.name.value.trim();
    const studentClass = form.elements.class.value.trim();

    if (!name || !studentClass) {
      notice("Renseigne le nom et la classe.", true);
      return;
    }

    const { error } = await db.from(STUDENTS).insert({
      name,
      class: studentClass
    });

    if (error) {
      fail("Ajout de l'élève impossible", error);
      return;
    }

    search = "";
    await loadStudents();
    notice("Élève ajouté.");
  }

  async function deleteStudent(id) {
    const s = students.find(item => String(item.id) === String(id));

    if (!s) {
      notice("Élève introuvable.", true);
      return;
    }

    if (!confirm(`Supprimer l'élève ${s.name} ?`)) return;

    const { error } = await db
      .from(STUDENTS)
      .delete()
      .eq("id", id);

    if (error) {
      fail("Suppression impossible", error);
      return;
    }

    await loadStudents();
    notice("Élève supprimé.");
  }

  async function openStudent(id) {
    const selectedStudent = students.find(
      s => String(s.id) === String(id)
    );

    if (!selectedStudent) {
      notice("Élève introuvable. Réactualise la page.", true);
      return;
    }

    student = selectedStudent;
    lesson = null;
    editingLessonId = null;
    loading("Chargement des séances...");

    const { data, error } = await db
      .from(LESSONS)
      .select("*")
      .eq("student_id", student.id)
      .order("lesson_date", { ascending: false });

    if (error) {
      lessons = [];
      renderStudent();
      notice(
        "Chargement des séances impossible : " + error.message,
        true
      );
      return;
    }

    lessons = data || [];
    renderStudent();
  }

  // ============================================
  // SÉANCES : AFFICHAGE ET MODIFICATION
  // ============================================

  function renderStudent() {
    if (!student) {
      renderStudents();
      return;
    }

    const editingLesson = lessons.find(
      item => String(item.id) === String(editingLessonId)
    ) || null;

    shell(`
      ${btn("back-students", "← Tous les élèves")}

      <div class="page-header">
        <h2 class="page-title">${esc(student.name)}</h2>
      </div>

      <p>Classe : ${esc(student.class || "Non renseignée")}</p>

      <section class="card">
        <h3>
          ${editingLesson ? "Modifier la séance" : "Ajouter une séance"}
        </h3>

        <form id="lesson-form">
          ${field(
            "title",
            "Titre",
            "text",
            true,
            editingLesson?.title || ""
          )}

          ${field(
            "subject",
            "Matière",
            "text",
            true,
            editingLesson?.subject || ""
          )}

          ${field(
            "lesson_date",
            "Date",
            "date",
            true,
            editingLesson?.lesson_date || ""
          )}

          ${field(
            "duration_minutes",
            "Durée en minutes",
            "number",
            false,
            editingLesson?.duration_minutes ?? ""
          )}

          <p style="font-size:13px;color:#64748b">
            Exemples : 30 pour 30 minutes, 60 pour 1 heure,
            90 pour 1 h 30.
          </p>

          <div class="form-group" style="margin:14px 0">
            <label for="content">Contenu</label>
            <textarea
              id="content"
              name="content"
              rows="5"
              style="width:100%;box-sizing:border-box"
            >${esc(editingLesson?.content || "")}</textarea>
          </div>

          <div class="form-group" style="margin:14px 0">
            <label for="conclusion">Conclusion</label>
            <textarea
              id="conclusion"
              name="conclusion"
              rows="3"
              style="width:100%;box-sizing:border-box"
            >${esc(editingLesson?.conclusion || "")}</textarea>
          </div>

          <button type="submit">
            ${
              editingLesson
                ? "Enregistrer les modifications"
                : "Enregistrer la séance"
            }
          </button>

          ${
            editingLesson
              ? btn("cancel-edit-lesson", "Annuler la modification")
              : ""
          }
        </form>
      </section>

      <section class="card">
        <h3>Mes séances</h3>

        <div style="display:grid;grid-template-columns:
          repeat(auto-fit,minmax(230px,1fr));gap:14px">

          ${lessons.map(l => `
            <article class="lesson-card"
              style="padding:18px;border:1px solid #e8e5f2;
              border-radius:15px">

              <h3>${esc(l.title)}</h3>
              <p>Matière : ${esc(l.subject || "Non renseignée")}</p>
              <p>Date : ${esc(l.lesson_date || "Non renseignée")}</p>
              <p>Durée : ${esc(formatDuration(l.duration_minutes))}</p>
              <p>${esc((l.content || "").slice(0, 150))}</p>

              ${btn("open-lesson", "Voir la séance", l.id)}
              ${btn("edit-lesson", "✏️ Modifier", l.id)}
              ${btn("delete-lesson", "Supprimer", l.id)}
            </article>
          `).join("") || "<p>Aucune séance enregistrée.</p>"}
        </div>
      </section>
    `);
  }

  async function addLesson(form) {
    if (!student) {
      notice("Sélectionne d'abord un élève.", true);
      return;
    }

    const title = form.elements.title.value.trim();

    if (!title) {
      notice("Le titre est obligatoire.", true);
      return;
    }

    const durationValue =
      form.elements.duration_minutes.value.trim();

    if (
      durationValue !== "" &&
      (
        !Number.isFinite(Number(durationValue)) ||
        Number(durationValue) < 0
      )
    ) {
      notice(
        "La durée doit être un nombre positif de minutes.",
        true
      );
      return;
    }

    const record = {
      title,
      subject: form.elements.subject.value.trim(),
      lesson_date: form.elements.lesson_date.value || null,
      duration_minutes: durationValue === "" ? null : durationValue,
      content: form.elements.content.value.trim(),
      conclusion: form.elements.conclusion.value.trim(),
      student_id: student.id,
      class: student.class || ""
    };

    const wasEditing = editingLessonId !== null;
    let result;

    if (wasEditing) {
      // Modification de la séance existante dans Supabase.
      result = await db
        .from(LESSONS)
        .update(record)
        .eq("id", editingLessonId)
        .eq("student_id", student.id);
    } else {
      // Création d'une nouvelle séance.
      result = await db
        .from(LESSONS)
        .insert(record);
    }

    if (result.error) {
      fail(
        wasEditing
          ? "Modification de la séance impossible"
          : "Enregistrement de la séance impossible",
        result.error
      );
      return;
    }

    editingLessonId = null;

    await openStudent(student.id);

    notice(
      wasEditing
        ? "Séance modifiée avec succès."
        : "Séance enregistrée."
    );
  }

  function editLesson(id) {
    const selectedLesson = lessons.find(
      item => String(item.id) === String(id)
    );

    if (!selectedLesson) {
      notice("Séance introuvable. Réactualise la page.", true);
      return;
    }

    editingLessonId = selectedLesson.id;
    lesson = null;
    documents = [];

    renderStudent();

    document.getElementById("lesson-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function cancelEditLesson() {
    editingLessonId = null;
    renderStudent();
  }

  async function deleteLesson(id) {
    const selectedLesson = lessons.find(
      item => String(item.id) === String(id)
    );

    if (!selectedLesson) {
      notice("Séance introuvable.", true);
      return;
    }

    if (!confirm(`Supprimer la séance « ${selectedLesson.title} » ?`)) {
      return;
    }

    const { error } = await db
      .from(LESSONS)
      .delete()
      .eq("id", id);

    if (error) {
      fail("Suppression de la séance impossible", error);
      return;
    }

    editingLessonId = null;

    await openStudent(student.id);
    notice("Séance supprimée.");
  }

  async function openLesson(id) {
    const selectedLesson = lessons.find(
      item => String(item.id) === String(id)
    );

    if (!selectedLesson) {
      notice("Séance introuvable.", true);
      return;
    }

    lesson = selectedLesson;

    const { data, error } = await db
      .from(DOCUMENTS)
      .select("*")
      .eq("lesson_id", lesson.id)
      .order("created_at", { ascending: false });

    if (error) {
      fail("Chargement des documents impossible", error);
      return;
    }

    documents = data || [];
    renderLesson();
  }

  function renderLesson() {
    if (!lesson) {
      renderStudent();
      return;
    }

    shell(`
      ${btn("back-student", "← Retour aux séances")}

      <section class="card">
        <h2>${esc(lesson.title)}</h2>
        <p>Matière : ${esc(lesson.subject || "Non renseignée")}</p>
        <p>Date : ${esc(lesson.lesson_date || "Non renseignée")}</p>
        <p>Durée : ${esc(formatDuration(lesson.duration_minutes))}</p>

        <h3>Contenu</h3>
        <p style="white-space:pre-wrap">${esc(
          lesson.content || "Aucun contenu."
        )}</p>

        <h3>Conclusion</h3>
        <p style="white-space:pre-wrap">${esc(
          lesson.conclusion || "Aucune conclusion."
        )}</p>

        ${btn("edit-lesson", "✏️ Modifier cette séance", lesson.id)}
      </section>

      <section class="card">
        <h3>Documents PDF</h3>

        <form id="pdf-form">
          <div class="form-group">
            <label for="pdf">Choisir un fichier PDF</label>
            <input
              id="pdf"
              type="file"
              name="pdf"
              accept=".pdf,application/pdf"
              required
            >
          </div>

          <button type="submit">Envoyer le PDF</button>
        </form>

        <ul>
          ${documents.map(d => `
            <li style="margin:14px 0;overflow-wrap:anywhere">
              ${esc(d.file_name || "Document PDF")}
              ${btn("open-pdf", "Ouvrir", d.id)}
              ${btn("delete-pdf", "Supprimer", d.id)}
            </li>
          `).join("") || "<li>Aucun document PDF.</li>"}
        </ul>
      </section>
    `);
  }

  // ============================================
  // DOCUMENTS PDF
  // ============================================

  async function uploadPDF(form) {
    if (!student || !lesson) {
      notice("Aucune séance sélectionnée.", true);
      return;
    }

    const file = form.elements.pdf.files?.[0];

    if (!file) {
      notice("Choisis un PDF.", true);
      return;
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      notice("Seuls les fichiers PDF sont acceptés.", true);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      notice("Le fichier ne doit pas dépasser 15 Mo.", true);
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path =
      `${student.id}/${lesson.id}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: "application/pdf"
      });

    if (uploadError) {
      fail("Envoi du PDF impossible", uploadError);
      return;
    }

    const { error } = await db.from(DOCUMENTS).insert({
      lesson_id: lesson.id,
      file_name: file.name,
      file_path: path,
      document_type: "pdf",
      lesson_title: lesson.title || ""
    });

    if (error) {
      await db.storage.from(BUCKET).remove([path]);
      fail("Enregistrement du PDF impossible", error);
      return;
    }

    await openLesson(lesson.id);
    notice("PDF ajouté.");
  }

  async function openPDF(id) {
    const doc = documents.find(
      item => String(item.id) === String(id)
    );

    if (!doc?.file_path) {
      notice("Chemin du PDF introuvable.", true);
      return;
    }

    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(doc.file_path, 300);

    if (error) {
      fail("Ouverture du PDF impossible", error);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function deletePDF(id) {
    const doc = documents.find(
      item => String(item.id) === String(id)
    );

    if (!doc) {
      notice("Document introuvable.", true);
      return;
    }

    if (!confirm(`Supprimer le document « ${doc.file_name} » ?`)) {
      return;
    }

    const { error: storageError } = await db.storage
      .from(BUCKET)
      .remove([doc.file_path]);

    if (storageError) {
      fail("Suppression du fichier impossible", storageError);
      return;
    }

    const { error } = await db
      .from(DOCUMENTS)
      .delete()
      .eq("id", id);

    if (error) {
      fail("Suppression de l'enregistrement impossible", error);
      return;
    }

    await openLesson(lesson.id);
    notice("PDF supprimé.");
  }

  // ============================================
  // ÉVÉNEMENTS DES FORMULAIRES
  // ============================================

  app.addEventListener("submit", async event => {
    const form = event.target;

    if (!(form instanceof HTMLFormElement)) return;

    event.preventDefault();

    try {
      switch (form.id) {
        case "login-form":
          await login(form);
          break;

        case "signup-form":
          await signup(form);
          break;

        case "reset-form":
          await resetPassword(form);
          break;

        case "student-form":
          await addStudent(form);
          break;

        case "lesson-form":
          await addLesson(form);
          break;

        case "pdf-form":
          await uploadPDF(form);
          break;
      }
    } catch (error) {
      fail("Une erreur est survenue", error);
    }
  });

  // ============================================
  // ÉVÉNEMENTS DES BOUTONS
  // ============================================

  app.addEventListener("click", async event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const button = target.closest("[data-action]");

    if (!button || !app.contains(button)) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    try {
      switch (action) {
        case "signup-page":
          showSignup();
          break;

        case "reset-page":
          showReset();
          break;

        case "login-page":
          showLogin();
          break;

        case "logout":
          await logout();
          break;

        case "open-student":
          await openStudent(id);
          break;

        case "delete-student":
          await deleteStudent(id);
          break;

        case "back-students":
          editingLessonId = null;
          student = null;
          lesson = null;
          lessons = [];
          documents = [];
          renderStudents();
          break;

        case "open-lesson":
          await openLesson(id);
          break;

        case "edit-lesson":
          editLesson(id);
          break;

        case "cancel-edit-lesson":
          cancelEditLesson();
          break;

        case "delete-lesson":
          await deleteLesson(id);
          break;

        case "back-student":
          lesson = null;
          documents = [];
          renderStudent();
          break;

        case "open-pdf":
          await openPDF(id);
          break;

        case "delete-pdf":
          await deletePDF(id);
          break;
      }
    } catch (error) {
      fail("Action impossible", error);
    }
  });

  // ============================================
  // RECHERCHE DES ÉLÈVES
  // ============================================

  app.addEventListener("input", event => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) return;
    if (target.id !== "student-search") return;

    const position = target.selectionStart;
    search = target.value;

    const filtered = students.filter(s =>
      `${s.name || ""} ${s.class || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );

    const list = document.getElementById("students-list");

    if (!list) return;

    list.innerHTML = filtered.map(s => `
      <article class="student-card"
        style="padding:20px;border:1px solid #e8e5f2;
        border-radius:16px;background:white">

        <h3>${esc(s.name)}</h3>
        <p>Classe : ${esc(s.class || "Non renseignée")}</p>

        ${btn("open-student", "Ouvrir l'espace", s.id)}
        ${btn("delete-student", "Supprimer", s.id)}
      </article>
    `).join("") || "<p>Aucun élève trouvé.</p>";

    if (position !== null) {
      target.setSelectionRange(position, position);
    }
  });

  // ============================================
  // DÉMARRAGE
  // ============================================

  async function start() {
    loading("Initialisation de NSK Éducation...");

    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      app.innerHTML = `
        <main style="padding:24px">
          <h1>NSK Éducation</h1>
          <p>La bibliothèque Supabase ne s'est pas chargée.</p>
          <p>Vérifie le script Supabase dans index.html.</p>
          <button type="button" onclick="location.reload()">
            Réessayer
          </button>
        </main>
      `;
      return;
    }

    try {
      db = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );

      const result = await Promise.race([
        db.auth.getSession(),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(
              "Délai dépassé. Vérifie ta connexion Internet."
            ));
          }, 10000);
        })
      ]);

      if (result.error) throw result.error;

      user = result.data.session?.user || null;

      if (user) {
        await loadStudents();
      } else {
        showLogin();
      }

      db.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          user = null;
          student = null;
          lesson = null;
          students = [];
          lessons = [];
          documents = [];
          search = "";
          editingLessonId = null;
          showLogin();
        }
      });
    } catch (error) {
      console.error("Erreur au démarrage", error);

      app.innerHTML = `
        <main style="max-width:650px;margin:40px auto;padding:24px">
          <h1>NSK Éducation</h1>
          <h2>Impossible de charger ton espace</h2>
          <p style="overflow-wrap:anywhere">
            ${esc(error.message || error)}
          </p>
          <button type="button" onclick="location.reload()">
            Réessayer
          </button>
        </main>
      `;
    }
  }

  start();
})();
