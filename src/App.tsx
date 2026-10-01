import { useEffect, useRef, useState } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { onValue, ref, runTransaction, set } from '@firebase/database'
import { CircleDot, RotateCcw } from 'lucide-react'
import { realtimeDatabase } from './firebase'
import './App.css'

type Participant = { id: string; name: string; spoken: boolean; absent: boolean; fixed: boolean }
type SavedMeeting = { participants: Participant[]; currentSpeakerId: string | null; elapsedSeconds: number; isRunning: boolean }

const storageKey = 'daily-track-meeting-v1'
const sharedRoomPath = 'rooms/daily-track'
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

function normalizeMeeting(value: unknown): SavedMeeting | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<SavedMeeting>
  if (!Array.isArray(raw.participants)) return null

  const savedParticipants = raw.participants
    .filter((person): person is Participant => Boolean(person) && typeof person.id === 'string' && typeof person.name === 'string')
    .map((person) => ({
      id: person.id,
      name: person.name,
      spoken: person.spoken === true,
      absent: person.absent === true,
      fixed: person.fixed === true,
    }))
  const fixedNames = new Set(teamNames)
  const customParticipants = savedParticipants
    .filter((person) => !fixedNames.has(person.name) && !legacySampleIds.has(person.id) && !person.id.startsWith('team-'))
    .map((person) => ({ ...person, fixed: false }))
  const participants = [...createTeamParticipants(savedParticipants), ...customParticipants]
  const currentSpeakerId = participants.some((person) => person.id === raw.currentSpeakerId) ? raw.currentSpeakerId ?? null : null

  return {
    participants,
    currentSpeakerId,
    elapsedSeconds: typeof raw.elapsedSeconds === 'number' && Number.isFinite(raw.elapsedSeconds) ? raw.elapsedSeconds : 0,
    isRunning: raw.isRunning === true,
  }
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
  const [activeId, setActiveId] = useState<string | null>(null)
  const meetingRef = useRef(meeting)
  const sharedRoomReady = useRef(!realtimeDatabase)
  const lastRemoteState = useRef<string | null>(null)
  const participants = meeting.participants.filter((person) => !person.absent)
  const unspokenPeople = participants.filter((person) => !person.spoken)
  const spokenPeople = participants.filter((person) => person.spoken)
  const activePerson = participants.find((person) => person.id === activeId)

  useEffect(() => {
    meetingRef.current = meeting
  }, [meeting])

  useEffect(() => {
    if (!realtimeDatabase) return
    const roomRef = ref(realtimeDatabase, sharedRoomPath)
    let initializedEmptyRoom = false
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        if (!initializedEmptyRoom) {
          initializedEmptyRoom = true
          void runTransaction(roomRef, (current) => current ?? meetingRef.current).catch((error: unknown) => {
            console.error('Ortak toplantı odası başlatılamadı.', error)
          })
        }
        return
      }

      const sharedMeeting = normalizeMeeting(snapshot.val())
      if (!sharedMeeting) {
        console.error('Ortak toplantı verisi geçersiz.')
        return
      }

      sharedRoomReady.current = true
      lastRemoteState.current = JSON.stringify(sharedMeeting)
      setMeeting(sharedMeeting)
    }, (error) => {
      console.error('Ortak toplantı odasına bağlanılamadı.', error)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    const serializedMeeting = JSON.stringify(meeting)
    localStorage.setItem(storageKey, serializedMeeting)

    if (!realtimeDatabase || !sharedRoomReady.current) return
    if (lastRemoteState.current === serializedMeeting) {
      lastRemoteState.current = null
      return
    }

    lastRemoteState.current = serializedMeeting
    void set(ref(realtimeDatabase, sharedRoomPath), meeting).catch((error: unknown) => {
      lastRemoteState.current = null
      console.error('Ortak toplantı değişikliği kaydedilemedi.', error)
    })
  }, [meeting])

  function resetMeeting() {
    setMeeting((current) => ({
      ...current,
      participants: current.participants.map((person) => ({ ...person, spoken: false, absent: false })),
      currentSpeakerId: null,
      elapsedSeconds: 0,
      isRunning: false,
    }))
  }

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

  return (
    <main className="tracker-screen">
      <header className="tracker-header">
        <div className="tracker-logo" aria-label="DailyTracker">
          <span className="tracker-logo-mark"><CircleDot size={19} strokeWidth={2.4} /></span>
          <span>DailyTracker</span>
        </div>
        <button className="tracker-reset" type="button" onClick={resetMeeting}>
          <RotateCcw size={16} /> Sıfırla
        </button>
      </header>
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