import { useEffect, useState } from 'react';
import { Tag, Plus, X, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';

type StatusType = Database['public']['Tables']['status_types']['Row'];

const colorOptions = [
  { value: 'green', label: 'Green', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  { value: 'red', label: 'Red', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  { value: 'pink', label: 'Pink', bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
  { value: 'gray', label: 'Gray', bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
];

export default function StatusTypeManagement() {
  const [statusTypes, setStatusTypes] = useState<StatusType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState<StatusType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: 'gray',
  });
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    loadStatusTypes();
  }, []);

  const loadStatusTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('status_types')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setStatusTypes(data || []);
    } catch (error) {
      console.error('Error loading status types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingStatus) {
        const { error } = await supabase
          .from('status_types')
          .update({
            name: formData.name,
            color: formData.color,
          })
          .eq('id', editingStatus.id);

        if (error) throw error;
      } else {
        const maxOrder = Math.max(...statusTypes.map(s => s.display_order), 0);
        const { error } = await supabase.from('status_types').insert({
          name: formData.name,
          color: formData.color,
          display_order: maxOrder + 1,
          created_by: user?.id,
        });

        if (error) throw error;
      }

      setFormData({ name: '', color: 'gray' });
      setShowModal(false);
      setEditingStatus(null);
      loadStatusTypes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save status type');
    }
  };

  const handleToggleActive = async (status: StatusType) => {
    try {
      const { error } = await supabase
        .from('status_types')
        .update({ is_active: !status.is_active })
        .eq('id', status.id);

      if (error) throw error;
      loadStatusTypes();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleDelete = async (status: StatusType) => {
    if (status.is_default) {
      alert('Cannot delete default status types');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${status.name}"?`)) return;

    try {
      const { error } = await supabase.from('status_types').delete().eq('id', status.id);
      if (error) throw error;
      loadStatusTypes();
    } catch (error) {
      console.error('Error deleting status type:', error);
    }
  };

  const openEditModal = (status: StatusType) => {
    setEditingStatus(status);
    setFormData({
      name: status.name,
      color: status.color,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStatus(null);
    setFormData({ name: '', color: 'gray' });
    setError(null);
  };

  const getColorClasses = (color: string) => {
    const colorOption = colorOptions.find(c => c.value === color);
    return colorOption || colorOptions[colorOptions.length - 1];
  };

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
          <Tag className="w-6 h-6 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">Status Types</h2>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Status Type</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statusTypes.map((status) => {
          const colorClasses = getColorClasses(status.color);
          return (
            <div
              key={status.id}
              className={`border-2 rounded-lg p-4 ${
                status.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${colorClasses.bg} ${colorClasses.text} ${colorClasses.border}`}>
                    {status.name}
                  </div>
                  {status.is_default && (
                    <span className="ml-2 text-xs text-gray-500">(Default)</span>
                  )}
                  {!status.is_active && (
                    <span className="ml-2 text-xs text-red-600">(Inactive)</span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleToggleActive(status)}
                  className={`flex-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                    status.is_active
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                >
                  {status.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => openEditModal(status)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {!status.is_default && (
                  <button
                    onClick={() => handleDelete(status)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editingStatus ? 'Edit Status Type' : 'Add Status Type'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="e.g., Calibration, Cleaning"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                        formData.color === color.value
                          ? `${color.bg} ${color.text} ${color.border} ring-2 ring-gray-900`
                          : `${color.bg} ${color.text} ${color.border}`
                      }`}
                    >
                      {color.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  {editingStatus ? 'Update' : 'Add'} Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
