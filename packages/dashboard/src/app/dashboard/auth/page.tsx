// ── Auth Manager UI — Keycloak user management ──

'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/layout/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { listUsers, updateUser } from '@/lib/api';
import type { User } from '@forge/types';
import { RefreshCw, ShieldCheck, ShieldOff, Mail, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setIsLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleAdmin(user: User) {
    try {
      await updateUser(user.id, { is_admin: !user.is_admin });
      toast.success(`Admin ${user.is_admin ? 'removed from' : 'granted to'} ${user.email}`);
      loadUsers();
    } catch (err) {
      toast.error('Failed to update user');
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const columns = [
    { key: 'email', header: 'Email' },
    { key: 'display_name', header: 'Name' },
    {
      key: 'is_admin',
      header: 'Role',
      cell: (user: User) => (
        <Badge variant={user.is_admin ? 'default' : 'secondary'}>
          {user.is_admin ? 'Admin' : 'User'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      cell: (user: User) => new Date(user.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (user: User) => (
        <div className="flex gap-2">
          <Button
            variant={user.is_admin ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => handleToggleAdmin(user)}
          >
            {user.is_admin ? (
              <><ShieldOff className="h-3 w-3 mr-1" /> Remove Admin</>
            ) : (
              <><ShieldCheck className="h-3 w-3 mr-1" /> Make Admin</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedUser(user)}
          >
            View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Auth Manager"
        description="Manage Keycloak users and role assignments"
        actions={
          <div className="flex gap-2">
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
            <Button variant="outline" onClick={loadUsers} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredUsers}
            isLoading={isLoading}
            emptyMessage="No users found"
          />
        </CardContent>
      </Card>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle>{selectedUser.display_name || selectedUser.email}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{selectedUser.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Created: {new Date(selectedUser.created_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant={selectedUser.is_admin ? 'default' : 'secondary'}>
                  {selectedUser.is_admin ? 'Admin' : 'User'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Tenant:</span>
                <span className="text-sm">{selectedUser.tenant_id}</span>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant={selectedUser.is_admin ? 'destructive' : 'default'}
                  onClick={() => {
                    handleToggleAdmin(selectedUser);
                    setSelectedUser(null);
                  }}
                >
                  {selectedUser.is_admin ? 'Remove Admin' : 'Make Admin'}
                </Button>
                <Button variant="outline" onClick={() => setSelectedUser(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
