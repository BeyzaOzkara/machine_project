import { useEffect, useState } from 'react';
import { History, Clock, User, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type StatusHistoryRow = Database['public']['Tables']['status_history']['Row'];

interface HistoryEntry extends StatusHistoryRow {
  user_name?: string;
}

interface StatusHistoryProps {
  machineId: string;
  machineName: string;
}

export default function StatusHistory({ machineId, machineName }: StatusHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();

    const channel = supabase
      .channel('status-history-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'status_history',
          filter: `machine_id=eq.${machineId}`,
        },
        () => {
          loadHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [machineId]);

  const loadHistory = async () => {
    try {
      setLoading(true);

      const { data: historyData, error: historyError } = await supabase
        .from('status_history')
        .select('*')
        .eq('machine_id', machineId)
        .order('changed_at', { ascending: false })
        .limit(20);

      if (historyError) throw historyError;

      const userIds = [...new Set(historyData?.map(h => h.changed_by) || [])];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const userMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      const enrichedHistory = historyData?.map(h => ({
        ...h,
        user_name: userMap.get(h.changed_by) || 'Bilinmeyen Kullanıcı',
      })) || [];

      setHistory(enrichedHistory);
    } catch (error) {
      console.error('Geçmiş yüklenirken hata oluştu:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Çalışıyor':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Boşta':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Arıza':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Bakımda':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <History className="w-6 h-6 text-gray-700" />
        <h3 className="text-xl font-bold text-gray-900">Durum Geçmişi</h3>
      </div>

      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">Makine: <span className="font-semibold text-gray-900">{machineName}</span></p>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-3 text-gray-600 text-sm">Geçmiş yükleniyor...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Henüz herhangi bir durum değişikliği kaydedilmedi</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => {
            const changeDate = new Date(entry.changed_at);
            return (
              <div
                key={entry.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(entry.status)}`}>
                    {entry.status}
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="w-3 h-3 mr-1" />
                    <span>
                      {changeDate.toLocaleDateString()} {changeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <User className="w-4 h-4 mr-2" />
                  <span>{entry.user_name}</span>
                </div>

                {entry.comment && (
                  <div className="flex items-start text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <MessageSquare className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                    <span>{entry.comment}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
