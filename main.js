(function () {
  "use strict";
  var cfg = window.SITE_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Contact details: only shown once filled in config.js */
  var direct = $("#contact-direct"), foot = $("#footer-contact"), html = "";
  if (cfg.phone) {
    var tel = cfg.phone.replace(/[^\d+]/g, "");
    html += '<p>Prefer to talk? Call or text <a href="tel:' + tel + '">' + cfg.phone + "</a></p>";
  }
  if (cfg.email) html += '<p>Email <a href="mailto:' + cfg.email + '">' + cfg.email + "</a></p>";
  if (cfg.serviceArea) {
    html += "<p>Serving " + cfg.serviceArea + ".</p>";
    var area = $("#area p"); if (area) area.textContent = "We serve " + cfg.serviceArea + ". Not sure if you're in range? Send your ZIP code with your request.";
  }
  if (html) { direct.innerHTML = html; direct.hidden = false; foot.innerHTML = '<h3 style="margin-top:20px">Contact</h3>' + html; }
  if (cfg.showDbaLine) $("#dba-line").textContent = " Coastal Tile Installation is a DBA of DealsConnect LLC.";
  $("#year").textContent = new Date().getFullYear();

  /* Mobile menu */
  var toggle = $(".menu-toggle"), nav = $("#nav");
  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
    toggle.textContent = open ? "Close" : "Menu";
  });
  $$("#nav a").forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); toggle.textContent = "Menu"; }); });

  /* CTA links preselect the project type */
  $$("[data-project]").forEach(function (a) {
    a.addEventListener("click", function () { var s = $("#f-type"); if (s) s.value = a.getAttribute("data-project"); });
  });

  /* Gallery filters */
  var tiles = $$(".tile");
  $$(".filters button").forEach(function (b) {
    b.addEventListener("click", function () {
      var f = b.getAttribute("data-filter");
      $$(".filters button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      tiles.forEach(function (t) { t.hidden = !(f === "all" || t.getAttribute("data-cat") === f); });
    });
  });

  /* Lightbox */
  var lb = $("#lightbox"), media = $("#lb-media"), cap = $("#lb-caption"), current = -1;
  function visible() { return tiles.filter(function (t) { return !t.hidden; }).map(function (t) { return $("button", t); }); }
  function show(btn) {
    var list = visible(); current = list.indexOf(btn);
    media.innerHTML = "";
    if (btn.dataset.video) {
      var v = document.createElement("video");
      v.src = btn.dataset.video; v.poster = btn.dataset.poster; v.controls = true; v.playsInline = true; v.muted = true; v.autoplay = true; v.loop = true;
      v.setAttribute("aria-label", btn.dataset.caption);
      media.appendChild(v);
    } else {
      var img = document.createElement("img");
      img.src = btn.dataset.full; img.alt = $("img", btn).alt;
      media.appendChild(img);
    }
    cap.textContent = btn.dataset.caption;
  }
  function step(d) { var list = visible(); if (!list.length) return; show(list[(current + d + list.length) % list.length]); }
  tiles.forEach(function (t) {
    $("button", t).addEventListener("click", function (e) {
      show(e.currentTarget);
      if (typeof lb.showModal === "function") lb.showModal(); else lb.setAttribute("open", "");
    });
  });
  $("#lb-close").addEventListener("click", function () { lb.close(); });
  $("#lb-prev").addEventListener("click", function () { step(-1); });
  $("#lb-next").addEventListener("click", function () { step(1); });
  lb.addEventListener("close", function () { media.innerHTML = ""; });
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target.classList.contains("lightbox-inner")) lb.close(); });
  lb.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); });

  /* Estimate form */
  var form = $("#estimate-form"), status = $("#form-status"), submit = $("#f-submit");
  var MAX_PHOTOS = 4;

  function setErr(name, msg) {
    var el = $("#e-" + name), input = form.elements[name];
    if (el) el.textContent = msg || "";
    if (input && input.setAttribute) input.setAttribute("aria-invalid", msg ? "true" : "false");
  }
  function validate() {
    var ok = true, f = form.elements, first = null;
    function check(name, cond, msg) { if (!cond) { setErr(name, msg); ok = false; if (!first) first = f[name]; } else setErr(name, ""); }
    check("name", f.name.value.trim().length >= 2, "Enter your name.");
    check("email", /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim()), "Enter a valid email, like name@example.com.");
    check("phone", f.phone.value.replace(/\D/g, "").length >= 10, "Enter a phone number with area code.");
    check("location", f.location.value.trim().length >= 3, "Enter the project ZIP code or address.");
    check("projectType", !!f.projectType.value, "Choose the type of project.");
    check("description", f.description.value.trim().length >= 10, "Describe the project in a sentence or two.");
    check("photos", f.photos.files.length <= MAX_PHOTOS, "Choose up to " + MAX_PHOTOS + " photos.");
    check("consent", f.consent.checked, "Check the box so we can contact you about this project.");
    if (first && first.focus) first.focus();
    return ok;
  }

  function resize(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) return reject(new Error("not an image"));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1400, s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var data = c.toDataURL("image/jpeg", 0.78);
        resolve({ filename: (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg", content: data.split(",")[1] });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("unreadable image")); };
      img.src = url;
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.className = "form-status"; status.textContent = "";
    if (!validate()) return;
    submit.disabled = true; submit.textContent = "Sending…";
    var f = form.elements;
    var files = Array.prototype.slice.call(f.photos.files, 0, MAX_PHOTOS);
    Promise.all(files.map(function (file) { return resize(file).catch(function () { return null; }); }))
      .then(function (photos) {
        var payload = {
          name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(),
          location: f.location.value.trim(), projectType: f.projectType.value, size: f.size.value.trim(),
          start: f.start.value, description: f.description.value.trim(),
          contactMethod: (form.querySelector("input[name=contactMethod]:checked") || {}).value || "",
          consent: f.consent.checked, company: f.company.value,
          photos: photos.filter(Boolean)
        };
        return fetch("/api/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, j: j }; }); })
      .then(function (r) {
        if (r.ok) {
          form.reset();
          status.className = "form-status ok";
          status.textContent = "Estimate request sent. We'll reach out using your preferred contact method.";
        } else {
          throw new Error(r.j && r.j.error ? r.j.error : "The request didn't go through.");
        }
      })
      .catch(function (err) {
        status.className = "form-status bad";
        var alt = cfg.phone ? " You can also call or text " + cfg.phone + "." : (cfg.email ? " You can also email " + cfg.email + "." : "");
        status.textContent = (err && err.message ? err.message : "The request didn't go through.") + " Your answers are still in the form; try again in a moment." + alt;
      })
      .then(function () { submit.disabled = false; submit.textContent = "Send estimate request"; });
  });
})();
