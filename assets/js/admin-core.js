const defaults = {
  bannerTitle: "Your brand. Every matchday.",
  bannerSubtitle: "Advertise with Anawar Live.",
  bannerUrl: "https://example.com",
  bannerImage: "",
  playerTitle: "YOUR BRAND HERE ↗",
  playerUrl: "https://example.com",
  playerImage: "",
  items: []
};

const $ = id => document.getElementById(id);

const esc = value => String(value ?? "").replace(
  /[&<>"']/g,
  character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]
);

let cfg = { ...defaults };
let tab = window.ADMIN_PAGE.category;
let editing = null;
let version = null;
let hosted = false;
let draftEdited = false;
let images = {};
let bannerImages = {};
let noticeTimer;

function uid() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2);
}

function say(message) {
  $("notice").textContent = message;
  $("notice").hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    $("notice").hidden = true;
  }, 5000);
}

function imageURL(src) {
  return (
    /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(src) ||
    /^https?:\/\//.test(src) ||
    /^\/media\//.test(src) ||
    /^\.\/assets\/demo\/[a-zA-Z0-9._-]+$/.test(src)
  ) ? src : "";
}

function http(src) {
  if (typeof src !== "string" || !src.trim()) return false;

  try {
    const address = new URL(src, location.origin);
    return ["http:", "https:"].includes(address.protocol) &&
      !/^data:/.test(src);
  } catch {
    return false;
  }
}

function validate(config) {
  if (
    !config ||
    !Array.isArray(config.items) ||
    config.items.length > 300
  ) {
    throw Error(
      "Import must contain an items array (maximum 300 entries)."
    );
  }

  const ids = new Set();

  for (const item of config.items) {
    if (!item.id) item.id = uid();

    if (ids.has(item.id)) {
      throw Error("Duplicate item ID: " + item.id);
    }

    ids.add(item.id);

    if (
      !["football", "anawar", "tv", "highlights"].includes(
        item.category
      ) ||
      !item.title ||
      !http(item.url)
    ) {
      throw Error(
        "Each item needs a category, title and valid video URL."
      );
    }

    for (const key of ["homeLogo", "awayLogo", "poster"]) {
      if (item[key] && !imageURL(item[key])) {
        throw Error("Invalid image URL.");
      }
    }

    if (
      item.startAt &&
      !Number.isFinite(Date.parse(item.startAt))
    ) {
      throw Error("Invalid kick-off date.");
    }

    if (
      item.endAt &&
      (
        !Number.isFinite(Date.parse(item.endAt)) ||
        Date.parse(item.endAt) <= Date.parse(item.startAt)
      )
    ) {
      throw Error("End time must be after kick-off.");
    }

    for (const stream of item.streams || []) {
      if (
        !stream.url ||
        !http(stream.url) ||
        !["video", "embed"].includes(stream.kind || "video")
      ) {
        throw Error("Invalid stream link.");
      }
    }
  }

  for (const key of ["bannerImage", "playerImage"]) {
    if (config[key] && !imageURL(config[key])) {
      throw Error("Invalid banner image.");
    }
  }

  for (const key of ["bannerUrl", "playerUrl"]) {
    if (!http(config[key])) {
      throw Error("Enter a valid external banner link.");
    }
  }
}

function draft(userEdit = true) {
  if (userEdit) draftEdited = true;

  validate(cfg);

  localStorage.setItem(
    "anawar-draft-" + window.ADMIN_PAGE.category,
    JSON.stringify({
      ...sectionData(),
      _draftEdited: draftEdited
    })
  );

  $("output").value = sectionCode();

  $("draft-label").textContent = (
    window.ADMIN_PAGE.category === "banners"
      ? "Banners"
      : cfg.items.filter(
          item => item.category === window.ADMIN_PAGE.category
        ).length + " items"
  ) + " · draft";

  renderList();
}

