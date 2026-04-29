import { useState } from 'react';
import EndpointCard from './EndpointCard';
import EndpointForm from './EndpointForm';

export default function EndpointList({ endpoints, onEndpointCreated, onEndpointUpdated, onEndpointDeleted }) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const openCreate = () => {
    setEditTarget(null);
    setShowForm(true);
  };

  const openEdit = (ep) => {
    setEditTarget(ep);
    setShowForm(true);
  };

  const handleSaved = (saved) => {
    if (editTarget) {
      onEndpointUpdated(saved);
    } else {
      onEndpointCreated(saved);
    }
    setShowForm(false);
    setEditTarget(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditTarget(null);
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
          {endpoints.map((ep) => (
            <EndpointCard
              key={ep.id_endpoint}
              endpoint={ep}
              onUpdate={onEndpointUpdated}
              onDelete={onEndpointDeleted}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <EndpointForm
          endpoint={editTarget}
          onSaved={handleSaved}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
