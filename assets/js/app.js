/* ANAWAR LIVE — COMPLETE PUBLIC APP */

const defaults = {
  bannerTitle: "Your brand. Every matchday.",
  bannerSubtitle: "Connect with football fans.",
  bannerUrl: "https://example.com",
  bannerImage: "",
  playerTitle: "YOUR BRAND HERE",
  playerUrl: "https://example.com",
  playerImage: "",
  theme: "dark",
  items: []
};

let cfg = { ...defaults };
let canAdmin = false;
let configVersion = null;
let loadError = "";
let filter = "All matches";

let activePlayer = null;
let playerCleanup = null;
let playerRequest = 0;
let bannerDismissed = false;
let currentPlayerIndex = null;
let sdkPromise = null;
let reconnectTimer = null;

const $ = id => document.getElementById(id);

const pages = [
  ["football", "◉", "Football Live"],
  ["anawar", "◈", "Anawar Hein Live"],
  ["tv", "▣", "Tv Channel"],
  ["highlights", "▷", "Highlights"],
  ["settings", "⚙", "Settings"]
];

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
}

function safeURL(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    const address = new URL(value, location.href);

    return ["https:", "http:"].includes(address.protocol)
      ? address.href
      : "";
  } catch {
    return "";
  }
}

function imageURL(value) {
  if (
    typeof value === "string" &&
    /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(value)
  ) {
    return value;
  }

  return safeURL(value);
}

function applyAppearance() {
  document.body.classList.toggle(
    "light",
    (localStorage.getItem("anawar-theme") || "dark") === "light"
  );
}

function renderPageBanner() {
  const banner = $("topad");
  if (!banner) return;

  banner.href = safeURL(cfg.bannerUrl) || "https://example.com";
  banner.target = "_blank";
  banner.rel = "noopener noreferrer";

  const image = imageURL(cfg.bannerImage);

  if (image) {
    banner.innerHTML =
      `<img src="${esc(image)}" alt="Sponsor banner">`;
  } else {
    banner.innerHTML = `
      <div>
        <div class="sponsor">ADVERTISEMENT</div>
        <strong>${esc(cfg.bannerTitle)}</strong>
        <p>${esc(cfg.bannerSubtitle)}</p>
      </div>
      <span class="cta">Visit sponsor ↗</span>
    `;
  }
}

function heading(title, description) {
  return `
    <div class="titlebar">
      <div>
        <h1>${esc(title)}</h1>
        <p class="sub">${esc(description)}</p>
      </div>
      <span class="pill">✦ &nbsp; THE HOME OF FOOTBALL</span>
    </div>
  `;
}

function teamLogo(source, name) {
  const image = imageURL(source);

  return image
    ? `<img class="team-logo" src="${esc(image)}"
         alt="${esc(name)} logo">`
    : `<div class="crest">${
        esc((name || "?").slice(0, 3).toUpperCase())
      }</div>`;
}

function matchStatus(item) {
  if (typeof matchState === "function") {
    return matchState(item);
  }

  const mode = item.statusMode || item.status || "auto";

  if (mode === "cancelled") return "Cancelled";
  if (mode === "postponed") return "Postponed";
  if (mode === "ended" || mode === "finished") return "Ended";
  if (mode === "live") return "LIVE";

  const start = Date.parse(item.startAt || item.kickoff || "");

  if (!Number.isFinite(start)) return "Upcoming";

  const end = item.endAt
    ? Date.parse(item.endAt)
    : start + 3 * 60 * 60 * 1000;

  const now = Date.now();

  if (now < start) return "Upcoming";
  if (now >= end) return "Ended";

  return "LIVE";
}

function matchDate(item) {
  const start = item.startAt || item.kickoff;

  if (!start) return "Date and time to be confirmed";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: item.timeZone || "Asia/Yangon"
    }).format(new Date(start)) + " · Myanmar time";
  } catch {
    return "Date and time to be confirmed";
  }
}

