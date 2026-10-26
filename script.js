
(() => {
  "use strict";

  // ==================================================
  // CONFIGURATION SUPABASE
  // ==================================================

  const SUPABASE_URL = "https://hztywwjrjkihivupcmad.supabase.co";
  const SUPABASE_KEY = "sb_publishable_am_wEiQkh4F-9VhIUC0LFg_zux-_jgu";

  const STUDENTS = "Students";
  const LESSONS = "Lessons";
  const DOCUMENTS = "Lessons_documents";
  const BUCKET = "lesson-pdfs";

  const app = document.getElementById("app");

  if (!app) {
    console.error("Élément #app introuvable dans index.html.");
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
  let page = "login";

  // ==================================================
  // OUTILS
  // ==================================================

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);

  function notice(text, error = false) {
    let box = document.getElementById("notice");

    if (!box) {
      box = document.createElement("div");
      box.id = "notice";
      app.prepend(box);
    }

    box.hidden = false;
    box.textContent = text;
    box.style.cssText =
      "padding:12px;margin:12px 0;border-radius:8px;" +
      "background:" + (error ? "#fee2e2" : "#dcfce7") +
      ";color:#222;overflow-wrap:anywhere";
  }

  function fail(context, error) {
    console.error(context, error);
    notice(context + " : " + (error?.message || String(error)), true);
  }

  function loading(text = "Chargement...") {
    app.innerHTML = `
      <main style="max-width:600px;margin:50px auto;padding:24px">
        <h1>NSK Éducation</h1>
        <p>${esc(text)}</p>
      </main>`;
  }

  function field(name, label, type = "text", required = true) {
    return `
      <div style="margin:14px 0">
        <label for="${name}" style="display:block;margin-bottom:6px">
          ${label}
        </label>
        <input id="${name}" name="${name}" type="${type}"
          ${required ? "required" : ""}
          style="box-sizing:border-box;width:100%;padding:11px">
      </div>`;
  }

  function btn(action, label, extra = "") {
    return `<button type="button" data-action="${action}" ${extra}
      style="padding:10px 14px;margin:4px;cursor:pointer">
      ${label}
    </button>`;
  }

  function shell(content) {
    app.innerHTML = `
      <header style="padding:18px;background:#17365d;color:white">
        <h1>NSK Éducation</h1>
        ${user ? `<p>Connecté : ${esc(user.email || "")}</p>
          ${btn("logout", "Se déconnecter")}` : ""}
      </header>
      <main style="max-width:1000px;margin:auto;padding:20px">
        <div id="notice" hidden></div>
        ${content}
      </main>`;
  }

  // ==================================================
  // CONNEXION
  // ==================================================

  function showLogin(errorText = "") {
    page = "login";

    app.innerHTML = `
      <main style="max-width:430px;margin:40px auto;padding:24px;
        border:1px solid #ddd;border-radius:12px">
        <h1>NSK Éducation</h1>
        <p>Connecte-toi à ton espace.</p>
        <div id="notice" hidden></div>

        <form id="login-form">
          ${field("email", "Adresse e-mail", "email")}
          ${field("password", "Mot de passe", "password")}
          <button type="submit" style="width:100%;padding:12px">
            Se connecter
          </button>
        </form>

        <p>${btn("signup-page", "Créer un compte")}</p>
        <p>${btn("reset-page", "Mot de passe oublié ?")}</p>
      </main>`;

    if (errorText) notice(errorText, true);
  }

  function showSignup() {
    page = "signup";

    app.innerHTML = `
      <main style="max-width:430px;margin:40px auto;padding:24px;
        border:1px solid #ddd;border-radius:12px">
        <h1>Créer un compte</h1>
        <div id="notice" hidden></div>
        <form id="signup-form">
          ${field("email", "Adresse e-mail", "email")}
          ${field("password", "Mot de passe (6 caractères minimum)", "password")}
          <button type="submit" style="padding:12px">Créer mon compte</button>
        </form>
        ${btn("login-page", "Retour à la connexion")}
      </main>`;
  }

  function showReset() {
    page = "reset";

    app.innerHTML = `
      <main style="max-width:430px;margin:40px auto;padding:24px">
        <h1>Mot de passe oublié</h1>
        <div id="notice" hidden></div>
        <form id="reset-form">
          ${field("email", "Adresse e-mail", "email")}
          <button type="submit" style="padding:12px">Envoyer le lien</button>
        </form>
        ${btn("login-page", "Retour à la connexion")}
      </main>`;
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
      notice("Le mot de passe doit contenir au moins 6 caractères.", true);
      return;
    }

    const { data, error } = await db.auth.signUp({ email, password });

    if (error) {
      fail("Inscription impossible", error);
      return;
    }

    if (data.session) {
      user = data.user;
      await loadStudents();
    } else {
      showLogin("Compte créé. Vérifie tes e-mails pour confirmer ton adresse, puis connecte-toi.");
    }
  }

  async function resetPassword(form) {
    const email = form.elements.email.value.trim();

    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname
    });

    if (error) fail("Envoi du lien impossible", error);
    else notice("Si cette adresse est enregistrée, un e-mail de réinitialisation sera envoyé.");
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
    showLogin();
  }

  // ==================================================
  // ÉLÈVES
  // ==================================================

  async function loadStudents() {
    page = "loading";
    loading("Chargement des élèves...");

    const { data, error } = await db
      .from(STUDENTS)
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      page = "students";
      students = [];
      renderStudents();
      notice("Chargement des élèves impossible. Vérifie les règles d'accès de la table Students dans Supabase. " + error.message, true);
      return;
    }

    students = data || [];
    student = null;
    lesson = null;
    lessons = [];
    documents = [];
    page = "students";
    renderStudents();
  }

  function renderStudents() {
    page = "students";

    const filtered = students.filter(s =>
      `${s.name || ""} ${s.class || ""}`
        .toLowerCase().includes(search.toLowerCase())
    );

    shell(`
      <h2>Mes élèves</h2>

      <section style="padding:16px;border:1px solid #ddd;border-radius:10px">
        <h3>Ajouter un élève</h3>
        <form id="student-form">
          ${field("name", "Nom de l'élève")}
          ${field("class", "Classe")}
          <button type="submit" style="padding:11px">Ajouter l'élève</button>
        </form>
      </section>

      <div style="margin:20px 0">
        <label for="student-search">Rechercher un élève</label>
        <input id="student-search" value="${esc(search)}"
          placeholder="Nom ou classe" style="padding:10px;width:100%;box-sizing:border-box">
      </div>

      <section id="students-list"
        style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
        ${filtered.map(s => `
          <article style="padding:16px;border:1px solid #ddd;border-radius:10px">
            <h3>${esc(s.name)}</h3>
            <p>Classe : ${esc(s.class || "Non renseignée")}</p>
            ${btn("open-student", "Ouvrir l'espace", "", `data-id="${esc(s.id)}"`)}
            <button type="button" data-action="delete-student"
              data-id="${esc(s.id)}" style="padding:10px">Supprimer</button>
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
    if (!s || !confirm(`Supprimer l'élève ${s.name} ?`)) return;

    const { error } = await db.from(STUDENTS).delete().eq("id", id);

    if (error) {
      fail("Suppression impossible", error);
      return;
    }

    await loadStudents();
    notice("Élève supprimé.");
  }

  async function openStudent(id) {
    student = students.find(s => String(s.id) === String(id));
    if (!student) return;

    page = "loading";
    loading("Chargement des leçons...");

    const { data, error } = await db
      .from(LESSONS)
      .select("*")
      .eq("student_id", student.id)
      .order("lesson_date", { ascending: false });

    if (error) {
      lessons = [];
      renderStudent();
      notice("Chargement des leçons impossible. Vérifie la colonne student_id de Lessons et les règles d'accès. " + error.message, true);
      return;
    }

    lessons = data || [];
    renderStudent();
  }

  // ==================================================
  // LEÇONS
  // ==================================================

  function renderStudent() {
    if (!student) return renderStudents();

    page = "student";

    shell(`
      ${btn("back-students", "← Tous les élèves")}
      <h2>${esc(student.name)}</h2>
      <p>Classe : ${esc(student.class || "Non renseignée")}</p>

      <section style="padding:16px;border:1px solid #ddd;border-radius:10px">
        <h3>Ajouter une leçon</h3>
        <form id="lesson-form">
          ${field("title", "Titre")}
          ${field("subject", "Matière")}
          ${field("lesson_date", "Date", "date")}
          ${field("duration_minutes", "Durée en minutes", "number")}
          <div style="margin:14px 0">
            <label for="content">Contenu</label>
            <textarea id="content" name="content" rows="5"
              style="width:100%;box-sizing:border-box"></textarea>
          </div>
          <div style="margin:14px 0">
            <label for="conclusion">Conclusion</label>
            <textarea id="conclusion" name="conclusion" rows="3"
              style="width:100%;box-sizing:border-box"></textarea>
          </div>
          <button type="submit" style="padding:11px">Enregistrer la leçon</button>
        </form>
      </section>

      <h3>Mes leçons</h3>
      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">
        ${lessons.map(l => `
          <article style="padding:16px;border:1px solid #ddd;border-radius:10px">
            <h3>${esc(l.title)}</h3>
            <p>Matière : ${esc(l.subject || "Non renseignée")}</p>
            <p>Date : ${esc(l.lesson_date || "Non renseignée")}</p>
            <p>${esc((l.content || "").slice(0,150))}</p>
            ${btn("open-lesson", "Voir la leçon", "", `data-id="${esc(l.id)}"`)}
            <button type="button" data-action="delete-lesson"
              data-id="${esc(l.id)}">Supprimer</button>
          </article>
        `).join("") || "<p>Aucune leçon enregistrée.</p>"}
      </section>
    `);
  }

  async function addLesson(form) {
    if (!student) return;

    const title = form.elements.title.value.trim();
    if (!title) {
      notice("Le titre est obligatoire.", true);
      return;
    }

    const record = {
      title,
      subject: form.elements.subject.value.trim(),
      lesson_date: form.elements.lesson_date.value || null,
      duration_minutes: form.elements.duration_minutes.value || null,
      content: form.elements.content.value.trim(),
      conclusion: form.elements.conclusion.value.trim(),
      student_id: student.id,
      class: student.class || ""
    };

    const { error } = await db.from(LESSONS).insert(record);

    if (error) {
      fail("Enregistrement de la leçon impossible", error);
      return;
    }

    await openStudent(student.id);
    notice("Leçon enregistrée.");
  }

  async function deleteLesson(id) {
    const l = lessons.find(item => String(item.id) === String(id));
    if (!l || !confirm(`Supprimer la leçon « ${l.title} » ?`)) return;

    const { error } = await db.from(LESSONS).delete().eq("id", id);

    if (error) {
      fail("Suppression de la leçon impossible", error);
      return;
    }

    await openStudent(student.id);
    notice("Leçon supprimée.");
  }

  async function openLesson(id) {
    lesson = lessons.find(l => String(l.id) === String(id));
    if (!lesson) return;

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
    if (!lesson) return renderStudent();

    page = "lesson";

    shell(`
      ${btn("back-student", "← Retour aux leçons")}
      <h2>${esc(lesson.title)}</h2>
      <p>Matière : ${esc(lesson.subject || "Non renseignée")}</p>
      <p>Date : ${esc(lesson.lesson_date || "Non renseignée")}</p>
      <h3>Contenu</h3>
      <p style="white-space:pre-wrap">${esc(lesson.content || "Aucun contenu.")}</p>
      <h3>Conclusion</h3>
      <p style="white-space:pre-wrap">${esc(lesson.conclusion || "Aucune conclusion.")}</p>

      <section style="padding:16px;border:1px solid #ddd;border-radius:10px">
        <h3>Documents PDF</h3>
        <form id="pdf-form">
          <input type="file" name="pdf" accept=".pdf,application/pdf" required>
          <button type="submit" style="padding:10px">Envoyer le PDF</button>
        </form>

        <ul>
          ${documents.map(d => `
            <li style="margin:12px 0">
              ${esc(d.file_name || "Document PDF")}
              ${btn("open-pdf", "Ouvrir", "", `data-id="${esc(d.id)}"`)}
              ${btn("delete-pdf", "Supprimer", "", `data-id="${esc(d.id)}"`)}
            </li>
          `).join("") || "<li>Aucun document.</li>"}
        </ul>
      </section>
    `);
  }

  // ==================================================
  // FICHIERS PDF
  // ==================================================

  async function uploadPDF(form) {
    const file = form.elements.pdf.files?.[0];
    if (!file) return notice("Choisis un PDF.", true);

    if (file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")) {
      return notice("Seuls les fichiers PDF sont acceptés.", true);
    }

    if (file.size > 15 * 1024 * 1024) {
      return notice("Le fichier ne doit pas dépasser 15 Mo.", true);
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${student.id}/${lesson.id}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(path, file, { contentType: "application/pdf" });

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
    const doc = documents.find(d => String(d.id) === String(id));
    if (!doc?.file_path) return notice("Chemin du PDF introuvable.", true);

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
    const doc = documents.find(d => String(d.id) === String(id));
    if (!doc || !confirm(`Supprimer ${doc.file_name} ?`)) return;

    const { error: storageError } = await db.storage
      .from(BUCKET)
      .remove([doc.file_path]);

    if (storageError) {
      fail("Suppression du fichier impossible", storageError);
      return;
    }

    const { error } = await db.from(DOCUMENTS).delete().eq("id", id);

    if (error) {
      fail("Suppression de l'enregistrement impossible", error);
      return;
    }

    await openLesson(lesson.id);
    notice("PDF supprimé.");
  }

  // ==================================================
  // ÉVÉNEMENTS : FORMULAIRES
  // ==================================================

  app.addEventListener("submit", async event => {
    event.preventDefault();

    try {
      switch (event.target.id) {
        case "login-form":
          await login(event.target);
          break;
        case "signup-form":
          await signup(event.target);
          break;
        case "reset-form":
          await resetPassword(event.target);
          break;
        case "student-form":
          await addStudent(event.target);
          break;
        case "lesson-form":
          await addLesson(event.target);
          break;
        case "pdf-form":
          await uploadPDF(event.target);
          break;
      }
    } catch (error) {
      fail("Une erreur est survenue", error);
    }
  });

  // ==================================================
  // ÉVÉNEMENTS : BOUTONS
  // ==================================================

  app.addEventListener("click", async event => {
    const el = event.target.closest("[data-action]");
    if (!el) return;

    const action = el.dataset.action;
    const id = el.dataset.id;

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
          student = null;
          lesson = null;
          lessons = [];
          documents = [];
          renderStudents();
          break;
        case "open-lesson":
          await openLesson(id);
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

  // ==================================================
  // RECHERCHE D'ÉLÈVES
  // ==================================================

  app.addEventListener("input", event => {
    if (event.target.id !== "student-search") return;

    const position = event.target.selectionStart;
    search = event.target.value;

    const filtered = students.filter(s =>
      `${s.name || ""} ${s.class || ""}`
        .toLowerCase().includes(search.toLowerCase())
    );

    const list = document.getElementById("students-list");
    if (!list) return;

    list.innerHTML = filtered.map(s => `
      <article style="padding:16px;border:1px solid #ddd;border-radius:10px">
        <h3>${esc(s.name)}</h3>
        <p>Classe : ${esc(s.class || "Non renseignée")}</p>
        ${btn("open-student", "Ouvrir l'espace", "", `data-id="${esc(s.id)}"`)}
        <button type="button" data-action="delete-student"
          data-id="${esc(s.id)}">Supprimer</button>
      </article>
    `).join("") || "<p>Aucun élève trouvé.</p>";

    event.target.setSelectionRange(position, position);
  });

  // ==================================================
  // DÉMARRAGE ET SESSION
  // ==================================================

  async function start() {
    loading("Initialisation de NSK Éducation...");

    if (!window.supabase ||
        typeof window.supabase.createClient !== "function") {
      app.innerHTML = `
        <main style="padding:24px">
          <h1>NSK Éducation</h1>
          <p>La bibliothèque Supabase ne s'est pas chargée.</p>
          <p>Vérifie le chargement du script Supabase dans index.html.</p>
          <button onclick="location.reload()">Réessayer</button>
        </main>`;
      return;
    }

    try {
      db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

      const result = await Promise.race([
        db.auth.getSession(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(
            "Délai dépassé. Vérifie ta connexion Internet."
          )), 10000)
        )
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
          showLogin();
        }
      });
    } catch (error) {
      console.error("Erreur au démarrage", error);

      app.innerHTML = `
        <main style="max-width:650px;margin:40px auto;padding:24px">
          <h1>NSK Éducation</h1>
          <h2>Impossible de charger ton espace</h2>
          <p style="overflow-wrap:anywhere">${esc(error.message || error)}</p>
          <button onclick="location.reload()">Réessayer</button>
        </main>`;
    }
  }

  start();
})();
