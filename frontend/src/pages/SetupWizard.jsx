import { useState } from 'react';
import { testConnection, saveSetup } from '../services/api';

const DEFAULT_PORTS = {
  postgresql: 5432,
  mysql: 3306,
  mariadb: 3306,
  sqlserver: 1433,
};

const ENGINE_LABELS = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  sqlserver: 'SQL Server',
};

const INPUT_CLASS =
  'w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 ' +
  'focus:outline-none focus:border-blue-500 placeholder-gray-500';

export default function SetupWizard() {
  const [form, setForm] = useState({
    engine: 'postgresql',
    host: '',
    port: DEFAULT_PORTS.postgresql,
    user: '',
    password: '',
    database: '',
  });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTestResult(null);
    if (name === 'engine') {
      setForm((f) => ({ ...f, engine: value, port: DEFAULT_PORTS[value] }));
    } else if (name === 'port') {
      setForm((f) => ({ ...f, port: Number(value) }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(form);
      setTestResult(result);
    } catch {
      setTestResult({ success: false, error: 'Erro de comunicação com o servidor.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveSetup(form);
      if (result.success) {
        window.location.reload();
      } else {
        setTestResult({ success: false, error: result.error });
      }
    } catch {
      setTestResult({ success: false, error: 'Erro ao salvar configuração.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-lg shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-1">Endpoint Monitor</h1>
        <p className="text-gray-400 mb-6 text-sm">
          Configure a conexão com o banco de dados para começar.
        </p>

        <div className="space-y-4">
          {/* Engine */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Engine</label>
            <select
              name="engine"
              value={form.engine}
              onChange={handleChange}
              className={INPUT_CLASS}
            >
              {Object.entries(ENGINE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Host + Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Host</label>
              <input
                type="text"
                name="host"
                value={form.host}
                onChange={handleChange}
                placeholder="localhost"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Porta</label>
              <input
                type="number"
                name="port"
                value={form.port}
                onChange={handleChange}
                min={1}
                max={65535}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* User */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Usuário</label>
            <input
              type="text"
              name="user"
              value={form.user}
              onChange={handleChange}
              autoComplete="username"
              className={INPUT_CLASS}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Senha</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              className={INPUT_CLASS}
            />
          </div>

          {/* Database */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Banco de Dados</label>
            <input
              type="text"
              name="database"
              value={form.database}
              onChange={handleChange}
              placeholder="endpoint_monitor"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* Feedback */}
        {testResult && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm break-words ${
              testResult.success
                ? 'bg-green-900/60 border border-green-700 text-green-300'
                : 'bg-red-900/60 border border-red-700 text-red-300'
            }`}
          >
            {testResult.success ? '✓ Conexão bem-sucedida!' : `✗ ${testResult.error}`}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleTest}
            disabled={testing || saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {testing ? 'Testando...' : 'Testar Conexão'}
          </button>

          <button
            onClick={handleSave}
            disabled={!testResult?.success || saving || testing}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar e Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}