function preview(id, src) {
  $(id).innerHTML = imageURL(src)
    ? `<img src="${esc(src)}" alt="Image preview">`
    : "";
}

async function png(file, large = false) {
  if (!file) return "";

  if (!/\.(png|jpe?g|svg|webp|gif)$/i.test(file.name)) {
    throw Error("Choose PNG, JPG, JPEG, SVG, WebP or GIF.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw Error("Choose an image under 8 MB.");
  }

  const objectURL = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = objectURL;

    try {
      await image.decode();
    } catch {
      throw Error(
        "Cannot open this image. SVG files must be self-contained and have valid dimensions."
      );
    }

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (!width || !height) {
      throw Error("This image has no valid dimensions.");
    }

    const limit = large ? 1600 : 192;
    const scale = Math.min(1, limit / Math.max(width, height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext("2d");

    if (!context) {
      throw Error("Your browser cannot process this image.");
    }

    context.drawImage(
      image, 0, 0, canvas.width, canvas.height
    );

    const result = canvas.toDataURL("image/png");

    if (result.length > 1400000) {
      throw Error(
        "Image is too large after resizing. Try a smaller image."
      );
    }

    return result;
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}

function localTime(value) {
  if (!value) return "";

  return new Date(
    Date.parse(value) + 390 * 60000
  ).toISOString().slice(0, 16);
}

function iso(value) {
  return value
    ? new Date(value + "+06:30").toISOString()
    : "";
}

function streamRow(label = "", url = "", kind = "video") {
  const row = document.createElement("div");
  row.className = "stream-row";

  row.innerHTML = `
    <input
      class="server-name"
      aria-label="Server label"
      value="${esc(label)}"
      placeholder="HD"
    >
    <select class="server-kind" aria-label="Server type">
      <option value="video">Video</option>
      <option value="embed">Embed</option>
    </select>
    <input
      class="server-url"
      aria-label="Server URL"
      value="${esc(url)}"
      placeholder="https://…"
    >
    <button type="button" aria-label="Remove server">×</button>
  `;

  row.querySelector("select").value = kind;
  row.querySelector("button").onclick = () => row.remove();

  $("streams").append(row);
}

function reset() {
  editing = null;
  images = {};

  $("content-form").reset();
  $("item-id").value = tab + "-" + uid().slice(0, 8);
  $("title").value = "";
  $("streams").innerHTML = "";

  streamRow("FHD");
  streamRow("HD");

  for (const id of [
    "home-preview",
    "away-preview",
    "poster-preview"
  ]) {
    $(id).innerHTML = "";
  }

  const isMatch = ["football", "anawar"].includes(tab);

  $("save-item").textContent = isMatch
    ? "Add match / ပွဲထည့်မည်"
    : "Add " + ({
        highlights: "highlight",
        tv: "channel",
        banners: "banner"
      })[tab];

  $("form-eyebrow").textContent =
    "NEW " + (isMatch ? "MATCH" : "CONTENT");
}

function switchTab(next) {
  tab = next;

  $("poster-file").parentElement.firstChild.textContent =
    tab === "tv" ? "Channel logo image" : "Cover image";

  $("poster-url").parentElement.firstChild.textContent =
    tab === "tv"
      ? "Channel logo URL (optional)"
      : "Cover image URL (optional)";

  document.querySelectorAll("[data-tab]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.tab === tab
    );
  });

  const isMatch = ["football", "anawar"].includes(tab);

  $("banner-panel").hidden = tab !== "banners";
  $("editor-panel").hidden = tab === "banners";
  $("list-panel").hidden = tab === "banners";

  $("team-fields").hidden = !isMatch;
  $("score-fields").hidden = !isMatch;
  $("league-label").hidden = !isMatch;
  $("schedule-fields").hidden = !isMatch;
  $("cover-fields").hidden =
    !["highlights", "tv"].includes(tab);

  $("home").required = isMatch;
  $("away").required = isMatch;
  $("kickoff").required = isMatch;
  $("title").required =
    !["football", "anawar"].includes(tab);

  $("form-title").textContent = ({
    football: "Match details / ပွဲအချက်အလက်",
    anawar: "Anawar Hein Live match details",
    highlights: "Highlight details",
    tv: "TV channel details",
    banners: "Banners"
  })[tab];

  if (tab !== "banners") reset();

  renderList();
}

function renderList() {
  const items = cfg.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.category === tab);

  $("list-title").textContent = items.length + " " + ({
    football: "matches",
    anawar: "matches",
    highlights: "highlights",
    tv: "channels",
    banners: "banners"
  })[tab];

  const query = $("search").value.toLowerCase();

  $("list").innerHTML = items
    .filter(({ item }) => [
      item.title,
      item.id,
      item.home,
      item.away,
      item.league
    ].join(" ").toLowerCase().includes(query))
    .map(({ item, index }) => `
      <article class="list-item">
        <div>
          ${
            item.homeLogo
              ? `<img src="${esc(imageURL(item.homeLogo))}"
                   alt="Home logo">`
              : ""
          }
          ${
            item.awayLogo
              ? `<img src="${esc(imageURL(item.awayLogo))}"
                   alt="Away logo">`
              : ""
          }
          <b>${esc(item.title)}</b>
          <small>
            ${esc(item.id)}
            ${
              ["football", "anawar"].includes(item.category)
                ? " · " + esc(item.league)
                : ""
            }
            · ${(item.streams || []).length || 1} servers
            ${
              item.startAt
                ? " · " +
                  esc(localTime(item.startAt).replace("T", " ")) +
                  " MMT"
                : ""
            }
            · ${esc(item.statusMode || "auto")}
          </small>
        </div>
        <div class="actions">
          <button data-edit="${index}">Edit / Streams</button>
          <button class="danger" data-delete="${index}">
            Delete
          </button>
        </div>
      </article>
    `).join("") ||
    '<div class="empty">No content yet. Add your own above.</div>';
}

