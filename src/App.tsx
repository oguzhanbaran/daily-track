import { useEffect, useState, type FormEvent } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { CircleDot, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import './App.css'

type Participant = { id: string; name: string; spoken: boolean; absent: boolean; fixed: boolean }
type SavedMeeting = { participants: Participant[]; currentSpeakerId: string | null; elapsedSeconds: number; isRunning: boolean }

const storageKey = 'daily-track-meeting-v1'
const teamNames = [
  'Oğuzhan',
  'Osman',
  'Furkan',
  'Yunus',
  'Zeynep',
  'Melek',
  'Süleyman',
  'Resul',
  'Tuğba',
  'Ayşe',
  'Sıla',
  'Mehmet',
  'Kübra',
  'Barış',
]
const legacySampleIds = new Set(['1', '2', '3', '4', '5'])

function createTeamParticipants(savedParticipants: Participant[] = []) {
  return teamNames.map((name, index) => {
    const id = `team-${String(index + 1).padStart(2, '0')}`
    const savedPerson = savedParticipants.find((person) => person.id === id || person.name === name)
    return { id, name, spoken: savedPerson?.spoken ?? false, absent: savedPerson?.absent ?? false, fixed: true }
  })
}

function loadMeeting(): SavedMeeting {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const previous = JSON.parse(saved) as SavedMeeting
      const previousParticipants = Array.isArray(previous.participants) ? previous.participants : []
      const fixedNames = new Set(teamNames)
      const customParticipants = previousParticipants
        .filter((person) => !fixedNames.has(person.name) && !legacySampleIds.has(person.id) && !person.id.startsWith('team-'))
        .map((person) => ({ ...person, absent: person.absent ?? false, fixed: false }))
      const participants = [...createTeamParticipants(previousParticipants), ...customParticipants]
      const currentSpeakerId = participants.some((person) => person.id === previous.currentSpeakerId) ? previous.currentSpeakerId : null
      return { ...previous, participants, currentSpeakerId }
    }
  } catch {
    localStorage.removeItem(storageKey)
  }
  return { participants: createTeamParticipants(), currentSpeakerId: null, elapsedSeconds: 0, isRunning: false }
}

function DraggablePerson({ person }: { person: Participant }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: person.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <button
      ref={setNodeRef}
      className={`name-chip${isDragging ? ' is-dragging' : ''}`}
      style={style}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`${person.name}, sürükleyerek konuştu durumunu değiştir`}
    >
      {person.name}
    </button>
  )
}

function ParticipantLane({ id, title, people }: { id: 'unspoken' | 'spoken'; title: string; people: Participant[] }) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <section ref={setNodeRef} className={`participant-lane${isOver ? ' is-over' : ''}`} aria-label={title}>
      <h1>{title}</h1>
      <div className="lane-people">
        {people.map((person) => <DraggablePerson key={person.id} person={person} />)}
        {people.length === 0 && <p className="lane-empty">İsimleri buraya bırak</p>}
      </div>
    </section>
  )
}

function App() {
  const [meeting, setMeeting] = useState(loadMeeting)
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('daily-track-auth') === 'true')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const participants = meeting.participants.filter((person) => !person.absent)
  const unspokenPeople = participants.filter((person) => !person.spoken)
  const spokenPeople = participants.filter((person) => person.spoken)
  const activePerson = participants.find((person) => person.id === activeId)

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (username.trim() === 'ogilet' && password === 'ogi123') {
      sessionStorage.setItem('daily-track-auth', 'true')
      setIsAuthenticated(true)
      setLoginError('')
      return
    }
    setLoginError('Kullanıcı adı veya şifre hatalı.')
  }

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(meeting))
  }, [meeting])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const destination = event.over?.id
    if (destination === 'unspoken' || destination === 'spoken') {
      const spoken = destination === 'spoken'
      setMeeting((current) => ({
        ...current,
        currentSpeakerId: null,
        participants: current.participants.map((person) => person.id === String(event.active.id) && !person.absent ? { ...person, spoken } : person),
      }))
    }
    setActiveId(null)
  }

  if (!isAuthenticated) {
    return (
      <main className="login-screen">
        <section className="login-card" aria-labelledby="login-heading">
          <a className="brand login-brand" href="#login" aria-label="Günlük akışı">
            <span className="brand-mark"><CircleDot size={19} strokeWidth={2.4} /></span>
            <span>günlük<span className="brand-light">akışı</span></span>
          </a>
          <p className="eyebrow">GÜNLÜK TOPLANTIM</p>
          <h1 className="login-title" id="login-heading">Giriş yap</h1>
          <p className="login-copy">Konuşma sırası takibine devam et.</p>
          <form className="login-form" onSubmit={handleLogin}>
            <div className="login-field">
              <label htmlFor="login-username">Kullanıcı adı</label>
              <input id="login-username" name="username" type="text" autoComplete="username" autoFocus required value={username} onChange={(event) => setUsername(event.target.value)} />
            </div>
            <div className="login-field">
              <label htmlFor="login-password">Şifre</label>
              <div className="login-password-wrap">
                <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
                <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'} title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            {loginError && <p className="login-error" role="alert">{loginError}</p>}
            <button className="login-submit" type="submit"><LockKeyhole size={17} /> Giriş yap</button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="tracker-screen">
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="participant-board">
          <ParticipantLane id="unspoken" title="Konuşmayanlar" people={unspokenPeople} />
          <ParticipantLane id="spoken" title="Konuşanlar" people={spokenPeople} />
        </div>
        <DragOverlay dropAnimation={null}>
          {activePerson ? <div className="name-chip is-overlay">{activePerson.name}</div> : null}
        </DragOverlay>
      </DndContext>
    </main>
  )
}

export default App