function contentCards(category) {
  return cfg.items
    .filter(item => {
      if (item.category !== category) return false;

      if (
        ["football", "anawar"].includes(category) &&
        filter !== "All matches"
      ) {
        return item.league === filter;
      }

      return true;
    })
    .sort((a, b) => {
      return (
        (Date.parse(a.startAt || a.kickoff) || 0) -
        (Date.parse(b.startAt || b.kickoff) || 0)
      );
    })
    .map(item => {
      const index = cfg.items.indexOf(item);

      if (category === "tv") {
        const image = imageURL(item.poster);

        return `
          <button class="tv-tile" data-item="${index}">
            <span class="tv-logo-well">
              ${
                image
                  ? `<img src="${esc(image)}"
                       alt="${esc(item.title)} logo">`
                  : `<span class="tv-letter">${
                      esc((item.title || "").slice(0, 2).toUpperCase())
                    }</span>`
              }
            </span>
            <strong>${esc(item.title)}</strong>
            <span class="tv-watch">▶ &nbsp; Watch Live</span>
          </button>
        `;
      }

      if (["football", "anawar"].includes(category)) {
        const hasScores =
          item.homeScore !== undefined &&
          item.homeScore !== "" &&
          item.awayScore !== undefined &&
          item.awayScore !== "";

        const status = matchStatus(item);

        return `
          <button class="card match" data-item="${index}">
            <div class="league">
              <span>
                ◈ &nbsp;
                ${esc(
                  item.league ||
                  (category === "anawar"
                    ? "Anawar Hein Live"
                    : "Football Live")
                )}
              </span>
              <span
                class="watch ${status === "LIVE" ? "is-live" : ""}"
                data-state="${index}"
              >${esc(status)}</span>
            </div>

            <div class="teams">
              <div class="team">
                ${teamLogo(item.homeLogo, item.home)}
                ${esc(item.home || "Home team")}
              </div>

              <div class="score">
                ${
                  hasScores
                    ? esc(item.homeScore) + " – " + esc(item.awayScore)
                    : "VS"
                }
              </div>

              <div class="team">
                ${teamLogo(item.awayLogo, item.away)}
                ${esc(item.away || "Away team")}
              </div>
            </div>

            <p class="match-date">${esc(matchDate(item))}</p>

            <div class="matchfoot">
              <span>${esc(item.title)}</span>
              <span class="watch">Watch match ↗</span>
            </div>
          </button>
        `;
      }

      const poster = imageURL(item.poster);

      return `
        <button class="card channel" data-item="${index}">
          ${
            poster
              ? `<img class="content-poster"
                   src="${esc(poster)}"
                   alt="${esc(item.title)}">`
              : '<span class="play" style="margin:auto">▶</span>'
          }
          <b>${esc(item.title)}</b>
          <small>Watch highlight</small>
        </button>
      `;
    })
    .join("");
}