function edit(index) {
  const item = cfg.items[index];

  editing = item.id;

  $("item-id").value = item.id;
  $("title").value = item.title;
  $("league").value = item.league || "";
  $("home").value = item.home || "";
  $("away").value = item.away || "";

  $("home-logo").value = /^data:/.test(item.homeLogo || "")
    ? "" : item.homeLogo || "";

  $("away-logo").value = /^data:/.test(item.awayLogo || "")
    ? "" : item.awayLogo || "";

  $("poster-url").value = /^data:/.test(item.poster || "")
    ? "" : item.poster || "";

  images = {
    homeLogo: item.homeLogo || "",
    awayLogo: item.awayLogo || "",
    poster: item.poster || ""
  };

  preview("home-preview", item.homeLogo);
  preview("away-preview", item.awayLogo);
  preview("poster-preview", item.poster);

  $("kickoff").value = localTime(item.startAt);
  $("end-time").value = localTime(item.endAt);
  $("status").value = item.statusMode || "auto";
  $("home-score").value = item.homeScore ?? "";
  $("away-score").value = item.awayScore ?? "";
  $("streams").innerHTML = "";

  const streams = item.streams?.length
    ? item.streams
    : [{
        label: "Server 1",
        url: item.url,
        kind: item.kind || "video"
      }];

  streams.forEach(stream => {
    streamRow(stream.label, stream.url, stream.kind);
  });

  $("save-item").textContent = "Update / ပြင်ဆင်မည်";
  $("form-eyebrow").textContent = "EDIT CONTENT";

  $("editor-panel").scrollIntoView({
    behavior: "smooth"
  });
}

