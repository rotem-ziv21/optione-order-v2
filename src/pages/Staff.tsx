import React, { useState, useEffect } from 'react';
import { PlusCircle } from 'lucide-react';
import AddStaffModal from '../components/AddStaffModal';
import { getTeamByBusinessId, addTeamMember } from '../api/teamApi';
import { useAuth } from '../components/AuthProvider';

interface StaffMember {
  id: string;
  name: string;
  business_id: string;
}

export default function Staff() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const { user, businessId } = useAuth();

  useEffect(() => {
    if (businessId) {
      loadStaffMembers();
    }
  }, [businessId]);

  const loadStaffMembers = async () => {
    if (!businessId) return;
    const data = await getTeamByBusinessId(businessId);
    setStaffMembers(data || []);
  };

  const handleAddStaff = async (values: { name: string }) => {
    if (!businessId) return;
    
    const result = await addTeamMember(businessId, values.name);
    if (result) {
      await loadStaffMembers(); // טען מחדש את הרשימה
      setIsModalOpen(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ניהול אנשי צוות</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          <PlusCircle className="w-5 h-5" />
          הוסף איש צוות
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שם</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staffMembers.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{member.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="text-red-600 hover:text-red-800 mx-2">
                      מחק
                    </button>
                  </td>
                </tr>
              ))}
              {staffMembers.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-center text-gray-500">
                    לא נמצאו אנשי צוות. לחץ על "הוסף איש צוות" כדי להתחיל.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddStaffModal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddStaff}
      />
    </div>
  );
}
