import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithPopup,
  signInWithRedirect
} from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, serverTimestamp, getDoc, getDocs, query, where, addDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBKoMnFeuo5iKjWaMz2p4l_YnV2xsxUl58",
  authDomain: "livelog-b1a04.firebaseapp.com",
  projectId: "livelog-b1a04",
  messagingSenderId: "48689821852",
  appId: "1:48689821852:web:7e061323ec95ec00e59559",
  measurementId: "G-BP5QD2VYN7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await saveUserProfile(user);
    return user;
  } catch (error) {
    const fallbackErrors = new Set([
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment'
    ]);

    if (fallbackErrors.has(error?.code)) {
      await signInWithRedirect(auth, provider);
      return null;
    }

    throw error;
  }
}

function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, callback);
}

async function saveUserProfile(user) {
  if (!user) return;

  const userRef = doc(db, 'users', user.uid);
  const profileData = {
    uid: user.uid,
    displayName: user.displayName || 'LiveLog User',
    photoURL: user.photoURL || null,
    email: user.email || null,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp()
  };

  await setDoc(userRef, profileData, { merge: true });
}

async function getUserDocument(uid) {
  const userRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userRef);
  return snapshot.exists() ? snapshot.data() : null;
}

async function addConcert(concertData) {
  const concertsRef = collection(db, 'concerts');
  return await addDoc(concertsRef, {
    ...concertData,
    createdAt: serverTimestamp()
  });
}

