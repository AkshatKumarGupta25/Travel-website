import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Heart,
  MapPin,
  Menu,
  Plane,
  Search,
  Users,
  X,
} from 'lucide-react'
import './App.css'
import { db, firebaseConfigured } from './firebase.js'
import { starterDestinations } from './data/destinations.js'
import { starterJournalEntries } from './data/journal.js'
import { getPublishedContent, getPublishedTrips } from './data/localDatabase.js'
import PlaceAutocomplete from './components/PlaceAutocomplete.jsx'
import { useAuth } from './auth/useAuth.js'

const photo = (id, width = 1000) =>
  id.startsWith('http') ? id : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`


function App() {
  const { user } = useAuth()
  const [tripList, setTripList] = useState(starterDestinations)
  const [journalEntries, setJournalEntries] = useState(starterJournalEntries)
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [destinationSearch, setDestinationSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [saved, setSaved] = useState([])
  const [activeTrip, setActiveTrip] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      }),
      { threshold: 0.12 },
    )
    document.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!firebaseConfigured) {
      setTripList(getPublishedTrips())
      return undefined
    }

    let current = true
    getDocs(query(collection(db, 'trips'), where('published', '==', true)))
      .then((snapshot) => {
        if (current && !snapshot.empty) setTripList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
      })
      .catch(() => {})
    return () => { current = false }
  }, [])

  useEffect(() => {
    if (!firebaseConfigured) {
      setJournalEntries(getPublishedContent())
      return undefined
    }

    let current = true
    getDocs(query(collection(db, 'siteContent'), where('published', '==', true)))
      .then((snapshot) => {
        if (current && !snapshot.empty) setJournalEntries(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
      })
      .catch(() => {})
    return () => { current = false }
  }, [])

  useEffect(() => {
    if (!activeTrip) return undefined
    const closeOnEscape = (event) => event.key === 'Escape' && setActiveTrip(null)
    window.addEventListener('keydown', closeOnEscape)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.classList.remove('modal-open')
    }
  }, [activeTrip])

  const visibleDestinations = tripList.filter((destination) => {
    const searchable = `${destination.name} ${destination.region}`.toLowerCase()
    const terms = submittedSearch.toLowerCase().split(/[\s,]+/).filter(Boolean)
    return !terms.length || terms.every((term) => searchable.includes(term))
  })

  function handleSearch(event) {
    event.preventDefault()
    setSubmittedSearch((destinationSearch || destination).trim())
    document.querySelector('#destinations')?.scrollIntoView({ behavior: 'smooth' })
  }

  function toggleSaved(id) {
    setSaved((current) => current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id])
  }

  return (
    <>
      <main>
        <section className="hero" id="home">
          <img className="hero-image" src={photo('photo-1500530855697-b586d89ba3ee', 2200)} alt="A winding path through a sunlit mountain landscape" />
          <div className="hero-shade" />
          <header className="site-header">
            <a className="wordmark" href="#home" aria-label="Elsewhere home"><span className="brand-mark"><Plane size={17} strokeWidth={1.8} /></span>elsewhere<span className="wordmark-period">.</span></a>
            <nav className={menuOpen ? 'main-nav nav-open' : 'main-nav'} aria-label="Main navigation">
              <a href="#destinations" onClick={() => setMenuOpen(false)}>Places</a>
              <a href="#philosophy" onClick={() => setMenuOpen(false)}>Our way</a>
              <a href="#journal" onClick={() => setMenuOpen(false)}>Field notes</a>
              <Link to={user ? '/dashboard' : '/login'} onClick={() => setMenuOpen(false)}>{user ? 'Your dashboard' : 'Sign in'}</Link>
            </nav>
            <Link className="header-cta" to={user ? '/dashboard' : '/login'}>Plan your trip <ArrowUpRight size={15} /></Link>
            <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </header>

          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow"><span /> Independent journeys, thoughtfully made</p>
            <h1>Go where<br />you <em>feel</em> like.</h1>
            <p className="hero-description">Less itinerary. More instinct.<br />The world is better when you find your own way.</p>
            <a className="hero-link" href="#destinations">Find your somewhere <span><ArrowDown size={15} /></span></a>
          </div>
          <p className="hero-caption"><MapPin size={13} /> Somewhere on the way to everywhere</p>
          <div className="hero-index"><span>01</span><i /><span>04</span></div>
          <form className="trip-finder" onSubmit={handleSearch}>
            <div className="finder-field origin-field">
              <span className="finder-icon"><MapPin size={17} /></span>
              <PlaceAutocomplete id="origin" label="From" placeholder="Your starting point" value={origin} onChange={setOrigin} />
            </div>
            <div className="finder-field destination-field">
              <span className="finder-icon"><MapPin size={17} /></span>
              <PlaceAutocomplete id="destination" label="Going to" placeholder="Choose a destination" value={destination} onChange={(value) => { setDestination(value); setDestinationSearch(value); setSubmittedSearch('') }} onSelect={(place) => setDestinationSearch(place.name)} />
            </div>
            <label className="finder-field date-field">
              <span className="finder-icon"><CalendarDays size={17} /></span>
              <span className="field-copy"><span className="field-label">When</span><input aria-label="Travel dates" type="text" placeholder="Whenever works" onFocus={(event) => { event.target.type = 'date' }} /></span>
            </label>
            <label className="finder-field guests-field">
              <span className="finder-icon"><Users size={17} /></span>
              <span className="field-copy"><span className="field-label">Who’s going</span><select aria-label="Travelers" defaultValue="2 travelers"><option>1 traveler</option><option>2 travelers</option><option>3 travelers</option><option>4+ travelers</option></select></span>
            </label>
            <button className="finder-submit" type="submit"><Search size={17} /><span>Find a trip</span></button>
          </form>
        </section>

        <section className="intro-strip" aria-label="Our approach">
          <span>Small groups, big feeling</span><i />
          <span>Locally rooted</span><i />
          <span>Never off the shelf</span><i />
          <span>Always somewhere new</span>
        </section>

        <section className="destinations section-wrap" id="destinations">
          <div className="section-heading" data-reveal>
            <div><p className="eyebrow"><span /> A few places to begin</p><h2>Out there is<br /><em>calling.</em></h2></div>
            <div className="heading-aside"><p>Somewhere that shifts your perspective.<br />Somewhere that feels like yours.</p><div className="carousel-controls"><button type="button" aria-label="Scroll destinations left" onClick={() => document.querySelector('.destination-grid')?.scrollBy({ left: -340, behavior: 'smooth' })}><ArrowLeft size={17} /></button><button type="button" aria-label="Scroll destinations right" onClick={() => document.querySelector('.destination-grid')?.scrollBy({ left: 340, behavior: 'smooth' })}><ArrowRight size={17} /></button></div></div>
          </div>
          {submittedSearch && <p className="search-feedback" role="status">{visibleDestinations.length ? `Showing journeys${origin ? ` from “${origin}”` : ''} to “${submittedSearch}”` : `No journeys found for “${submittedSearch}”. Try Kyoto, Italy, Morocco, or Bali.`}<button type="button" onClick={() => { setOrigin(''); setDestination(''); setDestinationSearch(''); setSubmittedSearch('') }}>Clear search</button></p>}
          {visibleDestinations.length ? <div className="destination-grid">
            {visibleDestinations.map((destination, index) => <article className="destination-card" data-reveal key={destination.id} style={{ '--reveal-delay': `${index * 90}ms` }}>
              <button className={saved.includes(destination.id) ? 'save-button is-saved' : 'save-button'} type="button" aria-label={saved.includes(destination.id) ? `Remove ${destination.name} from saved trips` : `Save ${destination.name}`} onClick={() => toggleSaved(destination.id)}><Heart size={17} fill={saved.includes(destination.id) ? 'currentColor' : 'none'} /></button>
              <button className="card-image-button" type="button" onClick={() => setActiveTrip(destination)} aria-label={`Explore ${destination.name}`}>
                <img src={photo(destination.image, 850)} alt={`${destination.name} landscape`} loading="lazy" />
                <span className="card-image-shade" />
                <span className="destination-tag">{destination.tag}</span>
                <span className="card-arrow"><ArrowUpRight size={19} /></span>
                <span className="card-location"><span>{destination.region}</span><strong>{destination.name}</strong></span>
              </button>
              <div className="card-meta"><span>{destination.days} <i /> from {destination.price}</span><button type="button" onClick={() => setActiveTrip(destination)}>Explore journey <ArrowRight size={14} /></button></div>
              {destination.imageCredit && <a className="image-credit" href={destination.imageCreditUrl} target="_blank" rel="noreferrer">Photo: {destination.imageCredit}</a>}
            </article>)}
          </div> : <div className="empty-results"><MapPin size={20} /><p>We haven’t mapped that one yet.</p></div>}
          <a href="#journal" className="text-link all-journeys">See how we travel <ArrowRight size={16} /></a>
        </section>

        <section className="philosophy" id="philosophy">
          <div className="philosophy-photo" data-reveal><img src={photo('photo-1473116763249-2faaef81ccda', 1300)} alt="A lone traveler walking through a green landscape" loading="lazy" /><span className="photo-note">Take the long way.</span></div>
          <div className="philosophy-copy" data-reveal>
            <p className="eyebrow"><span /> Not another tour company</p>
            <h2>Travel should<br />leave a <em>little</em><br />room for magic.</h2>
            <p>We make thoughtful trips for people who want to feel a place, not just see it. Local hosts, unrushed days, and just enough of a plan to get wonderfully lost.</p>
            <a href="#journal" className="text-link">A little more about us <ArrowRight size={16} /></a>
            <span className="handwritten">Less checklist.<br />More goosebumps.</span>
          </div>
        </section>

        <section className="journal section-wrap" id="journal">
          <div className="journal-heading" data-reveal><div><p className="eyebrow"><span /> Postcards from out there</p><h2>Field notes<br />for the <em>daydreamers.</em></h2></div><p>Little stories, local secrets, and reasons to take the scenic route. Written from wherever we happen to be.</p></div>
          <div className="journal-grid">
            {journalEntries.slice(0, 3).map((entry, index) => <a className={index === 0 ? 'journal-card journal-feature' : 'journal-card'} href="#destinations" data-reveal key={entry.id}>
              <img src={photo(entry.image, index === 0 ? 1100 : 850)} alt={entry.title} loading="lazy" />
              <span className="journal-category">{entry.category}</span>
              <strong>{entry.title}</strong>
              <span className="journal-read">{entry.readTime || '4 min read'} <ArrowUpRight size={15} /></span>
            </a>)}
          </div>
        </section>

        <section className="newsletter">
          <div className="newsletter-copy" data-reveal><p className="eyebrow"><span /> The occasional elsewhere</p><h2>A good thing<br />to <em>come back to.</em></h2><p>Dispatches from the road, stories worth slowing down for, and first dibs on our newest journeys.</p></div>
          <form className="newsletter-form" onSubmit={(event) => { event.preventDefault(); setSubscribed(true) }} data-reveal>
            <label htmlFor="email-address">Your email address</label>
            <div className="email-input"><input id="email-address" type="email" placeholder="you@somewhere.com" required disabled={subscribed} /><button type="submit" aria-label="Subscribe to the newsletter" disabled={subscribed}>{subscribed ? <Check size={18} /> : <ArrowRight size={18} />}</button></div>
            <span className="form-footnote" role="status">{subscribed ? 'You’re on the list. See you out there.' : 'No noise. Just a note when we have something good.'}</span>
          </form>
          <span className="newsletter-stamp">GO<br />SLOW</span>
        </section>

        <footer className="site-footer">
          <a className="wordmark footer-wordmark" href="#home"><span className="brand-mark"><Plane size={17} strokeWidth={1.8} /></span>elsewhere<span className="wordmark-period">.</span></a>
          <span className="footer-note">Made for the way there.</span>
          <nav aria-label="Footer navigation"><a href="#destinations">Journeys</a><a href="#philosophy">Our story</a><a href="mailto:hello@elsewhere.travel">Say hello</a></nav>
          <span className="copyright">© 2025 Elsewhere Travel Co.</span>
        </footer>
      </main>

      {activeTrip && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setActiveTrip(null)}>
        <section className="trip-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button className="modal-close" type="button" aria-label="Close trip details" onClick={() => setActiveTrip(null)}><X size={19} /></button>
          <img src={photo(activeTrip.image, 1100)} alt={`${activeTrip.name} landscape`} />
          <div className="modal-copy"><p className="eyebrow"><span /> {activeTrip.region} · {activeTrip.days}</p><h2 id="modal-title">{activeTrip.name}</h2><p>{activeTrip.description}</p>{activeTrip.imageCredit && <a className="modal-photo-credit" href={activeTrip.imageCreditUrl} target="_blank" rel="noreferrer">Photo: {activeTrip.imageCredit}</a>}<div className="modal-bottom"><span>Trips from <strong>{activeTrip.price}</strong></span>{activeTrip.ownerUid ? <Link to="/dashboard">Ask to join this trip <ArrowUpRight size={15} /></Link> : <a href={`mailto:hello@elsewhere.travel?subject=${encodeURIComponent(`Tell me about ${activeTrip.name}`)}`}>Ask us about this trip <ArrowUpRight size={15} /></a>}</div></div>
        </section>
      </div>}
    </>
  )
}

export default App
