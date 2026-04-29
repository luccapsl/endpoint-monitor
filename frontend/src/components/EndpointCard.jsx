import { useState, useEffect } from 'react';
import { deleteEndpoint, toggleEndpoint } from '../services/api';

const STATUS_STYLES = {
  up: 'bg-green-500/20 text-green-400 border-green-700',
  down: 'bg-red-500/20 text-red-400 border-red-700',
  degraded: 'bg-yellow-500/20 text-yellow-400 border-yellow-700',
};

const STATUS_DOT = {
  up: 'bg-green-400',
  down: 'bg-red-400',
  degraded: 'bg-yellow-400',
};

function asUtc(dateStr) {
  if (!dateStr) return null;
  return dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr) ? dateStr : dateStr + 'Z';
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diffS = Math.floor((Date.now() - new Date(asUtc(dateStr)).getTime()) / 1000);
  if (diffS < 5) return 'just now';
  if (diffS < 60) return `${diffS}s ago`;
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`;
  return `${Math.floor(diffS / 3600)}h ago`;
}

function formatCountdown(s) {
  if (s <= 0) return 'checking…';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export default function EndpointCard({ endpoint, onUpdate, onDelete, onEdit, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!endpoint.is_active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [endpoint.is_active]);

  const timeAgoStr = endpoint.last_checked_at ? timeAgo(endpoint.last_checked_at) : null;
  const timeLeft = (() => {
    if (!showCountdown || !endpoint.last_checked_at) return null;
    const next = new Date(asUtc(endpoint.last_checked_at)).getTime() + endpoint.check_interval_s * 1000;
    return Math.max(0, Math.ceil((next - Date.now()) / 1000));
  })();

  const hasStatus = !!endpoint.last_status;
  const statusStyle = hasStatus ? STATUS_STYLES[endpoint.last_status] : 'bg-gray-700/40 text-gray-400 border-gray-600';
  const dotColor = hasStatus ? STATUS_DOT[endpoint.last_status] : 'bg-gray-500';
  const statusLabel = hasStatus ? endpoint.last_status : 'checking…';

  const handleToggle = async () => {
    setToggling(true);
    try {
      const updated = await toggleEndpoint(endpoint.id_endpoint);
      onUpdate(updated);
    } finally {
      setToggling(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await deleteEndpoint(endpoint.id_endpoint);
      onDelete(endpoint.id_endpoint);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onDragEnd={onDragEnd}
      className={`bg-gray-800 rounded-xl p-4 border transition-all select-none
        ${endpoint.is_active ? 'border-gray-700' : 'border-gray-700/40 opacity-60'}
        ${isDragging ? 'opacity-30 scale-[0.97]' : ''}
        ${isDragOver && !isDragging ? 'ring-2 ring-blue-500' : ''}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-gray-600 shrink-0 cursor-grab" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/>
            <circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/>
            <circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/>
          </svg>
          <div className="min-w-0">
            <h3 className="text-white font-semibold truncate">{endpoint.name}</h3>
            <p className="text-gray-400 text-sm truncate">{endpoint.hostname}:{endpoint.port}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Type badge */}
          <span className="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-0.5 rounded uppercase">
            {endpoint.type}
          </span>
          {/* Active toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={endpoint.is_active ? 'Pause monitoring' : 'Resume monitoring'}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              endpoint.is_active ? 'bg-blue-600' : 'bg-gray-600'
            } ${toggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                endpoint.is_active ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Status row */}
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-sm mb-3 ${statusStyle}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor} ${endpoint.last_status === 'up' ? 'animate-pulse' : ''}`} />
        <span className="font-medium capitalize">{statusLabel}</span>
        {endpoint.last_latency_ms != null && (
          <span className="ml-auto text-xs opacity-75">{endpoint.last_latency_ms} ms</span>
        )}
      </div>

      {/* Countdown row */}
      {showCountdown && (
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3 px-1">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
          </svg>
          <span>
            {timeLeft === null
              ? 'Not yet checked'
              : `Next check in ${formatCountdown(timeLeft)}`}
          </span>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{timeAgoStr ? `Checked ${timeAgoStr}` : 'Not yet checked'}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCountdown((v) => !v)}
            title={showCountdown ? 'Hide countdown' : 'Show countdown'}
            className={`transition-colors px-1 ${showCountdown ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
          >
            ⏱
          </button>
          <button
            onClick={() => onEdit(endpoint)}
            className="text-gray-400 hover:text-white transition-colors px-1"
          >
            Edit
          </button>
          {confirmDelete ? (
            <span className="flex items-center gap-1">
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="text-red-400 hover:text-red-300 font-medium"
              >
                {deleting ? '…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-gray-400 hover:text-white ml-1"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-gray-400 hover:text-red-400 transition-colors px-1"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
