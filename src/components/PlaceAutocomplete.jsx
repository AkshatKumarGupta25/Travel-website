import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import './PlaceAutocomplete.css'

export default function PlaceAutocomplete({ id, label, value, placeholder, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [selectedValue, setSelectedValue] = useState('')

  useEffect(() => {
    const search = value.trim()
    if (search.length < 2 || search === selectedValue) return undefined

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(search)}&limit=8&lang=en`, { signal: controller.signal })
        if (!response.ok) throw new Error('Place search failed')
        const result = await response.json()
        const places = result.features.filter(({ properties }) => properties.osm_key === 'place').map(({ properties }) => {
          const name = properties.name
          const context = [properties.city, properties.state, properties.country]
            .filter((part, index, parts) => part && part !== name && parts.indexOf(part) === index)
            .join(', ')
          return { name, context, label: [name, context].filter(Boolean).join(', ') }
        }).filter((place) => place.name)
        setSuggestions(places.filter((place, index) => places.findIndex((item) => item.label === place.label) === index))
        setActiveIndex(-1)
        setIsOpen(true)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSuggestions([])
          setIsOpen(true)
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [value, selectedValue])

  function choosePlace(place) {
    setSelectedValue(place.label)
    onChange(place.label)
    onSelect(place)
    setSuggestions([])
    setIsOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault()
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      event.preventDefault()
      choosePlace(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="place-autocomplete">
      <span className="field-label" id={`${id}-label`}>{label}</span>
      <input
        id={id}
        aria-label={label}
        aria-labelledby={`${id}-label`}
        aria-autocomplete="list"
        aria-controls={`${id}-suggestions`}
        aria-expanded={isOpen && (suggestions.length > 0 || isLoading)}
        aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        role="combobox"
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value
          setSelectedValue('')
          onChange(nextValue)
          setIsOpen(nextValue.trim().length >= 2)
          if (nextValue.trim().length < 2) {
            setSuggestions([])
            setIsLoading(false)
            setActiveIndex(-1)
          }
        }}
        onFocus={() => suggestions.length && setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (suggestions.length > 0 || isLoading) && <ul className="place-suggestions" id={`${id}-suggestions`} role="listbox">
        {isLoading && suggestions.length === 0 ? <li className="suggestion-status" role="option" aria-selected="false">Searching places…</li> : suggestions.map((place, index) => <li key={`${place.label}-${index}`} role="presentation">
          <button
            className={index === activeIndex ? 'place-option is-active' : 'place-option'}
            id={`${id}-option-${index}`}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choosePlace(place)}
          >
            <MapPin size={15} />
            <span><strong>{place.name}</strong>{place.context && <small>{place.context}</small>}</span>
          </button>
        </li>)}
      </ul>}
    </div>
  )
}
