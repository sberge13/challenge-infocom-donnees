const D = JSON.parse(document.getElementById('data').textContent);
if (D.mode === 'embarque') {   // dans le Google Site : toujours clair, fond blanc comme la page qui l'entoure
  document.documentElement.setAttribute('data-theme', 'light');
  document.documentElement.style.setProperty('--bg', '#ffffff');
}
const NOMS = D.consultants;
const ORGS = new Set(D.orgs_candidat);
const cands = new Map(D.cands.map(c => [c.p, {u: String(c.u), t: new Date(c.t).toISOString()}]));
const hors = Object.assign({}, D.hors);
const vus = new Set(D.vus);
const FIN = new Date(D.fin), DEBUT = new Date(D.debut);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pl = (n, m) => n + ' ' + m + (n > 1 ? 's' : '');
const jourParis = d => new Intl.DateTimeFormat('fr-CA', {timeZone: 'Europe/Paris'}).format(d);
const heureParis = d => new Intl.DateTimeFormat('fr-FR', {timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit'}).format(d).replace(':', 'h');
const dateCourte = d => new Intl.DateTimeFormat('fr-FR', {timeZone: 'Europe/Paris', day: 'numeric', month: 'short'}).format(d);
const COULEURS = ['#7A4FA0', '#C0392B', '#0A7D8C', '#B7791F', '#2F6FB5'];
const MEDAILLES = ['🥇', '🥈', '🥉'];
let dernier = D.genere;
let erreurDonnees = false;   // data.json porte un champ erreur : Pipedrive ne répond plus

function calcul() {
  const lignes = Object.entries(NOMS).map(([u, nom]) => {
    const mine = [...cands.values()].filter(c => c.u === u);
    return {u, nom, candidats: mine.length, atteint: mine.map(c => c.t).sort().pop() || ''};
  });
  lignes.sort((a, b) => b.candidats - a.candidats || (a.atteint < b.atteint ? -1 : a.atteint > b.atteint ? 1 : 0) || a.nom.localeCompare(b.nom));
  lignes.forEach(l => { l.ok = l.candidats >= D.seuil; });
  const evenements = [...cands.values()].sort((a, b) => b.t.localeCompare(a.t)).slice(0, 4);
  return {lignes, total: cands.size, evenements};
}

function avatar(u, nom) {
  const coul = COULEURS[Object.keys(NOMS).indexOf(u) % COULEURS.length];
  const ph = D.photos && D.photos[u];
  return '<span class="avatar" style="background:' + coul + '">' + (ph ? '<img src="' + ph + '" alt="' + esc(nom) + '" onerror="this.replaceWith(document.createTextNode(this.alt.charAt(0)))">' : esc(nom[0])) + '</span>';
}

function rendre() {
  const {lignes, evenements} = calcul();
  const echelle = Math.max(10, ...lignes.map(l => l.candidats));
  const tete = lignes[0] ? lignes[0].candidats : 0;
  document.getElementById('podium').innerHTML = '<div class="podium" aria-label="Podium">' +
    [2, 1, 3].filter(r => r - 1 < lignes.length).map(r => {
      const l = lignes[r - 1];
      return '<div class="marche r' + r + '"><span class="medaille">' + (l.candidats > 0 ? MEDAILLES[r - 1] : '') + '</span>' + avatar(l.u, l.nom) +
        '<span class="qui">' + esc(l.nom) + '</span><span class="bloc">' + l.candidats + '</span></div>';
    }).join('') + '</div>' + (tete === 0 ? '<p class="mot" style="text-align:center">Le podium est vide. La première infocom prend la 1re place.</p>' : '');

  document.getElementById('course').innerHTML = lignes.map((l, i) => {
    const pct = Math.round(1000 * l.candidats / echelle) / 10, manque = D.seuil - l.candidats;
    let mot = l.ok ? 'Qualifié pour le chèque cadeau' : 'Encore ' + pl(manque, 'candidat') + ' pour être qualifié';
    if (i > 0 && tete > l.candidats) mot += ' · ' + pl(tete - l.candidats, 'candidat') + ' derrière le leader';
    const rang = tete > 0 && i < 3 && l.candidats > 0 ? MEDAILLES[i] : String(i + 1);
    const seul = i === 0 && tete > 0 && (lignes.length < 2 || tete > lignes[1].candidats);
    return '<li class="voie' + (l.ok ? ' ok' : '') + (seul ? ' r1' : '') + '"><span class="rang">' + rang + '</span>' + avatar(l.u, l.nom) +
      '<div><div class="nom">' + esc(l.nom) + '</div><div class="mot">' + mot + '</div></div>' +
      '<span class="score" role="img" aria-label="' + pl(l.candidats, 'candidat') + '">' + l.candidats + '</span>' +
      '<div class="piste"><span class="trace" style="width:' + pct + '%"></span>' +
      '<span class="drapeau" style="left:' + Math.round(1000 * D.seuil / echelle) / 10 + '%">🚩</span><span class="arrivee">🏆</span></div></li>';
  }).join('');

  const auj = jourParis(new Date());
  document.getElementById('fil').innerHTML = evenements.map(e => {
    const q = new Date(e.t);
    return '<li><time>' + (jourParis(q) === auj ? "aujourd'hui" : dateCourte(q)) + ' ' + heureParis(q) + '</time><span><span class="plus">+1</span> ' + esc(NOMS[e.u]) + '</span></li>';
  }).join('') || '<li><span>Rien pour l\'instant. Le premier point s\'affichera ici.</span></li>';

  const nHors = Object.values(hors).reduce((a, b) => a + b, 0);
  document.getElementById('hors').textContent = nHors
    ? pl(nHors, 'infocom') + ' posée' + (nHors > 1 ? 's' : '') + ' sur une fiche cabinet, pas sur un candidat : non comptée' + (nHors > 1 ? 's' : '') + '.' : '';
}

function rebours() {
  const ms = FIN - new Date();
  const el = document.querySelector('.cote-temps');
  if (ms <= 0) {
    // le gagnant ne s'affiche que sur des données lues après la clôture · sinon le dernier point pourrait manquer
    if (new Date(dernier) < FIN || erreurDonnees) { el.innerHTML = '<div class="fin-titre">Terminé</div><div class="legende-temps">Classement final dans quelques minutes</div>'; return; }
    const {lignes} = calcul();
    const gagnant = lignes[0] && lignes[0].ok ? 'Gagnant : ' + lignes[0].nom : 'Seuil de ' + D.seuil + ' non atteint';
    el.innerHTML = '<div class="fin-titre">' + esc(gagnant) + '</div><div class="legende-temps">Challenge terminé</div>';
    return;
  }
  const s = Math.floor(ms / 1000);
  const b = (v, l) => '<div class="bloc"><b>' + String(v).padStart(2, '0') + '</b><span>' + l + '</span></div>';
  el.innerHTML = '<div class="decompte" role="timer">' + b(Math.floor(s / 86400), 'jours') + b(Math.floor(s % 86400 / 3600), 'heures') +
    b(Math.floor(s % 3600 / 60), 'min') + b(s % 60, 'sec') + '</div><div class="legende-temps">Avant l\'arrivée · vendredi 30 octobre, 18h</div>';
}

function etat(classe, texte) {
  const e = document.getElementById('direct');
  e.className = 'direct' + (classe ? ' ' + classe : '');
  e.querySelector('span:last-child').textContent = texte;
}

function feter(noms) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t = document.createElement('div');
  t.className = 'fete';
  t.textContent = '🎉 +1 ' + noms.join(' · ');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
  const cols = ['#7A4FA0', '#C0392B', '#0A7D8C', '#B7791F', '#2F6FB5', '#0A7D3C'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('span');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = cols[i % cols.length];
    document.body.appendChild(c);
    c.animate([{transform: 'translateY(-20px) rotate(0)', opacity: 1},
      {transform: 'translateY(' + (60 + Math.random() * 40) + 'vh) rotate(' + (Math.random() * 720 - 360) + 'deg)', opacity: 0}],
      {duration: 1800 + Math.random() * 1400, easing: 'cubic-bezier(.2,.6,.4,1)'}).onfinish = () => c.remove();
  }
}

if (D.mode === 'connecteur') rendre();   // la page publique attend sa première lecture, pas de zéros affichés comme un fait
else document.getElementById('podium').innerHTML = '<p class="mot" style="text-align:center">Chargement du classement…</p>';
rebours(); setInterval(rebours, 1000);

/* Modes public et embarqué : la page relit data.json, que le Mac Mini réécrit toutes les 2 minutes. */
async function chargerPublic(premiere) {
  const r = await fetch((D.donnees_url || 'data.json') + '?t=' + Date.now(), {cache: 'no-store'});
  if (!r.ok) throw {code: 'http'};
  const d = await r.json();
  const avant = new Set(cands.keys());
  cands.clear();
  d.cands.forEach(c => cands.set(c.p, {u: String(c.u), t: new Date(c.t).toISOString()}));
  Object.keys(hors).forEach(k => delete hors[k]);
  Object.assign(hors, d.hors || {});
  dernier = d.genere;
  erreurDonnees = Boolean(d.erreur);
  rendre(); rebours();
  const neufs = [...cands.entries()].filter(([p]) => !avant.has(p)).map(([, c]) => NOMS[c.u]);
  if (!premiere && neufs.length) feter(neufs);
  const age = (Date.now() - new Date(dernier)) / 6e4;
  if (d.erreur) { etat('retard', 'Pipedrive ne répond pas depuis ' + heureParis(new Date(d.erreur_depuis)) + ' · derniers points connus affichés'); return; }
  const h = Number(new Intl.DateTimeFormat('fr-FR', {timeZone: 'Europe/Paris', hour: '2-digit', hour12: false}).format(new Date()));
  if (age > 20 && h >= 7 && h < 21 && Date.now() < FIN) etat('retard', 'Mise à jour en retard · dernière lecture à ' + heureParis(new Date(dernier)));
  else etat('on', 'En direct · mis à jour toutes les minutes');   // `dernier` est l'heure du dernier point ou du dernier battement (10 min), pas celle de la dernière vérification
}

/* Mode connecteur (ta page) : la page lit Pipedrive via ta session, toutes les 30 secondes. */
const sansMs = d => d.toISOString().replace(/\.\d{3}Z$/, 'Z');   // le connecteur refuse les millisecondes (400)
const TEXTE_ERREUR = c => (c === 'needs_reauth' || c === 'server_not_connected' || c === 'not_in_manifest' || c === 'approval_required' || c === 'consent_required')
  ? 'reconnectez ou autorisez Pipedrive pour le direct' : 'lecture directe interrompue, nouvel essai automatique';

function integrer(liste) {
  const neufs = [];
  liste.filter(a => a && a.type === 'infocom' && !vus.has(a.id) && NOMS[String(a.creator_user_id)] && a.add_time).forEach(a => {
    const t = new Date(a.add_time);
    if (t < DEBUT || t >= FIN) return;
    vus.add(a.id);
    const u = String(a.creator_user_id);
    if (!ORGS.has(a.org_id)) { hors[u] = (hors[u] || 0) + 1; return; }
    if (!a.person_id) return;
    if (!cands.has(a.person_id)) { cands.set(a.person_id, {u, t: t.toISOString()}); neufs.push(NOMS[u]); }
  });
  return neufs;
}

async function lire(mcp, depuis) {
  const tout = [];
  let curseur;
  for (let i = 0; i < 40; i++) {
    const entree = {updated_since: sansMs(depuis), limit: 500, sort_by: 'id', sort_direction: 'asc'};
    if (curseur) entree.cursor = curseur;
    const r = await mcp.callTool('Pipedrive', 'getActivities', entree, {cache: false});
    let p = r.payload;
    if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; } }
    if (!p || !Array.isArray(p.data)) throw {code: 'illisible'};
    tout.push(...p.data);
    curseur = p.additional_data && p.additional_data.next_cursor;
    if (!curseur) return {liste: tout, complet: true};
  }
  return {liste: tout, complet: false};
}

