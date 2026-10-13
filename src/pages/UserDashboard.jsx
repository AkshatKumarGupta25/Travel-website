import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { ArrowLeft, Check, Compass, LogOut, MapPin, RefreshCw, Send, ShieldCheck, Users, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth.js'
import { db, firebaseConfigured } from '../firebase.js'
import {
  createLocalRecord,
  getLocalDatabase,
  updateLocalRecord,
} from '../data/localDatabase.js'
import PlaceAutocomplete from '../components/PlaceAutocomplete.jsx'
import './UserDashboard.css'

const fallbackImage = 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=85'
const minimumStartDate = new Date().toISOString().slice(0, 10)
const destinationPhotoTimeoutMs = 6000

async function getDestinationImage(place) {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), destinationPhotoTimeoutMs)

  try {
    return await lookupDestinationImage(place, googleApiKey, controller.signal)
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function lookupDestinationImage(place, googleApiKey, signal) {
  let googlePhotoError = false

  if (googleApiKey) {
    try {
      const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleApiKey,
          'X-Goog-FieldMask': 'places.photos,places.googleMapsUri',
        },
        body: JSON.stringify({ textQuery: `${place.label} travel destination` }),
        signal,
      })
      if (!searchResponse.ok) throw new Error(`Google Places photo search failed (${searchResponse.status}).`)
      const searchResult = await searchResponse.json()
      const placeResult = searchResult.places?.[0]
      const photoResult = placeResult?.photos?.[0]
      const photoName = photoResult?.name
      if (photoName) {
        const photoResponse = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${encodeURIComponent(googleApiKey)}`, { signal })
        if (!photoResponse.ok) throw new Error(`Google Places photo request failed (${photoResponse.status}).`)
        const mediaResult = await photoResponse.json()
        if (mediaResult.photoUri) {
          const author = placeResult.photos[0].authorAttributions?.[0]
          return {
            url: mediaResult.photoUri,
            source: 'Google Places',
            credit: author?.displayName || 'Google Maps',
            creditUrl: author?.uri?.startsWith('https://')
              ? author.uri
              : placeResult.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.label)}`,
          }
        }
      }
    } catch {
      googlePhotoError = true
    }
  }

  let image = ''
  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `filetype:bitmap ${place.label} landscape`,
      gsrnamespace: '6',
      gsrlimit: '1',
      prop: 'imageinfo|info',
      iiprop: 'url',
      iiurlwidth: '1200',
      inprop: 'url',
      format: 'json',
      origin: '*',
    })
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal })
    if (!response.ok) throw new Error(`Destination photo search failed (${response.status}).`)
    const result = await response.json()
    const page = Object.values(result.query?.pages || {})[0]
    image = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url || ''
    if (image) return { url: image, source: 'Wikimedia Commons', credit: page.title, creditUrl: page.fullurl, warning: true }
  } catch {
    image = ''
  }
  return {
    url: image || fallbackImage,
    source: image ? 'Wikimedia Commons' : 'default landscape',
    credit: '',
    creditUrl: '',
    warning: !googleApiKey || googlePhotoError || !image,
  }
}

