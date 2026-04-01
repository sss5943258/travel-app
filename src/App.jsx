import { useState, useEffect, useRef } from 'react'
import { MapPin, X, Info, Loader, MoreHorizontal, Plus, Pencil, Trash2 } from 'lucide-react'
import ScheduleFormModal from './components/ScheduleFormModal'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import { API_URL, TRIP_ID } from './config'
import './index.css'

// ─── 行程卡片右上角的「...」選單 ───────────────────────────────────
function CardMenu({ item, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // 點外面關閉
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="card-menu-wrap" ref={menuRef}>
      <button
        className="icon-btn"
        title="操作"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="card-menu-dropdown glass" onClick={(e) => e.stopPropagation()}>
          <button
            className="menu-item"
            onClick={() => { setOpen(false); onEdit(item) }}
          >
            <Pencil size={14} /> 編輯
          </button>
          <button
            className="menu-item danger"
            onClick={() => { setOpen(false); onDelete(item) }}
          >
            <Trash2 size={14} /> 刪除
          </button>
        </div>
      )}
    </div>
  )
}

// ─── 新增卡片（每天最後一張）──────────────────────────────────────
function AddCard({ onClick }) {
  return (
    <div className="card glass add-card" onClick={onClick}>
      <Plus size={24} />
      <span>新增行程</span>
    </div>
  )
}

// ─── 主元件 ───────────────────────────────────────────────────────
function App() {
  const [tripInfo, setTripInfo] = useState(null)
  const [journeys, setJourneys] = useState([])
  const [selectedDay, setSelectedDay] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // 備註 Modal
  const [remarkItem, setRemarkItem] = useState(null)

  // 編輯/新增 Modal
  const [formModal, setFormModal] = useState(null)
  // { mode: 'add', day, date } | { mode: 'edit', item }

  // 刪除確認 Modal
  const [deleteItem, setDeleteItem] = useState(null)

  const fetchTripData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}?action=getTripDetails&tripId=${TRIP_ID}`)
      if (!res.ok) throw new Error('網路請求發生錯誤')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTripInfo(data)
      setJourneys(data.journeys || [])
      if (data.journeys?.length > 0) setSelectedDay(data.journeys[0].day)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchTripData() }, [])

  if (isLoading) return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', height: '100vh' }}>
      <Loader size={32} style={{ marginRight: '10px', animation: 'spin 1s linear infinite' }} />
      <h2>正在載入行程，請稍候...</h2>
    </div>
  )

  if (error) return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', height: '100vh', flexDirection: 'column' }}>
      <h2>讀取失敗 🥲</h2>
      <p>{error}</p>
      <p style={{ marginTop: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>請確認你是否已經貼上正確的 API_URL !!</p>
    </div>
  )

  const currentJourney = journeys.find((j) => j.day === selectedDay) || journeys[0]

  return (
    <div className="app-container">
      <header className="header glass">
        <h1 className="title">{tripInfo?.name || '我的旅遊計畫'}</h1>
        <div className="date-selector">
          {journeys.map((j) => (
            <button
              key={j.day}
              className={`date-tab ${selectedDay === j.day ? 'active' : ''}`}
              onClick={() => setSelectedDay(j.day)}
            >
              Day {j.day}
              <span className="date-sub">{j.date.slice(5)}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="main-content">
        <div className="schedule-list">
          {currentJourney?.schedule?.map((item) => (
            <div
              key={item.id}
              className="card glass clickable"
              onClick={() => setRemarkItem(item)}
            >
              <div className="card-header">
                <span className="time">{item.startTime}{item.endTime ? ` - ${item.endTime}` : ''}</span>
                <div className="card-actions">
                  <button
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (item.googleMapLink) window.open(item.googleMapLink, '_blank')
                    }}
                    title="Google Maps"
                    style={{ opacity: item.googleMapLink ? 1 : 0.3, cursor: item.googleMapLink ? 'pointer' : 'default' }}
                  >
                    <MapPin size={18} />
                  </button>
                  <CardMenu
                    item={item}
                    onEdit={(it) => setFormModal({ mode: 'edit', item: it })}
                    onDelete={(it) => setDeleteItem(it)}
                  />
                </div>
              </div>
              <h3 className="attraction-name">{item.attractionName}</h3>
              <div className="card-footer">
                <Info size={14} />
                <span>點擊查看備註</span>
              </div>
            </div>
          ))}

          {(!currentJourney?.schedule || currentJourney.schedule.length === 0) && (
            <div className="card glass" style={{ textAlign: 'center', opacity: 0.7 }}>
              <h3 className="attraction-name">這天還沒有安排行程喔！</h3>
            </div>
          )}

          {/* 每天最後的新增卡片 */}
          <AddCard onClick={() => setFormModal({ mode: 'add', day: currentJourney?.day, date: currentJourney?.date })} />
        </div>
      </main>

      {/* 備註 Modal */}
      {remarkItem && (
        <div className="modal-overlay" onClick={() => setRemarkItem(null)}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setRemarkItem(null)}>
              <X size={20} />
            </button>
            <h2 className="modal-title">{remarkItem.attractionName}</h2>
            <p className="modal-text">{remarkItem.remark || '（無備註）'}</p>
          </div>
        </div>
      )}

      {/* 新增 / 編輯 Modal */}
      {formModal && (
        <ScheduleFormModal
          initialData={formModal.mode === 'edit' ? formModal.item : null}
          day={formModal.mode === 'add' ? formModal.day : formModal.item?.day}
          date={formModal.mode === 'add' ? formModal.date : formModal.item?.date}
          onClose={() => setFormModal(null)}
          onSaved={(savedItem) => {
            setJourneys(prev => prev.map(j => {
              const targetDay = formModal.mode === 'add' ? formModal.day : formModal.item?.day;
              if (j.day === targetDay) {
                let newSchedule;
                if (formModal.mode === 'edit') {
                  newSchedule = j.schedule.map(item => item.id === savedItem.id ? { ...item, ...savedItem } : item);
                } else {
                  newSchedule = [...(j.schedule || []), savedItem];
                }
                
                // 照開始時間排序 (空字串排最後面)
                newSchedule.sort((a, b) => {
                  const tA = a.startTime || '24:00';
                  const tB = b.startTime || '24:00';
                  return tA.localeCompare(tB);
                });

                return { ...j, schedule: newSchedule };
              }
              return j;
            }));
            setFormModal(null);
          }}
        />
      )}

      {/* 刪除確認 Modal */}
      {deleteItem && (
        <DeleteConfirmModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onDeleted={() => {
            setJourneys(prev => prev.map(j => ({
              ...j,
              schedule: j.schedule?.filter(item => item.id !== deleteItem.id) || []
            })));
            setDeleteItem(null);
          }}
        />
      )}
    </div>
  )
}

export default App