async function demarrerConnecteur() {
  let mcp = null;
  try { mcp = await window.claude?.use('mcp'); } catch (e) { mcp = null; }
  const instantane = 'Instantané de ' + heureParis(new Date(D.genere));
  if (!mcp) { etat('', instantane + ' · le direct demande le connecteur Pipedrive'); return; }
  let enCours = false, derniereLecture = new Date(new Date(D.genere).getTime() - 2 * 3600e3);
  async function passe(rattrapage) {
    if (enCours || (document.hidden && !rattrapage)) return;
    enCours = true;
    try {
      const debutLecture = new Date();
      const {liste, complet} = await lire(mcp, new Date(derniereLecture.getTime() - 5 * 60e3));
      const neufs = integrer(liste);
      rendre();
      if (!rattrapage && neufs.length) feter(neufs);
      if (complet) { derniereLecture = debutLecture; dernier = new Date().toISOString(); }
      etat('on', 'En direct · lu à ' + heureParis(new Date()) + (complet ? '' : ' · lecture partielle, nouvel essai') + ' · toutes les 30 secondes');
    } catch (e) {
      etat('', instantane + ' · ' + (e && e.code === 'illisible' ? 'réponse Pipedrive illisible' : TEXTE_ERREUR(e && e.code)));
    } finally { enCours = false; }
  }
  await passe(true);
  setInterval(() => passe(false), 30000);
}

if (D.mode !== 'connecteur') {
  etat('', 'Chargement…');
  const tour = premiere => chargerPublic(premiere).catch(() => etat('retard', 'Lecture impossible, nouvel essai dans 30 secondes'));
  tour(true);
  setInterval(() => { if (!document.hidden) tour(false); }, 30000);
} else {
  etat('', 'Instantané de ' + heureParis(new Date(D.genere)) + ' · connexion directe en cours…');
  demarrerConnecteur();
}
