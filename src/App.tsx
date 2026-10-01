import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, ArrowUp, ArrowDown, Check, CircleCheck, CircleDot, CircleMinus, Clock3, Eye, EyeOff, Hand, LockKeyhole, LogOut, Pause, Pencil, Play, Plus, RotateCcw, UsersRound, X } from 'lucide-react'
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

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('tr-TR')).join('')
}

function formatTime(totalSeconds: number) {
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function App() {
  const [meeting, setMeeting] = useState(loadMeeting)
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('daily-track-auth') === 'true')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const { participants, currentSpeakerId, elapsedSeconds, isRunning } = meeting
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const presentParticipants = participants.filter((person) => !person.absent)
  const spokenCount = presentParticipants.filter((person) => person.spoken).length
  const waitingPeople = presentParticipants.filter((person) => !person.spoken && person.id !== currentSpeakerId)
  const currentSpeaker = participants.find((person) => person.id === currentSpeakerId)
  const completion = presentParticipants.length ? Math.round((spokenCount / presentParticipants.length) * 100) : 0

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

  function handleLogout() {
    sessionStorage.removeItem('daily-track-auth')
    setIsAuthenticated(false)
    setPassword('')
  }

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(meeting))
  }, [meeting])

  useEffect(() => {
    if (!isRunning) return
    const timer = window.setInterval(() => {
      setMeeting((current) => ({ ...current, elapsedSeconds: current.elapsedSeconds + 1 }))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isRunning])

  function giveFloor(id: string) {
    setMeeting((current) => {
      const person = current.participants.find((participant) => participant.id === id)
      return person && !person.absent && !person.spoken ? { ...current, currentSpeakerId: id } : current
    })
  }

  function markSpoken(id: string) {
    setMeeting((current) => ({
      ...current,
      participants: current.participants.map((person) => person.id === id ? { ...person, spoken: true } : person),
      currentSpeakerId: current.currentSpeakerId === id ? null : current.currentSpeakerId,
    }))
  }

  function toggleAttendance(id: string) {
    setMeeting((current) => ({
      ...current,
      participants: current.participants.map((person) => person.id === id && !person.spoken && current.currentSpeakerId !== id ? { ...person, absent: !person.absent } : person),
    }))
  }

  function addParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    setMeeting((current) => ({ ...current, participants: [...current.participants, { id: crypto.randomUUID(), name, spoken: false, absent: false, fixed: false }] }))
    setNewName('')
  }

  function removeParticipant(id: string) {
    setMeeting((current) => ({
      ...current,
      participants: current.participants.filter((person) => person.id !== id || person.fixed),
      currentSpeakerId: current.currentSpeakerId === id ? null : current.currentSpeakerId,
    }))
  }

  function moveParticipant(index: number, direction: -1 | 1) {
    setMeeting((current) => {
      if (current.participants[index]?.fixed) return current
      const targetIndex = index + direction
      const firstCustomIndex = current.participants.findIndex((person) => !person.fixed)
      if (targetIndex < firstCustomIndex || targetIndex >= current.participants.length) return current
      const reordered = [...current.participants]
      ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]
      return { ...current, participants: reordered }
    })
  }

  function resetMeeting() {
    setMeeting((current) => ({ ...current, participants: current.participants.map((person) => ({ ...person, spoken: false })), currentSpeakerId: null, elapsedSeconds: 0, isRunning: false }))
  }

  const dateLabel = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

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
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Günlük akışı ana sayfa">
          <span className="brand-mark"><CircleDot size={19} strokeWidth={2.4} /></span>
          <span>günlük<span className="brand-light">akışı</span></span>
        </a>
        <div className="topbar-meta"><span className="live-dot" /><span>TOPLANTI TAKİBİ</span><span className="meta-divider" /><span>{dateLabel}</span><button className="logout-button" type="button" onClick={handleLogout} aria-label="Oturumu kapat" title="Oturumu kapat"><LogOut size={15} /></button></div>
      </header>

      <section className="intro" id="top">
        <div><p className="eyebrow">GÜNLÜK TOPLANTIM</p><h1>Günlük akışı</h1><p className="intro-copy">Kim konuştu, sırada kim var? Takipte kal.</p></div>
        <button className="reset-button" type="button" onClick={resetMeeting}><RotateCcw size={16} /><span>Takibi sıfırla</span></button>
      </section>

      <section className="meeting-bar" aria-label="Toplantı süresi ve ilerleme">
        <div className="timer-block">
          <span className="timer-icon"><Clock3 size={18} /></span><span className="timer-value">{formatTime(elapsedSeconds)}</span><span className="timer-label">geçen süre</span>
          <button className="timer-toggle" type="button" onClick={() => setMeeting((current) => ({ ...current, isRunning: !current.isRunning }))} aria-label={isRunning ? 'Süreyi duraklat' : 'Süreyi başlat'} title={isRunning ? 'Duraklat' : 'Başlat'}>
            {isRunning ? <Pause size={15} /> : <Play size={15} />}
          </button>
        </div>
        <div className="progress-block">
          <div className="progress-copy"><span><strong>{spokenCount}</strong> / {presentParticipants.length} kişi konuştu</span><span>{completion}%</span></div>
          <div className="progress-track" role="progressbar" aria-label="Konuşan katılımcı oranı" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${completion}%` }} /></div>
        </div>
      </section>

      <div className="workspace">
        <section className="roster-section" aria-labelledby="roster-heading">
          <div className="section-heading"><div><p className="eyebrow">KATILIMCILAR</p><h2 id="roster-heading">Söz sırası</h2></div><span className="people-count"><UsersRound size={15} /> {participants.length}</span></div>
          <ol className="participant-list">
            {participants.map((person, index) => {
              const isSpeaking = person.id === currentSpeakerId
              return (
                <li className={`participant-row${isSpeaking ? ' is-speaking' : ''}${person.spoken ? ' is-spoken' : ''}${person.absent ? ' is-absent' : ''}`} key={person.id}>
                  <span className="order-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className={`avatar avatar-${index % 5}`}>{initials(person.name)}</span>
                  <span className="person-info">
                    {editingId === person.id ? <form className="rename-form" onSubmit={(event) => {
                      event.preventDefault()
                      const name = editName.trim()
                      if (name) setMeeting((current) => ({ ...current, participants: current.participants.map((entry) => entry.id === person.id ? { ...entry, name } : entry) }))
                      setEditingId(null)
                    }}>
                      <input aria-label={`${person.name} adını düzenle`} autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={60} />
                      <button type="submit" aria-label="Adı kaydet"><Check size={13} /></button>
                      <button type="button" aria-label="Düzenlemeyi iptal et" onClick={() => setEditingId(null)}><X size={13} /></button>
                    </form> : person.fixed ? <span className="person-name fixed-person-name">{person.name}</span> : <button className="person-name" type="button" onClick={() => { setEditName(person.name); setEditingId(person.id) }} title="Adı düzenle">{person.name}<Pencil size={12} /></button>}
                    <span className={`person-status${isSpeaking ? ' status-speaking' : ''}`}>
                    {person.absent ? <><CircleMinus size={13} /> Toplantıda yok</> : isSpeaking ? <><span className="speaking-wave" /> Şu an konuşuyor</> : person.spoken ? <><Check size={13} /> Konuştu</> : 'Henüz konuşmadı'}
                  </span></span>
                  <div className="row-controls">
                    <button className="order-control" type="button" onClick={() => moveParticipant(index, -1)} disabled={person.fixed || index === 0} aria-label={`${person.name} kişisini yukarı taşı`} title={person.fixed ? 'Sabit ekip sırası' : 'Yukarı taşı'}><ArrowUp size={15} /></button>
                    <button className="order-control" type="button" onClick={() => moveParticipant(index, 1)} disabled={person.fixed || index === participants.length - 1} aria-label={`${person.name} kişisini aşağı taşı`} title={person.fixed ? 'Sabit ekip sırası' : 'Aşağı taşı'}><ArrowDown size={15} /></button>
                  </div>
                  {isSpeaking ? <button className="done-button" type="button" onClick={() => markSpoken(person.id)}><Check size={15} /> Konuştu</button> : person.absent ? null : !person.spoken && !currentSpeaker ? <button className="give-button" type="button" onClick={() => giveFloor(person.id)}><Hand size={15} /> {spokenCount > 0 ? 'Sıradaki' : 'Şu an'}</button> : !person.spoken ? <span className="waiting-label">Henüz konuşmadı</span> : <span className="done-label"><Check size={15} /> Tamamlandı</span>}
                  <button className={`attendance-button${person.absent ? ' is-absent' : ''}`} type="button" onClick={() => toggleAttendance(person.id)} disabled={person.spoken || isSpeaking} aria-label={person.absent ? `${person.name} toplantıda yok; katıldı olarak işaretle` : `${person.name} kişisini toplantıda yok olarak işaretle`} title={person.spoken || isSpeaking ? 'Konuşma durumu işaretlendikten sonra değiştirilemez' : person.absent ? 'Katıldı olarak işaretle' : 'Toplantıda yok olarak işaretle'}>
                    {person.absent ? <><CircleCheck size={14} /> Var</> : <><CircleMinus size={14} /> Yok</>}
                  </button>
                  <button className="remove-button" type="button" onClick={() => removeParticipant(person.id)} disabled={person.fixed} aria-label={person.fixed ? `${person.name} sabit ekip üyesi` : `${person.name} kişisini kaldır`} title={person.fixed ? 'Sabit ekip üyesi' : 'Katılımcıyı kaldır'}><X size={15} /></button>
                </li>
              )
            })}
            {participants.length === 0 && <li className="empty-roster">Henüz katılımcı yok. İlk kişiyi aşağıdan ekle.</li>}
          </ol>
          <form className="add-form" onSubmit={addParticipant}>
            <label className="sr-only" htmlFor="participant-name">Katılımcı adı</label><Plus size={17} aria-hidden="true" />
            <input id="participant-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Yeni katılımcı ekle" maxLength={60} />
            <button type="submit" disabled={!newName.trim()}>Ekle</button>
          </form>
        </section>

        <aside className="next-panel" aria-labelledby="next-heading">
          <div className="next-panel-top"><span className="panel-icon"><Hand size={18} /></span><span className="eyebrow">{currentSpeaker ? 'ŞU AN KONUŞAN' : 'SÖZ SIRASI TAKİBİ'}</span></div>
          {participants.length === 0 ? <>
            <h2 id="next-heading">Önce <em>katılımcı ekle.</em></h2><p className="next-copy">Günlük turunu başlatmak için ekip arkadaşlarını listeye ekle.</p>
          </> : presentParticipants.length === 0 ? <>
            <h2 id="next-heading">Şu an <em>katılan yok.</em></h2><p className="next-copy">Toplantıda olan birini işaretlediğinde söz sırası burada görünür.</p>
          </> : currentSpeaker ? <>
            <h2 id="next-heading"><em>{currentSpeaker.name.split(' ')[0]}</em> konuşuyor.</h2>
            <p className="next-copy">Konuşması bitince “Konuştu” olarak işaretle; sonraki kişiyi listeden takip et.</p>
            <button className="panel-primary" type="button" onClick={() => markSpoken(currentSpeaker.id)}><Check size={17} /> Konuşması bitti</button>
          </> : waitingPeople.length > 0 ? <>
            <h2 id="next-heading">{spokenCount > 0 ? <>Sırada <em>kim var?</em></> : <>Şu an kim <em>konuşuyor?</em></>}</h2>
            <p className="next-copy">{spokenCount > 0 ? 'Konuşan kişiden sonra söz alan kişiyi seç. Konuşmuş kişiler listede görünmez.' : 'Şu anda konuşan kişiyi işaretle.'}</p>
            <ul className="handoff-list">
              {waitingPeople.map((person, index) => (
                <li className="handoff-option" key={person.id}>
                  <span className={`avatar avatar-${participants.findIndex((entry) => entry.id === person.id) % 5}`}>{initials(person.name)}</span>
                  <span className="handoff-name"><span className="handoff-order">{String(index + 1).padStart(2, '0')}</span>{person.name}</span>
                  <button className="handoff-button" type="button" onClick={() => giveFloor(person.id)} aria-label={spokenCount > 0 ? `${person.name} kişisini sıradaki konuşmacı olarak işaretle` : `${person.name} kişisinin şu an konuştuğunu işaretle`}>
                    {spokenCount > 0 ? 'Sıradaki' : 'Şu an konuşuyor'} <ArrowRight size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </> : <>
            <h2 id="next-heading">Herkes <em>konuştu.</em></h2><p className="next-copy">Bu toplantıda söz sırası tamamlandı.</p>
            <button className="panel-primary" type="button" onClick={resetMeeting}><RotateCcw size={16} /> Takibi yeniden başlat</button>
          </>}
          <div className="panel-footer"><span className="footer-dot" /> {waitingPeople.length} kişi daha bekliyor</div>
        </aside>
      </div>

      <footer className="page-footer"><span>KONUŞMA SIRASI TAKİBİ</span><span>Günlük akışı <span className="footer-separator">/</span> {dateLabel}</span></footer>
    </main>
  )
}

export default App