import { useState } from 'react'
import { X, Trash2, Loader } from 'lucide-react'
import { API_URL } from '../config'

export default function DeleteConfirmModal({ item, onClose, onDeleted }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState(null)

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'deleteSchedule', id: item.id }),
      })
      
      // no-cors 下直接假設成功
      onDeleted()
    } catch (err) {
      setError(err.message)
      setIsDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass delete-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="delete-icon-wrap">
          <Trash2 size={32} />
        </div>
        <h2 className="modal-title">確認刪除</h2>
        <p className="modal-text">
          確定要刪除「<strong>{item.attractionName}</strong>」嗎？
          <br />
          <span style={{ fontSize: '13px', opacity: 0.7 }}>此操作無法復原。</span>
        </p>

        {error && <p className="form-error" style={{ marginTop: '12px' }}>{error}</p>}

        <div className="form-actions" style={{ marginTop: '24px' }}>
          <button className="btn-cancel" onClick={onClose} disabled={isDeleting}>
            取消
          </button>
          <button className="btn-delete" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <Loader size={16} className="spin-icon" /> : <Trash2 size={16} />}
            {isDeleting ? '刪除中...' : '確認刪除'}
          </button>
        </div>
      </div>
    </div>
  )
}
