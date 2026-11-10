import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppData } from '../context/AppDataContext';
import { connectSocket, disconnectSocket } from '../api/socket';

export function useWorkoutSocket() {
  const { authToken } = useAppData();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authToken) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket(authToken);

    const onWorkoutChange = () => {
      // Invalidate all queries starting with 'workouts' (e.g. all workouts, workouts by date)
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
    };

    socket.on('workout:created', onWorkoutChange);
    socket.on('workout:updated', onWorkoutChange);
    socket.on('workout:deleted', onWorkoutChange);

    return () => {
      socket.off('workout:created', onWorkoutChange);
      socket.off('workout:updated', onWorkoutChange);
      socket.off('workout:deleted', onWorkoutChange);
    };
  }, [authToken, queryClient]);
}
