import { useEffect, useState } from 'react';
import { History, Filter, ArrowRight, Calendar, User as UserIcon, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';

type StatusHistory = Database['public']['Tables']['status_history']['Row'];
type Machine = Database['public']['Tables']['machines']['Row'];
type Department = Database['public']['Tables']['departments']['Row'];

interface HistoryEntry extends StatusHistory {
  machine?: Machine;
  user_name?: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [machineFilter, setMachineFilter] = useState<string>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const { user, profile } = useAuth();

  useEffect(() => {
    loadData();
  }, [profile?.role, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadHistory(), loadMachines(), loadDepartments()]);
    } catch (error) {
      console.error('Geçmiş yüklenirken hata oluştu:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('machine_code');

      if (error) throw error;
      setMachines(data || []);
    } catch (error) {
      console.error('Makineler yüklenirken hata oluştu:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Bölümler yüklenirken hata oluştu:', error);
    }
  };

  const loadHistory = async () => {
    try {
      let query = supabase
        .from('status_history')
        .select('*')
        .order('changed_at', { ascending: false });

      if (user && profile?.role === 'operator') {
        const { data: assignments } = await supabase
          .from('machine_operators')
          .select('machine_id')
          .eq('user_id', user.id);

        const machineIds = assignments?.map(a => a.machine_id) || [];
        if (machineIds.length > 0) {
          query = query.in('machine_id', machineIds);
        } else {
          query = query.eq('machine_id', '00000000-0000-0000-0000-000000000000');
        }
      } else if (user && profile?.role === 'team_leader') {
        const { data: myDepts } = await supabase
          .from('department_leaders')
          .select('department_id')
          .eq('user_id', user.id);

        const deptIds = myDepts?.map(d => d.department_id) || [];

        if (deptIds.length > 0) {
          const { data: deptMachines } = await supabase
            .from('machines')
            .select('id')
            .in('department_id', deptIds);

          const machineIds = deptMachines?.map(m => m.id) || [];
          if (machineIds.length > 0) {
            query = query.in('machine_id', machineIds);
          } else {
            query = query.eq('machine_id', '00000000-0000-0000-0000-000000000000');
          }
        } else {
          query = query.eq('machine_id', '00000000-0000-0000-0000-000000000000');
        }
      }

      const { data: historyData, error: historyError } = await query;

      if (historyError) throw historyError;

      const machineIds = [...new Set(historyData?.map(h => h.machine_id) || [])];
      const userIds = [...new Set(historyData?.map(h => h.changed_by) || [])];

      const [{ data: machinesData }, { data: profiles }] = await Promise.all([
        supabase.from('machines').select('*').in('id', machineIds),
        supabase.from('profiles').select('id, full_name').in('id', userIds),
      ]);

      const machineMap = new Map(machinesData?.map(m => [m.id, m]) || []);
      const userMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      const enrichedHistory = historyData?.map(h => ({
        ...h,
        machine: machineMap.get(h.machine_id),
        user_name: userMap.get(h.changed_by) || 'Bilinmeyen Kullanıcı',
      })) || [];

      setHistory(enrichedHistory);
    } catch (error) {
      console.error('Geçmiş yüklenirken hata oluştu:', error);
    }
  };

  let filteredHistory = history;

  if (departmentFilter !== 'All') {
    const deptMachines = machines.filter(m => m.department_id === departmentFilter);
    const deptMachineIds = deptMachines.map(m => m.id);
    filteredHistory = filteredHistory.filter(h => deptMachineIds.includes(h.machine_id));
  }

  if (machineFilter !== 'All') {
    filteredHistory = filteredHistory.filter(h => h.machine_id === machineFilter);
  }

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      Çalışıyor: 'bg-green-100 text-green-800 border-green-200',
      Boşta: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      Arıza: 'bg-red-100 text-red-800 border-red-200',
      Bakımda: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Geçmiş yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <History className="w-8 h-8 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Durum Değişikliği Geçmişi</h2>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Filter className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Filtreler</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bölüm
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="All">Tüm Bölümler</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Makine
            </label>
            <select
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="All">Tüm Makineler</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.machine_code} - {machine.machine_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600">Geçmiş kaydı bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((entry) => {
            const { date, time } = formatDate(entry.changed_at);
            return (
              <div
                key={entry.id}
                className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">
                        {entry.machine?.machine_code || 'Bilinmeyen Makine'}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {entry.machine?.machine_name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {date} - {time}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 mb-4">
                  {entry.previous_status && (
                    <>
                      <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(entry.previous_status)}`}>
                        {entry.previous_status}
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </>
                  )}
                  <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(entry.status)}`}>
                    {entry.status}
                  </div>
                </div>

                <div className="flex items-center space-x-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center text-sm text-gray-600">
                    <UserIcon className="w-4 h-4 mr-2" />
                    <span>{entry.user_name}</span>
                  </div>

                  {entry.comment && (
                    <div className="flex-1 flex items-start text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                      <MessageSquare className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{entry.comment}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
