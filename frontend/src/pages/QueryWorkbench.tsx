import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play,
  Copy,
  Check,
  Download,
  Bookmark,
  History,
  Trash2,
  Filter,
  Plus,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Database,
  Terminal,
  Clock,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  WorkbenchSchemaResponse,
  WorkbenchTable,
  WorkbenchExampleQuery,
  QueryExecuteResponse,
  SavedQuery,
  QueryHistoryItem,
} from '../types';

interface FilterCondition {
  id: string;
  column: string;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'ILIKE' | 'IS NULL' | 'IS NOT NULL' | 'IN';
  value: string;
}

export const QueryWorkbench: React.FC = () => {
  // --- View Mode ---
  const [activeMode, setActiveMode] = useState<'build' | 'code'>('build');

  // --- Schema Metadata ---
  const [schema, setSchema] = useState<WorkbenchSchemaResponse | null>(null);
  const [schemaLoading, setSchemaLoading] = useState<boolean>(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // --- Build Mode State ---
  const [selectedTable, setSelectedTable] = useState<string>('price_history');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [timePreset, setTimePreset] = useState<string>('7d');
  const [customStartTime, setCustomStartTime] = useState<string>('');
  const [customEndTime, setCustomEndTime] = useState<string>('');
  const [enableTimeBucket, setEnableTimeBucket] = useState<boolean>(false);
  const [selectedBucketInterval, setSelectedBucketInterval] = useState<string>('1 hour');
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC');
  const [rowLimit, setRowLimit] = useState<number>(100);

  // --- Code Mode State ---
  const [sqlQuery, setSqlQuery] = useState<string>(
    'SELECT symbol, price, volume, timestamp FROM price_history ORDER BY timestamp DESC LIMIT 50;'
  );
  const [paramInput, setParamInput] = useState<string>('');
  const [showParamInput, setShowParamInput] = useState<boolean>(false);

  // --- Shared Execution & Results State ---
  const [executing, setExecuting] = useState<boolean>(false);
  const [queryResult, setQueryResult] = useState<QueryExecuteResponse | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // --- Results Grid Filter & Pagination ---
  const [resultFilter, setResultFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // --- History & Saved Queries ---
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [newSaveName, setNewSaveName] = useState<string>('');

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Load localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('timescale_saved_queries');
      if (saved) setSavedQueries(JSON.parse(saved));
      const hist = localStorage.getItem('timescale_query_history');
      if (hist) setQueryHistory(JSON.parse(hist));
    } catch (e) {
      console.warn('Could not read localStorage for workbench:', e);
    }
  }, []);

  // Fetch schema metadata
  useEffect(() => {
    let mounted = true;
    async function loadSchema() {
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        const data = await api.getWorkbenchSchema();
        if (mounted) {
          setSchema(data);
          const defaultTbl = data.tables.find((t) => t.name === 'price_history') || data.tables[0];
          if (defaultTbl) {
            setSelectedTable(defaultTbl.name);
            setSelectedColumns(defaultTbl.columns.map((c) => c.name));
            setSortColumn(defaultTbl.default_sort || defaultTbl.columns[0]?.name || '');
          }
        }
      } catch (err: any) {
        if (mounted) setSchemaError(err?.message || 'Failed to load database schema metadata.');
      } finally {
        if (mounted) setSchemaLoading(false);
      }
    }
    loadSchema();
    return () => {
      mounted = false;
    };
  }, []);

  // Current active table object
  const currentTableObj: WorkbenchTable | undefined = useMemo(() => {
    return schema?.tables.find((t) => t.name === selectedTable);
  }, [schema, selectedTable]);

  // When table changes, reset columns and sort
  const handleTableChange = (newTableName: string) => {
    setSelectedTable(newTableName);
    const tbl = schema?.tables.find((t) => t.name === newTableName);
    if (tbl) {
      setSelectedColumns(tbl.columns.map((c) => c.name));
      setSortColumn(tbl.default_sort || tbl.columns[0]?.name || '');
      setFilters([]);
      setEnableTimeBucket(false);
    }
  };

  const toggleColumn = (colName: string) => {
    setSelectedColumns((prev) =>
      prev.includes(colName) ? prev.filter((c) => c !== colName) : [...prev, colName]
    );
  };

  const selectAllColumns = () => {
    if (currentTableObj) {
      setSelectedColumns(currentTableObj.columns.map((c) => c.name));
    }
  };

  const deselectAllColumns = () => {
    setSelectedColumns([]);
  };

  // Filter conditions management
  const addFilter = () => {
    if (!currentTableObj || currentTableObj.columns.length === 0) return;
    const newCond: FilterCondition = {
      id: Math.random().toString(36).substring(2, 9),
      column: currentTableObj.columns[0].name,
      operator: '=',
      value: '',
    };
    setFilters((prev) => [...prev, newCond]);
  };

  const updateFilter = (id: string, field: keyof FilterCondition, value: any) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const removeFilter = (id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  // ---------------------------------------------------------------------------
  // Build Mode: Generate SQL String
  // ---------------------------------------------------------------------------
  const generatedSql = useMemo(() => {
    if (!currentTableObj) return '';

    if (enableTimeBucket && currentTableObj.name === 'price_history') {
      const bucket = selectedBucketInterval;
      let sql = 'SELECT \n';
      sql += `    time_bucket('${bucket}', timestamp) AS bucket,\n`;
      sql += '    symbol,\n';
      sql += '    first(price, timestamp) AS open_price,\n';
      sql += '    max(price) AS high_price,\n';
      sql += '    min(price) AS low_price,\n';
      sql += '    last(price, timestamp) AS close_price,\n';
      sql += '    round(sum(volume), 2) AS total_volume,\n';
      sql += '    count(*) AS observation_count\n';
      sql += `FROM ${currentTableObj.name}\n`;

      const whereClauses: string[] = [];
      if (timePreset === '1h') whereClauses.push("timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 hour'");
      else if (timePreset === '24h') whereClauses.push("timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'");
      else if (timePreset === '7d') whereClauses.push("timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'");
      else if (timePreset === '30d') whereClauses.push("timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'");
      else if (timePreset === 'custom') {
        if (customStartTime) whereClauses.push(`timestamp >= '${customStartTime}'`);
        if (customEndTime) whereClauses.push(`timestamp <= '${customEndTime}'`);
      }

      filters.forEach((f) => {
        if (f.operator === 'IS NULL' || f.operator === 'IS NOT NULL') {
          whereClauses.push(`${f.column} ${f.operator}`);
        } else if (f.value.trim() !== '') {
          const isNum = !isNaN(Number(f.value));
          const valEsc = isNum ? f.value.trim() : `'${f.value.trim().replace(/'/g, "''")}'`;
          whereClauses.push(`${f.column} ${f.operator} ${valEsc}`);
        }
      });

      if (whereClauses.length > 0) {
        sql += `WHERE ${whereClauses.join(' AND\n  ')}\n`;
      }

      sql += 'GROUP BY bucket, symbol\n';
      sql += 'ORDER BY bucket DESC, symbol ASC\n';
      sql += `LIMIT ${rowLimit};`;
      return sql;
    }

    const cols =
      selectedColumns.length > 0 ? selectedColumns.map((c) => `    ${c}`).join(',\n') : '    *';

    let sql = `SELECT \n${cols}\nFROM ${currentTableObj.name}\n`;

    const whereClauses: string[] = [];
    const tsCol = currentTableObj.timestamp_column;

    if (tsCol) {
      if (timePreset === '1h') whereClauses.push(`${tsCol} >= CURRENT_TIMESTAMP - INTERVAL '1 hour'`);
      else if (timePreset === '24h') whereClauses.push(`${tsCol} >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`);
      else if (timePreset === '7d') whereClauses.push(`${tsCol} >= CURRENT_TIMESTAMP - INTERVAL '7 days'`);
      else if (timePreset === '30d') whereClauses.push(`${tsCol} >= CURRENT_TIMESTAMP - INTERVAL '30 days'`);
      else if (timePreset === 'custom') {
        if (customStartTime) whereClauses.push(`${tsCol} >= '${customStartTime}'`);
        if (customEndTime) whereClauses.push(`${tsCol} <= '${customEndTime}'`);
      }
    }

    filters.forEach((f) => {
      if (f.operator === 'IS NULL' || f.operator === 'IS NOT NULL') {
        whereClauses.push(`${f.column} ${f.operator}`);
      } else if (f.operator === 'IN') {
        const items = f.value
          .split(',')
          .map((v) => `'${v.trim().replace(/'/g, "''")}'`)
          .join(', ');
        whereClauses.push(`${f.column} IN (${items})`);
      } else if (f.value.trim() !== '') {
        const isNum = !isNaN(Number(f.value));
        const valEsc = isNum ? f.value.trim() : `'${f.value.trim().replace(/'/g, "''")}'`;
        whereClauses.push(`${f.column} ${f.operator} ${valEsc}`);
      }
    });

    if (whereClauses.length > 0) {
      sql += `WHERE ${whereClauses.join(' AND\n  ')}\n`;
    }

    if (sortColumn) {
      sql += `ORDER BY ${sortColumn} ${sortDirection}\n`;
    }

    sql += `LIMIT ${rowLimit};`;
    return sql;
  }, [
    currentTableObj,
    selectedColumns,
    timePreset,
    customStartTime,
    customEndTime,
    enableTimeBucket,
    selectedBucketInterval,
    filters,
    sortColumn,
    sortDirection,
    rowLimit,
  ]);

  const transferToCodeMode = () => {
    setSqlQuery(generatedSql);
    setActiveMode('code');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const executeQuery = async (queryToRun?: string) => {
    const rawSql = (queryToRun || (activeMode === 'build' ? generatedSql : sqlQuery)).trim();
    if (!rawSql) return;

    setExecuting(true);
    setCurrentPage(1);

    let parsedParams: any[] = [];
    if (showParamInput && paramInput.trim()) {
      try {
        if (paramInput.trim().startsWith('[')) {
          parsedParams = JSON.parse(paramInput.trim());
        } else {
          parsedParams = paramInput.split(',').map((p) => {
            const trimmed = p.trim();
            return isNaN(Number(trimmed)) ? trimmed : Number(trimmed);
          });
        }
      } catch (e) {
        console.warn('Parameter parsing warning:', e);
      }
    }

    try {
      const res = await api.executeWorkbenchQuery(rawSql, parsedParams, rowLimit);
      setQueryResult(res);

      const historyEntry: QueryHistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        sql: rawSql,
        executed_at: new Date().toLocaleTimeString(),
        execution_ms: res.execution_ms,
        row_count: res.row_count,
        success: res.success,
        error: res.error,
      };

      setQueryHistory((prev) => {
        const updated = [historyEntry, ...prev.slice(0, 19)];
        localStorage.setItem('timescale_query_history', JSON.stringify(updated));
        return updated;
      });
    } catch (err: any) {
      setQueryResult({
        success: false,
        columns: [],
        column_types: [],
        rows: [],
        row_count: 0,
        execution_ms: 0,
        truncated: false,
        max_limit: rowLimit,
        error: err?.message || 'Network error connecting to query workbench endpoint.',
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeQuery();
    }
  };

  const loadExample = (ex: WorkbenchExampleQuery) => {
    setSqlQuery(ex.sql);
    setActiveMode('code');
  };

  const saveCurrentQuery = () => {
    if (!newSaveName.trim()) return;
    const currentSql = activeMode === 'build' ? generatedSql : sqlQuery;
    const newSaved: SavedQuery = {
      id: Math.random().toString(36).substring(2, 9),
      name: newSaveName.trim(),
      sql: currentSql,
      saved_at: new Date().toLocaleDateString(),
    };
    const updated = [newSaved, ...savedQueries];
    setSavedQueries(updated);
    localStorage.setItem('timescale_saved_queries', JSON.stringify(updated));
    setNewSaveName('');
    setShowSaveModal(false);
  };

  const deleteSavedQuery = (id: string) => {
    const updated = savedQueries.filter((q) => q.id !== id);
    setSavedQueries(updated);
    localStorage.setItem('timescale_saved_queries', JSON.stringify(updated));
  };

  const loadSavedQuery = (saved: SavedQuery) => {
    setSqlQuery(saved.sql);
    setActiveMode('code');
  };

  const clearHistory = () => {
    setQueryHistory([]);
    localStorage.removeItem('timescale_query_history');
  };

  const exportToCsv = () => {
    if (!queryResult || !queryResult.columns || queryResult.rows.length === 0) return;

    const sanitizeCell = (val: any): string => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (/^[=+\-@]/.test(str)) {
        str = ' ' + str;
      }
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerRow = queryResult.columns.map(sanitizeCell).join(',');
    const bodyRows = queryResult.rows
      .map((row) => row.map(sanitizeCell).join(','))
      .join('\r\n');

    const csvContent = `${headerRow}\r\n${bodyRows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `timescaledb_query_${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredRows = useMemo(() => {
    if (!queryResult || !queryResult.rows) return [];
    if (!resultFilter.trim()) return queryResult.rows;
    const term = resultFilter.toLowerCase();
    return queryResult.rows.filter((row) =>
      row.some((cell) => cell !== null && String(cell).toLowerCase().includes(term))
    );
  }, [queryResult, resultFilter]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
              <Terminal className="h-5 w-5 text-brand-teal" />
              SQL Query Workbench
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-brand-teal/10 text-brand-teal border border-brand-teal/30">
              TimescaleDB Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Build parameterized queries visually or execute manual read-only SQL directly against the 18-table TimescaleDB engine.
          </p>
        </div>

        {/* Security & Role Status Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-navy-900 border border-navy-800 text-slate-300">
            <Database className="h-3.5 w-3.5 text-brand-teal" />
            <span className="font-mono text-[11px]">Role: dashboard_reader</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-navy-900 border border-navy-800 text-slate-300">
            <Clock className="h-3.5 w-3.5 text-brand-cyan" />
            <span className="font-mono text-[11px]">Timeout: 5,000 ms</span>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-navy-800">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveMode('build')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
              activeMode === 'build'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-navy-700'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Build Mode (Visual Query Builder)
          </button>
          <button
            onClick={() => setActiveMode('code')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
              activeMode === 'code'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-navy-700'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Code Mode (Manual SQL Editor)
          </button>
        </div>

        {/* Action Controls for Active Mode */}
        <div className="flex items-center gap-2 pb-2">
          {activeMode === 'build' ? (
            <>
              <button
                onClick={transferToCodeMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-navy-900 hover:bg-navy-800 border border-navy-700 transition"
                title="Transfer generated SQL into Code Mode for custom editing"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 text-brand-teal" />
                <span>Open in Code Mode</span>
              </button>
              <button
                onClick={() => executeQuery()}
                disabled={executing || !currentTableObj}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-navy-950 bg-brand-teal hover:bg-brand-teal/90 transition shadow-sm disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{executing ? 'Executing...' : 'Run Query'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-navy-900 hover:bg-navy-800 border border-navy-700 transition"
              >
                <Bookmark className="h-3.5 w-3.5 text-brand-amber" />
                <span>Save</span>
              </button>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-navy-900 hover:bg-navy-800 border border-navy-700 transition"
              >
                <History className="h-3.5 w-3.5 text-brand-cyan" />
                <span>History ({queryHistory.length})</span>
              </button>
              <button
                onClick={() => executeQuery()}
                disabled={executing}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-navy-950 bg-brand-teal hover:bg-brand-teal/90 transition shadow-sm disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{executing ? 'Executing...' : 'Run Query (Ctrl+Enter)'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BUILD MODE CONTENT */}
      {/* ===================================================================== */}
      {activeMode === 'build' && (
        <div className="space-y-6">
          {schemaLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading database schema metadata...</div>
          ) : schemaError ? (
            <div className="p-4 rounded-xl bg-brand-rose/10 border border-brand-rose/30 text-brand-rose text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{schemaError}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Schema, Columns, and Time Bucket Options */}
              <div className="lg:col-span-2 space-y-5">
                {/* 1. Table Selector */}
                <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      1. Select Table / Time-Series View
                    </label>
                    {currentTableObj && (
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-navy-800 text-brand-teal">
                        {currentTableObj.type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedTable}
                    onChange={(e) => handleTableChange(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-teal font-mono"
                  >
                    {schema?.tables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} — {t.type}
                      </option>
                    ))}
                  </select>
                  {currentTableObj && (
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {currentTableObj.description}
                    </p>
                  )}
                </div>

                {/* 2. Column Selection */}
                <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      2. Choose Columns ({selectedColumns.length} of {currentTableObj?.columns.length})
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAllColumns}
                        className="text-[11px] text-brand-teal hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        onClick={deselectAllColumns}
                        className="text-[11px] text-slate-400 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                    {currentTableObj?.columns.map((col) => {
                      const isSelected = selectedColumns.includes(col.name);
                      return (
                        <label
                          key={col.name}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                            isSelected
                              ? 'bg-navy-850 border-brand-teal/40 text-slate-200'
                              : 'bg-navy-950 border-navy-800 text-slate-400 hover:border-navy-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleColumn(col.name)}
                            className="rounded border-navy-700 text-brand-teal focus:ring-0 bg-navy-900"
                          />
                          <div className="truncate">
                            <div className="font-mono text-[11px] truncate">{col.name}</div>
                            <div className="text-[9px] text-slate-500 truncate">{col.type}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Time-Series & Aggregation Settings */}
                {currentTableObj?.timestamp_column && (
                  <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-brand-cyan" />
                        <span>3. Time Range Filter ({currentTableObj.timestamp_column})</span>
                      </label>

                      {/* Time Bucket Toggle if price_history */}
                      {currentTableObj.name === 'price_history' && (
                        <label className="flex items-center gap-2 text-xs text-brand-teal cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableTimeBucket}
                            onChange={(e) => setEnableTimeBucket(e.target.checked)}
                            className="rounded border-navy-700 text-brand-teal focus:ring-0 bg-navy-900"
                          />
                          <span>TimescaleDB time_bucket() OHLCV</span>
                        </label>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'All Time', val: 'all' },
                        { label: 'Last 1 Hour', val: '1h' },
                        { label: 'Last 24 Hours', val: '24h' },
                        { label: 'Last 7 Days', val: '7d' },
                        { label: 'Last 30 Days', val: '30d' },
                        { label: 'Custom Range', val: 'custom' },
                      ].map((p) => (
                        <button
                          key={p.val}
                          onClick={() => setTimePreset(p.val)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            timePreset === p.val
                              ? 'bg-brand-teal/20 text-brand-teal border border-brand-teal/40'
                              : 'bg-navy-950 text-slate-400 border border-navy-800 hover:text-slate-200'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {timePreset === 'custom' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Start Time (UTC)</label>
                          <input
                            type="datetime-local"
                            value={customStartTime}
                            onChange={(e) => setCustomStartTime(e.target.value)}
                            className="w-full bg-navy-950 border border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">End Time (UTC)</label>
                          <input
                            type="datetime-local"
                            value={customEndTime}
                            onChange={(e) => setCustomEndTime(e.target.value)}
                            className="w-full bg-navy-950 border border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* Time Bucket interval picker */}
                    {enableTimeBucket && currentTableObj.name === 'price_history' && (
                      <div className="pt-2 border-t border-navy-800 flex items-center gap-3">
                        <span className="text-xs text-slate-400">Candle Interval:</span>
                        <div className="flex gap-2">
                          {schema?.time_buckets.map((b) => (
                            <button
                              key={b.value}
                              onClick={() => setSelectedBucketInterval(b.value)}
                              className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                                selectedBucketInterval === b.value
                                  ? 'bg-brand-teal text-navy-950 font-semibold'
                                  : 'bg-navy-950 text-slate-400 hover:text-slate-200 border border-navy-800'
                              }`}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Filter Conditions */}
                <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      4. Filter Conditions ({filters.length})
                    </label>
                    <button
                      onClick={addFilter}
                      className="flex items-center gap-1 text-xs text-brand-teal hover:underline font-medium"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Condition
                    </button>
                  </div>

                  {filters.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No custom filters added. Query will return all matching rows.</p>
                  ) : (
                    <div className="space-y-2">
                      {filters.map((f) => (
                        <div key={f.id} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          {/* Column */}
                          <select
                            value={f.column}
                            onChange={(e) => updateFilter(f.id, 'column', e.target.value)}
                            className="bg-navy-950 border border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono flex-1"
                          >
                            {currentTableObj?.columns.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          {/* Operator */}
                          <select
                            value={f.operator}
                            onChange={(e) => updateFilter(f.id, 'operator', e.target.value)}
                            className="bg-navy-950 border border-navy-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono"
                          >
                            <option value="=">=</option>
                            <option value="!=">!=</option>
                            <option value=">">&gt;</option>
                            <option value=">=">&gt;=</option>
                            <option value="<">&lt;</option>
                            <option value="<=">&lt;=</option>
                            <option value="LIKE">LIKE</option>
                            <option value="ILIKE">ILIKE</option>
                            <option value="IN">IN</option>
                            <option value="IS NULL">IS NULL</option>
                            <option value="IS NOT NULL">IS NOT NULL</option>
                          </select>

                          {/* Value */}
                          {f.operator !== 'IS NULL' && f.operator !== 'IS NOT NULL' && (
                            <input
                              type="text"
                              value={f.value}
                              onChange={(e) => updateFilter(f.id, 'value', e.target.value)}
                              placeholder={f.operator === 'IN' ? 'BTC, ETH, SOL' : 'Value (e.g. BTC)'}
                              className="bg-navy-950 border border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono flex-1"
                            />
                          )}

                          {/* Remove */}
                          <button
                            onClick={() => removeFilter(f.id)}
                            className="p-1.5 text-slate-500 hover:text-brand-rose transition"
                            title="Remove filter"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Sorting, Limit, and Live SQL Preview */}
              <div className="space-y-5">
                {/* 5. Sorting and Row Limits */}
                <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 space-y-3">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                    5. Sort & Row Limits
                  </label>

                  <div className="space-y-3">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Sort Column:</span>
                      <select
                        value={sortColumn}
                        onChange={(e) => setSortColumn(e.target.value)}
                        className="w-full bg-navy-950 border border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                      >
                        <option value="">None</option>
                        {currentTableObj?.columns.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSortDirection('DESC')}
                        className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition ${
                          sortDirection === 'DESC'
                            ? 'bg-brand-teal/20 text-brand-teal border border-brand-teal/40'
                            : 'bg-navy-950 text-slate-400 border border-navy-800'
                        }`}
                      >
                        Descending (DESC)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortDirection('ASC')}
                        className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition ${
                          sortDirection === 'ASC'
                            ? 'bg-brand-teal/20 text-brand-teal border border-brand-teal/40'
                            : 'bg-navy-950 text-slate-400 border border-navy-800'
                        }`}
                      >
                        Ascending (ASC)
                      </button>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Maximum Rows (Cap: 500):</span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[25, 50, 100, 250, 500].map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setRowLimit(l)}
                            className={`py-1 rounded text-xs font-mono transition ${
                              rowLimit === l
                                ? 'bg-brand-teal text-navy-950 font-semibold'
                                : 'bg-navy-950 text-slate-400 border border-navy-800 hover:text-slate-200'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. Live SQL Preview */}
                <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-brand-teal" />
                      <span>Live SQL Preview</span>
                    </label>
                    <button
                      onClick={() => copyToClipboard(generatedSql)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      {copiedSql ? <Check className="h-3.5 w-3.5 text-brand-emerald" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedSql ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <pre className="bg-navy-950 border border-navy-800 rounded-lg p-3 text-[11px] font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-60">
                    {generatedSql}
                  </pre>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={transferToCodeMode}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-slate-300 bg-navy-800 hover:bg-navy-700 transition"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5 text-brand-teal" />
                      <span>Edit in Code Mode</span>
                    </button>
                    <button
                      onClick={() => executeQuery()}
                      disabled={executing}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-navy-950 bg-brand-teal hover:bg-brand-teal/90 transition disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>{executing ? 'Running...' : 'Run Query'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* CODE MODE CONTENT */}
      {/* ===================================================================== */}
      {activeMode === 'code' && (
        <div className="space-y-4">
          {/* Editor Header & Example Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-navy-900 border border-navy-800 rounded-xl p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-brand-amber" />
                <span>Example Queries:</span>
              </span>
              <select
                onChange={(e) => {
                  const ex = schema?.example_queries.find((q) => q.id === e.target.value);
                  if (ex) loadExample(ex);
                }}
                defaultValue=""
                className="bg-navy-950 border border-navy-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-medium"
              >
                <option value="" disabled>
                  -- Select a Verified Query --
                </option>
                {schema?.example_queries.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    [{ex.category}] {ex.name}
                  </option>
                ))}
              </select>

              {savedQueries.length > 0 && (
                <select
                  onChange={(e) => {
                    const sq = savedQueries.find((q) => q.id === e.target.value);
                    if (sq) loadSavedQuery(sq);
                  }}
                  defaultValue=""
                  className="bg-navy-950 border border-navy-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-medium"
                >
                  <option value="" disabled>
                    -- Load Saved Query ({savedQueries.length}) --
                  </option>
                  {savedQueries.map((sq) => (
                    <option key={sq.id} value={sq.id}>
                      {sq.name} ({sq.saved_at})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowParamInput((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition border ${
                  showParamInput
                    ? 'bg-brand-teal/20 text-brand-teal border-brand-teal/40'
                    : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-slate-200'
                }`}
              >
                {showParamInput ? 'Hide Parameters ($1)' : 'Add Parameters ($1)'}
              </button>
              <button
                onClick={() => setSqlQuery('')}
                className="px-2.5 py-1 rounded-lg text-xs text-slate-400 bg-navy-950 hover:text-slate-200 border border-navy-800 transition"
                title="Clear editor"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Optional Parameterized input bar */}
          {showParamInput && (
            <div className="p-3 bg-navy-900 border border-navy-800 rounded-xl space-y-1">
              <label className="text-[11px] text-slate-400 font-mono block">
                Parameters ($1, $2, ...) — comma separated or JSON array:
              </label>
              <input
                type="text"
                value={paramInput}
                onChange={(e) => setParamInput(e.target.value)}
                placeholder='e.g. BTC, 50000 or ["BTC", 50000]'
                className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-teal"
              />
            </div>
          )}

          {/* SQL Editor Area */}
          <div className="rounded-xl bg-navy-900 border border-navy-800 overflow-hidden shadow-inner">
            <div className="flex items-center justify-between px-3 py-2 bg-navy-950 border-b border-navy-800 text-[11px] text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <span>SQL Console (PostgreSQL 16 / TimescaleDB)</span>
                <span className="text-slate-600">|</span>
                <span>Press Ctrl+Enter to execute</span>
              </div>
              <button
                onClick={() => copyToClipboard(sqlQuery)}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
              >
                {copiedSql ? <Check className="h-3 w-3 text-brand-emerald" /> : <Copy className="h-3 w-3" />}
                <span>{copiedSql ? 'Copied' : 'Copy SQL'}</span>
              </button>
            </div>

            <textarea
              ref={editorRef}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={8}
              spellCheck={false}
              className="w-full bg-navy-950 p-4 text-xs font-mono text-slate-100 leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-brand-teal/40"
              placeholder="Write your read-only SELECT query here..."
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* EXECUTION STATUS & ERROR BANNERS */}
      {/* ===================================================================== */}
      {queryResult && (
        <div className="space-y-3">
          {queryResult.success ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-navy-900 border border-navy-800 text-xs">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-brand-emerald font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  Query Executed Successfully
                </span>
                <span className="text-slate-400">
                  <strong className="text-slate-200 font-mono">{queryResult.row_count}</strong> rows returned
                </span>
                <span className="text-slate-500 font-mono">⚡ {queryResult.execution_ms} ms</span>
              </div>

              {queryResult.truncated && (
                <div className="flex items-center gap-1 text-brand-amber text-[11px] font-medium bg-brand-amber/10 border border-brand-amber/30 px-2 py-0.5 rounded">
                  <AlertCircle className="h-3 w-3" />
                  <span>Results truncated at maximum limit ({queryResult.max_limit} rows)</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-brand-rose/10 border border-brand-rose/30 text-brand-rose text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Execution Error ({queryResult.execution_ms} ms)</span>
              </div>
              <p className="font-mono text-[11px] pl-6 leading-relaxed whitespace-pre-wrap">
                {queryResult.error}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SHARED RESULTS GRID & CSV EXPORT */}
      {/* ===================================================================== */}
      {queryResult && queryResult.success && (
        <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 space-y-4">
          {/* Grid Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-navy-800 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Query Results
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                ({filteredRows.length} {filteredRows.length !== queryResult.row_count ? `of ${queryResult.row_count}` : ''} rows)
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Client-side Filter */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={resultFilter}
                  onChange={(e) => {
                    setResultFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Filter visible results..."
                  className="bg-navy-950 border border-navy-700 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 w-44 sm:w-56 focus:outline-none focus:border-brand-teal"
                />
              </div>

              {/* CSV Export Button */}
              <button
                onClick={exportToCsv}
                disabled={queryResult.rows.length === 0}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-navy-800 hover:bg-navy-750 text-slate-200 border border-navy-700 transition disabled:opacity-50"
                title="Export results as CSV file"
              >
                <Download className="h-3.5 w-3.5 text-brand-teal" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Results Table */}
          {queryResult.rows.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 italic">
              Query executed successfully, but returned 0 rows.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-navy-800/80">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-navy-950 border-b border-navy-800 text-[11px] text-slate-400 font-mono uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-12 text-center text-slate-600">#</th>
                    {queryResult.columns.map((col, idx) => (
                      <th key={idx} className="py-2.5 px-3.5 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800/60 font-mono">
                  {paginatedRows.map((row, rIdx) => {
                    const rowNumber = (currentPage - 1) * pageSize + rIdx + 1;
                    return (
                      <tr key={rIdx} className="hover:bg-navy-850/60 transition">
                        <td className="py-2 px-3 text-center text-[10px] text-slate-600">
                          {rowNumber}
                        </td>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2 px-3.5 text-slate-200 whitespace-nowrap text-xs">
                            {cell === null ? (
                              <span className="text-slate-600 italic bg-navy-950 px-1.5 py-0.5 rounded text-[10px]">
                                NULL
                              </span>
                            ) : typeof cell === 'boolean' ? (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  cell ? 'bg-brand-emerald/10 text-brand-emerald' : 'bg-brand-rose/10 text-brand-rose'
                                }`}
                              >
                                {String(cell)}
                              </span>
                            ) : typeof cell === 'number' ? (
                              <span className="text-slate-100">
                                {Number.isInteger(cell) ? cell : cell.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                              </span>
                            ) : (
                              String(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredRows.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-navy-950 border border-navy-700 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>
                  Showing {(currentPage - 1) * pageSize + 1} -{' '}
                  {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded bg-navy-950 border border-navy-800 text-slate-300 hover:bg-navy-800 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-xs text-slate-300 font-mono">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded bg-navy-950 border border-navy-800 text-slate-300 hover:bg-navy-800 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* HISTORY MODAL / DRAWER */}
      {/* ===================================================================== */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-navy-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <History className="h-4 w-4 text-brand-cyan" />
                Query Execution History ({queryHistory.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearHistory}
                  className="text-xs text-slate-400 hover:text-brand-rose transition"
                >
                  Clear History
                </button>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-slate-400 hover:text-slate-200 text-lg px-2"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {queryHistory.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-6">No previous queries recorded yet.</p>
              ) : (
                queryHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-navy-950 border border-navy-800 hover:border-navy-700 transition flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">{item.executed_at}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            item.success
                              ? 'bg-brand-emerald/10 text-brand-emerald'
                              : 'bg-brand-rose/10 text-brand-rose'
                          }`}
                        >
                          {item.success ? `${item.row_count} rows` : 'Failed'}
                        </span>
                        <span className="text-slate-500 font-mono">{item.execution_ms} ms</span>
                      </div>
                    </div>
                    <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap line-clamp-3 bg-navy-900/60 p-2 rounded">
                      {item.sql}
                    </pre>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => {
                          setSqlQuery(item.sql);
                          setActiveMode('code');
                          setShowHistoryModal(false);
                        }}
                        className="text-xs text-brand-teal hover:underline font-medium"
                      >
                        Load to Editor
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SAVE QUERY MODAL */}
      {/* ===================================================================== */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-brand-amber" />
              Save Named Query
            </h3>
            <p className="text-xs text-slate-400">
              Save this query locally to easily recall it during demonstrations and analysis.
            </p>
            <input
              type="text"
              value={newSaveName}
              onChange={(e) => setNewSaveName(e.target.value)}
              placeholder="e.g. BTC 1-Hour Candles vs Volume"
              className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-medium focus:outline-none focus:border-brand-teal"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentQuery}
                disabled={!newSaveName.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-navy-950 bg-brand-teal hover:bg-brand-teal/90 disabled:opacity-50"
              >
                Save Query
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
