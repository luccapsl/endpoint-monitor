import { useState } from 'react';
import { createEndpoint, updateEndpoint } from '../services/api';

const INTERVAL_OPTIONS = [
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
  { label: '30 min', value: 1800 },
  { label: '1 h', value: 3600 },
];

// For database type, protocol ENUM encodes the database engine:
//   http  → PostgreSQL
//   https → MySQL
//   tcp   → MariaDB
//   udp   → SQL Server
const DB_ENGINE_OPTIONS = [
  { label: 'PostgreSQL', value: 'postgresql', protocol: 'http', port: 5432 },
  { label: 'MySQL', value: 'mysql', protocol: 'https', port: 3306 },
  { label: 'MariaDB', value: 'mariadb', protocol: 'tcp', port: 3306 },
  { label: 'SQL Server', value: 'sqlserver', protocol: 'udp', port: 1433 },
];

function protocolToDbEngine(protocol) {
  const found = DB_ENGINE_OPTIONS.find((o) => o.protocol === protocol);
  return found ? found.value : 'postgresql';
}

function dbEngineToProtocol(engine) {
  const found = DB_ENGINE_OPTIONS.find((o) => o.value === engine);
  return found ? found.protocol : 'http';
}

function dbEngineToPort(engine) {
  const found = DB_ENGINE_OPTIONS.find((o) => o.value === engine);
  return found ? found.port : 5432;
}

function parseDbHostname(hostname) {
  try {
    const obj = JSON.parse(hostname);
    if (obj && typeof obj === 'object' && 'host' in obj) return obj;
  } catch {}
  return { host: hostname, user: '', password: '', db: '' };
}

const EMPTY_FORM = {
  name: '',
  hostname: '',
  type: 'http',
  port: 80,
  protocol: 'http',
  check_interval_s: 60,
  timeout_s: 5,
  degraded_ms: '',
  is_active: true,
  // database-type extras
  db_engine: 'postgresql',
  db_host: '',
  db_user: '',
  db_password: '',
  db_name: '',
};

const INPUT_CLASS =
  'w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 ' +
  'focus:outline-none focus:border-blue-500 placeholder-gray-500';

const LABEL_CLASS = 'block text-sm font-medium text-gray-300 mb-1';

