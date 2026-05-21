import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, X, Info, Loader, MoreHorizontal, Plus, Pencil, Trash2 } from 'lucide-react'
import ScheduleFormModal from './components/ScheduleFormModal'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import { API_URL, TRIP_ID } from './config'
import './index.css'

import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── 行程卡片右上角的「...」選單 ───────────────────────────────────
function CardMenu({ item, onEdit, onDelete, onAddBackup }) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const handleToggle = (e) => {
    e.stopPropagation()
    if (open) { setOpen(false); return }
    const r = btnRef.current.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 6, left: Math.max(4, r.right - 150) })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    // capture phase + target check：點選單內部不關閉，點外部才關
    const close = (e) => {
      if (menuRef.current?.contains(e.target)) return
      if (btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [open])

  return (
    <div className="card-menu-wrap">
      <button ref={btnRef} className="icon-btn" title="操作" onClick={handleToggle}>
        <MoreHorizontal size={18} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="card-menu-dropdown glass"
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
        >
          <button className="menu-item" onClick={() => { setOpen(false); onAddBackup(item) }}>
            <Plus size={14} /> 新增備案
          </button>
          <button className="menu-item" onClick={() => { setOpen(false); onEdit(item) }}>
            <Pencil size={14} /> 編輯
          </button>
          <button className="menu-item danger" onClick={() => { setOpen(false); onDelete(item) }}>
            <Trash2 size={14} /> 刪除
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── 單張行程卡片 (不會被 dnd-kit 包裝，由外層負責拖曳) ──────────────────────────
function Card({ item, onClick, onMap, onEdit, onDelete, onAddBackup }) {
  return (
    <div className="card glass clickable" onClick={onClick}>
      <div className="card-header">
        <span className="time">{item.startTime}{item.endTime ? ` - ${item.endTime}` : ''}</span>
        <div className="card-actions" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          {item.altOrder > 0 && <span style={{ fontSize: '0.75rem', color: '#FF9EAE', marginRight: '6px', fontWeight: '800' }}>#備案 {item.altOrder}</span>}
          <button
            className="icon-btn"
            onClick={onMap}
            title="Google Maps"
            style={{ opacity: item.googleMapLink ? 1 : 0.3, cursor: item.googleMapLink ? 'pointer' : 'default' }}
          >
            <MapPin size={18} />
          </button>
          <CardMenu item={item} onEdit={onEdit} onDelete={onDelete} onAddBackup={onAddBackup} />
        </div>
      </div>
      <h3 className="attraction-name">{item.attractionName}</h3>
      <div className="card-footer">
        <Info size={14} />
        <span>點擊查看備註</span>
      </div>
    </div>
  )
}

// ─── 可拖曳的群組元件 (包覆卡片與備案) ──────────────────────────────────
function SortableGroup({ id, groupItems, onClick, onMap, onEdit, onDelete, onAddBackup }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
    position: 'relative',
    touchAction: 'pan-x',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="sortable-group">
      {/* 水平捲動區域 — touch-action: pan-x 讓左右滑動生效，上下拖曳交由 dnd-kit */}
      <div className="horizontal-scroll">
        {groupItems.map((item, idx) => (
          <div key={item.id} className="card-wrapper">
            <Card
              item={item}
              altCount={idx === 0 ? groupItems.length - 1 : 0}
              onClick={() => onClick(item)}
              onMap={(e) => onMap(e, item)}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
              onAddBackup={() => onAddBackup(item)}
            />
          </div>
        ))}
      </div>
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

  const [remarkItem, setRemarkItem] = useState(null)
  const [formModal, setFormModal] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const jIdx = journeys.findIndex((j) => j.day === selectedDay)
    if (jIdx === -1) return

    const currentJ = journeys[jIdx]
    const schedule = currentJ.schedule || []

    const groupMap = new Map()
    schedule.forEach(item => {
      const gid = item.groupId || item.id
      if (!groupMap.has(gid)) groupMap.set(gid, [])
      groupMap.get(gid).push(item)
    })

    const groupIds = Array.from(groupMap.keys()).sort((gidA, gidB) => {
      const pA = groupMap.get(gidA).find(i => Number(i.altOrder) === 0) || groupMap.get(gidA)[0]
      const pB = groupMap.get(gidB).find(i => Number(i.altOrder) === 0) || groupMap.get(gidB)[0]
      return (pA.sortOrder ?? 999) - (pB.sortOrder ?? 999)
    })

    const oldIndex = groupIds.indexOf(active.id)
    const newIndex = groupIds.indexOf(over.id)
    
    if (oldIndex === -1 || newIndex === -1) return

    const newGroupOrder = arrayMove(groupIds, oldIndex, newIndex)

    const newSchedule = []
    newGroupOrder.forEach((gid, index) => {
      const items = groupMap.get(gid)
      items.forEach(it => {
        newSchedule.push({ ...it, sortOrder: index }) // 建立新物件，避免 mutate 原始資料
      })
    })

    setJourneys((prev) => {
      const draft = [...prev]
      draft[jIdx] = { ...draft[jIdx], schedule: newSchedule }
      return draft
    })

    try {
      await fetch(`${API_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'updateScheduleOrder',
          tripId: TRIP_ID,
          day: selectedDay,
          orderedIds: newGroupOrder
        })
      })
    } catch (err) {
      console.error('更新順序失敗:', err)
    }
  }

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

  if (isLoading) return <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', height: '100vh' }}><Loader size={32} style={{ marginRight: '10px', animation: 'spin 1s linear infinite' }} /><h2>正在載入行程，請稍候...</h2></div>
  if (error) return <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', height: '100vh', flexDirection: 'column' }}><h2>讀取失敗 🥲</h2><p>{error}</p><p style={{ marginTop: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>請確認你是否已經貼上正確的 API_URL !!</p></div>

  const currentJourney = journeys.find((j) => j.day === selectedDay) || journeys[0]

  // === 分組備案資料 ===
  const scheduleGroups = [];
  if (currentJourney?.schedule) {
    const groupMap = new Map();
    currentJourney.schedule.forEach(item => {
      const gid = item.groupId || item.id;
      if (!groupMap.has(gid)) groupMap.set(gid, []);
      groupMap.get(gid).push(item);
    });

    const sortedGroupIds = Array.from(groupMap.keys()).sort((gidA, gidB) => {
      const pA = groupMap.get(gidA).find(i => Number(i.altOrder) === 0) || groupMap.get(gidA)[0];
      const pB = groupMap.get(gidB).find(i => Number(i.altOrder) === 0) || groupMap.get(gidB)[0];
      return (pA.sortOrder ?? 999) - (pB.sortOrder ?? 999);
    });

    sortedGroupIds.forEach(gid => {
      const gItems = groupMap.get(gid);
      gItems.sort((a, b) => (Number(a.altOrder) || 0) - (Number(b.altOrder) || 0));
      scheduleGroups.push({ id: gid, items: gItems });
    });
  }

  const handleMap = (e, item) => {
    e.stopPropagation()
    if (item.googleMapLink) window.open(item.googleMapLink, '_blank')
  }

  const handleAddBackup = (item) => {
    const groupItems = scheduleGroups.find(g => g.id === (item.groupId || item.id))?.items || [];
    const maxAltOrder = Math.max(0, ...groupItems.map(i => i.altOrder || 0));
    setFormModal({
      mode: 'addBackup',
      item,
      day: item.day,
      date: item.date,
      groupId: item.groupId || item.id,
      altOrder: maxAltOrder + 1
    });
  }

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
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <SortableContext items={scheduleGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
              {scheduleGroups.map((group) => (
                <SortableGroup
                  key={group.id}
                  id={group.id}
                  groupItems={group.items}
                  onClick={(item) => setRemarkItem(item)}
                  onMap={handleMap}
                  onEdit={(it) => setFormModal({ mode: 'edit', item: it })}
                  onDelete={(it) => setDeleteItem(it)}
                  onAddBackup={handleAddBackup}
                />
              ))}
            </SortableContext>
          </DndContext>

          {(!scheduleGroups || scheduleGroups.length === 0) && (
            <div className="add-card-container" style={{ textAlign: 'center', opacity: 0.7 }}>
              <div className="card glass">
                <h3 className="attraction-name">這天還沒有安排行程喔！</h3>
              </div>
            </div>
          )}

          <div className="add-card-container">
            <AddCard onClick={() => setFormModal({ mode: 'add', day: currentJourney?.day, date: currentJourney?.date })} />
          </div>
        </div>
      </main>

      {remarkItem && (
        <div className="modal-overlay" onClick={() => setRemarkItem(null)}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setRemarkItem(null)}><X size={20} /></button>
            <h2 className="modal-title">{remarkItem.attractionName}</h2>
            <p className="modal-text">{remarkItem.remark || '（無備註）'}</p>
          </div>
        </div>
      )}

      {formModal && (
        <ScheduleFormModal
          mode={formModal.mode}
          item={formModal.item}
          day={formModal.mode === 'add' ? formModal.day : formModal.item?.day}
          date={formModal.mode === 'add' ? formModal.date : formModal.item?.date}
          groupId={formModal.groupId}
          altOrder={formModal.altOrder}
          onClose={() => setFormModal(null)}
          onSaved={(savedItem) => {
            setJourneys(prev => prev.map(j => {
              if (j.day === savedItem.day) {
                let newSchedule;
                if (formModal.mode === 'edit') {
                  newSchedule = j.schedule.map(si => si.id === savedItem.id ? { ...si, ...savedItem } : si);
                } else {
                  newSchedule = [...(j.schedule || []), savedItem];
                }
                return { ...j, schedule: newSchedule };
              }
              return j;
            }));
            setFormModal(null);
          }}
        />
      )}

      {deleteItem && (
        <DeleteConfirmModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onDeleted={() => {
            setJourneys(prev => prev.map(j => ({ ...j, schedule: j.schedule?.filter(si => si.id !== deleteItem.id) || [] })));
            setDeleteItem(null);
          }}
        />
      )}
    </div>
  )
}

export default App
