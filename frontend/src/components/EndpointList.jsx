import { useState, useRef, useMemo, useEffect } from 'react';
import EndpointCard from './EndpointCard';
import EndpointForm from './EndpointForm';

const STORAGE_KEY = 'endpoint-order';

function loadOrder() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

export default function EndpointList({
  endpoints,
  onEndpointCreated,
  onEndpointUpdated,
  onEndpointDeleted,
  onViewDetail,
  // Optional: Dashboard can set triggerEdit to an endpoint object to open its
  // edit form from outside (e.g. from the EndpointDetail drawer's Edit button).
  triggerEdit,
  onTriggerEditConsumed,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [orderedIds, setOrderedIds] = useState(loadOrder);
  const [draggingId, setDraggingId] = useState(null);
  const [overId, setOverId] = useState(null);
  const dragIdRef = useRef(null);

  const sorted = useMemo(() => {
    const map = new Map(endpoints.map((e) => [e.id_endpoint, e]));
    const known = orderedIds.filter((id) => map.has(id));
    const knownSet = new Set(known);
    const remaining = endpoints.filter((e) => !knownSet.has(e.id_endpoint));
    return [...known.map((id) => map.get(id)), ...remaining];
  }, [endpoints, orderedIds]);

  const openCreate = () => { setEditTarget(null); setShowForm(true); };
  const openEdit = (ep) => { setEditTarget(ep); setShowForm(true); };

  // Respond to external edit requests (e.g. from EndpointDetail's Edit button)
  useEffect(() => {
    if (!triggerEdit) return;
    openEdit(triggerEdit);
    onTriggerEditConsumed?.();
  }, [triggerEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaved = (saved) => {
    if (editTarget) { onEndpointUpdated(saved); }
    else { onEndpointCreated(saved); }
    setShowForm(false);
    setEditTarget(null);
  };

  const handleCancel = () => { setShowForm(false); setEditTarget(null); };

  const handleDragStart = (id) => {
    dragIdRef.current = id;
    setDraggingId(id);
  };

  const handleDragOver = (id) => {
    if (dragIdRef.current !== id) setOverId(id);
  };

  const handleDrop = (targetId) => {
    const fromId = dragIdRef.current;
    if (!fromId || fromId === targetId) return;
    const ids = sorted.map((e) => e.id_endpoint);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(targetId);
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    setOrderedIds(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleDragEnd = () => {
    dragIdRef.current = null;
    setDraggingId(null);
    setOverId(null);
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Endpoints</h2>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Endpoint
        </button>
      </div>

      {/* Empty state */}
      {endpoints.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No endpoints registered yet.</p>
          <button onClick={openCreate} className="text-blue-400 hover:text-blue-300 underline">
            Add your first endpoint
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((ep) => (
            <EndpointCard
              key={ep.id_endpoint}
              endpoint={ep}
              onUpdate={onEndpointUpdated}
              onDelete={onEndpointDeleted}
              onEdit={openEdit}
              onViewDetail={onViewDetail}
              isDragging={draggingId === ep.id_endpoint}
              isDragOver={overId === ep.id_endpoint}
              onDragStart={() => handleDragStart(ep.id_endpoint)}
              onDragOver={() => handleDragOver(ep.id_endpoint)}
              onDrop={() => handleDrop(ep.id_endpoint)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <EndpointForm endpoint={editTarget} onSaved={handleSaved} onCancel={handleCancel} />
      )}
    </div>
  );
}
