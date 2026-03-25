import { useState, useEffect } from 'react'
import { MapPin, X, Info } from 'lucide-react'
import { journeys } from './data/mockJourney'
import './index.css'

function App() {
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedRemark, setSelectedRemark] = useState(null);

  const handleCardClick = (remark) => {
    setSelectedRemark(remark);
  };

  const closeModal = () => {
    setSelectedRemark(null);
  };

  const currentJourney = journeys.find(j => j.day === selectedDay) || journeys[0];

  return (
    <div className="app-container">
      <header className="header glass">
        <h1 className="title">Osaka Trip 2026</h1>
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
          {currentJourney.schedule.map((item) => (
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
