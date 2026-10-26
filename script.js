
/* =================================
   NSK ÉDUCATION
   SCRIPT PRINCIPAL
   ================================= */

const SUPABASE_URL =
  "https://hztywwjrjkihivupcmad.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_am_wEiQkh4F-9VhIUC0LFg_zux-_jgu";

const app = document.getElementById("app");

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentUser = null;
let students = [];

/* AFFICHER UN MESSAGE */

function showMessage(message, type = "info") {
  const box = document.getElementById("message");

  if (!box) {
    alert(message);
    return;
  }

  box.textContent = message;
  box.className = "alert " + type;
  box.classList.remove("hidden");
}

/* ÉCHAPPER LE HTML */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

/* PAGE DE CONNEXION */

function showLogin() {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-box">
        <h1>NSK Éducation</h1>
        <p>Bienvenue dans ton espace enseignant.</p>

        <form id="login-form">
          <div class="form-group">
            <label for="email">Adresse e-mail</label>
            <input
              id="email"
              type="email"
              autocomplete="email"
              required
            >
          </div>

          <div class="form-group">
            <label for="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              autocomplete="current-password"
              required
            >
          </div>

          <p id="login-error" class="error-text"></p>

          <button id="login-button" class="w-full" type="submit">
            Se connecter
          </button>
        </form>

        <button id="signup-button" class="secondary w-full mt-2"
                type="button">
          Créer un compte
        </button>

        <button id="forgot-button" class="link-button w-full"
                type="button">
          Mot de passe oublié ?
        </button>
      </section>
    </main>
  `;

  document.getElementById("login-form")
    .addEventListener("submit", login);

  document.getElementById("signup-button")
    .addEventListener("click", signup);

  document.getElementById("forgot-button")
    .addEventListener("click", resetPassword);
}

/* CONNEXION */

async function login(event) {
  event.preventDefault();

  const button = document.getElementById("login-button");
  const errorBox = document.getElementById("login-error");

  button.disabled = true;
  button.textContent = "Connexion...";

  try {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    currentUser = data.user;
    await showDashboard();
  } catch (error) {
    errorBox.textContent =
      error.message || "Connexion impossible. Vérifie tes identifiants.";
  } finally {
    if (document.getElementById("login-button")) {
      button.disabled = false;
      button.textContent = "Se connecter";
    }
  }
}

/* CRÉATION DE COMPTE */

async function signup() {
  const email = prompt("Quelle est ton adresse e-mail ?");
  if (!email) return;

  const password = prompt(
    "Choisis un mot de passe d'au moins 8 caractères :"
  );
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
      alert(
        "Compte créé. Si la confirmation par e-mail est activée, " +
        "ouvre le message reçu avant de te connecter."
      );
    }
  } catch (error) {
    alert("Création impossible : " + error.message);
  }
}

/* MOT DE PASSE OUBLIÉ */

async function resetPassword() {
  const email = prompt("Saisis l'adresse e-mail de ton compte.");
  if (!email) return;

  try {
    const { error } = await db.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: window.location.origin
      }
    );

    if (error) throw error;

    alert("Si cette adresse correspond à un compte, un e-mail sera envoyé.");
  } catch (error) {
    alert("Erreur : " + error.message);
  }
}

/* TABLEAU DE BORD */

async function showDashboard() {
  if (!currentUser) {
    showLogin();
    return;
  }

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

          <button id="add-student-button" type="button">
            + Ajouter un élève
          </button>
        </div>

        <div id="message" class="hidden" role="status"></div>

        <section class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Nombre d'élèves</div>
            <div id="student-count" class="stat-value">0</div>
          </div>
        </section>

        <section class="card">
          <h2>Mes élèves</h2>

          <div class="form-group">
            <label for="student-search">Rechercher</label>
            <input
              id="student-search"
              type="search"
              placeholder="Nom ou classe..."
            >
          </div>

          <div id="students-container">
            <p>Chargement des élèves...</p>
          </div>
        </section>

        <section id="student-form-section" class="card mt-3 hidden">
          <h2 id="student-form-heading">Ajouter un élève</h2>

          <form id="student-form">
            <input id="student-id" type="hidden">

            <div class="form-group">
              <label for="student-name">Nom de l'élève</label>
              <input
                id="student-name"
                type="text"
                maxlength="150"
                required
              >
            </div>

            <div class="form-group">
              <label for="student-class">Classe</label>
              <input
                id="student-class"
                type="text"
                maxlength="100"
                placeholder="Ex. : 3e, Terminale..."
              >
            </div>

            <div class="form-actions">
              <button type="submit" id="save-student-button">
                Enregistrer
              </button>

              <button type="button" id="cancel-student-button"
                      class="secondary">
                Annuler
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  `;

  document.getElementById("logout-button")
    .addEventListener("click", logout);

  document.getElementById("add-student-button")
    .addEventListener("click", () => openStudentForm());

  document.getElementById("student-form")
    .addEventListener("submit", saveStudent);

  document.getElementById("cancel-student-button")
    .addEventListener("click", closeStudentForm);

  document.getElementById("student-search")
    .addEventListener("input", renderStudents);

  await loadStudents();
}

