// ── Function Manager UI ──

'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/layout/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { listFunctions, createFunction, updateFunction, deleteFunction, testInvokeFunction } from '@/lib/api';
import type { FunctionDefinition } from '@forge/types';
import { RefreshCw, Plus, Edit, Trash2, Play, Terminal } from 'lucide-react';
import { toast } from 'sonner';

export default function FunctionsPage() {
  const [functions, setFunctions] = useState<FunctionDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFn, setEditingFn] = useState<FunctionDefinition | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '', runtime: 'bun' as const, source: '', entrypoint: 'index.ts' });
  const [testPayload, setTestPayload] = useState('{}');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showTestModal, setShowTestModal] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadFunctions();
  }, []);

  async function loadFunctions() {
    setIsLoading(true);
    try {
      const data = await listFunctions();
      setFunctions(data);
    } catch (err) {
      toast.error('Failed to load functions');
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateForm() {
    setEditingFn(null);
    setFormData({ name: '', slug: '', runtime: 'bun', source: '', entrypoint: 'index.ts' });
    setShowForm(true);
  }

  function openEditForm(fn: FunctionDefinition) {
    setEditingFn(fn);
    setFormData({ name: fn.name, slug: fn.slug, runtime: fn.runtime, source: fn.source, entrypoint: fn.entrypoint });
    setShowForm(true);
  }

  async function handleSave() {
    if (!formData.name || !formData.slug || !formData.source) {
      toast.error('Name, slug, and source code are required');
      return;
    }

    try {
      if (editingFn) {
        await updateFunction(editingFn.id, formData);
        toast.success('Function updated');
      } else {
        await createFunction(formData);
        toast.success('Function created');
      }
      setShowForm(false);
      loadFunctions();
    } catch (err) {
      toast.error('Failed to save function');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this function permanently?')) return;
    try {
      await deleteFunction(id);
      toast.success('Function deleted');
      loadFunctions();
    } catch (err) {
      toast.error('Failed to delete function');
    }
  }

  async function handleTestInvoke(id: string) {
    setTesting(true);
    try {
      let payload: unknown;
      try {
        payload = JSON.parse(testPayload);
      } catch {
        toast.error('Invalid JSON payload');
        setTesting(false);
        return;
      }
      const result = await testInvokeFunction(id, payload);
      setTestResult(JSON.stringify(result, null, 2));
    } catch (err) {
      setTestResult(`Error: ${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'slug', header: 'Slug' },
    {
      key: 'runtime',
      header: 'Runtime',
      cell: (fn: FunctionDefinition) => (
        <Badge variant="outline">{fn.runtime}</Badge>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      cell: (fn: FunctionDefinition) => (
        <Badge variant={fn.is_active ? 'success' : 'secondary'}>
          {fn.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      cell: (fn: FunctionDefinition) => new Date(fn.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (fn: FunctionDefinition) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setShowTestModal(fn.id); setTestResult(null); setTestPayload('{}'); }}>
            <Play className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditForm(fn)}>
            <Edit className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(fn.id)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Function Manager"
        description="Deploy, update, and test serverless functions"
        actions={
          <div className="flex gap-2">
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              New Function
            </Button>
            <Button variant="outline" onClick={loadFunctions} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Functions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={functions}
            isLoading={isLoading}
            emptyMessage="No functions deployed"
          />
        </CardContent>
      </Card>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <Card className="w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingFn ? 'Edit Function' : 'New Function'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Name</label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Slug</label>
                  <Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Runtime</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.runtime}
                    onChange={(e) => setFormData({ ...formData, runtime: e.target.value as 'bun' | 'node' })}
                  >
                    <option value="bun">Bun</option>
                    <option value="node">Node.js</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Entrypoint</label>
                  <Input value={formData.entrypoint} onChange={(e) => setFormData({ ...formData, entrypoint: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Source Code</label>
                <textarea
                  className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="export default async function handler(req) { return { body: 'Hello!' }; }"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave}>{editingFn ? 'Update' : 'Create'}</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test Invoke Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <Card className="w-full max-w-2xl mx-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Test Invoke
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowTestModal(null)}>Close</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Payload (JSON)</label>
                <textarea
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                />
              </div>
              <Button onClick={() => handleTestInvoke(showTestModal)} disabled={testing}>
                {testing ? 'Invoking...' : 'Invoke'}
              </Button>
              {testResult !== null && (
                <div>
                  <label className="text-sm font-medium block mb-1">Result</label>
                  <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto whitespace-pre-wrap font-mono">
                    {testResult}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
