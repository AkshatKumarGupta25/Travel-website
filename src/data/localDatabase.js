import { starterDestinations } from './destinations.js'
import { starterJournalEntries } from './journal.js'

const STORAGE_KEY = 'elsewhere-local-db-v1'

const defaultDatabase = {
  trips: [...starterDestinations],
  siteContent: [...starterJournalEntries],
  bookings: [],
  travelers: [],
  messages: [],
  requests: [],
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getLocalDatabase() {
  const storage = getStorage()
  if (!storage) return clone(defaultDatabase)

  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) {
      storage.setItem(STORAGE_KEY, JSON.stringify(defaultDatabase))
      return clone(defaultDatabase)
    }

    const parsed = JSON.parse(raw)
    return {
      trips: Array.isArray(parsed.trips) ? parsed.trips : [...starterDestinations],
      siteContent: Array.isArray(parsed.siteContent) ? parsed.siteContent : [...starterJournalEntries],
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      travelers: Array.isArray(parsed.travelers) ? parsed.travelers : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
    }
  } catch {
    storage.setItem(STORAGE_KEY, JSON.stringify(defaultDatabase))
    return clone(defaultDatabase)
  }
}

export function saveLocalDatabase(database) {
  const storage = getStorage()
  if (!storage) return

  const normalized = {
    trips: Array.isArray(database.trips) ? database.trips : [...starterDestinations],
    siteContent: Array.isArray(database.siteContent) ? database.siteContent : [...starterJournalEntries],
    bookings: Array.isArray(database.bookings) ? database.bookings : [],
    travelers: Array.isArray(database.travelers) ? database.travelers : [],
    messages: Array.isArray(database.messages) ? database.messages : [],
    requests: Array.isArray(database.requests) ? database.requests : [],
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(normalized))
}

export function listLocalCollection(name, predicate = () => true) {
  const database = getLocalDatabase()
  const collection = database[name] || []
  return collection.filter(predicate)
}

export function createLocalRecord(name, values) {
  const database = getLocalDatabase()
  const collection = database[name] || []
  const record = {
    id: `${name}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    ...values,
  }
  database[name] = [...collection, record]
  saveLocalDatabase(database)
  return record
}

export function updateLocalRecord(name, id, changes) {
  const database = getLocalDatabase()
  const collection = database[name] || []
  const nextCollection = collection.map((record) => {
    if (record.id !== id) return record
    return { ...record, ...changes }
  })
  database[name] = nextCollection
  saveLocalDatabase(database)
  return nextCollection.find((record) => record.id === id) || null
}

export function deleteLocalRecord(name, id) {
  const database = getLocalDatabase()
  const collection = database[name] || []
  database[name] = collection.filter((record) => record.id !== id)
  saveLocalDatabase(database)
}

export function getPublishedTrips() {
  return listLocalCollection('trips', (trip) => trip.published)
}

export function getPublishedContent() {
  return listLocalCollection('siteContent', (entry) => entry.published)
}

export function resetLocalDatabase() {
  saveLocalDatabase(clone(defaultDatabase))
  return clone(defaultDatabase)
}
