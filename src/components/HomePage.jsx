import { useState, useEffect } from 'react'
import { Loader, Plane, CheckSquare, ChevronRight } from 'lucide-react'
import { API_URL } from '../config'

function HomePage({ onSelectTrip, onOpenPackingList }) {
  const [trips, setTrips] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchTrips = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`${API_URL}?action=getTrips`)
        if (!res.ok) throw new Error('網路請求發生錯誤')
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setTrips(Array.isArray(data) ? data : [])
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTrips()
  }, [])

  if (isLoading) {
    return (
      <div className="home-container">
        <div className="home-loading">
          <Loader size={32} className="spin-icon" />
          <span>正在載入旅程清單...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="home-container">
        <div className="home-error">
          <h2>讀取失敗 🥲</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="home-container">
      <div className="home-inner">
        <header className="home-header">
          <Plane size={28} className="home-logo-icon" />
          <h1 className="home-title">我的旅遊計畫</h1>
          <p className="home-subtitle">選擇一趟旅程開始吧！</p>
        </header>

        <div className="home-buttons">
          {/* 旅行攜帶清單 */}
          <button
            className="home-btn glass packing-btn"
            onClick={onOpenPackingList}
          >
            <div className="home-btn-left">
              <div className="home-btn-icon packing-icon">
                <CheckSquare size={22} />
              </div>
              <div className="home-btn-text">
                <span className="home-btn-label">旅行攜帶清單</span>
                <span className="home-btn-desc">打包不遺漏</span>
              </div>
            </div>
            <ChevronRight size={20} className="home-btn-arrow" />
          </button>

          {/* 行程按鈕 */}
          {trips.map((trip, idx) => (
            <button
              key={trip.tripId || idx}
              className="home-btn glass trip-btn"
              onClick={() => onSelectTrip(trip.tripId)}
            >
              <div className="home-btn-left">
                <div className="home-btn-icon trip-icon">
                  <Plane size={22} />
                </div>
                <div className="home-btn-text">
                  <span className="home-btn-label">{trip.name}</span>
                  <span className="home-btn-desc">
                    {trip.startDate && trip.endDate
                      ? `${trip.startDate} ~ ${trip.endDate}`
                      : '點擊查看行程'}
                  </span>
                </div>
              </div>
              <ChevronRight size={20} className="home-btn-arrow" />
            </button>
          ))}

          {trips.length === 0 && (
            <div className="home-empty">
              <p>目前沒有任何行程</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HomePage