$("content-form").onsubmit = event => {
  event.preventDefault();

  try {
    const streams = [
      ...document.querySelectorAll(".stream-row")
    ].map((row, index) => ({
      label: row.querySelector(".server-name").value.trim() ||
        "Server " + (index + 1),
      url: row.querySelector(".server-url").value.trim(),
      kind: row.querySelector(".server-kind").value
    })).filter(stream => stream.url);

    if (!streams.length) {
      throw Error("Add at least one video or embed server.");
    }

    const isMatch = ["football", "anawar"].includes(tab);

    const item = {
      id: $("item-id").value.trim(),
      category: tab,
      title: $("title").value.trim() || (
        isMatch
          ? $("home").value + " vs " + $("away").value
          : ""
      ),
      home: isMatch ? $("home").value.trim() : "",
      away: isMatch ? $("away").value.trim() : "",
      league: isMatch ? $("league").value.trim() : "",
      homeLogo:
        $("home-logo").value.trim() || images.homeLogo || "",
      awayLogo:
        $("away-logo").value.trim() || images.awayLogo || "",
      poster:
        $("poster-url").value.trim() || images.poster || "",
      startAt: isMatch ? iso($("kickoff").value) : "",
      endAt: isMatch ? iso($("end-time").value) : "",
      timeZone: "Asia/Yangon",
      statusMode: $("status").value,
      homeScore: $("home-score").value,
      awayScore: $("away-score").value,
      streams,
      url: streams[0].url,
      kind: streams[0].kind
    };

    const next = structuredClone(cfg);
    const index = next.items.findIndex(
      existing => existing.id === editing
    );

    if (index >= 0) {
      next.items[index] = item;
    } else {
      next.items.push(item);
    }

    validate(next);
    cfg = next;
    draft();
    reset();

    say("Saved to your draft. Copy the generated code.");
  } catch (error) {
    say(error.message);
  }
};

$("banner-form").onsubmit = event => {
  event.preventDefault();

  try {
    const next = { ...cfg };

    for (const key of [
      "bannerTitle",
      "bannerSubtitle",
      "bannerImage",
      "bannerUrl",
      "playerTitle",
      "playerImage",
      "playerUrl"
    ]) {
      next[key] = $(key).value;
    }

    next.bannerImage =
      next.bannerImage || bannerImages.bannerImage || "";

    next.playerImage =
      next.playerImage || bannerImages.playerImage || "";

    validate(next);
    cfg = next;
    draft();

    say("Banner draft saved.");
  } catch (error) {
    say(error.message);
  }
};

for (const [id, key, display, large] of [
  ["home-file", "homeLogo", "home-preview", false],
  ["away-file", "awayLogo", "away-preview", false],
  ["poster-file", "poster", "poster-preview", true],
  ["banner-file", "bannerImage", "banner-preview", true],
  ["player-file", "playerImage", "player-preview", true]
]) {
  $(id).accept = ".png,.jpg,.jpeg,.svg,.webp,.gif";

  $(id).onchange = async event => {
    try {
      const data = await png(event.target.files[0], large);

      if (["bannerImage", "playerImage"].includes(key)) {
        bannerImages[key] = data;
        $(key).value = "";
      } else {
        images[key] = data;

        const inputId = key === "homeLogo"
          ? "home-logo"
          : key === "awayLogo"
            ? "away-logo"
            : "poster-url";

        $(inputId).value = "";
      }

      preview(display, data);
      say("Image ready. Save the form to include it.");
    } catch (error) {
      say(error.message);
    }
  };
}

function fillBanners() {
  for (const key of [
    "bannerTitle",
    "bannerSubtitle",
    "bannerUrl",
    "playerTitle",
    "playerUrl"
  ]) {
    $(key).value = cfg[key] || "";
  }

  for (const key of ["bannerImage", "playerImage"]) {
    $(key).value = /^data:/.test(cfg[key] || "")
      ? "" : cfg[key] || "";

    bannerImages[key] = cfg[key] || "";
  }

  preview("banner-preview", cfg.bannerImage);
  preview("player-preview", cfg.playerImage);
}

