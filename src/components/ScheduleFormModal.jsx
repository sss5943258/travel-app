import { useState, useEffect } from 'react'
import { X, Save, Loader } from 'lucide-react'
import { TimePicker } from 'antd'
import dayjs from 'dayjs'
import { API_URL } from '../config'

// initialData: 傳入代表編輯模式；null 代表新增模式
// day, date: 新增時需要
export default function ScheduleFormModal({ initialData, day, date, onClose, onSaved }) {
  const isEdit = !!initialData

  const [form, setForm] = useState({
    attractionName: '',
    startTime: '',
    endTime: '',
    remark: '',
    googleMapLink: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (initialData) {
      setForm({
        attractionName: initialData.attractionName || '',
        startTime: initialData.startTime || '',
        endTime: initialData.endTime || '',
        remark: initialData.remark || '',
        googleMapLink: initialData.googleMapLink || '',
      })
    }
  }, [initialData])

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.attractionName.trim()) {
      setError('名稱為必填欄位')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const body = isEdit
        ? { action: 'updateSchedule', id: initialData.id, ...form }
        : { action: 'addSchedule', tripId: 't-3', day, date, ...form }

      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body),
      })
      
      const newItem = {
        ...form,
        id: isEdit ? initialData.id : `t3-d${day}-${Date.now()}`,
        day: isEdit ? initialData.day : day,
        date: isEdit ? initialData.date : date
      }
      onSaved(newItem)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass form-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <h2 className="modal-title">{isEdit ? '編輯行程' : '新增行程'}</h2>
        {isEdit && <p className="modal-subtitle">Day {initialData.day} · {initialData.date}</p>}
        {!isEdit && <p className="modal-subtitle">Day {day} · {date}</p>}

        <form className="schedule-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>行程名稱 <span className="required">*</span></label>
            <input
              name="attractionName"
              value={form.attractionName}
              onChange={handleChange}
              placeholder="例：清水寺 (景點)"
              required
            />
          </div>

          <div className="form-group">
            <label>時間</label>
            <TimePicker.RangePicker 
              format="HH:mm"
              minuteStep={5}
              placeholder={['開始時間', '結束時間']}
              allowEmpty={[true, true]}
              value={[
                form.startTime ? dayjs(form.startTime, 'HH:mm') : null,
                form.endTime ? dayjs(form.endTime, 'HH:mm') : null
              ]}
              onChange={(dates, dateStrings) => {
                setForm(prev => ({
                  ...prev,
                  startTime: dateStrings ? dateStrings[0] : '',
                  endTime: dateStrings ? dateStrings[1] : ''
                }))
              }}
              style={{ 
                width: '100%', 
                padding: '0.6rem 0.85rem', 
                borderRadius: '10px', 
                border: '1.5px solid rgba(0, 0, 0, 0.12)',
                background: 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.95rem'
              }}
            />
          </div>

          <div className="form-group">
            <label>備註</label>
            <textarea
              name="remark"
              value={form.remark}
              onChange={handleChange}
              placeholder="補充說明、交通方式、注意事項..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Google Map 連結</label>
            <input
              name="googleMapLink"
              value={form.googleMapLink}
              onChange={handleChange}
              placeholder="https://maps.app.goo.gl/..."
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={isSaving}>
              取消
            </button>
            <button type="submit" className="btn-save" disabled={isSaving}>
              {isSaving ? <Loader size={16} className="spin-icon" /> : <Save size={16} />}
              {isSaving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