/* CHARGER LES ÉLÈVES */

async function loadStudents() {
  const container = document.getElementById("students-container");
  if (!container || !currentUser) return;

  container.innerHTML = "<p>Chargement...</p>";

  try {
    const { data, error } = await db
      .from("Students")
      .select("id, name, class")
      .order("name", { ascending: true });

    if (error) throw error;

    students = data || [];

    const count = document.getElementById("student-count");
    if (count) count.textContent = students.length;

    renderStudents();
  } catch (error) {
    container.innerHTML = `
      <div class="alert error">
        ${escapeHTML(error.message)}
        <p>Vérifie la table Students et ses règles de sécurité dans Supabase.</p>
      </div>
    `;
  }
}

/* AFFICHER LES ÉLÈVES */

function renderStudents() {
  const container = document.getElementById("students-container");
  if (!container) return;

  const search = (
    document.getElementById("student-search")?.value || ""
  ).toLowerCase().trim();

  const filtered = students.filter(student =>
    String(student.name || "").toLowerCase().includes(search) ||
    String(student.class || "").toLowerCase().includes(search)
  );

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Aucun élève trouvé</h3>
        <p>Tu peux ajouter un élève avec le bouton ci-dessus.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="students-grid">
      ${filtered.map(student => `
        <article class="student-card">
          <h3>${escapeHTML(student.name)}</h3>
          <p>Classe : ${escapeHTML(student.class || "Non renseignée")}</p>

          <div class="student-menu">
            <button
              class="secondary"
              data-edit-id="${escapeHTML(student.id)}"
              type="button"
            >Modifier</button>

            <button
              class="danger"
              data-delete-id="${escapeHTML(student.id)}"
              type="button"
            >Supprimer</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;

  container.querySelectorAll("[data-edit-id]").forEach(button => {
    button.addEventListener("click", () => {
      const student = students.find(
        item => String(item.id) === button.dataset.editId
      );

      if (student) openStudentForm(student);
    });
  });

  container.querySelectorAll("[data-delete-id]").forEach(button => {
    button.addEventListener("click", () => {
      deleteStudent(button.dataset.deleteId);
    });
  });
}

/* OUVRIR LE FORMULAIRE */

function openStudentForm(student = null) {
  const section = document.getElementById("student-form-section");

  document.getElementById("student-form-heading").textContent =
    student ? "Modifier l'élève" : "Ajouter un élève";

  document.getElementById("student-id").value = student?.id || "";
  document.getElementById("student-name").value = student?.name || "";
  document.getElementById("student-class").value = student?.class || "";

  section.classList.remove("hidden");
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* FERMER LE FORMULAIRE */

function closeStudentForm() {
  document.getElementById("student-form").reset();
  document.getElementById("student-id").value = "";
  document.getElementById("student-form-section").classList.add("hidden");
}

/* ENREGISTRER UN ÉLÈVE */

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
    let query;

    if (id) {
      query = db.from("Students")
        .update({ name, class: studentClass || null })
        .eq("id", id);
    } else {
      query = db.from("Students")
        .insert({ name, class: studentClass || null });
    }

    const { error } = await query;
    if (error) throw error;

    closeStudentForm();
    showMessage("Élève enregistré avec succès.", "success");
    await loadStudents();
  } catch (error) {
    showMessage(error.message || "Erreur d'enregistrement.", "error");
  } finally {
    button.disabled = false;
  }
}

/* SUPPRIMER UN ÉLÈVE */

async function deleteStudent(id) {
  const student = students.find(item => String(item.id) === String(id));
  if (!student) return;

  if (!confirm(`Supprimer l'élève ${student.name} ?`)) return;

  try {
    const { error } = await db
      .from("Students")
      .delete()
      .eq("id", id);

    if (error) throw error;

    showMessage("Élève supprimé.", "success");
    await loadStudents();
  } catch (error) {
    showMessage(error.message || "Erreur de suppression.", "error");
  }
}

/* DÉCONNEXION */

async function logout() {
  const { error } = await db.auth.signOut();

  if (error) {
    showMessage(error.message || "Déconnexion impossible.", "error");
    return;
  }

  currentUser = null;
  students = [];
  showLogin();
}

/* DÉMARRAGE */

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
          <p class="error-text">
            Impossible de démarrer : ${escapeHTML(error.message)}
          </p>
          <button onclick="location.reload()" type="button">
            Réessayer
          </button>
        </section>
      </main>
    `;
  }
}

startApp();
