import { useState, useEffect } from 'react'
import { MapPin, X, Info, Loader } from 'lucide-react'
import './index.css'

// ⚠️ 請在這裡貼上你稍早部署拿到的 Google Apps Script 網址 !!
const API_URL = "https://script.google.com/macros/s/AKfycbxUrWLBBdYHdF4U6SYdYAfP6P6edxKCG_3xOirKQXDv0ZVyLRjw_suS4TN4bMDtDNF-5g/exec";
const TRIP_ID = "t-3"; // 預設撈取大阪行的資料

function App() {
  const [tripInfo, setTripInfo] = useState(null);
  const [journeys, setJourneys] = useState([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedRemark, setSelectedRemark] = useState(null);
  // 新增讀取狀態與錯誤狀態
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTripData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 設定 action=getTripDetails 並且帶上你要看的 tripId
        const response = await fetch(`${API_URL}?action=getTripDetails&tripId=${TRIP_ID}`);
        if (!response.ok) throw new Error("網路請求發生錯誤");

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        // 將 API 回傳的完整標題、時間等資料存入 tripInfo
        setTripInfo(data);
        // data.journeys 是原本你在 mockData 的那個巢狀陣列！
        setJourneys(data.journeys || []);

        // 預設跳到行程的第一天
        if (data.journeys && data.journeys.length > 0) {
          setSelectedDay(data.journeys[0].day);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTripData();
  }, []); // 空陣列表示只在 component 初次載入時執行一次

  const handleCardClick = (remark) => {
    setSelectedRemark(remark);
  };

  const closeModal = () => {
    setSelectedRemark(null);
  };

  // 如果還在讀圖，顯示讀取畫面
  if (isLoading) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', height: '100vh' }}>
        <Loader className="animate-spin" size={32} style={{ marginRight: '10px', animation: 'spin 1s linear infinite' }} />
        <h2>正在載入行程，請稍候...</h2>
      </div>
    );
  }

  // 如果發生錯誤，顯示錯誤提示
  if (error) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', height: '100vh', flexDirection: 'column' }}>
        <h2>讀取失敗 🥲</h2>
        <p>{error}</p>
        <p style={{ marginTop: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>請確認你是否已經貼上正確的 API_URL !!</p>
      </div>
    );
  }

  const currentJourney = journeys.find(j => j.day === selectedDay) || journeys[0];

  return (
    <div className="app-container">
      <header className="header glass">
        {/* 動態顯示 Google Sheets 上的旅程名稱 */}
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
              onClick={() => handleCardClick(item.remark)}
            >
              <div className="card-header">
                <span className="time">{item.startTime} - {item.endTime}</span>
                <button
                  className="map-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(item.googleMapLink, '_blank');
                  }}
                  title="Google Maps"
                >
                  <MapPin size={18} />
                </button>
              </div>
              <h3 className="attraction-name">{item.attractionName}</h3>
              <div className="card-footer">
                <Info size={14} />
                <span>點擊查看備註</span>
              </div>
            </div>
          ))}
          {(!currentJourney || !currentJourney.schedule || currentJourney.schedule.length === 0) && (
            <div className="card glass" style={{ textAlign: 'center', opacity: 0.7 }}>
              <h3 className="attraction-name">這天還沒有安排行程喔！</h3>
            </div>
          )}
        </div>
      </main>

      {selectedRemark && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closeModal}>
              <X size={20} />
            </button>
            <h2 className="modal-title">行程備註</h2>
            <p className="modal-text">{selectedRemark}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
