import { useEffect, useState } from 'react';
import { Settings, Plus, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';

type Machine = Database['public']['Tables']['machines']['Row'];
type Department = Database['public']['Tables']['departments']['Row'];

export default function MachineManagement() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    machine_code: '',
    machine_name: '',
    description: '',
    department_id: '',
  });
  const { user, profile } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: depts } = await supabase.from('departments').select('*').order('name');
      setDepartments(depts || []);

      let machineQuery = supabase.from('machines').select('*').order('machine_code');

      if (profile?.role === 'team_leader') {
        const { data: myDepts } = await supabase
          .from('department_leaders')
          .select('department_id')
          .eq('user_id', user?.id);

        const deptIds = myDepts?.map((d) => d.department_id) || [];
        if (deptIds.length > 0) {
          machineQuery = machineQuery.in('department_id', deptIds);
        } else {
          machineQuery = machineQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      const { data: machinesData } = await machineQuery;
      setMachines(machinesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('machines').insert({
        machine_code: formData.machine_code,
        machine_name: formData.machine_name,
        description: formData.description,
        department_id: formData.department_id || null,
      });

      if (error) throw error;

      setFormData({
        machine_code: '',
        machine_name: '',
        description: '',
        department_id: '',
      });
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error adding machine:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this machine?')) return;

    try {
      const { error } = await supabase.from('machines').delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting machine:', error);
    }
  };

  const getDepartmentName = (deptId: string | null) => {
    if (!deptId) return 'Unassigned';
    return departments.find((d) => d.id === deptId)?.name || 'Unknown';
  };

  const availableDepartments =
    profile?.role === 'admin'
      ? departments
      : departments.filter((dept) =>
          machines.some((m) => m.department_id === dept.id)
        );

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="w-6 h-6 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">Machine Management</h2>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Machine</span>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Status
              </th>
              {profile?.role === 'admin' && (
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {machines.map((machine) => (
              <tr key={machine.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {machine.machine_code}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{machine.machine_name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {getDepartmentName(machine.department_id)}
                </td>
                <td className="px-6 py-4 text-sm">{machine.current_status}</td>
                {profile?.role === 'admin' && (
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(machine.id)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Add Machine</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Machine Code
                </label>
                <input
                  type="text"
                  value={formData.machine_code}
                  onChange={(e) => setFormData({ ...formData, machine_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="e.g., M006"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Machine Name
                </label>
                <input
                  type="text"
                  value={formData.machine_name}
                  onChange={(e) => setFormData({ ...formData, machine_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="e.g., CNC Machine B"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="Brief description"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Department
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  required
                >
                  <option value="">Select Department</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  Add Machine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
