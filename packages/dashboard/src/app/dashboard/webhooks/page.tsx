// ── Webhook Manager UI ──

'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/layout/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { listWebhooks, createWebhook, updateWebhook, deleteWebhook, listWebhookDeliveries } from '@/lib/api';
import type { WebhookSubscription } from '@forge/types';
import { RefreshCw, Plus, Edit, Trash2, Activity, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookSubscription | null>(null);
  const [formData, setFormData] = useState({ name: '', url: '', events: '' });
  const [deliveries, setDeliveries] = useState<Record<string, unknown>[]>([]);
  const [showDeliveries, setShowDeliveries] = useState<string | null>(null);

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function loadWebhooks() {
    setIsLoading(true);
    try {
      const data = await listWebhooks();
      setWebhooks(data);
    } catch (err) {
      toast.error('Failed to load webhooks');
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateForm() {
    setEditingWebhook(null);
    setFormData({ name: '', url: '', events: '' });
    setShowForm(true);
  }

  function openEditForm(webhook: WebhookSubscription) {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: (webhook.events || []).join(', '),
    });
    setShowForm(true);
  }

  async function handleSave() {
    const events = formData.events.split(',').map((e) => e.trim()).filter(Boolean);
    if (!formData.name || !formData.url || events.length === 0) {
      toast.error('Name, URL, and at least one event required');
      return;
    }

    try {
      if (editingWebhook) {
        await updateWebhook(editingWebhook.id, { name: formData.name, url: formData.url, events });
        toast.success('Webhook updated');
      } else {
        await createWebhook({ name: formData.name, url: formData.url, events });
        toast.success('Webhook created');
      }
      setShowForm(false);
      loadWebhooks();
    } catch (err) {
      toast.error('Failed to save webhook');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this webhook permanently?')) return;
    try {
      await deleteWebhook(id);
      toast.success('Webhook deleted');
      loadWebhooks();
    } catch (err) {
      toast.error('Failed to delete webhook');
    }
  }

  async function handleToggleActive(webhook: WebhookSubscription) {
    try {
      await updateWebhook(webhook.id, { is_active: !webhook.is_active });
      toast.success(`Webhook ${webhook.is_active ? 'paused' : 'activated'}`);
      loadWebhooks();
    } catch (err) {
      toast.error('Failed to toggle webhook');
    }
  }

  async function handleViewDeliveries(webhookId: string) {
    try {
      const data = await listWebhookDeliveries(webhookId);
      setDeliveries(data);
      setShowDeliveries(webhookId);
    } catch (err) {
      toast.error('Failed to load deliveries');
    }
  }

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'url', header: 'URL' },
    {
      key: 'events',
      header: 'Events',
      cell: (wh: WebhookSubscription) => (
        <div className="flex gap-1 flex-wrap">
          {(wh.events || []).map((event) => (
            <Badge key={event} variant="outline" className="text-xs">{event}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      cell: (wh: WebhookSubscription) => (
        <Badge variant={wh.is_active ? 'success' : 'secondary'}>
          {wh.is_active ? 'Active' : 'Paused'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (wh: WebhookSubscription) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleToggleActive(wh)}>
            {wh.is_active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleViewDeliveries(wh.id)}>
            <Activity className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditForm(wh)}>
            <Edit className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(wh.id)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const deliveryColumns = [
    { key: 'event', header: 'Event' },
    {
      key: 'status',
      header: 'Status',
      cell: (d: Record<string, unknown>) => (
        <Badge variant={d.status === 'delivered' ? 'success' : d.status === 'failed' ? 'destructive' : 'warning'}>
          {d.status as string}
        </Badge>
      ),
    },
    { key: 'attempts', header: 'Attempts' },
    { key: 'created_at', header: 'Time' },
  ];

  return (
    <div>
      <PageHeader
        title="Webhook Manager"
        description="Create and manage webhook subscriptions"
        actions={
          <div className="flex gap-2">
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              New Webhook
            </Button>
            <Button variant="outline" onClick={loadWebhooks} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Webhook Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={webhooks}
            isLoading={isLoading}
            emptyMessage="No webhooks configured"
          />
        </CardContent>
      </Card>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle>{editingWebhook ? 'Edit Webhook' : 'New Webhook'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Name</label>
                <Input
                  placeholder="My Webhook"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">URL</label>
                <Input
                  placeholder="https://example.com/webhook"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">
                  Events <span className="text-muted-foreground">(comma-separated)</span>
                </label>
                <Input
                  placeholder="user.created, user.updated, file.uploaded"
                  value={formData.events}
                  onChange={(e) => setFormData({ ...formData, events: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave}>{editingWebhook ? 'Update' : 'Create'}</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delivery Log Modal */}
      {showDeliveries && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Delivery Logs</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowDeliveries(null)}>Close</Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={deliveryColumns}
                data={deliveries}
                emptyMessage="No delivery logs"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