$("list").onclick = event => {
  const editButton = event.target.closest("[data-edit]");
  const removeButton = event.target.closest("[data-delete]");

  if (editButton) {
    edit(Number(editButton.dataset.edit));
  }

  if (
    removeButton &&
    confirm("Delete this item from your draft?")
  ) {
    cfg.items.splice(Number(removeButton.dataset.delete), 1);
    draft();
    reset();
  }
};

$("delete-all").onclick = () => {
  if (confirm("Delete every item in this category from your draft?")) {
    cfg.items = cfg.items.filter(
      item => item.category !== tab
    );
    draft();
    reset();
  }
};

$("search").oninput = renderList;
$("clear-form").onclick = reset;
$("add-stream").onclick = () => streamRow();

$("use-embed").onclick = () => {
  const documentFragment = new DOMParser().parseFromString(
    $("embed-code").value,
    "text/html"
  );

  const src = documentFragment
    .querySelector("iframe")
    ?.getAttribute("src");

  if (!src || !http(src)) {
    say("Paste an iframe containing a valid src URL.");
    return;
  }

  streamRow("Embed", src, "embed");
  $("embed-code").value = "";
  say("Embed server added.");
};

$("import-button").onclick = () => {
  try {
    const parsed = parseDataCode($("import-code").value);
    const next = importSection(parsed);

    validate(next);
    cfg = next;
    draft();
    fillBanners();

    $("search").value = "";
    switchTab(window.ADMIN_PAGE.category);

    $("import-count").textContent = (
      window.ADMIN_PAGE.category === "banners"
        ? "Banners"
        : cfg.items.filter(
            item => item.category === window.ADMIN_PAGE.category
          ).length + " items"
    ) + " imported";

    say("Imported. Choose Edit / Streams to change links.");
  } catch (error) {
    $("import-count").textContent = "Import failed";
    $("save-status").textContent = error.message;
    say(error.message);
  }
};

$("use-current").onclick = () => {
  $("import-code").value = sectionCode();
  say("Current content loaded into the import box.");
};

$("import-file").onchange = async event => {
  try {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      throw Error("Choose a code file under 8 MB.");
    }

    $("import-code").value = await file.text();
    $("import-count").textContent =
      file.name + " — click Import & Edit";
  } catch (error) {
    say(error.message);
  }
};

$("copy-code").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("output").value);

    say(
      "Code copied. Paste into " +
      window.ADMIN_PAGE.file +
      " in GitHub."
    );
  } catch {
    $("output").focus();
    $("output").select();
    say("Press Ctrl+C to copy the selected code.");
  }
};

$("download-code").onclick = () => {
  const link = document.createElement("a");

  link.href = URL.createObjectURL(
    new Blob(
      [$("output").value],
      { type: "text/javascript" }
    )
  );

  link.download = window.ADMIN_PAGE.file;
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(link.href);
  }, 1000);
};

$("publish").onclick = async () => {
  try {
    validate(cfg);
    $("save-status").textContent = "Publishing…";

    const response = await fetch("/api/config", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        config: cfg,
        version
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw Error(result.error || "Publish failed");
    }

    version = result.version;

    $("save-status").textContent =
      "Published. Visitors see the update when they refresh.";

    say("Published successfully.");
  } catch (error) {
    $("save-status").textContent = error.message;
    say(error.message);
  }
};

function sectionData() {
  const category = window.ADMIN_PAGE.category;

  if (category === "banners") {
    const data = {};

    for (const key of [
      "bannerTitle",
      "bannerSubtitle",
      "bannerUrl",
      "bannerImage",
      "playerTitle",
      "playerUrl",
      "playerImage"
    ]) {
      data[key] = cfg[key];
    }

    return data;
  }

  return {
    items: cfg.items.filter(
      item => item.category === category
    )
  };
}

function sectionCode() {
  const currentPage = window.ADMIN_PAGE;

  if (currentPage.category === "football") {
    return generatedCode(sectionData());
  }

  return (
    "// Generated by Anawar Live " +
    currentPage.title +
    " Admin\nwindow." +
    currentPage.global +
    " = " +
    JSON.stringify(sectionData(), null, 2) +
    ";\n"
  );
}

