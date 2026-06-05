// ── Main Dashboard Page — Overview ──

'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/layout/data-table';
import { getHealth, listUsers, listTables, listFunctions, listWebhooks, listBuckets } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Activity,
  Database,
  Users,
  HardDrive,
  Webhook,
  FunctionSquare,
  ShieldCheck,
  Server,
} from 'lucide-react';

export default function DashboardPage() {
  const { state } = useAuth();
  const [health, setHealth] = useState<{ status: string; checks: Record<string, string> } | null>(null);
  const [stats, setStats] = useState({
    users: 0,
    tables: 0,
    functions: 0,
    webhooks: 0,
    buckets: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [healthData, users, tables, funcs, webhooks, buckets] = await Promise.all([
          getHealth(),
          listUsers(),
          listTables(),
          listFunctions(),
          listWebhooks(),
          listBuckets(),
        ]);

        setHealth(healthData);
        setStats({
          users: users.length,
          tables: tables.length,
          functions: funcs.length,
          webhooks: webhooks.length,
          buckets: buckets.length,
        });
      } catch {
        // Partial failure is okay for dashboard
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const statCards = [
    { title: 'Users', value: stats.users, icon: Users, color: 'text-blue-500' },
    { title: 'Tables', value: stats.tables, icon: Database, color: 'text-green-500' },
    { title: 'Functions', value: stats.functions, icon: FunctionSquare, color: 'text-purple-500' },
    { title: 'Webhooks', value: stats.webhooks, icon: Webhook, color: 'text-orange-500' },
    { title: 'Buckets', value: stats.buckets, icon: HardDrive, color: 'text-cyan-500' },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${state.user?.name || state.user?.preferred_username || 'Admin'}`}
        description="Overview of your Forge platform"
      />

      {/* Health Status */}
      {health && (
        <div className="mb-8">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Server className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Service Status:</span>
              <Badge variant={health.status === 'healthy' ? 'success' : 'warning'}>
                {health.status}
              </Badge>
              {Object.entries(health.checks).map(([service, status]) => (
                <Badge key={service} variant={status === 'ok' ? 'success' : 'destructive'}>
                  {service}: {status}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? (
                    <div className="h-8 w-12 bg-muted animate-pulse rounded" />
                  ) : (
                    stat.value
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health Checks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health ? (
            <div className="space-y-2">
              {Object.entries(health.checks).map(([service, status]) => (
                <div key={service} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm font-medium capitalize">{service}</span>
                  <Badge variant={status === 'ok' ? 'success' : 'destructive'}>{status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Health check data unavailable</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
