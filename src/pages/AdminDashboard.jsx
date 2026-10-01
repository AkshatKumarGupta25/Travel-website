import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPinned,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { db, functions } from '../firebase.js'
import { starterDestinations } from '../data/destinations.js'
import { starterJournalEntries } from '../data/journal.js'
import './AdminDashboard.css'

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'trips', label: 'Trips', icon: MapPinned },
  { id: 'bookings', label: 'Bookings', icon: CalendarDays },
  { id: 'travelers', label: 'Travelers', icon: Users },
  { id: 'messages', label: 'Messages', icon: Mail },
  { id: 'content', label: 'Site content', icon: FileText },
]

const collections = {
  trips: 'trips',
  bookings: 'bookings',
  travelers: 'travelers',
  messages: 'messages',
  content: 'siteContent',
}

const formDefaults = {
  trips: { name: '', region: '', days: '', price: '', image: '', description: '', tag: 'Featured journey', published: true },
  bookings: { travelerName: '', email: '', destination: '', startDate: '', travelers: 2, status: 'new' },
  messages: { name: '', email: '', subject: '', body: '', isRead: false },
  content: { title: '', category: 'Field notes', image: '', readTime: '4 min read', body: '', published: true },
}

const sectionTitles = {
  trips: 'Trips and destinations',
  bookings: 'Booking requests',
  travelers: 'Traveler accounts',
  messages: 'Messages and inquiries',
  content: 'Site content',
}