function render() {
  applyAppearance();
  renderPageBanner();

  let page = location.hash.slice(1) || "football";

  if (!pages.some(entry => entry[0] === page)) {
    page = "football";
  }

  $("nav").innerHTML = pages.map(entry => `
    <a
      href="#${entry[0]}"
      class="${entry[0] === page ? "active" : ""}"
    >
      <i>${entry[1]}</i>${entry[2]}
    </a>
  `).join("");

  $("crumb").textContent =
    pages.find(entry => entry[0] === page)[2];

  let html = "";

  if (["football", "anawar"].includes(page)) {
    const leagues = [...new Set(
      cfg.items
        .filter(item => item.category === page && item.league)
        .map(item => item.league)
    )];

    if (filter !== "All matches" && !leagues.includes(filter)) {
      filter = "All matches";
    }

    const title =
      page === "anawar" ? "Anawar Hein Live" : "Football Live";

    html = heading(
      title,
      "Your matches. Every kick-off, in one place."
    );

    html += `
      <section class="hero">
        <span class="hero-info">
          ${
            page === "anawar"
              ? "ANAWAR HEIN LIVE"
              : "ANAWAR LIVE • FOOTBALL"
          }
        </span>

        <div>
          <span class="live">
            <span class="dot"></span>YOUR MATCHDAY, UPGRADED
          </span>

          <h2>
            ${
              page === "anawar"
                ? "Anawar Hein.<br>Every match, live."
                : "Big games.<br>Unmissable moments."
            }
          </h2>

          <p>Your home for live football.</p>

          <button class="cta" id="hero-watch">
            ▶ &nbsp; View matches
          </button>
        </div>
      </section>

      <div class="sectionhead">
        <h2>Match centre</h2>

        <div class="filters">
          ${
            ["All matches", ...leagues].map(league => `
              <button
                class="chip ${filter === league ? "active" : ""}"
                data-filter="${esc(league)}"
              >${esc(league)}</button>
            `).join("")
          }
        </div>
      </div>

      <div class="grid" id="matches">
        ${contentCards(page)}
      </div>
    `;

    if (!cfg.items.some(item => item.category === page)) {
      html += `
        <div class="card empty">
          <h2>No matches scheduled yet</h2>
          <p>Upcoming matches will appear here.</p>
        </div>
      `;
    }
  } else if (page === "tv") {
    const channels = cfg.items.filter(
      item => item.category === "tv"
    );

    html = `
      <section class="tv-hero">
        <div>
          <span class="tv-badge">
            <span class="dot"></span>Live TV Streaming
          </span>

          <h1>Your channels.<br><em>One place to watch.</em></h1>

          <p>
            Explore your favourite TV channels.
            Choose a channel, select a server and start watching.
          </p>
        </div>

        <div class="tv-hero-art" aria-hidden="true">
          <svg viewBox="0 0 160 160" fill="none">
            <path
              d="M56 28 80 47 107 22"
              stroke="white"
              stroke-width="7"
              stroke-linecap="round"
            />
            <rect
              x="22" y="47" width="118" height="88"
              rx="20" fill="white"
            />
            <rect
              x="34" y="59" width="80" height="62"
              rx="12" fill="#b72026"
            />
            <path d="m64 75 24 15-24 15V75Z" fill="white"/>
            <circle cx="127" cy="76" r="5" fill="#b72026"/>
            <circle cx="127" cy="96" r="5" fill="#b72026"/>
          </svg>
        </div>
      </section>

      <div class="sectionhead tv-section">
        <div>
          <h2>TV Channels</h2>
          <p class="sub">
            Select a channel to start watching its live stream
          </p>
        </div>

        <span class="tv-badge">
          ${channels.length} channels
        </span>
      </div>

      <div class="tv-toolbar">
        <input
          id="search"
          class="tv-search"
          type="search"
          placeholder="Search channels…"
          aria-label="Search content"
        >
        <span class="hint">All channels</span>
      </div>

      <div id="listing" class="tv-grid">
        ${contentCards("tv")}
      </div>

      <div id="tv-no-results" class="empty" hidden>
        No channels match your search.
      </div>
    `;

    if (!channels.length) {
      html += `
        <div class="card empty">
          <h2>Your channel directory is ready</h2>
          <p>Channels will appear here once they are published.</p>
        </div>
      `;
    }
  } else if (page === "highlights") {
    html = heading(
      "Highlights",
      "Relive the goals, the drama and the best moments."
    );

    html += `
      <div class="sectionhead">
        <h2>Latest videos</h2>
        <input
          class="search"
          id="search"
          placeholder="Search videos…"
          aria-label="Search content"
        >
      </div>

      <div class="grid" id="listing">
        ${contentCards("highlights")}
      </div>
    `;

    if (!cfg.items.some(item => item.category === "highlights")) {
      html += `
        <div class="card empty">
          <h2>No highlights yet</h2>
          <p>New highlights will appear here.</p>
        </div>
      `;
    }
  } else if (page === "settings") {
    html = heading("Settings", "Make Anawar Live your own.");

    html += `
      <div class="card form">
        <h2>Appearance</h2>
        <p class="help">
          Your display preference is saved on this device.
        </p>

        <select id="appearance" aria-label="Appearance">
          <option value="dark">United dark</option>
          <option value="light">Away kit light</option>
        </select>
      </div>
    `;
  }

  $("app").innerHTML = html;
  bindPage(page);
}

function bindPage(page) {
  document.querySelectorAll("[data-item]").forEach(button => {
    button.onclick = () => {
      openContent(Number(button.dataset.item));
    };
  });

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.onclick = () => {
      filter = button.dataset.filter;
      render();
    };
  });

  $("hero-watch")?.addEventListener("click", () => {
    $("matches")?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  });

  $("search")?.addEventListener("input", event => {
    const query = event.target.value.toLowerCase();

    const cards = [
      ...document.querySelectorAll(
        "#listing .card, #listing .tv-tile"
      )
    ];

    cards.forEach(card => {
      card.classList.toggle(
        "hidden",
        !card.textContent.toLowerCase().includes(query)
      );
    });

    if ($("tv-no-results")) {
      $("tv-no-results").hidden =
        !cards.length ||
        cards.some(card => !card.classList.contains("hidden"));
    }
  });

  if (page === "settings") {
    $("appearance").value =
      localStorage.getItem("anawar-theme") || "dark";

    $("appearance").onchange = event => {
      localStorage.setItem(
        "anawar-theme",
        event.target.value
      );

      applyAppearance();
    };
  }
}

