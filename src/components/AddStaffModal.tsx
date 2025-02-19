import React from 'react';
import { useForm } from 'react-hook-form';

interface AddStaffModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: {
    name: string;
  }) => void;
}

interface StaffFormData {
  name: string;
}

export default function AddStaffModal({ opened, onClose, onSubmit }: AddStaffModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<StaffFormData>({
    defaultValues: {
      name: '',
    }
  });

  const onSubmitForm = (data: StaffFormData) => {
    onSubmit(data);
    reset();
    onClose();
  };

  if (!opened) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">הוספת איש צוות חדש</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם מלא
              <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name', { required: 'שדה חובה' })}
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="הכנס שם"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              הוסף
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
