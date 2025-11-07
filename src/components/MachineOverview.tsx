import { useEffect, useState } from 'react';
import { Activity, RefreshCw, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import MachineCard from './MachineCard';
import { useAuth } from '../contexts/AuthContext';

type Machine = Database['public']['Tables']['machines']['Row'];
type Department = Database['public']['Tables']['departments']['Row'];

interface MachineOverviewProps {
  onMachineSelect: (machine: Machine) => void;
}

export default function MachineOverview({ onMachineSelect }: MachineOverviewProps) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [machineFilter, setMachineFilter] = useState<string>('');
  const { profile, user } = useAuth();

  const canUpdate = profile?.role === 'admin' || profile?.role === 'team_leader' || profile?.role === 'operator';
  const isAdmin = profile?.role === 'admin';
  const showFilters = !user || isAdmin;

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('machines-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'machines',
        },
        () => {
          loadMachines();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.role]);

  const loadData = async () => {
    await Promise.all([loadMachines(), loadDepartments()]);
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

  const loadMachines = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('machine_code');

      if (error) throw error;
      setMachines(data || []);
    } catch (error) {
      console.error('Makineler yüklenirken hata oluştu:', error);
    } finally {
      setLoading(false);
    }
  };

  let filteredMachines = machines;

  if (statusFilter !== 'All') {
    filteredMachines = filteredMachines.filter(m => m.current_status === statusFilter);
  }

  if (departmentFilter !== 'All') {
    filteredMachines = filteredMachines.filter(m => m.department_id === departmentFilter);
  }

  if (machineFilter) {
    const search = machineFilter.toLowerCase();
    filteredMachines = filteredMachines.filter(
      m =>
        m.machine_code.toLowerCase().includes(search) ||
        m.machine_name.toLowerCase().includes(search)
    );
  }

  const statusCounts = {
    All: machines.length,
    Çalışıyor: machines.filter(m => m.current_status === 'Çalışıyor').length,
    Boşta: machines.filter(m => m.current_status === 'Boşta').length,
    Arıza: machines.filter(m => m.current_status === 'Arıza').length,
    Bakımda: machines.filter(m => m.current_status === 'Bakımda').length,
  };

  const getDepartmentName = (deptId: string | null) => {
    if (!deptId) return 'Unassigned';
    return departments.find(d => d.id === deptId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Activity className="w-8 h-8 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Makine Durum Panosu</h2>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Yenile</span>
        </button>
      </div>

      {showFilters && (
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
                Makine Ara
              </label>
              <input
                type="text"
                value={machineFilter}
                onChange={(e) => setMachineFilter(e.target.value)}
                placeholder="Kod veya ad ile ara..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              statusFilter === status
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status} ({count})
          </button>
        ))}
      </div>

      {loading && machines.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Makineler yükleniyor...</p>
        </div>
      ) : filteredMachines.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600">Filtrelerinle eşleşen makine bulunamadı</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMachines.map((machine) => (
            <MachineCard
              key={machine.id}
              machine={machine}
              onClick={() => onMachineSelect(machine)}
              canUpdate={canUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
