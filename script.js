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
import { getFirestore, collection, doc, setDoc, serverTimestamp, getDoc, getDocs, query, where, addDoc } from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js';

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
  card.innerHTML = `
    <div class="recent-card-header">
      <div>
        <span>${concert.artistName}</span>
        <strong>${concert.venue} · ${concert.city}</strong>
      </div>
      <strong>${formatDate(concert.date)}</strong>
    </div>
    <p>${concert.festival ? concert.festivalName || 'Festival live' : 'Concerto normale'}</p>
  `;
  return card;
}

function createTimelineCard(concert) {
  const card = document.createElement('article');
  card.className = 'timeline-card glass-card';
  card.innerHTML = `
    <div class="timeline-line"></div>
    <div class="timeline-content">
      <h4>${concert.artistName}</h4>
      <p>${formatDate(concert.date)} · ${concert.city}</p>
      <span>${concert.venue}</span>
    </div>
  `;
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
const festivalToggle = document.getElementById('festival-toggle');
const festivalField = document.getElementById('festival-name-field');
const recentConcertsContainer = document.getElementById('recent-concerts');
const timelineList = document.getElementById('timeline-list');
const topArtistsContainer = document.getElementById('top-artists');

let currentUser = null;
let loadedConcerts = [];

function renderLoggedOutState() {
  currentUser = null;
  loadedConcerts = [];

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

openAddConcertButton.addEventListener('click', () => showModal(true));
closeAddConcertButton.addEventListener('click', () => showModal(false));
addConcertModal.addEventListener('click', (event) => {
  if (event.target === addConcertModal) showModal(false);
});
festivalToggle.addEventListener('change', () => {
  festivalField.classList.toggle('hidden', !festivalToggle.checked);
});

addConcertForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const formData = new FormData(addConcertForm);
  const concertData = {
    artistName: formData.get('artistName').trim(),
    date: formData.get('date'),
    venue: formData.get('venue').trim(),
    city: formData.get('city').trim(),
    country: formData.get('country').trim(),
    festival: formData.get('festival') === 'on',
    festivalName: formData.get('festivalName').trim() || null,
    rating: Number(formData.get('rating')),
    notes: formData.get('notes').trim() || null,
    userId: currentUser.uid,
    createdAt: new Date().toISOString()
  };

  const artistId = await getOrCreateArtist(concertData.artistName, currentUser.uid);
  const venueId = await getOrCreateVenue(concertData.venue, concertData.city, concertData.country, currentUser.uid);

  await addConcert({ ...concertData, artistId, venueId });
  await loadConcerts();
  showModal(false);
  addConcertForm.reset();
});

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
  renderRecentConcerts();
  renderTimeline();
  renderTopArtists();
  updateStats();
}

function renderRecentConcerts() {
  recentConcertsContainer.innerHTML = '';
  if (loadedConcerts.length === 0) {
    recentConcertsContainer.innerHTML = `<div class="placeholder-card glass-card"><span>Nessun concerto ancora. Aggiungi il tuo primo evento!</span></div>`;
    return;
  }
  loadedConcerts.slice(0, 3).forEach((concert) => {
    recentConcertsContainer.appendChild(createRecentCard(concert));
  });
}

function renderTimeline() {
  timelineList.innerHTML = '';
  if (loadedConcerts.length === 0) {
    timelineList.innerHTML = `<div class="placeholder-card glass-card"><span>Salva un concerto per vedere la timeline.</span></div>`;
    return;
  }
  loadedConcerts.forEach((concert) => {
    timelineList.appendChild(createTimelineCard(concert));
  });
}

function renderTopArtists() {
  topArtistsContainer.innerHTML = '';
  if (loadedConcerts.length === 0) {
    topArtistsContainer.innerHTML = `<div class="placeholder-card glass-card"><span>Il tuo primo artista apparirà qui.</span></div>`;
    return;
  }
  const tally = loadedConcerts.reduce((acc, concert) => {
    acc[concert.artistName] = (acc[concert.artistName] || 0) + 1;
    return acc;
  }, {});
  Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .forEach(([artistName, count]) => {
      topArtistsContainer.appendChild(createTopArtistCard(artistName, count));
    });
}

function updateStats() {
  statConcerts.textContent = String(loadedConcerts.length);
  statArtists.textContent = String(new Set(loadedConcerts.map((concert) => concert.artistName)).size);
  statFestivals.textContent = String(loadedConcerts.filter((concert) => concert.festival).length);
  statYears.textContent = String(new Set(loadedConcerts.map((concert) => new Date(concert.date).getFullYear())).size);
}

function showModal(show) {
  addConcertModal.classList.toggle('active', show);
  addConcertModal.setAttribute('aria-hidden', show ? 'false' : 'true');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((error) => {
      console.warn('Service worker non registrato:', error);
    });
  });
}

initAuth().catch((error) => {
  console.error('Errore inizializzando l\'auth:', error);
});