export default function UserDashboard() {
  const { user, signOut } = useAuth()
  const [location, setLocation] = useState('')
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [startDate, setStartDate] = useState('')
  const [duration, setDuration] = useState('5')
  const [maxTravelers, setMaxTravelers] = useState('4')
  const [description, setDescription] = useState('')
  const [hostedTrips, setHostedTrips] = useState([])
  const [availableTrips, setAvailableTrips] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [hostRequests, setHostRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [photoNotice, setPhotoNotice] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!user) return undefined
    let current = true

    async function loadDashboard() {
      try {
        if (!firebaseConfigured) {
          const database = getLocalDatabase()
          const hosted = database.trips.filter((trip) => trip.ownerUid === user.uid)
          const published = database.trips.filter((trip) => trip.published && trip.ownerUid && trip.ownerUid !== user.uid)
          const myRequests = database.requests.filter((request) => request.travelerUid === user.uid)
          const applications = database.requests.filter((request) => {
            const trip = database.trips.find((item) => item.id === request.tripId)
            return trip && trip.ownerUid === user.uid
          })

          if (!current) return
          setHostedTrips(hosted)
          setAvailableTrips(published)
          setMyRequests(myRequests)
          setHostRequests(applications)
          setLoading(false)
          return
        }

        const [hostedSnapshot, publishedSnapshot, requestsSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'trips'), where('ownerUid', '==', user.uid))),
          getDocs(query(collection(db, 'trips'), where('published', '==', true))),
          getDocs(query(collectionGroup(db, 'requests'), where('travelerUid', '==', user.uid))),
        ])
        const hosted = hostedSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        const hostedRequestGroups = await Promise.all(hosted.map((trip) =>
          getDocs(collection(db, 'trips', trip.id, 'requests')),
        ))
        const requests = requestsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        const applications = hostedRequestGroups.flatMap((snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
        if (!current) return
        setHostedTrips(hosted)
        setAvailableTrips(publishedSnapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .filter((trip) => trip.ownerUid && trip.ownerUid !== user.uid))
        setMyRequests(requests)
        setHostRequests(applications)
      } catch (loadError) {
        if (current) setError(loadError.message || 'Could not load your travel dashboard.')
      } finally {
        if (current) setLoading(false)
      }
    }

    loadDashboard()
    return () => { current = false }
  }, [user, refreshKey])

  function refreshDashboard() {
    setLoading(true)
    setError('')
    setRefreshKey((current) => current + 1)
  }

  async function createTrip(event) {
    event.preventDefault()
    if (!selectedPlace) {
      setError('Choose a destination from the location suggestions before creating your trip.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    setPhotoNotice('')
    try {
      const tripName = `Trip to ${selectedPlace.name}`
      const tripRecord = {
        name: tripName,
        region: selectedPlace.context || 'Community trip',
        destination: selectedPlace.label,
        days: `${Number(duration)} days`,
        price: 'Shared expenses',
        image: fallbackImage,
        imageSource: 'default landscape',
        imageCredit: '',
        imageCreditUrl: '',
        description: description.trim(),
        tag: 'Community trip',
        published: false,
        approvalStatus: 'pending',
        ownerUid: user.uid,
        ownerName: user.displayName || user.email || 'Traveler',
        startDate,
        maxTravelers: Number(maxTravelers),
        createdAt: firebaseConfigured ? serverTimestamp() : new Date().toISOString(),
        updatedAt: firebaseConfigured ? serverTimestamp() : new Date().toISOString(),
      }

      let savedTripId
      if (!firebaseConfigured) {
        savedTripId = createLocalRecord('trips', tripRecord).id
      } else {
        const tripReference = await addDoc(collection(db, 'trips'), tripRecord)
        savedTripId = tripReference.id
      }

      setNotice('Your trip was sent to the admin team for approval.')
      setPhotoNotice('Trip saved. Finding a photo of your destination…')
      setLocation('')
      setSelectedPlace(null)
      setDescription('')
      setStartDate('')
      refreshDashboard()

      void (async () => {
        try {
          const destinationPhoto = await getDestinationImage(selectedPlace)
          const photoFields = {
            image: destinationPhoto.url,
            imageSource: destinationPhoto.source,
            imageCredit: destinationPhoto.credit,
            imageCreditUrl: destinationPhoto.creditUrl,
            updatedAt: firebaseConfigured ? serverTimestamp() : new Date().toISOString(),
          }
          if (!firebaseConfigured) {
            updateLocalRecord('trips', savedTripId, photoFields)
          } else {
            await updateDoc(doc(db, 'trips', savedTripId), photoFields)
          }
          setPhotoNotice(destinationPhoto.warning
            ? `Using ${destinationPhoto.source}. Configure the Google Places API key to use Google destination photos.`
            : `Destination thumbnail found with ${destinationPhoto.source}.`)
        } catch (photoError) {
          setPhotoNotice(`Trip saved, but its photo could not be updated: ${photoError.message || 'unknown error'}`)
        }
      })()
    } catch (saveError) {
      setError(saveError.message || 'Could not create this trip.')
      setPhotoNotice('')
    } finally {
      setSaving(false)
    }
  }

  async function requestToJoin(trip) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const requestRecord = {
        tripId: trip.id,
        tripName: trip.name,
        ownerUid: trip.ownerUid,
        travelerUid: user.uid,
        travelerName: user.displayName || 'Traveler',
        travelerEmail: user.email || '',
        status: 'pending',
        createdAt: firebaseConfigured ? serverTimestamp() : new Date().toISOString(),
        updatedAt: firebaseConfigured ? serverTimestamp() : new Date().toISOString(),
      }

      if (!firebaseConfigured) {
        createLocalRecord('requests', requestRecord)
      } else {
        await addDoc(collection(db, 'trips', trip.id, 'requests'), requestRecord)
      }
      setNotice(`Your request to join ${trip.name} was sent.`)
      refreshDashboard()
    } catch (requestError) {
      setError(requestError.message || 'Could not send your request.')
    } finally {
      setSaving(false)
    }
  }

  async function respondToRequest(request, status) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (!firebaseConfigured) {
        updateLocalRecord('requests', request.id, {
          status,
          updatedAt: new Date().toISOString(),
        })
      } else {
        await updateDoc(doc(db, 'trips', request.tripId, 'requests', request.id), {
          status,
          updatedAt: serverTimestamp(),
        })
      }
      setNotice(`Traveler ${status}.`)
      refreshDashboard()
    } catch (responseError) {
      setError(responseError.message || 'Could not update this traveler request.')
    } finally {
      setSaving(false)
    }
  }

  const myRequestFor = (tripId) => myRequests.find((request) => request.tripId === tripId)

  return (
    <main className="traveler-dashboard">
      <header className="traveler-header">
        <Link className="traveler-brand" to="/"><span>↗</span> elsewhere.</Link>
        <div className="traveler-account">
          {user?.photoURL && <img src={user.photoURL} alt="" />}
          <span>{user?.displayName || user?.email}</span>
          <button type="button" onClick={signOut}><LogOut size={15} /> Sign out</button>
        </div>
      </header>
      <section className="traveler-main">
        <Link className="traveler-back" to="/"><ArrowLeft size={15} /> Back to the journeys</Link>
        <div className="traveler-title">
          <div><p className="traveler-kicker"><Compass size={14} /> Your travel community</p><h1>Make a trip<br /><em>your own.</em></h1></div>
          <p>Plan a journey, invite fellow travelers, and keep every request in one place.</p>
        </div>

        {notice && <div className="traveler-alert traveler-success" role="status"><Check size={16} />{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
        {error && <div className="traveler-alert traveler-error" role="alert">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
        {!firebaseConfigured && <div className="traveler-alert traveler-error" role="alert">Firebase is not configured. Add your Firebase settings to .env.local before using your dashboard.</div>}

        <div className="traveler-layout">
          <section className="traveler-panel traveler-create">
            <p className="traveler-kicker">Start something together</p>
            <h2>Create a trip</h2>
            <p className="traveler-panel-copy">Your trip appears on the site after an admin approves it.</p>
            <form onSubmit={createTrip}>
              <label className="traveler-field">
                <span>Where are you going?</span>
                <PlaceAutocomplete id="trip-destination" label="Choose a location" placeholder="Search a city or place" value={location} onChange={(value) => { setLocation(value); setSelectedPlace(null) }} onSelect={setSelectedPlace} />
              </label>
              <div className="traveler-field-row">
                <label className="traveler-field"><span>Start date</span><input required type="date" min={minimumStartDate} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                <label className="traveler-field"><span>Duration (days)</span><input required type="number" min="1" max="60" value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
              </div>
              <label className="traveler-field"><span>Maximum travelers (including you)</span><input required type="number" min="2" max="30" value={maxTravelers} onChange={(event) => setMaxTravelers(event.target.value)} /></label>
              <label className="traveler-field"><span>What’s the plan?</span><textarea required minLength="20" maxLength="800" rows="4" placeholder="Share the highlights, pace, and what kind of travelers should join." value={description} onChange={(event) => setDescription(event.target.value)} /></label>
              <button className="traveler-submit" type="submit" disabled={saving}>{saving ? 'Saving your trip…' : 'Create trip for approval'} <Send size={15} /></button>
              {photoNotice && <p className="traveler-photo-note" role="status"><MapPin size={13} />{photoNotice}</p>}
            </form>
          </section>

          <section className="traveler-content">
            <div className="traveler-panel">
              <div className="traveler-section-heading"><div><p className="traveler-kicker">Your plans</p><h2>Trips you’ve created</h2></div><button className="traveler-refresh" type="button" aria-label="Refresh dashboard" onClick={refreshDashboard}><RefreshCw size={15} /></button></div>
              {loading ? <p className="traveler-empty">Loading your trips…</p> : hostedTrips.length ? <div className="traveler-trip-list">
                {hostedTrips.map((trip) => {
                  const requests = hostRequests.filter((request) => request.tripId === trip.id)
                  return <article className="traveler-trip" key={trip.id}>
                    <img src={trip.image} alt="" />
                    <div className="traveler-trip-info"><span className={`traveler-status status-${trip.approvalStatus || (trip.published ? 'approved' : 'pending')}`}>{trip.published ? 'Approved and live' : trip.approvalStatus || 'Pending approval'}</span><h3>{trip.name}</h3><p>{trip.destination || trip.region} · {trip.startDate || 'Date not set'}</p><small>{trip.days} · up to {trip.maxTravelers || '—'} travelers</small>{trip.imageCredit && <a className="traveler-image-credit" href={trip.imageCreditUrl} target="_blank" rel="noreferrer">Photo: {trip.imageCredit}</a>}</div>
                    <div className="traveler-requests"><strong>{requests.length} {requests.length === 1 ? 'request' : 'requests'}</strong>{requests.map((request) => <div className="traveler-request" key={request.id}><span><b>{request.travelerName}</b><small>{request.travelerEmail} · {request.status}</small></span>{request.status === 'pending' && <span className="traveler-request-actions"><button type="button" disabled={saving} onClick={() => respondToRequest(request, 'accepted')}>Accept</button><button type="button" disabled={saving} onClick={() => respondToRequest(request, 'rejected')}>Decline</button></span>}</div>)}</div>
                  </article>
                })}
              </div> : <p className="traveler-empty">No trips yet. Create your first one to invite fellow travelers.</p>}
            </div>

            <div className="traveler-panel">
              <div className="traveler-section-heading"><div><p className="traveler-kicker">Find your people</p><h2>Trips to join</h2></div><Users size={18} /></div>
              {loading ? <p className="traveler-empty">Finding approved trips…</p> : availableTrips.length ? <div className="traveler-discover-list">
                {availableTrips.map((trip) => {
                  const request = myRequestFor(trip.id)
                  return <article className="traveler-discover" key={trip.id}>
                    <img src={trip.image} alt="" />
                    <div><span>{trip.region} · {trip.days}</span><h3>{trip.name}</h3><p>{trip.description}</p><small>Hosted by {trip.ownerName || 'a traveler'} · {trip.startDate || 'Date not set'}</small>{trip.imageCredit && <a className="traveler-image-credit" href={trip.imageCreditUrl} target="_blank" rel="noreferrer">Photo: {trip.imageCredit}</a>}</div>
                    <button type="button" disabled={saving || Boolean(request)} onClick={() => requestToJoin(trip)}>{request ? `Request ${request.status}` : 'Ask to join'} {!request && <Send size={14} />}</button>
                  </article>
                })}
              </div> : <p className="traveler-empty">No approved community trips to join just yet. Check back soon.</p>}
              {myRequests.length > 0 && <p className="traveler-request-count"><ShieldCheck size={14} /> You’ve sent {myRequests.length} traveler {myRequests.length === 1 ? 'request' : 'requests'}.</p>}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
