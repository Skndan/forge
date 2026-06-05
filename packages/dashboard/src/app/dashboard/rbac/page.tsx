// ── RBAC Editor UI ──

'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/layout/data-table';
import { listRoles, createRole, deleteRole, listPermissions, listUsers, assignRole, removeRole } from '@/lib/api';
import { RefreshCw, Plus, Trash2, UserPlus, Shield, Key } from 'lucide-react';
import { toast } from 'sonner';

export default function RbacPage() {
  const [roles, setRoles] = useState<Record<string, unknown>[]>([]);
  const [permissions, setPermissions] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [showAssignRole, setShowAssignRole] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    await Promise.all([loadRoles(), loadPermissions(), loadUsersList()]);
  }

  async function loadRoles() {
    setIsLoadingRoles(true);
    try {
      const data = await listRoles();
      setRoles(data);
    } catch (err) {
      toast.error('Failed to load roles');
    } finally {
      setIsLoadingRoles(false);
    }
  }

  async function loadPermissions() {
    setIsLoadingPermissions(true);
    try {
      const data = await listPermissions();
      setPermissions(data);
    } catch (err) {
      toast.error('Failed to load permissions');
    } finally {
      setIsLoadingPermissions(false);
    }
  }

  async function loadUsersList() {
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      // Silent fail
    }
  }

  async function handleCreateRole() {
    if (!newRoleName.trim()) return;
    try {
      await createRole({ name: newRoleName, description: newRoleDescription });
      toast.success(`Role "${newRoleName}" created`);
      setNewRoleName('');
      setNewRoleDescription('');
      setShowCreateRole(false);
      loadRoles();
    } catch (err) {
      toast.error('Failed to create role');
    }
  }

  async function handleDeleteRole(id: string) {
    if (!confirm('Delete this role? Associated permissions will be lost.')) return;
    try {
      await deleteRole(id);
      toast.success('Role deleted');
      loadRoles();
    } catch (err) {
      toast.error('Failed to delete role');
    }
  }

  async function handleAssignRole() {
    if (!selectedUser || !selectedRoleId) return;
    try {
      await assignRole(selectedUser, selectedRoleId);
      toast.success('Role assigned to user');
      setShowAssignRole(false);
      setSelectedUser(null);
      setSelectedRoleId(null);
    } catch (err) {
      toast.error('Failed to assign role');
    }
  }

  async function handleRemoveRole(userId: string, roleId: string) {
    if (!confirm('Remove this role from the user?')) return;
    try {
      await removeRole(userId, roleId);
      toast.success('Role removed');
    } catch (err) {
      toast.error('Failed to remove role');
    }
  }

  const roleColumns = [
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description' },
    {
      key: 'created_at',
      header: 'Created',
      cell: (role: Record<string, unknown>) =>
        role.created_at ? new Date(role.created_at as string).toLocaleDateString() : '-',
    },
    {
      key: 'actions',
      header: '',
      cell: (role: Record<string, unknown>) => (
        <Button variant="ghost" size="sm" onClick={() => handleDeleteRole(role.id as string)}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      ),
    },
  ];

  const permissionColumns = [
    { key: 'resource', header: 'Resource' },
    { key: 'action', header: 'Action' },
    {
      key: 'role_name',
      header: 'Role',
      cell: (perm: Record<string, unknown>) => (
        <Badge variant="outline">{perm.role_name as string || '-'}</Badge>
      ),
    },
    { key: 'conditions', header: 'Conditions' },
  ];

  return (
    <div>
      <PageHeader
        title="RBAC Editor"
        description="Manage roles, permissions, and user assignments"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAssignRole(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Assign Role
            </Button>
            <Button onClick={() => setShowCreateRole(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Role
            </Button>
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Create Role Dialog */}
      {showCreateRole && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Create Role
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Role name (e.g., editor, viewer)"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
              <Input
                placeholder="Description (optional)"
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={handleCreateRole}>Create</Button>
                <Button variant="outline" onClick={() => setShowCreateRole(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assign Role Dialog */}
      {showAssignRole && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Assign Role to User
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">User</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedUser || ''}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">Select a user...</option>
                  {users.map((u: Record<string, unknown>) => (
                    <option key={u.id as string} value={u.id as string}>
                      {(u.email as string) || (u.display_name as string)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Role</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedRoleId || ''}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                >
                  <option value="">Select a role...</option>
                  {roles.map((r: Record<string, unknown>) => (
                    <option key={r.id as string} value={r.id as string}>
                      {r.name as string}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAssignRole} disabled={!selectedUser || !selectedRoleId}>
                  Assign
                </Button>
                <Button variant="outline" onClick={() => setShowAssignRole(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Roles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={roleColumns}
              data={roles}
              isLoading={isLoadingRoles}
              emptyMessage="No roles defined"
            />
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={permissionColumns}
              data={permissions}
              isLoading={isLoadingPermissions}
              emptyMessage="No permissions defined"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