function readableDate(value) {
  if (!value) return '—'
  const date = value.toDate ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function RecordDialog({ section, record, onClose, onSave, busy }) {
  const [values, setValues] = useState(() => ({ ...formDefaults[section], ...record }))
  const fields = {
    trips: [
      ['name', 'Trip name'], ['region', 'Region'], ['days', 'Duration'], ['price', 'Starting price'],
      ['image', 'Unsplash photo ID'], ['tag', 'Card label'], ['description', 'Description'],
    ],
    bookings: [
      ['travelerName', 'Traveler name'], ['email', 'Email'], ['destination', 'Destination'],
      ['startDate', 'Start date'], ['travelers', 'Travelers'],
    ],
    messages: [['name', 'Name'], ['email', 'Email'], ['subject', 'Subject'], ['body', 'Message']],
    content: [['title', 'Title'], ['category', 'Category'], ['image', 'Unsplash photo ID'], ['readTime', 'Reading time'], ['body', 'Content']],
  }[section]

  function updateField(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  return (
    <div className="admin-modal-shade" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="admin-record-modal" onSubmit={(event) => { event.preventDefault(); onSave(values) }}>
        <div className="admin-modal-head"><div><span className="admin-kicker">{record ? 'Edit record' : 'New record'}</span><h2>{record ? 'Update' : 'Create'} {section === 'content' ? 'content' : section.slice(0, -1)}</h2></div><button type="button" aria-label="Close form" onClick={onClose}><X size={19} /></button></div>
        <div className="admin-form-grid">
          {fields.map(([name, label]) => <label className={['description', 'body'].includes(name) ? 'admin-input wide' : 'admin-input'} key={name}>
            <span>{label}</span>
            {['description', 'body'].includes(name)
              ? <textarea required value={values[name] || ''} onChange={(event) => updateField(name, event.target.value)} rows={4} />
              : <input required type={name === 'email' ? 'email' : name === 'startDate' ? 'date' : name === 'travelers' ? 'number' : 'text'} min={name === 'travelers' ? 1 : undefined} value={values[name] ?? ''} onChange={(event) => updateField(name, name === 'travelers' ? Number(event.target.value) : event.target.value)} />}
          </label>)}
        </div>
        {['trips', 'content'].includes(section) && <label className="admin-checkbox"><input type="checkbox" checked={Boolean(values.published)} onChange={(event) => updateField('published', event.target.checked)} /> Publish on the website</label>}
        <div className="admin-modal-actions"><button type="button" className="admin-secondary" onClick={onClose}>Cancel</button><button type="submit" className="admin-primary" disabled={busy}>{busy ? 'Saving…' : record ? 'Save changes' : 'Create record'}</button></div>
      </form>
    </div>
  )
}

export default function AdminDashboard() {
  const { user, signOut } = useAuth()
  const [activeSection, setActiveSection] = useState('overview')
  const [records, setRecords] = useState([])
  const [metrics, setMetrics] = useState({})
  const [recentBookings, setRecentBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dialog, setDialog] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true

    async function loadSection() {
      try {
        if (activeSection === 'overview') {
          const names = Object.values(collections)
          const snapshots = await Promise.all(names.map((name) => getDocs(collection(db, name))))
          if (!current) return
          setMetrics(Object.fromEntries(names.map((name, index) => [name, snapshots[index].size])))
          setRecentBookings(snapshots[names.indexOf('bookings')].docs.map((item) => ({ id: item.id, ...item.data() })).slice(0, 5))
        } else {
          const snapshot = await getDocs(collection(db, collections[activeSection]))
          if (!current) return
          const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
          items.sort((left, right) => {
            const leftDate = left.createdAt?.toMillis?.() || 0
            const rightDate = right.createdAt?.toMillis?.() || 0
            return rightDate - leftDate
          })
          setRecords(items)
        }
      } catch (loadError) {
        if (current) setError(loadError.message || 'Could not load this section.')
      } finally {
        if (current) setLoading(false)
      }
    }

    loadSection()
    return () => { current = false }
  }, [activeSection, refreshKey])

  async function saveRecord(values) {
    setSaving(true)
    setError('')
    try {
      const collectionName = collections[activeSection]
      const payload = { ...values, updatedAt: serverTimestamp() }
      if (dialog.record?.id) {
        await updateDoc(doc(db, collectionName, dialog.record.id), payload)
      } else {
        await addDoc(collection(db, collectionName), { ...payload, createdAt: serverTimestamp() })
      }
      setDialog(null)
      setNotice('Changes saved.')
      setRefreshKey((value) => value + 1)
    } catch (saveError) {
      setError(saveError.message || 'Could not save this record.')
    } finally {
      setSaving(false)
    }
  }

  async function updateRecord(section, record, changes) {
    try {
      await updateDoc(doc(db, collections[section], record.id), { ...changes, updatedAt: serverTimestamp() })
      setNotice('Record updated.')
      setRefreshKey((value) => value + 1)
    } catch (updateError) {
      setError(updateError.message || 'Could not update this record.')
    }
  }

  async function callAdminFunction(name, payload) {
    try {
      const result = await httpsCallable(functions, name)(payload)
      setNotice(result.data?.message || 'Traveler account updated.')
      setRefreshKey((value) => value + 1)
    } catch (callError) {
      setError(callError.message || 'Could not update this traveler.')
    }
  }

  async function deleteRecord(section, record) {
    if (!window.confirm(`Delete this ${section === 'content' ? 'content item' : section.slice(0, -1)}? This cannot be undone.`)) return
    try {
      if (section === 'travelers') {
        await httpsCallable(functions, 'deleteTraveler')({ uid: record.id })
      } else {
        await deleteDoc(doc(db, collections[section], record.id))
      }
      setNotice('Record deleted.')
      setRefreshKey((value) => value + 1)
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this record.')
    }
  }

  async function importFeaturedTrips() {
    setSaving(true)
    try {
      const batch = writeBatch(db)
      starterDestinations.forEach(({ id, ...destination }) => {
        batch.set(doc(db, 'trips', id), { ...destination, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true })
      })
      await batch.commit()
      setNotice('Featured journeys added to your trip catalogue.')
      setRefreshKey((value) => value + 1)
    } catch (importError) {
      setError(importError.message || 'Could not import featured journeys.')
    } finally {
      setSaving(false)
    }
  }

  async function importStarterContent() {
    setSaving(true)
    try {
      const batch = writeBatch(db)
      starterJournalEntries.forEach(({ id, ...entry }) => {
        batch.set(doc(db, 'siteContent', id), { ...entry, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true })
      })
      await batch.commit()
      setNotice('Field notes added to site content.')
      setRefreshKey((value) => value + 1)
    } catch (importError) {
      setError(importError.message || 'Could not import field notes.')
    } finally {
      setSaving(false)
    }
  }

  function changeSection(section) {
    setLoading(true)
    setError('')
    setNotice('')
    setActiveSection(section)
  }

  const currentSection = sections.find((section) => section.id === activeSection)
  const currentSectionTitle = sectionTitles[activeSection]
  const metricCards = [
    { key: 'trips', label: 'Published trips', icon: MapPinned },
    { key: 'bookings', label: 'Bookings', icon: CalendarDays },
    { key: 'travelers', label: 'Travelers', icon: Users },
    { key: 'messages', label: 'Messages', icon: Mail },
  ]

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" to="/"><span className="brand-mark"><MapPinned size={16} /></span>elsewhere<span>.</span></Link>
        <div className="admin-workspace"><span className="admin-workspace-mark">E</span><span><strong>Elsewhere Travel</strong><small>Workspace</small></span></div>
        <span className="admin-nav-label">Workspace</span>
        <nav className="admin-nav" aria-label="Admin sections">
          {sections.map(({ id, label, icon: Icon }) => <button className={activeSection === id ? 'admin-nav-item is-active' : 'admin-nav-item'} type="button" key={id} onClick={() => changeSection(id)}><Icon size={17} /><span>{label}</span>{activeSection === id && <ChevronRight size={14} />}</button>)}
        </nav>
        <div className="admin-sidebar-bottom"><Link to="/" className="admin-back-link"><ArrowLeft size={15} /> View travel site</Link><button className="admin-logout" type="button" onClick={signOut}><LogOut size={15} /> Sign out</button></div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar"><div><span className="admin-breadcrumb">Admin /</span> {currentSection?.label}</div><div className="admin-user"><span className="admin-user-avatar">{user?.displayName?.[0] || user?.email?.[0] || 'A'}</span><span><strong>{user?.displayName || 'Administrator'}</strong><small>{user?.email}</small></span><ShieldCheck size={16} /></div></header>
        <div className="admin-content">
          <div className="admin-page-title"><div><p className="admin-kicker">{activeSection === 'overview' ? 'Your travel business, at a glance' : 'Manage your travel business'}</p><h1>{currentSectionTitle || 'Overview'}</h1></div><div className="admin-title-actions"><button type="button" className="admin-icon-button" title="Refresh data" onClick={() => { setLoading(true); setRefreshKey((value) => value + 1) }}><RefreshCw size={16} /></button>{activeSection !== 'overview' && activeSection !== 'travelers' && <button className="admin-primary" type="button" onClick={() => setDialog({ section: activeSection, record: null })}><Plus size={16} /> Add {activeSection === 'content' ? 'content' : activeSection.slice(0, -1)}</button>}</div></div>
          {notice && <div className="admin-notice" role="status"><Check size={15} />{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
          {error && <div className="admin-error" role="alert">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}

          {activeSection === 'overview' ? <>
            <div className="admin-metrics">{metricCards.map(({ key, label, icon: Icon }) => <article className="admin-metric" key={key}><span className="metric-icon"><Icon size={17} /></span><span className="metric-label">{label}</span><strong>{loading ? '—' : metrics[collections[key]] ?? 0}</strong><small>Across your workspace</small></article>)}</div>
            <div className="admin-overview-grid">
              <section className="admin-panel"><div className="admin-panel-heading"><div><span className="admin-kicker">Latest activity</span><h2>Recent bookings</h2></div><button type="button" onClick={() => changeSection('bookings')}>All bookings <ArrowUpRight size={14} /></button></div>{loading ? <p className="admin-empty">Loading bookings…</p> : recentBookings.length ? <div className="recent-bookings">{recentBookings.map((booking) => <div className="recent-booking" key={booking.id}><span className="recent-booking-icon"><CalendarDays size={16} /></span><span><strong>{booking.travelerName || booking.name || booking.email || 'New traveler'}</strong><small>{booking.destination || 'Trip inquiry'} · {readableDate(booking.createdAt)}</small></span><span className={`booking-status status-${booking.status || 'new'}`}>{booking.status || 'new'}</span></div>)}</div> : <p className="admin-empty">No bookings yet. New requests will appear here.</p>}</section>
              <section className="admin-panel admin-quick-panel"><span className="admin-kicker">Quick actions</span><h2>Keep things moving.</h2><button type="button" onClick={() => { changeSection('trips'); setDialog({ section: 'trips', record: null }) }}><MapPinned size={16} /> Add a destination <ArrowUpRight size={14} /></button><button type="button" onClick={() => { changeSection('bookings'); setDialog({ section: 'bookings', record: null }) }}><CalendarDays size={16} /> Create a booking <ArrowUpRight size={14} /></button><button type="button" onClick={() => changeSection('messages')}><Mail size={16} /> Review messages <ArrowUpRight size={14} /></button></section>
            </div>
            <div className="admin-security-note"><ShieldCheck size={16} /><span>Admin tools are protected by Firebase role claims and Firestore rules.</span></div>
          </> : <section className="admin-panel admin-records-panel">
            <div className="admin-panel-heading"><div><span className="admin-kicker">{records.length} {records.length === 1 ? 'record' : 'records'}</span><h2>{currentSectionTitle}</h2></div>{records.length === 0 && ['trips', 'content'].includes(activeSection) && <button type="button" className="admin-secondary" disabled={saving} onClick={activeSection === 'trips' ? importFeaturedTrips : importStarterContent}><BookOpen size={15} /> {saving ? 'Importing…' : `Import featured ${activeSection === 'trips' ? 'trips' : 'field notes'}`}</button>}</div>
            {loading ? <p className="admin-empty">Loading {currentSectionTitle.toLowerCase()}…</p> : records.length === 0 ? <div className="admin-empty-state"><span className="admin-empty-icon"><Activity size={20} /></span><h3>Nothing here yet.</h3><p>{activeSection === 'trips' ? 'Import the featured journeys or create a destination to start your catalogue.' : activeSection === 'content' ? 'Import the current field notes or create a new story.' : `New ${activeSection} records will appear here.`}</p>{['trips', 'content'].includes(activeSection) && <button type="button" className="admin-primary" disabled={saving} onClick={activeSection === 'trips' ? importFeaturedTrips : importStarterContent}><BookOpen size={15} /> Import featured {activeSection === 'trips' ? 'trips' : 'field notes'}</button>}</div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{getHeaders(activeSection).map((heading) => <th key={heading}>{heading}</th>)}<th>Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}>{renderCells(activeSection, record, (status) => updateRecord('bookings', record, { status }), (published) => updateRecord(activeSection, record, { published }), (isRead) => updateRecord('messages', record, { isRead }))}<td className="admin-row-actions">
              {['trips', 'content'].includes(activeSection) && <button className="admin-small-action" type="button" onClick={() => setDialog({ section: activeSection, record })}>Edit</button>}
              {activeSection === 'travelers' && record.id !== user?.uid && <><button className="admin-small-action" type="button" onClick={() => callAdminFunction('setAdminRole', { uid: record.id, admin: !record.admin })}>{record.admin ? 'Remove admin' : 'Make admin'}</button><button className="admin-small-action" type="button" onClick={() => callAdminFunction('setTravelerDisabled', { uid: record.id, disabled: !record.disabled })}>{record.disabled ? 'Enable' : 'Disable'}</button></>}
              {activeSection === 'messages' && <button className="admin-small-action" type="button" onClick={() => updateRecord('messages', record, { isRead: !record.isRead })}>{record.isRead ? 'Mark unread' : 'Mark read'}</button>}
              {activeSection === 'travelers' && record.id !== user?.uid && <button className="admin-danger-icon" type="button" aria-label="Delete traveler" onClick={() => deleteRecord('travelers', record)}><Trash2 size={15} /></button>}
              {!['travelers'].includes(activeSection) && <button className="admin-danger-icon" type="button" aria-label="Delete record" onClick={() => deleteRecord(activeSection, record)}><Trash2 size={15} /></button>}
            </td></tr>)}</tbody></table></div>}
          </section>}
        </div>
      </section>
      {dialog && <RecordDialog section={dialog.section} record={dialog.record} onClose={() => setDialog(null)} onSave={saveRecord} busy={saving} />}
    </main>
  )
}

