// Animated "try the shade" stages for the product dialog. Pure SVG + CSS, no assets.
// mountViz(el, kind, finish) draws the stage and returns set(hex) to animate to a new shade.
(function () {
  const DEF = { lips: "#b5655f", skin: "#d9a98a", cheek: "#e79a9a", eyes: "#a07060", brow: "#5a4032", scent: "#e9b8a8" };
  const GLOSS = { matte: .05, satin: .16, gloss: .5, shimmer: .35, "": .14 };
  let uid = 0;
  const bez = (a, b, c, d, t) => [0, 1].map(k => (1 - t) ** 3 * a[k] + 3 * (1 - t) ** 2 * t * b[k] + 3 * (1 - t) * t * t * c[k] + t ** 3 * d[k]);

  // shared "apply" wipe: a new colour layer revealed left-to-right over the old one
  function wipeLayers(id, clip, w, h) {
    return `
      <clipPath id="w${id}"><rect class="wipe" x="0" y="0" width="${w}" height="${h}"/></clipPath>
      <g clip-path="url(#${clip})"><rect class="cA" x="0" y="0" width="${w}" height="${h}"/>
        <g clip-path="url(#w${id})"><rect class="cB" x="0" y="0" width="${w}" height="${h}"/></g></g>`;
  }
  function wiper(svg, first) {
    const a = svg.querySelector(".cA"), b = svg.querySelector(".cB"), r = svg.querySelector(".wipe");
    a.style.fill = b.style.fill = first;
    return hex => {
      b.style.fill = hex;
      r.style.transition = "none"; r.style.transform = "scaleX(0)";
      r.getBoundingClientRect();
      r.style.transition = ""; r.style.transform = "scaleX(1)";
      clearTimeout(r._t); r._t = setTimeout(() => a.style.fill = hex, 750);
    };
  }

  const K = {
    lips(id, fin) {
      const up = "M50 150 C 95 92, 160 84, 200 116 C 240 84, 305 92, 350 150 C 300 158, 245 160, 200 158 C 155 160, 100 158, 50 150 Z";
      const lo = "M50 150 C 100 160, 155 162, 200 160 C 245 162, 300 160, 350 150 C 312 216, 258 242, 200 242 C 142 242, 88 216, 50 150 Z";
      const g = GLOSS[fin] ?? .22;
      return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" class="vz lips" aria-hidden="true">
        <defs>
          <radialGradient id="sk${id}" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#f1cdb4"/><stop offset="1" stop-color="#cf9b7e"/></radialGradient>
          <clipPath id="l${id}"><path d="${up}"/><path d="${lo}"/></clipPath>
          <linearGradient id="sh${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
          <filter id="bl${id}"><feGaussianBlur stdDeviation="6"/></filter>
          <filter id="tx${id}"><feTurbulence type="fractalNoise" baseFrequency=".9 .06" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/></filter>
        </defs>
        <rect width="400" height="300" fill="url(#sk${id})"/>
        <ellipse cx="200" cy="168" rx="170" ry="92" fill="#000" opacity=".08" filter="url(#bl${id})"/>
        ${wipeLayers(id, "l" + id, 400, 300)}
        <g clip-path="url(#l${id})">
          <rect width="400" height="300" filter="url(#tx${id})" opacity="${fin === "gloss" ? .25 : .7}"/>
          <rect width="400" height="300" fill="url(#sh${id})"/>
          <ellipse class="gl" cx="205" cy="195" rx="62" ry="11" fill="#fff" opacity="${g}" filter="url(#bl${id})"/>
          <ellipse class="gl" cx="150" cy="128" rx="28" ry="7" fill="#fff" opacity="${g * .8}" filter="url(#bl${id})"/>
          <ellipse class="gl" cx="255" cy="128" rx="28" ry="7" fill="#fff" opacity="${g * .8}" filter="url(#bl${id})"/>
          ${fin === "shimmer" || fin === "gloss" ? `<rect class="sweep" x="-120" y="0" width="80" height="300" fill="#fff" opacity=".22" filter="url(#bl${id})"/>` : ""}
        </g>
        <path d="M50 150 C 100 160, 155 162, 200 160 C 245 162, 300 160, 350 150" fill="none" stroke="#3a1414" stroke-opacity=".45" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`;
    },
    skin(id, fin) {
      return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" class="vz skin" aria-hidden="true">
        <defs>
          <linearGradient id="arm${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3d6c2"/><stop offset=".5" stop-color="#e9bfa3"/><stop offset="1" stop-color="#d6a68a"/></linearGradient>
        </defs>
        <rect width="400" height="300" fill="#2a2326"/>
        <rect x="-20" y="60" width="440" height="180" rx="90" fill="url(#arm${id})"/>
        <text x="200" y="262" text-anchor="middle" font-size="11" fill="#8a6a5a" letter-spacing="3" font-family="sans-serif">SWATCH</text>
        <path class="stroke" d="M70 154 C 140 132, 250 176, 330 150" fill="none" stroke="#5a3020" stroke-opacity=".18" stroke-width="60" stroke-linecap="round" pathLength="1"/>
        <path class="stroke main" d="M70 150 C 140 128, 250 172, 330 146" fill="none" stroke-width="58" stroke-linecap="round" pathLength="1"/>
      </svg>`;
    },
    cheek(id, fin) {
      return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" class="vz cheek" aria-hidden="true">
        <defs>
          <radialGradient id="fc${id}" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#f6dccb"/><stop offset="1" stop-color="#dcae92"/></radialGradient>
          <radialGradient id="ck${id}"><stop class="ckc" offset="0" stop-opacity=".85"/><stop class="ckc" offset="1" stop-opacity="0"/></radialGradient>
          <linearGradient id="hl${id}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        </defs>
        <rect width="400" height="300" fill="#231c1f"/>
        <ellipse cx="200" cy="170" rx="138" ry="168" fill="url(#fc${id})"/>
        <path d="M125 125 q 22 -14 44 0 M231 125 q 22 -14 44 0" stroke="#5a3a30" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M128 140 q 20 10 38 0 M234 140 q 20 10 38 0" stroke="#3a2620" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M200 150 q -6 28 -14 40 q 14 6 28 0" stroke="#b88570" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M172 232 q 28 16 56 0 q -28 -6 -56 0" fill="#c98b7f"/>
        <g class="ck"><circle cx="130" cy="196" r="52" fill="url(#ck${id})"/><circle cx="270" cy="196" r="52" fill="url(#ck${id})"/></g>
        ${fin === "shimmer" ? `<g class="hl"><path d="M100 168 q 30 -18 62 -6" stroke="url(#hl${id})" stroke-width="12" stroke-linecap="round" fill="none"/><path d="M300 168 q -30 -18 -62 -6" stroke="url(#hl${id})" stroke-width="12" stroke-linecap="round" fill="none"/></g>` : ""}
      </svg>`;
    },
    eyes(id) {
      const eye = "M90 170 C 150 110, 250 110, 310 170 C 250 210, 150 210, 90 170 Z";
      return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" class="vz eyes" aria-hidden="true">
        <defs>
          <radialGradient id="es${id}" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#f3d4c0"/><stop offset="1" stop-color="#d9a98c"/></radialGradient>
          <clipPath id="lid${id}"><path d="M70 172 C 120 60, 280 60, 330 172 C 270 110, 130 110, 70 172 Z"/></clipPath>
          <linearGradient id="fade${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".35"/></linearGradient>
          <radialGradient id="ir${id}"><stop offset="0" stop-color="#1b0f0a"/><stop offset=".45" stop-color="#3b2416"/><stop offset="1" stop-color="#6b4a32"/></radialGradient>
        </defs>
        <rect width="400" height="300" fill="url(#es${id})"/>
        ${wipeLayers(id, "lid" + id, 400, 300)}
        <rect width="400" height="300" fill="url(#fade${id})" clip-path="url(#lid${id})"/>
        <path d="${eye}" fill="#fbf6f2"/>
        <circle cx="200" cy="164" r="34" fill="url(#ir${id})"/><circle cx="212" cy="152" r="7" fill="#fff" opacity=".85"/>
        <path d="M90 170 C 150 110, 250 110, 310 170" fill="none" stroke="#1b1210" stroke-width="5" stroke-linecap="round"/>
        <g stroke="#1b1210" stroke-width="2.4" stroke-linecap="round">${Array.from({ length: 15 }, (_, i) => { const t = (i + 1) / 16, [x, y] = bez([90, 170], [150, 110], [250, 110], [310, 170], t), L = 14 + 10 * Math.sin(Math.PI * t); return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q ${((t - .5) * 10).toFixed(1)} ${(-L * .7).toFixed(1)} ${((t - .5) * 34).toFixed(1)} ${(-L).toFixed(1)}" fill="none"/>`; }).join("")}</g>
        <path d="M95 92 C 150 50, 260 50, 320 88" fill="none" stroke="#4a3328" stroke-width="10" stroke-linecap="round" opacity=".75"/>
      </svg>`;
    },
    brow(id) {
      const lo = [[88, 160], [150, 136], [240, 122], [322, 142]], up = [[88, 148], [140, 108], [235, 88], [322, 142]];
      const hairs = Array.from({ length: 46 }, (_, i) => {
        const t = i / 45, [x1, y1] = bez(...lo, t), [x2, y2] = bez(...up, Math.min(1, t + .04));
        const k = .55 + (i * 7 % 5) / 10;
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${(x1 + (x2 - x1) * k + 10).toFixed(1)}" y2="${(y1 + (y2 - y1) * k).toFixed(1)}" style="transition-delay:${(t * .7).toFixed(2)}s"/>`;
      }).join("");
      const shape = `M${lo[0]} C${lo[1]} ${lo[2]} ${lo[3]} C${up[2]} ${up[1]} ${up[0]} Z`;
      return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" class="vz brow" aria-hidden="true">
        <defs><radialGradient id="bs${id}" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#f3d4c0"/><stop offset="1" stop-color="#d4a286"/></radialGradient></defs>
        <rect width="400" height="300" fill="url(#bs${id})"/>
        <path d="M110 238 C 160 200, 250 200, 300 238" fill="none" stroke="#1b1210" stroke-width="4" stroke-linecap="round"/>
        <g class="hairs"><path class="fillb" d="${shape}"/><g stroke-width="2.2" stroke-linecap="round">${hairs}</g></g>
      </svg>`;
    },
    scent(id) {
      const bubbles = Array.from({ length: 9 }, (_, i) => `<circle class="bub" cx="${165 + (i * 37) % 70}" cy="250" r="${2 + (i % 3)}" style="animation-delay:${(i * .7).toFixed(1)}s"/>`).join("");
      return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" class="vz scent" aria-hidden="true">
        <defs>
          <radialGradient id="ray${id}" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
          <clipPath id="bt${id}"><rect x="140" y="110" width="120" height="160" rx="22"/></clipPath>
          <linearGradient id="gl${id}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".25" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
        </defs>
        <rect width="400" height="300" fill="#141215"/>
        <path d="M120 0 L280 0 L360 300 L40 300 Z" fill="url(#ray${id})"/>
        <ellipse cx="200" cy="276" rx="92" ry="10" fill="#000" opacity=".5"/>
        <rect x="178" y="70" width="44" height="40" rx="6" fill="#c9a673"/><rect x="186" y="98" width="28" height="14" fill="#8a6f48"/>
        <g clip-path="url(#bt${id})">
          <rect x="140" y="110" width="120" height="160" fill="#fff" opacity=".08"/>
          <rect class="liq" x="140" y="132" width="120" height="140"/>
          <g fill="#fff" opacity=".55">${bubbles}</g>
          <rect x="140" y="110" width="120" height="160" fill="url(#gl${id})"/>
        </g>
        <rect x="140" y="110" width="120" height="160" rx="22" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>
      </svg>`;
    },
  };

  window.mountViz = function (el, kind, finish, first) {
    if (!K[kind]) return null;
    const id = ++uid, start = first || DEF[kind];
    el.innerHTML = K[kind](id, finish || "");
    const svg = el.querySelector("svg");
    if (kind === "lips" || kind === "eyes") return wiper(svg, start);
    if (kind === "skin") {
      const ss = svg.querySelectorAll(".stroke");
      const set = hex => { svg.querySelector(".main").style.stroke = hex; ss.forEach(s => s.classList.remove("draw")); svg.getBoundingClientRect(); ss.forEach(s => s.classList.add("draw")); };
      set(start); return set;
    }
    if (kind === "cheek") {
      const g = svg.querySelector(".ck");
      const set = hex => { svg.querySelectorAll(".ckc").forEach(s => s.setAttribute("stop-color", hex)); g.classList.remove("on"); g.getBoundingClientRect(); g.classList.add("on"); };
      set(start); return set;
    }
    if (kind === "brow") {
      const g = svg.querySelector(".hairs");
      const set = hex => { g.style.stroke = hex; g.querySelector(".fillb").style.fill = hex; g.classList.remove("on"); g.getBoundingClientRect(); g.classList.add("on"); };
      set(start); return set;
    }
    if (kind === "scent") {
      const l = svg.querySelector(".liq");
      const set = hex => { l.style.fill = hex; };
      set(start); return set;
    }
  };
})();
