// ── Table Browser UI ──

'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/layout/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { listTables, getTableInfo, queryTable, insertRow, updateRow, deleteRow, upsertRlsPolicy, deleteRlsPolicy } from '@/lib/api';
import { RefreshCw, Plus, Edit, Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function TablesPage() {
  const [tables, setTables] = useState<{ table_name: string; table_schema: string }[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<{
    columns: Record<string, unknown>[];
    policies: Record<string, unknown>[];
  } | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewRowForm, setShowNewRowForm] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [newPolicy, setNewPolicy] = useState({ name: '', definition: '', action: 'permit' as 'permit' | 'deny' });

  useEffect(() => {
    loadTables();
  }, []);

  async function loadTables() {
    setIsLoadingTables(true);
    try {
      const data = await listTables();
      setTables(data);
    } catch (err) {
      toast.error('Failed to load tables');
    } finally {
      setIsLoadingTables(false);
    }
  }

  async function selectTable(tableName: string) {
    setSelectedTable(tableName);
    setIsLoadingRows(true);
    setShowNewRowForm(false);
    try {
      const schema = 'public'; // Default schema
      const [info, rowsData] = await Promise.all([
        getTableInfo(schema, tableName),
        queryTable(schema, tableName, { limit: 50 }),
      ]);
      setTableInfo(info);
      setRows(rowsData);
    } catch (err) {
      toast.error('Failed to load table data');
    } finally {
      setIsLoadingRows(false);
    }
  }

  async function handleInsertRow() {
    if (!selectedTable) return;
    try {
      await insertRow('public', selectedTable, newRowData);
      toast.success('Row inserted');
      setShowNewRowForm(false);
      setNewRowData({});
      selectTable(selectedTable);
    } catch (err) {
      toast.error('Failed to insert row');
    }
  }

  async function handleDeleteRow(id: string) {
    if (!selectedTable) return;
    if (!confirm('Are you sure you want to delete this row?')) return;
    try {
      await deleteRow('public', selectedTable, id);
      toast.success('Row deleted');
      selectTable(selectedTable);
    } catch (err) {
      toast.error('Failed to delete row');
    }
  }

  async function handleUpsertPolicy() {
    if (!selectedTable) return;
    try {
      await upsertRlsPolicy('public', selectedTable, newPolicy);
      toast.success('RLS policy created');
      setShowPolicyForm(false);
      setNewPolicy({ name: '', definition: '', action: 'permit' });
      selectTable(selectedTable);
    } catch (err) {
      toast.error('Failed to create RLS policy');
    }
  }

  async function handleDeletePolicy(policyName: string) {
    if (!selectedTable) return;
    if (!confirm(`Delete policy "${policyName}"?`)) return;
    try {
      await deleteRlsPolicy('public', selectedTable, policyName);
      toast.success('Policy deleted');
      selectTable(selectedTable);
    } catch (err) {
      toast.error('Failed to delete policy');
    }
  }

  const filteredTables = tables.filter((t) =>
    t.table_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Table Browser"
        description="Browse, view, and edit database tables"
        actions={
          <Button variant="outline" onClick={loadTables} disabled={isLoadingTables}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingTables ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Table List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tables</CardTitle>
              <Input
                placeholder="Search tables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[60vh] overflow-y-auto">
                {filteredTables.map((table) => (
                  <button
                    key={table.table_name}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-accent transition-colors ${
                      selectedTable === table.table_name ? 'bg-accent font-medium' : ''
                    }`}
                    onClick={() => selectTable(table.table_name)}
                  >
                    {table.table_name}
                  </button>
                ))}
                {filteredTables.length === 0 && (
                  <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                    {isLoadingTables ? 'Loading...' : 'No tables found'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table Data */}
        <div className="lg:col-span-3 space-y-6">
          {selectedTable && tableInfo ? (
            <>
              {/* Row Data */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">{selectedTable}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowPolicyForm(!showPolicyForm)}>
                      <Shield className="h-4 w-4 mr-2" />
                      RLS
                    </Button>
                    <Button size="sm" onClick={() => setShowNewRowForm(!showNewRowForm)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Row
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* New Row Form */}
                  {showNewRowForm && (
                    <div className="mb-6 p-4 border rounded-lg bg-muted/30">
                      <h4 className="text-sm font-medium mb-3">Insert New Row</h4>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {tableInfo.columns.map((col: Record<string, unknown>) => (
                          <div key={col.column_name as string}>
                            <label className="text-xs text-muted-foreground block mb-1">
                              {col.column_name as string}
                              {col.is_nullable === 'NO' ? ' *' : ''}
                            </label>
                            <Input
                              placeholder={(col.column_name as string) || ''}
                              value={newRowData[col.column_name as string] || ''}
                              onChange={(e) =>
                                setNewRowData({ ...newRowData, [col.column_name as string]: e.target.value })
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleInsertRow}>Insert</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowNewRowForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {/* RLS Policy Form */}
                  {showPolicyForm && (
                    <div className="mb-6 p-4 border rounded-lg bg-muted/30">
                      <h4 className="text-sm font-medium mb-3">Create RLS Policy</h4>
                      <div className="space-y-3 mb-4">
                        <Input
                          placeholder="Policy name"
                          value={newPolicy.name}
                          onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                        />
                        <Input
                          placeholder="Policy definition (SQL expression, e.g., tenant_id = current_setting('app.tenant_id'))"
                          value={newPolicy.definition}
                          onChange={(e) => setNewPolicy({ ...newPolicy, definition: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpsertPolicy}>Create Policy</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowPolicyForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {/* Current Policies */}
                  {tableInfo.policies.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">Active RLS Policies</h4>
                      <div className="space-y-2">
                        {tableInfo.policies.map((policy: Record<string, unknown>) => (
                          <div key={policy.policyname as string} className="flex items-center justify-between p-2 bg-muted/20 rounded-md text-sm">
                            <div>
                              <span className="font-medium">{policy.policyname as string}</span>
                              <span className="text-muted-foreground ml-2">
                                ({policy.cmd as string} — {policy.qual as string || 'no filter'})
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePolicy(policy.policyname as string)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <DataTable
                    columns={tableInfo.columns.map((col: Record<string, unknown>) => ({
                      key: col.column_name as string,
                      header: col.column_name as string,
                      className: col.column_name === 'id' ? 'w-24' : undefined,
                    }))}
                    data={rows}
                    isLoading={isLoadingRows}
                    emptyMessage="No rows found in this table"
                  />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a table from the left to browse its data</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