async function getUserConcerts(uid) {
  const concertsQuery = query(collection(db, 'concerts'), where('userId', '==', uid));
  const snapshot = await getDocs(concertsQuery);
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

async function getOrCreateArtist(artistName, userId) {
  if (!artistName) return null;
  const artistsRef = collection(db, 'artists');
  const snapshot = await getDocs(query(artistsRef, where('userId', '==', userId)));
  const existingArtist = snapshot.docs.find((entry) => entry.data().name === artistName);
  if (existingArtist) {
    return existingArtist.id;
  }
  const docRef = await addDoc(artistsRef, {
    name: artistName,
    userId,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

async function getOrCreateVenue(venueName, city, country, userId) {
  if (!venueName || !city || !country) return null;
  const venuesRef = collection(db, 'venues');
  const snapshot = await getDocs(query(venuesRef, where('userId', '==', userId)));
  const existingVenue = snapshot.docs.find((entry) => {
    const data = entry.data();
    return data.name === venueName && data.city === city && data.country === country;
  });
  if (existingVenue) {
    return existingVenue.id;
  }
  const docRef = await addDoc(venuesRef, {
    name: venueName,
    city,
    country,
    userId,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

function createRecentCard(concert) {
  const card = document.createElement('article');
  card.className = 'recent-card glass-card';
  const labels = getEventLabels(concert);
  const artists = getConcertArtists(concert);
  card.innerHTML = `
    <div class="recent-card-header">
      <div>
        <span>${artists.join(', ') || concert.artistName}</span>
        <strong>${concert.venue} · ${concert.city}</strong>
      </div>
      <strong>${formatDate(concert.date)}</strong>
    </div>
    <p>${labels.join(' · ')}</p>
    <div class="card-actions">
      <button class="btn btn-ghost" type="button" data-action="edit">Modifica</button>
      <button class="btn btn-ghost" type="button" data-action="delete">Elimina</button>
    </div>
  `;
  card.querySelector('[data-action="edit"]').addEventListener('click', () => openConcertForEdit(concert));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => removeConcert(concert));
  return card;
}

function createTimelineCard(concert) {
  const card = document.createElement('article');
  card.className = 'timeline-card glass-card';
  const labels = getEventLabels(concert);
  const artists = getConcertArtists(concert);
  card.innerHTML = `
    <div class="timeline-line"></div>
    <div class="timeline-content">
      <div>
        <h4>${artists.join(', ') || concert.artistName}</h4>
        <p>${formatDate(concert.date)} · ${concert.city}</p>
      </div>
      <span>${concert.venue}</span>
    </div>
    <p class="timeline-meta">${labels.join(' · ')}</p>
    <div class="card-actions">
      <button class="btn btn-ghost" type="button" data-action="edit">Modifica</button>
      <button class="btn btn-ghost" type="button" data-action="delete">Elimina</button>
    </div>
  `;
  card.querySelector('[data-action="edit"]').addEventListener('click', () => openConcertForEdit(concert));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => removeConcert(concert));
  return card;
}

function createTopArtistCard(artistName, count) {
  const card = document.createElement('article');
  card.className = 'artist-card glass-card';
  card.innerHTML = `
    <strong>${artistName}</strong>
    <span>${count} live</span>
  `;
  return card;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getCityFromAddress(address = {}) {
  return address.city || address.town || address.village || address.municipality || address.county || address.state || '';
}

function getPlaceTitle(item, fallback = '') {
  return item?.name || item?.display_name?.split(',')[0] || fallback;
}

function normalizeSuggestionKey(primary, secondary) {
  return `${primary}::${secondary}`;
}

function getEventLabels(concert) {
  const labels = [];

  if (concert.festival) {
    labels.push(concert.festivalName ? `Festival: ${concert.festivalName}` : 'Festival');
  }

  if (concert.discoteca) {
    labels.push('Discoteca');
  }

  return labels.length > 0 ? labels : ['Concerto'];
}

function getConcertArtists(concert) {
  if (Array.isArray(concert.artistNames) && concert.artistNames.length > 0) {
    return concert.artistNames.filter(Boolean);
  }

  if (typeof concert.artistName === 'string' && concert.artistName.trim()) {
    return concert.artistName
      .split(',')
      .map((artist) => artist.trim())
      .filter(Boolean);
  }

  return [];
}

function getConcertSearchText(concert) {
  return [
    getConcertArtists(concert).join(' '),
    concert.artistName,
    concert.venue,
    concert.city,
    concert.country,
    concert.festivalName,
    concert.notes
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isMobileDevice() {
  return window.matchMedia('(max-width: 640px)').matches;
}

function showMobileInstallBanner() {
  if (!mobileInstallBanner) return;
  if (window.matchMedia('(display-mode: standalone)').matches) {
    document.getElementById('mobile-install-banner').style.display = 'none';
  }
  try {
    if (window.localStorage.getItem(MOBILE_BANNER_KEY) === '1') return;
  } catch (error) {
    console.warn('Impossibile leggere lo stato del banner:', error);
  }
  mobileInstallBanner.hidden = false;
}

function hideMobileInstallBanner() {
  if (!mobileInstallBanner) return;
  mobileInstallBanner.hidden = true;
  try {
    window.localStorage.setItem(MOBILE_BANNER_KEY, '1');
  } catch (error) {
    console.warn('Impossibile salvare lo stato del banner:', error);
  }
}

function setupAutocomplete({ input, panel, fetchSuggestions, onSelect }) {
  let debounceTimer = null;
  let controller = null;

  function closePanel() {
    controller?.abort();
    panel.innerHTML = '';
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }

  function renderPanel(suggestions) {
    if (suggestions.length === 0) {
      closePanel();
      return;
    }

    panel.innerHTML = '';
    suggestions.forEach((suggestion) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'autocomplete-item';
      button.innerHTML = `
        <strong>${escapeHtml(suggestion.primary)}</strong>
        ${suggestion.secondary ? `<span>${escapeHtml(suggestion.secondary)}</span>` : ''}
      `;
      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
        onSelect(suggestion);
        closePanel();
      });
      panel.appendChild(button);
    });

    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  async function runSearch() {
    const queryText = input.value.trim();

    if (queryText.length < 2) {
      closePanel();
      return;
    }

    controller?.abort();
    controller = new AbortController();

    try {
      const suggestions = await fetchSuggestions(queryText, controller.signal);
      if (controller.signal.aborted) return;

      const uniqueSuggestions = suggestions.filter((item, index, array) => {
        const key = normalizeSuggestionKey(item.primary, item.secondary || '');
        return array.findIndex((candidate) => normalizeSuggestionKey(candidate.primary, candidate.secondary || '') === key) === index;
      });

      renderPanel(uniqueSuggestions.slice(0, 6));
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.warn('Autocomplete error:', error);
      }
      closePanel();
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(runSearch, 220);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) {
      runSearch();
    }
  });

  input.addEventListener('blur', () => {
    window.setTimeout(closePanel, 120);
  });

  closePanel();

  return {
    closePanel,
    refresh: runSearch
  };
}

async function fetchArtistSuggestions(queryText, signal) {
  const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(queryText)}&entity=musicArtist&media=music&limit=6`, {
    signal
  });

  if (!response.ok) return [];

  const data = await response.json();
  return (data.results || [])
    .filter((item) => item.artistName)
    .map((item) => ({
      primary: item.artistName,
      secondary: item.primaryGenreName || 'Artista musicale',
      value: item.artistName
    }));
}

async function fetchLocationSuggestions(queryText, mode, signal) {
  const params = new URLSearchParams({
    q: queryText,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    'accept-language': 'it'
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { signal });

  if (!response.ok) return [];

  const data = await response.json();
  return data
    .map((item) => {
      const address = item.address || {};
      const city = getCityFromAddress(address);
      const country = address.country || '';
      const venue = getPlaceTitle(item, queryText);
      const primary = mode === 'city' ? city : venue;
      const secondary = mode === 'city' ? country : [city, country].filter(Boolean).join(' · ');

      return {
        primary,
        secondary,
        venue,
        city,
        country
      };
    })
    .filter((item) => item.primary);
}

function applyArtistSuggestion(suggestion) {
  addArtistName(suggestion.value);
  artistAutocomplete.closePanel();
}

function applyCitySuggestion(suggestion) {
  cityInput.value = suggestion.city || suggestion.primary;
  if (suggestion.country) {
    countryInput.value = suggestion.country;
  }
}

function applyVenueSuggestion(suggestion) {
  venueInput.value = suggestion.venue || suggestion.primary;
  if (suggestion.city) {
    cityInput.value = suggestion.city;
  }
  if (suggestion.country) {
    countryInput.value = suggestion.country;
  }
}

function createChip(label, onRemove) {
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.innerHTML = `
    <span>${escapeHtml(label)}</span>
    <button type="button" aria-label="Rimuovi ${escapeHtml(label)}">&times;</button>
  `;
  chip.querySelector('button').addEventListener('click', onRemove);
  return chip;
}

const loginButton = document.getElementById('google-signin');
const pageLogin = document.getElementById('page-login');
const pageHome = document.getElementById('page-home');
const profileAvatar = document.getElementById('profile-avatar');
const homeUsername = document.getElementById('home-username');
const statConcerts = document.getElementById('stat-concerts');
const statArtists = document.getElementById('stat-artists');
const statFestivals = document.getElementById('stat-festivals');
const statYears = document.getElementById('stat-years');
const openAddConcertButton = document.getElementById('open-add-concert');
const addConcertModal = document.getElementById('add-concert-modal');
const closeAddConcertButton = document.getElementById('close-add-concert');
const addConcertForm = document.getElementById('concert-form');
const searchInput = document.getElementById('search-input');
const artistInput = document.getElementById('artist-name-input');
const artistChipList = document.getElementById('artist-chip-list');
const artistNamesInput = document.getElementById('artist-names-input');
const venueInput = document.getElementById('venue-input');
const cityInput = document.getElementById('city-input');
const countryInput = document.getElementById('country-input');
const festivalToggle = document.getElementById('festival-toggle');
const clubToggle = document.getElementById('club-toggle');
const festivalField = document.getElementById('festival-name-field');
const saveConcertButton = document.getElementById('save-concert-button');
const deleteConcertButton = document.getElementById('delete-concert-button');
const addConcertModalTitle = addConcertModal.querySelector('h3');
const artistPanel = document.querySelector('[data-panel="artist"]');
const venuePanel = document.querySelector('[data-panel="venue"]');
const cityPanel = document.querySelector('[data-panel="city"]');
const mobileInstallBanner = document.getElementById('mobile-install-banner');
const mobileInstallBannerClose = document.getElementById('mobile-install-banner-close');
const recentConcertsContainer = document.getElementById('recent-concerts');
const timelineList = document.getElementById('timeline-list');
const topArtistsContainer = document.getElementById('top-artists');

let currentUser = null;
let loadedConcerts = [];
let hasReloadedAfterUpdate = false;
const MOBILE_BANNER_KEY = 'livelog-mobile-banner-dismissed';
let currentEditConcertId = null;
let currentArtistNames = [];
let searchQuery = '';

const artistAutocomplete = setupAutocomplete({
  input: artistInput,
  panel: artistPanel,
  fetchSuggestions: fetchArtistSuggestions,
  onSelect: applyArtistSuggestion
});

const cityAutocomplete = setupAutocomplete({
  input: cityInput,
  panel: cityPanel,
  fetchSuggestions: (queryText, signal) => fetchLocationSuggestions(queryText, 'city', signal),
  onSelect: applyCitySuggestion
});

const venueAutocomplete = setupAutocomplete({
  input: venueInput,
  panel: venuePanel,
  fetchSuggestions: (queryText, signal) => fetchLocationSuggestions(queryText, 'venue', signal),
  onSelect: applyVenueSuggestion
});

function syncArtistChips() {
  artistChipList.innerHTML = '';
  currentArtistNames.forEach((artistName, index) => {
    artistChipList.appendChild(createChip(artistName, () => {
      currentArtistNames = currentArtistNames.filter((entry, entryIndex) => entryIndex !== index);
      syncArtistChips();
      syncArtistHiddenField();
    }));
  });
}

function syncArtistHiddenField() {
  artistNamesInput.value = JSON.stringify(currentArtistNames);
}

function addArtistName(artistName) {
  const normalized = artistName.trim();
  if (!normalized) return;

  const exists = currentArtistNames.some((entry) => entry.toLowerCase() === normalized.toLowerCase());
  if (exists) {
    artistInput.value = '';
    return;
  }

  currentArtistNames = [...currentArtistNames, normalized];
  syncArtistChips();
  syncArtistHiddenField();
  artistInput.value = '';
}

function setArtistNames(artistNames = []) {
  currentArtistNames = artistNames.map((artistName) => String(artistName).trim()).filter(Boolean);
  syncArtistChips();
  syncArtistHiddenField();
}

function resetConcertFormState() {
  addConcertForm.reset();
  setArtistNames([]);
  currentEditConcertId = null;
  festivalField.classList.add('hidden');
  festivalToggle.checked = false;
  clubToggle.checked = false;
  saveConcertButton.textContent = 'Salva Concerto';
  deleteConcertButton.classList.add('hidden');
  addConcertModalTitle.textContent = 'Aggiungi un live nella tua collezione';
  artistAutocomplete.closePanel();
  cityAutocomplete.closePanel();
  venueAutocomplete.closePanel();
}

function openNewConcertModal() {
  resetConcertFormState();
  showModal(true);
}

function openConcertForEdit(concert) {
  resetConcertFormState();
  currentEditConcertId = concert.id;
  addConcertModalTitle.textContent = 'Modifica concerto';
  saveConcertButton.textContent = 'Salva modifiche';
  deleteConcertButton.classList.remove('hidden');
  showModal(true);

  const artists = getConcertArtists(concert);
  setArtistNames(artists);
  artistInput.value = '';
  venueInput.value = concert.venue || '';
  cityInput.value = concert.city || '';
  countryInput.value = concert.country || '';
  document.getElementById('date-input').value = concert.date || '';
  document.getElementById('festival-name-input').value = concert.festivalName || '';
  document.getElementById('rating-input').value = concert.rating || 5;
  document.getElementById('notes-input').value = concert.notes || '';
  festivalToggle.checked = Boolean(concert.festival);
  clubToggle.checked = Boolean(concert.discoteca);
  festivalField.classList.toggle('hidden', !concert.festival);
}

async function removeConcert(concert) {
  const confirmed = window.confirm(`Vuoi eliminare il concerto "${getConcertArtists(concert).join(', ') || concert.artistName}"?`);
  if (!confirmed) return false;

  try {
    await deleteDoc(doc(db, 'concerts', concert.id));
    await loadConcerts();
    return true;
  } catch (error) {
    console.error('Errore eliminando il concerto:', error);
    alert('Non sono riuscito a eliminare il concerto.');
    return false;
  }
}

async function saveConcertFromForm(event) {
  event.preventDefault();
  if (!currentUser) return;

  if (artistInput.value.trim()) {
    addArtistName(artistInput.value);
  }

  const formData = new FormData(addConcertForm);
  const artistNames = currentArtistNames.length > 0
    ? currentArtistNames
    : JSON.parse(formData.get('artistNames') || '[]');
  if (artistNames.length === 0) {
    alert('Aggiungi almeno un artista.');
    return;
  }
  const artistNameJoined = artistNames.join(', ');
  const artistIds = await Promise.all(artistNames.map((artistName) => getOrCreateArtist(artistName, currentUser.uid)));
  const concertData = {
    artistNames,
    artistName: artistNameJoined,
    date: formData.get('date'),
    venue: formData.get('venue').trim(),
    city: formData.get('city').trim(),
    country: formData.get('country').trim(),
    festival: formData.get('festival') === 'on',
    discoteca: formData.get('discoteca') === 'on',
    festivalName: formData.get('festivalName').trim() || null,
    rating: Number(formData.get('rating')),
    notes: formData.get('notes').trim() || null,
    userId: currentUser.uid,
    updatedAt: new Date().toISOString(),
    artistId: artistIds[0] || null,
    artistIds
  };

  const venueId = await getOrCreateVenue(concertData.venue, concertData.city, concertData.country, currentUser.uid);

  try {
    if (currentEditConcertId) {
      await updateDoc(doc(db, 'concerts', currentEditConcertId), {
        ...concertData,
        artistIds,
        venueId
      });
    } else {
      await addConcert({
        ...concertData,
        artistIds,
        venueId,
        createdAt: new Date().toISOString()
      });
    }

    await loadConcerts();
    showModal(false);
    resetConcertFormState();
  } catch (saveError) {
    console.error('Errore salvando il concerto:', saveError);
    alert('Non sono riuscito a salvare il concerto.');
  }
}

function renderLoggedOutState() {
  currentUser = null;
  loadedConcerts = [];
  searchQuery = '';
  searchInput.value = '';
  resetConcertFormState();

  pageHome.classList.remove('active');
  pageHome.setAttribute('aria-hidden', 'true');
  pageLogin.classList.add('active');
  pageLogin.setAttribute('aria-hidden', 'false');
  showModal(false);
}

async function initAuth() {
  await setPersistence(auth, browserLocalPersistence);

  try {
    const redirectResult = await getRedirectResult(auth);
    if (redirectResult?.user) {
      await saveUserProfile(redirectResult.user);
    }
  } catch (error) {
    console.error('Errore completando il login redirect:', error);
    alert('Il login Google non è riuscito a completarsi. Riprova.');
  }
}

if (mobileInstallBannerClose) {
  mobileInstallBannerClose.addEventListener('click', hideMobileInstallBanner);
}

loginButton.addEventListener('click', async () => {
  try {
    loginButton.disabled = true;
    loginButton.textContent = 'Caricamento...';
    await signInWithGoogle();
  } catch (error) {
    console.error('Errore login:', error);

    if (error?.code === 'auth/unauthorized-domain') {
      alert('Questo dominio non è autorizzato in Firebase Auth. Aggiungi l\'URL della pagina tra i domini autorizzati.');
      return;
    }

    alert('Impossibile completare il login. Riprova.');
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Continua con Google';
  }
});

onAuthStateChange(async (user) => {
  if (user) {
    currentUser = user;
    const profile = await getUserDocument(user.uid);
    await loadConcerts();
    renderHome(user, profile);
  } else {
    renderLoggedOutState();
  }
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value || '';
  renderConcertData();
});

artistInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    addArtistName(artistInput.value);
  }
});

artistInput.addEventListener('blur', () => {
  if (artistInput.value.trim()) {
    addArtistName(artistInput.value);
  }
});

openAddConcertButton.addEventListener('click', openNewConcertModal);
closeAddConcertButton.addEventListener('click', () => {
  showModal(false);
  resetConcertFormState();
});
addConcertModal.addEventListener('click', (event) => {
  if (event.target === addConcertModal) {
    showModal(false);
    resetConcertFormState();
  }
});
festivalToggle.addEventListener('change', () => {
  festivalField.classList.toggle('hidden', !festivalToggle.checked);
});
deleteConcertButton.addEventListener('click', async () => {
  if (!currentEditConcertId) return;
  const concert = loadedConcerts.find((entry) => entry.id === currentEditConcertId);
  if (concert) {
    const deleted = await removeConcert(concert);
    if (deleted) {
      showModal(false);
      resetConcertFormState();
    }
  }
});

addConcertForm.addEventListener('submit', saveConcertFromForm);

async function loadConcerts() {
  if (!currentUser) return;
  loadedConcerts = await getUserConcerts(currentUser.uid);
  renderConcertData();
}

function renderHome(user, profile) {
  pageLogin.classList.remove('active');
  pageLogin.setAttribute('aria-hidden', 'true');
  pageHome.classList.add('active');
  pageHome.setAttribute('aria-hidden', 'false');
  const displayName = profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Andrea';
  homeUsername.textContent = displayName;
  profileAvatar.style.backgroundImage = `url('${user.photoURL || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80'}')`;
  updateStats();
}

function renderConcertData() {
  const visibleConcerts = getVisibleConcerts();
  renderRecentConcerts(visibleConcerts);
  renderTimeline(visibleConcerts);
  renderTopArtists(visibleConcerts);
  updateStats();
}

function getVisibleConcerts() {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return loadedConcerts;

  return loadedConcerts.filter((concert) => getConcertSearchText(concert).includes(normalizedQuery));
}

function renderRecentConcerts(concerts = []) {
  recentConcertsContainer.innerHTML = '';
  if (loadedConcerts.length === 0) {
    recentConcertsContainer.innerHTML = `<div class="placeholder-card glass-card"><span>Nessun concerto ancora. Aggiungi il tuo primo evento!</span></div>`;
    return;
  }
  if (concerts.length === 0) {
    recentConcertsContainer.innerHTML = `<div class="placeholder-card glass-card"><span>Nessun concerto corrisponde alla ricerca.</span></div>`;
    return;
  }
  concerts.slice(0, 3).forEach((concert) => {
    recentConcertsContainer.appendChild(createRecentCard(concert));
  });
}

function renderTimeline(concerts = []) {
  timelineList.innerHTML = '';
  if (loadedConcerts.length === 0) {
    timelineList.innerHTML = `<div class="placeholder-card glass-card"><span>Salva un concerto per vedere la timeline.</span></div>`;
    return;
  }
  if (concerts.length === 0) {
    timelineList.innerHTML = `<div class="placeholder-card glass-card"><span>Nessun risultato per la ricerca.</span></div>`;
    return;
  }
  concerts.forEach((concert) => {
    timelineList.appendChild(createTimelineCard(concert));
  });
}

function renderTopArtists(concerts = []) {
  topArtistsContainer.innerHTML = '';
  if (loadedConcerts.length === 0) {
    topArtistsContainer.innerHTML = `<div class="placeholder-card glass-card"><span>Il tuo primo artista apparirà qui.</span></div>`;
    return;
  }
  if (concerts.length === 0) {
    topArtistsContainer.innerHTML = `<div class="placeholder-card glass-card"><span>Nessun artista coincide con la ricerca.</span></div>`;
    return;
  }
  const tally = concerts.reduce((acc, concert) => {
    getConcertArtists(concert).forEach((artistName) => {
      acc[artistName] = (acc[artistName] || 0) + 1;
    });
    return acc;
  }, {});
  Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .forEach(([artistName, count]) => {
      topArtistsContainer.appendChild(createTopArtistCard(artistName, count));
    });
}

function updateStats(concerts = loadedConcerts) {
  statConcerts.textContent = String(concerts.length);
  statArtists.textContent = String(new Set(concerts.flatMap((concert) => getConcertArtists(concert))).size);
  statFestivals.textContent = String(concerts.filter((concert) => concert.festival).length);
  statYears.textContent = String(new Set(concerts.map((concert) => new Date(concert.date).getFullYear())).size);
}

function showModal(show) {
  addConcertModal.classList.toggle('active', show);
  addConcertModal.setAttribute('aria-hidden', show ? 'false' : 'true');
  document.body.classList.toggle('modal-open', show);

  if (!show) {
    artistAutocomplete.closePanel();
    cityAutocomplete.closePanel();
    venueAutocomplete.closePanel();
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' }).then((registration) => {
      registration.update();

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch((error) => {
      console.warn('Service worker non registrato:', error);
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloadedAfterUpdate) return;
    hasReloadedAfterUpdate = true;
    window.location.reload();
  });
}

window.addEventListener('load', () => {
  showMobileInstallBanner();
});

window.addEventListener('resize', () => {
  if (mobileInstallBanner && !mobileInstallBanner.hidden && (!isMobileDevice() || isStandaloneMode())) {
    hideMobileInstallBanner();
  }
});

initAuth().catch((error) => {
  console.error('Errore inizializzando l\'auth:', error);
});