function getHeaders(section) {
  return {
    trips: ['Destination', 'Region', 'Duration', 'Price', 'Website'],
    bookings: ['Traveler', 'Destination', 'Travel date', 'Travelers', 'Status'],
    travelers: ['UID', 'Traveler', 'Email', 'Joined', 'Account', 'Role'],
    messages: ['From', 'Subject', 'Message', 'Received', 'Status'],
    content: ['Title', 'Category', 'Updated', 'Visibility'],
  }[section]
}

function renderCells(section, record, updateStatus, updatePublished, updateRead) {
  if (section === 'trips') return <>
    <td><strong>{record.name || 'Untitled trip'}</strong><small>{record.id}</small></td><td>{record.region || '—'}</td><td>{record.days || '—'}</td><td>{record.price || '—'}</td><td><button className={`booking-status ${record.published ? 'status-confirmed' : 'status-cancelled'}`} type="button" onClick={() => updatePublished(!record.published)}>{record.published ? 'Published' : 'Draft'}</button></td>
  </>
  if (section === 'bookings') return <>
    <td><strong>{record.travelerName || record.name || 'Traveler'}</strong><small>{record.email || '—'}</small></td><td>{record.destination || '—'}</td><td>{record.startDate || readableDate(record.createdAt)}</td><td>{record.travelers || 1}</td><td><select className="admin-status-select" aria-label={`Booking status for ${record.travelerName || record.email || 'traveler'}`} value={record.status || 'new'} onChange={(event) => updateStatus(event.target.value)}><option value="new">New</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select></td>
  </>
  if (section === 'travelers') return <>
    <td><code className="admin-uid" title={record.uid || record.id}>{record.uid || record.id}</code></td><td><strong>{record.displayName || 'Traveler'}</strong></td><td>{record.email || '—'}</td><td>{readableDate(record.createdAt || record.lastSeenAt)}</td><td><span className={`booking-status ${record.disabled ? 'status-cancelled' : 'status-confirmed'}`}>{record.disabled ? 'Disabled' : 'Active'}</span></td><td><span className={record.admin ? 'role-badge is-admin' : 'role-badge'}>{record.admin ? 'Admin' : 'Traveler'}</span></td>
  </>
  if (section === 'messages') return <>
    <td><strong>{record.name || 'Traveler'}</strong><small>{record.email || '—'}</small></td><td>{record.subject || 'Trip inquiry'}</td><td className="admin-message-preview">{record.body || '—'}</td><td>{readableDate(record.createdAt)}</td><td><button className={`booking-status ${record.isRead ? 'status-confirmed' : 'status-new'}`} type="button" onClick={() => updateRead(!record.isRead)}>{record.isRead ? 'Read' : 'Unread'}</button></td>
  </>
  return <>
    <td><strong>{record.title || 'Untitled content'}</strong></td><td>{record.category || '—'}</td><td>{readableDate(record.updatedAt || record.createdAt)}</td><td><button className={`booking-status ${record.published ? 'status-confirmed' : 'status-cancelled'}`} type="button" onClick={() => updatePublished(!record.published)}>{record.published ? 'Published' : 'Draft'}</button></td>
  </>
}
