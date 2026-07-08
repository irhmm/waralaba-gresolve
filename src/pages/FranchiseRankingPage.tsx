import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Trophy, Copy, RefreshCw } from 'lucide-react';

interface RankRow {
  franchise_id: string;
  franchise_name: string;
  franchise_code: string;
  admin_income: number;
  worker_income: number;
  expenses: number;
  profit_share: number;
  omset: number;
  rank_position: number;
}

const formatIDR = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`);

const FranchiseRankingPage: React.FC = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(false);

  if (userRole && userRole.role !== 'franchise') {
    return <Navigate to="/" replace />;
  }

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_franchise_ranking', { target_month_year: month });
      if (error) throw error;
      setRows((data || []) as RankRow[]);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Gagal memuat peringkat', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const myFranchiseId = userRole?.franchise_id;
  const myRow = useMemo(() => rows.find((r) => r.franchise_id === myFranchiseId), [rows, myFranchiseId]);

  const copyText = useMemo(() => {
    const header = `🏆 PERINGKAT FRANCHISE — ${monthLabel(month).toUpperCase()}\n(berdasarkan Omset bulan ini)\n`;
    const lines = rows
      .map((r) => {
        const mark = r.franchise_id === myFranchiseId ? ' ⭐' : '';
        return `${medal(r.rank_position)} ${r.franchise_name}${mark}\n    Omset: ${formatIDR(r.omset)}`;
      })
      .join('\n');
    const footer = myRow
      ? `\n\nPosisi Anda: ${medal(myRow.rank_position)} ${myRow.franchise_name} — ${formatIDR(myRow.omset)}`
      : '';
    return `${header}\n${lines}${footer}`;
  }, [rows, month, myFranchiseId, myRow]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      toast({ title: 'Disalin', description: 'Teks peringkat siap dibagikan ke grup.' });
    } catch {
      toast({ title: 'Gagal menyalin', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="w-7 h-7 text-yellow-500" /> Peringkat Franchise
          </h1>
          <p className="text-muted-foreground">Ranking omset semua franchise per bulan</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-[180px]"
          />
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCopy} disabled={!rows.length}>
            <Copy className="w-4 h-4 mr-2" /> Salin untuk Grup
          </Button>
        </div>
      </div>

      {myRow && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Posisi Franchise Anda</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{medal(myRow.rank_position)}</div>
              <div>
                <div className="font-semibold text-lg">{myRow.franchise_name}</div>
                <div className="text-xs text-muted-foreground">{myRow.franchise_code}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Omset</div>
              <div className="text-xl font-bold">{formatIDR(myRow.omset)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Peringkat — {monthLabel(month)}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Memuat...</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Belum ada data</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => {
                const isMe = r.franchise_id === myFranchiseId;
                return (
                  <div
                    key={r.franchise_id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isMe ? 'bg-primary/5 border-primary/40' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-2xl w-10 text-center">{medal(r.rank_position)}</div>
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          {r.franchise_name}
                          {isMe && <Badge variant="secondary" className="text-[10px]">Anda</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Admin {formatIDR(r.admin_income)} · Worker {formatIDR(r.worker_income)} · Pengeluaran {formatIDR(r.expenses)} · Bagi Hasil {formatIDR(r.profit_share)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <div className="text-xs text-muted-foreground">Omset</div>
                      <div className="font-bold">{formatIDR(r.omset)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FranchiseRankingPage;
