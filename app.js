/* ============================================================
   Pokédex SPA — frontend for https://pokeapi.co/
   All network access uses XMLHttpRequest (XHR), as required.
   ============================================================ */

(function () {
  "use strict";

  var API = "https://pokeapi.co/api/v2";
  var PAGE_SIZE = 24;

  // ---- DOM refs ----
  var grid = document.getElementById("grid");
  var statusEl = document.getElementById("status");
  var loadMoreBtn = document.getElementById("load-more");
  var searchForm = document.getElementById("search-form");
  var searchInput = document.getElementById("search-input");
  var modal = document.getElementById("modal");
  var modalBody = document.getElementById("modal-body");

  // ---- State ----
  var offset = 0;
  var detailCache = {}; // name/id -> detail object, avoids refetching

  /* ------------------------------------------------------------
     Core XHR helper. Returns parsed JSON via callbacks.
     ------------------------------------------------------------ */
  function xhrGetJSON(url, onSuccess, onError) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "json";
    xhr.timeout = 15000;

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        // responseType "json" gives a parsed object in modern browsers;
        // fall back to manual parse just in case.
        var data = xhr.response;
        if (typeof data === "string") {
          try { data = JSON.parse(data); } catch (e) { data = null; }
        }
        onSuccess(data);
      } else if (xhr.status === 404) {
        onError({ notFound: true, status: 404 });
      } else {
        onError({ status: xhr.status, message: "Request failed (" + xhr.status + ")" });
      }
    };
    xhr.onerror = function () { onError({ message: "Network error. Check your connection." }); };
    xhr.ontimeout = function () { onError({ message: "Request timed out." }); };

    xhr.send();
  }

  /* ------------------------------------------------------------
     UI helpers
     ------------------------------------------------------------ */
  function setStatus(msg, isError) {
    statusEl.textContent = msg || "";
    statusEl.className = "status" + (isError ? " error" : "");
  }

  function showSpinner(target) {
    var s = document.createElement("div");
    s.className = "spinner";
    target.appendChild(s);
    return s;
  }

  function idFromUrl(url) {
    // ".../pokemon/25/" -> "25"
    var parts = url.split("/").filter(Boolean);
    return parts[parts.length - 1];
  }

  function pad(n) { return "#" + String(n).padStart(3, "0"); }

  function spriteFor(detail) {
    var s = detail.sprites || {};
    var official = s.other && s.other["official-artwork"] && s.other["official-artwork"].front_default;
    return official || s.front_default || "";
  }

  /* ------------------------------------------------------------
     Render a single card. Each card lazily fetches its own
     detail (sprite + types) with another XHR call.
     ------------------------------------------------------------ */
  function renderCard(name, id) {
    var card = document.createElement("article");
    card.className = "card";
    card.setAttribute("tabindex", "0");
    card.innerHTML =
      '<span class="num">' + pad(id) + "</span>" +
      '<div class="card-img"><div class="spinner"></div></div>' +
      '<div class="name">' + name + "</div>" +
      '<div class="types"></div>';
    grid.appendChild(card);

    function open() { openDetail(name); }
    card.addEventListener("click", open);
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });

    // Fetch detail to fill in sprite + type chips.
    getDetail(name, function (detail) {
      var imgWrap = card.querySelector(".card-img");
      var img = new Image();
      img.alt = name;
      img.src = spriteFor(detail);
      imgWrap.innerHTML = "";
      imgWrap.appendChild(img);

      var typesEl = card.querySelector(".types");
      typesEl.innerHTML = detail.types.map(function (t) {
        var tn = t.type.name;
        return '<span class="chip t-' + tn + '">' + tn + "</span>";
      }).join("");
    }, function () {
      var imgWrap = card.querySelector(".card-img");
      if (imgWrap) imgWrap.innerHTML = "";
    });
  }

  /* ------------------------------------------------------------
     Detail fetch with cache
     ------------------------------------------------------------ */
  function getDetail(nameOrId, onSuccess, onError) {
    var key = String(nameOrId).toLowerCase();
    if (detailCache[key]) { onSuccess(detailCache[key]); return; }
    xhrGetJSON(API + "/pokemon/" + key, function (data) {
      detailCache[key] = data;
      onSuccess(data);
    }, onError || function () {});
  }

  /* ------------------------------------------------------------
     List loading (paginated)
     ------------------------------------------------------------ */
  function loadPage() {
    loadMoreBtn.disabled = true;
    setStatus("Loading Pokémon…");
    xhrGetJSON(API + "/pokemon?limit=" + PAGE_SIZE + "&offset=" + offset, function (data) {
      setStatus("");
      data.results.forEach(function (p) {
        renderCard(p.name, idFromUrl(p.url));
      });
      offset += PAGE_SIZE;
      loadMoreBtn.hidden = data.next === null;
      loadMoreBtn.disabled = false;
    }, function (err) {
      setStatus(err.message || "Failed to load list.", true);
      loadMoreBtn.disabled = false;
    });
  }

  /* ------------------------------------------------------------
     Search — PokeAPI has no fuzzy search endpoint, so we look up
     the exact name/id directly. A 404 means "not found".
     ------------------------------------------------------------ */
  function doSearch(query) {
    var q = query.trim().toLowerCase();
    if (!q) { resetList(); return; }

    grid.innerHTML = "";
    loadMoreBtn.hidden = true;
    setStatus('Searching for "' + q + '"…');

    getDetail(q, function (detail) {
      setStatus("");
      renderCard(detail.name, detail.id);
      openDetail(detail.name);
    }, function (err) {
      if (err.notFound) {
        setStatus('No Pokémon found for "' + q + '". Try an exact name (e.g. "pikachu") or number.', true);
      } else {
        setStatus(err.message || "Search failed.", true);
      }
    });
  }

  function resetList() {
    grid.innerHTML = "";
    offset = 0;
    setStatus("");
    loadPage();
  }

  /* ------------------------------------------------------------
     Detail modal
     ------------------------------------------------------------ */
  function openDetail(nameOrId) {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modalBody.innerHTML = "";
    showSpinner(modalBody);

    getDetail(nameOrId, function (d) {
      var typeChips = d.types.map(function (t) {
        return '<span class="chip t-' + t.type.name + '">' + t.type.name + "</span>";
      }).join("");

      var statRows = d.stats.map(function (s) {
        var pct = Math.min(100, Math.round((s.base_stat / 180) * 100));
        return (
          '<div class="stat-row">' +
            '<span class="label">' + s.stat.name.replace("-", " ") + "</span>" +
            "<span>" + s.base_stat + "</span>" +
            '<span class="bar"><span style="width:' + pct + '%"></span></span>' +
          "</div>"
        );
      }).join("");

      var abilities = d.abilities.map(function (a) {
        return '<span class="chip">' + a.ability.name.replace("-", " ") +
          (a.is_hidden ? " (hidden)" : "") + "</span>";
      }).join("");

      modalBody.innerHTML =
        '<div class="detail-head">' +
          '<img src="' + spriteFor(d) + '" alt="' + d.name + '" />' +
          '<div class="num">' + pad(d.id) + "</div>" +
          "<h2>" + d.name + "</h2>" +
          '<div class="types">' + typeChips + "</div>" +
        "</div>" +
        '<div class="detail-meta">' +
          "<div>Height<strong>" + (d.height / 10) + " m</strong></div>" +
          "<div>Weight<strong>" + (d.weight / 10) + " kg</strong></div>" +
          "<div>Base XP<strong>" + (d.base_experience || "—") + "</strong></div>" +
        "</div>" +
        '<div class="section-title">Base stats</div>' +
        '<div class="stats">' + statRows + "</div>" +
        '<div class="section-title">Abilities</div>' +
        '<div class="abilities">' + abilities + "</div>";
    }, function (err) {
      modalBody.innerHTML = '<p class="status error">' +
        (err.notFound ? "Pokémon not found." : (err.message || "Could not load details.")) + "</p>";
    });
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  /* ------------------------------------------------------------
     Events
     ------------------------------------------------------------ */
  searchForm.addEventListener("submit", function (e) {
    e.preventDefault();
    doSearch(searchInput.value);
  });

  // Clearing the search box (via the native "x") restores the list.
  searchInput.addEventListener("search", function () {
    if (!searchInput.value.trim()) resetList();
  });

  loadMoreBtn.addEventListener("click", loadPage);

  modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  // ---- Boot ----
  loadPage();
})();