export default function EndpointForm({ endpoint, onSaved, onCancel }) {
  const isEdit = !!endpoint;

  const [form, setForm] = useState(() => {
    if (!isEdit) return { ...EMPTY_FORM };

    const dbInfo = endpoint.type === 'database' ? parseDbHostname(endpoint.hostname) : {};
    return {
      name: endpoint.name,
      hostname: endpoint.type === 'database' ? '' : endpoint.hostname,
      type: endpoint.type,
      port: endpoint.port,
      protocol: endpoint.protocol || 'http',
      check_interval_s: endpoint.check_interval_s,
      timeout_s: endpoint.timeout_s,
      degraded_ms: endpoint.degraded_ms ?? '',
      is_active: endpoint.is_active,
      db_engine: protocolToDbEngine(endpoint.protocol),
      db_host: dbInfo.host || '',
      db_user: dbInfo.user || '',
      db_password: dbInfo.password || '',
      db_name: dbInfo.db || '',
    };
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
    setServerError('');
  };

  const handleTypeChange = (val) => {
    set('type', val);
    if (val === 'http') {
      setForm((f) => ({ ...f, type: val, protocol: 'http', port: 80 }));
    } else if (val === 'tcp') {
      setForm((f) => ({ ...f, type: val, protocol: 'tcp', port: '' }));
    } else if (val === 'database') {
      const eng = form.db_engine || 'postgresql';
      setForm((f) => ({
        ...f,
        type: val,
        protocol: dbEngineToProtocol(eng),
        port: dbEngineToPort(eng),
        db_engine: eng,
      }));
    } else if (val === 'dns') {
      setForm((f) => ({ ...f, type: val, protocol: null, port: 53 }));
    }
    setErrors({});
    setServerError('');
  };

  const handleProtocolChange = (val) => {
    set('protocol', val);
    if (val === 'https') set('port', 443);
    else if (val === 'http') set('port', 80);
  };

  const handleDbEngineChange = (val) => {
    setForm((f) => ({
      ...f,
      db_engine: val,
      protocol: dbEngineToProtocol(val),
      port: dbEngineToPort(val),
    }));
    setErrors((e) => ({ ...e, db_engine: '' }));
    setServerError('');
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';

    if (form.type === 'database') {
      if (!form.db_host.trim()) errs.db_host = 'Host is required';
    } else {
      if (!form.hostname.trim()) errs.hostname = 'Hostname is required';
    }

    if (form.type !== 'dns') {
      if (!form.port || form.port < 1 || form.port > 65535)
        errs.port = 'Port must be 1–65535';
    }

    if (form.timeout_s < 1) errs.timeout_s = 'Timeout must be ≥ 1';
    if (form.degraded_ms !== '' && Number(form.degraded_ms) < 1)
      errs.degraded_ms = 'Must be ≥ 1 ms';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    let hostname = form.hostname;
    if (form.type === 'database') {
      // Encode connection info as JSON in the hostname field
      hostname = JSON.stringify({
        host: form.db_host,
        user: form.db_user,
        password: form.db_password,
        db: form.db_name,
      });
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        hostname,
        type: form.type,
        port: form.type === 'dns' ? 53 : Number(form.port),
        protocol: form.type === 'dns' ? null : form.protocol,
        check_interval_s: Number(form.check_interval_s),
        timeout_s: Number(form.timeout_s),
        degraded_ms: form.degraded_ms !== '' ? Number(form.degraded_ms) : null,
        is_active: form.is_active,
      };
      const saved = isEdit
        ? await updateEndpoint(endpoint.id_endpoint, payload)
        : await createEndpoint(payload);
      onSaved(saved);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isDns = form.type === 'dns';
  const isDatabase = form.type === 'database';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-5">
          {isEdit ? 'Edit Endpoint' : 'New Endpoint'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className={LABEL_CLASS}>Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="My API"
              className={INPUT_CLASS}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Type */}
          <div>
            <label className={LABEL_CLASS}>Type</label>
            <select
              value={form.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="http">HTTP</option>
              <option value="tcp">TCP</option>
              <option value="database">Database</option>
              <option value="dns">DNS</option>
            </select>
          </div>

          {/* Database-specific fields */}
          {isDatabase && (
            <>
              <div>
                <label className={LABEL_CLASS}>Database Engine</label>
                <select
                  value={form.db_engine}
                  onChange={(e) => handleDbEngineChange(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {DB_ENGINE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Host / IP</label>
                <input
                  type="text"
                  value={form.db_host}
                  onChange={(e) => set('db_host', e.target.value)}
                  placeholder="db.example.com"
                  className={INPUT_CLASS}
                />
                {errors.db_host && <p className="text-red-400 text-xs mt-1">{errors.db_host}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>User</label>
                  <input
                    type="text"
                    value={form.db_user}
                    onChange={(e) => set('db_user', e.target.value)}
                    placeholder="admin"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Password</label>
                  <input
                    type="password"
                    value={form.db_password}
                    onChange={(e) => set('db_password', e.target.value)}
                    placeholder="••••••••"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL_CLASS}>Database Name</label>
                <input
                  type="text"
                  value={form.db_name}
                  onChange={(e) => set('db_name', e.target.value)}
                  placeholder="mydb"
                  className={INPUT_CLASS}
                />
              </div>
            </>
          )}

          {/* Hostname — shown for http, tcp, dns */}
          {!isDatabase && (
            <div>
              <label className={LABEL_CLASS}>
                {isDns ? 'Hostname to resolve' : 'Hostname'}
              </label>
              <input
                type="text"
                value={form.hostname}
                onChange={(e) => set('hostname', e.target.value)}
                placeholder={isDns ? 'google.com' : 'api.example.com'}
                className={INPUT_CLASS}
              />
              {errors.hostname && <p className="text-red-400 text-xs mt-1">{errors.hostname}</p>}
            </div>
          )}

          {/* Protocol + Port — hidden for DNS */}
          {!isDns && (
            <div className={`grid gap-3 ${isDatabase ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {!isDatabase && (
                <div>
                  <label className={LABEL_CLASS}>Protocol</label>
                  <select
                    value={form.protocol || ''}
                    onChange={(e) => handleProtocolChange(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    {form.type === 'http' ? (
                      <>
                        <option value="http">http</option>
                        <option value="https">https</option>
                      </>
                    ) : (
                      <>
                        <option value="tcp">tcp</option>
                        <option value="udp">udp</option>
                        <option value="icmp">icmp</option>
                      </>
                    )}
                  </select>
                </div>
              )}
              <div>
                <label className={LABEL_CLASS}>Port</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => set('port', e.target.value)}
                  min={1}
                  max={65535}
                  className={INPUT_CLASS}
                />
                {errors.port && <p className="text-red-400 text-xs mt-1">{errors.port}</p>}
              </div>
            </div>
          )}

          {/* Interval + Timeout */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Check interval</label>
              <select
                value={form.check_interval_s}
                onChange={(e) => set('check_interval_s', Number(e.target.value))}
                className={INPUT_CLASS}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Timeout (s)</label>
              <input
                type="number"
                value={form.timeout_s}
                onChange={(e) => set('timeout_s', e.target.value)}
                min={1}
                className={INPUT_CLASS}
              />
              {errors.timeout_s && (
                <p className="text-red-400 text-xs mt-1">{errors.timeout_s}</p>
              )}
            </div>
          </div>

          {/* Degraded threshold */}
          <div>
            <label className={LABEL_CLASS}>
              Degraded threshold (ms){' '}
              <span className="text-gray-500 font-normal">— optional</span>
            </label>
            <input
              type="number"
              value={form.degraded_ms}
              onChange={(e) => set('degraded_ms', e.target.value)}
              placeholder="e.g. 500 — leave empty to disable"
              min={1}
              className={INPUT_CLASS}
            />
            {errors.degraded_ms && (
              <p className="text-red-400 text-xs mt-1">{errors.degraded_ms}</p>
            )}
          </div>

          {serverError && (
            <div className="bg-red-900/60 border border-red-700 text-red-300 rounded-lg p-3 text-sm">
              {serverError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
