import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Loader } from 'lucide-react'
import { API_URL } from '../config'

export default function TripInfoFormModal({ type, tripId, initialData, onClose, onSaved }) {
  const isFlight = type === 'outbound' || type === 'inbound'
  const prefix = type === 'outbound' ? 'outbound' : 'inbound'

  const [form, setForm] = useState({
    // Flight fields
    flightNo: '',
    airline: '',
    departureTime: '',
    arrivalTime: '',
    depAirport: '',
    arrAirport: '',
    flightRemark: '',
    // Remark field
    tripRemark: ''
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  // 輔助函式：將資料庫的 "YYYY-MM-DD HH:mm" 或 timezone 格式字串轉換成 input 需要的 "YYYY-MM-DDTHH:mm"
  const toDatetimeLocal = (val) => {
    if (!val) return ''
    const str = String(val).trim();
    if (!str) return '';
    
    // 如果是 ISO/Timezone 格式，將其解析並轉為本地時間格式 YYYY-MM-DDTHH:mm
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const yyyy = date.getFullYear();
      const MM = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const HH = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      return `${yyyy}-${MM}-${dd}T${HH}:${mm}`;
    }
    
    // 備用方案
    return str.replace(' ', 'T').slice(0, 16);
  }


  // 輔助函式：將 input 的 "YYYY-MM-DDTHH:mm" 轉換回資料庫的 "YYYY-MM-DD HH:mm"
  const fromDatetimeLocal = (val) => {
    if (!val) return ''
    return val.replace('T', ' ')
  }

  useEffect(() => {
    if (initialData) {
      if (isFlight) {
        setForm({
          flightNo: initialData[`${prefix}FlightNo`] || '',
          airline: initialData[`${prefix}Airline`] || '',
          departureTime: toDatetimeLocal(initialData[`${prefix}DepartureTime`]),
          arrivalTime: toDatetimeLocal(initialData[`${prefix}ArrivalTime`]),
          depAirport: initialData[`${prefix}DepAirport`] || '',
          arrAirport: initialData[`${prefix}ArrAirport`] || '',
          flightRemark: initialData.flightRemark || '',
          tripRemark: ''
        })
      } else {
        setForm({
          flightNo: '',
          airline: '',
          departureTime: '',
          arrivalTime: '',
          depAirport: '',
          arrAirport: '',
          flightRemark: '',
          tripRemark: initialData.tripRemark || ''
        })
      }
    }
  }, [type, initialData, prefix, isFlight])

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    let updateData = {}
    if (isFlight) {
      updateData = {
        [`${prefix}FlightNo`]: form.flightNo,
        [`${prefix}Airline`]: form.airline,
        [`${prefix}DepartureTime`]: fromDatetimeLocal(form.departureTime),
        [`${prefix}ArrivalTime`]: fromDatetimeLocal(form.arrivalTime),
        [`${prefix}DepAirport`]: form.depAirport,
        [`${prefix}ArrAirport`]: form.arrAirport,
        flightRemark: form.flightRemark
      }
    } else {
      updateData = {
        tripRemark: form.tripRemark
      }
    }

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'updateTripInfo',
          tripId,
          data: updateData
        }),
      })

      // Since Apps Script might return redirect or text, verify if we can parse it
      const responseText = await res.text()
      let result = {}
      try {
        result = JSON.parse(responseText)
      } catch (parseErr) {
        // Fallback for non-cors/redirects
      }

      if (result.status === 'error') {
        throw new Error(result.message || '更新失敗')
      }

      onSaved(updateData)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }


  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass form-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <h2 className="modal-title">
          {type === 'outbound' ? '編輯去程航班' : type === 'inbound' ? '編輯回程航班' : '編輯行程備註'}
        </h2>
        <p className="modal-subtitle">旅程資訊</p>

        <form className="schedule-form" onSubmit={handleSubmit}>
          {isFlight ? (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>航班編號</label>
                  <input
                    name="flightNo"
                    value={form.flightNo}
                    onChange={handleChange}
                    placeholder="例如：MM722"
                  />
                </div>
                <div className="form-group">
                  <label>航空公司</label>
                  <input
                    name="airline"
                    value={form.airline}
                    onChange={handleChange}
                    placeholder="例如：樂桃航空"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>起飛時間</label>
                <input
                  type="datetime-local"
                  name="departureTime"
                  value={form.departureTime}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>抵達時間</label>
                <input
                  type="datetime-local"
                  name="arrivalTime"
                  value={form.arrivalTime}
                  onChange={handleChange}
                />
              </div>


              <div className="form-row">
                <div className="form-group">
                  <label>起飛機場 / 地點</label>
                  <input
                    name="depAirport"
                    value={form.depAirport}
                    onChange={handleChange}
                    placeholder="例如：TPE (桃園)"
                  />
                </div>
                <div className="form-group">
                  <label>抵達機場 / 地點</label>
                  <input
                    name="arrAirport"
                    value={form.arrAirport}
                    onChange={handleChange}
                    placeholder="例如：NGO (名古屋)"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>班機備註</label>
                <textarea
                  name="flightRemark"
                  value={form.flightRemark}
                  onChange={handleChange}
                  placeholder="航班注意事項、行李重量限制等..."
                  rows={2}
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>行程備註</label>
              <textarea
                name="tripRemark"
                value={form.tripRemark}
                onChange={handleChange}
                placeholder="在此填寫行前準備、行程備忘等資訊..."
                rows={6}
              />
            </div>
          )}

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
    </div>,
    document.body
  )
}