/* VIDEO.JS */

function loadPlayerSDK() {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (!$("anawar-videojs-css")) {
      const css = document.createElement("link");
      css.id = "anawar-videojs-css";
      css.rel = "stylesheet";
      css.href =
        "https://cdn.jsdelivr.net/npm/video.js@8.23.4/dist/video-js.min.css";

      document.head.append(css);
    }

    if (window.videojs) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/video.js@8.23.4/dist/video.min.js";

    const timeout = setTimeout(() => {
      script.remove();

      reject(
        Error("Player download timed out. Press Retry stream.")
      );
    }, 15000);

    script.onload = () => {
      clearTimeout(timeout);

      if (window.videojs) resolve();
      else reject(Error("Video.js did not load."));
    };

    script.onerror = () => {
      clearTimeout(timeout);
      script.remove();

      reject(
        Error("Cannot download Video.js. Check your connection.")
      );
    };

    document.head.append(script);
  }).catch(error => {
    sdkPromise = null;
    throw error;
  });

  return sdkPromise;
}

function installPlayerStyles() {
  if ($("anawar-player-fix-styles")) return;

  const style = document.createElement("style");
  style.id = "anawar-player-fix-styles";

  style.textContent = `
    #player {
      position: relative;
      background: #000;
    }

    #player > .video-js {
      width: 100%;
      height: 100%;
      min-height: 0;
      background: #000;
    }

    #player .video-js .vjs-tech {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    #player .video-js .vjs-big-play-button {
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      border-color: #fff;
      background: #a51b25cc;
    }

    #player .video-js .vjs-control-bar {
      z-index: 8;
      background: #100d12e6;
    }

    #player .video-js .vjs-icon-placeholder {
      font-family: VideoJS;
    }

    #player .video-js .vjs-control-text {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }

    #player .video-js .vjs-play-progress {
      background: #da291c;
    }

    #player .player-sponsor {
      position: absolute;
      display: block;
      visibility: visible;
      opacity: 1;
      top: 0;
      left: 0;
      right: 0;
      z-index: 6;
      width: 100%;
      max-width: none;
      margin: 0;
      padding: 0;
      background: transparent;
      pointer-events: none;
    }

    #player .player-sponsor .mini-ad {
      position: static;
      display: block;
      width: 100%;
      max-width: none;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      pointer-events: auto;
    }

    #player .player-sponsor img {
      display: block;
      width: 100%;
      height: auto;
      max-height: none;
      object-fit: contain;
    }

    #player .sponsor-dismiss {
      position: absolute;
      top: 5px;
      right: 5px;
      z-index: 7;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      margin: 0;
      padding: 0;
      border: 1px solid #ffffff80;
      border-radius: 50%;
      background: #000b;
      color: white;
      font: 700 20px Arial, sans-serif;
      cursor: pointer;
      pointer-events: auto;
    }

    #topad:has(> img) {
      display: block;
      padding: 0;
      min-height: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }

    #topad:has(> img)::after {
      display: none;
    }

    #topad > img {
      display: block;
      width: 100%;
      height: auto;
      max-height: none;
      object-fit: contain;
    }
  `;

  document.head.append(style);
}

function setPlayerMessage(text) {
  const target = document.querySelector(".stream-message");
  if (target) target.textContent = text;
}

function playbackState() {
  const video = $("player").querySelector("video");

  if (!video) return null;

  return {
    time: Number.isFinite(video.duration)
      ? video.currentTime
      : 0,
    paused: video.paused,
    volume: video.volume,
    muted: video.muted
  };
}

function restorePlayback(video, state) {
  if (!video || !state) return;

  video.volume = state.volume;
  video.muted = state.muted;

  function restore() {
    if (
      Number.isFinite(video.duration) &&
      state.time > 0
    ) {
      video.currentTime = Math.min(
        state.time,
        Math.max(0, video.duration - 0.1)
      );
    }

    if (state.paused) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }

  if (video.readyState >= 1) restore();
  else video.addEventListener("loadedmetadata", restore, {
    once: true
  });
}

