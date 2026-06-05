// ── Storage Browser UI ──

'use client';

import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/layout/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { listBuckets, listFiles, createBucket } from '@/lib/api';
import type { Bucket } from '@forge/types';
import { RefreshCw, Upload, Plus, HardDrive, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function StoragePage() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [files, setFiles] = useState<Record<string, unknown>[]>([]);
  const [isLoadingBuckets, setIsLoadingBuckets] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [showCreateBucket, setShowCreateBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBuckets();
  }, []);

  async function loadBuckets() {
    setIsLoadingBuckets(true);
    try {
      const data = await listBuckets();
      setBuckets(data);
    } catch (err) {
      toast.error('Failed to load buckets');
    } finally {
      setIsLoadingBuckets(false);
    }
  }

  async function selectBucket(bucket: Bucket) {
    setSelectedBucket(bucket);
    setIsLoadingFiles(true);
    try {
      const data = await listFiles(bucket.name);
      setFiles(data);
    } catch (err) {
      toast.error('Failed to load files');
    } finally {
      setIsLoadingFiles(false);
    }
  }

  async function handleCreateBucket() {
    if (!newBucketName.trim()) return;
    try {
      await createBucket({ name: newBucketName });
      toast.success(`Bucket "${newBucketName}" created`);
      setNewBucketName('');
      setShowCreateBucket(false);
      loadBuckets();
    } catch (err) {
      toast.error('Failed to create bucket');
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedBucket) return;

    setUploading(true);
    try {
      // Upload via the api helper
      const { uploadFile } = await import('@/lib/api');
      await uploadFile(selectedBucket.name, file.name, file);
      toast.success(`"${file.name}" uploaded`);
      selectBucket(selectedBucket);
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const fileColumns = [
    { key: 'path', header: 'Path' },
    { key: 'content_type', header: 'Type' },
    {
      key: 'size_bytes',
      header: 'Size',
      cell: (file: Record<string, unknown>) => {
        const bytes = file.size_bytes as number;
        if (!bytes) return '-';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      },
    },
    {
      key: 'created_at',
      header: 'Uploaded',
      cell: (file: Record<string, unknown>) =>
        file.created_at ? new Date(file.created_at as string).toLocaleDateString() : '-',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Storage Browser"
        description="Browse buckets and manage files"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreateBucket(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Bucket
            </Button>
            <Button variant="outline" onClick={loadBuckets} disabled={isLoadingBuckets}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingBuckets ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Create Bucket Dialog */}
      {showCreateBucket && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create Bucket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Bucket name"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={handleCreateBucket}>Create</Button>
                <Button variant="outline" onClick={() => setShowCreateBucket(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Bucket List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Buckets</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {buckets.map((bucket) => (
                  <button
                    key={bucket.id}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-accent transition-colors flex items-center gap-3 ${
                      selectedBucket?.id === bucket.id ? 'bg-accent font-medium' : ''
                    }`}
                    onClick={() => selectBucket(bucket)}
                  >
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span>{bucket.name}</span>
                    <Badge variant={bucket.public ? 'secondary' : 'outline'} className="ml-auto">
                      {bucket.public ? 'public' : 'private'}
                    </Badge>
                  </button>
                ))}
                {buckets.length === 0 && (
                  <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                    {isLoadingBuckets ? 'Loading...' : 'No buckets'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* File Browser */}
        <div className="lg:col-span-3">
          {selectedBucket ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  {selectedBucket.name}
                </CardTitle>
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload File'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={fileColumns}
                  data={files}
                  isLoading={isLoadingFiles}
                  emptyMessage="No files in this bucket"
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a bucket to browse its files</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
