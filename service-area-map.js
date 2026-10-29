/*
 * Service Area Map — Five Star Transportation / Admiral Chauffeured Transportation
 * Drop-in embed: <div id="service-area-map"></div> + this script (data-source points at a locations JSON file).
 * Same shape as a typical store-locator embed: one container, one script, one data feed, pins + synced sidebar list.
 * No API key and no third-party billing — uses Leaflet + OpenStreetMap raster tiles.
 */
(function () {
  "use strict";

  var thisScript = document.currentScript;
  var CSS_HREF = thisScript.src.replace(/service-area-map\.js(\?.*)?$/, "service-area-map.css");
  var LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  var LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  var LEAFLET_INTEGRITY_JS = "sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH";
  var LEAFLET_INTEGRITY_CSS = "sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function loadOnce(tag, attrs, href) {
    var existing = document.querySelector(tag + '[data-gtn-sam-asset="' + href + '"]');
    if (existing) {
      return existing._gtnLoaded ? Promise.resolve() : existing._gtnPromise;
    }
    var el = document.createElement(tag);
    el.setAttribute("data-gtn-sam-asset", href);
    for (var key in attrs) el.setAttribute(key, attrs[key]);
    var promise = new Promise(function (resolve, reject) {
      el.onload = function () {
        el._gtnLoaded = true;
        resolve();
      };
      el.onerror = reject;
    });
    el._gtnPromise = promise;
    document.head.appendChild(el);
    return promise;
  }

  function ensureLeaflet() {
    var cssPromise = loadOnce("link", { rel: "stylesheet", href: LEAFLET_CSS, integrity: LEAFLET_INTEGRITY_CSS, crossorigin: "" }, LEAFLET_CSS);
    var jsPromise = window.L
      ? Promise.resolve()
      : loadOnce("script", { src: LEAFLET_JS, integrity: LEAFLET_INTEGRITY_JS, crossorigin: "" }, LEAFLET_JS);
    return Promise.all([cssPromise, jsPromise]);
  }

  function ensureWidgetCss() {
    return loadOnce("link", { rel: "stylesheet", href: CSS_HREF }, CSS_HREF);
  }

  function cardHtml(loc) {
    var tags = Array.isArray(loc.tags) ? loc.tags : [];
    return (
      '<div class="gtn-sam-card-name">' + escapeHtml(loc.name) + "</div>" +
      (loc.address ? '<div class="gtn-sam-card-address">' + escapeHtml(loc.address) + "</div>" : "") +
      (loc.description ? '<div class="gtn-sam-card-desc">' + escapeHtml(loc.description) + "</div>" : "") +
      (tags.length
        ? '<div class="gtn-sam-card-tags">' +
          tags.map(function (t) { return '<span class="gtn-sam-tag">' + escapeHtml(t) + "</span>"; }).join("") +
          "</div>"
        : "") +
      (loc.phone
        ? '<a class="gtn-sam-card-phone" href="tel:' + escapeHtml(loc.phone) + '">' + escapeHtml(loc.phone) + "</a>"
        : "")
    );
  }

  function popupHtml(loc) {
    return (
      '<div class="gtn-sam-popup-name">' + escapeHtml(loc.name) + "</div>" +
      (loc.address ? '<div class="gtn-sam-popup-address">' + escapeHtml(loc.address) + "</div>" : "")
    );
  }

  function buildWidget(root, locations, options) {
    root.classList.add("gtn-sam");
    root.style.setProperty("--gtn-sam-accent", options.accent);

    var mapId = root.id + "-canvas";
    root.innerHTML =
      '<div class="gtn-sam-sidebar">' +
      '<div class="gtn-sam-search"><input type="text" placeholder="Search service areas..." aria-label="Search service areas"></div>' +
      '<div class="gtn-sam-list"></div>' +
      "</div>" +
      '<div class="gtn-sam-map" id="' + mapId + '"></div>';

    var listEl = root.querySelector(".gtn-sam-list");
    var searchEl = root.querySelector(".gtn-sam-search input");

    var map = L.map(mapId, { scrollWheelZoom: false });
    L.tileLayer(options.tileUrl, {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    var entries = locations.map(function (loc) {
      var marker = L.marker([loc.lat, loc.lng]).addTo(map).bindPopup(popupHtml(loc));
      var card = document.createElement("div");
      card.className = "gtn-sam-card";
      card.innerHTML = cardHtml(loc);
      listEl.appendChild(card);

      function activate() {
        entries.forEach(function (e) { e.card.classList.remove("gtn-sam-card--active"); });
        card.classList.add("gtn-sam-card--active");
        map.setView([loc.lat, loc.lng], Math.max(map.getZoom(), 11));
        marker.openPopup();
      }

      card.addEventListener("click", activate);
      marker.on("click", function () {
        entries.forEach(function (e) { e.card.classList.remove("gtn-sam-card--active"); });
        card.classList.add("gtn-sam-card--active");
      });

      return { loc: loc, marker: marker, card: card };
    });

    if (entries.length) {
      map.fitBounds(L.latLngBounds(entries.map(function (e) { return [e.loc.lat, e.loc.lng]; })), { padding: [24, 24] });
    } else {
      listEl.innerHTML = '<div class="gtn-sam-empty">No service areas listed yet.</div>';
    }

    searchEl.addEventListener("input", function () {
      var q = searchEl.value.trim().toLowerCase();
      entries.forEach(function (e) {
        var hay = (e.loc.name + " " + (e.loc.address || "")).toLowerCase();
        var match = hay.indexOf(q) !== -1;
        e.card.style.display = match ? "" : "none";
        if (e.marker._icon) e.marker._icon.style.display = match ? "" : "none";
        if (e.marker._shadow) e.marker._shadow.style.display = match ? "" : "none";
      });
    });

    window.addEventListener("resize", function () { map.invalidateSize(); });
  }

  function init(root) {
    var source = root.getAttribute("data-source");
    if (!source) {
      console.error("GTN Service Area Map: missing data-source on #" + root.id);
      return;
    }
    var options = {
      tileUrl: root.getAttribute("data-tile-url") || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      accent: root.getAttribute("data-accent") || "#0a6cff"
    };

    Promise.all([ensureLeaflet(), ensureWidgetCss(), fetch(source).then(function (r) {
      if (!r.ok) throw new Error("locations fetch failed: " + r.status);
      return r.json();
    })]).then(function (results) {
      var locations = results[2];
      buildWidget(root, Array.isArray(locations) ? locations : [], options);
    }).catch(function (err) {
      console.error("GTN Service Area Map failed to load:", err);
      root.innerHTML = '<div class="gtn-sam-empty">Service area map could not be loaded.</div>';
    });
  }

  var targetId = thisScript.getAttribute("data-target") || "service-area-map";
  var root = document.getElementById(targetId);
  if (root) {
    init(root);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      var el = document.getElementById(targetId);
      if (el) init(el);
    });
  }
})();
