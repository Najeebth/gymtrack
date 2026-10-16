import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Library,
  Search,
  Plus,
  Trash2,
  Filter,
  Dumbbell,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import { useExercisesQuery } from '../hooks/useExercisesQuery';
import type { Exercise, MuscleGroup } from '../types';

const MUSCLE_GROUPS: (MuscleGroup | 'All')[] = [
  'All',
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
];

const EQUIPMENT_OPTIONS = [
  'All',
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Other',
];

const fieldInput =
  'w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-brand-orange transition';
const fieldLabel = 'text-xs font-semibold text-brand-muted block mb-1';

export default function ExercisesPage() {
  const { authToken } = useAppData();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query parameters (or sensible defaults)
  const querySearch = searchParams.get('q') || '';
  const queryMuscle = searchParams.get('muscle') || 'All';
  const queryEquipment = searchParams.get('equipment') || 'All';
  const queryPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  // Search input state with debounce
  const [searchTerm, setSearchTerm] = useState(querySearch);
  const debouncedSearch = useDebounce(searchTerm, 350);

  // Keep search box in sync if URL query parameter changes externally
  useEffect(() => {
    setSearchTerm(querySearch);
  }, [querySearch]);

  // Modal state for creating custom exercise
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newExercise, setNewExercise] = useState({
    name: '',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    notes: '',
  });

  // Query hook: handles caching, pagination, filters, and invalidation
  const {
    exercises,
    pagination,
    isLoading: loading,
    error,
    createExercise: createExerciseMutation,
    deleteExercise: deleteExerciseMutation,
    isCreating: isSubmitting,
  } = useExercisesQuery({
    page: queryPage,
    limit: 12,
    search: querySearch,
    muscleGroup: queryMuscle !== 'All' ? queryMuscle : undefined,
    equipment: queryEquipment !== 'All' ? queryEquipment : undefined,
  });

  const totalPages = pagination?.totalPages ?? 1;
  const totalCount = pagination?.total ?? 0;

  // Sync debounced search back into URL search params ONLY when search actually changed
  useEffect(() => {
    const currentQ = searchParams.get('q') || '';
    if (debouncedSearch !== currentQ) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedSearch) {
          next.set('q', debouncedSearch);
        } else {
          next.delete('q');
        }
        next.set('page', '1'); // Only reset to page 1 on active search changes
        return next;
      }, { replace: true });
    }
  }, [debouncedSearch, searchParams, setSearchParams]);

  const handleMuscleChange = (muscle: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (muscle === 'All') next.delete('muscle');
      else next.set('muscle', muscle);
      next.set('page', '1');
      return next;
    });
  };

  const handleEquipmentChange = (equipment: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (equipment === 'All') next.delete('equipment');
      else next.set('equipment', equipment);
      next.set('page', '1');
      return next;
    });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(newPage));
      return next;
    });
  };

  const handleCreateExercise = async (e: FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    if (!newExercise.name.trim()) {
      showToast('Exercise name is required', 'error');
      return;
    }

    try {
      await createExerciseMutation({
        name: newExercise.name.trim(),
        muscleGroup: newExercise.muscleGroup,
        equipment: newExercise.equipment,
        notes: newExercise.notes.trim() || undefined,
      });

      setIsModalOpen(false);
      setNewExercise({ name: '', muscleGroup: 'Chest', equipment: 'Barbell', notes: '' });
    } catch {
      // Toast notification handled inside mutation
    }
  };

  const handleDeleteExercise = async (exercise: Exercise) => {
    if (!authToken || !exercise.isCustom) return;
    if (!window.confirm(`Delete custom exercise "${exercise.name}"?`)) return;

    try {
      await deleteExerciseMutation(exercise.id);
    } catch {
      // Toast notification handled inside mutation
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <Library size={22} className="text-brand-orange" /> Exercise Library
          </h1>
          <p className="text-sm text-brand-muted mt-0.5">
            Explore standard gym movements or create custom exercises with muscle and equipment tags.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm transition"
        >
          <Plus size={16} /> Add Custom Exercise
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-brand-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search exercise by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-brand-orange transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Equipment Dropdown */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-brand-muted shrink-0" />
            <select
              value={queryEquipment}
              onChange={(e) => handleEquipmentChange(e.target.value)}
              aria-label="Filter by equipment"
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-brand-orange transition"
            >
              {EQUIPMENT_OPTIONS.map((eq) => (
                <option key={eq} value={eq}>
                  {eq === 'All' ? 'All Equipment' : eq}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Muscle Group Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="font-semibold text-brand-muted shrink-0 mr-1">Muscle:</span>
          {MUSCLE_GROUPS.map((muscle) => {
            const isActive = queryMuscle === muscle;
            return (
              <button
                key={muscle}
                onClick={() => handleMuscleChange(muscle)}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-brand-navy text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {muscle}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse p-4"
            />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      ) : exercises.length === 0 ? (
        <div className="p-12 text-center bg-white border border-brand-border rounded-xl">
          <Dumbbell size={36} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No exercises found</h3>
          <p className="text-sm text-brand-muted mt-1 max-w-sm mx-auto">
            Try adjusting your search terms or filters, or add a custom exercise!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map((ex) => (
            <div
              key={ex.id}
              className="bg-white border border-brand-border rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-900 text-base leading-snug">
                    {ex.name}
                  </h3>
                  {ex.isCustom && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md shrink-0">
                      <Sparkles size={11} /> Custom
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2.5">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {ex.muscleGroup}
                  </span>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {ex.equipment}
                  </span>
                </div>

                {ex.notes && (
                  <p className="text-xs text-brand-muted mt-2.5 line-clamp-2">
                    {ex.notes}
                  </p>
                )}
              </div>

              {ex.isCustom && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => handleDeleteExercise(ex)}
                    className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-medium transition cursor-pointer"
                  >
                    <Trash2 size={13} /> Delete custom
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-sm text-brand-muted">
          <span>
            Showing page <strong className="text-slate-800">{queryPage}</strong> of{' '}
            <strong className="text-slate-800">{totalPages}</strong> ({totalCount} total)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(queryPage - 1)}
              disabled={queryPage <= 1}
              className="p-2 border border-slate-200 rounded-lg bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const p = idx + 1;
              const isCurrent = p === queryPage;
              return (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  className={`w-8 h-8 rounded-lg font-medium text-xs transition ${
                    isCurrent
                      ? 'bg-brand-orange text-white font-bold shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(queryPage + 1)}
              disabled={queryPage >= totalPages}
              className="p-2 border border-slate-200 rounded-lg bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal: Add Custom Exercise */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Plus size={18} className="text-brand-orange" /> Add Custom Exercise
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateExercise} className="space-y-4">
              <div>
                <label className={fieldLabel}>Exercise Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bulgarian Split Squat"
                  value={newExercise.name}
                  onChange={(e) =>
                    setNewExercise((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className={fieldInput}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabel}>Muscle Group</label>
                  <select
                    value={newExercise.muscleGroup}
                    onChange={(e) =>
                      setNewExercise((prev) => ({ ...prev, muscleGroup: e.target.value }))
                    }
                    className={fieldInput}
                  >
                    {MUSCLE_GROUPS.filter((m) => m !== 'All').map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={fieldLabel}>Equipment</label>
                  <select
                    value={newExercise.equipment}
                    onChange={(e) =>
                      setNewExercise((prev) => ({ ...prev, equipment: e.target.value }))
                    }
                    className={fieldInput}
                  >
                    {EQUIPMENT_OPTIONS.filter((eq) => eq !== 'All').map((eq) => (
                      <option key={eq} value={eq}>
                        {eq}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={fieldLabel}>Form Notes / Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Keep chest up, drive through the front heel..."
                  value={newExercise.notes}
                  onChange={(e) =>
                    setNewExercise((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className={fieldInput}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-navy hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Exercise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