function importSection(value) {
  const category = window.ADMIN_PAGE.category;

  if (category === "banners") {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw Error("Import banner configuration data.");
    }

    const next = { ...cfg };

    for (const key of [
      "bannerTitle",
      "bannerSubtitle",
      "bannerUrl",
      "bannerImage",
      "playerTitle",
      "playerUrl",
      "playerImage"
    ]) {
      if (key in value) next[key] = value[key];
    }

    return next;
  }

  let items;

  if (Array.isArray(value)) {
    if (["football", "anawar"].includes(category)) {
      items = normalizeImport(
        value,
        { ...cfg, items: [] }
      ).items;
    } else {
      items = value;
    }
  } else if (value && Array.isArray(value.items)) {
    items = value.items.filter(
      item => !item.category || item.category === category
    );
  } else {
    throw Error("Import the code for this category.");
  }

  return {
    ...cfg,
    items: [
      ...cfg.items.filter(
        item => item.category !== category
      ),
      ...items.map(item => ({
        ...item,
        category
      }))
    ]
  };
}

async function boot() {
  try {
    if (window.STATIC_SITE) throw Error("Static mode");

    const response = await fetch("/api/config", {
      cache: "no-store"
    });

    if (response.ok) {
      const data = await response.json();

      cfg = {
        ...defaults,
        ...(data.config || {})
      };

      version = data.version;
      hosted = !!data.canAdmin;
    }
  } catch {
    // Continue in GitHub/static mode.
  }

  if (!hosted && window.STATIC_SITE) {
    cfg = readCommittedContent(defaults);
  } else if (!hosted) {
    try {
      const response = await fetch("./config.json", {
        cache: "no-store"
      });

      if (response.ok) {
        cfg = {
          ...defaults,
          ...await response.json()
        };
      }
    } catch {
      // Use the current configuration.
    }
  }

  const saved = localStorage.getItem(
    "anawar-draft-" + window.ADMIN_PAGE.category
  );

  if (saved) {
    try {
      const candidate = JSON.parse(saved);

      if (
        !candidate._draftEdited &&
        Array.isArray(candidate.items) &&
        candidate.items.length === 0 &&
        cfg.items.some(
          item =>
            item.demo &&
            item.category === window.ADMIN_PAGE.category
        )
      ) {
        throw Error("Use current demo content.");
      }

      draftEdited =
        !!candidate._draftEdited ||
        !!candidate.items?.length;

      const merged = importSection(candidate);
      validate(merged);
      cfg = merged;

      $("save-status").textContent =
        "Restored your saved local draft.";
    } catch {
      // Keep committed content when the old draft is invalid.
    }
  }

  cfg = applyDemoSchedule(cfg);
  $("publish").hidden = !hosted;

  $("connection").textContent = hosted
    ? "Owner access · Code generator + direct publishing"
    : "GitHub code generator · Commit generated files to publish";

  try {
    draft(false);
  } catch (error) {
    say(error.message);
  }

  fillBanners();
  switchTab(window.ADMIN_PAGE.category);
}

const page = window.ADMIN_PAGE;

$("import-code").placeholder =
  "Paste " + page.file + " code here…";

document.title = page.title + " Admin | Anawar Live";
document.querySelector("h1").textContent =
  page.title + " Admin";

document.querySelectorAll("[data-filename]").forEach(element => {
  element.textContent = page.file;
});

document.querySelectorAll("[data-page-title]").forEach(element => {
  element.textContent = page.title;
});

document.querySelectorAll(".admin-nav a").forEach(element => {
  element.classList.toggle(
    "active",
    element.dataset.section === page.category
  );
});

boot().catch(error => {
  $("connection").textContent = "Admin loading error";
  $("save-status").textContent = error.message;
  say(error.message);
});