function teardownPlayer() {
  clearTimeout(reconnectTimer);
  reconnectTimer = null;

  if (playerCleanup) {
    playerCleanup();
    playerCleanup = null;
  }

  const video = $("player").querySelector("video");

  if (video) {
    if (typeof AnawarPlayer !== "undefined") {
      AnawarPlayer.closeMini(video);
    } else {
      video.pause();
    }
  }

  if (activePlayer) {
    activePlayer.dispose();
    activePlayer = null;
  }

  $("player").replaceChildren();
}

function closePlayer() {
  ++playerRequest;
  teardownPlayer();

  const modal = $("modal");

  if (document.fullscreenElement === modal) {
    document.exitFullscreen().catch(() => {});
  }

  if (modal.open) modal.close();

  currentPlayerIndex = null;
  bannerDismissed = false;

  document.querySelector(".below-player").replaceChildren();
}

/* BANNER SETTINGS ARE READ FROM custom-banners.js */

function addPlayerBanner(container) {
  if (
    bannerDismissed ||
    !container ||
    container.querySelector(".player-sponsor")
  ) {
    return;
  }

  const image = imageURL(cfg.playerImage || "");

  if (!image && !cfg.playerTitle) return;

  const wrapper = document.createElement("div");
  wrapper.className = "player-sponsor";

  const link = document.createElement("a");
  link.className = "mini-ad";
  link.href = safeURL(cfg.playerUrl) || "https://example.com";
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "Player sponsor";
    link.append(img);
  } else {
    link.textContent = cfg.playerTitle;
  }

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "sponsor-dismiss";
  dismiss.textContent = "×";
  dismiss.setAttribute("aria-label", "Close player banner");

  dismiss.onclick = event => {
    event.preventDefault();
    event.stopPropagation();

    bannerDismissed = true;
    wrapper.remove();
  };

  wrapper.append(link, dismiss);
  container.append(wrapper);
}

