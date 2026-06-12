import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, X, Info, Loader, MoreHorizontal, Plus, Pencil, Trash2, Share2 } from 'lucide-react'
import ScheduleFormModal from './components/ScheduleFormModal'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import HomePage from './components/HomePage'
import { API_URL } from './config'
import './index.css'

import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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

  const isCoreFlight = item.id.startsWith('info-outbound') || item.id.startsWith('info-inbound')

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
          {!isCoreFlight && (
            <button className="menu-item" onClick={() => { setOpen(false); onAddBackup(item) }}>
              <Plus size={14} /> 新增備案
            </button>
          )}
          <button className="menu-item" onClick={() => { setOpen(false); onEdit(item) }}>
            <Pencil size={14} /> 編輯
          </button>
          {!isCoreFlight && (
            <button className="menu-item danger" onClick={() => { setOpen(false); onDelete(item) }}>
              <Trash2 size={14} /> 刪除
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── 分享選單元件 ───────────────────────────────────────────────────
function ShareMenu({ onShareLink, onShareText, onShareCSV }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const btnRef = useRef(null)

  const handleToggle = (e) => {
    e.stopPropagation()
    setOpen(!open)
  }

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (menuRef.current?.contains(e.target)) return
      if (btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="share-menu-wrap" style={{ position: 'relative' }}>
      <button ref={btnRef} className="icon-btn share-btn" title="分享行程" onClick={handleToggle}>
        <Share2 size={20} />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="card-menu-dropdown glass share-dropdown"
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100 }}
        >
          <button className="menu-item" onClick={() => { setOpen(false); onShareLink() }}>
            分享行程
          </button>
          <button className="menu-item" onClick={() => { setOpen(false); onShareText() }}>
            分享文字行程
          </button>
          <button className="menu-item" onClick={() => { setOpen(false); onShareCSV() }}>
            分享 CSV
          </button>
        </div>
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
  const containerRef = useRef(null)

  const handleRef = (node) => {
    setNodeRef(node)
    containerRef.current = node
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let timer = null
    let touchActionApplied = false
    let startX = 0
    let startY = 0

    const handleStart = (e) => {
      if (timer) clearTimeout(timer)
      touchActionApplied = false
      const touch = e.touches?.[0]
      if (touch) {
        startX = touch.clientX
        startY = touch.clientY
      }
      timer = setTimeout(() => {
        el.style.touchAction = 'none'
        touchActionApplied = true
        timer = null
      }, 150) // 150ms 延遲判定為長按
    }

    const handleMove = (e) => {
      if (!touchActionApplied) {
        const touch = e.touches?.[0]
        if (touch) {
          const deltaX = Math.abs(touch.clientX - startX)
          const deltaY = Math.abs(touch.clientY - startY)
          // 若移動距離大於 6px，視為使用者想滾動，取消長按判定並保持可滾動
          if (deltaX > 6 || deltaY > 6) {
            if (timer) {
              clearTimeout(timer)
              timer = null
            }
            el.style.touchAction = ''
          }
        }
      }
    }

    const handleEnd = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      touchActionApplied = false
      el.style.touchAction = ''
    }

    el.addEventListener('touchstart', handleStart, { passive: true })
    el.addEventListener('touchmove', handleMove, { passive: true })
    el.addEventListener('touchend', handleEnd, { passive: true })
    el.addEventListener('touchcancel', handleEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleStart)
      el.removeEventListener('touchmove', handleMove)
      el.removeEventListener('touchend', handleEnd)
      el.removeEventListener('touchcancel', handleEnd)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
    position: 'relative',
  }

  return (
    <div ref={handleRef} style={style} {...attributes} {...listeners} className="sortable-group">
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
  const [currentPage, setCurrentPage] = useState('home') // 'home' | 'trip'
  const [activeTripId, setActiveTripId] = useState(null)

  const handleSelectTrip = (tripId) => {
    setActiveTripId(tripId)
    setCurrentPage('trip')
  }

  const handleOpenPackingList = () => {
    // TODO: 攜帶清單頁面
    alert('攜帶清單功能即將推出！')
  }

  const handleBackToHome = () => {
    setCurrentPage('home')
    setActiveTripId(null)
  }

  if (currentPage === 'home') {
    return <HomePage onSelectTrip={handleSelectTrip} onOpenPackingList={handleOpenPackingList} />
  }

  return <TripPage tripId={activeTripId} onBack={handleBackToHome} />
}

// ─── 行程頁面（原本的 App 邏輯）───────────────────────────────────
function TripPage({ tripId, onBack }) {
  const [tripInfo, setTripInfo] = useState(null)
  const [journeys, setJourneys] = useState([])
  const [selectedDay, setSelectedDay] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [remarkItem, setRemarkItem] = useState(null)
  const [formModal, setFormModal] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
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
          tripId: tripId,
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
      const res = await fetch(`${API_URL}?action=getTripDetails&tripId=${tripId}`)
      if (!res.ok) throw new Error('網路請求發生錯誤')
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      let updatedJourneys = data.journeys || []
      const hasDayZero = updatedJourneys.some(j => j.day === 0)
      const outboundId = `info-outbound-${tripId}`
      const inboundId = `info-inbound-${tripId}`

      if (!hasDayZero) {
        const dayZero = {
          day: 0,
          date: '旅程資訊',
          schedule: [
            {
              id: outboundId,
              groupId: outboundId,
              day: 0,
              date: '旅程資訊',
              startTime: '09:00',
              endTime: '12:00',
              attractionName: '去程航班',
              remark: '請點擊編輯輸入去程航班資訊（航班編號、起飛時間等）',
              googleMapLink: '',
              altOrder: 0,
              sortOrder: 0,
              isDefaultPlaceholder: true
            },
            {
              id: inboundId,
              groupId: inboundId,
              day: 0,
              date: '旅程資訊',
              startTime: '15:00',
              endTime: '18:00',
              attractionName: '回程航班',
              remark: '請點擊編輯輸入回程航班資訊（航班編號、起飛時間等）',
              googleMapLink: '',
              altOrder: 0,
              sortOrder: 1,
              isDefaultPlaceholder: true
            }
          ]
        }
        updatedJourneys = [dayZero, ...updatedJourneys]
      } else {
        const dayZero = updatedJourneys.find(j => j.day === 0)
        const hasOutbound = dayZero.schedule.some(s => s.id === outboundId)
        const hasInbound = dayZero.schedule.some(s => s.id === inboundId)

        if (!hasOutbound) {
          dayZero.schedule.push({
            id: outboundId,
            groupId: outboundId,
            day: 0,
            date: '旅程資訊',
            startTime: '09:00',
            endTime: '12:00',
            attractionName: '去程航班',
            remark: '請點擊編輯輸入去程航班資訊（航班編號、起飛時間等）',
            googleMapLink: '',
            altOrder: 0,
            sortOrder: 0,
            isDefaultPlaceholder: true
          })
        }
        if (!hasInbound) {
          dayZero.schedule.push({
            id: inboundId,
            groupId: inboundId,
            day: 0,
            date: '旅程資訊',
            startTime: '15:00',
            endTime: '18:00',
            attractionName: '回程航班',
            remark: '請點擊編輯輸入回程航班資訊（航班編號、起飛時間等）',
            googleMapLink: '',
            altOrder: 0,
            sortOrder: 1,
            isDefaultPlaceholder: true
          })
        }
        dayZero.schedule.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
      }

      setTripInfo(data)
      setJourneys(updatedJourneys)
      setSelectedDay(0)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchTripData() }, [tripId])

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

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: tripInfo?.name || '我的旅遊計畫',
        url: window.location.href
      }).catch(err => console.log('Share canceled or failed:', err))
    } else {
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert('已複製行程連結到剪貼簿！'))
        .catch(() => alert('複製連結失敗，請手動複製網址。'))
    }
  }

  const handleShareText = () => {
    const text = journeys.map(j => {
      const dateStr = j.date;
      const dayHeader = `Day ${j.day} (${dateStr})`;
      
      const schedule = j.schedule || [];
      const groupMap = new Map();
      schedule.forEach(item => {
        const gid = item.groupId || item.id;
        if (!groupMap.has(gid)) groupMap.set(gid, []);
        groupMap.get(gid).push(item);
      });
      
      const sortedGids = Array.from(groupMap.keys()).sort((gidA, gidB) => {
        const pA = groupMap.get(gidA).find(i => Number(i.altOrder) === 0) || groupMap.get(gidA)[0];
        const pB = groupMap.get(gidB).find(i => Number(i.altOrder) === 0) || groupMap.get(gidB)[0];
        return (pA.sortOrder ?? 999) - (pB.sortOrder ?? 999);
      });
      
      const dayBody = sortedGids.map(gid => {
        const items = groupMap.get(gid);
        items.sort((a, b) => (Number(a.altOrder) || 0) - (Number(b.altOrder) || 0));
        
        return items.map(item => {
          const time = item.startTime + (item.endTime ? ` - ${item.endTime}` : '');
          const prefix = item.altOrder > 0 ? `  [備案 ${item.altOrder}]` : '-';
          const remarkStr = item.remark ? ` (${item.remark})` : '';
          return `${prefix} ${time} ${item.attractionName}${remarkStr}`;
        }).join('\n');
      }).join('\n');
      
      return `${dayHeader}\n${dayBody || '(無行程)'}`;
    }).join('\n\n');
    
    const title = tripInfo?.name || '我的旅遊計畫';
    const fullText = `--- ${title} ---\n\n${text}`;
    
    navigator.clipboard.writeText(fullText)
      .then(() => alert('已複製文字行程到剪貼簿！'))
      .catch(() => alert('複製失敗，請重試。'));
  }

  const handleShareCSV = () => {
    const headers = ['天數', '日期', '時間', '景點名稱', '是否為備案', '備忘/備註'];
    const rows = [];
    
    journeys.forEach(j => {
      const schedule = j.schedule || [];
      const groupMap = new Map();
      schedule.forEach(item => {
        const gid = item.groupId || item.id;
        if (!groupMap.has(gid)) groupMap.set(gid, []);
        groupMap.get(gid).push(item);
      });
      
      const sortedGids = Array.from(groupMap.keys()).sort((gidA, gidB) => {
        const pA = groupMap.get(gidA).find(i => Number(i.altOrder) === 0) || groupMap.get(gidA)[0];
        const pB = groupMap.get(gidB).find(i => Number(i.altOrder) === 0) || groupMap.get(gidB)[0];
        return (pA.sortOrder ?? 999) - (pB.sortOrder ?? 999);
      });
      
      sortedGids.forEach(gid => {
        const items = groupMap.get(gid);
        items.sort((a, b) => (Number(a.altOrder) || 0) - (Number(b.altOrder) || 0));
        
        items.forEach(item => {
          const time = item.startTime + (item.endTime ? ` - ${item.endTime}` : '');
          rows.push([
            `Day ${j.day}`,
            j.date,
            time,
            item.attractionName,
            item.altOrder > 0 ? `是 (備案 ${item.altOrder})` : '否',
            item.remark || ''
          ]);
        });
      });
    });
    
    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${tripInfo?.name || 'travel_plan'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="app-container">
      <header className="header glass">
        <div className="header-top">
          <button className="back-btn" onClick={onBack} title="回首頁">
            ←
          </button>
          <h1 className="title" title={tripInfo?.name || '我的旅遊計畫'}>
            {tripInfo?.name || '我的旅遊計畫'}
          </h1>
          <ShareMenu
            onShareLink={handleShareLink}
            onShareText={handleShareText}
            onShareCSV={handleShareCSV}
          />
        </div>
        <div className="date-selector">
          {journeys.map((j) => {
            if (j.day === 0) {
              return (
                <button
                  key={j.day}
                  className={`date-tab ${selectedDay === j.day ? 'active' : ''}`}
                  onClick={() => setSelectedDay(j.day)}
                >
                  旅程資訊
                  <span className="date-sub">航班資訊</span>
                </button>
              )
            }
            return (
              <button
                key={j.day}
                className={`date-tab ${selectedDay === j.day ? 'active' : ''}`}
                onClick={() => setSelectedDay(j.day)}
              >
                Day {j.day}
                <span className="date-sub">{j.date ? j.date.slice(5) : ''}</span>
              </button>
            )
          })}
        </div>
      </header>

      <main className="main-content">
        <div className="schedule-list">
          {selectedDay === 0 ? (
            scheduleGroups.map((group) => (
              <div key={group.id} className="sortable-group">
                <div className="horizontal-scroll">
                  {group.items.map((item) => (
                    <div key={item.id} className="card-wrapper">
                      <Card
                        item={item}
                        onClick={() => setRemarkItem(item)}
                        onMap={(e) => handleMap(e, item)}
                        onEdit={() => setFormModal({ mode: 'edit', item })}
                        onDelete={() => setDeleteItem(item)}
                        onAddBackup={handleAddBackup}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
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
          )}

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
          tripId={tripId}
          onClose={() => setFormModal(null)}
          onSaved={(savedItem) => {
            setJourneys(prev => prev.map(j => {
              if (j.day === savedItem.day) {
                let newSchedule;
                if (formModal.mode === 'edit') {
                  newSchedule = j.schedule.map(si => si.id === savedItem.id ? { ...si, ...savedItem, isDefaultPlaceholder: false } : si);
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
