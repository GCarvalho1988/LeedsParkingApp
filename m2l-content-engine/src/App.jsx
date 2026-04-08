import { useState, useEffect, useCallback } from 'react';
import { getCampaign, getDrafts } from './hooks/useApi.js';
import Calendar from './components/Calendar.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import StatusBar from './components/StatusBar.jsx';
import PhaseTimeline from './components/PhaseTimeline.jsx';
import EventManager from './components/EventManager.jsx';

function calcCurrentWeek(campaignStart) {
  const start = new Date(campaignStart);
  const today = new Date();
  const diff  = today - start;
  const week  = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(13, week));
}

function calcDaysUntilRide(rideDate) {
  const ride  = new Date(rideDate);
  const today = new Date();
  return Math.max(0, Math.ceil((ride - today) / (24 * 60 * 60 * 1000)));
}

export default function App() {
  const [campaign,      setCampaign]      = useState(null);
  const [drafts,        setDrafts]        = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [phaseFilter,   setPhaseFilter]   = useState(null);

  const refreshCampaign = useCallback(() => getCampaign().then(setCampaign), []);
  const refreshDrafts   = useCallback(() => getDrafts().then(setDrafts), []);

  useEffect(() => {
    refreshCampaign();
    refreshDrafts();
  }, []);

  if (!campaign) return <div className="loading">Loading…</div>;

  const weekNum       = calcCurrentWeek(campaign.campaign_start);
  const currentPhase  = campaign.phases.find(p => p.weeks.includes(weekNum)) ?? null;
  const daysUntilRide = calcDaysUntilRide(campaign.ride.date);

  const handleSaveDraft = (updated) => {
    setSelectedDraft(updated);
    refreshDrafts();
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="brand">M → L</h1>
          <p className="brand-sub">28 June 2026 · £1,000</p>
          <a
            href={campaign.ride.fundraising_url}
            target="_blank"
            rel="noopener noreferrer"
            className="fundraising-link"
          >
            ↗ JustGiving
          </a>
        </div>

        <StatusBar
          campaign={campaign}
          drafts={drafts}
          weekNum={weekNum}
          currentPhase={currentPhase}
          daysUntilRide={daysUntilRide}
          onCampaignUpdate={refreshCampaign}
        />

        <EventManager
          events={campaign.key_events}
          onEventsChange={refreshCampaign}
        />

        <div className="phase-legend">
          <div className="section-label">Phases</div>
          {campaign.phases.map(p => (
            <div key={p.id} className="phase-item">
              <div className={`phase-swatch phase-${p.id}`} />
              <span>{p.label} · Wk {p.weeks[0]}–{p.weeks[p.weeks.length - 1]}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="main">
        <PhaseTimeline
          phases={campaign.phases}
          activeFilter={phaseFilter}
          onFilterChange={setPhaseFilter}
        />
        <Calendar
          campaign={campaign}
          drafts={drafts}
          currentWeek={weekNum}
          phaseFilter={phaseFilter}
          onSelectDraft={setSelectedDraft}
          selectedDraft={selectedDraft}
        />
      </main>

      <DetailPanel
        draft={selectedDraft}
        onClose={() => setSelectedDraft(null)}
        onSave={handleSaveDraft}
      />
    </div>
  );
}