function sourceType(source) {
  if (/\.m3u8(?:[?#]|$)/i.test(source)) {
    return "application/x-mpegURL";
  }

  if (/\.mpd(?:[?#]|$)/i.test(source)) {
    return "application/dash+xml";
  }

  if (/\.webm(?:[?#]|$)/i.test(source)) {
    return "video/webm";
  }

  return "video/mp4";
}

function mountExtraTools(options) {
  if (typeof AnawarPlayer === "undefined") {
    return () => {};
  }

  return AnawarPlayer.mount(options);
}

async function openContent(
  index,
  serverIndex = 0,
  resume = null
) {
  const item = cfg.items[index];
  if (!item) return;

  const streams =
    item.streams && item.streams.length
      ? item.streams
      : [
          {
            label: "Server 1",
            url: item.url,
            kind: item.kind || "video"
          }
        ];

  if (!streams[serverIndex]) serverIndex = 0;

  const source = streams[serverIndex];
  const ticket = ++playerRequest;

  teardownPlayer();

  if (currentPlayerIndex !== index) {
    bannerDismissed = false;
  }

  currentPlayerIndex = index;

  const modal = $("modal");
  const host = $("player");
  const panel = document.querySelector(".below-player");

  $("player-title").textContent = item.title;
  panel.replaceChildren();

  const servers = document.createElement("div");
  servers.className = "filters";

  streams.forEach((stream, position) => {
    const button = document.createElement("button");
    button.type = "button";

    button.className =
      "chip" + (position === serverIndex ? " active" : "");

    button.textContent =
      stream.label || "Server " + (position + 1);

    button.onclick = () => {
      openContent(index, position, playbackState());
    };

    servers.append(button);
  });

  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "chip";
  retry.textContent = "Retry stream";

  retry.onclick = () => {
    openContent(index, serverIndex, playbackState());
  };

  servers.append(retry);

  const status = document.createElement("p");
  status.className = "stream-message";
  status.setAttribute("role", "status");
  status.style.marginTop = "12px";
  status.textContent = "Loading player…";

  panel.append(servers, status);

  if (!modal.open) modal.showModal();

  if (!safeURL(source.url)) {
    setPlayerMessage("Add a valid video URL in your admin.");
    return;
  }

  if (source.kind === "embed") {
    const frame = document.createElement("iframe");

    frame.src = safeURL(source.url);
    frame.title = item.title;

    frame.setAttribute(
      "allow",
      "autoplay; fullscreen; picture-in-picture"
    );

    frame.setAttribute("allowfullscreen", "");

    frame.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-presentation"
    );

    frame.style.cssText =
      "width:100%;height:100%;border:0";

    host.append(frame);
    addPlayerBanner(host);

    playerCleanup = mountExtraTools({
      modal,
      player: host,
      video: null,
      hls: null,
      streams,
      serverIndex,
      source,
      title: item.title,
      onSourceChange: (next, state) =>
        openContent(index, next, state)
    });

    setPlayerMessage(
      "Use the embedded player controls or choose another server."
    );

    return;
  }

  try {
    await loadPlayerSDK();

    if (ticket !== playerRequest || !modal.open) return;

    const element = document.createElement("video-js");
    element.className = "video-js vjs-default-skin";
    host.append(element);

    const safari =
      window.videojs.browser.IS_SAFARI ||
      window.videojs.browser.IS_IOS;

    const player = window.videojs(element, {
      controls: true,
      autoplay: false,
      preload: "auto",
      playsinline: true,
      fluid: false,
      fill: true,
      responsive: true,
      liveui: true,
      loop: !!item.demo,

      html5: {
        vhs: {
          overrideNative: !safari,
          enableLowInitialPlaylist: true,
          maxPlaylistRetries: 3
        },
        nativeAudioTracks: !!safari,
        nativeVideoTracks: !!safari
      }
    });

    activePlayer = player;

    const video = player.tech(true).el();
    video.setAttribute("playsinline", "");

    if (resume) {
      video.volume = resume.volume;
      video.muted = resume.muted;
    }

    /* Attach the banner after Video.js is ready. */
    function ensureBanner() {
      if (
        ticket === playerRequest &&
        modal.open &&
        !player.isDisposed()
      ) {
        addPlayerBanner(player.el());
      }
    }

    player.ready(ensureBanner);
    player.on("loadedmetadata", ensureBanner);
    player.on("playing", ensureBanner);

    const removeTools = mountExtraTools({
      modal,
      player: host,
      video,
      hls: null,
      streams,
      serverIndex,
      source,
      title: item.title,
      onSourceChange: (next, state) =>
        openContent(index, next, state)
    });

    const quality = $("player-resolution");

    let selectedQuality = "auto";
    let qualitySignature = "";
    let disposed = false;
    let recoveryCount = 0;

    function representations() {
      try {
        return player.tech(true).vhs?.representations() || [];
      } catch {
        return [];
      }
    }

    function refreshQuality() {
      if (disposed || !quality) return;

      const reps = representations();

      const signature = JSON.stringify([
        reps.map(rep => [
          rep.id,
          rep.height,
          rep.bandwidth
        ]),
        video.videoHeight
      ]);

      if (
        signature === qualitySignature &&
        !quality.value.startsWith("source:")
      ) {
        return;
      }

      qualitySignature = signature;
      quality.replaceChildren();
      quality.disabled = false;

      function add(value, text, group = quality) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        group.append(option);
      }

      if (reps.length > 1) {
        add("auto", "Auto (adaptive)");

        reps.forEach((rep, position) => {
          add(
            "quality:" + position,
            rep.height
              ? rep.height + "p"
              : Math.round(rep.bandwidth / 1000) + " kbps"
          );
        });
      } else {
        add(
          "auto",
          safari && /\.m3u8(?:[?#]|$)/i.test(source.url)
            ? "Auto (Safari)"
            : video.videoHeight
              ? video.videoHeight + "p (source)"
              : "Auto / source quality"
        );
      }

      if (streams.length > 1) {
        const group = document.createElement("optgroup");
        group.label = "Stream servers";

        streams.forEach((stream, position) => {
          add(
            "server:" + position,
            stream.label || "Server " + (position + 1),
            group
          );
        });

        quality.append(group);
      }

      quality.value = [...quality.options].some(
        option => option.value === selectedQuality
      )
        ? selectedQuality
        : "auto";

      quality.disabled =
        reps.length <= 1 && streams.length <= 1;
    }

    if (quality) {
      quality.onchange = () => {
        if (quality.value.startsWith("server:")) {
          openContent(
            index,
            Number(quality.value.slice(7)),
            playbackState()
          );
          return;
        }

        selectedQuality = quality.value;
        const reps = representations();

        if (selectedQuality === "auto") {
          reps.forEach(rep => rep.enabled(true));
        } else {
          const selected = Number(
            selectedQuality.slice(8)
          );

          reps.forEach((rep, position) => {
            rep.enabled(position === selected);
          });
        }

        setPlayerMessage(
          selectedQuality === "auto"
            ? "Adaptive quality enabled."
            : "Selected " +
              quality.selectedOptions[0].textContent +
              "."
        );
      };
    }

    video.addEventListener(
      "loadedmetadata",
      refreshQuality
    );

    video.addEventListener("resize", refreshQuality);
    player.on("loadedmetadata", refreshQuality);

    const qualityTimer = setInterval(
      refreshQuality,
      2000
    );

    playerCleanup = () => {
      disposed = true;
      clearInterval(qualityTimer);

      video.removeEventListener(
        "loadedmetadata",
        refreshQuality
      );

      video.removeEventListener(
        "resize",
        refreshQuality
      );

      removeTools();
    };

    refreshQuality();

    const mediaSource = {
      src: safeURL(source.url),
      type: sourceType(source.url)
    };

    function play() {
      const attempt = player.play();

      if (attempt && attempt.catch) {
        attempt.catch(() => {
          if (ticket === playerRequest) {
            setPlayerMessage(
              "Press the play button to start."
            );
          }
        });
      }
    }

    player.one("loadedmetadata", () => {
      if (resume) restorePlayback(video, resume);
      else play();
    });

    player.on("playing", () => {
      clearTimeout(reconnectTimer);

      setPlayerMessage(
        "Video.js playback · Choose another server if needed."
      );
    });

    player.on("waiting", () => {
      setPlayerMessage("Buffering…");
    });

    player.on("error", () => {
      if (ticket !== playerRequest) return;

      const error = player.error();

      if (error?.code === 2 && recoveryCount < 2) {
        recoveryCount++;

        setPlayerMessage(
          "Connection interrupted. Reconnecting (" +
          recoveryCount +
          "/2)…"
        );

        reconnectTimer = setTimeout(() => {
          if (ticket !== playerRequest) return;

          const state = playbackState();

          player.error(null);
          player.src(mediaSource);

          player.one("loadedmetadata", () => {
            restorePlayback(video, state);
          });

          if (!state?.paused) play();
        }, 1500 * recoveryCount);
      } else {
        setPlayerMessage(
          error?.code === 3
            ? "This stream could not be decoded. Try another server."
            : "Stream unavailable. The link may be expired or blocked by the source. Try another server."
        );
      }
    });

    player.src(mediaSource);

    if (!resume || !resume.paused) play();
  } catch (error) {
    if (ticket === playerRequest) {
      setPlayerMessage(
        error.message ||
        "Unable to start this player. Try another server."
      );
    }
  }
}

/* CONTENT LOADING */

async function boot() {
  installPlayerStyles();

  try {
    if (window.STATIC_SITE) {
      cfg = {
        ...defaults,
        ...readCommittedContent(defaults)
      };
    } else {
      const response = await fetch("/api/config", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw Error(
          "Content could not be loaded. Please refresh."
        );
      }

      const data = await response.json();

      cfg = {
        ...defaults,
        ...(data.config || {})
      };

      canAdmin = !!data.canAdmin;
      configVersion = data.version;
    }

    if (!Array.isArray(cfg.items)) cfg.items = [];

    if (typeof applyDemoSchedule === "function") {
      cfg = applyDemoSchedule(cfg);
    }
  } catch (error) {
    loadError = error.message;
  }

  render();

  if (loadError) {
    $("app").insertAdjacentHTML(
      "afterbegin",
      `<div class="notice">${esc(loadError)}</div>`
    );
  }
}

/* PAGE EVENTS */

$("close").onclick = closePlayer;

$("modal").addEventListener("cancel", event => {
  event.preventDefault();
  closePlayer();
});

$("modal").addEventListener("close", () => {
  if (
    activePlayer ||
    $("player").childNodes.length
  ) {
    closePlayer();
  }
});

window.addEventListener("hashchange", () => {
  closePlayer();
  render();
  window.scrollTo(0, 0);
});

setInterval(() => {
  document.querySelectorAll("[data-state]").forEach(element => {
    const item = cfg.items[Number(element.dataset.state)];
    if (!item) return;

    const state = matchStatus(item);

    element.textContent = state;
    element.classList.toggle(
      "is-live",
      state === "LIVE"
    );
  });
}, 1000);

boot();
